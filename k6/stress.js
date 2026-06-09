// Stress test
//push the arrival rate past capacity to find the breaking point.

import { createOrder, getOrder, listOrders, updateStatus, reset, seedOrders, randomId } from './lib/api.js';

const T = { timeout: '10s' }; // timeouts, instead oft infinite waits

export const options = {
  scenarios: {
    stress: {
      executor: 'ramping-arrival-rate',
      startRate: 50,
      timeUnit: '1s',
      preAllocatedVUs: 100,
      maxVUs: 1000, // generous: as the server slows, k6 needs more VUs to hold the rate
      stages: [
        { duration: '30s', target: 100 },
        { duration: '1m', target: 300 },
        { duration: '1m', target: 600 },
        { duration: '1m', target: 1000 },
        { duration: '1m', target: 1500 }, //peak
        { duration: '30s', target: 0 },
      ],
    },
  },
  thresholds: {
    // expected break:
      'http_req_failed': [{ threshold: 'rate<0.05', abortOnFail: true, delayAbortEval: '30s' }],
      'http_req_duration{endpoint:get_by_id}': ['p(95)<50'],
      'http_req_duration{endpoint:create}': ['p(95)<3000'],
      'http_req_duration{endpoint:list}':    ['p(95)<5000'],
      'http_req_duration{endpoint:patch}':   ['p(95)<3000'],
  },
};

export function setup() {
  reset();
  const ids = seedOrders(200);
  console.log(`Seeded ${ids.length} orders`);
  return { ids };
}



export default function (data) {
  const r = Math.random();
  if (r < 0.60) getOrder(randomId(data.ids), T);
  else if (r < 0.85) listOrders(T);
  else if (r < 0.95) createOrder(T);
  else updateStatus(randomId(data.ids), T);
}
