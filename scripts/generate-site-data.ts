/**
 * 공개 스냅샷(data/public)을 검증·정규화하고 지표를 계산해
 * src/data/generated/{site-data.json, rankings.json, manifest.json}을 생성한다.
 * 빌드 전에 항상 실행된다 (prebuild). 손으로 수정 금지.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { FilmsFileSchema, DatasetFileSchema, type Film, type Edge } from '../src/data/schema.ts';
import { normalizeTitleKey } from '../src/lib/canonicalize.ts';
import { computeMetrics, type MetricEdge, type FilmMetrics } from '../src/lib/metrics.ts';
import { byPagerank, byInDegree, byGold, byWeighted } from '../src/lib/sort.ts';

const root = join(import.meta.dirname, '..');
const filmsRaw = JSON.parse(readFileSync(join(root, 'data', 'public', 'films.v2.json'), 'utf8'));
const datasetRaw = JSON.parse(readFileSync(join(root, 'data', 'public', 'dataset.v2.json'), 'utf8'));

const filmsFile = FilmsFileSchema.parse(filmsRaw);
const datasetFile = DatasetFileSchema.parse(datasetRaw);
const films: Film[] = filmsFile.films;
const edges: Edge[] = datasetFile.edges;

// ---------- 무결성 검사 ----------
const errors: string[] = [];
const filmById = new Map(films.map((f) => [f.id, f]));

// 영화 ID 중복
if (filmById.size !== films.length) errors.push('영화 ID 중복');

// 정규화 키 충돌 (같은 키 + 연도 ±1 = 같은 영화가 두 레코드)
for (let i = 0; i < films.length; i++) {
  for (let j = i + 1; j < films.length; j++) {
    if (
      normalizeTitleKey(films[i].titleKo) === normalizeTitleKey(films[j].titleKo) &&
      Math.abs(films[i].year - films[j].year) <= 1
    ) {
      errors.push(`정규화 키 충돌: ${films[i].titleKo}(${films[i].year}) vs ${films[j].titleKo}(${films[j].year})`);
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
  // 연도 방향 역전은 오류 보고만 하고 자동 삭제하지 않는다
  if (citing.year < cited.year) errors.push(`연도 방향 역전: ${e.id} ${citing.titleKo}(${citing.year}) -> ${cited.titleKo}(${cited.year})`);
  if (e.evidence.publicExcerpt.length > 300) errors.push(`근거문 300자 초과: ${e.id}`);
  for (const s of e.sources) {
    if (/^[A-Za-z]:\\/.test(s.url) || s.url.includes('G:\\') || s.url.includes('C:\\')) {
      errors.push(`로컬 경로 유출: ${e.id}`);
    }
  }
}

if (errors.length) {
  console.error('데이터 무결성 검사 실패:');
  for (const err of errors) console.error(' -', err);
  process.exit(1);
}

// ---------- 정책 그래프 + 지표 ----------
const publishedEdges = edges.filter((e) => e.publicationStatus === 'published');
const metricEdges: MetricEdge[] = publishedEdges.map((e) => ({
  citingFilmId: e.citingFilmId,
  citedFilmId: e.citedFilmId,
  signal: e.signal,
  confidence: e.confidence,
}));
const metrics = computeMetrics(metricEdges);
const publishedFilmIds = new Set(metrics.keys());

// publicStatus 정합성 확인
for (const f of films) {
  const inPub = publishedFilmIds.has(f.id);
  if (inPub && f.publicStatus !== 'published') errors.push(`publicStatus 불일치(published여야 함): ${f.id}`);
  if (!inPub && f.publicStatus !== 'candidateOnly') errors.push(`publicStatus 불일치(candidateOnly여야 함): ${f.id}`);
}
if (errors.length) {
  for (const err of errors) console.error(' -', err);
  process.exit(1);
}

const rankedList: Array<Film & FilmMetrics> = films
  .filter((f) => publishedFilmIds.has(f.id))
  .map((f) => ({ ...f, ...metrics.get(f.id)! }));

const round5 = (x: number) => Math.round(x * 1e5) / 1e5;
const round2 = (x: number) => Math.round(x * 100) / 100;

const rankings = {
  pagerank: [...rankedList].sort(byPagerank).map((f, i) => ({ rank: i + 1, id: f.id })),
  inDegree: [...rankedList].sort(byInDegree).map((f, i) => ({ rank: i + 1, id: f.id })),
  gold: [...rankedList].sort(byGold).map((f, i) => ({ rank: i + 1, id: f.id })),
  weighted: [...rankedList].sort(byWeighted).map((f, i) => ({ rank: i + 1, id: f.id })),
};

const siteFilms = films.map((f) => {
  const m = metrics.get(f.id);
  return {
    ...f,
    metrics: m
      ? {
          inDegree: m.inDegree,
          goldInDegree: m.goldInDegree,
          weightedInDegree: round2(m.weightedInDegree),
          outDegree: m.outDegree,
          pagerank: round5(m.pagerank),
        }
      : null,
  };
});

const signalCounts = { director_declared: 0, critic: 0, public: 0 } as Record<string, number>;
const confidenceCounts = { high: 0, medium: 0, low: 0 } as Record<string, number>;
for (const e of publishedEdges) {
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

console.log(
  `generated: films=${films.length} (published ${publishedFilmIds.size}) edges=${edges.length} (published ${publishedEdges.length})`
);
console.log(
  `KOFA in graph=${manifest.counts.kofaFilmsInGraph}, with incoming=${manifest.counts.kofaFilmsWithIncoming}`
);
const top = (key: 'pagerank' | 'inDegree' | 'gold') =>
  rankings[key]
    .slice(0, 3)
    .map((r) => {
      const f = filmById.get(r.id)!;
      return `${f.titleKo}(${f.year})`;
    })
    .join(', ');
console.log('PR top3:', top('pagerank'));
console.log('in top3:', top('inDegree'));
console.log('gold top3:', top('gold'));
