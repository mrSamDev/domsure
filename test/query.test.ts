import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { $, $$ } from '../src/query';
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
});

describe('$$ (multi query)', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"><span class="item">a</span><span class="item">b</span></div>';
  });

  it('returns all matching elements as an array', () => {
    const els = $$<HTMLSpanElement>('.item');
    expect(els).toHaveLength(2);
    expect(els[0].textContent).toBe('a');
    expect(els[1].textContent).toBe('b');
  });

  it('returns empty array for no matches', () => {
    expect($$('.nonexistent')).toEqual([]);
  });
});

describe('$$ parity', () => {
  beforeEach(() => {
    document.body.innerHTML =
      '<div id="app"><span class="item">a</span><span class="item">b</span></div>';
    resetWarnings();
  });

  it('$$.required throws on empty result', () => {
    expect(() => $$.required('.missing')).toThrow(DomsureError);
    expect(() => $$.required('.missing')).toThrow('Required elements not found');
    expect($$.required('.item')).toHaveLength(2);
  });

  it('$$$.optional warns once in dev on empty', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    $$.optional('.missing');
    $$.optional('.missing');
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('$$$.exists mirrors $.exists semantics', () => {
    expect($$.exists('.item')).toBe(true);
    expect($$.exists('.missing')).toBe(false);
  });

  it('$$.tryRequired returns [null, els] when found', () => {
    const [err, els] = ($$.tryRequired as typeof $$.tryRequired)('.item');
    expect(err).toBeNull();
    expect(els).toHaveLength(2);
    expect(els[0].textContent).toBe('a');
  });

  it('$$.tryRequired returns [DomsureError, []] on empty, no throw', () => {
    const [err, els] = $$.tryRequired('.missing');
    expect(els).toEqual([]);
    expect(err).toBeInstanceOf(DomsureError);
    expect(err!.selector).toBe('.missing');
    expect(err!.message).toBe('[domsure] Required elements not found: .missing');
    expect(() => $$.tryRequired('.missing')).not.toThrow();
  });

  it('$$.tryRequired never throws under SSR', () => {
    vi.stubGlobal('document', undefined);
    try {
      const [err, els] = $$.tryRequired('.x');
      expect(els).toEqual([]);
      expect(err).toBeInstanceOf(DomsureError);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('$$.tryRequired does not auto-warn', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    $$.tryRequired('.missing');
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('$$.required rebrands invalid selectors', () => {
    expect(() => $$.required('#[')).toThrow(DomsureError);
  });
});

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