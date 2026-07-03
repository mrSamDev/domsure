# Provenance and trust

Provenance statements verify that a published package was built from the
expected source code and published by the expected person or organization.
They are a supply-chain integrity tool: a consumer can check that the artifact
on the registry matches a build of a specific commit in this repository, with
no tampering in between.

## How `domsure` gets provenance

`domsure` is published to JSR from GitHub Actions by
[`.github/workflows/publish-jsr.yml`](./.github/workflows/publish-jsr.yml).
That workflow uses the native JSR + GitHub Actions publishing integration —
`deno publish` with tokenless OIDC (`id-token: write`) — which is the exact
setup JSR requires to attach provenance.

When those conditions are met, JSR automatically creates a provenance
statement for the package using the
[Supply Chain Levels for Software Artifacts (SLSA)](https://slsa.dev) framework
and stores it in the [Sigstore Rekor](https://www.sigstore.dev) transparency
log. No extra configuration is needed in this repo.

## Viewing the provenance statement

Open the package page on JSR:
[`@mrsamdev/domsure`](https://jsr.io/@mrsamdev/domsure). At the bottom of the
**Overview** tab there is a **Provenance** section with a link to the Sigstore
transparency log entry for that version.

## Opting out

Provenance is on by default for GitHub Actions publishes. To skip it for a
one-off publish, pass `--no-provenance`:

```sh
deno publish --no-provenance
```

There is no reason to do this for normal `domsure` releases; provenance is free
and adds trust. The flag exists for edge cases (e.g. debugging a publish
failure where you want to isolate the provenance step).

## Future support

JSR plans two additions that are not yet implemented:

- **Package manifest signing.** JSR will sign the uploaded package manifest and
  publish that signature to the Sigstore transparency log, so consumers can
  verify the manifest was not tampered with after upload.
- **NPM tarball attestations.** JSR will provide publish attestations for the
  npm tarballs it serves, extending the same trust guarantee to npm consumers
  of JSR-backed packages.

This document will be updated when those ship.