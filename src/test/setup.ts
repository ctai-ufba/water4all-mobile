import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock localStorage for test isolation
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: vi.fn((key: string): string | null => store[key] || null),
    setItem: vi.fn((key: string, value: string): void => {
      store[key] = value.toString();
    }),
    removeItem: vi.fn((key: string): void => {
      delete store[key];
    }),
    clear: vi.fn((): void => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Default fetch mock returning synthetic weather to isolate tests from real network
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({
    current: {
      temperature_2m: 22.0,
      relative_humidity_2m: 60,
      precipitation: 0.0,
      time: '2026-09-20T12:00:00Z',
    },
    daily: {
      precipitation_sum: [0.0],
      time: ['2026-09-20'],
    },
  }),
});

