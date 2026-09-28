// Rules-based outfit generation.
//
// 1. Hard filters per slot: active, fits the dress code, suits the weather.
// 2. Beam search: fill slots one at a time, keeping the best partial outfits.
// 3. Score = color harmony (worst pair weighted most) − pattern, warmth,
//    weather and recency penalties + favorite bonus, with optional jitter for
//    "shuffle".

import { pairHarmony } from './harmony';
import { FORMALITIES, type Formality, type Item } from './types';
import type { WeatherNeeds } from './weather';

export const SLOTS = ['bottom', 'top', 'shoes', 'layer', 'outerwear'] as const;
export type Slot = (typeof SLOTS)[number];
export const REQUIRED_SLOTS: readonly Slot[] = ['top', 'bottom', 'shoes'];

export type Pieces = Partial<Record<Slot, Item>>;

export interface OutfitContext {
  dressCode: Formality;
  needs: WeatherNeeds;
  /** itemId → days since last worn (0 = today). Only recent entries needed. */
  recentWear?: Map<string, number>;
  /** Sorted item-id keys of outfits worn recently, to avoid exact repeats. */
  recentOutfits?: Set<string>;
  /** Sorted item-id keys of favorite outfits. */
  favorites?: Set<string>;
}

export interface OutfitRequest extends OutfitContext {
  items: Item[];
  locked?: Partial<Record<Slot, string>>;
  count?: number;
  /** Change to get a different but still good set ("shuffle"). 0 = best only. */
  seed?: number;
}

export interface OutfitScore {
  score: number; // 0–100
  reasons: string[];
  warnings: string[];
}

export interface Suggestion extends OutfitScore {
  pieces: Pieces;
  key: string;
}

export interface SuggestResult {
  suggestions: Suggestion[];
  /** Required slots with no usable item at all. */
  missing: Slot[];
  /** Things we had to relax to produce anything (e.g. dress code). */
  notices: string[];
}

const PATTERNED = new Set(['stripe', 'check', 'plaid', 'print']);
const RECENT_DAYS = 14;
const BEAM_WIDTH = 60;

export const outfitKey = (ids: string[]) => [...ids].sort().join('|');
export const piecesOf = (p: Pieces): Item[] => SLOTS.map((s) => p[s]).filter((x): x is Item => !!x);

// ---------------------------------------------------------------------------
// Scoring

