/**
 * base 경로를 포함한 내부 링크 생성.
 * 허브(www.shinhocheol.com) 프록시가 끝 슬래시 경로를 전달하지 못하므로
 * 모든 내부 링크는 끝 슬래시 없는 형태로 만든다 (호스트가 양쪽 다 서빙).
 */
const base = import.meta.env.BASE_URL.replace(/\/$/, '');

export function url(path: string): string {
  if (path === '' || path === '/') return base;
  const clean = path.startsWith('/') ? path : '/' + path;
  return base + clean.replace(/\/$/, '');
}
