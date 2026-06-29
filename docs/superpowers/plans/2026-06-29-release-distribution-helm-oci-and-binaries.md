# Release Distribution (Helm OCI chart + standalone binaries) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On every release tag, publish the Helm chart as an OCI artifact to GHCR and attach cross-platform standalone binaries to the GitHub Release, both behind the existing quality gate and both checksummed and provenance-attested.

**Architecture:** Extend the existing `.github/workflows/publish-image.yml` with two tag-gated jobs (`publish-helm`, `publish-binaries`), each `needs: preflight`. Binary build logic lives in a standalone `scripts/build-binaries.sh` so it runs locally and the workflow stays thin. A small prerelease guard stops prerelease tags from updating the Docker `latest` tag. Docs are updated in the same change.

**Tech Stack:** Bun (`bun build --compile`), Helm OCI (`helm package`/`helm push`), GitHub Actions, `actions/attest-build-provenance`, `gh` CLI.

## Global Constraints

- Runtime: Bun built-ins only. The single approved runtime dependency is `@aws-sdk/credential-providers@3.1075.0` (already present). Add no other deps.
- Every GitHub Action is pinned by commit SHA with a trailing `# vX.Y.Z` comment.
- Conventional Commits for every commit (`type(scope): subject`).
- Binary matrix is the **Core 5**: `linux-x64`, `linux-arm64`, `darwin-x64`, `darwin-arm64`, `windows-x64`.
- Chart is published to `oci://ghcr.io/<owner>/charts` (lands at `ghcr.io/<owner>/charts/remotecache:<version>`).
- `<version>` is the tag without the leading `v` (`v2.1.0` → `2.1.0`).
- Provenance attestation via `actions/attest-build-provenance` (keyless OIDC).
- Prerelease = the version contains a `-` (e.g. `3.0.0-rc.1`); prereleases must not update stable pointers.
- Docs travel with the code (project rule). Run human-facing doc prose through the `humanizer` skill before committing.
- `oxfmt` formats Markdown too: run `bun run format <path>` on any new/edited `.md` under `docs/` before committing, or CI `format --check` fails. (The Helm chart is already excluded from oxfmt.)
- No `console` in TS (use `src/logger.ts`); no `any`; single quotes. (This plan is YAML + Bash + Markdown, so this rarely applies.)

**Pinned action SHAs (verified, reuse exactly):**

- `actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0 # v7.0.0`
- `oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6 # v2.2.0`
- `azure/setup-helm@9bc31f4ebc9c6b171d7bfbaa5d006ae7abdb4310 # v5.0.1`
- `docker/login-action@650006c6eb7dba73a995cc03b0b2d7f5ca915bee # v4.2.0`
- `actions/attest-build-provenance@0f67c3f4856b2e3261c31976d6725780e5e4c373 # v4.1.1`

**Note on testing approach:** This is infrastructure work (CI YAML, a Bash build script, docs). The repo's `bun:test` TDD cycle does not apply, and per the project rules we do not add low-impact tests or slow the fast `bun test` loop by compiling binaries in it. Each task is verified by a concrete build/smoke/lint/dry-run instead, with exact commands and expected output. The full publish path can only be exercised end-to-end after this branch merges to `main` and a real tag is cut; until then the workflow is verified statically and the build script is verified locally.

---

## File Structure

- **Create:** `scripts/build-binaries.sh` — compiles the Core 5 with `bun build --compile` and writes `dist/checksums.txt`. Single responsibility: produce release binaries + checksums. Portable `sha256` shim so it runs on macOS dev machines too.
- **Modify:** `.gitignore` — ignore the `dist/` build output.
- **Modify:** `.github/workflows/publish-image.yml` — add `publish-helm` and `publish-binaries` jobs; tighten the Docker `latest` enable expression for the prerelease guard.
- **Modify:** `docs-site/src/content/docs/guides/deployment.md` — add Helm OCI install and a Standalone binaries section.
- **Modify:** `docs-site/src/content/docs/contributing/releases.md` — record that release tags now publish the chart and binaries.
- **Modify:** `README.md` — mention binaries + Helm OCI under install options.

