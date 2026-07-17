export const SIGNAL_LABEL: Record<string, string> = {
  director_declared: '감독 직접 언급',
  critic: '평론가',
  public: '대중',
};

/** 색약 대응: 색 + 기호 병행 표기 */
export const SIGNAL_MARK: Record<string, string> = {
  director_declared: '◆',
  critic: '●',
  public: '○',
};

export const CONFIDENCE_LABEL: Record<string, string> = {
  high: '신뢰도 높음',
  medium: '신뢰도 중간',
  low: '신뢰도 낮음',
};

export const RELATION_LABEL: Record<string, string> = {
  influence: '영향',
  thematic: '주제 계승',
  homage: '오마주',
  reference: '참조',
  parody: '패러디',
  visual_influence: '시각 스타일 영향',
  remake_official: '공식 리메이크',
};

export const METRIC_LABEL: Record<string, string> = {
  gold: '감독 직접 언급 수',
  inDegree: '피인용 수',
  weighted: '가중 영향 점수',
  pagerank: 'PageRank',
};
