import type { WKSubject, WKStudyMaterial } from '@shared/types.js';
import { cacheGet, cacheSet } from './cacheService.js';

const WK_BASE = 'https://api.wanikani.com/v2';
const WK_REVISION = '20170710';

function headers(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'Wanikani-Revision': WK_REVISION,
    'Content-Type': 'application/json; charset=utf-8',
  };
}

export async function searchSubjects(
  token: string,
  slug: string,
): Promise<WKSubject[]> {
  const cacheKey = `wk-subjects:${slug}`;
  const cached = cacheGet<WKSubject[]>(cacheKey);
  if (cached) return cached;

  const url = `${WK_BASE}/subjects?types=vocabulary,kana_vocabulary&slugs=${encodeURIComponent(slug)}`;
  const res = await fetch(url, { headers: headers(token) });
  if (!res.ok) {
    throw new Error(`WaniKani subjects error: ${res.status}`);
  }
  const json = await res.json();
  const subjects = json.data as WKSubject[];
  cacheSet(cacheKey, subjects);
  return subjects;
}

export async function getStudyMaterials(
  token: string,
  subjectId: number,
): Promise<WKStudyMaterial | null> {
  const url = `${WK_BASE}/study_materials?subject_ids=${subjectId}`;
  const res = await fetch(url, { headers: headers(token) });
  if (!res.ok) {
    throw new Error(`WaniKani study_materials error: ${res.status}`);
  }
  const json = await res.json();
  const materials = json.data as WKStudyMaterial[];
  return materials.length > 0 ? materials[0] : null;
}

export async function createStudyMaterial(
  token: string,
  subjectId: number,
  meaningNote: string,
  meaningSynonyms: string[],
): Promise<WKStudyMaterial> {
  const res = await fetch(`${WK_BASE}/study_materials`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({
      study_material: {
        subject_id: subjectId,
        meaning_note: meaningNote,
        meaning_synonyms: meaningSynonyms,
      },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`WaniKani create study_material error: ${res.status} ${body}`);
  }
  return (await res.json()) as WKStudyMaterial;
}

export async function updateStudyMaterial(
  token: string,
  studyMaterialId: number,
  meaningNote: string,
  meaningSynonyms: string[],
): Promise<WKStudyMaterial> {
  const res = await fetch(`${WK_BASE}/study_materials/${studyMaterialId}`, {
    method: 'PUT',
    headers: headers(token),
    body: JSON.stringify({
      study_material: {
        meaning_note: meaningNote,
        meaning_synonyms: meaningSynonyms,
      },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`WaniKani update study_material error: ${res.status} ${body}`);
  }
  return (await res.json()) as WKStudyMaterial;
}
