import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveApiBaseUrl, writeRuntimeConfig } from './write-runtime-config.mjs';

function runCase(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runCase('uses dev fallback in non-production when env and arg are absent', () => {
  const apiBaseUrl = resolveApiBaseUrl({
    argv: ['node', 'write-runtime-config.mjs'],
    env: { NANAMI_API_BASE_URL: '', API_BASE_URL: '' },
    nodeEnv: 'development'
  });
  assert.equal(apiBaseUrl, 'http://localhost:4000');
});

runCase('prefers explicit arg and trims trailing slashes', () => {
  const apiBaseUrl = resolveApiBaseUrl({
    argv: ['node', 'write-runtime-config.mjs', '--api-base-url=https://api.nanami.test///'],
    env: { NANAMI_API_BASE_URL: 'https://ignored.example.com' },
    nodeEnv: 'development'
  });
  assert.equal(apiBaseUrl, 'https://api.nanami.test');
});

runCase('fails in production when api base url is missing', () => {
  assert.throws(
    () =>
      resolveApiBaseUrl({
        argv: ['node', 'write-runtime-config.mjs'],
        env: { NANAMI_API_BASE_URL: '', API_BASE_URL: '' },
        nodeEnv: 'production'
      }),
    /Missing API base URL for production build/
  );
});

runCase('rejects non-http api base url values', () => {
  assert.throws(
    () =>
      resolveApiBaseUrl({
        argv: ['node', 'write-runtime-config.mjs'],
        env: { NANAMI_API_BASE_URL: "javascript:alert('xss')" },
        nodeEnv: 'development'
      }),
    /Invalid API base URL/
  );
});

runCase('writes escaped runtime-config content to public folder', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nanami-runtime-config-'));
  const publicDir = path.join(tempDir, 'public');
  const outputPath = path.join(publicDir, 'runtime-config.js');
  fs.mkdirSync(publicDir, { recursive: true });

  try {
    const apiBaseUrl = writeRuntimeConfig({
      cwd: tempDir,
      argv: ['node', 'write-runtime-config.mjs'],
      env: { NANAMI_API_BASE_URL: 'https://api.nanami.test?a=1&b=2' },
      nodeEnv: 'development'
    });
    const content = fs.readFileSync(outputPath, 'utf8');

    assert.equal(apiBaseUrl, 'https://api.nanami.test?a=1&b=2');
    assert.match(content, /window\.__NANAMI_APP_CONFIG__\.apiBaseUrl = "https:\/\/api\.nanami\.test\?a=1&b=2";/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
