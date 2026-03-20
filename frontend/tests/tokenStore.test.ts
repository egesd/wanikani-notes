import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadToken, saveToken, clearToken } from '../src/lib/tokenStore';

// Mock localStorage
const store = new Map<string, string>();
const localStorageMock = {
  getItem: vi.fn((key: string) => store.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => store.set(key, value)),
  removeItem: vi.fn((key: string) => store.delete(key)),
};
vi.stubGlobal('localStorage', localStorageMock);

beforeEach(() => {
  store.clear();
  vi.clearAllMocks();
});

describe('tokenStore', () => {
  it('loadToken returns empty string when nothing stored', () => {
    expect(loadToken()).toBe('');
  });

  it('saveToken persists and loadToken retrieves', () => {
    saveToken('abc123');
    expect(loadToken()).toBe('abc123');
  });

  it('clearToken removes the stored token', () => {
    saveToken('abc123');
    clearToken();
    expect(loadToken()).toBe('');
  });

  it('uses the correct storage key', () => {
    saveToken('test');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('wk_api_token', 'test');
  });

  it('loadToken returns empty string if localStorage throws', () => {
    localStorageMock.getItem.mockImplementationOnce(() => {
      throw new Error('blocked');
    });
    expect(loadToken()).toBe('');
  });
});
