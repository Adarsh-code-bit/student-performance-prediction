const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { buildPoolConfig } = require('../config/db.config');

test('db config: defaults to unencrypted connection when DB_SSL is omitted', () => {
  const config = buildPoolConfig({});
  assert.equal(config.ssl, undefined);
  assert.equal(config.host, 'localhost');
  assert.equal(config.port, 3306);
  assert.equal(config.database, 'smart_inventory');
});

test('db config: preserves unencrypted connection when DB_SSL is explicitly false', () => {
  const config = buildPoolConfig({ DB_SSL: 'false', DB_HOST: '127.0.0.1' });
  assert.equal(config.ssl, undefined);
  assert.equal(config.host, '127.0.0.1');
});

test('db config: enables TLS and defaults to strict certificate verification when DB_SSL is true', () => {
  const config = buildPoolConfig({
    DB_SSL: 'true',
    DB_HOST: 'mysql-test.aivencloud.com',
    DB_PORT: '24803',
  });
  assert.ok(config.ssl, 'SSL configuration should be present');
  assert.equal(config.ssl.rejectUnauthorized, true, 'Certificate verification must be enabled by default');
  assert.equal(config.ssl.ca, undefined, 'CA should be undefined if not provided');
});

test('db config: accepts inline DB_SSL_CA PEM certificate and normalizes newlines', () => {
  const pem = '-----BEGIN CERTIFICATE-----\nMIIBfakeCertData\n-----END CERTIFICATE-----';
  const config = buildPoolConfig({
    DB_SSL: 'true',
    DB_SSL_CA: pem,
  });
  assert.ok(config.ssl);
  assert.equal(config.ssl.rejectUnauthorized, true);
  assert.equal(config.ssl.ca, pem);
});

test('db config: handles escaped newlines (\\n) in DB_SSL_CA string', () => {
  const escapedPem = '-----BEGIN CERTIFICATE-----\\nMIIBfakeEscapedCert\\n-----END CERTIFICATE-----';
  const expectedPem = '-----BEGIN CERTIFICATE-----\nMIIBfakeEscapedCert\n-----END CERTIFICATE-----';
  const config = buildPoolConfig({
    DB_SSL: 'true',
    DB_SSL_CA: escapedPem,
  });
  assert.ok(config.ssl);
  assert.equal(config.ssl.ca, expectedPem);
});

test('db config: loads CA certificate from file path if DB_SSL_CA is a path', () => {
  const tempDir = os.tmpdir();
  const certPath = path.join(tempDir, `test-ca-${Date.now()}.pem`);
  const certContent = '-----BEGIN CERTIFICATE-----\nTEST_FILE_CERT\n-----END CERTIFICATE-----';
  fs.writeFileSync(certPath, certContent, 'utf8');

  try {
    const config = buildPoolConfig({
      DB_SSL: 'true',
      DB_SSL_CA: certPath,
    });
    assert.ok(config.ssl);
    assert.equal(config.ssl.rejectUnauthorized, true);
    assert.equal(config.ssl.ca, certContent);
  } finally {
    if (fs.existsSync(certPath)) fs.unlinkSync(certPath);
  }
});

test('db config: supports DB_SSL_CA_PATH environment variable', () => {
  const tempDir = os.tmpdir();
  const certPath = path.join(tempDir, `test-ca-path-${Date.now()}.pem`);
  const certContent = '-----BEGIN CERTIFICATE-----\nTEST_PATH_CERT\n-----END CERTIFICATE-----';
  fs.writeFileSync(certPath, certContent, 'utf8');

  try {
    const config = buildPoolConfig({
      DB_SSL: 'true',
      DB_SSL_CA_PATH: certPath,
    });
    assert.ok(config.ssl);
    assert.equal(config.ssl.ca, certContent);
  } finally {
    if (fs.existsSync(certPath)) fs.unlinkSync(certPath);
  }
});

test('db config: ignores empty or whitespace-only DB_SSL_CA', () => {
  const config = buildPoolConfig({
    DB_SSL: 'true',
    DB_SSL_CA: '   \n  ',
  });
  assert.ok(config.ssl);
  assert.equal(config.ssl.rejectUnauthorized, true);
  assert.equal(config.ssl.ca, undefined);
});

test('db config: honors explicit DB_SSL_REJECT_UNAUTHORIZED=false when requested', () => {
  const config = buildPoolConfig({
    DB_SSL: 'true',
    DB_SSL_REJECT_UNAUTHORIZED: 'false',
  });
  assert.ok(config.ssl);
  assert.equal(config.ssl.rejectUnauthorized, false);
});
