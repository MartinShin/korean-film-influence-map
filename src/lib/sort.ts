/**
 * 순위 동률 정렬 규칙. 운영체제 locale 정렬에 의존하지 않고 안정 영화 ID로 최종 동률을 깬다.
 */
import type { FilmMetrics } from './metrics.ts';

type Ranked = FilmMetrics;

export function byPagerank(a: Ranked, b: Ranked): number {
  return (
    b.pagerank - a.pagerank ||
    b.weightedInDegree - a.weightedInDegree ||
    (a.filmId < b.filmId ? -1 : a.filmId > b.filmId ? 1 : 0)
  );
}

export function byInDegree(a: Ranked, b: Ranked): number {
  return (
    b.inDegree - a.inDegree ||
    b.weightedInDegree - a.weightedInDegree ||
    b.pagerank - a.pagerank ||
    (a.filmId < b.filmId ? -1 : a.filmId > b.filmId ? 1 : 0)
  );
}

export function byGold(a: Ranked, b: Ranked): number {
  return (
    b.goldInDegree - a.goldInDegree ||
    b.weightedInDegree - a.weightedInDegree ||
    b.inDegree - a.inDegree ||
    (a.filmId < b.filmId ? -1 : a.filmId > b.filmId ? 1 : 0)
  );
}

export function byWeighted(a: Ranked, b: Ranked): number {
  return (
    b.weightedInDegree - a.weightedInDegree ||
    b.inDegree - a.inDegree ||
    b.pagerank - a.pagerank ||
    (a.filmId < b.filmId ? -1 : a.filmId > b.filmId ? 1 : 0)
  );
}
