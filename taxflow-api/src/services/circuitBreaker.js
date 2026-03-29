/**
 * CircuitBreaker — Fault tolerance for Box API calls.
 *
 * Tracks failure rates over a rolling window and stops requests during
 * sustained failures, recovering gracefully via a half-open probe.
 *
 * States:
 *   closed    → requests flow normally; failures are tracked
 *   open      → all requests rejected with 503; cooldown timer running
 *   half-open → single probe request allowed; success → closed, failure → open
 *
 * Requirements: 38.1, 38.2, 38.3, 38.4, 38.5
 */

/** @typedef {'closed' | 'open' | 'half-open'} CircuitState */

export class CircuitBreaker {
  /**
   * @param {object} [options]
   * @param {number} [options.windowMs=60000]   Rolling window duration in ms.
   * @param {number} [options.threshold=0.5]    Failure rate threshold (0–1).
   * @param {number} [options.cooldownMs=30000] Cooldown before half-open probe.
   * @param {number} [options.minRequests=10]   Minimum requests in window before threshold applies.
   */
  constructor({
    windowMs = 60_000,
    threshold = 0.5,
    cooldownMs = 30_000,
    minRequests = 10,
  } = {}) {
    this._windowMs = windowMs;
    this._threshold = threshold;
    this._cooldownMs = cooldownMs;
    this._minRequests = minRequests;

    /** @type {CircuitState} */
    this._state = 'closed';

    /** @type {Array<{ timestamp: number, success: boolean }>} */
    this._records = [];

    /** @type {number | null} Timestamp when circuit opened */
    this._openedAt = null;

    /** @type {boolean} Whether a half-open probe is in flight */
    this._probeInFlight = false;

    /** @type {Array<(from: CircuitState, to: CircuitState) => void>} */
    this._listeners = [];
  }

  /**
   * Wraps a function call with circuit breaker logic.
   *
   * @template T
   * @param {() => Promise<T>} fn - The async operation to protect.
   * @returns {Promise<T>}
   */
  async execute(fn) {
    // --- OPEN state: check if cooldown has elapsed ---
    if (this._state === 'open') {
      const elapsed = Date.now() - this._openedAt;
      if (elapsed >= this._cooldownMs) {
        this._transition('half-open');
      } else {
        const err = new Error('Circuit breaker is open — request rejected');
        err.statusCode = 503;
        throw err;
      }
    }

    // --- HALF-OPEN state: allow only one probe ---
    if (this._state === 'half-open') {
      if (this._probeInFlight) {
        const err = new Error('Circuit breaker is half-open — probe in progress');
        err.statusCode = 503;
        throw err;
      }
      this._probeInFlight = true;

      try {
        const result = await fn();
        this._probeInFlight = false;
        this._records = [];
        this._transition('closed');
        return result;
      } catch (error) {
        this._probeInFlight = false;
        this._openedAt = Date.now();
        this._transition('open');
        throw error;
      }
    }

    // --- CLOSED state: execute and track ---
    try {
      const result = await fn();
      this._record(true);
      return result;
    } catch (error) {
      this._record(false);
      this._evaluateThreshold();
      throw error;
    }
  }

  /**
   * Returns the current circuit state.
   *
   * @returns {CircuitState}
   */
  getState() {
    // If open and cooldown elapsed, transition to half-open lazily
    if (this._state === 'open' && Date.now() - this._openedAt >= this._cooldownMs) {
      this._transition('half-open');
    }
    return this._state;
  }

  /**
   * Registers a listener for state change events.
   *
   * @param {(from: CircuitState, to: CircuitState) => void} listener
   */
  onStateChange(listener) {
    this._listeners.push(listener);
  }

  // ── Internal helpers ──────────────────────────────────────────────

  /**
   * Records a request outcome and prunes stale entries outside the window.
   *
   * @param {boolean} success
   */
  _record(success) {
    const now = Date.now();
    this._records.push({ timestamp: now, success });
    this._prune(now);
  }

  /**
   * Removes records older than the rolling window.
   *
   * @param {number} now
   */
  _prune(now) {
    const cutoff = now - this._windowMs;
    // Records are appended chronologically, so we can find the first valid index
    let firstValid = 0;
    while (firstValid < this._records.length && this._records[firstValid].timestamp < cutoff) {
      firstValid++;
    }
    if (firstValid > 0) {
      this._records = this._records.slice(firstValid);
    }
  }

  /**
   * Checks if the failure rate exceeds the threshold and opens the circuit.
   */
  _evaluateThreshold() {
    const total = this._records.length;
    if (total < this._minRequests) return;

    const failures = this._records.filter((r) => !r.success).length;
    const failureRate = failures / total;

    if (failureRate > this._threshold) {
      this._openedAt = Date.now();
      this._transition('open');
    }
  }

  /**
   * Transitions to a new state and notifies listeners.
   *
   * @param {CircuitState} to
   */
  _transition(to) {
    if (this._state === to) return;
    const from = this._state;
    this._state = to;
    for (const listener of this._listeners) {
      try {
        listener(from, to);
      } catch {
        // Listener errors must not break the breaker
      }
    }
  }
}

// Singleton instance with default settings
const circuitBreaker = new CircuitBreaker();
export default circuitBreaker;
