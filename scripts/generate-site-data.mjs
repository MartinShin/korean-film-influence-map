import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { computeMetrics, computeRankings } from './lib/graph.mjs';

const dataset = JSON.parse(await readFile(resolve('data/public/dataset.v1.json'), 'utf8'));
const edges = dataset.edges.filter((edge) => edge.publicationStatus === 'published');
const ids = new Set(edges.flatMap((edge) => [edge.citingFilmId, edge.citedFilmId]));
const films = dataset.films.filter((film) => ids.has(film.id));
const metrics = computeMetrics(films, edges);
const rankings = computeRankings(films, metrics);
const enrichedFilms = films.map((film) => ({ ...film, metrics: metrics[film.id] }));
const filmById = Object.fromEntries(enrichedFilms.map((film) => [film.id, film]));
const siteData = {
  meta: dataset.meta,
  films: enrichedFilms,
  edges,
  candidates: dataset.edges.filter((edge) => edge.publicationStatus === 'candidate'),
  candidateFilms: dataset.films.filter((film) => film.publicStatus === 'candidateOnly'),
  rankings: {
    byPageRank: rankings.byPageRank.map((film) => film.id),
    byInDegree: rankings.byInDegree.map((film) => film.id),
    byGold: rankings.byGold.map((film) => film.id),
  },
};

await mkdir(resolve('src/data/generated'), { recursive: true });
await mkdir(resolve('public/data'), { recursive: true });
await writeFile(resolve('src/data/generated/site-data.json'), `${JSON.stringify(siteData, null, 2)}\n`, 'utf8');
await writeFile(resolve('public/data/dataset-pilot-v1.json'), `${JSON.stringify({ meta: siteData.meta, films: siteData.films, edges: siteData.edges }, null, 2)}\n`, 'utf8');

const csv = (rows) => rows.map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
const filmRows = enrichedFilms.map((film) => [film.id, film.titleKo, film.year, film.director, film.kofa.exactRank, film.metrics.inDegree, film.metrics.goldInDegree, film.metrics.weightedInDegree, film.metrics.pageRank]);
await writeFile(resolve('public/data/films-pilot-v1.csv'), csv([['id', 'titleKo', 'year', 'director', 'kofaExactRank', 'inDegree', 'goldInDegree', 'weightedInDegree', 'pageRank'], ...filmRows]), 'utf8');
const edgeRows = edges.map((edge) => [edge.id, edge.citingFilmId, edge.citedFilmId, edge.relationType, edge.signal, edge.confidence, edge.sources[0].url]);
await writeFile(resolve('public/data/edges-pilot-v1.csv'), csv([['id', 'citingFilmId', 'citedFilmId', 'relationType', 'signal', 'confidence', 'sourceUrl'], ...edgeRows]), 'utf8');

const regression = [['오발탄', 0.04216], ['만추', 0.03894], ['별들의 고향', 0.03886], ['괴물', 0.0381], ['하녀', 0.03701]];
for (let index = 0; index < regression.length; index += 1) {
  const film = filmById[siteData.rankings.byPageRank[index]];
  const [title, expected] = regression[index];
  if (film.titleKo !== title || Number(film.metrics.pageRank.toFixed(5)) !== expected) throw new Error(`PageRank 회귀 실패 ${index + 1}위: ${film.titleKo} ${film.metrics.pageRank}`);
}
console.log(`사이트 데이터 생성: ${enrichedFilms.length} films, ${edges.length} edges`);
