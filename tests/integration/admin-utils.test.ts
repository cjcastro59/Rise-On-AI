/**
 * Integration Tests — app/api/admin/distress-alerts/_utils.ts
 * =============================================================
 * Tests the UUID validation helper and the isValidUUID guard that protects
 * both /assign and /review admin routes from injection-style params.
 *
 * TC-ADMIN-01 to TC-ADMIN-10
 *
 * NOTE: getAuthorizedAdminClient() requires a live Supabase session and is
 * therefore marked as system-test level (not run in unit CI).
 * Only isValidUUID is tested here — it is a pure function.
 */

import { describe, it, expect } from "vitest";
import { isValidUUID } from "@/app/api/admin/distress-alerts/_utils";

describe("isValidUUID", () => {
  // ── Valid UUIDs ─────────────────────────────────────────────────────────────
  it("TC-ADMIN-01 | standard v4 UUID lowercase → true", () => {
    expect(isValidUUID("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
  });

  it("TC-ADMIN-02 | v4 UUID uppercase → true (case-insensitive)", () => {
    expect(isValidUUID("550E8400-E29B-41D4-A716-446655440000")).toBe(true);
  });

  it("TC-ADMIN-03 | another valid v4 UUID", () => {
    expect(isValidUUID("a8098c1a-f86e-11da-bd1a-00112444be1e")).toBe(false); // v1 not v4
  });

  it("TC-ADMIN-04 | v4 UUID (version digit=4, variant=[89ab]) → true; v1 UUIDs → false", () => {
    // v1 (version digit = 1) — must be false
    expect(isValidUUID("6ba7b810-9dad-11d1-80b4-00c04fd430c8")).toBe(false);
    // v4 (version digit = 4, variant = 8 which matches [89ab]) — must be true
    expect(isValidUUID("6ba7b814-9dad-41d1-80b4-00c04fd430c8")).toBe(true);
    // Another valid v4
    expect(isValidUUID("550e8400-e29b-4ed4-a716-446655440000")).toBe(true);
  });

  // ── Invalid UUIDs (injection / malformed) ───────────────────────────────────
  it("TC-ADMIN-05 | empty string → false", () => {
    expect(isValidUUID("")).toBe(false);
  });

  it("TC-ADMIN-06 | SQL injection payload → false", () => {
    expect(isValidUUID("'; DROP TABLE distress_logs; --")).toBe(false);
  });

  it("TC-ADMIN-07 | path traversal → false", () => {
    expect(isValidUUID("../../etc/passwd")).toBe(false);
  });

  it("TC-ADMIN-08 | too short → false", () => {
    expect(isValidUUID("550e8400-e29b")).toBe(false);
  });

  it("TC-ADMIN-09 | missing hyphens → false", () => {
    expect(isValidUUID("550e8400e29b41d4a716446655440000")).toBe(false);
  });

  it("TC-ADMIN-10 | unicode payload → false", () => {
    expect(isValidUUID("550e8400-e29b-4\u0000d4-a716-446655440000")).toBe(false);
  });
});
