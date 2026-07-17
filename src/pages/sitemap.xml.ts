import type { APIRoute } from 'astro';
import { publishedFilms, manifest } from '../lib/site.ts';

export const GET: APIRoute = ({ site }) => {
  const base = new URL(import.meta.env.BASE_URL.replace(/\/$/, '') + '/', site!).href;
  const staticPaths = ['', 'rankings/', 'films/', 'methodology/', 'data/', 'about/'];
  const urls = [
    ...staticPaths.map((p) => base + p),
    ...publishedFilms.map((f) => `${base}films/${f.id}/`),
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u}</loc><lastmod>${manifest.researchDate}</lastmod></url>`).join('\n')}
</urlset>
`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
