import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { getEnv } from "@/lib/env";

/**
 * Authenticated encryption (AES-256-GCM) for cookie payloads.
 *
 * The session cookie holds Spotify tokens, so it must be both unreadable
 * (encryption) and tamper-proof (the GCM auth tag). The browser only ever
 * sees an opaque string.
 *
 * Format: "v1.<base64url(iv | authTag | ciphertext)>"
 * The version prefix lets us rotate the scheme later without breaking parsing.
 */

const VERSION = "v1";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function key(): Buffer {
  // Derive a fixed-length 256-bit key from the configured secret.
  return createHash("sha256").update(getEnv().sessionSecret).digest();
}

export function seal(data: unknown): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const plaintext = Buffer.from(JSON.stringify(data), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSION}.${Buffer.concat([iv, tag, ciphertext]).toString("base64url")}`;
}

/** Returns the decrypted payload, or null if the value is missing, malformed, or tampered with. */
export function unseal<T>(sealed: string | undefined): T | null {
  if (!sealed) return null;
  const [version, body] = sealed.split(".");
  if (version !== VERSION || !body) return null;

  try {
    const raw = Buffer.from(body, "base64url");
    const iv = raw.subarray(0, IV_LENGTH);
    const tag = raw.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const ciphertext = raw.subarray(IV_LENGTH + TAG_LENGTH);
    const decipher = createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return JSON.parse(plaintext.toString("utf8")) as T;
  } catch {
    return null;
  }
}
