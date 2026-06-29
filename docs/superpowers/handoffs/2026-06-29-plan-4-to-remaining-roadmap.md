# Plan 4 to Remaining Roadmap Handoff

Date: 2026-06-29

This handoff starts from the current `teardown-fix` worktree after Plan 4 was implemented. It is meant for a fresh agent with no conversation history.

## Current State

Worktree:

- Path: `/Users/trao/git/remotecache/.agents/worktrees/teardown-fix`
- Branch: `teardown-fix`
- Current HEAD at handoff creation: `39b5296 chore(health): verify probe endpoint`
- `git status --short` was clean before this handoff document was added.

The roadmap spec is:

- `docs/superpowers/specs/2026-06-29-release-ci-distribution-hardening-design.md`

Completed implementation phases:

1. Release management with Release Please.
2. CI audit, docs build, Docker smoke, and Trivy filesystem gates.
3. Docker distribution publishing with `edge`, `sha-<short>`, stable tags, multi-platform images, SBOM, and provenance.
4. `/health` endpoint and probe foundation.

Remaining roadmap:

5. Helm chart with lint/template checks.
6. Helm OCI publishing on release tags.
7. TLS support and tests.
8. S3 integration test path.
9. Real Nx e2e path.
10. Docs and developer-experience cleanup.

## Plan 4 Assessment

Plan 4 implemented only the `/health` endpoint and probe foundation. It did not add Helm, TLS, S3 integration tests, Nx e2e, `/metrics` behavior changes, or a Dockerfile `HEALTHCHECK`.

Implementation commits on the current branch:

```text
39b5296 chore(health): verify probe endpoint
b644b32 ci: use health endpoint for docker smoke checks
081cb6b feat(health): add unauthenticated health endpoint
bf7b512 feat(health): add health response helper
30f580e docs: sync agent workflow instructions
55f7f72 docs: add health endpoint implementation plan
```

One older note may mention `964102d` as the health plan commit. In this checked-out branch, the first-parent plan commit is `55f7f72`; use the branch history, not the older note.

Files changed by Plan 4 product work:

```text
.github/workflows/ci.yml
.github/workflows/publish-image.yml
AGENTS.md
README.md
docs-site/src/content/docs/contributing/releases.md
docs-site/src/content/docs/guides/configuration.md
docs-site/src/content/docs/guides/deployment.md
e2e/health.e2e.spec.ts
nx-cache-server.openapi.json
src/health/get-health.spec.ts
src/health/get-health.ts
src/main.ts
```

Additional format-only file changed by the verification commit:

```text
docs/superpowers/plans/2026-06-29-health-endpoint-probe-foundation.md
```

Important behavior now present:

- `GET /health` is unauthenticated.
- It returns `200`, `Content-Type: text/plain; charset=utf-8`, and body `OK`.
- It only checks that the process is accepting requests. It does not check filesystem or S3 reachability.
- `src/main.ts` registers `/health` before `/metrics`.
- OpenAPI documents `/health` with `security: []`.
- CI Docker smoke and Docker publish preflight now poll `http://127.0.0.1:3000/health`.

Reported Plan 4 verification:

- `bun run format --check`: pass after formatting the plan markdown file.
- `bun run lint`: pass.
- `bun audit`: pass.
- `bun test`: `58 pass`, `0 fail`.
- `cd docs-site && bun audit`: pass.
- `cd docs-site && bun run build`: `22 page(s) built`, internal links valid.
- Local Docker smoke against `/health`: pass after Docker Desktop was started.
- Health endpoint code review: approved, no Critical or Important findings.

Local review during handoff creation confirmed:

- `src/health/get-health.ts` uses `okResponse`.
- `e2e/health.e2e.spec.ts` imports `src/main` only after setting `Bun.env` and mocking the logger.
- `.github/workflows/ci.yml` and `.github/workflows/publish-image.yml` now use `/health`, not `/metrics`, for smoke checks.
- `AGENTS.md` now names `GET /health` in the project summary and no longer says `main` publishes `latest`.

