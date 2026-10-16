const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../config/db.config');
const { getHealth } = require('../controllers/health.controller');

test('health controller: returns connected when pool.query succeeds', async () => {
  const originalQuery = pool.query;
  pool.query = async () => [[{ 1: 1 }]];

  let statusCode = null;
  let responseBody = null;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      responseBody = data;
      return this;
    },
  };

  try {
    await getHealth({}, res);
    assert.equal(statusCode, 200);
    assert.equal(responseBody.success, true);
    assert.equal(responseBody.status, 'OK');
    assert.equal(responseBody.database, 'connected');
  } finally {
    pool.query = originalQuery;
  }
});

test('health controller: returns disconnected and handles errors when pool.query fails', async () => {
  const originalQuery = pool.query;
  const originalError = console.error;
  let loggedMessage = '';
  console.error = (msg, err) => {
    loggedMessage = `${msg} ${err}`;
  };

  pool.query = async () => {
    throw new Error('Connection refused');
  };

  let statusCode = null;
  let responseBody = null;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      responseBody = data;
      return this;
    },
  };

  try {
    await getHealth({}, res);
    assert.equal(statusCode, 200);
    assert.equal(responseBody.success, true);
    assert.equal(responseBody.database, 'disconnected');
    assert.ok(loggedMessage.includes('Connection refused'));
  } finally {
    pool.query = originalQuery;
    console.error = originalError;
  }
});
