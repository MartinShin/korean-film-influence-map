import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { canonicalKey, normalizeTitle } from './lib/graph.mjs';

const sourceRoot = resolve(process.argv[2] || '..');
const edgePath = resolve(sourceRoot, '엣지DB_한국내부_파일럿_v1.json');
const kofaPath = resolve(sourceRoot, 'KOFA100선_2024_seed.json');
const edgeText = await readFile(edgePath, 'utf8');
const kofaText = await readFile(kofaPath, 'utf8');
const source = JSON.parse(edgeText);
const kofa = JSON.parse(kofaText);

const parseKofaRest = (value) => {
  const match = value.match(/^(.*)\((\d{4})\)$/u);
  if (!match) throw new Error(`KOFA 항목 해석 실패: ${value}`);
  return { title: match[1], year: Number(match[2]), exactRank: null };
};
const kofaFilms = [...kofa.top10.map((item) => ({ ...item, exactRank: item.rank })), ...kofa.rest_by_year.map(parseKofaRest)];

const filmMap = new Map();
for (const edge of source.edges) {
  for (const side of ['citing', 'cited']) {
    const title = edge[`${side}_title`];
    const year = edge[`${side}_year`];
    const director = edge[`${side}_director`] || null;
    const key = canonicalKey(title, year);
    const existing = filmMap.get(key);
    if (existing) {
      if (!existing.aliases.includes(title)) existing.aliases.push(title);
      if (!existing.director && director) existing.director = director;
    } else filmMap.set(key, { titleKo: title, year, director, aliases: [title] });
  }
}

const filmEntries = [...filmMap.entries()].sort((a, b) => a[1].year - b[1].year || normalizeTitle(a[1].titleKo).localeCompare(normalizeTitle(b[1].titleKo), 'en'));
const films = filmEntries.map(([key, film], index) => {
  const kofaMatch = kofaFilms.find((item) => normalizeTitle(item.title) === normalizeTitle(film.titleKo) && Math.abs(item.year - film.year) <= 1);
  return {
    id: `film_${String(index + 1).padStart(4, '0')}`,
    titleKo: film.titleKo,
    year: film.year,
    director: film.director,
    aliases: [...new Set(film.aliases)],
    seed: Boolean(kofaMatch),
    kofa: { selected2024: Boolean(kofaMatch), exactRank: kofaMatch?.exactRank ?? null },
    canonicalKey: key,
  };
});

const idByKey = new Map(films.map((film) => [film.canonicalKey, film.id]));
const excerpt = (value) => {
  const clean = value.replace(/\s+/gu, ' ').trim();
  if (clean.length <= 280) return clean;
  const clipped = clean.slice(0, 280);
  const sentence = Math.max(clipped.lastIndexOf('. '), clipped.lastIndexOf('다.'));
  return `${clipped.slice(0, sentence > 120 ? sentence + 2 : 276).trim()}…`;
};

const edges = source.edges.map((edge, index) => ({
  id: `edge_${String(index + 1).padStart(4, '0')}`,
  citingFilmId: idByKey.get(canonicalKey(edge.citing_title, edge.citing_year)),
  citedFilmId: idByKey.get(canonicalKey(edge.cited_title, edge.cited_year)),
  relationType: edge.rel_type,
  signal: edge.signal,
  confidence: edge.confidence,
  publicationStatus: edge.tier === 'trusted' ? 'published' : 'candidate',
  evidence: { publicExcerpt: excerpt(edge.evidence), summary: null },
  sources: [...new Set([edge.source_url, ...(edge.sources || [])].filter(Boolean))].map((url) => ({ url, publisher: null, title: null, publishedAt: null, accessedAt: '2026-07-09' })),
}));

const publishedIds = new Set(edges.filter((edge) => edge.publicationStatus === 'published').flatMap((edge) => [edge.citingFilmId, edge.citedFilmId]));
for (const film of films) {
  film.publicStatus = publishedIds.has(film.id) ? 'published' : 'candidateOnly';
  delete film.canonicalKey;
}

const dataset = {
  meta: {
    schemaVersion: '1', datasetVersion: 'pilot-v1', methodologyVersion: '1', researchDate: source.meta.created,
    generatedAt: new Date().toISOString(), sourceSnapshotSha256: createHash('sha256').update(edgeText).update(kofaText).digest('hex'),
    counts: { seedFilmsProcessed: source.meta.stats.films_processed, researchEdges: edges.length, publishedEdges: edges.filter((edge) => edge.publicationStatus === 'published').length, candidateEdges: edges.filter((edge) => edge.publicationStatus === 'candidate').length, researchNodes: films.length, publishedNodes: publishedIds.size },
  }, films, edges,
};

await mkdir(resolve('data/public'), { recursive: true });
await writeFile(resolve('data/public/dataset.v1.json'), `${JSON.stringify(dataset, null, 2)}\n`, 'utf8');
console.log(`공개 데이터 생성: ${JSON.stringify(dataset.meta.counts)}`);
