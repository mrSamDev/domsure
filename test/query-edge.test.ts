import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { $ } from '../src/query-single';
import { $$ } from '../src/query-multi';
import { resetWarnings, _setDevOverrideForTests } from '../src/env';
import { DomsureError } from '../src/errors';

describe('invalid selectors', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
  });

  it('$ rethrows invalid selectors as DomsureError', () => {
    expect(() => $('#[')).toThrow(DomsureError);
    expect(() => $('#[')).toThrow('[domsure] Invalid selector: "#["');
  });

  it('$.required rebrands DOMException', () => {
    expect(() => $.required(':invalid-pseudo::')).toThrow(DomsureError);
  });

  it('$$ rethrows invalid selectors as DomsureError', () => {
    expect(() => $$('][')).toThrow(DomsureError);
  });

  it('escaped IDs still work (no false positive)', () => {
    document.body.innerHTML = '<div id="foo.bar"></div>';
    expect($('#foo\\.bar')).not.toBeNull(); // querySelector handles escaping
  });

  it('SIMPLE_ID fast path does not swallow a malformed id', () => {
    // `#` alone is not a valid id; SIMPLE_ID regex rejects it → falls through
    expect(() => $('#')).toThrow(DomsureError);
  });
});

describe('SSR guard', () => {
  it('throws DomsureError when document is undefined', () => {
    vi.stubGlobal('document', undefined);
    try {
      expect(() => $('#x')).toThrow(DomsureError);
      expect(() => $$('.x')).toThrow(DomsureError);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('$ and $$ throw the same SSR message', () => {
    vi.stubGlobal('document', undefined);
    try {
      const singleMsg = (() => {
        try { $('#x'); } catch (e) { return (e as Error).message; }
      })();
      const multiMsg = (() => {
        try { $$('.x'); } catch (e) { return (e as Error).message; }
      })();
      expect(singleMsg).toBe(multiMsg);
      expect(singleMsg).toContain('Guard calls with typeof window checks');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('numeric and non-standard IDs', () => {
  // Regression: #123 is valid HTML but invalid as an unescaped CSS identifier.
  // querySelector('#123') throws DOMException; domsure must fallback to
  // getElementById so the element is found instead of throwing.
  beforeEach(() => {
    document.body.innerHTML =
      '<div id="123"><span id="1a"></span><div id="_x"></div></div>';
  });

  it('finds elements by numeric ID (#123) via getElementById fallback', () => {
    const el = $<HTMLDivElement>('#123');
    expect(el).not.toBeNull();
    expect(el!.id).toBe('123');
  });

  it('$.required works with numeric ID', () => {
    const el = $.required<HTMLDivElement>('#123');
    expect(el.id).toBe('123');
  });

  it('$.exists returns true for present numeric ID', () => {
    expect($.exists('#123')).toBe(true);
  });

  it('finds elements by digit-leading ID (#1a)', () => {
    const el = $<HTMLSpanElement>('#1a');
    expect(el).not.toBeNull();
    expect(el!.id).toBe('1a');
  });

  it('finds elements by underscore-leading ID (#_x) via fast path', () => {
    const el = $<HTMLDivElement>('#_x');
    expect(el).not.toBeNull();
    expect(el!.id).toBe('_x');
  });

  it('returns null for a missing numeric ID without throwing', () => {
    expect($('#999')).toBeNull();
  });

  it('$.exists returns false for missing numeric ID', () => {
    expect($.exists('#999')).toBe(false);
  });

  it('$$.exists works with numeric IDs', () => {
    expect($$.exists('#123')).toBe(true);
    expect($$.exists('#999')).toBe(false);
  });

  it('compound selector with numeric ID requires CSS escaping', () => {
    // #123 in a compound selector can't use the getElementById fallback
    // (it's not a pure ID). querySelector throws because #123 is invalid
    // unescaped CSS. Users must escape: $('#\\31 23 #\\31 a').
    // (jsdom has a bug with escaped IDs in compound selectors — test in a
    // real browser to verify the escaped form resolves.)
    expect(() => $('#123 #1a')).toThrow(DomsureError);
  });

  it('# alone still throws (not a valid pure ID)', () => {
    expect(() => $('#')).toThrow(DomsureError);
  });
});

describe('production mode behavior', () => {
  afterEach(() => _setDevOverrideForTests(null));

  it('$.optional does not warn when isDev is false', () => {
    _setDevOverrideForTests(false);
    document.body.innerHTML = '<div id="app"></div>';
    resetWarnings();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const el = $.optional('#missing');
    expect(el).toBeNull();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('$.required still throws in production', () => {
    _setDevOverrideForTests(false);
    document.body.innerHTML = '';
    expect(() => $.required('#missing')).toThrow(DomsureError);
  });
});