/**
 * 공개 스냅샷(data/public)을 검증·정규화하고 지표를 계산해
 * src/data/generated/{site-data.json, rankings.json, manifest.json, corpus-stats.json}을 생성한다.
 * 빌드 전에 항상 실행된다 (prebuild). 손으로 수정 금지.
 *
 * 지표 정책 (methodology v1 유지):
 * - 공식 4지표(피인용·감독언급·가중·PageRank)는 tier="verified" 공개 엣지에서만 계산
 * - 코퍼스층(tier="corpus")은 별도 보조 지표(corpus*)로만 집계
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { FilmsFileSchema, DatasetFileSchema, type Film, type Edge } from '../src/data/schema.ts';
import { normalizeTitleKey } from '../src/lib/canonicalize.ts';
import { computeMetrics, type MetricEdge, type FilmMetrics } from '../src/lib/metrics.ts';
import { byPagerank, byInDegree, byGold, byWeighted } from '../src/lib/sort.ts';

const root = join(import.meta.dirname, '..');
const filmsFile = FilmsFileSchema.parse(JSON.parse(readFileSync(join(root, 'data', 'public', 'films.v3.json'), 'utf8')));
const datasetFile = DatasetFileSchema.parse(JSON.parse(readFileSync(join(root, 'data', 'public', 'dataset.v3.json'), 'utf8')));
const corpusStats = JSON.parse(readFileSync(join(root, 'data', 'public', 'corpus-stats.v3.json'), 'utf8'));

const films: Film[] = filmsFile.films;
const edges: Edge[] = datasetFile.edges;
const filmById = new Map(films.map((f) => [f.id, f]));

// ---------- 무결성 검사 ----------
const errors: string[] = [];
if (filmById.size !== films.length) errors.push('영화 ID 중복');

const keyIndex = new Map<string, Film[]>();
for (const f of films) {
  const k = normalizeTitleKey(f.titleKo);
  if (!keyIndex.has(k)) keyIndex.set(k, []);
  keyIndex.get(k)!.push(f);
}
for (const [k, group] of keyIndex) {
  for (let i = 0; i < group.length; i++) {
    for (let j = i + 1; j < group.length; j++) {
      if (Math.abs(group[i].year - group[j].year) <= 1) {
        errors.push(`정규화 키 충돌: ${group[i].titleKo}(${group[i].year}) vs ${group[j].titleKo}(${group[j].year})`);
      }
    }
  }
}

const edgeIds = new Set<string>();
const logicalKeys = new Set<string>();
for (const e of edges) {
  if (edgeIds.has(e.id)) errors.push(`엣지 ID 중복: ${e.id}`);
  edgeIds.add(e.id);
  const citing = filmById.get(e.citingFilmId);
  const cited = filmById.get(e.citedFilmId);
  if (!citing || !cited) {
    errors.push(`참조 무결성 위반: ${e.id}`);
    continue;
  }
  if (e.citingFilmId === e.citedFilmId) errors.push(`self loop: ${e.id}`);
  const logical = `${e.citingFilmId}>>${e.citedFilmId}`;
  if (logicalKeys.has(logical)) errors.push(`논리적 중복 엣지: ${e.id} (${logical})`);
  logicalKeys.add(logical);
  if (citing.year < cited.year) errors.push(`연도 방향 역전: ${e.id} ${citing.titleKo}(${citing.year}) -> ${cited.titleKo}(${cited.year})`);
  if (e.evidence.publicExcerpt.length > 300) errors.push(`근거문 300자 초과: ${e.id}`);
  for (const s of e.sources) {
    if (/^[A-Za-z]:\\/.test(s.url)) errors.push(`로컬 경로 유출: ${e.id}`);
  }
}

if (errors.length) {
  console.error('데이터 무결성 검사 실패:');
  for (const err of errors) console.error(' -', err);
  process.exit(1);
}

// ---------- 검증층 공식 지표 ----------
const publishedEdges = edges.filter((e) => e.publicationStatus === 'published');
const verifiedEdges = publishedEdges.filter((e) => e.tier === 'verified');
const corpusEdges = publishedEdges.filter((e) => e.tier === 'corpus');

const metricEdges: MetricEdge[] = verifiedEdges.map((e) => ({
  citingFilmId: e.citingFilmId,
  citedFilmId: e.citedFilmId,
  signal: e.signal,
  confidence: e.confidence,
}));
const metrics = computeMetrics(metricEdges);

// ---------- 코퍼스 보조 지표 ----------
type CorpusMetric = { inDegree: number; inDocs: number; gold: number; longGap15: number; outDegree: number };
const corpusMetric = new Map<string, CorpusMetric>();
const cm = (id: string) => {
  if (!corpusMetric.has(id)) corpusMetric.set(id, { inDegree: 0, inDocs: 0, gold: 0, longGap15: 0, outDegree: 0 });
  return corpusMetric.get(id)!;
};
for (const e of corpusEdges) {
  cm(e.citingFilmId).outDegree += 1;
  const d = cm(e.citedFilmId);
  d.inDegree += 1;
  d.inDocs += e.supportCount ?? 1;
  if (e.signal === 'director_declared') d.gold += 1;
  if ((e.maxGapYears ?? -999) >= 15) d.longGap15 += 1;
}

// ---------- 공개 상태 재계산 (공개 엣지가 하나라도 붙은 영화 = published) ----------
const publishedFilmIds = new Set<string>();
for (const e of publishedEdges) {
  publishedFilmIds.add(e.citingFilmId);
  publishedFilmIds.add(e.citedFilmId);
}

const rankedList: Array<Film & FilmMetrics> = films
  .filter((f) => metrics.has(f.id))
  .map((f) => ({ ...f, ...metrics.get(f.id)! }));

const round5 = (x: number) => Math.round(x * 1e5) / 1e5;
const round2 = (x: number) => Math.round(x * 100) / 100;

const corpusRankSource = films
  .filter((f) => (corpusMetric.get(f.id)?.inDegree ?? 0) > 0)
  .map((f) => ({ f, c: corpusMetric.get(f.id)! }))
  .sort((a, b) => b.c.inDegree - a.c.inDegree || b.c.inDocs - a.c.inDocs || (a.f.id < b.f.id ? -1 : 1));

const rankings = {
  pagerank: [...rankedList].sort(byPagerank).map((f, i) => ({ rank: i + 1, id: f.id })),
  inDegree: [...rankedList].sort(byInDegree).map((f, i) => ({ rank: i + 1, id: f.id })),
  gold: [...rankedList].sort(byGold).map((f, i) => ({ rank: i + 1, id: f.id })),
  weighted: [...rankedList].sort(byWeighted).map((f, i) => ({ rank: i + 1, id: f.id })),
  corpusInDegree: corpusRankSource.map((x, i) => ({ rank: i + 1, id: x.f.id })),
};

const siteFilms = films.map((f) => {
  const m = metrics.get(f.id);
  const c = corpusMetric.get(f.id);
  return {
    ...f,
    publicStatus: publishedFilmIds.has(f.id) ? 'published' : 'candidateOnly',
    metrics: m
      ? {
          inDegree: m.inDegree,
          goldInDegree: m.goldInDegree,
          weightedInDegree: round2(m.weightedInDegree),
          outDegree: m.outDegree,
          pagerank: round5(m.pagerank),
        }
      : null,
    corpus: c ?? null,
  };
});

const signalCounts = { director_declared: 0, critic: 0, public: 0 } as Record<string, number>;
const confidenceCounts = { high: 0, medium: 0, low: 0 } as Record<string, number>;
for (const e of verifiedEdges) {
  signalCounts[e.signal]++;
  confidenceCounts[e.confidence]++;
}

const manifest = {
  datasetVersion: datasetFile.meta.datasetVersion,
  methodologyVersion: datasetFile.meta.methodologyVersion,
  researchDate: datasetFile.meta.researchDate,
  generatedAt: datasetFile.meta.generatedAt,
  counts: {
    ...datasetFile.meta.counts,
    verifiedEdges: verifiedEdges.length,
    corpusEdges: corpusEdges.length,
    publishedSignals: signalCounts,
    publishedConfidence: confidenceCounts,
    kofaFilmsInGraph: films.filter((f) => f.kofa.selected2024).length,
    kofaFilmsWithIncoming: rankedList.filter((f) => f.kofa.selected2024 && f.inDegree > 0).length,
  },
};

const outDir = join(root, 'src', 'data', 'generated');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'site-data.json'), JSON.stringify({ films: siteFilms, edges }, null, 0), 'utf8');
writeFileSync(join(outDir, 'rankings.json'), JSON.stringify(rankings, null, 0), 'utf8');
writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 1), 'utf8');
writeFileSync(join(outDir, 'corpus-stats.json'), JSON.stringify(corpusStats, null, 1), 'utf8');

console.log(
  `generated: films=${films.length} (published ${publishedFilmIds.size}) edges=${edges.length} ` +
    `(verified ${verifiedEdges.length} / corpus ${corpusEdges.length} / candidate ${edges.length - publishedEdges.length})`
);
const top = (key: 'pagerank' | 'inDegree' | 'gold' | 'corpusInDegree') =>
  rankings[key]
    .slice(0, 3)
    .map((r) => {
      const f = filmById.get(r.id)!;
      return `${f.titleKo}(${f.year})`;
    })
    .join(', ');
console.log('공식 PR top3:', top('pagerank'), '| 공식 in top3:', top('inDegree'));
console.log('코퍼스 in top3:', top('corpusInDegree'));
