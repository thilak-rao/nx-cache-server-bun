# Contributing

Want to improve remotecache? Here's what you need.

## Prerequisites

This project runs on [Bun](https://bun.sh). Install Bun, then:

```sh
bun install
```

## Develop

- `bun run serve` — start the server (requires `ADMIN_TOKEN`).
- `bun test` — run unit (`*.spec.ts`) and e2e (`e2e/*.e2e.spec.ts`) tests.
- `bun run lint` — oxlint.
- `bun run format` — oxfmt (rewrites files). CI runs `bun run format --check`, so format before pushing.

Build the docs site from `docs-site/` with `bun install && bun run build`.

## Conventions

- Conventional Commits: `type(scope): subject` (`feat|fix|docs|refactor|perf|test|build|ci|chore|revert`).
- Bun built-ins only — no Node-only equivalents or extra deps for what Bun provides.
- Docs travel with code: a change to behavior, the HTTP API, env vars, or config updates the matching docs surface in the same commit (see `AGENTS.md`).
- Full docs: https://remotecache.dev/

## Releases

Release Please manages changelogs, version bumps, GitHub Releases, and SemVer tags.

Normal contributor PRs should use Conventional Commits. After changes land on `main`, Release Please opens or updates a release PR. A maintainer reviews and merges that release PR when it is time to publish.

The release workflow needs a `RELEASE_PLEASE_TOKEN` repository secret. See the release guide in the docs site for token permissions and troubleshooting.

## Pull requests

CI (format-check, lint, test) and CodeQL must pass. Keep PRs focused.
