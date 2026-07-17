import type { APIRoute } from 'astro';
import { films, manifest } from '../../lib/site.ts';

export const GET: APIRoute = () =>
  new Response(
    JSON.stringify({ meta: { datasetVersion: manifest.datasetVersion, researchDate: manifest.researchDate }, films }, null, 1),
    { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
  );
