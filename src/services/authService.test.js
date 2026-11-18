import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The network is down: every request fails the way api.js reports a failed fetch.
vi.mock('./api', () => {
  const down = () => Promise.reject(Object.assign(new Error('fetch failed'), { isNetworkError: true }));
  return {
    api: { post: vi.fn(down), get: vi.fn(down), put: vi.fn(down), refreshSession: vi.fn(() => Promise.resolve(null)) },
    setAccessToken: vi.fn(),
  };
});

const store = new Map();
vi.stubGlobal('localStorage', {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
});

const { authService } = await import('./authService');
const { setAccessToken } = await import('./api');

describe('authService has no offline or mock login', () => {
  beforeEach(() => { store.clear(); vi.clearAllMocks(); });

  it('login with the server unreachable fails with one clear message and signs nobody in', async () => {
    await expect(authService.login('anyone@example.com', 'Whatever1')).rejects.toThrow('Cannot reach the server. Please try again.');
    expect(setAccessToken).not.toHaveBeenCalled();
    expect(store.size).toBe(0); // no session hint was stored
  });

  it('admin login, register and Google sign-in fail the same way', async () => {
    await expect(authService.adminLogin('a@example.com', 'x')).rejects.toThrow('Cannot reach the server');
    await expect(authService.register('N', 'n@example.com', 'Whatever1', 'x')).rejects.toThrow('Cannot reach the server');
    await expect(authService.googleLogin('credential')).rejects.toThrow('Cannot reach the server');
    expect(setAccessToken).not.toHaveBeenCalled();
  });

  it('a real server answer starts a session', async () => {
    const { api } = await import('./api');
    api.post.mockResolvedValueOnce({ access_token: 'tok', user: { id: 'u1' } });
    await authService.login('a@example.com', 'Whatever1');
    expect(setAccessToken).toHaveBeenCalledWith('tok');
  });

  it('the source contains no mock data, demo user or fallback login', () => {
    const source = readFileSync(new URL('./authService.js', import.meta.url), 'utf8');
    const code = source.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n'); // comments may say "no mock login"
    expect(code).not.toMatch(/data\/mock|mockUser|mockLogin|demoUser|demo@|offlineLogin|fakeToken/i);
    expect(source).not.toMatch(/import .*\/data\//);
  });
});
