// A share token is 128 random bits in base64url: 22 characters (see SavedPlanService on the backend).
const TOKEN = /^[A-Za-z0-9_-]{22}$/;

/**
 * The token in a share link, from whatever the user pasted: the full link (with or without https://, a
 * trailing slash or extra text around it) or only the token. Null when it isn't a LinkUp share link.
 */
export function parseShareToken(input: string): string | null {
  const text = input.trim();
  if (TOKEN.test(text)) return text;
  const match = /\/plan\/([A-Za-z0-9_-]{22})(?![A-Za-z0-9_-])/.exec(text);
  return match ? match[1] : null;
}
