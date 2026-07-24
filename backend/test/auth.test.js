const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createApp,
  isValidEmail,
  isValidUsername,
  parseBearerToken,
} = require("../src/index");

function startTestServer(options = {}) {
  const nowState = { value: options.initialNow ?? Date.now() };
  const app = createApp({
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

function withSupabaseEnv(run) {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
  return run().finally(() => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });
}

function supabaseUserFetch(userId, role, fallback) {
  return async (url, init = {}) => {
    const urlText = String(url);
    if (urlText.includes("/auth/v1/user")) {
      return createJsonResponse({ id: userId, email: `${userId}@example.com`, app_metadata: {} });
    }
    if (urlText.includes(`/rest/v1/profiles?id=eq.${userId}`)) {
      return createJsonResponse([{ id: userId, role }]);
    }
    if (typeof fallback === "function") {
      return fallback(url, init);
    }
    return createJsonResponse([]);
  };
}

test("parseBearerToken handles valid and invalid authorization headers", () => {
  assert.equal(parseBearerToken("Bearer abc123"), "abc123");
  assert.equal(parseBearerToken("bearer abc123"), null);
  assert.equal(parseBearerToken("Bearer"), null);
  assert.equal(parseBearerToken(undefined), null);
});

test("profile validators enforce username/email rules", () => {
  assert.equal(isValidUsername("ab"), false);
  assert.equal(isValidUsername("nanami_admin"), true);

  assert.equal(isValidEmail("not-an-email"), false);
  assert.equal(isValidEmail("nanami@example.com"), true);
});

test("protected endpoint rejects request without token", async () => {
  await withSupabaseEnv(async () => {
    const ctx = await startTestServer();
    try {
      const response = await fetch(`${ctx.baseUrl}/api/admin/overview`);
      assert.equal(response.status, 401);
    } finally {
      ctx.server.close();
    }
  });
});

test("protected endpoint rejects invalid Supabase token", async () => {
  await withSupabaseEnv(async () => {
    const fetchImpl = async (url) => {
      if (String(url).includes("/auth/v1/user")) {
        return createJsonResponse({ message: "invalid token" }, 401);
      }
      return createJsonResponse([]);
    };
    const ctx = await startTestServer({ fetchImpl });
    try {
      const response = await fetch(`${ctx.baseUrl}/api/admin/overview`, {
        headers: { Authorization: "Bearer bad-token" },
      });
      assert.equal(response.status, 401);
    } finally {
      ctx.server.close();
    }
  });
});

test("viewer role is forbidden from admin-restricted endpoints", async () => {
  await withSupabaseEnv(async () => {
    const ctx = await startTestServer({ fetchImpl: supabaseUserFetch("user-viewer-9", "Viewer") });
    try {
      const settingsRes = await fetch(`${ctx.baseUrl}/api/admin/settings`, {
        headers: { Authorization: "Bearer supabase-token" },
      });
      assert.equal(settingsRes.status, 403);

      const usersRes = await fetch(`${ctx.baseUrl}/api/admin/users`, {
        headers: { Authorization: "Bearer supabase-token" },
      });
      assert.equal(usersRes.status, 403);
    } finally {
      ctx.server.close();
    }
  });
});

test("admin role passes role-gate for admin settings path", async () => {
  await withSupabaseEnv(async () => {
    const ctx = await startTestServer({ fetchImpl: supabaseUserFetch("user-admin-9", "Admin") });
    try {
      const settingsRes = await fetch(`${ctx.baseUrl}/api/admin/settings`, {
        headers: { Authorization: "Bearer supabase-token" },
      });
      assert.notEqual(settingsRes.status, 403);
      assert.notEqual(settingsRes.status, 401);
    } finally {
      ctx.server.close();
    }
  });
});

test("comment throttle enforces per-IP cooldown and window ceiling with Retry-After", async () => {
  process.env.COMMENT_COOLDOWN_MS = "5000";
  process.env.COMMENT_WINDOW_MS = "60000";
  process.env.COMMENT_MAX_PER_WINDOW = "2";

  await withSupabaseEnv(async () => {
    const fetchImpl = async (url, init = {}) => {
      if (String(url).includes("/rest/v1/showcase_comments") && init.method === "POST") {
        return createJsonResponse(
          [{ id: 1, author_name: "Fan", message: "Cute!", created_at: "2026-07-24T10:00:00Z" }],
          201
        );
      }
      return createJsonResponse([]);
    };
    const ctx = await startTestServer({ fetchImpl, initialNow: 3_000_000_000_000 });
    const commentBody = { authorName: "Fan", message: "Cute!" };
    try {
      const first = await postJson(ctx.baseUrl, "/api/showcase/comments", commentBody);
      assert.equal(first.response.status, 201);

      const duringCooldown = await postJson(ctx.baseUrl, "/api/showcase/comments", commentBody);
      assert.equal(duringCooldown.response.status, 429);
      assert.ok(Number(duringCooldown.response.headers.get("retry-after")) >= 1);

      ctx.advanceNow(5001);
      const second = await postJson(ctx.baseUrl, "/api/showcase/comments", commentBody);
      assert.equal(second.response.status, 201);

      ctx.advanceNow(5001);
      const overWindowCap = await postJson(ctx.baseUrl, "/api/showcase/comments", commentBody);
      assert.equal(overWindowCap.response.status, 429);

      ctx.advanceNow(60001);
      const afterWindowReset = await postJson(ctx.baseUrl, "/api/showcase/comments", commentBody);
      assert.equal(afterWindowReset.response.status, 201);
    } finally {
      delete process.env.COMMENT_COOLDOWN_MS;
      delete process.env.COMMENT_WINDOW_MS;
      delete process.env.COMMENT_MAX_PER_WINDOW;
      ctx.server.close();
    }
  });
});

test("invalid comment payload is rejected before consuming throttle quota", async () => {
  process.env.COMMENT_COOLDOWN_MS = "5000";

  await withSupabaseEnv(async () => {
    const fetchImpl = async (url, init = {}) => {
      if (String(url).includes("/rest/v1/showcase_comments") && init.method === "POST") {
        return createJsonResponse(
          [{ id: 1, author_name: "Fan", message: "Cute!", created_at: "2026-07-24T10:00:00Z" }],
          201
        );
      }
      return createJsonResponse([]);
    };
    const ctx = await startTestServer({ fetchImpl, initialNow: 3_100_000_000_000 });
    try {
      const invalid = await postJson(ctx.baseUrl, "/api/showcase/comments", {
        authorName: "",
        message: "hello",
      });
      assert.equal(invalid.response.status, 400);

      const valid = await postJson(ctx.baseUrl, "/api/showcase/comments", {
        authorName: "Fan",
        message: "Cute!",
      });
      assert.equal(valid.response.status, 201);
    } finally {
      delete process.env.COMMENT_COOLDOWN_MS;
      ctx.server.close();
    }
  });
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
  await withSupabaseEnv(async () => {
    const ctx = await startTestServer({ fetchImpl: supabaseUserFetch("user-admin-9", "Admin") });
    try {
      const durations = [];
      for (let index = 0; index < 30; index += 1) {
        const startedAt = performance.now();
        const response = await fetch(`${ctx.baseUrl}/api/admin/overview`, {
          headers: { Authorization: "Bearer supabase-token" },
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
});

test("bootstrap status allows claim when there is no admin user", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";

  const fetchImpl = async (url) => {
    if (String(url).includes("/auth/v1/user")) {
      return createJsonResponse({
        id: "user-viewer-1",
        email: "viewer@example.com",
        app_metadata: {},
      });
    }
    if (String(url).includes("/rest/v1/profiles?id=eq.user-viewer-1")) {
      return createJsonResponse([{ id: "user-viewer-1", role: "Viewer" }]);
    }
    if (String(url).includes("/auth/v1/admin/users?per_page=200")) {
      return createJsonResponse({
        users: [{ id: "user-viewer-1", email: "viewer@example.com", app_metadata: {} }],
      });
    }
    if (String(url).includes("/rest/v1/profiles?id=in.")) {
      return createJsonResponse([{ id: "user-viewer-1", role: "Viewer" }]);
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
  const profileRoles = new Map([["user-viewer-2", "Viewer"]]);

  const fetchImpl = async (url, init = {}) => {
    if (String(url).includes("/auth/v1/user")) {
      return createJsonResponse({
        id: "user-viewer-2",
        email: "viewer2@example.com",
        app_metadata: {},
      });
    }
    if (String(url).includes("/rest/v1/profiles?id=eq.user-viewer-2")) {
      return createJsonResponse([{ id: "user-viewer-2", role: profileRoles.get("user-viewer-2") }]);
    }
    if (String(url).includes("/auth/v1/admin/users?per_page=200")) {
      return createJsonResponse({
        users: [{ id: "user-viewer-2", email: "viewer2@example.com", app_metadata: {} }],
      });
    }
    if (String(url).includes("/rest/v1/profiles?id=in.")) {
      return createJsonResponse([{ id: "user-viewer-2", role: profileRoles.get("user-viewer-2") }]);
    }
    if (String(url).includes("/rest/v1/profiles?on_conflict=id")) {
      assert.equal(init.method, "POST");
      const body = JSON.parse(String(init.body || "[]"));
      assert.equal(body[0].id, "user-viewer-2");
      assert.equal(body[0].role, "Admin");
      profileRoles.set("user-viewer-2", "Admin");
      return createJsonResponse([{ id: "user-viewer-2", role: "Admin" }], 201);
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

    const afterClaim = await fetch(`${ctx.baseUrl}/api/admin/overview`, {
      headers: { Authorization: "Bearer supabase-token" },
    });
    const afterClaimPayload = await afterClaim.json();
    assert.equal(afterClaim.status, 200);
    assert.equal(afterClaimPayload.role, "Admin");
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
        app_metadata: {},
      });
    }
    if (String(url).includes("/auth/v1/admin/users?per_page=200")) {
      return createJsonResponse({
        users: [{ id: "user-admin-1", email: "admin@example.com", app_metadata: {} }],
      });
    }
    if (String(url).includes("/rest/v1/profiles?id=eq.user-viewer-3")) {
      return createJsonResponse([{ id: "user-viewer-3", role: "Viewer" }]);
    }
    if (String(url).includes("/rest/v1/profiles?id=in.")) {
      return createJsonResponse([{ id: "user-admin-1", role: "Admin" }]);
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

test("admin role update writes profiles role and response reflects updated role", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
  const profileRoles = new Map([
    ["admin-1", "Admin"],
    ["user-pub-1", "Viewer"],
  ]);

  const fetchImpl = async (url, init = {}) => {
    const asText = String(url);
    if (asText.includes("/auth/v1/user")) {
      return createJsonResponse({ id: "admin-1", email: "admin@example.com", app_metadata: {} });
    }
    if (asText.includes("/rest/v1/profiles?id=eq.admin-1")) {
      return createJsonResponse([{ id: "admin-1", role: profileRoles.get("admin-1") }]);
    }
    if (asText.includes("/rest/v1/profiles?on_conflict=id")) {
      assert.equal(init.method, "POST");
      const body = JSON.parse(String(init.body || "[]"));
      profileRoles.set(body[0].id, body[0].role);
      return createJsonResponse([{ id: body[0].id, role: body[0].role }], 201);
    }
    if (asText.includes("/auth/v1/admin/users?per_page=200")) {
      return createJsonResponse({
        users: [
          { id: "admin-1", email: "admin@example.com", app_metadata: {} },
          { id: "user-pub-1", email: "publisher@example.com", app_metadata: {} },
        ],
      });
    }
    if (asText.includes("/rest/v1/profiles?id=in.")) {
      return createJsonResponse([
        { id: "admin-1", role: profileRoles.get("admin-1") },
        { id: "user-pub-1", role: profileRoles.get("user-pub-1") },
      ]);
    }
    throw new Error(`Unexpected URL in role update test: ${url}`);
  };

  const ctx = await startTestServer({ fetchImpl });
  try {
    const response = await fetch(`${ctx.baseUrl}/api/admin/users/user-pub-1/role`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer supabase-token",
      },
      body: JSON.stringify({ role: "Publisher" }),
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.user.id, "user-pub-1");
    assert.equal(payload.user.role, "Publisher");
    assert.equal(profileRoles.get("user-pub-1"), "Publisher");
  } finally {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    ctx.server.close();
  }
});