---

## Task 1: Binary build script

**Files:**

- Create: `scripts/build-binaries.sh`
- Modify: `.gitignore`

**Interfaces:**

- Produces: `scripts/build-binaries.sh <version>` → writes `dist/remotecache-<version>-{linux-x64,linux-arm64,darwin-x64,darwin-arm64,windows-x64.exe}` and `dist/checksums.txt`. Consumed by Task 3's workflow job.

- [ ] **Step 1: Write the build script**

Create `scripts/build-binaries.sh`:

```bash
#!/usr/bin/env bash
# Build standalone remotecache executables for the Core 5 targets and a
# checksums.txt. Used by .github/workflows/publish-image.yml and locally.
set -euo pipefail

VERSION="${1:?usage: build-binaries.sh <version>}"
OUT_DIR="dist"
ENTRY="src/main.ts"

# Portable SHA-256 (sha256sum on Linux, shasum on macOS).
sha256() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$@"
  else
    shasum -a 256 "$@"
  fi
}

# Bun target triple -> friendly os-arch suffix. Bun appends .exe for Windows.
targets=(
  "bun-linux-x64:linux-x64"
  "bun-linux-arm64:linux-arm64"
  "bun-darwin-x64:darwin-x64"
  "bun-darwin-arm64:darwin-arm64"
  "bun-windows-x64:windows-x64"
)

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

for entry in "${targets[@]}"; do
  triple="${entry%%:*}"
  suffix="${entry##*:}"
  outfile="${OUT_DIR}/remotecache-${VERSION}-${suffix}"
  echo "Building ${triple} -> ${outfile}"
  bun build --compile --minify --target="${triple}" "${ENTRY}" --outfile "${outfile}"
done

# checksums.txt holds bare filenames (no dist/ prefix) for easy local verify.
( cd "$OUT_DIR" && sha256 remotecache-* > checksums.txt )

echo "--- artifacts ---"
ls -la "$OUT_DIR"
echo "--- checksums ---"
cat "${OUT_DIR}/checksums.txt"
```

- [ ] **Step 2: Make it executable and ignore the output dir**

Run:

```bash
chmod +x scripts/build-binaries.sh
grep -qxF 'dist/' .gitignore || printf '\n# release binary build output\ndist/\n' >> .gitignore
```

- [ ] **Step 3: Run the script to verify it builds all five targets**

Run:

```bash
bash scripts/build-binaries.sh 0.0.0-dev
```

Expected: five `Building bun-… -> dist/remotecache-0.0.0-dev-…` lines, then a listing showing exactly these files plus `checksums.txt`:

```
remotecache-0.0.0-dev-linux-x64
remotecache-0.0.0-dev-linux-arm64
remotecache-0.0.0-dev-darwin-x64
remotecache-0.0.0-dev-darwin-arm64
remotecache-0.0.0-dev-windows-x64.exe
checksums.txt
```

- [ ] **Step 4: Verify checksums and smoke-run the native binary**

Run (verifies the checksum file, then boots the binary for _your_ host OS — pick the matching name; example is Apple Silicon):

```bash
( cd dist && shasum -a 256 -c checksums.txt --ignore-missing )
ADMIN_TOKEN=smoke ./dist/remotecache-0.0.0-dev-darwin-arm64 &
sleep 2
curl -fsS http://127.0.0.1:3000/health && echo " <- health OK"
kill %1
```

Expected: each listed file prints `OK` from the checksum check, then `OK <- health OK` from the running server. This proves `--compile` bundled `@aws-sdk/credential-providers` and embedded `bun:sqlite`. If the binary exits immediately, the bundle is broken — stop and investigate before continuing.

- [ ] **Step 5: Clean up and commit**

Run:

```bash
rm -rf dist data cache
git add scripts/build-binaries.sh .gitignore
git commit -m "build(release): add cross-platform binary build script"
```

---

## Task 2: Helm OCI publish job

**Files:**

- Modify: `.github/workflows/publish-image.yml` (append a new job after the existing `publish` job)

**Interfaces:**

