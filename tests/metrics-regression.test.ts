/**
 * v2 회귀 기준. 이 값이 달라지면 구현 오류인지 방법론/데이터 변경인지 먼저 판정할 것.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { computeMetrics, type MetricEdge } from '../src/lib/metrics.ts';
import { DatasetFileSchema, FilmsFileSchema } from '../src/data/schema.ts';

const root = join(import.meta.dirname, '..');
const dataset = DatasetFileSchema.parse(
  JSON.parse(readFileSync(join(root, 'data', 'public', 'dataset.v2.json'), 'utf8'))
);
const filmsFile = FilmsFileSchema.parse(
  JSON.parse(readFileSync(join(root, 'data', 'public', 'films.v2.json'), 'utf8'))
);
const byId = new Map(filmsFile.films.map((f) => [f.id, f]));
const findId = (title: string, year: number) =>
  filmsFile.films.find((f) => f.titleKo === title && f.year === year)?.id ?? '';

const published = dataset.edges.filter((e) => e.publicationStatus === 'published');
const metricEdges: MetricEdge[] = published.map((e) => ({
  citingFilmId: e.citingFilmId,
  citedFilmId: e.citedFilmId,
  signal: e.signal,
  confidence: e.confidence,
}));
const metrics = computeMetrics(metricEdges);

describe('v2 집계 회귀', () => {
  it('공개 엣지 154, 후보 15', () => {
    expect(published.length).toBe(154);
    expect(dataset.edges.length - published.length).toBe(15);
  });
  it('정책 그래프 노드 180', () => {
    expect(metrics.size).toBe(180);
  });
  it('신호 분포: 감독선언 29, 평론가 122, 대중 3', () => {
    const c = { director_declared: 0, critic: 0, public: 0 };
    for (const e of published) c[e.signal]++;
    expect(c).toEqual({ director_declared: 29, critic: 122, public: 3 });
  });
});

describe('v2 순위 회귀', () => {
  it('PageRank 상위: 여고괴담 > 오발탄 > 만추', () => {
    const pr = (t: string, y: number) => metrics.get(findId(t, y))!.pagerank;
    expect(pr('여고괴담', 1998)).toBeCloseTo(0.03482, 4);
    expect(pr('오발탄', 1961)).toBeCloseTo(0.02796, 4);
    expect(pr('만추', 1966)).toBeCloseTo(0.0265, 4);
    expect(pr('여고괴담', 1998)).toBeGreaterThan(pr('오발탄', 1961));
  });
  it('피인용 상위: 여고괴담 9, 하녀 6, 쉬리 6', () => {
    expect(metrics.get(findId('여고괴담', 1998))!.inDegree).toBe(9);
    expect(metrics.get(findId('하녀', 1960))!.inDegree).toBe(6);
    expect(metrics.get(findId('쉬리', 1999))!.inDegree).toBe(6);
  });
  it('감독선언 상위: 하녀 4, 살인의 추억 3', () => {
    expect(metrics.get(findId('하녀', 1960))!.goldInDegree).toBe(4);
    expect(metrics.get(findId('살인의 추억', 2003))!.goldInDegree).toBe(3);
  });
  it('가중 점수: 여고괴담 13.67, 하녀 13.00', () => {
    expect(metrics.get(findId('여고괴담', 1998))!.weightedInDegree).toBeCloseTo(13.67, 2);
    expect(metrics.get(findId('하녀', 1960))!.weightedInDegree).toBeCloseTo(13.0, 2);
  });
});

describe('영화 식별 회귀', () => {
  it('하녀(1960)와 하녀(2010)는 다른 영화 ID', () => {
    const a = findId('하녀', 1960);
    const b = findId('하녀', 2010);
    expect(a).not.toBe('');
    expect(b).not.toBe('');
    expect(a).not.toBe(b);
  });
  it('KOFA 정확 순위는 top10만 존재', () => {
    const ranked = filmsFile.films.filter((f) => f.kofa.exactRank !== null);
    expect(ranked.length).toBeGreaterThan(0);
    for (const f of ranked) expect(f.kofa.exactRank).toBeLessThanOrEqual(10);
  });
  it('기생충(2019)은 유입 1 (콘크리트 유토피아)', () => {
    expect(metrics.get(findId('기생충', 2019))!.inDegree).toBe(1);
  });
});

describe('엣지 무결성', () => {
  it('모든 엣지의 영화 참조가 유효하고 self loop 없음', () => {
    for (const e of dataset.edges) {
      expect(byId.has(e.citingFilmId)).toBe(true);
      expect(byId.has(e.citedFilmId)).toBe(true);
      expect(e.citingFilmId).not.toBe(e.citedFilmId);
    }
  });
  it('연도 방향: 인용 영화가 피인용 영화보다 같거나 늦다', () => {
    for (const e of dataset.edges) {
      expect(byId.get(e.citingFilmId)!.year).toBeGreaterThanOrEqual(byId.get(e.citedFilmId)!.year);
    }
  });
});
