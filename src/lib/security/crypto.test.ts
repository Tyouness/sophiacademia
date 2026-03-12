import { describe, expect, it } from "vitest";
import { decryptSensitive, encryptSensitive } from "@/lib/security/crypto";

describe("crypto helpers", () => {
  it("encrypts and decrypts fiscal values", () => {
    process.env.FISCAL_ENCRYPTION_KEY = "test-key";
    const value = "12345678901234";
    const encrypted = encryptSensitive(value);
    expect(encrypted).not.toBe(value);
    expect(decryptSensitive(encrypted)).toBe(value);
  });
});
