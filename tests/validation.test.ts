import assert from "node:assert/strict";
import test from "node:test";
import { validateAvatarUrl, validatePlayerName } from "../src/lib/validation";

test("normalizes player names and rejects invalid values", () => {
  assert.deepEqual(validatePlayerName("  Jane   Doe  "), { value: "Jane Doe" });
  assert.equal(validatePlayerName("   ").error, "Name is required");
  assert.ok(validatePlayerName("x".repeat(51)).error);
});

test("accepts only http and https avatar URLs", () => {
  assert.deepEqual(validateAvatarUrl("https://example.com/avatar.png"), {
    value: "https://example.com/avatar.png",
  });
  assert.deepEqual(validateAvatarUrl(""), { value: null });
  assert.ok(validateAvatarUrl("javascript:alert(1)").error);
  assert.ok(validateAvatarUrl("not a url").error);
});
