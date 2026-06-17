import { config, normalizeProductName } from "../config.js";

const API_BASE = "https://discord.com/api/v10";

// Returns the configured Discord channel id for a product, or null if this
// product is not enrolled in the auto-invite program yet.
export function discordChannelForProduct(product) {
  if (!product) return null;
  const key = normalizeProductName(product);
  return config.discord.productChannels[key] || null;
}

// True only when a product is mapped AND we have a bot token to call the API.
export function discordEnabledForProduct(product) {
  return Boolean(config.discord.botToken && discordChannelForProduct(product));
}

// Creates a brand-new, single-use, time-limited invite for a specific channel.
// Discord enforces both rules server-side:
//   - max_age  -> the link stops working after N seconds (default 30 days)
//   - max_uses -> the link is invalidated after the first person joins (default 1)
// so a leaked link can't be reused by a non-enrolled person.
export async function createUniqueInvite(channelId, { reason } = {}) {
  if (!config.discord.botToken) {
    throw new Error("DISCORD_BOT_TOKEN is not set");
  }

  const res = await fetch(`${API_BASE}/channels/${channelId}/invites`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${config.discord.botToken}`,
      "Content-Type": "application/json",
      ...(reason ? { "X-Audit-Log-Reason": reason } : {}),
    },
    body: JSON.stringify({
      max_age: config.discord.inviteMaxAgeSec,
      max_uses: config.discord.inviteMaxUses,
      unique: true, // never recycle an existing invite code
      temporary: false,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Discord invite failed (HTTP ${res.status}): ${detail.slice(0, 300)}`);
  }

  const data = await res.json();
  if (!data?.code) {
    throw new Error("Discord invite response missing code");
  }
  return {
    url: `https://discord.gg/${data.code}`,
    code: data.code,
    expiresInSec: config.discord.inviteMaxAgeSec,
  };
}
