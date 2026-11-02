import { describe, expect, it } from 'vitest';
import { routeRequest } from '$lib/offline/precache';

const origin = 'https://example.test';
const req = (method: string, path: string, mode: RequestMode = 'same-origin') => ({
  method,
  url: origin + path,
  mode,
  origin
});
const nav = (path: string) => req('GET', path, 'navigate');

describe('routeRequest', () => {
  it('passes non-GET requests', () => {
    expect(routeRequest(req('POST', '/m'))).toEqual({ kind: 'pass' });
    expect(routeRequest(req('PUT', '/x'))).toEqual({ kind: 'pass' });
  });
  it('passes cross-origin GET', () => {
    expect(
      routeRequest({ method: 'GET', url: 'https://other.test/a.js', mode: 'cors', origin })
    ).toEqual({ kind: 'pass' });
  });
  it('passes the worker itself', () => {
    expect(routeRequest(req('GET', '/service-worker.js'))).toEqual({ kind: 'pass' });
  });
  it('redirects a trailing slash and keeps the query', () => {
    expect(routeRequest(nav('/triads/'))).toEqual({ kind: 'redirect', location: '/triads' });
    expect(routeRequest(nav('/triads/?v=1&x=2'))).toEqual({
      kind: 'redirect',
      location: '/triads?v=1&x=2'
    });
  });
  it('serves pages by pathname', () => {
    expect(routeRequest(nav('/'))).toEqual({ kind: 'page', key: '/' });
    expect(routeRequest(nav('/triads?v=1&a=b'))).toEqual({ kind: 'page', key: '/triads' });
    expect(routeRequest(nav('/does-not-exist'))).toEqual({
      kind: 'page',
      key: '/does-not-exist'
    });
  });
  it('serves assets by pathname, ignoring the query', () => {
    expect(routeRequest(req('GET', '/_app/immutable/x.js?y=1'))).toEqual({
      kind: 'asset',
      key: '/_app/immutable/x.js'
    });
  });
});
