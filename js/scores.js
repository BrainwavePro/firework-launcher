// Persistent arcade-style top-10 leaderboard in localStorage.

const KEY = 'fw-launcher-scores';
const LEGACY_KEY = 'fw-launcher-high'; // pre-V3 single high score
const MAX = 10;

export function loadScores() {
  let list = [];
  try {
    list = JSON.parse(localStorage.getItem(KEY)) || [];
  } catch {
    list = [];
  }
  if (!Array.isArray(list)) list = [];
  // One-time migration of the old single high score.
  const legacy = Number(localStorage.getItem(LEGACY_KEY) || 0);
  if (legacy > 0) {
    localStorage.removeItem(LEGACY_KEY);
    list.push({ initials: 'AAA', score: legacy, wave: 0, date: Date.now() });
    list.sort((a, b) => b.score - a.score);
    save(list);
  }
  return list.slice(0, MAX);
}

function save(list) {
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
}

export function qualifies(list, score) {
  if (score <= 0) return false;
  return list.length < MAX || score > list[list.length - 1].score;
}

/** Insert an entry, keep the list sorted and capped, persist, return new list. */
export function insertScore(list, entry) {
  list.push(entry);
  list.sort((a, b) => b.score - a.score);
  const out = list.slice(0, MAX);
  save(out);
  return out;
}

export function best(list) {
  return list.length ? list[0].score : 0;
}
