const test = require("node:test");
const assert = require("node:assert/strict");

const { hashPassword } = require("../src/password");
const {
  createApp,
  isValidEmail,
  isValidPassword,
  isValidUsername,
  parseBearerToken,
} = require("../src/index");

function startTestServer(options = {}) {
  const dbPool = options.dbPool || { query: async () => ({ rowCount: 0, rows: [] }) };
  const nowState = { value: options.initialNow ?? Date.now() };
  const app = createApp({
    dbPool,
    randomBytes: () => Buffer.alloc(32, 7),
    now: () => nowState.value,
    fetchImpl: options.fetchImpl,
  });

  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const address = server.address();
      const baseUrl = `http://127.0.0.1:${address.port}`;
      resolve({
        baseUrl,
        server,
        advanceNow: (deltaMs) => {
          nowState.value += deltaMs;
        },
      });
    });
  });
}

function createJsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function postJson(baseUrl, path, body, headers = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  return { response, payload };
}

test("parseBearerToken handles valid and invalid authorization headers", () => {
  assert.equal(parseBearerToken("Bearer abc123"), "abc123");
  assert.equal(parseBearerToken("bearer abc123"), null);
  assert.equal(parseBearerToken("Bearer"), null);
  assert.equal(parseBearerToken(undefined), null);
});

test("registration validators enforce username/email/password rules", () => {
  assert.equal(isValidUsername("ab"), false);
  assert.equal(isValidUsername("nanami_admin"), true);

  assert.equal(isValidEmail("not-an-email"), false);
  assert.equal(isValidEmail("nanami@example.com"), true);

  assert.equal(isValidPassword("short"), false);
  assert.equal(isValidPassword("good-length-password"), true);
});

test("login returns 400 when username/password are missing (edge case)", async () => {
  const ctx = await startTestServer();
  try {
    const { response, payload } = await postJson(ctx.baseUrl, "/api/auth/login", { username: "" });
    assert.equal(response.status, 400);
    assert.equal(payload.ok, false);
  } finally {
    ctx.server.close();
  }
});

test("register creates user and returns session token (happy path)", async () => {
  const dbPool = {
    query: async (sql, values) => {
      if (String(sql).includes("SELECT 1 FROM users WHERE username = $1 OR email = $2")) {
        return { rowCount: 0, rows: [] };
      }
      if (String(sql).includes("INSERT INTO users")) {
        return { rowCount: 1, rows: [{ username: values[0], role: "Viewer" }] };
      }
      return { rowCount: 0, rows: [] };
    },
  };

  const ctx = await startTestServer({ dbPool });
  try {
    const { response, payload } = await postJson(ctx.baseUrl, "/api/auth/register", {
      username: "nanami_user",
      email: "nanami@example.com",
      password: "very-secure-2026",
    });
    assert.equal(response.status, 201);
    assert.equal(payload.ok, true);
    assert.equal(payload.username, "nanami_user");
    assert.equal(typeof payload.token, "string");
  } finally {
    ctx.server.close();
  }
});

test("register rejects duplicate username or email", async () => {
  const dbPool = {
    query: async (sql) => {
      if (String(sql).includes("SELECT 1 FROM users WHERE username = $1 OR email = $2")) {
        return { rowCount: 1, rows: [{ "?column?": 1 }] };
      }
      return { rowCount: 0, rows: [] };
    },
  };

  const ctx = await startTestServer({ dbPool });
  try {
    const { response, payload } = await postJson(ctx.baseUrl, "/api/auth/register", {
      username: "nanami_user",
      email: "nanami@example.com",
      password: "very-secure-2026",
    });
    assert.equal(response.status, 409);
    assert.equal(payload.ok, false);
  } finally {
    ctx.server.close();
  }
});

