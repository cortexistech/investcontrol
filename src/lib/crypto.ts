import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;

  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "ENCRYPTION_KEY não definida. Gere uma com `openssl rand -base64 32` e defina no .env (veja .env.example)."
    );
  }

  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      "ENCRYPTION_KEY inválida: deve decodificar para 32 bytes em base64. Gere uma nova com `openssl rand -base64 32`."
    );
  }

  cachedKey = key;
  return key;
}

/** Encrypts a UTF-8 string with AES-256-GCM. Returns base64 of iv || authTag || ciphertext. */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

/** Decrypts a payload produced by encrypt(). Throws if the key or ciphertext don't match (tampering/corruption). */
export function decrypt(payload: string): string {
  const raw = Buffer.from(payload, "base64");
  const iv = raw.subarray(0, IV_LENGTH);
  const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = raw.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, getKey(), iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}

/**
 * Like decrypt(), but tolerates rows written before a field became encrypted (or restored from a
 * pre-encryption backup): if the payload isn't valid AES-256-GCM ciphertext for the current key,
 * it's returned unchanged with `needsRewrite: true` so the caller can persist the encrypted
 * version back — a one-time, self-healing migration applied the first time each row is read.
 * GCM's auth tag makes a false positive (plaintext that looks like valid ciphertext) astronomically
 * unlikely, so this fallback is safe even though it can't cryptographically prove the row is legacy.
 */
export function decryptLegacy(payload: string): { value: string; needsRewrite: boolean } {
  try {
    return { value: decrypt(payload), needsRewrite: false };
  } catch {
    return { value: payload, needsRewrite: true };
  }
}

/**
 * Decrypts a field that decodes to a number (a stored amount/limit/balance). `rewrite` is the
 * freshly-encrypted ciphertext to persist when the row was still on the legacy plaintext format —
 * `null` when it was already encrypted, so callers can skip the write-back entirely.
 */
export function decryptMoney(payload: string): { amount: number; rewrite: string | null } {
  const { value, needsRewrite } = decryptLegacy(payload);
  return { amount: Number(value), rewrite: needsRewrite ? encrypt(value) : null };
}

/** Same idea as decryptMoney(), for a plain text field (name, description, notes, tags...). */
export function decryptText(payload: string): { text: string; rewrite: string | null } {
  const { value, needsRewrite } = decryptLegacy(payload);
  return { text: value, rewrite: needsRewrite ? encrypt(value) : null };
}
