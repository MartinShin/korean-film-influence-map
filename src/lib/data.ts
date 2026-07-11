import raw from '../data/generated/site-data.json';
import type { Edge, Film, SiteData } from '../data/types';

export const data = raw as SiteData;
export const films = data.films;
export const edges = data.edges;
export const filmById = new Map(films.map((film) => [film.id, film]));

export function rankedFilms(metric: keyof SiteData['rankings']): Film[] {
  return data.rankings[metric].map((id) => filmById.get(id)).filter(Boolean) as Film[];
}

export function incomingEdges(filmId: string): Edge[] {
  return edges.filter((edge) => edge.citedFilmId === filmId);
}

export function outgoingEdges(filmId: string): Edge[] {
  return edges.filter((edge) => edge.citingFilmId === filmId);
}

export const signalLabel = { director_declared: '감독 직접 언급', critic: '평론가', public: '대중' } as const;
export const confidenceLabel = { high: '높음', medium: '중간', low: '낮음' } as const;
export const relationLabel: Record<string, string> = {
  influence: '영향', thematic: '주제 계승', homage: '오마주', reference: '참조', parody: '패러디', visual_influence: '시각적 영향', remake_official: '공식 리메이크',
};

export function formatPageRank(value: number) {
  return value.toFixed(5);
}
