const test = require("node:test");
const assert = require("node:assert/strict");

const { hashPassword } = require("../src/password");
const {
  MAX_IMAGE_SIZE_BYTES,
  MAX_VIDEO_SIZE_BYTES,
  createApp,
  inferMediaType,
  isValidMediaDescription,
  isValidMediaTitle,
  parseBase64Payload,
  sanitizeObjectName,
} = require("../src/index");

function startTestServer(options = {}) {
  const dbPool = options.dbPool || { query: async () => ({ rowCount: 0, rows: [] }) };
  const app = createApp({
    dbPool,
    randomBytes: () => Buffer.alloc(32, 9),
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

async function loginAndGetToken(baseUrl) {
  const { response, payload } = await postJson(baseUrl, "/api/auth/login", {
    username: "admin",
    password: "admin123456",
  });
  assert.equal(response.status, 200);
  assert.equal(typeof payload.token, "string");
  return payload.token;
}

test("media helper validation behaves as expected", () => {
  assert.equal(inferMediaType("image/jpeg"), "image");
  assert.equal(inferMediaType("video/mp4"), "video");
  assert.equal(inferMediaType("application/pdf"), null);

  assert.equal(isValidMediaTitle("   "), false);
  assert.equal(isValidMediaTitle("Nanami at the park"), true);
  assert.equal(isValidMediaTitle("Bad\u0007Title"), false);
  assert.equal(isValidMediaDescription("x".repeat(500)), true);
  assert.equal(isValidMediaDescription("x".repeat(501)), false);
  assert.equal(isValidMediaDescription("good\u0000bad"), false);

  assert.equal(parseBase64Payload("bad!@#"), null);
  assert.equal(parseBase64Payload(Buffer.from("hello").toString("base64")).toString("utf8"), "hello");
  assert.equal(sanitizeObjectName("A Cute Photo!!.JPG"), "a-cute-photo-.jpg");

  assert.equal(MAX_IMAGE_SIZE_BYTES, 10 * 1024 * 1024);
  assert.equal(MAX_VIDEO_SIZE_BYTES, 50 * 1024 * 1024);
});

test("upload endpoint requires authentication", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";

  const ctx = await startTestServer();
  try {
    const { response } = await postJson(ctx.baseUrl, "/api/admin/media", {
      title: "No auth",
      description: "should fail",
      fileName: "photo.jpg",
      fileType: "image/jpeg",
      fileSize: 3,
      fileBase64: Buffer.from("abc").toString("base64"),
    });

    assert.equal(response.status, 401);
  } finally {
    ctx.server.close();
  }
});

test("upload endpoint rejects unsupported file type with readable message", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";

  const dbPool = {
    query: async () => ({
      rowCount: 1,
      rows: [{ username: "admin", password_hash: hashPassword("admin123456"), role: "Admin" }],
    }),
  };

  const ctx = await startTestServer({ dbPool, fetchImpl: async () => new Response("[]", { status: 200 }) });
  try {
    const token = await loginAndGetToken(ctx.baseUrl);

    const { response, payload } = await postJson(
      ctx.baseUrl,
      "/api/admin/media",
      {
        title: "Bad file",
        description: "invalid type",
        displayDate: "2026-04-19",
        fileName: "doc.pdf",
        fileType: "application/pdf",
        fileSize: 10,
        fileBase64: Buffer.from("abc").toString("base64"),
      },
      { Authorization: `Bearer ${token}` }
    );

    assert.equal(response.status, 400);
    assert.match(String(payload.message || ""), /Unsupported file type/i);
  } finally {
    ctx.server.close();
  }
});

test("upload endpoint rejects inconsistent payload size", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";

  const dbPool = {
    query: async () => ({
      rowCount: 1,
      rows: [{ username: "admin", password_hash: hashPassword("admin123456"), role: "Admin" }],
    }),
  };

  const ctx = await startTestServer({ dbPool, fetchImpl: async () => new Response("[]", { status: 200 }) });
  try {
    const token = await loginAndGetToken(ctx.baseUrl);
    const raw = Buffer.from("1234567890");

    const { response, payload } = await postJson(
      ctx.baseUrl,
      "/api/admin/media",
      {
        title: "Nanami payload mismatch",
        description: "bad payload",
        displayDate: "2026-04-19",
        fileName: "nanami.jpg",
        fileType: "image/jpeg",
        fileSize: raw.length + 100,
        fileBase64: raw.toString("base64"),
      },
      { Authorization: `Bearer ${token}` }
    );

    assert.equal(response.status, 400);
    assert.match(String(payload.message || ""), /payload is inconsistent/i);
  } finally {
    ctx.server.close();
  }
});

