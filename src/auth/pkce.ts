/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Generates a high-entropy cryptographically secure random string.
 * Used for both authorization state and the PKCE code verifier.
 */
export function generateRandomString(length: number): string {
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const values = new Uint8Array(length);
  crypto.getRandomValues(values);
  return Array.from(values)
    .map((x) => possible[x % possible.length])
    .join("");
}

/**
 * Calculates the SHA-256 digest of a plain string.
 */
export async function sha256(plain: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return crypto.subtle.digest("SHA-256", data);
}

/**
 * Base64 URL encodes an array buffer (removes padding, replaces + with - and / with _).
 */
export function base64urlencode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Creates a PKCE code challenge from a code verifier.
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const hashed = await sha256(verifier);
  return base64urlencode(hashed);
}
