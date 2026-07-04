import { describe, it, expect, beforeEach, vi } from 'vitest';
import { $ } from '../src/query-single';
import { resetWarnings, _setDevOverrideForTests } from '../src/env';
import { DomsureError } from '../src/errors';

describe('$ (silent query)', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"><span class="item">a</span><span class="item">b</span></div>';
  });

  it('finds elements by ID via getElementById', () => {
    const el = $<HTMLDivElement>('#app');
    expect(el).not.toBeNull();
    expect(el!.id).toBe('app');
  });

  it('finds elements by class via querySelector', () => {
    const el = $<HTMLSpanElement>('.item');
    expect(el).not.toBeNull();
    expect(el!.textContent).toBe('a');
  });

  it('finds elements by compound selector', () => {
    expect($('div#app')).not.toBeNull();
  });

  it('returns null for missing elements', () => {
    expect($('#nonexistent')).toBeNull();
  });

  it('does NOT warn on missing elements', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    $('#nonexistent');
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('# fast path correctness', () => {
  beforeEach(() => {
    document.body.innerHTML =
      '<div id="app" class="active"><span class="item">a</span></div>';
  });

  it('resolves compound descendant selectors starting with #', () => {
    // Regression: naive selector[0] === '#' fast path returned null here
    const el = $('#app .item');
    expect(el).not.toBeNull();
    expect(el!.textContent).toBe('a');
  });

  it('resolves #id.class compound selectors', () => {
    expect($('#app.active')).not.toBeNull();
    expect($('#app.missing')).toBeNull();
  });

  it('resolves #id > child selectors', () => {
    expect($('#app > .item')).not.toBeNull();
  });

  it('$.exists handles compound # selectors', () => {
    expect($.exists('#app .item')).toBe(true);
    expect($.exists('#app .missing')).toBe(false);
  });

  it('$.required handles compound # selectors', () => {
    expect(() => $.required('#app .item')).not.toThrow();
  });
});

describe('$.required (assert query)', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
  });

  it('returns element when found', () => {
    const el = $.required<HTMLElement>('#app');
    expect(el.id).toBe('app');
  });

  it('throws for missing #id', () => {
    expect(() => $.required('#missing')).toThrow(
      '[domsure] Required element not found: #missing',
    );
  });

  it('throws for missing .class', () => {
    expect(() => $.required('.missing')).toThrow(
      '[domsure] Required element not found: .missing',
    );
  });

  it('throws for missing compound selector', () => {
    expect(() => $.required('div.missing')).toThrow(
      '[domsure] Required element not found: div.missing',
    );
  });

  it('throws a DomsureError instance', () => {
    try {
      $.required('#missing');
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(DomsureError);
      expect(e).toBeInstanceOf(Error);
      expect((e as DomsureError).name).toBe('DomsureError');
      expect((e as DomsureError).selector).toBe('#missing');
      expect((e as Error).message).toBe('[domsure] Required element not found: #missing');
    }
  });
});

describe('$.optional (warn-once query)', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    resetWarnings();
  });

  it('returns element when found', () => {
    expect($.optional<HTMLElement>('#app')).not.toBeNull();
  });

  it('returns null when not found', () => {
    expect($.optional('#missing')).toBeNull();
  });

  it('warns once per selector in dev mode', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    $.optional('#missing');
    $.optional('#missing');
    $.optional('#missing');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith('[domsure] Element not found: #missing');
    warn.mockRestore();
  });

  it('warns independently for different selectors', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    $.optional('#missing-1');
    $.optional('#missing-2');
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it('does not warn when element is found', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    $.optional('#app');
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('$.exists (boolean check)', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"><span class="item">a</span></div>';
  });

  it('returns true when element exists', () => {
    expect($.exists('#app')).toBe(true);
    expect($.exists('.item')).toBe(true);
  });

  it('returns false when element does not exist', () => {
    expect($.exists('#missing')).toBe(false);
    expect($.exists('.missing')).toBe(false);
  });

  it('does not warn', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    $.exists('#missing');
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('$.tryRequired (result tuple, never throws)', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    resetWarnings();
  });

  it('returns [null, element] when found', () => {
    const [err, el] = $.tryRequired<HTMLElement>('#app');
    expect(err).toBeNull();
    expect(el).not.toBeNull();
    expect(el!.id).toBe('app');
  });

  it('returns [DomsureError, null] when missing', () => {
    const [err, el] = $.tryRequired('#missing');
    expect(el).toBeNull();
    expect(err).toBeInstanceOf(DomsureError);
    expect(err!.selector).toBe('#missing');
    // Same message $.required would have thrown — monitoring parity.
    expect(err!.message).toBe('[domsure] Required element not found: #missing');
  });

  it('never throws on a miss — the defining property', () => {
    expect(() => $.tryRequired('#missing')).not.toThrow();
  });

  it('returns a rebranded error for an invalid selector, no throw', () => {
    const [err, el] = $.tryRequired('#[');
    expect(el).toBeNull();
    expect(err).toBeInstanceOf(DomsureError);
    expect(err!.message).toBe('[domsure] Invalid selector: "#["');
    expect(() => $.tryRequired('#[')).not.toThrow();
  });

  it('returns [DomsureError, null] under SSR instead of throwing', () => {
    vi.stubGlobal('document', undefined);
    try {
      const [err, el] = $.tryRequired('#x');
      expect(el).toBeNull();
      expect(err).toBeInstanceOf(DomsureError);
      // Contrast: $.required throws under SSR, tryRequired returns the error.
      expect(() => $.required('#x')).toThrow(DomsureError);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('does not auto-warn — the caller owns the error', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    $.tryRequired('#missing');
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('returns the error tuple in production (no warn, no throw)', () => {
    _setDevOverrideForTests(false);
    try {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const [err, el] = $.tryRequired('#missing');
      expect(el).toBeNull();
      expect(err).toBeInstanceOf(DomsureError);
      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();
    } finally {
      _setDevOverrideForTests(null);
    }
  });

  it('handles compound # selectors', () => {
    document.body.innerHTML =
      '<div id="app" class="active"><span class="item">a</span></div>';
    const [err, el] = $.tryRequired('#app .item');
    expect(err).toBeNull();
    expect(el!.textContent).toBe('a');
  });

  it('works with numeric IDs', () => {
    document.body.innerHTML = '<div id="123"></div>';
    const [err, el] = $.tryRequired<HTMLDivElement>('#123');
    expect(err).toBeNull();
    expect(el!.id).toBe('123');
  });

  it('rethrows a non-DomsureError failure instead of rebranding it', () => {
    // Defense-in-depth guard: tryRequired converts DomsureError throws into
    // tuples, but a foreign (non-Domsure) throw must escape — never be silently
    // rebranded as a DomsureError. We exercise this via the PURE_ID path
    // (#123): querySelector throws DOMException (caught by the inner fallback),
    // then getElementById is called *unwrapped* by safeQuery. Stubbing it to
    // throw a foreign TypeError propagates raw out of query() into tryRequired,
    // which must rethrow it rather than returning [TypeError-as-Domsure, null].
    document.body.innerHTML = '<div id="123"></div>';
    const boom = new TypeError('engine bug');
    const spy = vi.spyOn(document, 'getElementById').mockImplementation(() => {
      throw boom;
    });
    try {
      expect(() => $.tryRequired('#123')).toThrow(TypeError);
      expect(() => $.tryRequired('#123')).toThrow('engine bug');
    } finally {
      spy.mockRestore();
    }
  });
});