# Support

## Getting help

- **Bug or unexpected behavior** → open a [Bug report issue][bug].
- **Feature idea** → open a [Feature request issue][feature].
- **Security vulnerability** → do **not** open an issue. See
  [`SECURITY.md`](./SECURITY.md).
- **Usage question** → the [API section of the README][readme] covers every
  public function. If something there is unclear, that's a documentation bug —
  open an issue.

[bug]: https://github.com/mrsamdev/domsure/issues/new?template=bug_report.md
[feature]: https://github.com/mrsamdev/domsure/issues/new?template=feature_request.md
[readme]: ./README.md#api

## Before filing an issue

1. **Check the version.** Run `npm ls domsure` (or check `package.json`). Issues
   are only accepted against the latest released version.
2. **Reproduce with a bare selector.** If your bug only reproduces inside
   React/Vue/Svelte, try the same selector in a plain HTML file first. domsure
   wraps native `querySelector` / `getElementById` — if the native call behaves
   the same way, the issue is in the browser, not domsure.
3. **Check the fast path.** `$('#id')` uses `getElementById` for simple IDs
   (alphanumeric, starting with a letter). `$('#id .child')`, `$('#id.class')`,
   and `$('#id > child')` use `querySelector`. If you see different behavior
   between `$('#foo')` and `$('#foo.bar')`, that's expected — they use different
   browser APIs.
4. **SSR?** domsure throws `DomsureError` when `document` is undefined. Guard
   with `typeof window !== 'undefined'`. This is intentional, not a bug.

## Self-service diagnostics

```ts
import { $, DomsureError } from 'domsure';

try {
  $.required('#your-selector');
} catch (e) {
  if (e instanceof DomsureError) {
    console.error({ selector: e.selector, message: e.message });
  }
}
```

The `selector` field on `DomsureError` tells you exactly which selector failed —
no need to parse the message string.

## Maintenance status

domsure is actively maintained but intentionally feature-complete. It is small
on purpose; most "feature requests" are better solved at the call site. Pull
requests that add bytes without a strong justification will be declined. See
[`CONTRIBUTING.md`](./CONTRIBUTING.md).