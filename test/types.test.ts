import { describe, it, expectTypeOf, beforeEach } from 'vitest';
import { $ } from '../src/query-single';
import { $$ } from '../src/query-multi';

// Phase 1: generics widen from HTMLElement to Element so SVG, MathML, and
// custom elements type-check. SVGSVGElement extends Element, NOT HTMLElement.
// expectTypeOf executes its argument, so the fixture must exist at runtime;
// the actual type assertions are enforced by tsc (pnpm lint).
describe('generic constraint covers Element subtypes', () => {
  beforeEach(() => {
    document.body.innerHTML = '<svg id="svg"><path d="M0 0"></path><circle></circle></svg>';
  });
  it('$.required accepts SVGSVGElement', () => {
    expectTypeOf($.required<SVGSVGElement>('#svg')).toEqualTypeOf<SVGSVGElement>();
  });

  it('$.optional accepts SVGSVGElement', () => {
    expectTypeOf($.optional<SVGSVGElement>('#svg')).toEqualTypeOf<SVGSVGElement | null>();
  });

  it('$ call accepts SVGSVGElement', () => {
    expectTypeOf($<SVGSVGElement>('#svg')).toEqualTypeOf<SVGSVGElement | null>();
  });

  it('default type argument stays HTMLElement', () => {
    expectTypeOf($('#svg')).toEqualTypeOf<HTMLElement | null>();
  });

  it('$$.required accepts SVGPathElement', () => {
    expectTypeOf($$.required<SVGPathElement>('path')).toEqualTypeOf<SVGPathElement[]>();
  });

  it('$$ default type argument stays HTMLElement', () => {
    expectTypeOf($$('.item')).toEqualTypeOf<HTMLElement[]>();
  });
});