## Next Recommended Phase

Write and implement Plan 5: Helm chart with lint/template checks.

Do not combine this with Helm OCI publishing. OCI publishing is Phase 6 and should happen after the chart exists and passes local/CI validation.

Suggested Plan 5 scope:

- Create `charts/remotecache/Chart.yaml`.
- Create `charts/remotecache/values.yaml`.
- Create focused templates under `charts/remotecache/templates/`.
- Add values and templates for:
  - image repository, tag, and pull policy
  - `ADMIN_TOKEN` through either an existing Secret or a chart-created Secret
  - filesystem persistence for `/app/data` and `/app/cache`
  - optional S3 env vars and S3 credential Secret references
  - `MAX_UPLOAD_BYTES`
  - service account annotations
  - liveness and readiness probes using `/health`
  - extra env vars
  - resources, node selectors, tolerations, affinity, pod labels, pod annotations, and security contexts
- Add chart validation to `.github/workflows/ci.yml`:
  - `helm lint charts/remotecache`
  - `helm template remotecache charts/remotecache`
  - `helm template remotecache charts/remotecache -f charts/remotecache/ci/filesystem-values.yaml`
  - `helm template remotecache charts/remotecache -f charts/remotecache/ci/s3-values.yaml`
- Add Helm docs to the deployment guide and release maintainer docs.
- Update `CONTRIBUTING.md` and `.github/pull_request_template.md` if the required local checks change.

Do not advertise direct TLS as working in Plan 5. The spec mentions an optional TLS secret mount in the chart, but the server does not yet implement `TLS_CERT_PATH` or `TLS_KEY_PATH`. Either defer TLS chart values to Phase 7, or add only generic `extraVolumes`, `extraVolumeMounts`, and `extraEnv` escape hatches without calling them TLS support. This avoids shipping a chart option that looks usable but cannot change server behavior yet.

## Helm Grounding

Context7 was used for Helm docs with library ID `/helm/helm-www`.

Facts to preserve in the next plan:

- Helm renders files under `templates/`; `values.yaml` supplies defaults and is not itself templated.
- `helm lint <chart>` validates a chart for likely chart issues.
- `helm template <release-name> <chart>` renders manifests locally.
- Helm OCI publishing is done with `helm package`, `helm registry login`, and `helm push ... oci://...`, but that belongs in Phase 6.

Source links:

- Helm charts: https://helm.sh/docs/topics/charts/
- Helm template command: https://helm.sh/docs/helm/helm_template/
- Helm OCI registries: https://helm.sh/docs/topics/registries/
- Kubernetes probes: https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/

Production OSS cross-checks run during this handoff:

- `gh search code "helm lint charts" --language=yaml --limit=10`
- `gh search code "helm push oci://ghcr.io" --language=yaml --limit=10`

These searches confirmed that `helm lint charts/...` and `helm push ... oci://ghcr.io/...` are common workflow patterns. Searches for probe templates were too broad and did not return useful examples.

Tooling note:

- `helm` was not on PATH during this handoff (`command -v helm && helm version --short || true` produced no output). The next agent must install or otherwise provide Helm before implementing Plan 5 or adding CI checks that call it.

## Constraints for the Next Agent

Follow the repository rules:

- Use Bun, `Bun.env`, `Bun.serve`, and `bun:test`; do not add Node-only runtime replacements.
- Keep handlers thin and responses built through `src/responses.ts`.
- Use `apply_patch` for manual file edits.
- Keep commits in Conventional Commits format.
- Use `prompt-wizard` for prompts and prompt surfaces.
- Use `humanizer` for human-facing docs.
- Use Context7 before changing third-party library behavior.
- Cross-reference production OSS usage on GitHub alongside Context7 for third-party library work.

Plan 5 should stay scoped:

- Do not publish charts to GHCR.
- Do not add direct TLS server support.
- Do not add S3 integration tests.
- Do not add real Nx e2e tests.
- Do not change `/metrics` or `/health` behavior unless a chart test proves the documented probe contract is wrong.
- Do not introduce broad scripts or DX cleanup unless Helm checks require a documented command.

