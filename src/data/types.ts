export type Signal = 'director_declared' | 'critic' | 'public';
export type Confidence = 'high' | 'medium' | 'low';

export interface Metrics {
  inDegree: number;
  outDegree: number;
  goldInDegree: number;
  weightedInDegree: number;
  pageRank: number;
}

export interface Film {
  id: string;
  titleKo: string;
  year: number;
  director: string | null;
  aliases: string[];
  seed: boolean;
  kofa: { selected2024: boolean; exactRank: number | null };
  publicStatus: 'published' | 'candidateOnly';
  metrics: Metrics;
}

export interface Edge {
  id: string;
  citingFilmId: string;
  citedFilmId: string;
  relationType: string;
  signal: Signal;
  confidence: Confidence;
  publicationStatus: 'published' | 'candidate';
  evidence: { publicExcerpt: string; summary: string | null };
  sources: Array<{ url: string; publisher: string | null; title: string | null; publishedAt: string | null; accessedAt: string | null }>;
}

export interface SiteData {
  meta: {
    datasetVersion: string;
    methodologyVersion: string;
    researchDate: string;
    generatedAt: string;
    counts: { seedFilmsProcessed: number; researchEdges: number; publishedEdges: number; candidateEdges: number; researchNodes: number; publishedNodes: number };
  };
  films: Film[];
  edges: Edge[];
  candidates: Edge[];
  candidateFilms: Omit<Film, 'metrics'>[];
  rankings: { byPageRank: string[]; byInDegree: string[]; byGold: string[] };
}
