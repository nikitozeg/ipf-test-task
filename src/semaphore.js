'use strict';

// Simple async counting semaphore used to enforce the "max N simultaneous
// connections" constraint. Requests that arrive while N slots are busy wait
// in FIFO order. If maxQueue > 0 and the queue is full, acquire() rejects so
// the caller can shed load (HTTP 503).
class BusyError extends Error {
  constructor() {
    super('Server busy');
    this.name = 'BusyError';
  }
}

class Semaphore {
  constructor(max, maxQueue = 0) {
    this.max = max;
    this.maxQueue = maxQueue;
    this.inUse = 0;
    this.queue = [];
  }

  acquire() {
    return new Promise((resolve, reject) => {
      if (this.inUse < this.max) {
        this.inUse += 1;
        resolve();
        return;
      }
      if (this.maxQueue > 0 && this.queue.length >= this.maxQueue) {
        reject(new BusyError());
        return;
      }
      this.queue.push(resolve);
    });
  }

  release() {
    const next = this.queue.shift();
    if (next) {
      // Hand the slot straight to the next waiter (inUse stays the same).
      next();
    } else {
      this.inUse -= 1;
    }
  }

  stats() {
    return { inUse: this.inUse, waiting: this.queue.length, max: this.max };
  }
}

module.exports = { Semaphore, BusyError };
