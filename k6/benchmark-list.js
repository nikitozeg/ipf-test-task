// Benchmark: GET /orders (list) at a fixed seeded volume.

//To run:
// cd ipf/k6
//  K6_WEB_DASHBOARD=true \
//  K6_WEB_DASHBOARD_EXPORT=benchmark-list-report.html \
//  K6_WEB_DASHBOARD_PERIOD=1s \
//  SEED=2000 \
//  k6 run benchmark-list.js

// Run 1:  SEED=2000 k6 run benchmark-list.js
// Run 2:  SEED=500 k6 run benchmark-list.js
// Run 3:  SEED=200 k6 run benchmark-list.js


import { reset, seedOrders, listOrders } from './lib/api.js';

const SEED = Number(__ENV.SEED || 500);

export const options = {
  vus: 10,
  duration: '30s',
  thresholds: {
    'http_req_duration{endpoint:list}': ['p(95)<400'],
    'http_req_failed': ['rate<0.01'],
  },
};

export function setup() {
  reset();
  const ids = seedOrders(SEED);
  console.log(`Seeded ${ids.length} orders`);
  return { ids };
}

export default function () {
  listOrders();
}
