// Benchmark: baseline for POST /orders  and GET /orders/{id}.

/*  To run:
 cd /Users/admin/Documents/ipf/k6
 K6_WEB_DASHBOARD=true \
 K6_WEB_DASHBOARD_EXPORT=benchmark.html \
 K6_WEB_DASHBOARD_PERIOD=1s \
 k6 run benchmark.js
*/


import { createOrder, getOrder } from './lib/api.js';

export const options = {
  vus: 20,
  duration: '30s',
  thresholds: {
    // create
    'http_req_duration{endpoint:create}': ['p(95)<250', 'p(99)<400'],
    'http_req_failed{endpoint:create}': ['rate<0.01'],
    'http_reqs{endpoint:create}': ['rate>80', 'rate<150'],
    //get_by_id
    'http_req_duration{endpoint:get_by_id}': ['p(95)<150'],
    'http_req_failed{endpoint:get_by_id}': ['rate<0.01'],

    //exptected
    'http_req_failed': ['rate<0.01'],
    'checks': ['rate>0.99'],
  },
};

export default function () {
  const created = createOrder();
  getOrder(created.json('id'));
}
