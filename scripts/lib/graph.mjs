export const SIGNAL_WEIGHT = { director_declared: 3, critic: 2, public: 1 };
export const CONFIDENCE_WEIGHT = { high: 1, medium: 2 / 3, low: 1 / 3 };

export function normalizeTitle(value) {
  return value.normalize('NFC').toLocaleLowerCase('ko-KR').replace(/[\s\p{P}\p{S}]+/gu, '');
}

export function canonicalKey(title, year) {
  return `${normalizeTitle(title)}|${year}`;
}

export function edgeWeight(edge) {
  return SIGNAL_WEIGHT[edge.signal] * CONFIDENCE_WEIGHT[edge.confidence];
}

export function computeMetrics(films, edges) {
  const metrics = Object.fromEntries(films.map((film) => [film.id, { inDegree: 0, outDegree: 0, goldInDegree: 0, weightedInDegree: 0, pageRank: 0 }]));
  const outgoing = new Map(films.map((film) => [film.id, []]));
  for (const edge of edges) {
    metrics[edge.citedFilmId].inDegree += 1;
    metrics[edge.citingFilmId].outDegree += 1;
    metrics[edge.citedFilmId].weightedInDegree += edgeWeight(edge);
    if (edge.signal === 'director_declared') metrics[edge.citedFilmId].goldInDegree += 1;
    outgoing.get(edge.citingFilmId).push(edge.citedFilmId);
  }
  const ids = films.map((film) => film.id);
  const count = ids.length;
  const damping = 0.85;
  let rank = Object.fromEntries(ids.map((id) => [id, 1 / count]));
  for (let iteration = 0; iteration < 1000; iteration += 1) {
    const dangling = ids.filter((id) => outgoing.get(id).length === 0).reduce((sum, id) => sum + rank[id], 0);
    const base = (1 - damping) / count + (damping * dangling) / count;
    const next = Object.fromEntries(ids.map((id) => [id, base]));
    for (const id of ids) {
      const targets = outgoing.get(id);
      if (targets.length === 0) continue;
      const contribution = (damping * rank[id]) / targets.length;
      for (const target of targets) next[target] += contribution;
    }
    const error = ids.reduce((sum, id) => sum + Math.abs(next[id] - rank[id]), 0);
    rank = next;
    if (error <= 1e-12) break;
  }
  for (const id of ids) {
    metrics[id].weightedInDegree = Number(metrics[id].weightedInDegree.toFixed(6));
    metrics[id].pageRank = rank[id];
  }
  return metrics;
}

const stableIdCompare = (a, b) => a.id.localeCompare(b.id, 'en');

export function computeRankings(films, metrics) {
  const enriched = films.map((film) => ({ ...film, metrics: metrics[film.id] }));
  const byPageRank = [...enriched].sort((a, b) => b.metrics.pageRank - a.metrics.pageRank || b.metrics.weightedInDegree - a.metrics.weightedInDegree || stableIdCompare(a, b));
  const byInDegree = [...enriched].sort((a, b) => b.metrics.inDegree - a.metrics.inDegree || b.metrics.weightedInDegree - a.metrics.weightedInDegree || b.metrics.pageRank - a.metrics.pageRank || stableIdCompare(a, b));
  const byGold = [...enriched].filter((film) => film.metrics.goldInDegree > 0).sort((a, b) => b.metrics.goldInDegree - a.metrics.goldInDegree || b.metrics.weightedInDegree - a.metrics.weightedInDegree || b.metrics.inDegree - a.metrics.inDegree || stableIdCompare(a, b));
  return { byPageRank, byInDegree, byGold };
}
