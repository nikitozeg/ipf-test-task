// Shared API client
// Each helper sends one request, tags it by endpoint, runs the standard check,
// and returns the response — so the test files stay thin.

import http from 'k6/http';
import { check } from 'k6';

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

// 409 on PATCH  is an expected outcome
export const PATCH_OK = http.expectedStatuses(200, 409);

// Body for POST /orders (a currency conversion).
export function orderPayload() {
  return JSON.stringify({
    buy_currency: 'USD',
    sell_currency: 'GBP',
    fixed_side: 'buy',
    amount: '150.00',
  });
}

// `opts` lets a test pass extra request options, e.g. timeout: '10s'
export function createOrder(opts = {}) {
  const res = http.post(`${BASE_URL}/orders`, orderPayload(), {
    headers: JSON_HEADERS,
    tags: { endpoint: 'create' },
    ...opts,
  });
  check(res, { 'create -> 201': (r) => r.status === 201 });
  return res;
}

export function getOrder(id, opts = {}) {
  const res = http.get(`${BASE_URL}/orders/${id}`, {
    tags: { endpoint: 'get_by_id' },
    ...opts,
  });
  check(res, { 'get -> 200': (r) => r.status === 200 });
  return res;
}

export function listOrders(opts = {}) {
  const res = http.get(`${BASE_URL}/orders?page=1&limit=10`, {
    tags: { endpoint: 'list' },
    ...opts,
  });
  check(res, { 'list -> 200': (r) => r.status === 200 });
  return res;
}

export function updateStatus(id, opts = {}) {
  const res = http.patch(`${BASE_URL}/orders/${id}/status`, JSON.stringify({ status: 'funds_arrived' }), {
    headers: JSON_HEADERS,
    tags: { endpoint: 'patch' },
    responseCallback: PATCH_OK,
    ...opts,
  });
  check(res, { 'patch handled': (r) => r.status === 200 || r.status === 409 });
  return res;
}

// Pick a random id from a seeded pool.
export function randomId(ids) {
  return ids[Math.floor(Math.random() * ids.length)];
}

// Wipe all records (test-only technical endpoint).
export function reset() {
  return http.del(`${BASE_URL}/technical/orders`);
}

// Build the request tuple for one seed order (used by http.batch).
function seedRequest() {
  return ['POST', `${BASE_URL}/orders`, orderPayload(), {
    headers: JSON_HEADERS,
    tags: { endpoint: 'seed' },
  }];
}

// Seed `n` orders in parallel batches; returns the array of created ids
export function seedOrders(n) {
  const ids = [];
  const BATCH = 50;

  for (let created = 0; created < n; created += BATCH) {
    const size = Math.min(BATCH, n - created); // last batch may be smaller
    const batch = Array.from({ length: size }, seedRequest);

    http.batch(batch).forEach((res) => {
      if (res.status === 201) ids.push(res.json('id'));
    });
  }
  return ids;
}
