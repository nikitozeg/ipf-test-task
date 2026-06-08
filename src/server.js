'use strict';

const http = require('http');
const config = require('./config');
const { Semaphore, BusyError } = require('./semaphore');
const store = require('./orders');

const semaphore = new Semaphore(config.MAX_CONCURRENCY, config.MAX_QUEUE);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelay(min, max) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 1_000_000) {
        reject(new Error('payload_too_large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(new Error('invalid_json'));
      }
    });
    req.on('error', reject);
  });
}

// ---- Route handlers ---------------------------------------------------------

async function handlePlaceOrder(req, res) {
  let body;
  try {
    body = await readJsonBody(req);
  } catch (e) {
    return sendJson(res, 400, { error: e.message });
  }
  // Constraint #2: simulated downstream processing delay (80–120ms default).
  await sleep(randomDelay(config.POST_DELAY_MIN_MS, config.POST_DELAY_MAX_MS));
  const order = store.createOrder(body || {});
  return sendJson(res, 201, order);
}

function handleGetOrder(req, res, id) {
  const order = store.getOrder(id);
  if (!order) return sendJson(res, 404, { error: 'not_found', id });
  return sendJson(res, 200, order);
}

function handleListOrders(req, res, url) {
  // Params are read but intentionally NOT enforced (constraint #1).
  const page = Number.parseInt(url.searchParams.get('page'), 10) || 1;
  const limit = Number.parseInt(url.searchParams.get('limit'), 10) || 0;
  const all = store.listOrders(); // full scan, returns everything
  return sendJson(res, 200, {
    page,
    limit, // echoed back but ignored
    requestedLimit: limit,
    returned: all.length, // == total, proving limit is not applied
    total: all.length,
    orders: all,
  });
}

async function handleUpdateStatus(req, res, id) {
  let body;
  try {
    body = await readJsonBody(req);
  } catch (e) {
    return sendJson(res, 400, { error: e.message });
  }
  const nextStatus = body && body.status;
  if (!nextStatus) return sendJson(res, 400, { error: 'status_required' });
  const result = store.updateStatus(id, nextStatus);
  if (result.error === 'not_found') return sendJson(res, 404, { error: 'not_found', id });
  if (result.error === 'invalid_status') {
    return sendJson(res, 400, { error: 'invalid_status', allowed: store.STATUSES });
  }
  if (result.error === 'invalid_transition') {
    return sendJson(res, 409, {
      error: 'invalid_transition',
      from: result.from,
      to: result.to,
      allowedNext: store.TRANSITIONS[result.from],
    });
  }
  return sendJson(res, 200, result.order);
}

// ---- Router -----------------------------------------------------------------

const ORDER_ID_RE = /^\/orders\/([^/]+)$/;
const ORDER_STATUS_RE = /^\/orders\/([^/]+)\/status$/;

async function route(req, res, url) {
  const { method } = req;
  const path = url.pathname;

  if (method === 'POST' && path === '/orders') return handlePlaceOrder(req, res);
  if (method === 'GET' && path === '/orders') return handleListOrders(req, res, url);

  const statusMatch = path.match(ORDER_STATUS_RE);
  if (statusMatch && method === 'PATCH') {
    return handleUpdateStatus(req, res, decodeURIComponent(statusMatch[1]));
  }

  const idMatch = path.match(ORDER_ID_RE);
  if (idMatch && method === 'GET') {
    return handleGetOrder(req, res, decodeURIComponent(idMatch[1]));
  }

  return sendJson(res, 404, { error: 'route_not_found', method, path });
}

// ---- Server -----------------------------------------------------------------

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  // Health/metrics endpoints bypass the concurrency limit so probes and
  // load-test warmups always work.
  if (url.pathname === '/health') {
    return sendJson(res, 200, { status: 'ok', orders: store.count() });
  }
  if (url.pathname === '/metrics') {
    return sendJson(res, 200, { ...semaphore.stats(), orders: store.count() });
  }

  // Technical, TEST-ONLY endpoint: wipe all records so each perf run starts
  // from a known clean state. Bypasses the concurrency limit on purpose.
  if (url.pathname === '/technical/orders' && req.method === 'DELETE') {
    const deleted = store.clear();
    return sendJson(res, 200, { deleted });
  }

  // Constraint #3: gate every business request behind the semaphore.
  try {
    await semaphore.acquire();
  } catch (e) {
    if (e instanceof BusyError) {
      return sendJson(res, 503, { error: 'server_busy', retryAfter: 1 });
    }
    return sendJson(res, 500, { error: 'internal_error' });
  }

  try {
    await route(req, res, url);
  } catch (e) {
    if (!res.headersSent) sendJson(res, 500, { error: 'internal_error' });
  } finally {
    semaphore.release();
  }
});

server.listen(config.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(
    `Order Processing API listening on :${config.PORT} ` +
      `(maxConcurrency=${config.MAX_CONCURRENCY}, ` +
      `postDelay=${config.POST_DELAY_MIN_MS}-${config.POST_DELAY_MAX_MS}ms, ` +
      `maxQueue=${config.MAX_QUEUE || 'unbounded'})`,
  );
});

module.exports = server;
