export const TAU = Math.PI * 2;

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function dist2(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
}

export function dist(ax, ay, bx, by) {
  return Math.sqrt(dist2(ax, ay, bx, by));
}

export function rand(min, max) {
  return min + Math.random() * (max - min);
}

export function pick(array) {
  return array[Math.floor(Math.random() * array.length)];
}

export function chance(probability) {
  return Math.random() < probability;
}

export function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

/* ICU number formatting is one of the slowest things in the frame on Android
   WebView, and the HUD, sell tags and panel pills all format the same handful
   of values over and over. Memoized with a bounded cache: a run's displayed
   values are a small set (wallet, prices, sell values) and the map is wiped
   wholesale if it ever grows past the cap, so it cannot leak. */
const moneyCache = new Map();
const MONEY_CACHE_CAP = 256;

export function formatMoney(value) {
  const v = Math.floor(Number(value) || 0);
  let text = moneyCache.get(v);
  if (text === undefined) {
    text = '$' + v.toLocaleString('en-US');
    if (moneyCache.size >= MONEY_CACHE_CAP) moneyCache.clear();
    moneyCache.set(v, text);
  }
  return text;
}

export function clearMoneyCache() {
  moneyCache.clear();
}

/** Money for places where the full figure would shrink the font to fit —
 *  the compact HUD controls. $500 stays $500; $3,700 reads $3.7K; $2.5M, $1B. */
export function formatMoneyShort(value) {
  const n = Math.floor(Number(value) || 0);
  if (n < 1000) {
    return formatMoney(n);
  }

  if (n >= 1000000000) {
    const b = n / 1000000000;
    return '$' + (b < 10 ? String(Math.round(b * 10) / 10) : Math.round(b)) + 'B';
  }

  if (n >= 1000000) {
    const m = n / 1000000;
    return '$' + (m < 10 ? String(Math.round(m * 10) / 10) : Math.round(m)) + 'M';
  }

  const k = n / 1000;
  return '$' + (k < 10 ? String(Math.round(k * 10) / 10) : Math.round(k)) + 'K';
}


/** Random numbers for purely cosmetic effects (confetti, popups, shockwaves).
 *  Its own sequence, so juice never advances Math.random: gameplay rolls stay
 *  identical whether or not an effect fires, and seeded runs replay exactly. */
let fxSeed = 0x9e3779b9;
export function fxRandom() {
  fxSeed = (Math.imul(fxSeed ^ (fxSeed >>> 15), 0x2c1b3c6d) + 0x6d2b79f5) >>> 0;
  let t = fxSeed;
  t = Math.imul(t ^ (t >>> 12), 0x297a2d39);
  return ((t ^ (t >>> 15)) >>> 0) / 4294967296;
}
