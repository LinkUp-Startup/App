import { vi } from 'vitest';

/** An in-memory stand-in for next/headers' cookies(), recording the options each cookie was set with. */
export function cookieJar() {
  const values = new Map<string, { value: string; options?: Record<string, unknown> }>();
  const jar = {
    get: (name: string) =>
      values.has(name) ? { name, value: values.get(name)!.value } : undefined,
    set: vi.fn((name: string, value: string, options?: Record<string, unknown>) => {
      values.set(name, { value, options });
    }),
    delete: vi.fn((name: string) => {
      values.delete(name);
    }),
  };
  return { jar, values };
}
