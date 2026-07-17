/**
 * 로컬 전용: 비공개 연구 파일에서 공개 스냅샷을 생성한다.
 * 사용: node scripts/export-public-data.ts <연구폴더경로>
 * 입력: <연구폴더>/엣지DB_한국내부_v2.json, <연구폴더>/KOFA100선_2024_seed.json
 * 출력: data/public/films.v2.json, data/public/dataset.v2.json
 *
 * 공개 허용 필드만 내보낸다. 내부 메모(batch, review_flag, pending_upgrade, agree,
 * unverified_candidates)와 로컬 경로는 절대 포함하지 않는다.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeTitleKey, KNOWN_ALIASES } from '../src/lib/canonicalize.ts';

const researchDir = process.argv[2];
if (!researchDir) {
  console.error('사용법: node scripts/export-public-data.ts <연구폴더경로>');
  process.exit(1);
}

type ResearchEdge = {
  citing_title: string;
  citing_director?: string | null;
  citing_year: number;
  cited_title: string;
  cited_director?: string | null;
  cited_year: number;
  rel_type: string;
  signal: string;
  confidence: string;
  evidence?: string;
  source_url?: string;
  sources?: string[];
  tier: string;
};

const db = JSON.parse(readFileSync(join(researchDir, '엣지DB_한국내부_v2.json'), 'utf8')) as {
  edges: ResearchEdge[];
};
const kofaSeed = JSON.parse(readFileSync(join(researchDir, 'KOFA100선_2024_seed.json'), 'utf8')) as {
  top10: Array<{ rank: number; title: string; director: string; year: number }>;
  rest_by_year: string[];
};

const kofaFilms: Array<{ title: string; year: number; rank: number | null }> = [];
for (const f of kofaSeed.top10) kofaFilms.push({ title: f.title, year: f.year, rank: f.rank });
for (const s of kofaSeed.rest_by_year) {
  const m = s.match(/^(.+)\((\d{4})\)$/);
  if (m) kofaFilms.push({ title: m[1].trim(), year: parseInt(m[2], 10), rank: null });
}

function kofaLookup(title: string, year: number): { selected: boolean; rank: number | null } {
  const key = normalizeTitleKey(title);
  for (const f of kofaFilms) {
    if (normalizeTitleKey(f.title) === key && Math.abs(f.year - year) <= 1) {
      return { selected: true, rank: f.rank };
    }
  }
  return { selected: false, rank: null };
}

// 문장 경계에서 300자 이내로 자른 공개 발췌문
function publicExcerpt(evidence: string): string {
  const text = evidence.replace(/\s+/g, ' ').trim();
  if (text.length <= 300) return text;
  const cut = text.slice(0, 300);
  const boundary = Math.max(
    cut.lastIndexOf('. '),
    cut.lastIndexOf('.” '),
    cut.lastIndexOf('" '),
    cut.lastIndexOf('다. '),
    cut.lastIndexOf('음. '),
    cut.lastIndexOf('함. ')
  );
  if (boundary > 120) return cut.slice(0, boundary + 1).trim();
  return cut.slice(0, 297).trim() + '…';
}

// ---------- 영화 레지스트리 ----------
type FilmEntry = {
  key: string;
  titleKo: string;
  year: number;
  director: string | null;
  inPublished: boolean;
};
const filmMap = new Map<string, FilmEntry>();
function filmKey(title: string, year: number): string {
  return normalizeTitleKey(title) + '|' + year;
}
function registerFilm(title: string, year: number, director: string | null | undefined, published: boolean): FilmEntry {
  const key = filmKey(title, year);
  let entry = filmMap.get(key);
  if (!entry) {
    entry = { key, titleKo: title.normalize('NFC').trim(), year, director: director || null, inPublished: false };
    filmMap.set(key, entry);
  }
  if (!entry.director && director) entry.director = director;
  if (published) entry.inPublished = true;
  return entry;
}

for (const e of db.edges) {
  const published = e.tier === 'trusted';
  registerFilm(e.citing_title, e.citing_year, e.citing_director, published);
  registerFilm(e.cited_title, e.cited_year, e.cited_director, published);
}

const films = [...filmMap.values()].sort((a, b) => a.year - b.year || a.titleKo.localeCompare(b.titleKo, 'ko'));
const idByKey = new Map<string, string>();
films.forEach((f, i) => idByKey.set(f.key, 'film_' + String(i + 1).padStart(4, '0')));

const filmRecords = films.map((f) => {
  const kofa = kofaLookup(f.titleKo, f.year);
  return {
    id: idByKey.get(f.key)!,
    titleKo: f.titleKo,
    year: f.year,
    director: f.director,
    aliases: KNOWN_ALIASES[normalizeTitleKey(f.titleKo)] ?? [],
    seed: kofa.selected,
    kofa: { selected2024: kofa.selected, exactRank: kofa.rank },
    publicStatus: f.inPublished ? 'published' : 'candidateOnly',
  };
});

// ---------- 엣지 ----------
const sortedEdges = [...db.edges].sort(
  (a, b) =>
    a.citing_year - b.citing_year ||
    a.citing_title.localeCompare(b.citing_title, 'ko') ||
    a.cited_year - b.cited_year ||
    a.cited_title.localeCompare(b.cited_title, 'ko')
);
const edgeRecords = sortedEdges.map((e, i) => ({
  id: 'edge_' + String(i + 1).padStart(4, '0'),
  citingFilmId: idByKey.get(filmKey(e.citing_title, e.citing_year))!,
  citedFilmId: idByKey.get(filmKey(e.cited_title, e.cited_year))!,
  relationType: e.rel_type,
  signal: e.signal,
  confidence: e.confidence,
  publicationStatus: e.tier === 'trusted' ? 'published' : 'candidate',
  evidence: { publicExcerpt: publicExcerpt(e.evidence ?? ''), summary: null },
  sources: (e.sources && e.sources.length ? e.sources : e.source_url ? [e.source_url] : []).map((url) => ({
    url,
    publisher: null,
    title: null,
    publishedAt: null,
    accessedAt: null,
  })),
}));

const publishedEdges = edgeRecords.filter((e) => e.publicationStatus === 'published');
const meta = {
  schemaVersion: '1',
  datasetVersion: 'v2',
  methodologyVersion: '1',
  researchDate: '2026-07-18',
  generatedAt: new Date().toISOString(),
  counts: {
    seedFilmsProcessed: 106,
    researchEdges: edgeRecords.length,
    publishedEdges: publishedEdges.length,
    candidateEdges: edgeRecords.length - publishedEdges.length,
    researchNodes: filmRecords.length,
    publishedNodes: filmRecords.filter((f) => f.publicStatus === 'published').length,
  },
};

writeFileSync(
  join(import.meta.dirname, '..', 'data', 'public', 'films.v2.json'),
  JSON.stringify({ meta: { datasetVersion: 'v2' }, films: filmRecords }, null, 1),
  'utf8'
);
writeFileSync(
  join(import.meta.dirname, '..', 'data', 'public', 'dataset.v2.json'),
  JSON.stringify({ meta, edges: edgeRecords }, null, 1),
  'utf8'
);
console.log('films:', filmRecords.length, '| edges:', edgeRecords.length, '| published:', publishedEdges.length);
