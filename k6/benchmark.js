// Benchmark: baseline for POST /orders  and GET /orders/{id}.
import { createOrder, getOrder } from './lib/api.js';

export const options = {
  vus: 10,
  duration: '30s',
  thresholds: {
    'http_req_duration{endpoint:create}': ['p(95)<250', 'p(99)<400'],
    'http_req_failed{endpoint:create}': ['rate<0.01'],
    'http_reqs{endpoint:create}': ['rate>80'],
    'http_req_duration{endpoint:get_by_id}': ['p(95)<50'],
    'http_req_failed{endpoint:get_by_id}': ['rate<0.01'],
    'http_req_failed': ['rate<0.01'],
    'checks': ['rate>0.99'],
  },
};

export default function () {
  const created = createOrder();
  getOrder(created.json('id'));
}
