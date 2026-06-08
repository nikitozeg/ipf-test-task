'use strict';

const crypto = require('crypto');

// шn-memory store of FX conversions
const conversions = new Map();

// сonversion status state machine
const STATUSES = ['awaiting_funds', 'funds_arrived', 'completed', 'cancelled'];
const TRANSITIONS = {
  awaiting_funds: ['funds_arrived', 'cancelled'],
  funds_arrived: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

function canTransition(from, to) {
  return TRANSITIONS[from] ? TRANSITIONS[from].includes(to) : false;
}

// ---- formatting helpers -----------------------------------------------------

function pad2(n) {
  return String(n).padStart(2, '0');
}

// Money as a 2-decimal string ("106.54"), like the CurrencyCloud payload.
function money(n) {
  return (Math.round(n * 100) / 100).toFixed(2);
}

// Rates as a 4-decimal string
function rate(n) {
  return (Math.round(n * 10000) / 10000).toFixed(4);
}

// Reference like "20220131-BHWNYW": yyyymmdd + 6 random base36 chars.
function shortReference(date) {
  const ymd = `${date.getUTCFullYear()}${pad2(date.getUTCMonth() + 1)}${pad2(date.getUTCDate())}`;
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let suffix = '';
  for (let i = 0; i < 6; i += 1) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${ymd}-${suffix}`;
}

// ---- create -----------------------------------------------------------------

function createOrder(body = {}) {
  const now = new Date();
  const nowIso = now.toISOString();

  const buyCurrency = String(body.buy_currency || 'USD').toUpperCase();
  const sellCurrency = String(body.sell_currency || 'GBP').toUpperCase();
  const fixedSide = body.fixed_side === 'sell' ? 'sell' : 'buy';

  // A mid-market rate around 1.4080 with a little jitter, plus a tiny client spread.
  const midMarket = 1.408 + (Math.random() - 0.5) * 0.01;
  const clientRate = midMarket - 0.0001;

  // The "amount" applies to whichever side is fixed; derive the other side.
  const amount = Number(body.amount != null ? body.amount : 150);
  let clientBuyAmount;
  let clientSellAmount;
  if (fixedSide === 'buy') {
    clientBuyAmount = amount;
    clientSellAmount = amount / clientRate;
  } else {
    clientSellAmount = amount;
    clientBuyAmount = amount * clientRate;
  }

  // settlement two days out; conversion_date is today at 00:00 UTC.
  const settlement = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  const conversionDate = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );

  const conversion = {
    id: crypto.randomUUID(),
    settlement_date: settlement.toISOString(),
    conversion_date: conversionDate.toISOString(),
    short_reference: shortReference(now),
    creator_contact_id: body.creator_contact_id || crypto.randomUUID(),
    account_id: body.account_id || crypto.randomUUID(),
    currency_pair: `${sellCurrency}${buyCurrency}`,
    status: 'awaiting_funds',
    buy_currency: buyCurrency,
    sell_currency: sellCurrency,
    client_buy_amount: money(clientBuyAmount),
    client_sell_amount: money(clientSellAmount),
    fixed_side: fixedSide,
    core_rate: rate(clientRate),
    partner_rate: '',
    partner_buy_amount: '0.00',
    partner_sell_amount: '0.00',
    client_rate: rate(clientRate),
    deposit_required: false,
    deposit_amount: '0.00',
    deposit_currency: '',
    deposit_status: 'not_required',
    deposit_required_at: '',
    payment_ids: [],
    unallocated_funds: money(clientBuyAmount),
    unique_request_id: body.unique_request_id != null ? body.unique_request_id : null,
    created_at: nowIso,
    updated_at: nowIso,
    mid_market_rate: rate(midMarket),
  };

  conversions.set(conversion.id, conversion);
  return conversion;
}

function getOrder(id) {
  return conversions.get(id) || null;
}

// Constraint #1: full in-memory scan on every call, and ?limit= is NOT
// enforced — we deliberately materialise and return every record. The page/
// limit params are accepted but ignored, matching the buggy behaviour the
// performance tests are meant to surface.
function listOrders() {
  const all = [];
  for (const conversion of conversions.values()) {
    all.push(conversion); // full scan, O(n) every request
  }
  return all;
}

function updateStatus(id, nextStatus) {
  const conversion = conversions.get(id);
  if (!conversion) return { error: 'not_found' };
  if (!STATUSES.includes(nextStatus)) return { error: 'invalid_status' };
  if (!canTransition(conversion.status, nextStatus)) {
    return { error: 'invalid_transition', from: conversion.status, to: nextStatus };
  }
  conversion.status = nextStatus;
  conversion.updated_at = new Date().toISOString();
  return { order: conversion };
}

function count() {
  return conversions.size;
}

// Technical helper (test-only): wipe all records, return how many were removed.
function clear() {
  const n = conversions.size;
  conversions.clear();
  return n;
}

module.exports = {
  STATUSES,
  TRANSITIONS,
  createOrder,
  getOrder,
  listOrders,
  updateStatus,
  count,
  clear,
};
