/**
 * 그래프 지표 계산. 모든 엣지 방향은 「후대 인용 영화 → 선대 피인용 영화」.
 * 영향받은 횟수 = 노드로 들어오는 엣지 수(in-degree).
 */

export type MetricEdge = {
  citingFilmId: string;
  citedFilmId: string;
  signal: 'director_declared' | 'critic' | 'public';
  confidence: 'high' | 'medium' | 'low';
};

export type FilmMetrics = {
  filmId: string;
  inDegree: number;
  goldInDegree: number;
  weightedInDegree: number;
  outDegree: number;
  pagerank: number;
};

export const SIGNAL_WEIGHT: Record<MetricEdge['signal'], number> = {
  director_declared: 3,
  critic: 2,
  public: 1,
};

export const CONFIDENCE_MULTIPLIER: Record<MetricEdge['confidence'], number> = {
  high: 1,
  medium: 2 / 3,
  low: 1 / 3,
};

export function edgeWeight(edge: Pick<MetricEdge, 'signal' | 'confidence'>): number {
  return SIGNAL_WEIGHT[edge.signal] * CONFIDENCE_MULTIPLIER[edge.confidence];
}

/**
 * PageRank: 비가중, damping 0.85, dangling mass는 전체 노드에 균등 재분배,
 * L1 오차 1e-12 이하에서 수렴, 최대 1000회 반복. (방법론 v1 고정 사양)
 */
export function computePagerank(nodeIds: string[], edges: MetricEdge[]): Map<string, number> {
  const n = nodeIds.length;
  const index = new Map(nodeIds.map((id, i) => [id, i]));
  const outLinks: number[][] = nodeIds.map(() => []);
  for (const e of edges) {
    const ci = index.get(e.citingFilmId);
    const di = index.get(e.citedFilmId);
    if (ci === undefined || di === undefined) continue;
    outLinks[ci].push(di);
  }
  const damping = 0.85;
  let rank = new Array<number>(n).fill(1 / n);
  for (let iter = 0; iter < 1000; iter++) {
    const next = new Array<number>(n).fill((1 - damping) / n);
    let danglingMass = 0;
    for (let i = 0; i < n; i++) {
      if (outLinks[i].length === 0) {
        danglingMass += rank[i];
        continue;
      }
      const share = rank[i] / outLinks[i].length;
      for (const j of outLinks[i]) next[j] += damping * share;
    }
    const danglingShare = (damping * danglingMass) / n;
    for (let i = 0; i < n; i++) next[i] += danglingShare;
    let err = 0;
    for (let i = 0; i < n; i++) err += Math.abs(next[i] - rank[i]);
    rank = next;
    if (err < 1e-12) break;
  }
  return new Map(nodeIds.map((id, i) => [id, rank[i]]));
}

/** 정책 그래프(공개 엣지)의 노드 전체 지표 계산 */
export function computeMetrics(edges: MetricEdge[]): Map<string, FilmMetrics> {
  const ids = new Set<string>();
  for (const e of edges) {
    ids.add(e.citingFilmId);
    ids.add(e.citedFilmId);
  }
  const nodeIds = [...ids].sort();
  const metrics = new Map<string, FilmMetrics>(
    nodeIds.map((id) => [id, { filmId: id, inDegree: 0, goldInDegree: 0, weightedInDegree: 0, outDegree: 0, pagerank: 0 }])
  );
  for (const e of edges) {
    const citing = metrics.get(e.citingFilmId)!;
    const cited = metrics.get(e.citedFilmId)!;
    citing.outDegree += 1;
    cited.inDegree += 1;
    if (e.signal === 'director_declared') cited.goldInDegree += 1;
    cited.weightedInDegree += edgeWeight(e);
  }
  const pr = computePagerank(nodeIds, edges);
  for (const id of nodeIds) metrics.get(id)!.pagerank = pr.get(id)!;
  return metrics;
}
