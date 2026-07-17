import type { APIRoute } from 'astro';
import { films } from '../../lib/site.ts';

function csvCell(v: string | number | null): string {
  if (v === null) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export const GET: APIRoute = () => {
  const header = [
    'id',
    'titleKo',
    'year',
    'director',
    'kofaSelected2024',
    'kofaExactRank',
    'publicStatus',
    'inDegree',
    'goldInDegree',
    'weightedInDegree',
    'outDegree',
    'pagerank',
  ];
  const rows = films.map((f) =>
    [
      f.id,
      f.titleKo,
      f.year,
      f.director,
      f.kofa.selected2024 ? 1 : 0,
      f.kofa.exactRank,
      f.publicStatus,
      f.metrics?.inDegree ?? '',
      f.metrics?.goldInDegree ?? '',
      f.metrics?.weightedInDegree ?? '',
      f.metrics?.outDegree ?? '',
      f.metrics?.pagerank ?? '',
    ]
      .map(csvCell)
      .join(',')
  );
  const body = '﻿' + [header.join(','), ...rows].join('\r\n') + '\r\n';
  return new Response(body, { headers: { 'Content-Type': 'text/csv; charset=utf-8' } });
};
