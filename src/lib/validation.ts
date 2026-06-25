export const MAX_PLAYER_NAME_LENGTH = 50;
export const MAX_AVATAR_URL_LENGTH = 2048;

export function validatePlayerName(value: unknown): { value?: string; error?: string } {
  if (typeof value !== "string") return { error: "Name is required" };

  const name = value.trim().replace(/\s+/g, " ");
  if (!name) return { error: "Name is required" };
  if (name.length > MAX_PLAYER_NAME_LENGTH) {
    return { error: `Name must be ${MAX_PLAYER_NAME_LENGTH} characters or fewer` };
  }

  return { value: name };
}

export function validateAvatarUrl(value: unknown): { value?: string | null; error?: string } {
  if (value == null || value === "") return { value: null };
  if (typeof value !== "string") return { error: "Avatar URL must be a string" };

  const avatar = value.trim();
  if (!avatar) return { value: null };
  if (avatar.length > MAX_AVATAR_URL_LENGTH) return { error: "Avatar URL is too long" };

  try {
    const url = new URL(avatar);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return { error: "Avatar URL must use http or https" };
    }
  } catch {
    return { error: "Avatar URL is invalid" };
  }

  return { value: avatar };
}
