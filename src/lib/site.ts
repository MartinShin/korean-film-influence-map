/**
 * 페이지에서 쓰는 생성 데이터 접근 계층.
 * src/data/generated/* 는 빌드 전에 generate-site-data.ts가 만든다.
 */
import siteDataJson from '../data/generated/site-data.json';
import rankingsJson from '../data/generated/rankings.json';
import manifestJson from '../data/generated/manifest.json';
import corpusStatsJson from '../data/generated/corpus-stats.json';

export type SiteFilm = {
  id: string;
  titleKo: string;
  year: number;
  director: string | null;
  aliases: string[];
  seed: boolean;
  kofa: { selected2024: boolean; exactRank: number | null };
  publicStatus: 'published' | 'candidateOnly';
  metrics: {
    inDegree: number;
    goldInDegree: number;
    weightedInDegree: number;
    outDegree: number;
    pagerank: number;
  } | null;
  corpus: {
    inDegree: number;
    inDocs: number;
    gold: number;
    longGap15: number;
    outDegree: number;
  } | null;
  composite: number | null;
  longGap15All: number;
  corpusDocsAll: number;
};

export type SiteEdge = {
  id: string;
  citingFilmId: string;
  citedFilmId: string;
  relationType: string;
  signal: 'director_declared' | 'critic' | 'public';
  confidence: 'high' | 'medium' | 'low';
  publicationStatus: 'published' | 'candidate';
  tier: 'verified' | 'corpus';
  supportCount?: number;
  maxGapYears?: number | null;
  evidence: { publicExcerpt: string; summary: string | null };
  sources: Array<{ url: string; publisher: string | null; title: string | null; publishedAt?: string | null }>;
};

export type RankRef = { rank: number; id: string };

export const films = siteDataJson.films as SiteFilm[];
export const edges = siteDataJson.edges as SiteEdge[];
export const rankings = rankingsJson as {
  pagerank: RankRef[];
  inDegree: RankRef[];
  gold: RankRef[];
  weighted: RankRef[];
  corpusInDegree: RankRef[];
  composite: RankRef[];
};

export type CorpusStatRow = {
  title: string;
  year: number | null;
  pairs: number;
  docs: number;
  gold: number;
  lg15: number;
};

export const corpusStats = corpusStatsJson as {
  generatedFrom: string;
  researchDate: string;
  totals: {
    articlesScanned: number;
    candidateSentences: number;
    judgedArrows: number;
    uniquePairs: number;
    directorDeclared: number;
    krkrArrows: number;
    publishedCorpusEdges: number;
  };
  foreignCitedTop: CorpusStatRow[];
  krLongGapTop: CorpusStatRow[];
};
export const manifest = manifestJson as {
  datasetVersion: string;
  methodologyVersion: string;
  researchDate: string;
  generatedAt: string;
  counts: {
    seedFilmsProcessed: number;
    researchEdges: number;
    publishedEdges: number;
    candidateEdges: number;
    researchNodes: number;
    publishedNodes: number;
    verifiedEdges: number;
    corpusEdges: number;
    publishedSignals: Record<string, number>;
    publishedConfidence: Record<string, number>;
    kofaFilmsInGraph: number;
    kofaFilmsWithIncoming: number;
  };
};

export const filmById = new Map(films.map((f) => [f.id, f]));
export const publishedFilms = films.filter((f) => f.publicStatus === 'published');
export const publishedEdges = edges.filter((e) => e.publicationStatus === 'published');

export function incomingEdges(filmId: string, includeCandidates = false, tier?: 'verified' | 'corpus'): SiteEdge[] {
  return edges
    .filter(
      (e) =>
        e.citedFilmId === filmId &&
        (includeCandidates || e.publicationStatus === 'published') &&
        (tier === undefined || e.tier === tier)
    )
    .sort((a, b) => (filmById.get(b.citingFilmId)?.year ?? 0) - (filmById.get(a.citingFilmId)?.year ?? 0));
}

export function outgoingEdges(filmId: string, includeCandidates = false, tier?: 'verified' | 'corpus'): SiteEdge[] {
  return edges
    .filter(
      (e) =>
        e.citingFilmId === filmId &&
        (includeCandidates || e.publicationStatus === 'published') &&
        (tier === undefined || e.tier === tier)
    )
    .sort((a, b) => (filmById.get(b.citedFilmId)?.year ?? 0) - (filmById.get(a.citedFilmId)?.year ?? 0));
}

export function topFilms(kind: keyof typeof rankings, n: number): Array<SiteFilm & { rank: number }> {
  return rankings[kind].slice(0, n).map((r) => ({ ...(filmById.get(r.id) as SiteFilm), rank: r.rank }));
}

export function rankOf(kind: keyof typeof rankings, filmId: string): number | null {
  const hit = rankings[kind].find((r) => r.id === filmId);
  return hit ? hit.rank : null;
}

export function filmLabel(f: SiteFilm): string {
  return `${f.titleKo} (${f.year})`;
}
