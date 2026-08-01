const BASE = import.meta.env.VITE_API_URL ?? '';
const TOKEN_KEY = 'pricescout.token';

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* private mode — session-only auth is an acceptable fallback */
  }
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request(path, { method = 'GET', body, auth = true, signal } = {}) {
  const headers = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  const token = auth ? getToken() : null;
  if (token) headers.authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${BASE}/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError('Cannot reach PriceScout. Check your connection.', 0);
  }

  if (response.status === 204) return null;

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(payload.error ?? `Request failed (${response.status})`, response.status);
  }
  return payload;
}

export const api = {
  health: () => request('/health', { auth: false }),
  search: (query, signal) =>
    request(`/search?q=${encodeURIComponent(query)}`, { auth: true, signal }),
  providers: () => request('/search/providers', { auth: false }),
  product: (id, days = 90) => request(`/products/${id}?days=${days}`),
  history: (id, days) => request(`/products/${id}/history?days=${days}`),
  refreshProduct: (id) => request(`/products/${id}/refresh`, { method: 'POST' }),

  register: (email, password) =>
    request('/auth/register', { method: 'POST', body: { email, password }, auth: false }),
  login: (email, password) =>
    request('/auth/login', { method: 'POST', body: { email, password }, auth: false }),
  me: () => request('/auth/me'),

  watchlist: () => request('/watchlist'),
  addWatch: (body) => request('/watchlist', { method: 'POST', body }),
  updateWatch: (id, body) => request(`/watchlist/${id}`, { method: 'PATCH', body }),
  removeWatch: (id) => request(`/watchlist/${id}`, { method: 'DELETE' }),

  notifications: () => request('/notifications'),
  markRead: (id) => request(`/notifications/${id}/read`, { method: 'POST' }),
  markAllRead: () => request('/notifications/read-all', { method: 'POST' }),
};
