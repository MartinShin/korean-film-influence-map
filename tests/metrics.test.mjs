import { describe, expect, it } from 'vitest';
import { normalizeTitle, computeMetrics, computeRankings } from '../scripts/lib/graph.mjs';

describe('영화 정규화', () => {
  it('공백과 문장부호 차이를 병합한다', () => {
    expect(normalizeTitle('바람 불어 좋은 날')).toBe(normalizeTitle('바람불어 좋은날'));
    expect(normalizeTitle('공동경비구역 J.S.A')).toBe(normalizeTitle('공동경비구역 JSA'));
  });
});

describe('PageRank', () => {
  it('후대에서 선대로 확률을 전달한다', () => {
    const films = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const edges = [
      { citingFilmId: 'b', citedFilmId: 'a', signal: 'critic', confidence: 'high' },
      { citingFilmId: 'c', citedFilmId: 'a', signal: 'director_declared', confidence: 'high' },
    ];
    const metrics = computeMetrics(films, edges);
    const ranking = computeRankings(films, metrics).byPageRank;
    expect(ranking[0].id).toBe('a');
    expect(metrics.a.inDegree).toBe(2);
    expect(metrics.a.goldInDegree).toBe(1);
  });
});
