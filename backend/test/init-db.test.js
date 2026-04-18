const test = require("node:test");
const assert = require("node:assert/strict");

const { validateAdminPassword } = require("../scripts/init-db");

test("validateAdminPassword rejects missing password", () => {
  assert.throws(
    () => validateAdminPassword(""),
    /ADMIN_PASSWORD is required/
  );
});

test("validateAdminPassword rejects weak password", () => {
  assert.throws(
    () => validateAdminPassword("admin123456"),
    /must be at least 12 characters|must include uppercase/
  );
});

test("validateAdminPassword accepts strong password", () => {
  assert.doesNotThrow(() => validateAdminPassword("NanaMi2026!Secure"));
});
