# Security Policy

## Supported versions

domsure is a small client-side DOM utility with no runtime dependencies, no
network calls, and no file system access. Security fixes are released as new
minor or patch versions.

| Version | Supported |
|---------|-----------|
| 0.1.x   | ✅        |
| < 0.1   | ❌        |

## Reporting a vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Email **security@@mrsamdev.io** with:

- A description of the issue and its impact.
- A minimal reproduction (selector string, DOM shape, expected vs actual).
- Any suggested fix.

You will receive an acknowledgment within 48 hours. Coordinated disclosure is
preferred; we will credit reporters in the release notes unless you ask to
remain anonymous.

## Threat model

domsure passes consumer-supplied CSS selector strings to the browser's native
`querySelector` / `getElementById` APIs. It does **not**:

- Execute `eval` or `new Function`.
- Read from or write to `innerHTML`, `outerHTML`, or `insertAdjacentHTML`.
- Make network requests.
- Touch the file system, cookies, or storage.
- Serialize or deserialize untrusted data beyond `JSON.stringify` of a selector
  string into an error message (safe — it produces a quoted string literal).

### Selector injection

A "selector injection" here would mean an attacker controls the selector string
passed to `$`/`$$`. domsure does not construct selectors from user input — that
is the caller's responsibility. If your application interpolates untrusted data
into a selector (e.g. `$(`#user-${name}`)`), that is an application-level
concern, not a domsure vulnerability. Escape user input before embedding it in a
CSS selector, or use `defineSelectors` to keep selectors as static literals.

### Error message content

Error messages include the selector that caused the failure via
`JSON.stringify(selector)`, which quotes and escapes the string. This prevents a
malicious selector containing quotes or newlines from breaking out of the
message format. The `DomsureError.selector` field stores the raw selector — do
not log it to an HTML context without escaping.

## Hardening recommendations for consumers

- Prefer `defineSelectors` with `as const` so selectors are static literals, not
  dynamically constructed strings.
- Never interpolate untrusted input into a selector.
- In SSR code paths, guard calls with `typeof window !== 'undefined'` — domsure
  throws a `DomsureError` when `document` is undefined, which surfaces the
  misuse early rather than silently failing.