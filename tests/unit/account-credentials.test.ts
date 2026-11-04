import { describe, expect, it } from "vitest";
import {
  decryptAccountPassword,
  encryptAccountPassword,
} from "../../workers/api/src/lib/account-credentials";

const encryptionKey = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

describe("account password encryption", () => {
  it("encrypts passwords with a fresh nonce and round-trips the exact value", async () => {
    const password = "  caseSensitive password  ";
    const first = await encryptAccountPassword(password, encryptionKey);
    const second = await encryptAccountPassword(password, encryptionKey);

    expect(first).not.toBeNull();
    expect(first).not.toBe(second);
    expect(first).not.toContain(password);
    await expect(decryptAccountPassword(first!, encryptionKey)).resolves.toBe(password);
  });

  it("does not encrypt or decrypt without a valid 256-bit key", async () => {
    await expect(encryptAccountPassword("secret", undefined)).resolves.toBeNull();
    await expect(encryptAccountPassword("secret", "invalid")).resolves.toBeNull();
    await expect(decryptAccountPassword("v1.invalid", undefined)).resolves.toBeNull();
  });
});
