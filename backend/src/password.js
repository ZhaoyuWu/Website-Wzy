const crypto = require("crypto");

const HASH_PREFIX = "scrypt";
const KEY_LENGTH = 64;

function hashPassword(plainPassword) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(plainPassword, salt, KEY_LENGTH).toString("hex");
  return `${HASH_PREFIX}$${salt}$${derivedKey}`;
}

function verifyPassword(plainPassword, storedHash) {
  if (typeof storedHash !== "string") {
    return false;
  }

  const [prefix, salt, expectedHex] = storedHash.split("$");
  if (prefix !== HASH_PREFIX || !salt || !expectedHex) {
    return false;
  }

  const actualHex = crypto.scryptSync(plainPassword, salt, KEY_LENGTH).toString("hex");
  const expectedBuffer = Buffer.from(expectedHex, "hex");
  const actualBuffer = Buffer.from(actualHex, "hex");

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

module.exports = {
  hashPassword,
  verifyPassword,
};
