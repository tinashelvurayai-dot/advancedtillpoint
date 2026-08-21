// Manager access codes are never stored in plain text in the bundle.
// Only salted SHA-256 digests ship; verification works fully offline.
const SALT = "tillpoint:";

const CODE_1_HASH = "357175fe2fd0173496df156624ce3912394da6a6fbff53e231470cdc6f2af990";
const CODE_2_HASH = "7895b539c07a1867caba60482b2ff9626ee02dfaf5d5812f61451520b49bc4fe";

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(SALT + value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time-ish comparison of two hex digests. */
function equals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyManagerCodes(code1: string, code2: string): Promise<boolean> {
  try {
    const [h1, h2] = await Promise.all([
      sha256Hex(code1.trim().toUpperCase()),
      sha256Hex(code2.trim().toUpperCase()),
    ]);
    return equals(h1, CODE_1_HASH) && equals(h2, CODE_2_HASH);
  } catch {
    return false;
  }
}
