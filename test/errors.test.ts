import { describe, it, expect } from 'vitest';
import {
  DomsureError,
  errRequiredNotFound,
  errRequiredMultiNotFound,
  errInvalidSelector,
  errSsr,
  errSelectorValue,
  errDuplicateSelector,
} from '../src/errors';

// Centralized error factories — one source of truth for message strings.
// Existing query/selectors tests assert on these substrings, so the factories
// must reproduce the exact wording.
describe('error factories', () => {
  it('errRequiredNotFound carries the selector', () => {
    const e = errRequiredNotFound('#app');
    expect(e).toBeInstanceOf(DomsureError);
    expect(e.selector).toBe('#app');
    expect(e.message).toBe('[domsure] Required element not found: #app');
  });

  it('errRequiredMultiNotFound carries the selector', () => {
    const e = errRequiredMultiNotFound('.row');
    expect(e).toBeInstanceOf(DomsureError);
    expect(e.selector).toBe('.row');
    expect(e.message).toBe('[domsure] Required elements not found: .row');
  });

  it('errInvalidSelector JSON-encodes the selector', () => {
    const e = errInvalidSelector('#[');
    expect(e).toBeInstanceOf(DomsureError);
    expect(e.selector).toBe('#[');
    expect(e.message).toBe('[domsure] Invalid selector: "#["');
  });

  it('errSsr has no selector and guides the user', () => {
    const e = errSsr();
    expect(e).toBeInstanceOf(DomsureError);
    expect(e.selector).toBeUndefined();
    expect(e.message).toContain('document is not available');
    expect(e.message).toContain('typeof window');
  });

  it('errSelectorValue reports the bad value kind', () => {
    const e = errSelectorValue('nav', 'number');
    expect(e).toBeInstanceOf(DomsureError);
    expect(e.message).toContain('nav');
    expect(e.message).toContain('number');
  });

  it('errDuplicateSelector names both keys', () => {
    const e = errDuplicateSelector('#x', 'a', 'b');
    expect(e).toBeInstanceOf(DomsureError);
    expect(e.message).toContain('"a"');
    expect(e.message).toContain('"b"');
  });
});