function decodeToken(token) {
  try {
    if (!token) return null;

    const payload = token.split('.')[1];
    if (!payload) return null;

    const decoded = atob(
      payload.replace(/-/g, '+').replace(/_/g, '/')
    );

    return JSON.parse(decoded);
  } catch {
    return null;
  }
}
async function request(path, options = {}) {
  const token = localStorage.getItem('eventhub_token');

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(path, {
    ...options,
    headers,
  });

  let data = null;

  try {
    data = await response.json();
  } catch {
    // Some responses may not contain JSON.
  }

  if (!response.ok) {
    const message =
      data?.error ||
      data?.detail ||
      `Request failed (${response.status})`;

    throw new Error(message);
  }

  return data;
}

export const api = {
  // =========================
  // AUTH - 8082
  // =========================

  register: (email, password) =>
    request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password,
      }),
    }),

  login: (email, password) =>
    request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password,
      }),
    }),

  // =========================
  // CATALOG - 8081
  // =========================

  catalog: () =>
    request('/api/catalog'),

  // =========================
  // BOOKING - 8083
  // =========================

book: (userId, eventId) =>
  request('/api/bookings', {
    method: 'POST',
    body: JSON.stringify({
      userId: String(userId),
      eventId: Number(eventId),
    }),
  }),

  bookings: () =>
    request('/api/bookings'),

  // =========================
  // REVIEWS - 8083
  // =========================

  review: (bookingId, text) =>
    request(`/api/bookings/${bookingId}/review`, {
      method: 'POST',
      body: JSON.stringify({
        text,
      }),
    }),

  reviews: () =>
    request('/api/reviews'),

  // =========================
  // AI INSIGHT - 8084
  // =========================

  analyze: (text) =>
    request('/api/analyze', {
      method: 'POST',
      body: JSON.stringify({
        text,
      }),
    }),

  // =========================
  // ANALYTICS - 8085
  // =========================

  analyticsSummary: () =>
    request('/api/analytics/summary'),
};
export { decodeToken };