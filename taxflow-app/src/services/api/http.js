const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Module-level auth token
let _authToken = null;

export function setAuthToken(token) {
  _authToken = token;
}

export function getAuthToken() {
  return _authToken;
}

/**
 * Generic API request handler
 */
export async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  
  // Default 90-second timeout for API calls
  const timeoutMs = options.timeout || 90000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (_authToken) {
      headers['Authorization'] = `Bearer ${_authToken}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });

    if (!response.ok) {
      // Dispatch auth-error event on 401 so AuthContext can trigger logout
      if (response.status === 401) {
        window.dispatchEvent(new CustomEvent('auth-unauthorized'))
      }
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error(`API Timeout (${endpoint}): Request timed out after ${timeoutMs}ms`);
      throw new Error('Request timed out. The server may be busy — please try again.');
    }
    console.error(`API Error (${endpoint}):`, error);
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Employee API — super admin creates employees
 */
