'use strict';


function intEnv(name, def) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return def;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : def;
}

module.exports = {
  PORT: intEnv('PORT', 3000),

  // Constraint #3 is 10- concurrency limit
  MAX_CONCURRENCY: intEnv('MAX_CONCURRENCY', 10),


  MAX_QUEUE: intEnv('MAX_QUEUE', 0),

  // Constraint #2 is simulated downstream processing delay on POST /orders
  POST_DELAY_MIN_MS: intEnv('POST_DELAY_MIN_MS', 80),
  POST_DELAY_MAX_MS: intEnv('POST_DELAY_MAX_MS', 120),
};
