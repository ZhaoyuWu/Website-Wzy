require("dotenv").config();
const { Client } = require("pg");
const { hashPassword } = require("../src/password");

const host = process.env.DB_HOST || "localhost";
const port = Number(process.env.DB_PORT || 5432);
const user = process.env.DB_USER || "postgres";
const password = process.env.DB_PASSWORD || "postgres";
const appDb = process.env.DB_NAME || "website1st";
const adminDb = process.env.DB_ADMIN_DB || "postgres";
const defaultAdminUsername = process.env.ADMIN_USERNAME || "admin";
const defaultAdminPassword = process.env.ADMIN_PASSWORD;
const defaultAdminEmail = process.env.ADMIN_EMAIL || "admin@nanami.local";

function validateAdminPassword(adminPassword) {
  if (!adminPassword) {
    throw new Error("ADMIN_PASSWORD is required for db:init. Refusing weak default bootstrap.");
  }

  if (adminPassword.length < 12) {
    throw new Error("ADMIN_PASSWORD must be at least 12 characters.");
  }

  const hasUpper = /[A-Z]/.test(adminPassword);
  const hasLower = /[a-z]/.test(adminPassword);
  const hasNumber = /\d/.test(adminPassword);
  const hasSymbol = /[^A-Za-z0-9]/.test(adminPassword);
  if (!hasUpper || !hasLower || !hasNumber || !hasSymbol) {
    throw new Error(
      "ADMIN_PASSWORD must include uppercase, lowercase, number, and symbol characters."
    );
  }
}

async function ensureDatabase() {
  const adminClient = new Client({
    host,
    port,
    user,
    password,
    database: adminDb,
  });

  await adminClient.connect();
  const checkDb = await adminClient.query("SELECT 1 FROM pg_database WHERE datname = $1", [appDb]);
  if (checkDb.rowCount === 0) {
    await adminClient.query(`CREATE DATABASE "${appDb}"`);
    console.log(`Database created: ${appDb}`);
  } else {
    console.log(`Database already exists: ${appDb}`);
  }
  await adminClient.end();
}

async function ensureSchema() {
  const appClient = new Client({
    host,
    port,
    user,
    password,
    database: appDb,
  });

  await appClient.connect();
  await appClient.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      email VARCHAR(120) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'Viewer' CHECK (role IN ('Admin', 'Publisher', 'Viewer')),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await appClient.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'Viewer'
      CHECK (role IN ('Admin', 'Publisher', 'Viewer'));
  `);
  console.log("Schema ready: users table");

  const passwordHash = hashPassword(defaultAdminPassword);
  await appClient.query(
    `
      INSERT INTO users (username, email, password_hash, role)
      VALUES ($1, $2, $3, 'Admin')
      ON CONFLICT (username)
      DO UPDATE SET
        email = EXCLUDED.email,
        password_hash = EXCLUDED.password_hash,
        role = 'Admin'
    `,
    [defaultAdminUsername, defaultAdminEmail, passwordHash]
  );
  console.log(`Default admin ensured: ${defaultAdminUsername} (role=Admin)`);

  await appClient.end();
}

async function main() {
  try {
    validateAdminPassword(defaultAdminPassword);
    await ensureDatabase();
    await ensureSchema();
    console.log("Database initialization complete.");
  } catch (error) {
    console.error("Database initialization failed:", error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  validateAdminPassword,
  ensureDatabase,
  ensureSchema,
  main,
};
