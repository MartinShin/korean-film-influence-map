import type { APIRoute } from 'astro';
import { edges, filmById } from '../../lib/site.ts';

function csvCell(v: string | number | null): string {
  if (v === null) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export const GET: APIRoute = () => {
  const header = [
    'id',
    'citingFilmId',
    'citingTitle',
    'citingYear',
    'citedFilmId',
    'citedTitle',
    'citedYear',
    'relationType',
    'signal',
    'confidence',
    'publicationStatus',
    'publicExcerpt',
    'sourceUrls',
  ];
  const rows = edges.map((e) => {
    const citing = filmById.get(e.citingFilmId);
    const cited = filmById.get(e.citedFilmId);
    return [
      e.id,
      e.citingFilmId,
      citing?.titleKo ?? '',
      citing?.year ?? '',
      e.citedFilmId,
      cited?.titleKo ?? '',
      cited?.year ?? '',
      e.relationType,
      e.signal,
      e.confidence,
      e.publicationStatus,
      e.evidence.publicExcerpt,
      e.sources.map((s) => s.url).join(' '),
    ]
      .map(csvCell)
      .join(',');
  });
  const body = '﻿' + [header.join(','), ...rows].join('\r\n') + '\r\n';
  return new Response(body, { headers: { 'Content-Type': 'text/csv; charset=utf-8' } });
};
