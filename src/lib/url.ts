/** base 경로를 포함한 내부 링크 생성. trailingSlash: always 정책에 맞춘다. */
const base = import.meta.env.BASE_URL.replace(/\/$/, '');

export function url(path: string): string {
  if (path === '' || path === '/') return base + '/';
  const clean = path.startsWith('/') ? path : '/' + path;
  if (/\.[a-z]+$/i.test(clean)) return base + clean;
  return base + (clean.endsWith('/') ? clean : clean + '/');
}
