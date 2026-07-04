import { describe, it, expect, expectTypeOf, beforeEach } from 'vitest';
import { $, $$, DomsureError, defineSelectors, resetWarnings } from '../src/index';
import type { SelectorSchema, SelectorMap } from '../src/index';

// Public API contract tests. These pin the surface that consumers depend on —
// type signatures AND runtime behavior guarantees — so refactors can't silently
// break callers. Distinct from query.test.ts (which tests implementation paths):
// these assert the *contract*, not the mechanism.

describe('public API type contract', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"><span class="item"></span></div>';
  });

  it('$ defaults to HTMLElement | null', () => {
    expectTypeOf($('#app')).toEqualTypeOf<HTMLElement | null>();
  });

  it('$.required defaults to HTMLElement (never null)', () => {
    expectTypeOf($.required('#app')).toEqualTypeOf<HTMLElement>();
  });

  it('$.optional defaults to HTMLElement | null', () => {
    expectTypeOf($.optional('#app')).toEqualTypeOf<HTMLElement | null>();
  });

  it('$.exists returns boolean', () => {
    expectTypeOf($.exists('#app')).toEqualTypeOf<boolean>();
  });

  it('$$ defaults to HTMLElement[]', () => {
    expectTypeOf($$('.item')).toEqualTypeOf<HTMLElement[]>();
  });

  it('$$.required defaults to HTMLElement[]', () => {
    expectTypeOf($$.required('.item')).toEqualTypeOf<HTMLElement[]>();
  });

  it('DomsureError extends Error and carries selector?', () => {
    expectTypeOf<DomsureError>().toMatchTypeOf<Error>();
    expectTypeOf<DomsureError>().toHaveProperty('selector').toEqualTypeOf<string | undefined>();
  });

  it('defineSelectors returns a readonly SelectorMap', () => {
    const S = defineSelectors({ app: '#app', item: '.item' } as const);
    expectTypeOf(S).toEqualTypeOf<SelectorMap<{ readonly app: '#app'; readonly item: '.item' }>>();
  });

  it('resetWarnings returns void', () => {
    expectTypeOf(resetWarnings()).toEqualTypeOf<void>();
  });
});

describe('public API runtime contract', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"><span class="item">a</span><span class="item">b</span></div>';
    resetWarnings();
  });

  it('$.required never returns null — throws DomsureError instead', () => {
    const el = $.required('#app');
    expect(el).not.toBeNull();
    expect(() => $.required('#missing')).toThrow(DomsureError);
  });

  it('$.required error carries the selector that failed', () => {
    try {
      $.required('#missing');
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(DomsureError);
      expect((e as DomsureError).selector).toBe('#missing');
    }
  });

  it('$.optional returns null for a miss without throwing', () => {
    expect($.optional('#missing')).toBeNull();
  });

  it('$$ returns a real Array, not a NodeList', () => {
    const els = $$('.item');
    expect(Array.isArray(els)).toBe(true);
    expect(els).not.toBeInstanceOf(NodeList);
  });

  it('$$.required throws on empty and returns a non-empty array otherwise', () => {
    expect(() => $$.required('.missing')).toThrow(DomsureError);
    const els = $$.required('.item');
    expect(els.length).toBeGreaterThan(0);
  });

  it('DomsureError is instanceof Error with name DomsureError', () => {
    try {
      $.required('#missing');
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
      expect((e as Error).name).toBe('DomsureError');
    }
  });

  it('defineSelectors returns a frozen object', () => {
    const S = defineSelectors({ app: '#app' } as const);
    expect(Object.isFrozen(S)).toBe(true);
  });
});