test("upload endpoint rejects oversize image with readable message", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";

  const dbPool = {
    query: async () => ({
      rowCount: 1,
      rows: [{ username: "admin", password_hash: hashPassword("admin123456"), role: "Admin" }],
    }),
  };

  const ctx = await startTestServer({ dbPool, fetchImpl: async () => new Response("[]", { status: 200 }) });
  try {
    const token = await loginAndGetToken(ctx.baseUrl);
    const raw = Buffer.alloc(MAX_IMAGE_SIZE_BYTES + 1, 1);

    const { response, payload } = await postJson(
      ctx.baseUrl,
      "/api/admin/media",
      {
        title: "Too large image",
        description: "should fail",
        displayDate: "2026-04-19",
        fileName: "large.jpg",
        fileType: "image/jpeg",
        fileSize: raw.length,
        fileBase64: raw.toString("base64"),
      },
      { Authorization: `Bearer ${token}` }
    );

    assert.equal(response.status, 400);
    assert.match(String(payload.message || ""), /image file exceeds 10MB limit/i);
  } finally {
    ctx.server.close();
  }
});

test("upload endpoint stores media in Supabase and writes metadata", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
  process.env.SUPABASE_STORAGE_BUCKET = "media";
  process.env.SUPABASE_MEDIA_TABLE = "media_items";

  const dbPool = {
    query: async () => ({
      rowCount: 1,
      rows: [{ username: "admin", password_hash: hashPassword("admin123456"), role: "Admin" }],
    }),
  };

  const fetchCalls = [];
  const fetchImpl = async (url, init = {}) => {
    fetchCalls.push({ url: String(url), method: String(init.method || "GET") });

    if (String(url).includes("/storage/v1/object/")) {
      return new Response(JSON.stringify({ Key: "ok" }), { status: 200 });
    }

    if (String(url).includes("/rest/v1/media_items") && String(init.method) === "POST") {
      return new Response(
        JSON.stringify([
          {
            id: 55,
            title: "Nanami Running",
            description: "At the field",
            media_type: "image",
            public_url: "https://example.supabase.co/storage/v1/object/public/media/uploads/f.jpg",
          },
        ]),
        { status: 201, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  const ctx = await startTestServer({ dbPool, fetchImpl });
  try {
    const token = await loginAndGetToken(ctx.baseUrl);
    const buffer = Buffer.from("fake image");

    const { response, payload } = await postJson(
      ctx.baseUrl,
      "/api/admin/media",
      {
        title: "Nanami Running",
        description: "At the field",
        displayDate: "2026-04-19",
        fileName: "nanami.jpg",
        fileType: "image/jpeg",
        fileSize: buffer.length,
        fileBase64: buffer.toString("base64"),
      },
      { Authorization: `Bearer ${token}` }
    );

    assert.equal(response.status, 201);
    assert.equal(payload.ok, true);
    assert.equal(payload.item.title, "Nanami Running");
    assert.ok(fetchCalls.some((entry) => entry.url.includes("/storage/v1/object/")));
    assert.ok(fetchCalls.some((entry) => entry.url.includes("/rest/v1/media_items") && entry.method === "POST"));
  } finally {
    ctx.server.close();
  }
});

test("metadata patch endpoint updates title/description through Supabase", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
  process.env.SUPABASE_MEDIA_TABLE = "media_items";

  const dbPool = {
    query: async () => ({
      rowCount: 1,
      rows: [{ username: "admin", password_hash: hashPassword("admin123456"), role: "Admin" }],
    }),
  };

  const fetchImpl = async (url, init = {}) => {
    if (String(url).includes("/rest/v1/media_items") && String(init.method) === "PATCH") {
      return new Response(
        JSON.stringify([
          {
            id: 9,
            title: "Updated",
            description: "Updated desc",
            media_type: "image",
            public_url: "https://example.test/a.jpg",
          },
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  const ctx = await startTestServer({ dbPool, fetchImpl });
  try {
    const token = await loginAndGetToken(ctx.baseUrl);

    const { response, payload } = await patchJson(
      ctx.baseUrl,
      "/api/admin/media/9",
      {
        title: "Updated",
        description: "Updated desc",
      },
      { Authorization: `Bearer ${token}` }
    );

    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.item.id, 9);
  } finally {
    ctx.server.close();
  }
});

test("metadata patch endpoint rejects control characters in title", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
  process.env.SUPABASE_MEDIA_TABLE = "media_items";

  const dbPool = {
    query: async () => ({
      rowCount: 1,
      rows: [{ username: "admin", password_hash: hashPassword("admin123456"), role: "Admin" }],
    }),
  };

  const ctx = await startTestServer({ dbPool, fetchImpl: async () => new Response("[]", { status: 200 }) });
  try {
    const token = await loginAndGetToken(ctx.baseUrl);

    const { response, payload } = await patchJson(
      ctx.baseUrl,
      "/api/admin/media/9",
      {
        title: "Bad\u0007Title",
      },
      { Authorization: `Bearer ${token}` }
    );

    assert.equal(response.status, 400);
    assert.match(String(payload.message || ""), /Title is required/i);
  } finally {
    ctx.server.close();
  }
});

test("public story timeline endpoint merges media and text entries newest-first", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
  process.env.SUPABASE_MEDIA_TABLE = "media_items";

  const fetchImpl = async (url) => {
    const urlText = String(url);
    if (urlText.includes("/rest/v1/media_items")) {
      return new Response(
        JSON.stringify([
          {
            id: 1,
            title: "Older Image",
            description: "Sunrise",
            media_type: "image",
            public_url: "https://example.supabase.co/storage/v1/object/public/media/a.jpg",
            likes_count: 2,
            created_at: "2026-04-01T10:00:00Z",
          },
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    if (urlText.includes("/rest/v1/story_posts")) {
      return new Response(
        JSON.stringify([
          {
            id: 10,
            title: "Newest Text",
            body: "Hello world",
            likes_count: 4,
            created_at: "2026-04-19T11:00:00Z",
          },
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  const ctx = await startTestServer({ fetchImpl });
  try {
    const response = await fetch(`${ctx.baseUrl}/api/story/timeline?page=1`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.items.length, 2);
    assert.equal(payload.items[0].type, "text");
    assert.equal(payload.items[0].title, "Newest Text");
    assert.equal(payload.items[1].type, "image");
    assert.equal(payload.items[1].title, "Older Image");
    assert.equal(payload.pageSize, 20);
    assert.equal(payload.page, 1);
    assert.equal(payload.totalPages, 1);
  } finally {
    ctx.server.close();
  }
});

test("story like endpoint routes media and text to their RPCs and returns new count", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";

  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    const urlText = String(url);
    calls.push({ url: urlText, method: init.method || "GET" });
    if (urlText.endsWith("/rest/v1/rpc/increment_media_likes")) {
      return new Response("6", { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (urlText.endsWith("/rest/v1/rpc/decrement_story_post_likes")) {
      return new Response("3", { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return new Response("null", { status: 200, headers: { "Content-Type": "application/json" } });
  };

  const ctx = await startTestServer({ fetchImpl });
  try {
    const up = await fetch(`${ctx.baseUrl}/api/story/media/1/like`, { method: "POST" });
    const upPayload = await up.json();
    assert.equal(up.status, 200);
    assert.equal(upPayload.likesCount, 6);
    assert.equal(upPayload.type, "media");

    const down = await fetch(`${ctx.baseUrl}/api/story/text/10/like`, { method: "DELETE" });
    const downPayload = await down.json();
    assert.equal(down.status, 200);
    assert.equal(downPayload.likesCount, 3);
    assert.equal(downPayload.type, "text");

    assert.ok(calls.some((c) => c.url.endsWith("increment_media_likes") && c.method === "POST"));
    assert.ok(calls.some((c) => c.url.endsWith("decrement_story_post_likes") && c.method === "POST"));
  } finally {
    ctx.server.close();
  }
});

test("story like endpoint rejects unsupported entry types", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";

  const ctx = await startTestServer({ fetchImpl: async () => new Response("null") });
  try {
    const response = await fetch(`${ctx.baseUrl}/api/story/xml/1/like`, { method: "POST" });
    assert.equal(response.status, 400);
  } finally {
    ctx.server.close();
  }
});

test("story like endpoint throttles rapid repeats on the same entry", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";

  const fetchImpl = async () =>
    new Response("1", { status: 200, headers: { "Content-Type": "application/json" } });

  const ctx = await startTestServer({ fetchImpl });
  try {
    const first = await fetch(`${ctx.baseUrl}/api/story/media/42/like`, { method: "POST" });
    assert.equal(first.status, 200);

    const second = await fetch(`${ctx.baseUrl}/api/story/media/42/like`, { method: "POST" });
    assert.equal(second.status, 429);
    assert.ok(second.headers.get("Retry-After"));
  } finally {
    ctx.server.close();
  }
});

test("story like endpoint enforces per-IP burst ceiling across entries", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
  process.env.LIKE_MAX_PER_WINDOW = "3";
  process.env.LIKE_COOLDOWN_MS = "0";

  const fetchImpl = async () =>
    new Response("1", { status: 200, headers: { "Content-Type": "application/json" } });

  const ctx = await startTestServer({ fetchImpl });
  try {
    for (let id = 1; id <= 3; id += 1) {
      const ok = await fetch(`${ctx.baseUrl}/api/story/media/${id}/like`, { method: "POST" });
      assert.equal(ok.status, 200, `request ${id} should succeed`);
    }
    const blocked = await fetch(`${ctx.baseUrl}/api/story/media/4/like`, { method: "POST" });
    assert.equal(blocked.status, 429);
  } finally {
    ctx.server.close();
    delete process.env.LIKE_MAX_PER_WINDOW;
    delete process.env.LIKE_COOLDOWN_MS;
  }
});

test("admin story-posts create persists to Supabase with author_id", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";

  let insertBody = null;
  const fetchImpl = async (url, init = {}) => {
    const urlText = String(url);
    if (urlText.includes("/rest/v1/story_posts") && init.method === "POST") {
      insertBody = init.body;
      return new Response(
        JSON.stringify([
          { id: 11, title: "New", body: "Body here", likes_count: 0 },
        ]),
        { status: 201, headers: { "Content-Type": "application/json" } }
      );
    }
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  const dbPool = {
    query: async () => ({
      rowCount: 1,
      rows: [{ username: "admin", password_hash: hashPassword("admin123456"), role: "Admin" }],
    }),
  };

  const ctx = await startTestServer({ fetchImpl, dbPool });
  try {
    const token = await loginAndGetToken(ctx.baseUrl);
    const response = await postJson(
      ctx.baseUrl,
      "/api/admin/story-posts",
      { title: "New", body: "Body here", displayDate: "2026-04-19" },
      { Authorization: `Bearer ${token}` }
    );
    assert.equal(response.response.status, 201);
    assert.equal(response.payload.ok, true);
    assert.equal(response.payload.item.id, 11);
    assert.ok(insertBody && insertBody.includes("New"));
    assert.ok(
      insertBody && insertBody.includes('"display_date":"2026-04-19"'),
      "expected display_date to be persisted"
    );
  } finally {
    ctx.server.close();
  }
});

test("upload endpoint rejects missing or malformed displayDate", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";

  const dbPool = {
    query: async () => ({
      rowCount: 1,
      rows: [{ username: "admin", password_hash: hashPassword("admin123456"), role: "Admin" }],
    }),
  };

  const ctx = await startTestServer({ dbPool, fetchImpl: async () => new Response("[]", { status: 200 }) });
  try {
    const token = await loginAndGetToken(ctx.baseUrl);
    const basePayload = {
      title: "Valid",
      description: "",
      fileName: "nanami.jpg",
      fileType: "image/jpeg",
      fileSize: 3,
      fileBase64: Buffer.from("abc").toString("base64"),
    };

    const missing = await postJson(ctx.baseUrl, "/api/admin/media", basePayload, {
      Authorization: `Bearer ${token}`,
    });
    assert.equal(missing.response.status, 400);
    assert.match(String(missing.payload.message || ""), /display date/i);

    const malformed = await postJson(
      ctx.baseUrl,
      "/api/admin/media",
      { ...basePayload, displayDate: "04/19/2026" },
      { Authorization: `Bearer ${token}` }
    );
    assert.equal(malformed.response.status, 400);
    assert.match(String(malformed.payload.message || ""), /YYYY-MM-DD/i);
  } finally {
    ctx.server.close();
  }
});

test("public timeline orders by display_date desc then created_at desc", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
  process.env.SUPABASE_MEDIA_TABLE = "media_items";

  const fetchImpl = async (url) => {
    const urlText = String(url);
    if (urlText.includes("/rest/v1/media_items")) {
      return new Response(
        JSON.stringify([
          {
            id: 1,
            title: "Old media (recent upload)",
            description: "",
            media_type: "image",
            public_url: "https://example.supabase.co/storage/v1/object/public/media/a.jpg",
            display_date: "2024-01-15",
            created_at: "2026-04-19T10:00:00Z",
          },
          {
            id: 2,
            title: "Recent media (old upload)",
            description: "",
            media_type: "image",
            public_url: "https://example.supabase.co/storage/v1/object/public/media/b.jpg",
            display_date: "2026-04-15",
            created_at: "2024-01-10T10:00:00Z",
          },
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    if (urlText.includes("/rest/v1/story_posts")) {
      return new Response(
        JSON.stringify([
          {
            id: 3,
            title: "Text from 2025",
            body: "hello",
            display_date: "2025-06-01",
            created_at: "2026-04-19T09:00:00Z",
            likes_count: 0,
          },
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  const ctx = await startTestServer({ fetchImpl });
  try {
    const response = await fetch(`${ctx.baseUrl}/api/story/timeline?page=1`);
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.deepEqual(
      payload.items.map((entry) => entry.id),
      [2, 3, 1],
      "expected display_date desc ordering regardless of created_at"
    );
    assert.equal(payload.items[0].displayDate, "2026-04-15");
  } finally {
    ctx.server.close();
  }
});

test("admin story-posts create rejects missing title or body", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";

  const dbPool = {
    query: async () => ({
      rowCount: 1,
      rows: [{ username: "admin", password_hash: hashPassword("admin123456"), role: "Admin" }],
    }),
  };

  const ctx = await startTestServer({ fetchImpl: async () => new Response("null"), dbPool });
  try {
    const token = await loginAndGetToken(ctx.baseUrl);
    const noBody = await postJson(
      ctx.baseUrl,
      "/api/admin/story-posts",
      { title: "Valid" },
      { Authorization: `Bearer ${token}` }
    );
    assert.equal(noBody.response.status, 400);
    assert.match(String(noBody.payload.message || ""), /body/i);
  } finally {
    ctx.server.close();
  }
});

test("admin media endpoint keeps configured upper limit above showcase cap", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
  process.env.SUPABASE_MEDIA_TABLE = "media_items";
  process.env.SUPABASE_ADMIN_MEDIA_LIMIT = "180";

  let requestedUrl = "";
  const fetchImpl = async (url) => {
    const urlText = String(url);
    requestedUrl = urlText;

    if (urlText.includes("/rest/v1/media_items")) {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  const dbPool = {
    query: async () => ({
      rowCount: 1,
      rows: [{ username: "admin", password_hash: hashPassword("admin123456"), role: "Admin" }],
    }),
  };

  const ctx = await startTestServer({ fetchImpl, dbPool });
  try {
    const token = await loginAndGetToken(ctx.baseUrl);
    const response = await fetch(`${ctx.baseUrl}/api/admin/media`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.match(requestedUrl, /limit=180/);
  } finally {
    delete process.env.SUPABASE_ADMIN_MEDIA_LIMIT;
    ctx.server.close();
  }
});

test("metadata patch endpoint stamps updated_at on every edit", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
  process.env.SUPABASE_MEDIA_TABLE = "media_items";

  const dbPool = {
    query: async () => ({
      rowCount: 1,
      rows: [{ username: "admin", password_hash: hashPassword("admin123456"), role: "Admin" }],
    }),
  };

  let capturedBody = null;
  const fetchImpl = async (url, init = {}) => {
    if (String(url).includes("/rest/v1/media_items") && String(init.method) === "PATCH") {
      capturedBody = init.body ? JSON.parse(String(init.body)) : null;
      return new Response(
        JSON.stringify([
          {
            id: 11,
            title: "Edited",
            description: "Edited desc",
            media_type: "image",
            public_url: "https://example.test/a.jpg",
            created_at: "2026-04-01T00:00:00.000Z",
            updated_at: capturedBody?.updated_at || new Date().toISOString(),
          },
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  const ctx = await startTestServer({ dbPool, fetchImpl });
  try {
    const token = await loginAndGetToken(ctx.baseUrl);

    const { response, payload } = await patchJson(
      ctx.baseUrl,
      "/api/admin/media/11",
      { title: "Edited", description: "Edited desc" },
      { Authorization: `Bearer ${token}` }
    );

    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.ok(capturedBody, "expected PATCH body to be captured");
    assert.equal(typeof capturedBody.updated_at, "string");
    assert.ok(
      !Number.isNaN(Date.parse(capturedBody.updated_at)),
      "expected updated_at to be an ISO timestamp"
    );
    assert.equal(typeof payload.item.updated_at, "string");
  } finally {
    ctx.server.close();
  }
});

test("delete endpoint removes storage object and metadata row", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
  process.env.SUPABASE_STORAGE_BUCKET = "media";
  process.env.SUPABASE_MEDIA_TABLE = "media_items";

  const dbPool = {
    query: async () => ({
      rowCount: 1,
      rows: [{ username: "admin", password_hash: hashPassword("admin123456"), role: "Admin" }],
    }),
  };

  const fetchCalls = [];
  const fetchImpl = async (url, init = {}) => {
    const urlText = String(url);
    const method = String(init.method || "GET");
    fetchCalls.push({ url: urlText, method });

    if (urlText.includes("/rest/v1/media_items") && method === "GET") {
      return new Response(
        JSON.stringify([
          {
            id: 42,
            public_url:
              "https://example.supabase.co/storage/v1/object/public/media/uploads/42-abc.jpg",
          },
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    if (urlText.includes("/storage/v1/object/media/uploads/") && method === "DELETE") {
      return new Response(JSON.stringify({ message: "Successfully deleted" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (urlText.includes("/rest/v1/media_items") && method === "DELETE") {
      return new Response(JSON.stringify([{ id: 42 }]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  const ctx = await startTestServer({ dbPool, fetchImpl });
  try {
    const token = await loginAndGetToken(ctx.baseUrl);
    const response = await fetch(`${ctx.baseUrl}/api/admin/media/42`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.id, "42");
    assert.ok(
      fetchCalls.some(
        (entry) =>
          entry.method === "DELETE" && entry.url.includes("/storage/v1/object/media/uploads/")
      ),
      "expected storage DELETE call"
    );
    assert.ok(
      fetchCalls.some(
        (entry) => entry.method === "DELETE" && entry.url.includes("/rest/v1/media_items")
      ),
      "expected metadata DELETE call"
    );
  } finally {
    ctx.server.close();
  }
});

test("delete endpoint returns 404 when media id is missing", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
  process.env.SUPABASE_MEDIA_TABLE = "media_items";

  const dbPool = {
    query: async () => ({
      rowCount: 1,
      rows: [{ username: "admin", password_hash: hashPassword("admin123456"), role: "Admin" }],
    }),
  };

  const fetchImpl = async () =>
    new Response(JSON.stringify([]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  const ctx = await startTestServer({ dbPool, fetchImpl });
  try {
    const token = await loginAndGetToken(ctx.baseUrl);
    const response = await fetch(`${ctx.baseUrl}/api/admin/media/99999`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = await response.json();

    assert.equal(response.status, 404);
    assert.equal(payload.ok, false);
  } finally {
    ctx.server.close();
  }
});

test("delete endpoint rejects public_url outside configured bucket", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
  process.env.SUPABASE_STORAGE_BUCKET = "media";
  process.env.SUPABASE_MEDIA_TABLE = "media_items";

  const dbPool = {
    query: async () => ({
      rowCount: 1,
      rows: [{ username: "admin", password_hash: hashPassword("admin123456"), role: "Admin" }],
    }),
  };

  const fetchCalls = [];
  const fetchImpl = async (url, init = {}) => {
    const urlText = String(url);
    const method = String(init.method || "GET");
    fetchCalls.push({ url: urlText, method });

    if (urlText.includes("/rest/v1/media_items") && method === "GET") {
      return new Response(
        JSON.stringify([
          {
            id: 43,
            public_url:
              "https://example.supabase.co/storage/v1/object/public/other-bucket/uploads/43-abc.jpg",
          },
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  const ctx = await startTestServer({ dbPool, fetchImpl });
  try {
    const token = await loginAndGetToken(ctx.baseUrl);
    const response = await fetch(`${ctx.baseUrl}/api/admin/media/43`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.ok, false);
    assert.match(String(payload.message || ""), /does not match configured storage bucket/i);
    assert.equal(
      fetchCalls.some((entry) => entry.method === "DELETE" && entry.url.includes("/storage/v1/object/")),
      false
    );
  } finally {
    ctx.server.close();
  }
});

test("public showcase comments supports post and list", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
  process.env.SUPABASE_SHOWCASE_COMMENTS_TABLE = "showcase_comments";

  const comments = [];
  let commentSeq = 1;
  const fetchImpl = async (url, init = {}) => {
    const urlText = String(url);
    const method = String(init.method || "GET");
    if (urlText.includes("/rest/v1/showcase_comments") && method === "POST") {
      const payload = JSON.parse(String(init.body || "[]"));
      const row = payload[0] || {};
      const item = {
        id: commentSeq++,
        author_name: String(row.author_name || ""),
        message: String(row.message || ""),
        created_at: new Date().toISOString(),
      };
      comments.unshift(item);
      return new Response(JSON.stringify([item]), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (urlText.includes("/rest/v1/showcase_comments") && method === "GET") {
      return new Response(JSON.stringify(comments), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  const ctx = await startTestServer({ fetchImpl });
  try {
    const post = await postJson(ctx.baseUrl, "/api/showcase/comments", {
      authorName: "Alice",
      message: "Nanami is adorable!",
    });
    assert.equal(post.response.status, 201);
    assert.equal(post.payload.ok, true);
    assert.equal(post.payload.item.author_name, "Alice");

    const listResponse = await fetch(`${ctx.baseUrl}/api/showcase/comments?limit=10`);
    const listPayload = await listResponse.json();
    assert.equal(listResponse.status, 200);
    assert.equal(listPayload.ok, true);
    assert.equal(Array.isArray(listPayload.items), true);
    assert.equal(listPayload.items.length, 1);
    assert.equal(listPayload.items[0].message, "Nanami is adorable!");
  } finally {
    ctx.server.close();
  }
});

test("public showcase comments validates author/message", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
  process.env.SUPABASE_SHOWCASE_COMMENTS_TABLE = "showcase_comments";
  const ctx = await startTestServer({
    fetchImpl: async () =>
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
  });
  try {
    const badAuthor = await postJson(ctx.baseUrl, "/api/showcase/comments", {
      authorName: "",
      message: "Hi",
    });
    assert.equal(badAuthor.response.status, 400);

    const badMessage = await postJson(ctx.baseUrl, "/api/showcase/comments", {
      authorName: "Alice",
      message: "",
    });
    assert.equal(badMessage.response.status, 400);
  } finally {
    ctx.server.close();
  }
});

test("storage usage endpoint sums file_size and reports status thresholds", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
  process.env.STORAGE_SOFT_LIMIT_BYTES = String(10 * 1024 * 1024);
  process.env.STORAGE_HARD_LIMIT_BYTES = String(20 * 1024 * 1024);

  const dbPool = {
    query: async () => ({
      rowCount: 1,
      rows: [{ username: "admin", password_hash: hashPassword("admin123456"), role: "Admin" }],
    }),
  };

  const fetchImpl = async (url) => {
    if (String(url).includes("/rest/v1/media_items?select=file_size")) {
      return new Response(
        JSON.stringify([{ file_size: 4 * 1024 * 1024 }, { file_size: 8 * 1024 * 1024 }]),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    return new Response("[]", { status: 200 });
  };

  const ctx = await startTestServer({ dbPool, fetchImpl });
  try {
    const token = await loginAndGetToken(ctx.baseUrl);
    const response = await fetch(`${ctx.baseUrl}/api/admin/storage/usage`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.usedBytes, 12 * 1024 * 1024);
    assert.equal(payload.softLimitBytes, 10 * 1024 * 1024);
    assert.equal(payload.hardLimitBytes, 20 * 1024 * 1024);
    assert.equal(payload.trackedItems, 2);
    assert.equal(payload.status, "warn");
  } finally {
    ctx.server.close();
    delete process.env.STORAGE_SOFT_LIMIT_BYTES;
    delete process.env.STORAGE_HARD_LIMIT_BYTES;
  }
});

test("storage usage endpoint blocks Viewer role", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";

  const ctx = await startTestServer();
  try {
    const response = await fetch(`${ctx.baseUrl}/api/admin/storage/usage`);
    assert.equal(response.status, 401);
  } finally {
    ctx.server.close();
  }
});
