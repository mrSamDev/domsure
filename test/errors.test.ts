import { describe, it, expect } from 'vitest';
import {
  DomsureError,
  requiredNotFoundError,
  requiredMultiNotFoundError,
  invalidSelectorError,
  ssrError,
  selectorValueError,
  duplicateSelectorError,
} from '../src/errors';

// Centralized error factories — one source of truth for message strings.
// Existing query/selectors tests assert on these substrings, so the factories
// must reproduce the exact wording.
describe('error factories', () => {
  it('requiredNotFoundError carries the selector', () => {
    const e = requiredNotFoundError('#app');
    expect(e).toBeInstanceOf(DomsureError);
    expect(e.selector).toBe('#app');
    expect(e.message).toBe('[domsure] Required element not found: #app');
  });

  it('requiredMultiNotFoundError carries the selector', () => {
    const e = requiredMultiNotFoundError('.row');
    expect(e).toBeInstanceOf(DomsureError);
    expect(e.selector).toBe('.row');
    expect(e.message).toBe('[domsure] Required elements not found: .row');
  });

  it('invalidSelectorError JSON-encodes the selector', () => {
    const e = invalidSelectorError('#[');
    expect(e).toBeInstanceOf(DomsureError);
    expect(e.selector).toBe('#[');
    expect(e.message).toBe('[domsure] Invalid selector: "#["');
  });

  it('ssrError has no selector and guides the user', () => {
    const e = ssrError();
    expect(e).toBeInstanceOf(DomsureError);
    expect(e.selector).toBeUndefined();
    expect(e.message).toContain('document is not available');
    expect(e.message).toContain('typeof window');
  });

  it('selectorValueError reports the bad value kind', () => {
    const e = selectorValueError('nav', 'number');
    expect(e).toBeInstanceOf(DomsureError);
    expect(e.message).toContain('nav');
    expect(e.message).toContain('number');
  });

  it('duplicateSelectorError names both keys', () => {
    const e = duplicateSelectorError('#x', 'a', 'b');
    expect(e).toBeInstanceOf(DomsureError);
    expect(e.message).toContain('"a"');
    expect(e.message).toContain('"b"');
  });
});

describe('DomsureError cross-realm instanceof', () => {
  it('matches by .name duck-type, not constructor identity', () => {
    // Simulate a cross-realm error: same shape, different constructor.
    const fake = { name: 'DomsureError', message: 'test', selector: '#x' };
    expect((fake as unknown) instanceof DomsureError).toBe(true);
  });

  it('rejects objects without the DomsureError name', () => {
    expect(({ name: 'Error', message: 'test' } as unknown) instanceof DomsureError).toBe(false);
    expect(({ name: 'TypeError' } as unknown) instanceof DomsureError).toBe(false);
    expect(({} as unknown) instanceof DomsureError).toBe(false);
  });

  it('rejects non-objects', () => {
    expect((null as unknown) instanceof DomsureError).toBe(false);
    expect((undefined as unknown) instanceof DomsureError).toBe(false);
    expect(('DomsureError' as unknown) instanceof DomsureError).toBe(false);
    expect((42 as unknown) instanceof DomsureError).toBe(false);
  });

  it('real DomsureError instances still pass instanceof', () => {
    const e = requiredNotFoundError('#app');
    expect(e instanceof DomsureError).toBe(true);
    expect(e instanceof Error).toBe(true);
  });
});