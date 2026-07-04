import { describe, it, expect, beforeEach, vi } from 'vitest';
import { $$ } from '../src/query-multi';
import { resetWarnings } from '../src/env';
import { DomsureError } from '../src/errors';

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

  it('$$.optional warns once in dev on empty', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    $$.optional('.missing');
    $$.optional('.missing');
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('$$.exists mirrors $.exists semantics', () => {
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