## Recommended Plan 5 File Map

Likely create:

```text
charts/remotecache/Chart.yaml
charts/remotecache/values.yaml
charts/remotecache/templates/_helpers.tpl
charts/remotecache/templates/deployment.yaml
charts/remotecache/templates/service.yaml
charts/remotecache/templates/serviceaccount.yaml
charts/remotecache/templates/secret.yaml
charts/remotecache/templates/pvc.yaml
charts/remotecache/ci/filesystem-values.yaml
charts/remotecache/ci/s3-values.yaml
```

Likely modify:

```text
.github/workflows/ci.yml
README.md
docs-site/src/content/docs/guides/deployment.md
docs-site/src/content/docs/contributing/releases.md
CONTRIBUTING.md
.github/pull_request_template.md
AGENTS.md
```

Open question before implementation:

- Whether to add `charts/remotecache/ci/tls-values.yaml` now. Recommendation: defer until Phase 7 unless the user explicitly accepts a render-only placeholder. Rendering a TLS secret mount before the server supports TLS is easy to test but misleading for users.

## Handoff Prompt for the Next Agent

Use this prompt if a fresh agent should write the next implementation plan. It is intentionally strict about scope because the remaining roadmap has several tempting but separate phases.

```xml
<prompt>
<role>
You are a senior engineering agent continuing the `remotecache` release, CI/CD, distribution, security, and DX hardening roadmap.
</role>

<context>
The current worktree is `/Users/trao/git/remotecache/.agents/worktrees/teardown-fix` on branch `teardown-fix`. Plans 1-4 are complete. The latest completed phase added unauthenticated `GET /health`, documented it in OpenAPI and user docs, and switched Docker smoke checks to `/health`.

Read these files before planning:

- `AGENTS.md`
- `docs/superpowers/specs/2026-06-29-release-ci-distribution-hardening-design.md`
- `docs/superpowers/handoffs/2026-06-29-plan-4-to-remaining-roadmap.md`
- `.github/workflows/ci.yml`
- `.github/workflows/publish-image.yml`
- `docs-site/src/content/docs/guides/deployment.md`
- `docs-site/src/content/docs/contributing/releases.md`
</context>

<instructions>
Analyze the current branch, then write Plan 5 for the Helm chart with lint/template checks. Save it to `docs/superpowers/plans/2026-06-29-helm-chart-lint-template.md`.

Use `superpowers:using-superpowers` and `superpowers:writing-plans`. Use `prompt-wizard` for any handoff prompt you include. Use `humanizer` for docs-facing text in the plan. Use Context7 for Helm, and cross-reference production OSS usage with `gh search code` before specifying Helm workflow syntax.

The plan must be executable by a fresh agent. Include exact files, exact code blocks, exact commands, expected results, and commit points. Use TDD-style chart validation: write/render/lint checks before broad docs cleanup.
</instructions>

<constraints>
MUST keep Plan 5 scoped to the Helm chart and CI lint/template validation.
MUST use `/health` for liveness and readiness probes.
MUST NOT add Helm OCI publishing; that is Phase 6.
MUST NOT implement server TLS; that is Phase 7.
MUST NOT claim TLS chart support works before the server supports `TLS_CERT_PATH` and `TLS_KEY_PATH`.
</constraints>

<output_format>
Return:

1. A short assessment of the current branch state.
2. The saved plan path and commit SHA.
3. A concise summary of Plan 5 scope.
4. Any blockers, especially if Helm is not installed locally.
</output_format>
</prompt>
```

## Completion Criteria for the Next Phase

Plan 5 is ready to hand to an implementation agent when:

- The Helm plan is saved under `docs/superpowers/plans/`.
- The plan includes concrete chart file contents, values examples, CI workflow changes, docs updates, and verification commands.
- The plan explicitly excludes OCI chart publishing and server TLS.
- The plan explains how the chart uses `/health` probes.
- The plan is formatted with `bun run format --check`.
- The branch is clean after committing the plan.
