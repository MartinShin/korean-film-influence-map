import type { APIRoute } from 'astro';
import { edges, manifest } from '../../lib/site.ts';

export const GET: APIRoute = () =>
  new Response(
    JSON.stringify({ meta: { datasetVersion: manifest.datasetVersion, researchDate: manifest.researchDate }, edges }, null, 1),
    { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
  );
