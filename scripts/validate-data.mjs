import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';

const sourceSchema = z.object({ url: z.string().url().refine((url) => ['http:', 'https:'].includes(new URL(url).protocol)), publisher: z.string().nullable(), title: z.string().nullable(), publishedAt: z.string().nullable(), accessedAt: z.string().nullable() });
const filmSchema = z.object({ id: z.string().regex(/^film_\d{4}$/u), titleKo: z.string().min(1), year: z.number().int().min(1900).max(2100), director: z.string().nullable(), aliases: z.array(z.string()).min(1), seed: z.boolean(), kofa: z.object({ selected2024: z.boolean(), exactRank: z.number().int().nullable() }), publicStatus: z.enum(['published', 'candidateOnly']) });
const edgeSchema = z.object({ id: z.string().regex(/^edge_\d{4}$/u), citingFilmId: z.string(), citedFilmId: z.string(), relationType: z.enum(['influence', 'thematic', 'homage', 'reference', 'parody', 'visual_influence', 'remake_official']), signal: z.enum(['director_declared', 'critic', 'public']), confidence: z.enum(['high', 'medium', 'low']), publicationStatus: z.enum(['published', 'candidate']), evidence: z.object({ publicExcerpt: z.string().min(1).max(300), summary: z.string().nullable() }), sources: z.array(sourceSchema).min(1) });
const datasetSchema = z.object({ meta: z.object({ schemaVersion: z.literal('1'), datasetVersion: z.string(), methodologyVersion: z.string(), researchDate: z.string(), generatedAt: z.string(), sourceSnapshotSha256: z.string().length(64), counts: z.object({ seedFilmsProcessed: z.number().int(), researchEdges: z.number().int(), publishedEdges: z.number().int(), candidateEdges: z.number().int(), researchNodes: z.number().int(), publishedNodes: z.number().int() }) }), films: z.array(filmSchema), edges: z.array(edgeSchema) });

const dataset = datasetSchema.parse(JSON.parse(await readFile(resolve('data/public/dataset.v1.json'), 'utf8')));
const filmIds = new Set(dataset.films.map((film) => film.id));
const edgeIds = new Set();
const logicalEdges = new Set();
for (const edge of dataset.edges) {
  if (edgeIds.has(edge.id)) throw new Error(`중복 엣지 ID: ${edge.id}`);
  edgeIds.add(edge.id);
  if (!filmIds.has(edge.citingFilmId) || !filmIds.has(edge.citedFilmId)) throw new Error(`영화 참조 오류: ${edge.id}`);
  if (edge.citingFilmId === edge.citedFilmId) throw new Error(`자기 참조 엣지: ${edge.id}`);
  const logical = `${edge.citingFilmId}|${edge.citedFilmId}|${edge.relationType}|${edge.signal}`;
  if (logicalEdges.has(logical)) throw new Error(`논리 중복 엣지: ${logical}`);
  logicalEdges.add(logical);
}
const publishedEdges = dataset.edges.filter((edge) => edge.publicationStatus === 'published');
const publishedNodes = new Set(publishedEdges.flatMap((edge) => [edge.citingFilmId, edge.citedFilmId]));
const actual = { researchEdges: dataset.meta.counts.researchEdges, publishedEdges: publishedEdges.length, candidateEdges: dataset.edges.length - publishedEdges.length, researchNodes: dataset.films.length, publishedNodes: publishedNodes.size };
const expected = { researchEdges: 87, publishedEdges: 79, candidateEdges: 8, researchNodes: 95, publishedNodes: 87 };
for (const key of Object.keys(expected)) if (actual[key] !== expected[key]) throw new Error(`회귀 집계 불일치 ${key}: ${actual[key]} != ${expected[key]}`);
console.log('데이터 검증 통과');
