// Benchmark: GET /orders (list)
//
//   1) before run, please seed a data:   SEED=2000 k6 run helpers/seed.js
//   2) run test:
//
//       K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_EXPORT=benchmark-list-report.html \
//       K6_WEB_DASHBOARD_PERIOD=1s k6 run benchmark-list.js

import { listOrders } from './lib/api.js';

export const options = {
  vus: 10,
  duration: '30s',
  thresholds: {
    'http_req_duration{endpoint:list}': ['p(95)<400'],
    'http_req_failed': ['rate<0.01'],
  },
};

export default function () {
  listOrders();
}