- Consumes: the existing `preflight` job; the `charts/remotecache/` chart (from Plan 5).
- Produces: a chart at `ghcr.io/<owner>/charts/remotecache:<version>` with a provenance attestation, on release tags.

- [ ] **Step 1: Verify the chart packages locally**

Run:

```bash
helm package charts/remotecache --version 0.0.0-dev --app-version 0.0.0-dev
ls remotecache-0.0.0-dev.tgz
rm -f remotecache-0.0.0-dev.tgz
```

Expected: `Successfully packaged chart and saved it to: …/remotecache-0.0.0-dev.tgz`, then the `ls` lists the file. This confirms the in-repo `Chart.yaml` packages cleanly with overridden version flags.

- [ ] **Step 2: Append the `publish-helm` job**

Add to the end of `.github/workflows/publish-image.yml` (after the `publish` job's last line). Per-job `permissions` are declared because job-level permissions replace the workflow default for that job:

```yaml
publish-helm:
  runs-on: ubuntu-latest
  needs: preflight
  if: startsWith(github.ref, 'refs/tags/v')
  permissions:
    contents: read
    packages: write
    id-token: write
    attestations: write
  steps:
    - name: Checkout
      uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0 # v7.0.0

    - name: Set up Helm
      uses: azure/setup-helm@9bc31f4ebc9c6b171d7bfbaa5d006ae7abdb4310 # v5.0.1

    - name: Log in to GHCR
      uses: docker/login-action@650006c6eb7dba73a995cc03b0b2d7f5ca915bee # v4.2.0
      with:
        registry: ghcr.io
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}

    - name: Package and push chart
      id: push
      env:
        OWNER: ${{ github.repository_owner }}
        GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        ACTOR: ${{ github.actor }}
      run: |
        VERSION="${GITHUB_REF_NAME#v}"
        helm package charts/remotecache --version "$VERSION" --app-version "$VERSION"
        echo "$GH_TOKEN" | helm registry login ghcr.io -u "$ACTOR" --password-stdin
        helm push "remotecache-${VERSION}.tgz" "oci://ghcr.io/${OWNER}/charts" 2>&1 | tee push.log
        DIGEST="$(grep -oE 'sha256:[0-9a-f]+' push.log | head -1)"
        echo "digest=${DIGEST}" >> "$GITHUB_OUTPUT"
        echo "name=ghcr.io/${OWNER}/charts/remotecache" >> "$GITHUB_OUTPUT"

    - name: Attest chart provenance
      uses: actions/attest-build-provenance@0f67c3f4856b2e3261c31976d6725780e5e4c373 # v4.1.1
      with:
        subject-name: ${{ steps.push.outputs.name }}
        subject-digest: ${{ steps.push.outputs.digest }}
        push-to-registry: true
```

- [ ] **Step 3: Validate the workflow YAML**

Run (uses `actionlint` if installed; otherwise the Python check just confirms the file parses):

```bash
command -v actionlint >/dev/null && actionlint .github/workflows/publish-image.yml || \
  python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/publish-image.yml')); print('yaml ok')"
```

Expected: `actionlint` exits 0 with no findings, or `yaml ok`.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/publish-image.yml
git commit -m "ci(release): publish helm chart to ghcr oci on release tags"
```

---

## Task 3: Binary publish job

**Files:**

- Modify: `.github/workflows/publish-image.yml` (append a new job after `publish-helm`)

**Interfaces:**

- Consumes: `scripts/build-binaries.sh` (Task 1); the existing `preflight` job; the GitHub Release that release-please creates for the tag.
- Produces: Core 5 binaries + `checksums.txt` attached to the GitHub Release, with a provenance attestation, on release tags.

- [ ] **Step 1: Append the `publish-binaries` job**

Add to the end of `.github/workflows/publish-image.yml` (after `publish-helm`):

```yaml
publish-binaries:
  runs-on: ubuntu-latest
  needs: preflight
  if: startsWith(github.ref, 'refs/tags/v')
  permissions:
    contents: write
    id-token: write
    attestations: write
  steps:
    - name: Checkout
      uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0 # v7.0.0

    - name: Set up Bun
      uses: oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6 # v2.2.0
      with:
        bun-version: latest

    - name: Install dependencies
      run: bun install --frozen-lockfile

    - name: Build binaries
      run: bash scripts/build-binaries.sh "${GITHUB_REF_NAME#v}"

    - name: Smoke test linux-x64 binary
      run: |
        BIN="dist/remotecache-${GITHUB_REF_NAME#v}-linux-x64"
        ADMIN_TOKEN=smoke-token "$BIN" &
        SERVER_PID=$!
        for attempt in {1..30}; do
          if curl -fsS http://127.0.0.1:3000/health; then
            echo " <- health OK"
            kill "$SERVER_PID"
            exit 0
          fi
          sleep 1
        done
        echo "binary failed health check"
        kill "$SERVER_PID" || true
        exit 1

    - name: Upload release assets
      env:
        GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      run: |
        TAG="${GITHUB_REF_NAME}"
        VERSION="${TAG#v}"
        PRERELEASE=""
        case "$VERSION" in *-*) PRERELEASE="--prerelease" ;; esac
        if ! gh release view "$TAG" >/dev/null 2>&1; then
          gh release create "$TAG" --title "$TAG" --generate-notes $PRERELEASE
        fi
        gh release upload "$TAG" dist/remotecache-* dist/checksums.txt --clobber

    - name: Attest binary provenance
      uses: actions/attest-build-provenance@0f67c3f4856b2e3261c31976d6725780e5e4c373 # v4.1.1
      with:
        subject-path: 'dist/remotecache-*'
