const keyLength = 32;
const nonceLength = 12;

function decodeKey(encodedKey: string | undefined): Uint8Array | null {
  if (!encodedKey || !/^[A-Za-z0-9+/]{43}=$/.test(encodedKey)) return null;

  const decoded = atob(encodedKey);
  if (decoded.length !== keyLength) return null;
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

async function importKey(encodedKey: string | undefined): Promise<CryptoKey | null> {
  const rawKey = decodeKey(encodedKey);
  if (!rawKey) return null;
  return crypto.subtle.importKey("raw", rawKey, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encryptAccountPassword(
  password: string,
  encodedKey: string | undefined,
): Promise<string | null> {
  const key = await importKey(encodedKey);
  if (!key) return null;

  const nonce = crypto.getRandomValues(new Uint8Array(nonceLength));
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, new TextEncoder().encode(password)),
  );
  const combined = new Uint8Array(nonce.length + encrypted.length);
  combined.set(nonce);
  combined.set(encrypted, nonce.length);
  return `v1.${btoa(String.fromCharCode(...combined))}`;
}

export async function decryptAccountPassword(
  encryptedPassword: string,
  encodedKey: string | undefined,
): Promise<string | null> {
  const key = await importKey(encodedKey);
  if (!key) return null;

  const [version, encoded] = encryptedPassword.split(".");
  if (version !== "v1" || !encoded) throw new Error("Unsupported account credential format.");
  const combined = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
  if (combined.length <= nonceLength) throw new Error("Invalid account credential ciphertext.");
  const nonce = combined.slice(0, nonceLength);
  const ciphertext = combined.slice(nonceLength);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, key, ciphertext);
  return new TextDecoder().decode(decrypted);
}
