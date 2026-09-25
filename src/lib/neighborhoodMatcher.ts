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

const COMMON_PREFIXES = [
  'CONJUNTO HABITACIONAL',
  'CONJ HAB',
  'CONJUNTO',
  'CONJ',
  'RESIDENCIAL',
  'RES',
  'CONDOMINIO',
  'COND',
  'PARQUE',
  'PQ',
  'JARDIM',
  'JD',
  'VILA',
  'VILLA',
  'BAIRRO',
  'CHACARA',
  'CHACRINHA',
  'LOTEAMENTO',
  'POVOADO'
];

const CONNECTORS = new Set(['DE', 'DO', 'DA', 'DOS', 'DAS', 'E']);
const ROMAN_NUMERALS = new Set(['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', '1', '2', '3', '4']);

/**
 * Simplifies a neighborhood name for fuzzy comparison by removing standard prefixes,
 * prepositions (de, da, do), and harmonizing phonetic variants.
 */
export function getSimplifiedName(normalized: string): string {
  if (!normalized) return '';
  let str = normalized.toUpperCase().trim();

  // Strip prefixes
  for (const prefix of COMMON_PREFIXES) {
    if (str.startsWith(prefix + ' ')) {
      str = str.slice(prefix.length).trim();
      break;
    }
  }

  // Common phonetic and spelling harmonizations
  str = str
    .replace(/LL/g, 'L')
    .replace(/SS/g, 'S')
    .replace(/RR/g, 'R')
    .replace(/IGNACIO/g, 'INACIO')
    .replace(/IGNAC/g, 'INAC')
    .replace(/VALENTINI/g, 'VALENTIM')
    .replace(/PH/g, 'F')
    .replace(/Y/g, 'I');

  // Filter out connectors and roman numerals
  const tokens = str.split(' ').filter((t) => !CONNECTORS.has(t) && !ROMAN_NUMERALS.has(t));
  return tokens.join(' ');
}

/**
 * Extracts base tokens and multi-phase roman numerals / numbers
 */
export function getBaseAndPhases(normalized: string): { base: string; phases: string[] } {
  const cleanTokens = normalized
    .replace(/[,/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ');
  const baseTokens = cleanTokens.filter((t) => !ROMAN_NUMERALS.has(t) && !CONNECTORS.has(t));
  const phases = cleanTokens.filter((t) => ROMAN_NUMERALS.has(t));
  return {
    base: baseTokens.join(' '),
    phases
  };
}

export interface MatchResult {
  neighborhood: NeighborhoodRate | null;
  status: 'exact' | 'alias' | 'simplified' | 'group' | 'containment' | 'fuzzy' | 'street' | 'suggested' | 'unrecognized';
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

  // 3. Simplified name exact match (removing prefix, connectors, phonetic normalization)
  const simplifiedRaw = getSimplifiedName(normalizedRaw);
  if (simplifiedRaw.length >= 3) {
    const simplifiedMatch = safeRates.find(
      (r) => getSimplifiedName(r.normalized_name || normalizeNeighborhoodName(r.name)) === simplifiedRaw
    );
    if (simplifiedMatch) {
      return { neighborhood: simplifiedMatch, status: 'simplified', confidence: 0.98 };
    }
  }

  // 4. Roman Numeral / Multi-Phase group match (e.g., "Jardim Campestre II" -> "Jardim Campestre I, II, III")
  const rawGroup = getBaseAndPhases(normalizedRaw);
  if (rawGroup.base.length >= 3) {
    const simplifiedRawBase = getSimplifiedName(rawGroup.base);
    for (const rate of safeRates) {
      const rateGroup = getBaseAndPhases(rate.normalized_name || normalizeNeighborhoodName(rate.name));
      const simplifiedRateBase = getSimplifiedName(rateGroup.base);
      if (simplifiedRawBase === simplifiedRateBase) {
        if (rawGroup.phases.length === 0 || rateGroup.phases.length === 0) {
          return { neighborhood: rate, status: 'group', confidence: 0.95 };
        }
        const hasPhaseOverlap = rawGroup.phases.some((p) => rateGroup.phases.includes(p));
        if (hasPhaseOverlap) {
          return { neighborhood: rate, status: 'group', confidence: 0.98 };
        }
      }
    }
  }

  // 5. Containment match (e.g., "Judith Cândido" inside "Residencial Judith Cândido Andrade")
  if (simplifiedRaw.length >= 4) {
    for (const rate of safeRates) {
      const simplifiedRate = getSimplifiedName(rate.normalized_name || normalizeNeighborhoodName(rate.name));
      if (simplifiedRate.length >= 4) {
        if (simplifiedRaw.includes(simplifiedRate) || simplifiedRate.includes(simplifiedRaw)) {
          return { neighborhood: rate, status: 'containment', confidence: 0.90 };
        }
      }
    }
  }

  // 6. Fuzzy / similarity match
  let bestCandidate: NeighborhoodRate | null = null;
  let bestScore = 0;

  for (const rate of safeRates) {
    const scoreNorm = computeSimilarity(normalizedRaw, rate.normalized_name || normalizeNeighborhoodName(rate.name));
    const scoreSimp = computeSimilarity(simplifiedRaw, getSimplifiedName(rate.normalized_name || normalizeNeighborhoodName(rate.name)));
    const score = Math.max(scoreNorm, scoreSimp);
    if (score > bestScore) {
      bestScore = score;
      bestCandidate = rate;
    }
  }

  if (bestScore >= 0.70 && bestCandidate) {
    return {
      neighborhood: bestCandidate,
      suggestedNeighborhood: bestCandidate,
      status: 'fuzzy',
      confidence: bestScore
    };
  }

  return { neighborhood: null, status: 'unrecognized', confidence: bestScore, suggestedNeighborhood: bestCandidate || undefined };
}

/**
 * Known street to neighborhood associations in Lavras - MG
 */
export const KNOWN_STREET_MAPPINGS = [
  { match: /Barra\s+Mansa/i, neighborhoodName: 'PITANGUI' },
  { match: /Jo[aã]o\s+Aureliano/i, neighborhoodName: 'SANTA FILOMENA' },
  { match: /Treze\s+de\s+Outubro/i, neighborhoodName: 'DOS IPES' },
  { match: /Benjamin\s+Constant/i, neighborhoodName: 'CENTRO' },
  { match: /Francisco\s+Eug[eê]nio/i, neighborhoodName: 'CRUZEIRO DO SUL DE FATIMA' }
];

export function matchNeighborhoodByStreet(
  streetName?: string | null,
  rates: NeighborhoodRate[] = []
): NeighborhoodRate | null {
  if (!streetName || !streetName.trim()) return null;
  for (const entry of KNOWN_STREET_MAPPINGS) {
    if (entry.match.test(streetName)) {
      const found = rates.find((r) => r.name.toUpperCase() === entry.neighborhoodName.toUpperCase());
      if (found) return found;
    }
  }
  return null;
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