export function scoreOutfit(pieces: Pieces, ctx: OutfitContext): OutfitScore {
  const items = piecesOf(pieces);
  const reasons: string[] = [];
  const warnings: string[] = [];

  // Color: every pair of primary colors. One clash ruins an outfit, so the
  // worst pair dominates.
  let worst = 1;
  let sum = 0;
  let pairs = 0;
  let best: { score: number; reason: string } | null = null;
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const h = pairHarmony(items[i].primaryColor, items[j].primaryColor);
      worst = Math.min(worst, h.score);
      sum += h.score;
      pairs++;
      if (h.relation === 'near-miss') warnings.push(`${items[i].name} + ${items[j].name}: ${h.reason.split(': ')[1]}`);
      else if (!best || h.score > best.score) best = h;
    }
  }
  const mean = pairs ? sum / pairs : 1;
  let score = 100 * (0.6 * worst + 0.4 * mean);
  if (best && !warnings.length) reasons.push(best.reason);

  // Patterns: one statement piece is plenty.
  const patterned = items.filter((i) => PATTERNED.has(i.pattern));
  if (patterned.length > 1) {
    score -= 15 * (patterned.length - 1);
    warnings.push('Competing patterns');
  }

  // Formality: prefer pieces centred on the dress code over ones that merely stretch to it.
  const target = FORMALITIES.indexOf(ctx.dressCode);
  for (const it of items) {
    if (!it.formality.includes(ctx.dressCode)) {
      const dist = Math.min(...it.formality.map((f) => Math.abs(FORMALITIES.indexOf(f) - target)));
      score -= 8 * dist;
    }
  }

  // Weather: warmth budget across top + layer + outerwear.
  const { needs } = ctx;
  const warmth = (['top', 'layer', 'outerwear'] as const).reduce((s, k) => s + (pieces[k]?.warmth ?? 0), 0);
  const [lo, hi] = needs.warmth;
  if (warmth < lo) score -= 5 * (lo - warmth);
  if (warmth > hi) score -= 5 * (warmth - hi);
  if (needs.rain) {
    if (pieces.outerwear?.rainOk) reasons.push(`${pieces.outerwear.name} for the rain`);
    if (pieces.shoes?.rainOk) score += 2;
  }
  if (pieces.layer && needs.band !== 'hot' && needs.notes.some((n) => n.includes('swing'))) score += 3;

  // Recency: nudge away from things worn in the last two weeks.
  const recent = ctx.recentWear;
  if (recent) {
    for (const it of items) {
      const days = recent.get(it.id);
      if (days !== undefined && days < RECENT_DAYS) score -= 6 * (1 - days / RECENT_DAYS);
    }
  }
  const ids = items.map((i) => i.id);
  const key = outfitKey(ids);
  if (ctx.recentOutfits?.has(key)) {
    score -= 20;
    warnings.push('Worn recently');
  } else if (ctx.recentOutfits && items.length >= 3) {
    // Same outfit give or take one piece (e.g. plus a sweater) still feels like a repeat.
    for (const recentKey of ctx.recentOutfits) {
      const recentIds = recentKey.split('|');
      const shared = recentIds.filter((id) => ids.includes(id)).length;
      if (recentIds.length >= 3 && shared >= Math.max(recentIds.length, ids.length) - 1) {
        score -= 12;
        warnings.push('Nearly the same as a recent outfit');
        break;
      }
    }
  }
  if (ctx.favorites?.has(key)) {
    score += 5;
    reasons.push('Favorite');
  }

  return { score: Math.max(0, Math.min(100, score)), reasons, warnings };
}

// ---------------------------------------------------------------------------
// Candidates

interface SlotPlan {
  slot: Slot;
  candidates: (Item | null)[]; // null = leave the slot empty
}

function fitsDressCode(it: Item, code: Formality, relaxed: boolean) {
  if (it.formality.includes(code)) return true;
  if (!relaxed) return false;
  const t = FORMALITIES.indexOf(code);
  return it.formality.some((f) => Math.abs(FORMALITIES.indexOf(f) - t) === 1);
}

function planSlots(req: OutfitRequest): { plans: SlotPlan[]; missing: Slot[]; notices: string[] } {
  const active = req.items.filter((i) => i.status === 'active');
  const byId = new Map(req.items.map((i) => [i.id, i]));
  const { needs } = req;
  const plans: SlotPlan[] = [];
  const missing: Slot[] = [];
  const notices: string[] = [];

  for (const slot of SLOTS) {
    const lockedId = req.locked?.[slot];
    const locked = lockedId ? byId.get(lockedId) : undefined;
    if (locked) {
      plans.push({ slot, candidates: [locked] });
      continue;
    }

    const ofSlot = active.filter((i) => i.category === slot);
    const weatherOk = (i: Item) => {
      if (slot === 'top' && needs.band === 'hot') return i.warmth <= 3;
      if (slot === 'outerwear') return i.warmth >= needs.outerwearMinWarmth && (!needs.rain || i.rainOk);
      if (slot === 'layer' && needs.band === 'hot') return false;
      return true;
    };

    let pool = ofSlot.filter((i) => fitsDressCode(i, req.dressCode, false) && weatherOk(i));
    if (!pool.length) {
      pool = ofSlot.filter((i) => fitsDressCode(i, req.dressCode, true) && weatherOk(i));
      if (pool.length && REQUIRED_SLOTS.includes(slot)) notices.push(`No ${slot} matches the dress code exactly; stretching one level.`);
    }

    if (slot === 'outerwear') {
      if (needs.outerwear === 'none') {
        plans.push({ slot, candidates: [null] });
        continue;
      }
      if (needs.outerwear === 'required' && !pool.length) {
        // Fall back to any outerwear rather than none, and say why.
        const fallback = ofSlot.filter((i) => fitsDressCode(i, req.dressCode, true));
        if (fallback.length) {
          notices.push(needs.rain ? 'No rain-ready outerwear: bring an umbrella.' : 'No outerwear is warm enough for today.');
          pool = fallback;
        } else {
          notices.push(needs.rain ? 'Rain expected and no outerwear saved.' : 'Cold today and no outerwear saved.');
        }
      }
      plans.push({ slot, candidates: needs.outerwear === 'required' && pool.length ? pool : [null, ...pool] });
      continue;
    }

    if (slot === 'layer') {
      plans.push({ slot, candidates: [null, ...pool] });
      continue;
    }

    if (!pool.length) {
      // Required slot: last resort, ignore dress code entirely.
      pool = ofSlot.filter(weatherOk);
      if (!pool.length) pool = ofSlot;
      if (pool.length) notices.push(`No ${slot} fits the dress code; using the closest.`);
      else missing.push(slot);
    }
    plans.push({ slot, candidates: pool });
  }
  return { plans, missing, notices };
}

