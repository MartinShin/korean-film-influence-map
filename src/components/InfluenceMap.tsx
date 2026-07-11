import { useMemo, useState } from 'react';
import type { Edge, Film, Signal } from '../data/types';

type Props = { films: Film[]; edges: Edge[] };
const SIGNAL_LABEL: Record<Signal, string> = { director_declared: '감독 직접 언급', critic: '평론가', public: '대중' };
const RELATION_LABEL: Record<string, string> = { influence: '영향', thematic: '주제 계승', homage: '오마주', reference: '참조', parody: '패러디', visual_influence: '시각적 영향', remake_official: '공식 리메이크' };
const W = 1240;
const H = 620;
const LEFT = 42;
const RIGHT = 34;
const TOP = 50;
const BOTTOM = 52;

export default function InfluenceMap({ films, edges }: Props) {
  const [signals, setSignals] = useState<Set<Signal>>(new Set(['director_declared', 'critic', 'public']));
  const [confidence, setConfidence] = useState('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(() => new URLSearchParams(window.location.search).get('focus'));
  const filmMap = useMemo(() => new Map(films.map((film) => [film.id, film])), [films]);
  const years = films.map((film) => film.year);
  const minYear = Math.min(...years) - 3;
  const maxYear = Math.max(...years) + 3;
  const maxWeight = Math.max(...films.map((film) => film.metrics.weightedInDegree), 1);
  const x = (year: number) => LEFT + ((year - minYear) / (maxYear - minYear)) * (W - LEFT - RIGHT);
  const y = (film: Film) => H - BOTTOM - Math.sqrt(film.metrics.weightedInDegree / maxWeight) * (H - TOP - BOTTOM - 90) - ((Number(film.id.slice(-2)) % 5) * 5);

  const filteredEdges = edges.filter((edge) => signals.has(edge.signal) && (confidence === 'all' || edge.confidence === confidence));
  const visibleIds = new Set(filteredEdges.flatMap((edge) => [edge.citingFilmId, edge.citedFilmId]));
  const selectedFilm = selectedId ? filmMap.get(selectedId) : null;
  const selectedEdges = selectedId ? filteredEdges.filter((edge) => edge.citingFilmId === selectedId || edge.citedFilmId === selectedId) : [];
  const important = new Set(films.filter((film) => film.metrics.inDegree >= 3 || film.metrics.goldInDegree >= 2).map((film) => film.id));

  function toggleSignal(signal: Signal) {
    setSignals((current) => {
      const next = new Set(current);
      if (next.has(signal)) next.delete(signal); else next.add(signal);
      return next;
    });
  }

  function chooseFilm(id: string | null) {
    setSelectedId(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set('focus', id); else url.searchParams.delete('focus');
    window.history.replaceState({}, '', url);
  }

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    const normalized = query.replaceAll(' ', '').toLowerCase();
    const match = films.find((film) => film.titleKo.replaceAll(' ', '').toLowerCase().includes(normalized));
    if (match) chooseFilm(match.id);
  }

  const ticks = [1960, 1970, 1980, 1990, 2000, 2010, 2020];

  return (
    <section aria-labelledby="map-heading">
      <h2 id="map-heading" className="sr-only">영화 영향 관계 계보 지도</h2>
      <form className="map-controls" onSubmit={submitSearch}>
        <label>영화 검색
          <input value={query} onChange={(event) => setQuery(event.target.value)} list="film-options" placeholder="예: 하녀" />
          <datalist id="film-options">{films.map((film) => <option key={film.id} value={film.titleKo} />)}</datalist>
        </label>
        <button className="button" type="submit">찾기</button>
        <label>신뢰도
          <select value={confidence} onChange={(event) => setConfidence(event.target.value)}>
            <option value="all">전체</option><option value="high">높음</option><option value="medium">중간</option><option value="low">낮음</option>
          </select>
        </label>
        <fieldset>
          <legend className="eyebrow">신호</legend>
          <div className="check-row">
            {(Object.keys(SIGNAL_LABEL) as Signal[]).map((signal) => (
              <label key={signal}><input type="checkbox" checked={signals.has(signal)} onChange={() => toggleSignal(signal)} />{SIGNAL_LABEL[signal]}</label>
            ))}
          </div>
        </fieldset>
        {selectedId && <button className="button" type="button" onClick={() => chooseFilm(null)}>선택 해제</button>}
      </form>
      <div className="legend" aria-label="선 종류 범례"><span className="gold">감독 직접 언급</span><span className="blue">평론가</span><span className="aqua">대중</span></div>
      <div className="map-stage">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby="graph-title graph-desc">
          <title id="graph-title">1960년부터 2025년까지 한국영화 영향 관계</title>
          <desc id="graph-desc">가로축은 개봉 연도, 세로 위치는 가중 영향 점수입니다. 곡선은 후대 영화가 선대 영화를 참조한 방향을 나타냅니다.</desc>
          {ticks.map((tick) => <g key={tick}><line className="map-grid" x1={x(tick)} y1={TOP} x2={x(tick)} y2={H - BOTTOM} /><text className="map-axis-label" x={x(tick)} y={H - 22} textAnchor="middle">{tick}</text></g>)}
          {filteredEdges.map((edge) => {
            const source = filmMap.get(edge.citingFilmId)!;
            const target = filmMap.get(edge.citedFilmId)!;
            const sx = x(source.year), sy = y(source), tx = x(target.year), ty = y(target);
            const lift = 28 + Math.abs(sx - tx) * 0.13;
            const cy = Math.min(sy, ty) - lift;
            const active = selectedId && (edge.citingFilmId === selectedId || edge.citedFilmId === selectedId);
            return <path key={edge.id} className={`map-edge ${edge.signal}${active ? ' active' : ''}`} d={`M ${sx} ${sy} C ${sx - (sx - tx) * 0.3} ${cy}, ${tx + (sx - tx) * 0.3} ${cy}, ${tx} ${ty}`}><title>{source.titleKo} → {target.titleKo} · {SIGNAL_LABEL[edge.signal]}</title></path>;
          })}
          {films.filter((film) => visibleIds.has(film.id)).map((film, index) => {
            const active = film.id === selectedId;
            const muted = Boolean(selectedId && film.id !== selectedId && !selectedEdges.some((edge) => edge.citingFilmId === film.id || edge.citedFilmId === film.id));
            const showLabel = important.has(film.id) || active;
            return <a key={film.id} href={`/films/${film.id}/`} aria-label={`${film.titleKo}, ${film.year}년, 피인용 ${film.metrics.inDegree}`} onMouseEnter={(event) => { event.preventDefault(); setSelectedId(film.id); }} onFocus={() => setSelectedId(film.id)} onClick={(event) => { event.preventDefault(); chooseFilm(film.id); }} className={`map-node${film.metrics.goldInDegree > 0 ? ' direct' : ''}${active ? ' active' : ''}${muted ? ' muted' : ''}`}>
              <circle cx={x(film.year)} cy={y(film)} r={5 + Math.sqrt(film.metrics.inDegree + film.metrics.goldInDegree) * 2.1} />
              {showLabel && <text x={x(film.year)} y={y(film) + (index % 2 === 0 ? -13 : 19)} textAnchor="middle">{film.titleKo}</text>}
            </a>;
          })}
        </svg>
      </div>
      <div className="evidence-panel" aria-live="polite">
        {selectedFilm ? <>
          <h3>{selectedFilm.titleKo} ({selectedFilm.year}) · 연결 관계 {selectedEdges.length}개</h3>
          {selectedEdges.length ? <ul className="edge-list">{selectedEdges.slice(0, 4).map((edge) => {
            const source = filmMap.get(edge.citingFilmId)!;
            const target = filmMap.get(edge.citedFilmId)!;
            return <li key={edge.id}><div className="edge-head"><strong>{source.titleKo} → {target.titleKo}</strong><span className="badge gold">{SIGNAL_LABEL[edge.signal]}</span><span className="badge">{RELATION_LABEL[edge.relationType]}</span></div><p>{edge.evidence.publicExcerpt}</p><a className="source-link" href={edge.sources[0].url} target="_blank" rel="noopener noreferrer">원문 출처 열기</a></li>;
          })}</ul> : <p className="empty">현재 필터에서 표시할 관계가 없습니다.</p>}
        </> : <p className="empty">영화 노드를 선택하면 연결 관계와 근거를 확인할 수 있습니다.</p>}
      </div>
    </section>
  );
}
