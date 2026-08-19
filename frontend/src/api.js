const AUTH_URL = 'http://localhost:8082';
const CATALOG_URL = 'http://localhost:8081';
const BOOKING_URL = 'http://localhost:8083';
const AI_URL = 'http://localhost:8084';
const ANALYTICS_URL = 'http://localhost:8085';

async function request(url, options = {}) {
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!res.ok) {
    throw new Error(
        `${options.method || 'GET'} ${url} failed: ${res.status}`
    );
  }

  return res.json();
}

export const api = {
  // Auth Service - 8082
  login: (email, password) =>
      request(`${AUTH_URL}/api/auth/login`, {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),

  register: (email, password) =>
      request(`${AUTH_URL}/api/auth/register`, {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),

  // Catalog Service - 8081
  catalog: () =>
      request(`${CATALOG_URL}/api/catalog`),

  // Booking Service - 8083
  book: (userId, eventId) =>
      request(`${BOOKING_URL}/api/bookings`, {
        method: 'POST',
        body: JSON.stringify({ userId, eventId }),
      }),

  // AI Insight Service - 8084
  analyze: (text) =>
      request(`${AI_URL}/api/analyze`, {
        method: 'POST',
        body: JSON.stringify({ text }),
      }),

  // Booking Service - 8083
  review: (bookingId, text) =>
      request(`${BOOKING_URL}/api/bookings/${bookingId}/review`, {
        method: 'POST',
        body: JSON.stringify({ text }),
      }),

  // Analytics Service - 8085
  analyticsSummary: () =>
      request(`${ANALYTICS_URL}/api/analytics/summary`),
};