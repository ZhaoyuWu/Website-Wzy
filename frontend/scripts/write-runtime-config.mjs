import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_API_BASE_URL = 'http://localhost:4000';

export function readArgApiBaseUrl(argv = process.argv) {
  const match = argv.find((arg) => arg.startsWith('--api-base-url='));
  if (!match) {
    return '';
  }
  return match.slice('--api-base-url='.length).trim();
}

export function readArgSupabaseUrl(argv = process.argv) {
  const match = argv.find((arg) => arg.startsWith('--supabase-url='));
  if (!match) {
    return '';
  }
  return match.slice('--supabase-url='.length).trim();
}

export function readArgSupabaseAnonKey(argv = process.argv) {
  const match = argv.find((arg) => arg.startsWith('--supabase-anon-key='));
  if (!match) {
    return '';
  }
  return match.slice('--supabase-anon-key='.length).trim();
}

function pickApiBaseUrl(argv = process.argv, env = process.env) {
  const fromArg = readArgApiBaseUrl(argv);
  if (fromArg) {
    return fromArg;
  }

  const fromEnv = String(env.NANAMI_API_BASE_URL || env.API_BASE_URL || '').trim();
  if (fromEnv) {
    return fromEnv;
  }

  return '';
}

function normalizeBaseUrl(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

function pickSupabaseUrl(argv = process.argv, env = process.env) {
  const fromArg = readArgSupabaseUrl(argv);
  if (fromArg) {
    return fromArg;
  }

  const fromEnv = String(env.NANAMI_SUPABASE_URL || env.SUPABASE_URL || '').trim();
  return fromEnv;
}

function pickSupabaseAnonKey(argv = process.argv, env = process.env) {
  const fromArg = readArgSupabaseAnonKey(argv);
  if (fromArg) {
    return fromArg;
  }

  const fromEnv = String(env.NANAMI_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || '').trim();
  return fromEnv;
}

function ensureHttpUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function resolveApiBaseUrl({
  argv = process.argv,
  env = process.env,
  nodeEnv = process.env.NODE_ENV
} = {}) {
  const candidate = normalizeBaseUrl(pickApiBaseUrl(argv, env));
  if (candidate) {
    if (!ensureHttpUrl(candidate)) {
      throw new Error(
        `Invalid API base URL "${candidate}". Use an absolute http(s) URL like https://api.example.com.`
      );
    }
    return candidate;
  }

  if (nodeEnv === 'production') {
    throw new Error(
      'Missing API base URL for production build. Set NANAMI_API_BASE_URL (or API_BASE_URL).'
    );
  }

  return DEFAULT_API_BASE_URL;
}

export function buildRuntimeConfigContent({ apiBaseUrl, supabaseUrl = '', supabaseAnonKey = '' }) {
  const encodedApiBaseUrl = JSON.stringify(apiBaseUrl);
  const encodedSupabaseUrl = JSON.stringify(normalizeBaseUrl(supabaseUrl));
  const encodedSupabaseAnonKey = JSON.stringify(supabaseAnonKey);
  return [
    'window.__NANAMI_APP_CONFIG__ = window.__NANAMI_APP_CONFIG__ || {};',
    `window.__NANAMI_APP_CONFIG__.apiBaseUrl = ${encodedApiBaseUrl};`,
    `window.__NANAMI_APP_CONFIG__.supabaseUrl = ${encodedSupabaseUrl};`,
    `window.__NANAMI_APP_CONFIG__.supabaseAnonKey = ${encodedSupabaseAnonKey};`,
    ''
  ].join('\n');
}

export function writeRuntimeConfig(options = {}) {
  const apiBaseUrl = resolveApiBaseUrl(options);
  const cwd = options.cwd || process.cwd();
  const outputPath = path.join(cwd, 'public', 'runtime-config.js');
  const supabaseUrl = normalizeBaseUrl(pickSupabaseUrl(options.argv, options.env));
  const supabaseAnonKey = pickSupabaseAnonKey(options.argv, options.env);
  const fileContent = buildRuntimeConfigContent({ apiBaseUrl, supabaseUrl, supabaseAnonKey });
  fs.writeFileSync(outputPath, fileContent, 'utf8');
  return apiBaseUrl;
}

function isMainModule() {
  if (!process.argv[1]) {
    return false;
  }
  const currentFile = fileURLToPath(import.meta.url);
  return path.resolve(process.argv[1]) === path.resolve(currentFile);
}

if (isMainModule()) {
  try {
    const apiBaseUrl = writeRuntimeConfig();
    console.log(`runtime-config.js written with apiBaseUrl=${apiBaseUrl}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  }
}
