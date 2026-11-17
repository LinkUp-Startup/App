import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';
import { config, contentSecurityPolicy, proxy } from '../proxy';

describe('content security policy', () => {
  it('only allows scripts and styles with the page’s nonce, and no framing', () => {
    const policy = contentSecurityPolicy('abc', false);

    expect(policy).toContain("script-src 'self' 'nonce-abc' 'strict-dynamic'");
    expect(policy).toContain("style-src 'self' 'nonce-abc'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain('upgrade-insecure-requests');
    expect(policy).not.toContain('unsafe-eval');
    expect(policy).not.toContain('unsafe-inline');
  });

  it('allows eval for React’s debugging in development only, over plain HTTP', () => {
    const policy = contentSecurityPolicy('abc', true);

    expect(policy).toContain("'unsafe-eval'");
    expect(policy).not.toContain('upgrade-insecure-requests');
  });
});

describe('proxy', () => {
  it('gives every page a fresh nonce, on the response and on the request Next.js renders', () => {
    const first = proxy(new NextRequest('https://linkup.th7bo.dev/plan/abc'));
    const second = proxy(new NextRequest('https://linkup.th7bo.dev/plan/abc'));

    const policy = first.headers.get('Content-Security-Policy')!;
    const nonce = /'nonce-([^']+)'/.exec(policy)![1];
    expect(nonce).toMatch(/^[A-Za-z0-9+/=]{20,}$/);
    expect(second.headers.get('Content-Security-Policy')).not.toContain(nonce);
    // NextResponse.next passes changed request headers on as x-middleware-request-* headers.
    expect(first.headers.get('x-middleware-request-content-security-policy')).toBe(policy);
  });

  it('uses the development policy when running in development', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const response = proxy(new NextRequest('http://localhost:3000/'));
    vi.unstubAllEnvs();

    expect(response.headers.get('Content-Security-Policy')).toContain("'unsafe-eval'");
  });

  it('skips static files', () => {
    const pattern = new RegExp(`^${config.matcher[0].source}$`);

    expect(pattern.test('/plan/abc')).toBe(true);
    expect(pattern.test('/_next/static/chunk.js')).toBe(false);
    expect(pattern.test('/favicon.ico')).toBe(false);
  });
});