// ---------------------------------------------------------------------------
// Search

/** Small deterministic PRNG so "shuffle" is reproducible and testable. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function suggestOutfits(req: OutfitRequest): SuggestResult {
  const count = req.count ?? 5;
  const { plans, missing, notices } = planSlots(req);
  if (missing.length) return { suggestions: [], missing, notices };

  const rand = mulberry32(req.seed ?? 0);
  const jitter = new Map<string, number>();
  const noise = (id: string) => {
    if (!req.seed) return 0;
    if (!jitter.has(id)) jitter.set(id, rand() * 12);
    return jitter.get(id)!;
  };

  type Candidate = { pieces: Pieces; score: number };
  let beam: Candidate[] = [{ pieces: {}, score: 100 }];
  for (const plan of plans) {
    const next: Candidate[] = [];
    for (const b of beam) {
      for (const c of plan.candidates) {
        const pieces = c ? { ...b.pieces, [plan.slot]: c } : b.pieces;
        const s = scoreOutfit(pieces, req).score + piecesOf(pieces).reduce((n, it) => n + noise(it.id), 0);
        next.push({ pieces, score: s });
      }
    }
    next.sort((a, b) => b.score - a.score);
    beam = next.slice(0, BEAM_WIDTH);
  }

  // Pick diverse results: each must differ from every pick by ≥2 pieces when possible.
  const ranked = beam.map((b) => ({ ...b, ids: piecesOf(b.pieces).map((i) => i.id) }));
  const picked: typeof ranked = [];
  for (const minDiff of [2, 1]) {
    for (const cand of ranked) {
      if (picked.length >= count) break;
      if (picked.includes(cand)) continue;
      const ok = picked.every((p) => {
        const shared = cand.ids.filter((id) => p.ids.includes(id)).length;
        return Math.max(cand.ids.length, p.ids.length) - shared >= minDiff;
      });
      if (ok) picked.push(cand);
    }
  }

  const suggestions = picked
    .map((p) => {
      const s = scoreOutfit(p.pieces, req);
      return { pieces: p.pieces, key: outfitKey(p.ids), ...s, score: Math.round(s.score) };
    })
    .sort((a, b) => b.score - a.score);
  return { suggestions, missing, notices };
}

// ---------------------------------------------------------------------------
// Wear history helpers

/** Days between two YYYY-MM-DD dates (b − a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

export function recentWearMap(log: { date: string; itemIds: string[] }[], today: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const entry of log) {
    const d = daysBetween(entry.date, today);
    if (d < 0 || d >= RECENT_DAYS) continue;
    for (const id of entry.itemIds) m.set(id, Math.min(d, m.get(id) ?? Infinity));
  }
  return m;
}
