import { describe, expect, it } from "vitest";
import {
  decryptAccountPassword,
  encryptAccountPassword,
} from "../../workers/api/src/lib/account-credentials";

const encryptionKey = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
const userId = "11111111-1111-4111-8111-111111111111";
const accountId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("account password encryption", () => {
  it("encrypts passwords with a fresh nonce and round-trips the exact value", async () => {
    const password = "  caseSensitive password  ";
    const first = await encryptAccountPassword(password, encryptionKey, userId, accountId);
    const second = await encryptAccountPassword(password, encryptionKey, userId, accountId);

    expect(first).not.toBeNull();
    expect(first).not.toBe(second);
    expect(first).not.toContain(password);
    if (first === null) throw new Error("Encryption unexpectedly failed.");
    await expect(decryptAccountPassword(first, encryptionKey, userId, accountId)).resolves.toBe(
      password,
    );
    await expect(
      decryptAccountPassword(first, encryptionKey, userId, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"),
    ).rejects.toThrow();
  });

  it("does not encrypt or decrypt without a valid 256-bit key", async () => {
    await expect(
      encryptAccountPassword("secret", undefined, userId, accountId),
    ).resolves.toBeNull();
    await expect(
      encryptAccountPassword("secret", "invalid", userId, accountId),
    ).resolves.toBeNull();
    await expect(
      decryptAccountPassword("v1.invalid", undefined, userId, accountId),
    ).resolves.toBeNull();
  });
});
