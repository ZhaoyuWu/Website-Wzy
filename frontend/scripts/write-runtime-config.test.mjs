import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveApiBaseUrl, resolveSupabaseConfig, writeRuntimeConfig } from './write-runtime-config.mjs';

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

runCase('parses quoted supabase args from npm/powershell tokenization', () => {
  const apiBaseUrl = resolveApiBaseUrl({
    argv: ['node', 'write-runtime-config.mjs', '"--api-base-url=https://api.nanami.test///"'],
    env: {},
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

runCase('uses development supabase fallback when config is missing', () => {
  const config = resolveSupabaseConfig({
    argv: ['node', 'write-runtime-config.mjs'],
    env: { NANAMI_SUPABASE_URL: '', NANAMI_SUPABASE_ANON_KEY: '' },
    nodeEnv: 'development'
  });
  assert.equal(config.supabaseUrl, 'https://pltveorkgsxfccyuwidk.supabase.co');
  assert.equal(config.supabaseAnonKey, 'sb_publishable_ESrIEMrD1MFDAe_0rJ93Hw_2UNRaxJS');
});

runCase('fails in production when supabase config is missing', () => {
  assert.throws(
    () =>
      resolveSupabaseConfig({
        argv: ['node', 'write-runtime-config.mjs'],
        env: { NANAMI_SUPABASE_URL: '', NANAMI_SUPABASE_ANON_KEY: '' },
        nodeEnv: 'production'
      }),
    /Missing Supabase config for production build/
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
      argv: ['node', 'write-runtime-config.mjs', '--supabase-url=https://demo.supabase.co/'],
      env: {
        NANAMI_API_BASE_URL: 'https://api.nanami.test?a=1&b=2',
        SUPABASE_ANON_KEY: 'demo-anon-key'
      },
      nodeEnv: 'development'
    });
    const content = fs.readFileSync(outputPath, 'utf8');

    assert.equal(apiBaseUrl, 'https://api.nanami.test?a=1&b=2');
    assert.match(content, /window\.__NANAMI_APP_CONFIG__\.apiBaseUrl = "https:\/\/api\.nanami\.test\?a=1&b=2";/);
    assert.match(content, /window\.__NANAMI_APP_CONFIG__\.supabaseUrl = "https:\/\/demo\.supabase\.co";/);
    assert.match(content, /window\.__NANAMI_APP_CONFIG__\.supabaseAnonKey = "demo-anon-key";/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

runCase('writes supabase values when args are wrapped in quotes', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nanami-runtime-config-quoted-'));
  const publicDir = path.join(tempDir, 'public');
  const outputPath = path.join(publicDir, 'runtime-config.js');
  fs.mkdirSync(publicDir, { recursive: true });

  try {
    writeRuntimeConfig({
      cwd: tempDir,
      argv: [
        'node',
        'write-runtime-config.mjs',
        '"--api-base-url=http://localhost:4000"',
        '"--supabase-url=https://demo.supabase.co/"',
        '"--supabase-anon-key=quoted-anon-key"'
      ],
      env: {},
      nodeEnv: 'development'
    });
    const content = fs.readFileSync(outputPath, 'utf8');
    assert.match(content, /window\.__NANAMI_APP_CONFIG__\.supabaseUrl = "https:\/\/demo\.supabase\.co";/);
    assert.match(content, /window\.__NANAMI_APP_CONFIG__\.supabaseAnonKey = "quoted-anon-key";/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
