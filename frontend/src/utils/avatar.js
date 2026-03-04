export function normalizeGender(value, fallback = 'male') {
  const key = String(value || '').trim().toLowerCase();
  if (key === 'female') return 'female';
  if (key === 'male') return 'male';
  return fallback;
}

export function generateAvatarByGender(seed, gender) {
  const normalizedSeed = String(seed || 'user').replace(/\s+/g, '-');
  const normalizedGender = normalizeGender(gender);
  const top = normalizedGender === 'female' ? 'longHairStraight' : 'shortHairShortFlat';
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(normalizedSeed)}&top[]=${top}`;
}
