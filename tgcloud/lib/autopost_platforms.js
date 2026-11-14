// Helpers for the auto_post_schedules.source_platform column.
// The column stores either a single platform id (legacy) or a
// comma-separated list of platform ids for multi-source auto posts.

export function parseAutoPostPlatforms(sourcePlatform) {
  if (!sourcePlatform) return [];
  return String(sourcePlatform)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

export function serializeAutoPostPlatforms(platforms) {
  const seen = new Set();
  const out = [];
  for (const p of platforms || []) {
    const id = String(p || '').trim();
    if (id && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out.join(',');
}
