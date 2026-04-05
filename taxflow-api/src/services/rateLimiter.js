/**
 * RateLimiter — In-memory priority queue for Box API request concurrency.
 *
 * Enforces max 10 concurrent requests/second with priority-based ordering.
 * Handles HTTP 429 responses by re-queuing with Retry-After delay.
 * Rejects low-priority requests when queue depth exceeds 1000.
 *
 * Requirements: 37.1, 37.2, 37.3, 37.4, 37.5
 */

import { createHttpError } from '../utils/httpError.js';

/** @typedef {'urgent' | 'high' | 'normal' | 'low'} Priority */

const PRIORITY_ORDER = { urgent: 0, high: 1, normal: 2, low: 3 };
const MAX_CONCURRENT = 10;
const MAX_QUEUE_DEPTH = 1000;

let jobCounter = 0;

export class RateLimiter {
  /**
   * @param {object} [options]
   * @param {number} [options.maxConcurrent=10] Maximum concurrent requests.
   * @param {number} [options.maxQueueDepth=1000] Queue depth before rejecting low-priority.
   */
  constructor({ maxConcurrent = MAX_CONCURRENT, maxQueueDepth = MAX_QUEUE_DEPTH } = {}) {
    this.maxConcurrent = maxConcurrent;
    this.maxQueueDepth = maxQueueDepth;

    /** @type {Array<{ jobId: string, priority: Priority, priorityValue: number, seq: number, execute: () => Promise<any>, resolve: Function, reject: Function, delayUntil: number }>} */
    this._queue = [];

    /** @type {number} */
    this._activeCount = 0;

    /** @type {boolean} */
    this._draining = false;
  }

  /**
   * Enqueues a Box API request with priority.
   * Enforces max concurrent requests and handles 429 re-queuing.
   *
   * @template T
   * @param {() => Promise<T>} execute - The function that performs the API call.
   * @param {Priority} [priority='normal'] - Request priority level.
   * @returns {Promise<T>}
   */
  async enqueue(execute, priority = 'normal') {
    const depth = this._queue.length;

    // Reject low-priority requests when queue is full (Req 37.5)
    if (priority === 'low' && depth >= this.maxQueueDepth) {
      const err = createHttpError('Queue depth exceeded — low-priority request rejected', 503);
      err.retryAfter = 30;
      throw err;
    }

    return new Promise((resolve, reject) => {
      const job = {
        jobId: `job_${++jobCounter}`,
        priority,
        priorityValue: PRIORITY_ORDER[priority] ?? PRIORITY_ORDER.normal,
        seq: jobCounter,
        execute,
        resolve,
        reject,
        delayUntil: 0,
      };

      this._insertSorted(job);
      this._drain();
    });
  }

  /**
   * Returns current queue depth (pending jobs not yet executing).
   *
   * @returns {Promise<number>}
   */
  async getQueueDepth() {
    return this._queue.length;
  }

  /**
   * Inserts a job into the queue maintaining priority + FIFO order.
   * @param {object} job
   */
  _insertSorted(job) {
    // Binary search for insertion point: sort by priorityValue ASC, then seq ASC
    let lo = 0;
    let hi = this._queue.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      const existing = this._queue[mid];
      if (
        existing.priorityValue < job.priorityValue ||
        (existing.priorityValue === job.priorityValue && existing.seq < job.seq)
      ) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    this._queue.splice(lo, 0, job);
  }

  /**
   * Drains the queue, executing jobs up to the concurrency limit.
   */
  _drain() {
    if (this._draining) return;
    this._draining = true;

    const processNext = () => {
      this._draining = false;

      while (this._activeCount < this.maxConcurrent && this._queue.length > 0) {
        const now = Date.now();
        // Find the first job whose delay has elapsed
        const idx = this._queue.findIndex((j) => j.delayUntil <= now);
        if (idx === -1) {
          // All remaining jobs are delayed — schedule a wake-up
          const earliest = Math.min(...this._queue.map((j) => j.delayUntil));
          const wait = Math.max(earliest - now, 1);
          setTimeout(() => this._drain(), wait);
          return;
        }

        const job = this._queue.splice(idx, 1)[0];
        this._activeCount++;

        this._executeJob(job).then(() => {
          this._activeCount--;
          this._drain();
        });
      }
    };

    processNext();
  }

  /**
   * Executes a single job, handling 429 re-queuing.
   * @param {object} job
   */
  async _executeJob(job) {
    try {
      const result = await job.execute();
      job.resolve(result);
    } catch (err) {
      // Handle HTTP 429 — re-queue with Retry-After delay (Req 37.3)
      if (this._is429(err)) {
        const retryAfter = this._extractRetryAfter(err);
        job.delayUntil = Date.now() + retryAfter * 1000;
        this._insertSorted(job);
        // Don't resolve/reject — the job will be retried
        return;
      }
      job.reject(err);
    }
  }

  /**
   * Checks if an error represents an HTTP 429 response.
   * @param {Error} err
   * @returns {boolean}
   */
  _is429(err) {
    return (
      err.statusCode === 429 ||
      err.status === 429 ||
      err.response?.status === 429 ||
      err.response?.statusCode === 429
    );
  }

  /**
   * Extracts the Retry-After value in seconds from a 429 error.
   * Defaults to 1 second if header is missing.
   * @param {Error} err
   * @returns {number}
   */
  _extractRetryAfter(err) {
    const header =
      err.retryAfter ??
      err.response?.headers?.['retry-after'] ??
      err.headers?.['retry-after'];
    const parsed = Number(header);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  }
}

// Singleton instance with default settings
const rateLimiter = new RateLimiter();
export default rateLimiter;
