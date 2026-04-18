const test = require("node:test");
const assert = require("node:assert/strict");

const { hashPassword } = require("../src/password");
const { DEFAULT_SITE_SETTINGS, createApp } = require("../src/index");

function startTestServer(options = {}) {
  const dbPool = options.dbPool || { query: async () => ({ rowCount: 0, rows: [] }) };
  const app = createApp({
    dbPool,
    fetchImpl: options.fetchImpl,
  });

  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const address = server.address();
      resolve({
        baseUrl: `http://127.0.0.1:${address.port}`,
        server,
      });
    });
  });
}

async function postJson(baseUrl, path, body, headers = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  return { response, payload };
}

async function patchJson(baseUrl, path, body, headers = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  return { response, payload };
}

async function getJson(baseUrl, path, headers = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "GET",
    headers,
  });

  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  return { response, payload };
}

async function loginAndGetToken(baseUrl) {
  const { response, payload } = await postJson(baseUrl, "/api/auth/login", {
    username: "admin",
    password: "admin123456",
  });
  assert.equal(response.status, 200);
  assert.equal(typeof payload.token, "string");
  return payload.token;
}

test("public settings endpoint returns default values when no row exists", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
  process.env.SUPABASE_SETTINGS_TABLE = "site_settings";

  const fetchImpl = async (url) => {
    assert.match(String(url), /\/rest\/v1\/site_settings/);
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  const ctx = await startTestServer({ fetchImpl });
  try {
    const { response, payload } = await getJson(ctx.baseUrl, "/api/settings");
    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.source, "default");
    assert.equal(payload.settings.profileName, DEFAULT_SITE_SETTINGS.profileName);
    assert.equal(payload.settings.heroTagline, DEFAULT_SITE_SETTINGS.heroTagline);
  } finally {
    ctx.server.close();
  }
});

test("admin settings patch requires authentication", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";

  const ctx = await startTestServer({
    fetchImpl: async () =>
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
  });
  try {
    const { response } = await patchJson(ctx.baseUrl, "/api/admin/settings", {
      profileName: "Nanami",
    });
    assert.equal(response.status, 401);
  } finally {
    ctx.server.close();
  }
});

test("admin settings patch validates malformed input", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";

  const dbPool = {
    query: async () => ({
      rowCount: 1,
      rows: [{ username: "admin", password_hash: hashPassword("admin123456") }],
    }),
  };
  const ctx = await startTestServer({
    dbPool,
    fetchImpl: async () =>
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
  });

  try {
    const token = await loginAndGetToken(ctx.baseUrl);
    const { response, payload } = await patchJson(
      ctx.baseUrl,
      "/api/admin/settings",
      { contactEmail: "bad-email" },
      { Authorization: `Bearer ${token}` }
    );

    assert.equal(response.status, 400);
    assert.match(String(payload.message || ""), /valid email/i);
  } finally {
    ctx.server.close();
  }
});

test("admin settings patch persists and public settings reflect updated values", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
  process.env.SUPABASE_SETTINGS_TABLE = "site_settings";
  process.env.SUPABASE_SETTINGS_KEY_COLUMN = "setting_key";
  process.env.SUPABASE_SETTINGS_ROW_KEY = "site";

  let storedRow = null;
  const fetchImpl = async (url, init = {}) => {
    const method = String(init.method || "GET").toUpperCase();
    const urlText = String(url);

    if (urlText.includes("/rest/v1/site_settings") && method === "POST") {
      const rawBody = typeof init.body === "string" ? init.body : "[]";
      const rows = JSON.parse(rawBody);
      storedRow = {
        ...rows[0],
        updated_at: "2026-04-18T16:00:00.000Z",
      };
      return new Response(JSON.stringify([storedRow]), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (urlText.includes("/rest/v1/site_settings") && method === "GET") {
      const payload = storedRow ? [storedRow] : [];
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  const dbPool = {
    query: async () => ({
      rowCount: 1,
      rows: [{ username: "admin", password_hash: hashPassword("admin123456") }],
    }),
  };

  const ctx = await startTestServer({ dbPool, fetchImpl });
  try {
    const token = await loginAndGetToken(ctx.baseUrl);

    const { response, payload } = await patchJson(
      ctx.baseUrl,
      "/api/admin/settings",
      {
        profileName: "Nanami Star",
        heroTagline: "Golden retriever with endless joy",
        aboutText: "Nanami loves social park walks and cozy evenings.",
        contactEmail: "hello@nanami.test",
        showContactEmail: true,
      },
      { Authorization: `Bearer ${token}` }
    );

    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.settings.profileName, "Nanami Star");
    assert.equal(payload.settings.showContactEmail, true);

    const publicRes = await getJson(ctx.baseUrl, "/api/settings");
    assert.equal(publicRes.response.status, 200);
    assert.equal(publicRes.payload.ok, true);
    assert.equal(publicRes.payload.settings.profileName, "Nanami Star");
    assert.equal(publicRes.payload.settings.contactEmail, "hello@nanami.test");
  } finally {
    ctx.server.close();
  }
});
