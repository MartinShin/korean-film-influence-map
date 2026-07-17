# 한국영화 영향력 지도 (Korean Film Influence Map)

논문 인용 네트워크처럼, 한국영화 사이의 영향·오마주·리메이크 관계를 감독 인터뷰·평론·기사에서 수집해
인용 그래프를 만들고 그 위에서 순위(감독 직접 언급 / 피인용 / PageRank / 가중 점수)를 계산하는 실험.

- 공개 사이트: https://www.shinhocheol.com/cinema
- 데이터 다운로드: https://www.shinhocheol.com/cinema/data/

## 구조

- Astro 정적 사이트 (서버·DB·로그인 없음). 순위는 빌드 시점에 공개 스냅샷에서 자동 계산된다.
- `data/public/` - 공개 데이터 스냅샷 (films.v2.json, dataset.v2.json). 이 저장소의 유일한 데이터 원천.
- `scripts/generate-site-data.ts` - 스키마 검증 → 무결성 검사 → 정책 필터 → 지표 계산 → `src/data/generated/*` 생성 (빌드 전 자동 실행).
- `scripts/export-public-data.ts` - 로컬 전용. 비공개 연구 파일에서 공개 스냅샷을 갱신할 때만 쓴다 (경로는 CLI 인자로 받는다).
- `src/pages/` - 홈, 순위, 영화 목록/상세, 방법론, 데이터(JSON·CSV 엔드포인트), 소개.

## 명령

```bash
npm ci
npm run check          # astro check (타입)
npm run test           # vitest - 데이터 무결성·정규화·v2 순위 회귀
npm run build          # prebuild(generate:data) 후 astro build
npm run verify:dist    # 배포 산출물 유출 검사
npm run dev            # 개발 서버 (http://localhost:4321/cinema/)
```

## 데이터 정책

- 공개 관계(published)만 순위에 반영. 위키 단독 근거는 후보(candidate)로 분리 표시.
- 엣지 방향은 후대 인용 영화 → 선대 피인용 영화. 같은 감독 자기 작품 관계 제외.
- 모든 공개 관계에 300자 이내 근거 발췌문과 원문 출처 URL을 첨부.
- PageRank는 비가중, damping 0.85 (방법론 버전 1에 고정).

## 배포

- Vercel 정적 배포. `vercel.json`이 basePath(`/cinema`) 매핑과 루트 리다이렉트를 담당한다.
- www.shinhocheol.com/cinema 는 허브 저장소(project-hub)의 rewrites로 프록시된다.

## 남은 일

- Playwright + axe 접근성 e2e (현재는 vitest 데이터 테스트만 CI에서 돈다)
- 관계 유형별 분리 순위 (franchise 제외 “순수 영향” 순위)
- 연식 보정 지표
