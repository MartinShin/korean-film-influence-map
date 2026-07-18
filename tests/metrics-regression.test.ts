/**
 * 회귀 기준. 공식 4지표는 검증층(tier=verified)에서만 계산되며 v2 수치가 유지되어야 한다.
 * 이 값이 달라지면 구현 오류인지 방법론/데이터 변경인지 먼저 판정할 것.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { computeMetrics, type MetricEdge } from '../src/lib/metrics.ts';
import { DatasetFileSchema, FilmsFileSchema } from '../src/data/schema.ts';

const root = join(import.meta.dirname, '..');
const dataset = DatasetFileSchema.parse(
  JSON.parse(readFileSync(join(root, 'data', 'public', 'dataset.v3.json'), 'utf8'))
);
const filmsFile = FilmsFileSchema.parse(
  JSON.parse(readFileSync(join(root, 'data', 'public', 'films.v3.json'), 'utf8'))
);
const byId = new Map(filmsFile.films.map((f) => [f.id, f]));
const findId = (title: string, year: number) =>
  filmsFile.films.find((f) => f.titleKo === title && f.year === year)?.id ?? '';

const published = dataset.edges.filter((e) => e.publicationStatus === 'published');
const verified = published.filter((e) => e.tier === 'verified');
const corpus = published.filter((e) => e.tier === 'corpus');
const metricEdges: MetricEdge[] = verified.map((e) => ({
  citingFilmId: e.citingFilmId,
  citedFilmId: e.citedFilmId,
  signal: e.signal,
  confidence: e.confidence,
}));
const metrics = computeMetrics(metricEdges);

describe('v3 집계 회귀', () => {
  it('검증층 154, 코퍼스층 197, 후보 15', () => {
    expect(verified.length).toBe(154);
    expect(corpus.length).toBe(197);
    expect(dataset.edges.length - published.length).toBe(15);
  });
  it('검증층 정책 그래프 노드 180 (v2와 동일)', () => {
    expect(metrics.size).toBe(180);
  });
  it('검증층 신호 분포: 감독선언 29, 평론가 122, 대중 3', () => {
    const c = { director_declared: 0, critic: 0, public: 0 };
    for (const e of verified) c[e.signal]++;
    expect(c).toEqual({ director_declared: 29, critic: 122, public: 3 });
  });
});

describe('공식 순위 회귀 (검증층, v2 수치 유지)', () => {
  it('PageRank 상위: 여고괴담 > 오발탄 > 만추', () => {
    const pr = (t: string, y: number) => metrics.get(findId(t, y))!.pagerank;
    expect(pr('여고괴담', 1998)).toBeCloseTo(0.03482, 4);
    expect(pr('오발탄', 1961)).toBeCloseTo(0.02796, 4);
    expect(pr('만추', 1966)).toBeCloseTo(0.0265, 4);
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
});

describe('코퍼스층', () => {
  it('코퍼스 엣지는 지지 기사 수와 씨네21 출처를 가진다', () => {
    for (const e of corpus) {
      expect(e.supportCount ?? 1).toBeGreaterThanOrEqual(1);
      expect(e.sources.length).toBeGreaterThanOrEqual(1);
      expect(e.sources[0].url).toContain('cine21.com');
    }
  });
  it('코퍼스층과 검증층은 같은 (citing, cited) 쌍을 공유하지 않는다', () => {
    const pairs = new Set(verified.map((e) => `${e.citingFilmId}>>${e.citedFilmId}`));
    for (const e of corpus) {
      expect(pairs.has(`${e.citingFilmId}>>${e.citedFilmId}`), e.id).toBe(false);
    }
  });
  it('친구(2001)는 코퍼스 피인용을 가진 신규 진입 영화다', () => {
    const chingu = findId('친구', 2001);
    expect(chingu).not.toBe('');
    expect(corpus.some((e) => e.citedFilmId === chingu)).toBe(true);
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
