import type {
  LookupResponse,
  GenerateRequest,
  GeneratedNote,
  SaveRequest,
  SaveResponse,
} from '@shared/types';

async function request<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

export function lookup(word: string, token: string): Promise<LookupResponse> {
  return request<LookupResponse>('/api/lookup', { word, token });
}

export function generate(body: GenerateRequest): Promise<GeneratedNote> {
  return request<GeneratedNote>('/api/generate', body);
}

export function save(body: SaveRequest): Promise<SaveResponse> {
  return request<SaveResponse>('/api/save', body);
}
