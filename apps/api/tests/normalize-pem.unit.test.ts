import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizePemKey } from "../src/config/normalize-pem";

const samplePublicBody = "MCowBQYDK2VwAyEAt69kQ6Ghfj9F+t0q7TvRZHRbf4AZ03ykPpoOCiR5JaQ=";

test("normalizePemKey reformats a single-line PUBLIC KEY", () => {
  const oneLine = `-----BEGIN PUBLIC KEY-----${samplePublicBody}-----END PUBLIC KEY-----`;
  const normalized = normalizePemKey(oneLine);
  assert.equal(
    normalized,
    `-----BEGIN PUBLIC KEY-----\n${samplePublicBody}\n-----END PUBLIC KEY-----\n`,
  );
});

test("normalizePemKey expands literal \\n sequences", () => {
  const escaped = `-----BEGIN PUBLIC KEY-----\\n${samplePublicBody}\\n-----END PUBLIC KEY-----\\n`;
  const normalized = normalizePemKey(escaped);
  assert.ok(normalized.includes(`\n${samplePublicBody}\n`));
});

test("normalizePemKey leaves well-formed PEM unchanged (aside from trailing newline)", () => {
  const formatted = `-----BEGIN PUBLIC KEY-----\n${samplePublicBody}\n-----END PUBLIC KEY-----`;
  assert.equal(normalizePemKey(formatted), `${formatted}\n`);
});