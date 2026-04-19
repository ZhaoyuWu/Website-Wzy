require("dotenv").config();

const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const defaultPool = require("./db");
const { hashPassword, verifyPassword } = require("./password");

const PORT = Number(process.env.PORT || 4000);

const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const VIDEO_MIME_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_SIZE_BYTES = 50 * 1024 * 1024;
const UNSAFE_CONTROL_CHARS_REGEX = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const VALID_ROLES = new Set(["Admin", "Publisher", "Viewer"]);
const DEFAULT_SITE_SETTINGS = Object.freeze({
  profileName: "Nanami",
  heroTagline: "Nanami, the sunshine of every walk.",
  aboutText:
    "This page shares Nanami's personality, daily routine, and favorite places in a warm timeline style.",
  contactEmail: "",
  showContactEmail: false,
});

function parseAllowlist(rawValue) {
  return String(rawValue || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function buildCorsOptions() {
  const configuredOrigins = parseAllowlist(process.env.CORS_ORIGIN_ALLOWLIST);
  const defaultOrigins = ["http://localhost:4200", "http://127.0.0.1:4200"];
  const allowlist = new Set(configuredOrigins.length > 0 ? configuredOrigins : defaultOrigins);

  return {
    origin(origin, callback) {
      if (!origin || allowlist.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("CORS origin denied"));
    },
  };
}

function parseBearerToken(headerValue) {
  if (!headerValue || typeof headerValue !== "string") {
    return null;
  }

  const [scheme, token] = headerValue.split(" ");
  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token;
}

function isValidUsername(username) {
  return typeof username === "string" && /^[A-Za-z0-9_.-]{3,32}$/.test(username);
}

function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPassword(password) {
  return typeof password === "string" && password.length >= 8 && password.length <= 128;
}

function normalizeMediaTitle(title) {
  return typeof title === "string" ? title.trim() : "";
}

function normalizeMediaDescription(description) {
  return typeof description === "string" ? description.trim() : "";
}

function isValidMediaTitle(title) {
  const normalized = normalizeMediaTitle(title);
  return normalized.length >= 1 && normalized.length <= 120 && !hasUnsafeControlChars(normalized);
}

function isValidMediaDescription(description) {
  const normalized = normalizeMediaDescription(description);
  return normalized.length <= 500 && !hasUnsafeControlChars(normalized);
}

function normalizeSettingText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function hasUnsafeControlChars(value) {
  return UNSAFE_CONTROL_CHARS_REGEX.test(String(value || ""));
}

function inferMediaType(mimeType) {
  if (IMAGE_MIME_TYPES.has(mimeType)) {
    return "image";
  }
  if (VIDEO_MIME_TYPES.has(mimeType)) {
    return "video";
  }
  return null;
}

function parseBase64Payload(rawValue) {
  if (typeof rawValue !== "string") {
    return null;
  }

  const trimmed = rawValue.trim();
  if (!trimmed) {
    return null;
  }

  const commaIndex = trimmed.indexOf(",");
  const payload = commaIndex >= 0 ? trimmed.slice(commaIndex + 1) : trimmed;
  if (!payload || !/^[A-Za-z0-9+/=\r\n]+$/.test(payload)) {
    return null;
  }

  try {
    return Buffer.from(payload, "base64");
  } catch {
    return null;
  }
}

function sanitizeObjectName(fileName) {
  const source = typeof fileName === "string" ? fileName : "upload";
  const collapsed = source
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return collapsed || "upload";
}

function toPositiveInt(rawValue, fallback) {
  const parsed = Number.parseInt(String(rawValue || ""), 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function buildSupabaseObjectPath(bucketName, objectPath) {
  const encodedBucket = encodeURIComponent(bucketName);
  const encodedPath = objectPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${encodedBucket}/${encodedPath}`;
}

function resolveStorageDeletePathFromPublicUrl(publicUrl, supabaseUrl, storageBucket) {
  if (typeof publicUrl !== "string" || !publicUrl.trim()) {
    return null;
  }

  const expectedPrefix =
    `${String(supabaseUrl || "").replace(/\/+$/, "")}/storage/v1/object/public/` +
    `${encodeURIComponent(String(storageBucket || "").trim())}/`;
  if (!publicUrl.startsWith(expectedPrefix)) {
    return null;
  }

  const encodedObjectPath = publicUrl.slice(expectedPrefix.length);
  if (!encodedObjectPath) {
    return null;
  }

  let decodedSegments = null;
  try {
    decodedSegments = encodedObjectPath.split("/").map((segment) => decodeURIComponent(segment));
  } catch {
    return null;
  }

  if (
    decodedSegments.some(
      (segment) =>
        !segment || segment === "." || segment === ".." || segment.includes("\\") || segment.includes("/")
    )
  ) {
    return null;
  }

  return buildSupabaseObjectPath(String(storageBucket || "").trim(), decodedSegments.join("/"));
}

function normalizeRole(rawRole) {
  const role = typeof rawRole === "string" ? rawRole.trim() : "";
  return VALID_ROLES.has(role) ? role : "Viewer";
}

function createApp(options = {}) {
  const dbPool = options.dbPool || defaultPool;
  const sessionTtlMs = Number(process.env.SESSION_TTL_MS || 1000 * 60 * 60 * 8);
  const loginAttemptWindowMs = Number(process.env.LOGIN_ATTEMPT_WINDOW_MS || 10 * 60 * 1000);
  const loginAttemptMax = Number(process.env.LOGIN_ATTEMPT_MAX || 5);
  const loginBlockMs = Number(process.env.LOGIN_BLOCK_MS || 15 * 60 * 1000);
  const now = typeof options.now === "function" ? options.now : Date.now;
  const randomBytes = options.randomBytes || crypto.randomBytes;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const sessions = new Map();
  const loginAttempts = new Map();
  const app = express();

  app.use(cors(buildCorsOptions()));
  app.use(express.json({ limit: "64mb" }));

  const mediaConfig = {
    supabaseUrl: String(process.env.SUPABASE_URL || "").replace(/\/+$/, ""),
    serviceRoleKey: String(process.env.SUPABASE_SERVICE_ROLE_KEY || ""),
    mediaTable: String(process.env.SUPABASE_MEDIA_TABLE || "media_items").trim(),
    storageBucket: String(process.env.SUPABASE_STORAGE_BUCKET || "media").trim(),
    adminListLimit: Math.min(
      200,
      Math.max(1, toPositiveInt(process.env.SUPABASE_ADMIN_MEDIA_LIMIT, 60))
    ),
  };
  const settingsConfig = {
    settingsTable: String(process.env.SUPABASE_SETTINGS_TABLE || "site_settings").trim(),
    settingsKeyColumn: String(process.env.SUPABASE_SETTINGS_KEY_COLUMN || "setting_key").trim(),
    settingsRowKey: String(process.env.SUPABASE_SETTINGS_ROW_KEY || "site").trim(),
  };

  function createSession(username, role) {
    const token = randomBytes(32).toString("hex");
    const expiresAt = now() + sessionTtlMs;
    sessions.set(token, { username, role: role || "Viewer", expiresAt });
    return { token, expiresAt };
  }

  function clearExpiredSessions() {
    const current = now();
    for (const [token, session] of sessions.entries()) {
      if (session.expiresAt <= current) {
        sessions.delete(token);
      }
    }
  }

  async function requireAuth(req, res, next) {
    clearExpiredSessions();
    const token = parseBearerToken(req.headers.authorization);
    const session = token ? sessions.get(token) : null;

    if (session) {
      req.auth = { token, username: session.username, role: session.role || "Viewer", expiresAt: session.expiresAt };
      return next();
    }

    if (token && mediaConfig.supabaseUrl && mediaConfig.serviceRoleKey) {
      try {
        const userResponse = await fetchImpl(`${mediaConfig.supabaseUrl}/auth/v1/user`, {
          headers: {
            apikey: mediaConfig.serviceRoleKey,
            Authorization: `Bearer ${token}`,
          },
        });
        if (userResponse.ok) {
          const userData = await userResponse.json();
          const userId = userData?.id || null;
          let role = "Viewer";
          if (userId && mediaConfig.supabaseUrl && mediaConfig.serviceRoleKey) {
            try {
              const profileResponse = await fetchImpl(
                `${mediaConfig.supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=role&limit=1`,
                {
                  headers: {
                    apikey: mediaConfig.serviceRoleKey,
                    Authorization: `Bearer ${mediaConfig.serviceRoleKey}`,
                  },
                }
              );
              if (profileResponse.ok) {
                const profileData = await profileResponse.json();
                if (Array.isArray(profileData) && profileData[0]?.role) {
                  role = normalizeRole(profileData[0].role);
                }
              }
            } catch {
              // Fall back to Viewer if profiles query fails
            }
          }
          req.auth = {
            token,
            username: userData?.email || userData?.id || "unknown",
            userId,
            role,
            expiresAt: new Date(Date.now() + sessionTtlMs).toISOString(),
          };
          return next();
        }
      } catch {
        // Fall through to 401
      }
    }

    return res.status(401).json({ ok: false, message: "Authentication required" });
  }

  function requireRole(...roles) {
    return (req, res, next) => {
      if (!roles.includes(req.auth?.role)) {
        return res.status(403).json({ ok: false, message: "Insufficient permissions" });
      }
      return next();
    };
  }

  function getThrottleKey(req, username) {
    const ip = req.ip || req.socket?.remoteAddress || "unknown";
    return `${ip}:${String(username).toLowerCase()}`;
  }

  function clearExpiredLoginAttempts() {
    const current = now();
    for (const [key, state] of loginAttempts.entries()) {
      const expiredWindow = current - state.windowStart > loginAttemptWindowMs;
      const expiredBlock = !state.blockedUntil || state.blockedUntil <= current;
      if (expiredWindow && expiredBlock) {
        loginAttempts.delete(key);
      }
    }
  }

  function isLoginBlocked(key) {
    clearExpiredLoginAttempts();
    const state = loginAttempts.get(key);
    if (!state || !state.blockedUntil) {
      return false;
    }
    return state.blockedUntil > now();
  }

  function registerLoginFailure(key) {
    const current = now();
    const existing = loginAttempts.get(key);
    const shouldResetWindow = !existing || current - existing.windowStart > loginAttemptWindowMs;
    const state = shouldResetWindow
      ? { count: 0, windowStart: current, blockedUntil: 0 }
      : existing;

    state.count += 1;
    if (state.count >= loginAttemptMax) {
      state.blockedUntil = current + loginBlockMs;
      state.count = 0;
      state.windowStart = current;
    }

    loginAttempts.set(key, state);
  }

  function clearLoginFailures(key) {
    loginAttempts.delete(key);
  }

  function ensureSupabaseConfig() {
    if (!mediaConfig.supabaseUrl || !mediaConfig.serviceRoleKey) {
      throw new Error(
        "Supabase admin config missing. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on backend."
      );
    }
  }

  function mapSettingsRow(row) {
    const source = row && typeof row === "object" ? row : {};
    return {
      profileName: normalizeSettingText(source.profile_name || DEFAULT_SITE_SETTINGS.profileName),
      heroTagline: normalizeSettingText(source.hero_tagline || DEFAULT_SITE_SETTINGS.heroTagline),
      aboutText: normalizeSettingText(source.about_text || DEFAULT_SITE_SETTINGS.aboutText),
      contactEmail: normalizeSettingText(source.contact_email || ""),
      showContactEmail: Boolean(source.show_contact_email),
      updatedAt: source.updated_at ? String(source.updated_at) : null,
    };
  }

  async function readSiteSettings() {
    const selectColumns =
      "profile_name,hero_tagline,about_text,contact_email,show_contact_email,updated_at";
    const endpoint =
      `/rest/v1/${encodeURIComponent(settingsConfig.settingsTable)}` +
      `?${encodeURIComponent(settingsConfig.settingsKeyColumn)}=eq.${encodeURIComponent(settingsConfig.settingsRowKey)}` +
      `&select=${encodeURIComponent(selectColumns)}` +
      "&limit=1";
    const response = await callSupabase(endpoint, { method: "GET" });
    const payload = await response.json();

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: "Failed to load site settings from Supabase.",
        details: payload,
      };
    }

    const row = Array.isArray(payload) ? payload[0] : null;
    if (!row) {
      return { ok: true, settings: { ...DEFAULT_SITE_SETTINGS, updatedAt: null }, isDefault: true };
    }

    return { ok: true, settings: mapSettingsRow(row), isDefault: false };
  }

  function buildSettingsPatch(rawBody) {
    if (!rawBody || typeof rawBody !== "object") {
      return { ok: false, message: "Invalid settings payload." };
    }

    const patch = {};
    const hasField = (field) => Object.prototype.hasOwnProperty.call(rawBody, field);

    if (hasField("profileName")) {
      const profileName = normalizeSettingText(rawBody.profileName);
      if (!profileName || profileName.length > 80 || hasUnsafeControlChars(profileName)) {
        return { ok: false, message: "Profile name must be 1-80 readable characters." };
      }
      patch.profile_name = profileName;
    }

    if (hasField("heroTagline")) {
      const heroTagline = normalizeSettingText(rawBody.heroTagline);
      if (!heroTagline || heroTagline.length > 180 || hasUnsafeControlChars(heroTagline)) {
        return { ok: false, message: "Hero tagline must be 1-180 readable characters." };
      }
      patch.hero_tagline = heroTagline;
    }

    if (hasField("aboutText")) {
      const aboutText = normalizeSettingText(rawBody.aboutText);
      if (!aboutText || aboutText.length > 1200 || hasUnsafeControlChars(aboutText)) {
        return { ok: false, message: "About text must be 1-1200 readable characters." };
      }
      patch.about_text = aboutText;
    }

    if (hasField("contactEmail")) {
      const contactEmail = normalizeSettingText(rawBody.contactEmail).toLowerCase();
      if (contactEmail && (!isValidEmail(contactEmail) || contactEmail.length > 120)) {
        return { ok: false, message: "Contact email must be empty or a valid email address." };
      }
      patch.contact_email = contactEmail;
    }

    if (hasField("showContactEmail")) {
      if (typeof rawBody.showContactEmail !== "boolean") {
        return { ok: false, message: "showContactEmail must be true or false." };
      }
      patch.show_contact_email = rawBody.showContactEmail;
    }

    if (Object.keys(patch).length === 0) {
      return { ok: false, message: "No valid settings fields provided." };
    }

    return { ok: true, patch };
  }

  async function callSupabase(pathWithQuery, requestInit = {}) {
    ensureSupabaseConfig();

    if (typeof fetchImpl !== "function") {
      throw new Error("Fetch is unavailable in this Node runtime.");
    }

    const response = await fetchImpl(`${mediaConfig.supabaseUrl}${pathWithQuery}`, {
      ...requestInit,
      headers: {
        apikey: mediaConfig.serviceRoleKey,
        Authorization: `Bearer ${mediaConfig.serviceRoleKey}`,
        ...(requestInit.headers || {}),
      },
    });

    return response;
  }

  async function listMediaItems(limit, maxLimit = 120) {
    const selectColumns =
      "id,title,description,media_type,public_url,thumbnail_url,created_at,updated_at";
    const hardMax = Math.max(1, Number(maxLimit) || 120);
    const effectiveLimit = Math.max(1, Math.min(Number(limit) || mediaConfig.adminListLimit, hardMax));
    const endpoint =
      `/rest/v1/${encodeURIComponent(mediaConfig.mediaTable)}` +
      `?select=${encodeURIComponent(selectColumns)}` +
      `&order=created_at.desc&limit=${effectiveLimit}`;
    const response = await callSupabase(endpoint, { method: "GET" });
    const payload = await response.json();

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: "Failed to load media list from Supabase.",
        details: payload,
      };
    }

    return { ok: true, items: Array.isArray(payload) ? payload : [] };
  }

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "backend", timestamp: new Date().toISOString() });
  });

  app.get("/api/showcase/media", async (req, res) => {
    try {
      const requestedLimit = toPositiveInt(req.query?.limit, 24);
      const result = await listMediaItems(requestedLimit);
      if (!result.ok) {
        return res.status(result.status).json({
          ok: false,
          message: result.message,
          details: result.details,
        });
      }
      return res.json({ ok: true, items: result.items });
    } catch (error) {
      return res.status(500).json({ ok: false, message: error.message || "Unable to load showcase media." });
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    const username = typeof req.body?.username === "string" ? req.body.username.trim() : "";
    const email =
      typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";

    if (!isValidUsername(username)) {
      return res.status(400).json({
        ok: false,
        message:
          "Username must be 3-32 chars and contain only letters, numbers, dot, underscore, or dash.",
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ ok: false, message: "Please provide a valid email address." });
    }

    if (!isValidPassword(password)) {
      return res
        .status(400)
        .json({ ok: false, message: "Password must be between 8 and 128 characters." });
    }

    try {
      const existing = await dbPool.query(
        "SELECT 1 FROM users WHERE username = $1 OR email = $2 LIMIT 1",
        [username, email]
      );

      if (existing.rowCount > 0) {
        return res.status(409).json({ ok: false, message: "Username or email already exists." });
      }

      const passwordHash = hashPassword(password);
      const insertResult = await dbPool.query(
        `
          INSERT INTO users (username, email, password_hash, role)
          VALUES ($1, $2, $3, 'Viewer')
          RETURNING username, role
        `,
        [username, email, passwordHash]
      );

      const createdUsername = insertResult.rows[0]?.username || username;
      const createdRole = insertResult.rows[0]?.role || "Viewer";
      const session = createSession(createdUsername, createdRole);
      return res.status(201).json({
        ok: true,
        token: session.token,
        expiresAt: new Date(session.expiresAt).toISOString(),
        username: createdUsername,
        role: createdRole,
      });
    } catch (error) {
      if (error && typeof error === "object" && error.code === "23505") {
        return res.status(409).json({ ok: false, message: "Username or email already exists." });
      }
      console.error("Registration failed:", error.message);
      return res.status(500).json({ ok: false, message: "Registration service unavailable" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const username = typeof req.body?.username === "string" ? req.body.username.trim() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";

    if (!username || !password) {
      return res.status(400).json({ ok: false, message: "Username and password are required" });
    }

    const throttleKey = getThrottleKey(req, username);
    if (isLoginBlocked(throttleKey)) {
      return res.status(429).json({
        ok: false,
        message: "Too many login attempts. Please try again later.",
      });
    }

    try {
      const result = await dbPool.query(
        "SELECT username, password_hash, role FROM users WHERE username = $1 LIMIT 1",
        [username]
      );

      if (result.rowCount === 0) {
        registerLoginFailure(throttleKey);
        return res.status(401).json({ ok: false, message: "Invalid username or password" });
      }

      const user = result.rows[0];
      const isPasswordValid = verifyPassword(password, user.password_hash);
      if (!isPasswordValid) {
        registerLoginFailure(throttleKey);
        return res.status(401).json({ ok: false, message: "Invalid username or password" });
      }

      const userRole = user.role || "Viewer";
      const session = createSession(user.username, userRole);
      clearLoginFailures(throttleKey);
      return res.json({
        ok: true,
        token: session.token,
        expiresAt: new Date(session.expiresAt).toISOString(),
        username: user.username,
        role: userRole,
      });
    } catch (error) {
      console.error("Login failed:", error.message);
      return res.status(500).json({ ok: false, message: "Authentication service unavailable" });
    }
  });

  app.get("/api/auth/session", requireAuth, (req, res) => {
    res.json({
      ok: true,
      username: req.auth.username,
      role: req.auth.role,
      expiresAt: new Date(req.auth.expiresAt).toISOString(),
    });
  });

  app.post("/api/auth/logout", requireAuth, (req, res) => {
    sessions.delete(req.auth.token);
    res.json({ ok: true });
  });

  app.get("/api/admin/overview", requireAuth, (req, res) => {
    res.json({
      ok: true,
      message: "Admin area access granted",
      username: req.auth.username,
      role: req.auth.role,
      expiresAt: new Date(req.auth.expiresAt).toISOString(),
    });
  });

  app.get("/api/settings", async (_req, res) => {
    try {
      const result = await readSiteSettings();
      if (!result.ok) {
        return res.status(result.status).json({
          ok: false,
          message: result.message,
          details: result.details,
        });
      }

      return res.json({
        ok: true,
        settings: result.settings,
        source: result.isDefault ? "default" : "supabase",
      });
    } catch (error) {
      return res.status(500).json({ ok: false, message: error.message || "Unable to load settings" });
    }
  });

  app.get("/api/admin/settings", requireAuth, requireRole("Admin"), async (_req, res) => {
    try {
      const result = await readSiteSettings();
      if (!result.ok) {
        return res.status(result.status).json({
          ok: false,
          message: result.message,
          details: result.details,
        });
      }

      return res.json({
        ok: true,
        settings: result.settings,
        source: result.isDefault ? "default" : "supabase",
      });
    } catch (error) {
      return res.status(500).json({ ok: false, message: error.message || "Unable to load settings" });
    }
  });

  app.patch("/api/admin/settings", requireAuth, requireRole("Admin"), async (req, res) => {
    const patchResult = buildSettingsPatch(req.body);
    if (!patchResult.ok) {
      return res.status(400).json({ ok: false, message: patchResult.message });
    }

    try {
      const payload = [
        {
          [settingsConfig.settingsKeyColumn]: settingsConfig.settingsRowKey,
          ...patchResult.patch,
        },
      ];
      const response = await callSupabase(
        `/rest/v1/${encodeURIComponent(settingsConfig.settingsTable)}?on_conflict=${encodeURIComponent(settingsConfig.settingsKeyColumn)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Prefer: "resolution=merge-duplicates,return=representation",
          },
          body: JSON.stringify(payload),
        }
      );
      const responsePayload = await response.json();

      if (!response.ok) {
        return res.status(response.status).json({
          ok: false,
          message: "Failed to save site settings.",
          details: responsePayload,
        });
      }

      const row = Array.isArray(responsePayload) ? responsePayload[0] : null;
      if (!row) {
        return res.status(500).json({ ok: false, message: "Settings save completed with empty response." });
      }

      return res.json({
        ok: true,
        settings: mapSettingsRow(row),
        message: "Settings saved.",
      });
    } catch (error) {
      return res.status(500).json({ ok: false, message: error.message || "Unable to save settings" });
    }
  });

  app.get("/api/admin/media", requireAuth, requireRole("Admin", "Publisher"), async (_req, res) => {
    try {
      const result = await listMediaItems(mediaConfig.adminListLimit, mediaConfig.adminListLimit);
      if (!result.ok) {
        return res.status(result.status).json({
          ok: false,
          message: result.message,
          details: result.details,
        });
      }
      return res.json({ ok: true, items: result.items });
    } catch (error) {
      return res.status(500).json({ ok: false, message: error.message || "Unable to load media list" });
    }
  });

  app.post("/api/admin/media", requireAuth, requireRole("Admin", "Publisher"), async (req, res) => {
    const title = normalizeMediaTitle(req.body?.title);
    const description = normalizeMediaDescription(req.body?.description);
    const fileName = typeof req.body?.fileName === "string" ? req.body.fileName.trim() : "";
    const fileType = typeof req.body?.fileType === "string" ? req.body.fileType.trim().toLowerCase() : "";
    const declaredFileSize = Number(req.body?.fileSize || 0);
    const fileBuffer = parseBase64Payload(req.body?.fileBase64);
    const mediaType = inferMediaType(fileType);

    if (!isValidMediaTitle(title)) {
      return res.status(400).json({ ok: false, message: "Title is required and must be at most 120 characters." });
    }

    if (!isValidMediaDescription(description)) {
      return res.status(400).json({ ok: false, message: "Description must be at most 500 characters." });
    }

    if (!mediaType) {
      return res.status(400).json({
        ok: false,
        message:
          "Unsupported file type. Allowed: image/jpeg, image/png, image/webp, image/gif, video/mp4, video/webm, video/quicktime.",
      });
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      return res.status(400).json({ ok: false, message: "Upload file is missing or invalid." });
    }

    const maxSize = mediaType === "image" ? MAX_IMAGE_SIZE_BYTES : MAX_VIDEO_SIZE_BYTES;
    if (fileBuffer.length > maxSize || declaredFileSize > maxSize) {
      const limitMb = mediaType === "image" ? 10 : 50;
      return res.status(400).json({ ok: false, message: `${mediaType} file exceeds ${limitMb}MB limit.` });
    }

    if (declaredFileSize > 0 && Math.abs(fileBuffer.length - declaredFileSize) > 8) {
      return res.status(400).json({ ok: false, message: "Uploaded file payload is inconsistent." });
    }

    try {
      const safeName = sanitizeObjectName(fileName || `${mediaType}-${Date.now()}`);
      const objectPath = `uploads/${Date.now()}-${randomBytes(6).toString("hex")}-${safeName}`;
      const storagePath = buildSupabaseObjectPath(mediaConfig.storageBucket, objectPath);

      const uploadResponse = await callSupabase(`/storage/v1/object/${storagePath}`, {
        method: "POST",
        headers: {
          "Content-Type": fileType,
          "x-upsert": "false",
        },
        body: fileBuffer,
      });

      if (!uploadResponse.ok) {
        const uploadError = await uploadResponse.text();
        return res.status(uploadResponse.status).json({
          ok: false,
          message: "Failed to upload media to Supabase Storage.",
          details: uploadError,
        });
      }

      const publicPath = buildSupabaseObjectPath(mediaConfig.storageBucket, objectPath);
      const publicUrl = `${mediaConfig.supabaseUrl}/storage/v1/object/public/${publicPath}`;

      const insertResponse = await callSupabase(`/rest/v1/${encodeURIComponent(mediaConfig.mediaTable)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify([
          {
            title,
            description,
            media_type: mediaType,
            public_url: publicUrl,
          },
        ]),
      });

      const insertPayload = await insertResponse.json();
      if (!insertResponse.ok) {
        return res.status(insertResponse.status).json({
          ok: false,
          message: "Media uploaded, but metadata save failed.",
          details: insertPayload,
        });
      }

      const item = Array.isArray(insertPayload) ? insertPayload[0] : insertPayload;
      return res.status(201).json({ ok: true, item });
    } catch (error) {
      return res.status(500).json({ ok: false, message: error.message || "Media upload failed" });
    }
  });

  app.patch("/api/admin/media/:id", requireAuth, requireRole("Admin", "Publisher"), async (req, res) => {
    const id = String(req.params.id || "").trim();
    const hasTitle = Object.prototype.hasOwnProperty.call(req.body || {}, "title");
    const hasDescription = Object.prototype.hasOwnProperty.call(req.body || {}, "description");

    if (!id) {
      return res.status(400).json({ ok: false, message: "Media id is required." });
    }

    if (!hasTitle && !hasDescription) {
      return res.status(400).json({ ok: false, message: "Nothing to update." });
    }

    const patch = {};
    if (hasTitle) {
      const title = normalizeMediaTitle(req.body?.title);
      if (!isValidMediaTitle(title)) {
        return res.status(400).json({ ok: false, message: "Title is required and must be at most 120 characters." });
      }
      patch.title = title;
    }

    if (hasDescription) {
      const description = normalizeMediaDescription(req.body?.description);
      if (!isValidMediaDescription(description)) {
        return res.status(400).json({ ok: false, message: "Description must be at most 500 characters." });
      }
      patch.description = description;
    }

    patch.updated_at = new Date().toISOString();

    try {
      const response = await callSupabase(
        `/rest/v1/${encodeURIComponent(mediaConfig.mediaTable)}?id=eq.${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify(patch),
        }
      );

      const payload = await response.json();
      if (!response.ok) {
        return res.status(response.status).json({
          ok: false,
          message: "Failed to update media metadata.",
          details: payload,
        });
      }

      const item = Array.isArray(payload) ? payload[0] : null;
      if (!item) {
        return res.status(404).json({ ok: false, message: "Media item not found." });
      }

      return res.json({ ok: true, item });
    } catch (error) {
      return res.status(500).json({ ok: false, message: error.message || "Media update failed" });
    }
  });

  app.delete("/api/admin/media/:id", requireAuth, requireRole("Admin", "Publisher"), async (req, res) => {
    const id = String(req.params.id || "").trim();
    if (!id) {
      return res.status(400).json({ ok: false, message: "Media id is required." });
    }

    try {
      const lookupResponse = await callSupabase(
        `/rest/v1/${encodeURIComponent(mediaConfig.mediaTable)}?id=eq.${encodeURIComponent(id)}&select=id,public_url&limit=1`,
        { method: "GET" }
      );
      const lookupPayload = await lookupResponse.json();
      if (!lookupResponse.ok) {
        return res.status(lookupResponse.status).json({
          ok: false,
          message: "Failed to look up media item.",
          details: lookupPayload,
        });
      }
      const existing = Array.isArray(lookupPayload) ? lookupPayload[0] : null;
      if (!existing) {
        return res.status(404).json({ ok: false, message: "Media item not found." });
      }

      const storageDeletePath = resolveStorageDeletePathFromPublicUrl(
        existing.public_url,
        mediaConfig.supabaseUrl,
        mediaConfig.storageBucket
      );
      if (!storageDeletePath) {
        return res.status(400).json({
          ok: false,
          message: "Media public URL does not match configured storage bucket.",
        });
      }

      const storageResponse = await callSupabase(`/storage/v1/object/${storageDeletePath}`, {
        method: "DELETE",
      });
      if (!storageResponse.ok && storageResponse.status !== 404) {
        const storageError = await storageResponse.text();
        return res.status(storageResponse.status).json({
          ok: false,
          message: "Failed to delete storage object.",
          details: storageError,
        });
      }

      const deleteResponse = await callSupabase(
        `/rest/v1/${encodeURIComponent(mediaConfig.mediaTable)}?id=eq.${encodeURIComponent(id)}`,
        { method: "DELETE", headers: { Prefer: "return=representation" } }
      );
      const deletePayload = await deleteResponse.json().catch(() => null);
      if (!deleteResponse.ok) {
        return res.status(deleteResponse.status).json({
          ok: false,
          message: "Failed to delete media metadata.",
          details: deletePayload,
        });
      }

      return res.json({ ok: true, id });
    } catch (error) {
      return res.status(500).json({ ok: false, message: error.message || "Media delete failed" });
    }
  });

  function mapSupabaseUser(raw, profileRole) {
    if (!raw || typeof raw !== "object") return null;
    return {
      id: String(raw.id || ""),
      email: String(raw.email || ""),
      role: normalizeRole(profileRole),
      created_at: raw.created_at || null,
    };
  }

  async function readProfilesByUserIds(userIds) {
    const uniqueIds = Array.from(
      new Set((Array.isArray(userIds) ? userIds : []).map((id) => String(id || "").trim()).filter(Boolean))
    );

    if (uniqueIds.length === 0) {
      return new Map();
    }

    const inFilter = `(${uniqueIds.map((id) => `"${id.replace(/"/g, "")}"`).join(",")})`;
    const endpoint =
      `/rest/v1/profiles?id=in.${encodeURIComponent(inFilter)}` +
      `&select=${encodeURIComponent("id,role")}&limit=${uniqueIds.length}`;
    const response = await callSupabase(endpoint, { method: "GET" });
    if (!response.ok) {
      return new Map();
    }

    const payload = await response.json();
    const roleMap = new Map();
    for (const row of Array.isArray(payload) ? payload : []) {
      const id = String(row?.id || "").trim();
      if (!id) {
        continue;
      }
      roleMap.set(id, normalizeRole(row?.role));
    }
    return roleMap;
  }

  async function upsertProfileRole(userId, role) {
    const cleanUserId = String(userId || "").trim();
    const normalizedRole = normalizeRole(role);
    const response = await callSupabase("/rest/v1/profiles?on_conflict=id", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify([{ id: cleanUserId, role: normalizedRole }]),
    });
    const payload = await response.json();
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: "Failed to update role in profiles.",
        details: payload,
      };
    }

    const row = Array.isArray(payload) ? payload[0] : null;
    if (!row || !String(row.id || "").trim()) {
      return { ok: false, status: 500, message: "Role update completed with empty profile response." };
    }

    return {
      ok: true,
      profile: {
        id: String(row.id).trim(),
        role: normalizeRole(row.role),
      },
    };
  }

  async function readSupabaseUsers() {
    const response = await callSupabase("/auth/v1/admin/users?per_page=200", { method: "GET" });
    const payload = await response.json();
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: "Failed to load users from Supabase.",
      };
    }

    const rawUsers = Array.isArray(payload?.users) ? payload.users : Array.isArray(payload) ? payload : [];
    const userIds = rawUsers.map((user) => String(user?.id || "").trim()).filter(Boolean);
    const profileRoles = await readProfilesByUserIds(userIds);
    const users = rawUsers
      .map((user) => mapSupabaseUser(user, profileRoles.get(String(user?.id || "").trim())))
      .filter(Boolean);
    return { ok: true, users };
  }

  function hasAdminUser(users) {
    return Array.isArray(users) && users.some((user) => user && user.role === "Admin");
  }

  app.get("/api/admin/bootstrap/status", requireAuth, async (req, res) => {
    try {
      ensureSupabaseConfig();
      const usersResult = await readSupabaseUsers();
      if (!usersResult.ok) {
        return res
          .status(usersResult.status)
          .json({ ok: false, message: usersResult.message || "Failed to load users." });
      }

      const hasAdmin = hasAdminUser(usersResult.users);
      return res.json({
        ok: true,
        currentRole: req.auth.role || "Viewer",
        hasAdmin,
        canClaimAdmin: !hasAdmin,
      });
    } catch (error) {
      return res.status(500).json({ ok: false, message: error.message || "Failed to load bootstrap status." });
    }
  });

  app.post("/api/admin/bootstrap/claim", requireAuth, async (req, res) => {
    try {
      ensureSupabaseConfig();
      const usersResult = await readSupabaseUsers();
      if (!usersResult.ok) {
        return res
          .status(usersResult.status)
          .json({ ok: false, message: usersResult.message || "Failed to load users." });
      }

      if (hasAdminUser(usersResult.users)) {
        return res.status(409).json({
          ok: false,
          message: "Admin account already exists. Ask an existing admin to assign your role.",
        });
      }

      const authUserId = String(req.auth?.userId || "").trim();
      if (!authUserId) {
        return res.status(400).json({
          ok: false,
          message: "Current session is not linked to a Supabase user id.",
        });
      }

      const updateResult = await upsertProfileRole(authUserId, "Admin");
      if (!updateResult.ok) {
        return res
          .status(updateResult.status)
          .json({ ok: false, message: updateResult.message, details: updateResult.details });
      }

      return res.json({
        ok: true,
        user: {
          id: updateResult.profile.id,
          email: req.auth.username || "",
          role: updateResult.profile.role,
          created_at: null,
        },
        message: "Admin role granted.",
      });
    } catch (error) {
      return res.status(500).json({ ok: false, message: error.message || "Failed to claim admin role." });
    }
  });

  app.get("/api/admin/users", requireAuth, requireRole("Admin"), async (_req, res) => {
    try {
      ensureSupabaseConfig();
      const usersResult = await readSupabaseUsers();
      if (!usersResult.ok) {
        return res
          .status(usersResult.status)
          .json({ ok: false, message: usersResult.message || "Failed to load users from Supabase." });
      }
      return res.json({ ok: true, users: usersResult.users });
    } catch (error) {
      return res.status(500).json({ ok: false, message: error.message || "Failed to load users" });
    }
  });

  app.patch("/api/admin/users/:id/role", requireAuth, requireRole("Admin"), async (req, res) => {
    const id = String(req.params.id || "").trim();
    const role = typeof req.body?.role === "string" ? req.body.role.trim() : "";

    if (!id) {
      return res.status(400).json({ ok: false, message: "User id is required." });
    }

    if (!VALID_ROLES.has(role)) {
      return res.status(400).json({ ok: false, message: "Role must be Admin, Publisher, or Viewer." });
    }

    try {
      ensureSupabaseConfig();
      const updateResult = await upsertProfileRole(id, role);
      if (!updateResult.ok) {
        return res
          .status(updateResult.status)
          .json({ ok: false, message: updateResult.message, details: updateResult.details });
      }

      const usersResult = await readSupabaseUsers();
      if (!usersResult.ok) {
        return res.status(usersResult.status).json({
          ok: false,
          message: usersResult.message || "Role updated, but failed to load user snapshot.",
        });
      }
      const user = usersResult.users.find((item) => item.id === id);

      return res.json({
        ok: true,
        user: user || { id, email: "", role: updateResult.profile.role, created_at: null },
      });
    } catch (error) {
      return res.status(500).json({ ok: false, message: error.message || "Failed to update role" });
    }
  });

  app.get("/api/db-check", async (_req, res) => {
    try {
      const result = await dbPool.query("SELECT NOW() AS server_time");
      res.json({ ok: true, dbTime: result.rows[0].server_time });
    } catch (error) {
      res.status(500).json({ ok: false, message: "Database connection failed", error: error.message });
    }
  });

  return app;
}

function startServer() {
  const app = createApp();
  app.listen(PORT, () => {
    console.log(`Backend running on http://localhost:${PORT}`);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = {
  DEFAULT_SITE_SETTINGS,
  MAX_IMAGE_SIZE_BYTES,
  MAX_VIDEO_SIZE_BYTES,
  createApp,
  inferMediaType,
  hasUnsafeControlChars,
  isValidEmail,
  isValidMediaDescription,
  isValidMediaTitle,
  isValidPassword,
  isValidUsername,
  normalizeSettingText,
  parseBase64Payload,
  parseBearerToken,
  sanitizeObjectName,
  startServer,
  VALID_ROLES: new Set(VALID_ROLES),
  ASSIGNABLE_ROLES: ["Admin", "Publisher", "Viewer"],
};
