/**
 * 로컬 전용: 데이터셋 v3 생성 - 기존 검증층(v2) + 씨네21 코퍼스 화살표 층.
 * 사용: node scripts/build-v3-data.ts <cine21-scan 폴더>
 * 입력: data/public/films.v2.json, dataset.v2.json,
 *       <스캔폴더>/out/corpus_edges_final.jsonl, <스캔폴더>/out/movies.jsonl
 * 출력: data/public/films.v3.json, dataset.v3.json, corpus-stats.v3.json
 *
 * 원칙:
 * - 검증층 엣지는 tier="verified"로 전부 승계 (공식 지표는 이 층에서만 계산)
 * - 코퍼스층은 한국영화↔한국영화 화살표만 본 그래프에 편입 (tier="corpus")
 * - 외국영화 소환·long-gap 통계는 corpus-stats로 별도 산출 (레지스트리 오염 없음)
 * - 같은 (citing, cited) 쌍이 검증층에 이미 있으면 코퍼스 엣지는 생략
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeTitleKey } from '../src/lib/canonicalize.ts';

const corpusDir = process.argv[2];
if (!corpusDir) {
  console.error('사용법: node scripts/build-v3-data.ts <cine21-scan 폴더>');
  process.exit(1);
}

const root = join(import.meta.dirname, '..');
const filmsV2 = JSON.parse(readFileSync(join(root, 'data/public/films.v2.json'), 'utf8'));
const datasetV2 = JSON.parse(readFileSync(join(root, 'data/public/dataset.v2.json'), 'utf8'));

type Arrow = {
  key: string;
  is_arrow: boolean;
  citing_title: string | null;
  citing_year: number | null;
  cited_title: string | null;
  cited_year: number | null;
  citing_country: string | null;
  cited_country: string | null;
  rel_type: string | null;
  signal: string | null;
  confidence: string | null;
  evidence: string | null;
  mag_id: number | null;
  date: string | null;
  gap: number | null;
};

const readJsonl = (p: string): any[] =>
  readFileSync(p, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

const arrows: Arrow[] = readJsonl(join(corpusDir, 'out', 'corpus_edges_final.jsonl'));
const moviesMeta = readJsonl(join(corpusDir, 'out', 'movies.jsonl')).filter((m) => m.ok && m.title);

const metaByTitle = new Map<string, { year: number | null; country: string | null; director: string | null }>();
for (const m of moviesMeta) {
  const t = String(m.title).replace(/\s*\(\d{4}\)\s*$/, '').trim();
  const k = normalizeTitleKey(t);
  if (!metaByTitle.has(k)) metaByTitle.set(k, { year: m.year ?? null, country: m.country ?? null, director: m.director ?? null });
}

// ---------- 유효 rel/signal/confidence 정규화 ----------
const REL = new Set(['influence', 'thematic', 'homage', 'reference', 'parody', 'visual_influence', 'remake_official']);
const relOf = (r: string | null) => (r && REL.has(r) ? r : 'influence');
const sigOf = (s: string | null) => (s === 'director_declared' ? 'director_declared' : 'critic');
const confOf = (c: string | null) => (c === 'high' || c === 'medium' || c === 'low' ? c : 'low');
const CONF_RANK: Record<string, number> = { high: 3, medium: 2, low: 1 };

// ---------- 기존 레지스트리 ----------
type FilmRec = (typeof filmsV2.films)[number];
const films: FilmRec[] = [...filmsV2.films];
const filmByKey = new Map<string, FilmRec>(); // normTitle -> candidates
const filmIndex: Array<{ key: string; year: number; rec: FilmRec }> = films.map((f) => ({
  key: normalizeTitleKey(f.titleKo),
  year: f.year,
  rec: f,
}));
function findFilm(title: string, year: number | null): FilmRec | null {
  const k = normalizeTitleKey(title);
  let best: FilmRec | null = null;
  for (const e of filmIndex) {
    if (e.key !== k) continue;
    if (year == null) return e.rec; // 연도 미상은 첫 매치
    if (Math.abs(e.year - year) <= 1) return e.rec;
  }
  return best;
}
let nextFilmNo = films.length + 1;
function addFilm(title: string, year: number, director: string | null): FilmRec {
  const rec: FilmRec = {
    id: 'film_' + String(nextFilmNo++).padStart(4, '0'),
    titleKo: title,
    year,
    director,
    aliases: [],
    seed: false,
    kofa: { selected2024: false, exactRank: null },
    publicStatus: 'published',
  };
  films.push(rec);
  filmIndex.push({ key: normalizeTitleKey(title), year, rec });
  return rec;
}

// ---------- 검증층 쌍 집합 ----------
const filmById = new Map(films.map((f: FilmRec) => [f.id, f]));
const verifiedPairs = new Set<string>();
for (const e of datasetV2.edges) {
  const a = filmById.get(e.citingFilmId);
  const b = filmById.get(e.citedFilmId);
  if (a && b) verifiedPairs.add(normalizeTitleKey(a.titleKo) + '|' + a.year + '>>' + normalizeTitleKey(b.titleKo) + '|' + b.year);
}

// ---------- 코퍼스 kr↔kr 쌍 병합 ----------
type PairAgg = {
  citingTitle: string;
  citingYear: number | null;
  citedTitle: string;
  citedYear: number | null;
  rel: string;
  signal: string;
  confidence: string;
  evidence: string;
  mags: Map<number, string | null>; // mag_id -> date
  maxGap: number | null;
};
const pairs = new Map<string, PairAgg>();
let dropDirection = 0;
let dropSelf = 0;
let krkr = 0;

for (const a of arrows) {
  if (!a.is_arrow || !a.citing_title || !a.cited_title) continue;
  if (a.citing_country !== 'kr' || a.cited_country !== 'kr') continue;
  krkr++;
  const ck = normalizeTitleKey(a.citing_title);
  const dk = normalizeTitleKey(a.cited_title);
  if (ck === dk && (a.citing_year ?? 0) === (a.cited_year ?? 0)) {
    dropSelf++;
    continue;
  }
  if (a.citing_year != null && a.cited_year != null && a.citing_year < a.cited_year) {
    dropDirection++;
    continue;
  }
  const pk = ck + '>>' + dk;
  let p = pairs.get(pk);
  if (!p) {
    p = {
      citingTitle: a.citing_title.trim(),
      citingYear: a.citing_year,
      citedTitle: a.cited_title.trim(),
      citedYear: a.cited_year,
      rel: relOf(a.rel_type),
      signal: sigOf(a.signal),
      confidence: confOf(a.confidence),
      evidence: (a.evidence || '').trim(),
      mags: new Map(),
      maxGap: a.gap ?? null,
    };
    pairs.set(pk, p);
  }
  if (a.mag_id != null) p.mags.set(a.mag_id, a.date ? a.date.slice(0, 10) : null);
  if (a.gap != null) p.maxGap = Math.max(p.maxGap ?? -999, a.gap);
  if (p.citingYear == null && a.citing_year != null) p.citingYear = a.citing_year;
  if (p.citedYear == null && a.cited_year != null) p.citedYear = a.cited_year;
  // 대표 신호·신뢰도·근거: director_declared > critic, 높은 confidence 우선
  const better =
    (sigOf(a.signal) === 'director_declared' && p.signal !== 'director_declared') ||
    (sigOf(a.signal) === p.signal && CONF_RANK[confOf(a.confidence)] > CONF_RANK[p.confidence]);
  if (better) {
    p.signal = sigOf(a.signal);
    p.confidence = confOf(a.confidence);
    p.rel = relOf(a.rel_type);
    p.evidence = (a.evidence || p.evidence).trim();
  }
}

// ---------- 엣지 생성 ----------
function excerpt(text: string): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= 300) return t;
  const cut = t.slice(0, 300);
  const b = Math.max(cut.lastIndexOf('다. '), cut.lastIndexOf('. '));
  return b > 120 ? cut.slice(0, b + 1) : cut.slice(0, 297) + '…';
}

const edges = datasetV2.edges.map((e: any) => ({ ...e, tier: 'verified' }));
let nextEdgeNo = edges.length + 1;
let skippedVerifiedDup = 0;
let skippedNoYear = 0;

const sortedPairs = [...pairs.values()].sort(
  (x, y) => (x.citingYear ?? 0) - (y.citingYear ?? 0) || x.citingTitle.localeCompare(y.citingTitle, 'ko')
);
for (const p of sortedPairs) {
  // 연도 해소 (레지스트리/메타 순)
  const metaC = metaByTitle.get(normalizeTitleKey(p.citingTitle));
  const metaD = metaByTitle.get(normalizeTitleKey(p.citedTitle));
  const cy = p.citingYear ?? metaC?.year ?? null;
  const dy = p.citedYear ?? metaD?.year ?? null;
  if (cy == null || dy == null) {
    skippedNoYear++;
    continue;
  }
  if (cy < dy) {
    dropDirection++;
    continue;
  }
  let citing = findFilm(p.citingTitle, cy) ?? addFilm(p.citingTitle, cy, metaC?.director ?? null);
  let cited = findFilm(p.citedTitle, dy) ?? addFilm(p.citedTitle, dy, metaD?.director ?? null);
  if (citing.id === cited.id) {
    dropSelf++;
    continue;
  }
  const pairKey = normalizeTitleKey(citing.titleKo) + '|' + citing.year + '>>' + normalizeTitleKey(cited.titleKo) + '|' + cited.year;
  if (verifiedPairs.has(pairKey)) {
    skippedVerifiedDup++;
    continue;
  }
  verifiedPairs.add(pairKey); // 코퍼스 내부 중복(연도 변형 등)도 방지
  const magEntries = [...p.mags.entries()].slice(0, 3);
  edges.push({
    id: 'edge_' + String(nextEdgeNo++).padStart(4, '0'),
    citingFilmId: citing.id,
    citedFilmId: cited.id,
    relationType: p.rel,
    signal: p.signal,
    confidence: p.confidence,
    publicationStatus: 'published',
    tier: 'corpus',
    supportCount: p.mags.size,
    maxGapYears: p.maxGap,
    evidence: { publicExcerpt: excerpt(p.evidence), summary: null },
    sources: magEntries.map(([mag, date]) => ({
      url: `https://cine21.com/news/view/?mag_id=${mag}`,
      publisher: '씨네21',
      title: null,
      publishedAt: date,
      accessedAt: null,
    })),
  });
}

// ---------- 코퍼스 통계 (외국영화 소환 + 한국 long-gap, 전 화살표 기준) ----------
type Stat = { title: string; year: number | null; pairs: number; docs: number; gold: number; lg15: number };
function buildStats(filterCited: (a: Arrow) => boolean): Stat[] {
  const agg = new Map<string, { title: string; year: number | null; pairSet: Set<string>; docs: Set<number>; gold: Set<string>; lg: Set<string> }>();
  for (const a of arrows) {
    if (!a.is_arrow || !a.citing_title || !a.cited_title) continue;
    if (!filterCited(a)) continue;
    const key = normalizeTitleKey(a.cited_title);
    let s = agg.get(key);
    if (!s) {
      s = { title: a.cited_title.trim(), year: a.cited_year ?? metaByTitle.get(key)?.year ?? null, pairSet: new Set(), docs: new Set(), gold: new Set(), lg: new Set() };
      agg.set(key, s);
    }
    const pk = normalizeTitleKey(a.citing_title);
    s.pairSet.add(pk);
    if (a.mag_id != null) s.docs.add(a.mag_id);
    if (sigOf(a.signal) === 'director_declared') s.gold.add(pk);
    if (a.gap != null && a.gap >= 15) s.lg.add(pk);
  }
  return [...agg.values()]
    .map((s) => ({ title: s.title, year: s.year, pairs: s.pairSet.size, docs: s.docs.size, gold: s.gold.size, lg15: s.lg.size }))
    .sort((a, b) => b.pairs - a.pairs || b.docs - a.docs);
}

const foreignCited = buildStats((a) => a.cited_country === 'foreign').slice(0, 25);
const krCitedAll = buildStats((a) => a.cited_country === 'kr');
const krLongGap = krCitedAll.filter((s) => s.lg15 > 0).sort((a, b) => b.lg15 - a.lg15 || b.pairs - a.pairs).slice(0, 15);

const corpusStats = {
  generatedFrom: '씨네21 아카이브 전수 (mag_id 100~111000, 1999~2026)',
  researchDate: '2026-07-18',
  totals: {
    articlesScanned: 97000,
    candidateSentences: 6523,
    judgedArrows: 3037,
    uniquePairs: 2446,
    directorDeclared: 239,
    krkrArrows: krkr,
    publishedCorpusEdges: edges.filter((e: any) => e.tier === 'corpus').length,
  },
  foreignCitedTop: foreignCited,
  krLongGapTop: krLongGap,
};

// ---------- 저장 ----------
const corpusEdgeCount = edges.filter((e: any) => e.tier === 'corpus').length;
const meta = {
  ...datasetV2.meta,
  datasetVersion: 'v3',
  researchDate: '2026-07-18',
  generatedAt: new Date().toISOString(),
  counts: {
    ...datasetV2.meta.counts,
    researchEdges: edges.length,
    publishedEdges: edges.filter((e: any) => e.publicationStatus === 'published').length,
    candidateEdges: edges.filter((e: any) => e.publicationStatus === 'candidate').length,
    researchNodes: films.length,
    publishedNodes: films.filter((f: FilmRec) => f.publicStatus === 'published').length,
    verifiedEdges: edges.filter((e: any) => e.tier === 'verified' && e.publicationStatus === 'published').length,
    corpusEdges: corpusEdgeCount,
  },
};

writeFileSync(join(root, 'data/public/films.v3.json'), JSON.stringify({ meta: { datasetVersion: 'v3' }, films }, null, 1), 'utf8');
writeFileSync(join(root, 'data/public/dataset.v3.json'), JSON.stringify({ meta, edges }, null, 1), 'utf8');
writeFileSync(join(root, 'data/public/corpus-stats.v3.json'), JSON.stringify(corpusStats, null, 1), 'utf8');

console.log(`kr↔kr arrows: ${krkr} → corpus edges: ${corpusEdgeCount} (dup-with-verified ${skippedVerifiedDup}, no-year ${skippedNoYear}, direction ${dropDirection}, self ${dropSelf})`);
console.log(`films: ${filmsV2.films.length} → ${films.length} | edges: ${datasetV2.edges.length} → ${edges.length}`);
