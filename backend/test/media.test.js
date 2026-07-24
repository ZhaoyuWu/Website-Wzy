const test = require("node:test");
const assert = require("node:assert/strict");

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

const ADMIN_USER_ID = "admin-user-1";

function withAdminSupabaseAuth(fetchImpl) {
  return async (url, init = {}) => {
    const urlText = String(url);
    const authHeader = String(init.headers?.Authorization || "");
    if (urlText.includes("/auth/v1/user") && authHeader === "Bearer supabase-admin-token") {
      return new Response(
        JSON.stringify({ id: ADMIN_USER_ID, email: "admin@example.com", app_metadata: {} }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    if (urlText.includes(`/rest/v1/profiles?id=eq.${ADMIN_USER_ID}`)) {
      return new Response(JSON.stringify([{ id: ADMIN_USER_ID, role: "Admin" }]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (typeof fetchImpl === "function") {
      return fetchImpl(url, init);
    }
    return new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } });
  };
}

function startTestServer(options = {}) {
  const app = createApp({
    randomBytes: () => Buffer.alloc(32, 9),
    fetchImpl: withAdminSupabaseAuth(options.fetchImpl),
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

async function loginAndGetToken() {
  return "supabase-admin-token";
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


  const ctx = await startTestServer({ fetchImpl: async () => new Response("[]", { status: 200 }) });
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


  const ctx = await startTestServer({ fetchImpl: async () => new Response("[]", { status: 200 }) });
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


  const ctx = await startTestServer({ fetchImpl: async () => new Response("[]", { status: 200 }) });
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

  const ctx = await startTestServer({ fetchImpl });
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

  const ctx = await startTestServer({ fetchImpl });
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


  const ctx = await startTestServer({ fetchImpl: async () => new Response("[]", { status: 200 }) });
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
    assert.equal(payload.pageSize, 10);
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


  const ctx = await startTestServer({ fetchImpl });
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


  const ctx = await startTestServer({ fetchImpl: async () => new Response("[]", { status: 200 }) });
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


  const ctx = await startTestServer({ fetchImpl: async () => new Response("null") });
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


  const ctx = await startTestServer({ fetchImpl });
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

  const ctx = await startTestServer({ fetchImpl });
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

  const ctx = await startTestServer({ fetchImpl });
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


  const fetchImpl = async () =>
    new Response(JSON.stringify([]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  const ctx = await startTestServer({ fetchImpl });
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

  const ctx = await startTestServer({ fetchImpl });
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


  const fetchImpl = async (url) => {
    if (String(url).includes("/rest/v1/media_items?select=file_size")) {
      return new Response(
        JSON.stringify([{ file_size: 4 * 1024 * 1024 }, { file_size: 8 * 1024 * 1024 }]),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    return new Response("[]", { status: 200 });
  };

  const ctx = await startTestServer({ fetchImpl });
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

test("sync-profile upserts using metadata or email fallback", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";

  const captured = [];
  const fetchImpl = async (url, init = {}) => {
    const urlText = String(url);
    if (urlText.endsWith("/auth/v1/user")) {
      return new Response(
        JSON.stringify({
          id: "user-9",
          email: "foo@example.com",
          user_metadata: { username: "foo_star" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    if (urlText.includes("/rest/v1/profiles")) {
      captured.push({ url: urlText, body: init.body ? JSON.parse(init.body) : null });
      return new Response(
        JSON.stringify([{ id: "user-9", email: "foo@example.com", username: "foo_star" }]),
        { status: 201, headers: { "Content-Type": "application/json" } }
      );
    }
    return new Response("null", { status: 200 });
  };

  const ctx = await startTestServer({ fetchImpl });
  try {
    const response = await fetch(`${ctx.baseUrl}/api/auth/sync-profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer supabase-jwt" },
      body: JSON.stringify({}),
    });
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.ok, true);
    assert.equal(payload.profile.username, "foo_star");
    assert.equal(captured.length, 1);
    assert.equal(captured[0].body[0].username, "foo_star");
  } finally {
    ctx.server.close();
  }
});

test("sync-profile sanitizes Gmail plus-address fallback instead of 400", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";

  let insertedUsername = null;
  const fetchImpl = async (url, init = {}) => {
    const urlText = String(url);
    if (urlText.endsWith("/auth/v1/user")) {
      return new Response(
        JSON.stringify({ id: "user-10", email: "foo+tag@gmail.com", user_metadata: {} }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    if (urlText.includes("/rest/v1/profiles")) {
      const body = init.body ? JSON.parse(init.body) : [];
      insertedUsername = body[0]?.username || null;
      return new Response(
        JSON.stringify([{ id: "user-10", email: "foo+tag@gmail.com", username: insertedUsername }]),
        { status: 201, headers: { "Content-Type": "application/json" } }
      );
    }
    return new Response("null", { status: 200 });
  };

  const ctx = await startTestServer({ fetchImpl });
  try {
    const response = await fetch(`${ctx.baseUrl}/api/auth/sync-profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer supabase-jwt" },
      body: JSON.stringify({}),
    });
    assert.equal(response.status, 200);
    assert.equal(insertedUsername, "foo-tag");
  } finally {
    ctx.server.close();
  }
});

test("sync-profile rejects explicitly bad suggested username", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";

  const fetchImpl = async (url) => {
    if (String(url).endsWith("/auth/v1/user")) {
      return new Response(
        JSON.stringify({ id: "user-11", email: "ok@example.com", user_metadata: {} }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    return new Response("null", { status: 200 });
  };

  const ctx = await startTestServer({ fetchImpl });
  try {
    const response = await fetch(`${ctx.baseUrl}/api/auth/sync-profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer supabase-jwt" },
      body: JSON.stringify({ username: "bad name!" }),
    });
    assert.equal(response.status, 400);
  } finally {
    ctx.server.close();
  }
});

test("sync-profile rejects missing bearer token", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";

  const ctx = await startTestServer();
  try {
    const response = await fetch(`${ctx.baseUrl}/api/auth/sync-profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(response.status, 401);
  } finally {
    ctx.server.close();
  }
});

test("story like endpoint is idempotent for the same anon viewer", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
  process.env.LIKE_COOLDOWN_MS = "0";

  const rpcHits = [];
  const fetchImpl = async (url) => {
    const urlText = String(url);
    if (urlText.endsWith("/auth/v1/user")) {
      return new Response("{}", { status: 401 });
    }
    if (urlText.includes("/rest/v1/rpc/increment_media_likes")) {
      rpcHits.push(urlText);
      return new Response("1", { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (urlText.includes("/rest/v1/media_items") && urlText.includes("likes_count")) {
      return new Response(JSON.stringify([{ likes_count: 1 }]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response("null", { status: 200 });
  };

  const ctx = await startTestServer({ fetchImpl });
  try {
    const first = await fetch(`${ctx.baseUrl}/api/story/media/77/like`, { method: "POST" });
    assert.equal(first.status, 200);
    const firstPayload = await first.json();
    assert.equal(firstPayload.alreadyLiked, false);

    const second = await fetch(`${ctx.baseUrl}/api/story/media/77/like`, { method: "POST" });
    assert.equal(second.status, 200);
    const secondPayload = await second.json();
    assert.equal(secondPayload.alreadyLiked, true);
    assert.equal(secondPayload.likesCount, 1);
    assert.equal(rpcHits.length, 1);
  } finally {
    ctx.server.close();
    delete process.env.LIKE_COOLDOWN_MS;
  }
});

test("like records persist across backend restarts via entry_likes table", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
  process.env.LIKE_COOLDOWN_MS = "0";

  const likeRows = [];
  const rpcHits = [];
  const jsonResponse = (payload, status = 200) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  const fetchImpl = async (url, init = {}) => {
    const urlText = String(url);
    const method = String(init.method || "GET").toUpperCase();
    if (urlText.endsWith("/auth/v1/user")) {
      return new Response("{}", { status: 401 });
    }
    if (urlText.includes("/rest/v1/rpc/increment_media_likes")) {
      rpcHits.push(urlText);
      return new Response("1", { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (urlText.includes("/rest/v1/entry_likes")) {
      if (method === "POST") {
        const row = JSON.parse(String(init.body || "[]"))[0];
        likeRows.push({ ...row, created_at: "2026-07-24T10:00:00.000Z" });
        return jsonResponse([row], 201);
      }
      const matches = likeRows.filter(
        (row) =>
          urlText.includes(`entry_id=eq.${row.entry_id}`) &&
          urlText.includes(encodeURIComponent(row.viewer_key))
      );
      return jsonResponse(matches.map((row, index) => ({ id: index + 1, ...row })));
    }
    if (urlText.includes("/rest/v1/media_items") && urlText.includes("likes_count")) {
      return jsonResponse([{ likes_count: 1 }]);
    }
    return new Response("null", { status: 200 });
  };

  const ctxA = await startTestServer({ fetchImpl });
  try {
    const first = await fetch(`${ctxA.baseUrl}/api/story/media/77/like`, { method: "POST" });
    assert.equal(first.status, 200);
    const firstPayload = await first.json();
    assert.equal(firstPayload.alreadyLiked, false);
    assert.equal(likeRows.length, 1);
  } finally {
    ctxA.server.close();
  }

  // Fresh server instance = empty in-memory maps. The durable row alone must
  // prevent the double-like and the extra RPC increment.
  const ctxB = await startTestServer({ fetchImpl });
  try {
    const second = await fetch(`${ctxB.baseUrl}/api/story/media/77/like`, { method: "POST" });
    assert.equal(second.status, 200);
    const secondPayload = await second.json();
    assert.equal(secondPayload.alreadyLiked, true);
    assert.equal(secondPayload.likesCount, 1);
    assert.equal(rpcHits.length, 1);
  } finally {
    ctxB.server.close();
    delete process.env.LIKE_COOLDOWN_MS;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  }
});

test("comment delete requires Admin role, Publisher gets 403", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";

  const fetchImpl = async (url) => {
    const urlText = String(url);
    if (urlText.includes("/auth/v1/user")) {
      return new Response(
        JSON.stringify({ id: "publisher-user-1", email: "publisher@example.com", app_metadata: {} }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    if (urlText.includes("/rest/v1/profiles?id=eq.publisher-user-1")) {
      return new Response(JSON.stringify([{ id: "publisher-user-1", role: "Publisher" }]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response("[]");
  };

  const ctx = await startTestServer({ fetchImpl });
  try {
    const token = "supabase-publisher-token";

    const response = await fetch(`${ctx.baseUrl}/api/story/media/1/comments/9`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(response.status, 403);
  } finally {
    ctx.server.close();
  }
});

test("comment delete returns 404 when Supabase response is empty", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";


  const fetchImpl = async (url, init = {}) => {
    if (String(url).includes("/rest/v1/story_comments") && init.method === "DELETE") {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response("[]");
  };

  const ctx = await startTestServer({ fetchImpl });
  try {
    const token = await loginAndGetToken(ctx.baseUrl);
    const response = await fetch(`${ctx.baseUrl}/api/story/media/1/comments/9999`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(response.status, 404);
  } finally {
    ctx.server.close();
  }
});

test("story likes listing endpoint is Admin-only and returns recorded viewers", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
  process.env.LIKE_COOLDOWN_MS = "0";


  const fetchImpl = async (url) => {
    const urlText = String(url);
    if (urlText.endsWith("/auth/v1/user")) {
      return new Response("{}", { status: 401 });
    }
    if (urlText.includes("/rest/v1/rpc/increment_media_likes")) {
      return new Response("1", { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (urlText.includes("/rest/v1/entry_likes")) {
      // Simulate an unusable durable store so the in-memory fallback records the like.
      return new Response("null", { status: 200 });
    }
    return new Response("[]", { status: 200 });
  };

  const ctx = await startTestServer({ fetchImpl });
  try {
    await fetch(`${ctx.baseUrl}/api/story/media/55/like`, { method: "POST" });

    const token = await loginAndGetToken(ctx.baseUrl);
    const response = await fetch(`${ctx.baseUrl}/api/story/media/55/likes`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.total, 1);
    assert.equal(payload.items.length, 1);
  } finally {
    ctx.server.close();
    delete process.env.LIKE_COOLDOWN_MS;
  }
});

test("timeline respects 10-per-page ceiling", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";

  const rows = Array.from({ length: 25 }, (_, i) => ({
    id: i + 1,
    title: `Item ${i + 1}`,
    description: "",
    media_type: "image",
    public_url: `https://example.com/img${i + 1}.jpg`,
    thumbnail_url: null,
    likes_count: 0,
    display_date: `2026-04-${String((i % 30) + 1).padStart(2, "0")}`,
    created_at: new Date(2026, 3, (i % 30) + 1).toISOString(),
  }));

  const fetchImpl = async (url) => {
    const urlText = String(url);
    if (urlText.includes("/rest/v1/media_items") && urlText.includes("select=id")) {
      return new Response(JSON.stringify(rows), {
        status: 200,
        headers: { "Content-Type": "application/json", "content-range": "0-24/25" },
      });
    }
    if (urlText.includes("/rest/v1/story_posts")) {
      return new Response("[]", {
        status: 200,
        headers: { "Content-Type": "application/json", "content-range": "*/0" },
      });
    }
    if (urlText.includes("/rest/v1/story_comments")) {
      return new Response("[]", {
        status: 200,
        headers: { "Content-Type": "application/json", "content-range": "*/0" },
      });
    }
    return new Response("[]", { status: 200 });
  };

  const ctx = await startTestServer({ fetchImpl });
  try {
    const response = await fetch(`${ctx.baseUrl}/api/story/timeline?page=1`);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.pageSize, 10);
    assert.equal(payload.items.length, 10);
    assert.equal(payload.totalPages, 3);
  } finally {
    ctx.server.close();
  }
});

test("signed upload flow issues URL then finalize verifies object and saves metadata", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";

  let insertedRow = null;
  const fetchImpl = async (url, init = {}) => {
    const urlText = String(url);
    const method = String(init.method || "GET").toUpperCase();
    if (urlText.includes("/storage/v1/object/upload/sign/media/uploads/") && method === "POST") {
      const objectSegment = urlText.split("/storage/v1/object/upload/sign/")[1];
      return new Response(
        JSON.stringify({ url: `/object/upload/sign/${objectSegment}?token=signed-token` }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    if (urlText.includes("/storage/v1/object/public/media/uploads/") && method === "HEAD") {
      return new Response(null, { status: 200, headers: { "content-length": "2048" } });
    }
    if (urlText.includes("/rest/v1/media_items") && method === "POST") {
      insertedRow = JSON.parse(String(init.body || "[]"))[0];
      return new Response(JSON.stringify([{ id: 99, ...insertedRow }]), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } });
  };

  const ctx = await startTestServer({ fetchImpl });
  try {
    const token = await loginAndGetToken(ctx.baseUrl);

    const urlStep = await postJson(
      ctx.baseUrl,
      "/api/admin/media/upload-url",
      { fileName: "Cute Photo.JPG", fileType: "image/jpeg", fileSize: 2048 },
      { Authorization: `Bearer ${token}` }
    );
    assert.equal(urlStep.response.status, 200);
    assert.equal(urlStep.payload.ok, true);
    assert.match(String(urlStep.payload.objectPath), /^uploads\/[a-z0-9._-]+$/);
    assert.match(String(urlStep.payload.uploadUrl), /token=signed-token/);

    const finalizeStep = await postJson(
      ctx.baseUrl,
      "/api/admin/media/finalize",
      {
        title: "Nanami",
        description: "direct upload",
        displayDate: "2026-07-24",
        objectPath: urlStep.payload.objectPath,
        fileType: "image/jpeg",
        fileSize: 2048,
      },
      { Authorization: `Bearer ${token}` }
    );
    assert.equal(finalizeStep.response.status, 201);
    assert.equal(finalizeStep.payload.ok, true);
    assert.equal(insertedRow.file_size, 2048);
    assert.match(String(insertedRow.public_url), /object\/public\/media\/uploads\//);
  } finally {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    ctx.server.close();
  }
});

test("upload-url rejects unsupported types and oversize declarations", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";

  const ctx = await startTestServer({ fetchImpl: async () => new Response("[]") });
  try {
    const token = await loginAndGetToken(ctx.baseUrl);

    const badType = await postJson(
      ctx.baseUrl,
      "/api/admin/media/upload-url",
      { fileName: "doc.pdf", fileType: "application/pdf", fileSize: 100 },
      { Authorization: `Bearer ${token}` }
    );
    assert.equal(badType.response.status, 400);

    const oversize = await postJson(
      ctx.baseUrl,
      "/api/admin/media/upload-url",
      { fileName: "big.mp4", fileType: "video/mp4", fileSize: 51 * 1024 * 1024 },
      { Authorization: `Bearer ${token}` }
    );
    assert.equal(oversize.response.status, 400);
    assert.match(String(oversize.payload.message || ""), /50MB/);
  } finally {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    ctx.server.close();
  }
});

test("finalize rejects missing storage object and traversal paths", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";

  const fetchImpl = async (url, init = {}) => {
    if (String(init.method || "").toUpperCase() === "HEAD") {
      return new Response(null, { status: 404 });
    }
    return new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } });
  };

  const ctx = await startTestServer({ fetchImpl });
  try {
    const token = await loginAndGetToken(ctx.baseUrl);
    const base = {
      title: "Nanami",
      description: "",
      displayDate: "2026-07-24",
      fileType: "image/jpeg",
      fileSize: 10,
    };

    const traversal = await postJson(
      ctx.baseUrl,
      "/api/admin/media/finalize",
      { ...base, objectPath: "uploads/../secrets" },
      { Authorization: `Bearer ${token}` }
    );
    assert.equal(traversal.response.status, 400);

    const missing = await postJson(
      ctx.baseUrl,
      "/api/admin/media/finalize",
      { ...base, objectPath: "uploads/1-abc-photo.jpg" },
      { Authorization: `Bearer ${token}` }
    );
    assert.equal(missing.response.status, 400);
    assert.match(String(missing.payload.message || ""), /not found in storage/i);
  } finally {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    ctx.server.close();
  }
});
