/**
 * PaginationHelper — Marker-based pagination for Box API list endpoints.
 *
 * Provides two modes:
 *   - `paginate`   — single-page fetch with configurable limit and marker
 *   - `collectAll` — exhaustive fetch that aggregates every page into one array
 *
 * Requirements: 39.1, 39.2, 39.3, 39.4, 39.5
 */

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const MIN_LIMIT = 1;
const COLLECT_ALL_BATCH_SIZE = 100;

export class PaginationHelper {
  /**
   * Wraps a Box API call with marker-based pagination.
   * Clamps limit to [1, 200] range.
   *
   * @template T
   * @param {(marker?: string, limit?: number) => Promise<{ entries: T[], next_marker?: string }>} apiFn
   *   A function that calls a Box list endpoint with optional marker and limit.
   * @param {object} [options]
   * @param {string} [options.marker]  Resume token from a previous page.
   * @param {number} [options.limit]   Page size (default 50, max 200).
   * @returns {Promise<{ entries: T[], nextMarker?: string, limit: number }>}
   */
  async paginate(apiFn, options = {}) {
    const limit = clampLimit(options.limit);
    const marker = options.marker;

    const response = await apiFn(marker, limit);

    const result = {
      entries: response.entries || [],
      limit,
    };

    if (response.next_marker) {
      result.nextMarker = response.next_marker;
    }

    return result;
  }

  /**
   * Collects all pages into a single array. Use for aggregation queries.
   * Processes in batches of 100.
   *
   * @template T
   * @param {(marker?: string, limit?: number) => Promise<{ entries: T[], next_marker?: string }>} apiFn
   *   A function that calls a Box list endpoint with optional marker and limit.
   * @returns {Promise<T[]>}
   */
  async collectAll(apiFn) {
    const all = [];
    let marker;

    do {
      const response = await apiFn(marker, COLLECT_ALL_BATCH_SIZE);
      const entries = response.entries || [];
      all.push(...entries);
      marker = response.next_marker;
    } while (marker);

    return all;
  }
}

/**
 * Clamps a limit value to the valid [1, 200] range.
 * Returns the default (50) when the input is undefined, null, or not a finite number.
 *
 * @param {number | undefined} limit
 * @returns {number}
 */
function clampLimit(limit) {
  if (limit === undefined || limit === null || !Number.isFinite(limit)) {
    return DEFAULT_LIMIT;
  }
  return Math.max(MIN_LIMIT, Math.min(MAX_LIMIT, Math.round(limit)));
}

// Singleton instance
const paginationHelper = new PaginationHelper();
export default paginationHelper;