test("login + session + admin + logout flow works and invalidates token (happy/regression)", async () => {
  const dbPool = {
    query: async (sql, values) => {
      if (String(sql).includes("FROM users") && values[0] === "admin") {
        return {
          rowCount: 1,
          rows: [{ username: "admin", password_hash: hashPassword("admin123456"), role: "Admin" }],
        };
      }
      if (String(sql).includes("SELECT NOW()")) {
        return { rowCount: 1, rows: [{ server_time: new Date().toISOString() }] };
      }
      return { rowCount: 0, rows: [] };
    },
  };

  const ctx = await startTestServer({ dbPool });
  try {
    const login = await postJson(ctx.baseUrl, "/api/auth/login", {
      username: "admin",
      password: "admin123456",
    });
    assert.equal(login.response.status, 200);
    assert.equal(login.payload.ok, true);
    assert.equal(typeof login.payload.token, "string");
    const token = login.payload.token;

    const sessionRes = await fetch(`${ctx.baseUrl}/api/auth/session`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(sessionRes.status, 200);

    const adminRes = await fetch(`${ctx.baseUrl}/api/admin/overview`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(adminRes.status, 200);

    const logoutRes = await fetch(`${ctx.baseUrl}/api/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(logoutRes.status, 200);

    const afterLogoutRes = await fetch(`${ctx.baseUrl}/api/admin/overview`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(afterLogoutRes.status, 401);
  } finally {
    ctx.server.close();
  }
});

test("login returns 401 on wrong password (edge case)", async () => {
  const dbPool = {
    query: async () => ({
      rowCount: 1,
      rows: [{ username: "admin", password_hash: hashPassword("correct-password"), role: "Admin" }],
    }),
  };
  const ctx = await startTestServer({ dbPool });
  try {
    const { response, payload } = await postJson(ctx.baseUrl, "/api/auth/login", {
      username: "admin",
      password: "wrong-password",
    });
    assert.equal(response.status, 401);
    assert.equal(payload.ok, false);
  } finally {
    ctx.server.close();
  }
});

test("session expires after ttl and becomes unauthorized (regression)", async () => {
  process.env.SESSION_TTL_MS = "50";
  const dbPool = {
    query: async () => ({
      rowCount: 1,
      rows: [{ username: "admin", password_hash: hashPassword("admin123456"), role: "Admin" }],
    }),
  };

  const ctx = await startTestServer({ dbPool, initialNow: 1_700_000_000_000 });
  try {
    const login = await postJson(ctx.baseUrl, "/api/auth/login", {
      username: "admin",
      password: "admin123456",
    });
    assert.equal(login.response.status, 200);
    const token = login.payload.token;

    ctx.advanceNow(100);

    const expiredRes = await fetch(`${ctx.baseUrl}/api/auth/session`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(expiredRes.status, 401);
  } finally {
    delete process.env.SESSION_TTL_MS;
    ctx.server.close();
  }
});

test("performance baseline: health endpoint p95 is under 250ms for local burst", async () => {
  const ctx = await startTestServer();
  try {
    const durations = [];
    for (let index = 0; index < 40; index += 1) {
      const startedAt = performance.now();
      const response = await fetch(`${ctx.baseUrl}/api/health`);
      assert.equal(response.status, 200);
      durations.push(performance.now() - startedAt);
    }

    const sorted = durations.slice().sort((a, b) => a - b);
    const p95 = sorted[Math.floor(sorted.length * 0.95) - 1];
    assert.ok(p95 < 250, `Expected p95 < 250ms, got ${p95.toFixed(2)}ms`);
  } finally {
    ctx.server.close();
  }
});

test("performance baseline: authenticated admin overview p95 is under 250ms", async () => {
  const dbPool = {
    query: async () => ({
      rowCount: 1,
      rows: [{ username: "admin", password_hash: hashPassword("admin123456"), role: "Admin" }],
    }),
  };
  const ctx = await startTestServer({ dbPool });
  try {
    const login = await postJson(ctx.baseUrl, "/api/auth/login", {
      username: "admin",
      password: "admin123456",
    });
    assert.equal(login.response.status, 200);
    const token = login.payload.token;

    const durations = [];
    for (let index = 0; index < 30; index += 1) {
      const startedAt = performance.now();
      const response = await fetch(`${ctx.baseUrl}/api/admin/overview`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      assert.equal(response.status, 200);
      durations.push(performance.now() - startedAt);
    }

    const sorted = durations.slice().sort((a, b) => a - b);
    const p95 = sorted[Math.floor(sorted.length * 0.95) - 1];
    assert.ok(p95 < 250, `Expected p95 < 250ms, got ${p95.toFixed(2)}ms`);
  } finally {
    ctx.server.close();
  }
});

test("rate limit blocks login after repeated failures and returns 429", async () => {
  process.env.LOGIN_ATTEMPT_MAX = "2";
  process.env.LOGIN_ATTEMPT_WINDOW_MS = "60000";
  process.env.LOGIN_BLOCK_MS = "60000";

  const dbPool = {
    query: async () => ({
      rowCount: 1,
      rows: [{ username: "admin", password_hash: hashPassword("correct-password"), role: "Admin" }],
    }),
  };
  const ctx = await startTestServer({ dbPool, initialNow: 2_000_000_000_000 });
  try {
    const first = await postJson(ctx.baseUrl, "/api/auth/login", {
      username: "admin",
      password: "wrong-1",
    });
    assert.equal(first.response.status, 401);

    const second = await postJson(ctx.baseUrl, "/api/auth/login", {
      username: "admin",
      password: "wrong-2",
    });
    assert.equal(second.response.status, 401);

    const blocked = await postJson(ctx.baseUrl, "/api/auth/login", {
      username: "admin",
      password: "correct-password",
    });
    assert.equal(blocked.response.status, 429);
    assert.equal(blocked.payload.ok, false);
  } finally {
    delete process.env.LOGIN_ATTEMPT_MAX;
    delete process.env.LOGIN_ATTEMPT_WINDOW_MS;
    delete process.env.LOGIN_BLOCK_MS;
    ctx.server.close();
  }
});

test("bootstrap status allows claim when there is no admin user", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";

  const fetchImpl = async (url) => {
    if (String(url).includes("/auth/v1/user")) {
      return createJsonResponse({
        id: "user-viewer-1",
        email: "viewer@example.com",
        app_metadata: { role: "Viewer" },
      });
    }
    if (String(url).includes("/auth/v1/admin/users?per_page=200")) {
      return createJsonResponse({
        users: [{ id: "user-viewer-1", email: "viewer@example.com", app_metadata: { role: "Viewer" } }],
      });
    }
    throw new Error(`Unexpected URL in bootstrap status test: ${url}`);
  };

  const ctx = await startTestServer({ fetchImpl });
  try {
    const response = await fetch(`${ctx.baseUrl}/api/admin/bootstrap/status`, {
      headers: { Authorization: "Bearer supabase-token" },
    });
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.hasAdmin, false);
    assert.equal(payload.canClaimAdmin, true);
  } finally {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    ctx.server.close();
  }
});

test("bootstrap claim promotes current user when there is no admin", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";

  const fetchImpl = async (url, init = {}) => {
    if (String(url).includes("/auth/v1/user")) {
      return createJsonResponse({
        id: "user-viewer-2",
        email: "viewer2@example.com",
        app_metadata: { role: "Viewer" },
      });
    }
    if (String(url).includes("/auth/v1/admin/users?per_page=200")) {
      return createJsonResponse({
        users: [{ id: "user-viewer-2", email: "viewer2@example.com", app_metadata: { role: "Viewer" } }],
      });
    }
    if (String(url).includes("/auth/v1/admin/users/user-viewer-2")) {
      assert.equal(init.method, "PUT");
      return createJsonResponse({
        id: "user-viewer-2",
        email: "viewer2@example.com",
        app_metadata: { role: "Admin" },
      });
    }
    throw new Error(`Unexpected URL in bootstrap claim test: ${url}`);
  };

  const ctx = await startTestServer({ fetchImpl });
  try {
    const response = await fetch(`${ctx.baseUrl}/api/admin/bootstrap/claim`, {
      method: "POST",
      headers: { Authorization: "Bearer supabase-token" },
    });
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.user.role, "Admin");
  } finally {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    ctx.server.close();
  }
});

test("bootstrap claim is rejected when an admin already exists", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";

  const fetchImpl = async (url) => {
    if (String(url).includes("/auth/v1/user")) {
      return createJsonResponse({
        id: "user-viewer-3",
        email: "viewer3@example.com",
        app_metadata: { role: "Viewer" },
      });
    }
    if (String(url).includes("/auth/v1/admin/users?per_page=200")) {
      return createJsonResponse({
        users: [{ id: "user-admin-1", email: "admin@example.com", app_metadata: { role: "Admin" } }],
      });
    }
    throw new Error(`Unexpected URL in bootstrap reject test: ${url}`);
  };

  const ctx = await startTestServer({ fetchImpl });
  try {
    const response = await fetch(`${ctx.baseUrl}/api/admin/bootstrap/claim`, {
      method: "POST",
      headers: { Authorization: "Bearer supabase-token" },
    });
    const payload = await response.json();
    assert.equal(response.status, 409);
    assert.equal(payload.ok, false);
  } finally {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    ctx.server.close();
  }
});

test("viewer role is forbidden from admin-restricted endpoints", async () => {
  const dbPool = {
    query: async () => ({
      rowCount: 1,
      rows: [{ username: "viewer", password_hash: hashPassword("viewer-pass-123"), role: "Viewer" }],
    }),
  };

  const ctx = await startTestServer({ dbPool });
  try {
    const login = await postJson(ctx.baseUrl, "/api/auth/login", {
      username: "viewer",
      password: "viewer-pass-123",
    });
    assert.equal(login.response.status, 200);
    assert.equal(login.payload.role, "Viewer");
    const token = login.payload.token;

    const settingsRes = await fetch(`${ctx.baseUrl}/api/admin/settings`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(settingsRes.status, 403);

    const usersRes = await fetch(`${ctx.baseUrl}/api/admin/users`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(usersRes.status, 403);
  } finally {
    ctx.server.close();
  }
});

test("admin role passes role-gate for admin settings path", async () => {
  const dbPool = {
    query: async () => ({
      rowCount: 1,
      rows: [{ username: "admin", password_hash: hashPassword("admin123456"), role: "Admin" }],
    }),
  };

  const ctx = await startTestServer({ dbPool });
  try {
    const login = await postJson(ctx.baseUrl, "/api/auth/login", {
      username: "admin",
      password: "admin123456",
    });
    assert.equal(login.response.status, 200);
    assert.equal(login.payload.role, "Admin");
    const token = login.payload.token;

    const settingsRes = await fetch(`${ctx.baseUrl}/api/admin/settings`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.notEqual(settingsRes.status, 403);
  } finally {
    ctx.server.close();
  }
});
