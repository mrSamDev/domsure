import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  isDev,
  markWarned,
  resetWarnings,
  _warnedSizeForTests,
  _setDevOverrideForTests,
} from '../src/env';

describe('isDev (memoized)', () => {
  afterEach(() => _setDevOverrideForTests(null));

  it('reflects production when overridden false', () => {
    _setDevOverrideForTests(false);
    expect(isDev()).toBe(false);
  });

  it('reflects development when overridden true', () => {
    _setDevOverrideForTests(true);
    expect(isDev()).toBe(true);
  });

  it('is stable across repeated calls (no re-read)', () => {
    _setDevOverrideForTests(true);
    const a = isDev();
    const b = isDev();
    const c = isDev();
    expect(a).toBe(b);
    expect(b).toBe(c);
  });
});

describe('warned lifecycle', () => {
  beforeEach(() => resetWarnings());

  it('markWarned returns true only on first call per selector', () => {
    expect(markWarned('#a')).toBe(true);
    expect(markWarned('#a')).toBe(false);
    expect(markWarned('#b')).toBe(true);
  });

  it('resetWarnings empties the set', () => {
    markWarned('#a');
    markWarned('#b');
    expect(_warnedSizeForTests()).toBe(2);
    resetWarnings();
    expect(_warnedSizeForTests()).toBe(0);
    expect(markWarned('#a')).toBe(true); // warns again after reset
  });

  it('caps at WARNED_CAP without throwing', () => {
    for (let i = 0; i < 300; i++) markWarned(`#s${i}`);
    expect(_warnedSizeForTests()).toBeLessThanOrEqual(256);
  });
});
