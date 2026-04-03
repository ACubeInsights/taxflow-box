/**
 * Session filter persistence utility.
 * Stores and retrieves filter state from sessionStorage.
 * Key format: route path + filter namespace (e.g., `/dashboard:clientFilters`)
 */

/**
 * Save filters to sessionStorage.
 * @param {string} key - Storage key (e.g., `/dashboard:clientFilters`)
 * @param {object} filters - Filter state to persist
 */
export function saveFilters(key, filters) {
  try {
    sessionStorage.setItem(key, JSON.stringify(filters))
  } catch {
    // Silently fail if sessionStorage is unavailable or full
  }
}

/**
 * Load filters from sessionStorage.
 * @param {string} key - Storage key (e.g., `/dashboard:clientFilters`)
 * @returns {object|null} Deserialized filter state, or null if not found / parse error
 */
export function loadFilters(key) {
  try {
    const raw = sessionStorage.getItem(key)
    if (raw === null) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}
