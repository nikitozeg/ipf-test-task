// Load test.
//Realistic mixed traffic at a sustainable rate with open model.

import { createOrder, getOrder, listOrders, updateStatus, reset, seedOrders, randomId } from './lib/api.js';

export const options = {
  scenarios: {
    realistic: {
      executor: 'ramping-arrival-rate', // open model: we set req/s, k6 sizes the VUs
      startRate: 5,
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 200,
      stages: [
        { duration: '1m', target: 50 }, // ramp to 50 req/s
        { duration: '3m', target: 50 }, // hold (realistic peak?)
        { duration: '1m', target: 0 },  // ramp down
      ],
    },
  },
  thresholds: {
    'http_req_duration{endpoint:get_by_id}': ['p(95)<50'],
    'http_req_duration{endpoint:list}': ['p(95)<400'],
    'http_req_duration{endpoint:create}': ['p(95)<300'],
    'http_req_duration{endpoint:patch}': ['p(95)<300'],
    'http_req_failed': ['rate<0.01'],
    'checks': ['rate>0.99'],
  },
};

export function setup() {
  reset();
  const ids = seedOrders(200);
  console.log(`Seeded ${ids.length} orders`);
  return { ids };
}

// Traffic mix  like a real FX service:
//   60%  GET    /orders/{id}         (read one by id)
//   25%  GET    /orders            ( list all)
//   10%  POST   /orders              (create)
//    5%  PATCH  /orders/{id}/status
export default function (data) {
  const r = Math.random();
  if (r < 0.60) getOrder(randomId(data.ids));
  else if (r < 0.85) listOrders();
  else if (r < 0.95) createOrder();
  else updateStatus(randomId(data.ids));
}
