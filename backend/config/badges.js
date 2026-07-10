const BADGE_THRESHOLDS = [
  { tier: 'bronze', label: 'Bronze', minPoints: 50, description: 'Earn 50 points to unlock the Bronze badge.' },
  { tier: 'silver', label: 'Silver', minPoints: 100, description: 'Earn 100 points to unlock the Silver badge.' },
  { tier: 'gold', label: 'Gold', minPoints: 150, description: 'Earn 150 points to unlock the Gold badge.' },

  { tier: 'green', label: 'Green', minPoints: 200, description: 'Earn 200 points to unlock the Green badge.' },
];

const BADGE_ORDER = BADGE_THRESHOLDS.map(b => b.tier);

function isValidBadgeTier(tier) {
  return BADGE_ORDER.includes(String(tier || '').toLowerCase());
}

function sanitizeUnlocked(unlocked) {
  if (!Array.isArray(unlocked)) return [];
  const set = new Set();
  unlocked.forEach((tier) => {
    const key = String(tier || '').toLowerCase();
    if (isValidBadgeTier(key)) set.add(key);
  });
  return BADGE_ORDER.filter(tier => set.has(tier));
}

function highestFromSet(set) {
  for (let i = BADGE_ORDER.length - 1; i >= 0; i -= 1) {
    if (set.has(BADGE_ORDER[i])) return BADGE_ORDER[i];
  }
  return null;
}

function evaluateBadgeProgress(totalPoints, currentUnlocked = [], currentHighest = null) {
  const points = Number(totalPoints) || 0;
  const normalizedUnlocked = sanitizeUnlocked(currentUnlocked);
  const unlockedSet = new Set(normalizedUnlocked);
  const previousSet = new Set(normalizedUnlocked);
  const previousHighest = highestFromSet(previousSet);

  const newlyUnlocked = [];
  let highest = previousHighest;

  BADGE_THRESHOLDS.forEach((badge) => {
    if (points >= badge.minPoints) {
      if (!unlockedSet.has(badge.tier)) newlyUnlocked.push(badge.tier);
      unlockedSet.add(badge.tier);
      highest = badge.tier;
    }
  });

  const unlocked = BADGE_ORDER.filter(tier => unlockedSet.has(tier));
  const normalizedCurrentHighest = isValidBadgeTier(currentHighest) ? currentHighest : previousHighest;
  const changed = newlyUnlocked.length > 0 || highest !== normalizedCurrentHighest;

  return {
    unlocked,
    highestTier: highest,
    newlyUnlocked,
    previousHighest,
    changed,
  };
}

function badgeLabelFromTier(tier) {
  const normalized = String(tier || '').toLowerCase();
  if (!isValidBadgeTier(normalized)) return null;
  const badge = BADGE_THRESHOLDS.find(b => b.tier === normalized);
  if (badge && badge.label) return badge.label;
  return normalized ? (normalized.charAt(0).toUpperCase() + normalized.slice(1)) : null;
}

module.exports = {
  BADGE_THRESHOLDS,
  BADGE_ORDER,
  sanitizeUnlocked,
  evaluateBadgeProgress,
  isValidBadgeTier,
  badgeLabelFromTier,
};
