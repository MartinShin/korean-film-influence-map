import type { APIRoute } from 'astro';
import { films } from '../lib/data';

const staticPaths = ['/', '/rankings/', '/map/', '/films/', '/methodology/', '/data/', '/about/'];

export const GET: APIRoute = ({ site }) => {
  const base = site || new URL('https://korean-film-influence-map.vercel.app');
  const paths = [...staticPaths, ...films.map((film) => `/films/${film.id}/`)];
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths.map((path) => `  <url><loc>${new URL(path, base).href}</loc></url>`).join('\n')}\n</urlset>\n`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
