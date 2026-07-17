import { z } from 'zod';

export const RelationType = z.enum([
  'influence',
  'thematic',
  'homage',
  'reference',
  'parody',
  'visual_influence',
  'remake_official',
]);

export const Signal = z.enum(['director_declared', 'critic', 'public']);
export const Confidence = z.enum(['high', 'medium', 'low']);
export const PublicationStatus = z.enum(['published', 'candidate']);

export const FilmSchema = z.object({
  id: z.string().regex(/^film_\d{4}$/),
  titleKo: z.string().min(1),
  year: z.number().int().min(1900).max(2030),
  director: z.string().nullable(),
  aliases: z.array(z.string()),
  seed: z.boolean(),
  kofa: z.object({
    selected2024: z.boolean(),
    exactRank: z.number().int().min(1).max(10).nullable(),
  }),
  publicStatus: z.enum(['published', 'candidateOnly']),
});

export const SourceSchema = z.object({
  url: z.string().refine((u) => /^https?:\/\//.test(u), 'http(s) URL만 허용'),
  publisher: z.string().nullable(),
  title: z.string().nullable(),
  publishedAt: z.string().nullable(),
  accessedAt: z.string().nullable(),
});

export const EdgeSchema = z.object({
  id: z.string().regex(/^edge_\d{4}$/),
  citingFilmId: z.string().regex(/^film_\d{4}$/),
  citedFilmId: z.string().regex(/^film_\d{4}$/),
  relationType: RelationType,
  signal: Signal,
  confidence: Confidence,
  publicationStatus: PublicationStatus,
  evidence: z.object({
    publicExcerpt: z.string().max(300),
    summary: z.string().nullable(),
  }),
  sources: z.array(SourceSchema).min(1),
});

export const FilmsFileSchema = z.object({
  meta: z.object({ datasetVersion: z.string() }),
  films: z.array(FilmSchema),
});

export const DatasetFileSchema = z.object({
  meta: z.object({
    schemaVersion: z.string(),
    datasetVersion: z.string(),
    methodologyVersion: z.string(),
    researchDate: z.string(),
    generatedAt: z.string(),
    counts: z.object({
      seedFilmsProcessed: z.number().int(),
      researchEdges: z.number().int(),
      publishedEdges: z.number().int(),
      candidateEdges: z.number().int(),
      researchNodes: z.number().int(),
      publishedNodes: z.number().int(),
    }),
  }),
  edges: z.array(EdgeSchema),
});

export type Film = z.infer<typeof FilmSchema>;
export type Edge = z.infer<typeof EdgeSchema>;
