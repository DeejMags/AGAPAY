export const BADGE_THRESHOLDS = [
  { tier: 'bronze', label: 'Bronze', minPoints: 50, description: 'Earn 50 points to unlock the Bronze badge.' },
  { tier: 'silver', label: 'Silver', minPoints: 100, description: 'Earn 100 points to unlock the Silver badge.' },
  { tier: 'gold', label: 'Gold', minPoints: 150, description: 'Earn 150 points to unlock the Gold badge.' },

  { tier: 'green', label: 'Green', minPoints: 200, description: 'Earn 200 points to unlock the Green badge.' },
];

export const BADGE_ORDER = BADGE_THRESHOLDS.map(b => b.tier);

export function normalizeBadgeTier(tier) {
  if (!tier && tier !== 0) return null;
  const key = String(tier).trim().toLowerCase();
  return BADGE_ORDER.includes(key) ? key : null;
}

export function getBadgeMeta(tier) {
  const key = normalizeBadgeTier(tier);
  return key ? BADGE_THRESHOLDS.find(b => b.tier === key) || null : null;
}

export function getBadgeIcon(tier) {
  const meta = getBadgeMeta(tier);
  return meta?.icon || '🏅';
}

export function computeNextBadge(points) {
  const total = Number(points) || 0;
  return BADGE_THRESHOLDS.find(b => total < b.minPoints) || null;
}

export function computeProgressToNext(points, currentMeta, nextMeta) {
  if (!nextMeta) return 100;
  const floor = currentMeta ? currentMeta.minPoints : 0;
  const range = Math.max(nextMeta.minPoints - floor, 1);
  const progress = Math.max(0, Math.min((Number(points) || 0) - floor, range));
  return Math.round((progress / range) * 100);
}

export function formatBadgeLabel(tier) {
  const meta = getBadgeMeta(tier);
  if (meta) return meta.label;
  if (!tier) return 'No Badge Yet';
  const normalized = normalizeBadgeTier(tier);
  if (!normalized) return String(tier);
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function badgeChipClasses(tier) {
  const key = normalizeBadgeTier(tier);
  switch (key) {
    case 'bronze':
      return 'bg-amber-100 text-amber-700 border-amber-300';
    case 'silver':
      return 'bg-gray-100 text-gray-600 border-gray-300';
    case 'gold':
      return 'bg-yellow-100 text-yellow-700 border-yellow-300';
    case 'green':
      return 'bg-emerald-100 text-emerald-700 border-emerald-300';
    default:
      return 'bg-teal-100 text-teal-700 border-teal-300';
  }
}

export function sanitizeBadgeList(unlocked = []) {
  if (!Array.isArray(unlocked)) return [];
  const normalized = Array.from(new Set(unlocked.map(normalizeBadgeTier).filter(Boolean)));
  return BADGE_ORDER.filter(tier => normalized.includes(tier));
}
