// Seed orders
//
// To run:
// SEED=2000 k6 run helpers/seed.js

import { reset, seedOrders } from '../lib/api.js';

const SEED = Number(__ENV.SEED || 500);

export const options = { vus: 1, iterations: 1 };

export default function () {
  reset();
  const ids = seedOrders(SEED);
  console.log(`Seeded ${ids.length} orders`);
}
