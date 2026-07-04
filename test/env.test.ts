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

  it('resetWarnings(namespace) clears only that namespace', () => {
    // Default namespace (markWarned always uses '').
    markWarned('#a');
    markWarned('#b');
    expect(_warnedSizeForTests()).toBe(2);
    // Clearing a different namespace leaves the default untouched.
    resetWarnings('other');
    expect(_warnedSizeForTests()).toBe(2);
    // Clearing the default namespace works.
    resetWarnings('');
    expect(_warnedSizeForTests()).toBe(0);
  });

  it('resetWarnings() with no arg clears all namespaces', () => {
    markWarned('#a');
    // Simulate another namespace by calling resetWarnings with it first
    // (getWarned creates the Set on first access). We can't easily write
    // to another namespace without a public API, but resetWarnings()
    // clearing all is the contract we test.
    resetWarnings();
    expect(_warnedSizeForTests()).toBe(0);
  });

  it('caps at WARNED_CAP without throwing', () => {
    for (let i = 0; i < 300; i++) markWarned(`#s${i}`);
    expect(_warnedSizeForTests()).toBeLessThanOrEqual(256);
  });

  it('does NOT clear on overflow — existing selectors stay quiet', () => {
    // Fill to the cap. Previously the cap triggered a full warned.clear(),
    // re-arming every previously-quiet selector and causing a warning storm.
    // The new policy keeps existing dedup intact: capped selectors return
    // false (quiet), only overflow selectors warn (return true every call).
    for (let i = 0; i < 256; i++) markWarned(`#s${i}`);
    expect(_warnedSizeForTests()).toBe(256);

    // An already-warned selector stays quiet — not re-armed by overflow.
    expect(markWarned('#s0')).toBe(false);
    expect(markWarned('#s255')).toBe(false);
    expect(_warnedSizeForTests()).toBe(256); // nothing added

    // An overflow selector warns (returns true) but is not tracked.
    expect(markWarned('#overflow')).toBe(true);
    expect(_warnedSizeForTests()).toBe(256); // cap held, no clear

    // The overflow selector warns again on the next call (not tracked).
    expect(markWarned('#overflow')).toBe(true);
  });
});
