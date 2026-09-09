import { NeighborhoodRate, NeighborhoodAlias } from '../types';

export function normalizeNeighborhoodName(name: string): string {
  if (!name) return '';
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface MatchResult {
  neighborhood: NeighborhoodRate | null;
  status: 'exact' | 'alias' | 'group' | 'suggested' | 'unrecognized';
  suggestedNeighborhood?: NeighborhoodRate;
  confidence: number;
}

export function matchNeighborhood(
  rawName: string,
  rates: NeighborhoodRate[] = [],
  aliases: NeighborhoodAlias[] = []
): MatchResult {
  const safeRates = Array.isArray(rates) ? rates : [];
  const safeAliases = Array.isArray(aliases) ? aliases : [];

  if (!rawName || !rawName.trim()) {
    return { neighborhood: null, status: 'unrecognized', confidence: 0 };
  }

  const trimmedRaw = rawName.trim();
  const normalizedRaw = normalizeNeighborhoodName(rawName);

  // 1. Check known aliases first
  const aliasMatch = safeAliases.find(
    (a) =>
      a.raw_name.toLowerCase() === trimmedRaw.toLowerCase() ||
      a.normalized_raw_name === normalizedRaw
  );
  if (aliasMatch) {
    const targetRate = safeRates.find((r) => r.id === aliasMatch.neighborhood_rate_id);
    if (targetRate) {
      return { neighborhood: targetRate, status: 'alias', confidence: 1 };
    }
  }

  // 2. Exact match on name or normalized_name
  const exactMatch = safeRates.find(
    (r) =>
      r.name.toUpperCase() === trimmedRaw.toUpperCase() ||
      r.normalized_name === normalizedRaw
  );
  if (exactMatch) {
    return { neighborhood: exactMatch, status: 'exact', confidence: 1 };
  }

  // 3. Group match for numbered phases (e.g., "MORADA DO SOL II" -> "MORADA DO SOL I,II, III")
  // Extract base words (excluding roman numerals I, II, III, IV, V, etc.)
  const rawTokens = normalizedRaw.split(' ').filter((t) => !['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'].includes(t));
  const rawBase = rawTokens.join(' ');

  if (rawBase.length >= 4) {
    for (const rate of safeRates) {
      const rateTokens = (rate.normalized_name || '').split(' ').filter((t) => !['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'].includes(t));
      const rateBase = rateTokens.join(' ');

      if (rawBase === rateBase) {
        return { neighborhood: rate, status: 'group', confidence: 0.95 };
      }
    }
  }

  // 4. Fuzzy / similarity match for suggestions
  let bestCandidate: NeighborhoodRate | null = null;
  let bestScore = 0;

  for (const rate of safeRates) {
    const score = computeSimilarity(normalizedRaw, rate.normalized_name || '');
    if (score > bestScore) {
      bestScore = score;
      bestCandidate = rate;
    }
  }

  if (bestScore >= 0.75 && bestCandidate) {
    return {
      neighborhood: null,
      suggestedNeighborhood: bestCandidate,
      status: 'suggested',
      confidence: bestScore
    };
  }

  return { neighborhood: null, status: 'unrecognized', confidence: bestScore };
}

function computeSimilarity(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0.0;

  // Dice coefficient on character bigrams
  const bigrams1 = getBigrams(s1);
  const bigrams2 = getBigrams(s2);

  let intersection = 0;
  for (const b of bigrams1) {
    const idx = bigrams2.indexOf(b);
    if (idx !== -1) {
      intersection++;
      bigrams2.splice(idx, 1);
    }
  }

  return (2.0 * intersection) / (s1.length - 1 + s2.length - 1);
}

function getBigrams(str: string): string[] {
  const s = ' ' + str + ' ';
  const bigrams: string[] = [];
  for (let i = 0; i < s.length - 1; i++) {
    bigrams.push(s.substring(i, i + 2));
  }
  return bigrams;
}
