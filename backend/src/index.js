require("dotenv").config();

const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const defaultPool = require("./db");
const { verifyPassword } = require("./password");

const PORT = Number(process.env.PORT || 4000);

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

function createApp(options = {}) {
  const dbPool = options.dbPool || defaultPool;
  const sessionTtlMs = Number(process.env.SESSION_TTL_MS || 1000 * 60 * 60 * 8);
  const loginAttemptWindowMs = Number(process.env.LOGIN_ATTEMPT_WINDOW_MS || 10 * 60 * 1000);
  const loginAttemptMax = Number(process.env.LOGIN_ATTEMPT_MAX || 5);
  const loginBlockMs = Number(process.env.LOGIN_BLOCK_MS || 15 * 60 * 1000);
  const now = typeof options.now === "function" ? options.now : Date.now;
  const randomBytes = options.randomBytes || crypto.randomBytes;
  const sessions = new Map();
  const loginAttempts = new Map();
  const app = express();

  app.use(cors(buildCorsOptions()));
  app.use(express.json());

  function createSession(username) {
    const token = randomBytes(32).toString("hex");
    const expiresAt = now() + sessionTtlMs;
    sessions.set(token, { username, expiresAt });
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

  function requireAuth(req, res, next) {
    clearExpiredSessions();
    const token = parseBearerToken(req.headers.authorization);
    const session = token ? sessions.get(token) : null;

    if (!session) {
      return res.status(401).json({ ok: false, message: "Authentication required" });
    }

    req.auth = { token, username: session.username, expiresAt: session.expiresAt };
    return next();
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

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "backend", timestamp: new Date().toISOString() });
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
        "SELECT username, password_hash FROM users WHERE username = $1 LIMIT 1",
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

      const session = createSession(user.username);
      clearLoginFailures(throttleKey);
      return res.json({
        ok: true,
        token: session.token,
        expiresAt: new Date(session.expiresAt).toISOString(),
        username: user.username,
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
      expiresAt: new Date(req.auth.expiresAt).toISOString(),
    });
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
  createApp,
  parseBearerToken,
  startServer,
};
