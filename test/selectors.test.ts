import { describe, it, expect, afterEach } from 'vitest';
import { defineSelectors } from '../src/selectors';
import { DomsureError } from '../src/errors';
import { _setDevOverrideForTests } from '../src/env';

describe('defineSelectors', () => {
  it('returns a frozen object with literal values', () => {
    const S = defineSelectors({ navbar: '#navbar', heroCta: '.hero-cta' } as const);
    expect(S.navbar).toBe('#navbar');
    expect(S.heroCta).toBe('.hero-cta');
  });

  it('prevents mutation at runtime', () => {
    const S = defineSelectors({ foo: '#foo' } as const);
    expect(() => {
      (S as any).foo = '#bar';
    }).toThrow();
  });

  it('allows iteration over keys and values', () => {
    const S = defineSelectors({ a: '#a', b: '.b' } as const);
    expect(Object.keys(S)).toEqual(['a', 'b']);
    expect(Object.values(S)).toEqual(['#a', '.b']);
  });
});

describe('defineSelectors validation (dev)', () => {
  it('throws on non-string value', () => {
    expect(() => defineSelectors({ x: 42 as unknown as string } as const)).toThrow(DomsureError);
    expect(() => defineSelectors({ x: 42 as unknown as string } as const)).toThrow(
      'expected a selector string',
    );
  });

  it('throws on duplicate selector across keys', () => {
    expect(() => defineSelectors({ a: '#nav', b: '#nav' } as const)).toThrow(DomsureError);
    expect(() => defineSelectors({ a: '#nav', b: '#nav' } as const)).toThrow(
      'duplicate selector "#nav"',
    );
  });

  it('still freezes and returns the map when valid', () => {
    const S = defineSelectors({ navbar: '#navbar', items: '.item' } as const);
    expect(Object.isFrozen(S)).toBe(true);
    expect(() => {
      (S as any).navbar = '#x';
    }).toThrow();
  });
});

describe('defineSelectors validation (production)', () => {
  afterEach(() => _setDevOverrideForTests(null));

  it('skips validation in production — non-string value does not throw', () => {
    _setDevOverrideForTests(false);
    // In dev this would throw; in prod the validation is DCE'd out.
    const S = defineSelectors({ x: 42 as unknown as string } as const);
    expect((S as any).x).toBe(42);
    expect(Object.isFrozen(S)).toBe(true);
  });

  it('skips duplicate detection in production', () => {
    _setDevOverrideForTests(false);
    const S = defineSelectors({ a: '#nav', b: '#nav' } as const);
    expect(S.a).toBe('#nav');
    expect(S.b).toBe('#nav');
  });
});