```

- [ ] **Step 2: Validate the workflow YAML**

Run:

```bash
command -v actionlint >/dev/null && actionlint .github/workflows/publish-image.yml || \
  python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/publish-image.yml')); print('yaml ok')"
```

Expected: `actionlint` exits 0, or `yaml ok`.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/publish-image.yml
git commit -m "ci(release): build and attach standalone binaries to releases"
```

---

## Task 4: Prerelease guard on the Docker `latest` tag

**Files:**

- Modify: `.github/workflows/publish-image.yml` (the `publish` job's `docker/metadata-action` tags, the `type=raw,value=latest` line)

**Interfaces:**

- Consumes/Produces: nothing new; tightens existing Docker tag behavior so a prerelease tag never updates `latest`.

Background: `docker/metadata-action` already omits `{{major}}.{{minor}}` and `latest` from its _semver_ patterns for prereleases (verified: `v2.0.8-beta.67` → only `2.0.8-beta.67`). But `latest` here is an explicit `type=raw` line gated only on the tag ref, so it currently fires for any `v*` tag including prereleases. This is the only line that needs the guard.

- [ ] **Step 1: Tighten the `latest` enable expression**

In `.github/workflows/publish-image.yml`, change this line (currently around line 131):

```yaml
type=raw,value=latest,enable=${{ startsWith(github.ref, 'refs/tags/v') }}
```

to:

```yaml
type=raw,value=latest,enable=${{ startsWith(github.ref, 'refs/tags/v') && !contains(github.ref, '-') }}
```

- [ ] **Step 2: Validate the workflow YAML**

Run:

```bash
command -v actionlint >/dev/null && actionlint .github/workflows/publish-image.yml || \
  python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/publish-image.yml')); print('yaml ok')"
```

Expected: `actionlint` exits 0, or `yaml ok`.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/publish-image.yml
git commit -m "ci(release): keep prereleases from updating the docker latest tag"
```

---

## Task 5: Documentation

**Files:**

- Modify: `docs-site/src/content/docs/guides/deployment.md`
- Modify: `docs-site/src/content/docs/contributing/releases.md`
- Modify: `README.md`

**Interfaces:**

- Consumes: the publishing behavior from Tasks 2–4. No code interface.

- [ ] **Step 1: Add Helm OCI install to the deployment guide**

In `docs-site/src/content/docs/guides/deployment.md`, in the `## Kubernetes (Helm)` section, replace the opening sentence + first code block (lines 56–61, the "Install it from a checkout" block) with both an OCI option (preferred for releases) and the checkout option:

````markdown
A Helm chart is published to GHCR as an OCI artifact on every release. Install a released version directly — no checkout needed:

```sh
helm install remotecache oci://ghcr.io/thilak-rao/charts/remotecache \
  --version X.Y.Z \
  --set adminToken="change-me"
```
````

Or install from a checkout of the repository (tracks `main`):

```sh
helm install remotecache ./charts/remotecache \
  --set adminToken="change-me"
```

````

- [ ] **Step 2: Add a Standalone binaries section to the deployment guide**

In the same file, add a new section immediately after the `## Health checks` section (after line 52) and before `## Kubernetes (Helm)`:

```markdown
## Standalone binaries

Each release attaches standalone executables to the GitHub Release for Linux, macOS (x64 and arm64), and Windows (x64), alongside a `checksums.txt`. Docker is still the recommended production path; binaries suit direct host installs and quick trials.

Download the binary for your platform from the [Releases page](https://github.com/thilak-rao/remotecache/releases), verify it, and run it:

```sh
# verify the checksum (run from the download directory)
sha256sum -c checksums.txt --ignore-missing

# verify build provenance (optional; requires the gh CLI)
gh attestation verify remotecache-X.Y.Z-linux-x64 --repo thilak-rao/remotecache

# run
chmod +x remotecache-X.Y.Z-linux-x64
ADMIN_TOKEN="change-me" ./remotecache-X.Y.Z-linux-x64
````

The binary bundles everything it needs; no Bun install is required on the host.

````

- [ ] **Step 3: Update the maintainer release docs**

In `docs-site/src/content/docs/contributing/releases.md`:

Change the release-flow step 6 (line 35) from:

```markdown
6. Confirm the Docker publishing workflow created the expected image tags. Helm chart publishing is planned for a later phase.
````

to:

```markdown
6. Confirm the publishing workflow created the expected Docker image tags, pushed the Helm chart to GHCR, and attached the binaries and `checksums.txt` to the Release.
```

Change the `## Docker publishing` heading (line 41) to `## Publishing`, and replace its first paragraph (line 43) from:

```markdown
PR CI also runs `helm lint` and `helm template` against the chart in `charts/remotecache/` (filesystem, S3, and TLS value sets). Publishing the chart as an OCI artifact to GHCR is a separate, later step and is not wired yet.
```

to:

```markdown
PR CI runs `helm lint` and `helm template` against the chart in `charts/remotecache/` (filesystem, S3, and TLS value sets). On release tags the workflow also publishes the chart as an OCI artifact to `oci://ghcr.io/thilak-rao/charts/remotecache` and attaches standalone binaries plus a `checksums.txt` to the Release. The chart, image, and binaries each carry a provenance attestation; consumers verify with `gh attestation verify`.
```

Replace the publish-targets paragraph (line 47) from:

```markdown
Main builds publish `edge` and `sha-<short>`. Release tags publish `latest`, `X.Y.Z`, and `X.Y`. Release images are pushed for `linux/amd64` and `linux/arm64` with SBOM and provenance attestations.
```

to:

```markdown
Main builds publish `edge` and `sha-<short>`. Stable release tags publish `latest`, `X.Y.Z`, and `X.Y`; a prerelease tag (e.g. `v3.0.0-rc.1`) publishes only the exact `X.Y.Z-…` image and never updates `latest`. Release images are pushed for `linux/amd64` and `linux/arm64` with SBOM and provenance. Release tags also publish the Helm chart and the Core 5 binaries (linux/macOS/Windows).
```

- [ ] **Step 4: Update the README install options**

In `README.md`, in the `## Docker` section, after the line `For Kubernetes, install the Helm chart in \`charts/remotecache/\`. See the [Deployment guide]...` (line 75), add:

```markdown
Released versions also publish a Helm OCI chart (`oci://ghcr.io/thilak-rao/charts/remotecache`) and standalone binaries for Linux, macOS, and Windows on the [Releases page](https://github.com/thilak-rao/remotecache/releases). See the [Deployment guide](https://remotecache.dev/guides/deployment/) for verification and install steps.
```

- [ ] **Step 5: Humanize the new prose**

Invoke the `humanizer` skill on the text added in Steps 1–4 (deployment.md binaries + Helm OCI prose, releases.md edits, README addition). Apply its suggestions to strip AI writing tells. Keep code blocks and commands unchanged.

- [ ] **Step 6: Format and build the docs**

Run:

```bash
bun run format docs-site/src/content/docs/guides/deployment.md docs-site/src/content/docs/contributing/releases.md README.md
cd docs-site && bun install --frozen-lockfile && bun run build && cd ..
```

Expected: format reports no remaining issues; the Astro/Starlight build completes with no errors and no broken-link warnings for the new content.

- [ ] **Step 7: Commit**

```bash
git add docs-site/src/content/docs/guides/deployment.md docs-site/src/content/docs/contributing/releases.md README.md
git commit -m "docs: document helm oci install and standalone binaries"
```

---

## Task V: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full local gate**

Run:

```bash
bun run format --check
bun run lint
bun test
helm lint charts/remotecache
helm template charts/remotecache -f charts/remotecache/ci/filesystem-values.yaml >/dev/null
helm template charts/remotecache -f charts/remotecache/ci/s3-values.yaml >/dev/null
helm template charts/remotecache -f charts/remotecache/ci/tls-values.yaml >/dev/null
```

Expected: format check passes, lint clean, all tests pass, `helm lint` reports `1 chart(s) linted, 0 chart(s) failed`, and each `helm template` renders without error.

- [ ] **Step 2: Dry-run the binary build once more end-to-end**

Run:

```bash
bash scripts/build-binaries.sh 0.0.0-verify
( cd dist && shasum -a 256 -c checksums.txt --ignore-missing )
test "$(ls dist/remotecache-* | wc -l | tr -d ' ')" = "5" && echo "5 binaries OK"
rm -rf dist data cache
```

Expected: five binaries build, checksums all `OK`, `5 binaries OK` prints.

- [ ] **Step 3: Confirm the workflow has the three new behaviors**

Run:

```bash
grep -c 'publish-helm:\|publish-binaries:' .github/workflows/publish-image.yml   # expect 2
grep -q "!contains(github.ref, '-')" .github/workflows/publish-image.yml && echo "prerelease guard present"
```

Expected: `2`, then `prerelease guard present`.

- [ ] **Step 4: Confirm the branch is clean**

Run:

```bash
git status --short
```

Expected: empty output (all work committed).

---

## Self-Review

**Spec coverage** (against `docs/superpowers/specs/2026-06-29-release-distribution-design.md`):

- Helm OCI publish + attestation → Task 2. ✓
- Core 5 binaries + checksums + attestation → Tasks 1, 3. ✓
- `scripts/build-binaries.sh` extraction → Task 1. ✓
- Extend `publish-image.yml`, `needs: preflight`, tag-gated, per-job permissions → Tasks 2, 3. ✓
- Prerelease guard (Docker `latest`; GH release `--prerelease` for manual prerelease tags) → Tasks 3, 4. ✓
- In-CI binary smoke test (proves `--compile` bundle) → Task 3 Step + Task 1 Step 4 locally. ✓
- Docs: deployment (Helm OCI + binaries), releases, README; humanizer; no OpenAPI/config change → Task 5. ✓
- Verification incl. static workflow validation + local dry-run → Tasks 2/3 Step "Validate", Task V. ✓

**Placeholder scan:** No `TBD`/`TODO`/"handle edge cases". All action SHAs, target triples, commands, and file paths are concrete. `X.Y.Z` in docs is intentional user-facing placeholder text, not a plan gap.

**Type/identifier consistency:** Job names (`publish-helm`, `publish-binaries`), step output ids (`push.outputs.digest`/`push.outputs.name`), the `VERSION="${GITHUB_REF_NAME#v}"` derivation, and artifact names (`remotecache-<version>-<os>-<arch>`) are used identically across the script, workflow, and docs.

**Known limitation (stated, not a gap):** the live publish path requires this branch on `main` plus a real tag; until then verification is static + local, as the spec's Verification section accepts.
