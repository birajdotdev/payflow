import { test } from "node:test";
import assert from "node:assert/strict";
import { signupSchema } from "../src/lib/validation/auth/signup-schema";
import { loginSchema } from "../src/lib/validation/auth/login-schema";
const valid = {
  fullName: "Demo User",
  email: "demo@example.com",
  phone: "+9779812345678",
  password: "simple passphrase",
};
test("normalizes identity fields and preserves password exactly", () => {
  const password = "  passphrase  ";
  assert.deepEqual(
    signupSchema.parse({
      ...valid,
      fullName: "  Demo User  ",
      email: " DEMO@EXAMPLE.COM ",
      phone: " +9779812345678 ",
      password,
    }),
    { ...valid, password }
  );
  assert.equal(
    loginSchema.parse({ email: " DEMO@EXAMPLE.COM ", password }).password,
    password
  );
});
test("accepts international phone format and rejects incompatible local-only/spaced numbers", () => {
  for (const phone of [
    "9812345678",
    "+977 9812345678",
    "+012345678",
    "+1234567",
    "+1234567890123456",
  ])
    assert.equal(signupSchema.safeParse({ ...valid, phone }).success, false);
  for (const phone of ["+12345678", "+123456789012345"])
    assert.equal(signupSchema.safeParse({ ...valid, phone }).success, true);
});
test("enforces code-point minimum and BCrypt byte maximum without arbitrary complexity rules", () => {
  for (const password of ["abcdefgh", "é".repeat(36), "😀".repeat(8)])
    assert.equal(signupSchema.safeParse({ ...valid, password }).success, true);
  for (const password of [
    "abcdefg",
    "😀".repeat(7),
    "é".repeat(37),
    "a".repeat(73),
    "        ",
    "\u3000".repeat(8),
  ])
    assert.equal(signupSchema.safeParse({ ...valid, password }).success, false);
});
test("rejects blank and oversized names and malformed emails", () => {
  for (const fullName of ["   ", "a".repeat(101)])
    assert.equal(signupSchema.safeParse({ ...valid, fullName }).success, false);
  assert.equal(
    signupSchema.safeParse({ ...valid, email: "bad-email" }).success,
    false
  );
});
