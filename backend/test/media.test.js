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
  assert.equal(isValidMediaDescription("x".repeat(500)), true);
  assert.equal(isValidMediaDescription("x".repeat(501)), false);

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
      rows: [{ username: "admin", password_hash: hashPassword("admin123456") }],
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

test("upload endpoint stores media in Supabase and writes metadata", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
  process.env.SUPABASE_STORAGE_BUCKET = "media";
  process.env.SUPABASE_MEDIA_TABLE = "media_items";

  const dbPool = {
    query: async () => ({
      rowCount: 1,
      rows: [{ username: "admin", password_hash: hashPassword("admin123456") }],
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
      rows: [{ username: "admin", password_hash: hashPassword("admin123456") }],
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
