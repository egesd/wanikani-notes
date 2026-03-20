import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  searchSubjects,
  getStudyMaterials,
  createStudyMaterial,
  updateStudyMaterial,
} from '../src/services/wanikani.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('searchSubjects', () => {
  it('sends correct request with auth headers', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    });

    await searchSubjects('my-token', '走る');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/subjects?types=vocabulary,kana_vocabulary&slugs=%E8%B5%B0%E3%82%8B'),
      {
        headers: {
          Authorization: 'Bearer my-token',
          'Wanikani-Revision': '20170710',
          'Content-Type': 'application/json; charset=utf-8',
        },
      },
    );
  });

  it('returns subjects data', async () => {
    const fakeSubjects = [{ id: 1, object: 'vocabulary', data: { characters: '走る' } }];
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: fakeSubjects }),
    });

    const result = await searchSubjects('tok', '走る');
    expect(result).toEqual(fakeSubjects);
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 401 });
    await expect(searchSubjects('bad', '走る')).rejects.toThrow('WaniKani subjects error: 401');
  });

  it('URL-encodes the slug parameter', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    });

    await searchSubjects('tok', '食べる');

    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain('slugs=%E9%A3%9F%E3%81%B9%E3%82%8B');
  });
});

describe('getStudyMaterials', () => {
  it('returns first matching material', async () => {
    const material = { id: 10, object: 'study_material', data: { subject_id: 42 } };
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [material] }),
    });

    const result = await getStudyMaterials('tok', 42);
    expect(result).toEqual(material);
  });

  it('returns null when no materials found', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    });

    const result = await getStudyMaterials('tok', 999);
    expect(result).toBeNull();
  });

  it('sends correct URL with subject_ids', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    });

    await getStudyMaterials('tok', 42);

    const url = mockFetch.mock.calls[0][0];
    expect(url).toContain('/study_materials?subject_ids=42');
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 401 });
    await expect(getStudyMaterials('bad', 42)).rejects.toThrow('WaniKani study_materials error: 401');
  });
});

describe('createStudyMaterial', () => {
  it('sends POST with correct body', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 1 }),
    });

    await createStudyMaterial('tok', 42, 'my note', ['syn1', 'syn2']);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/study_materials'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          study_material: {
            subject_id: 42,
            meaning_note: 'my note',
            meaning_synonyms: ['syn1', 'syn2'],
          },
        }),
      }),
    );
  });

  it('throws with body on non-ok response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 422,
      text: () => Promise.resolve('{"error":"already exists"}'),
    });

    await expect(
      createStudyMaterial('tok', 42, 'note', []),
    ).rejects.toThrow('WaniKani create study_material error: 422');
  });
});

describe('updateStudyMaterial', () => {
  it('sends PUT with correct body and URL', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 100 }),
    });

    await updateStudyMaterial('tok', 100, 'updated note', ['a']);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/study_materials/100'),
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          study_material: {
            meaning_note: 'updated note',
            meaning_synonyms: ['a'],
          },
        }),
      }),
    );
  });

  it('throws with body on non-ok response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      text: () => Promise.resolve('not found'),
    });

    await expect(
      updateStudyMaterial('tok', 999, 'note', []),
    ).rejects.toThrow('WaniKani update study_material error: 404');
  });
});
