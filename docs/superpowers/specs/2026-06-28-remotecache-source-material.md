# Source material — remotecache.dev narrative & SEO

Companion to `2026-06-28-remotecache-docs-marketing-seo-design.md`. This is the
factual backbone for the `/why`, `/security/cve-2025-36852`, `/compare/nx-cloud`,
and `/guides/migrate-from-nx-s3-cache` pages. **Cite these sources; do not invent
facts, numbers, or benchmarks beyond what is here.**

## Primary sources

- **Deprecation tweet** — Jeff Cross (@jeffbcross), May 21, 2026, 3:26 PM:
  <https://x.com/jeffbcross/status/2057543663727833369>
- **Nx deprecation notice** —
  <https://nx.dev/docs/reference/deprecated/self-hosted-cache-packages>
- **Nx remote-cache plugins (current)** —
  <https://nx.dev/docs/reference/remote-cache-plugins>
- **Custom-tasks-runner deprecation** —
  <https://nx.dev/docs/reference/deprecated/custom-tasks-runner>
- **Community fallout** — GitHub discussion
  <https://github.com/nrwl/nx/discussions/28332>; Rust-migration/runner issue
  <https://github.com/nrwl/nx/issues/28434>.
- **CVE** — CVE-2025-36852 ("CREEP").
- **Adjacent incident** — TanStack npm supply-chain compromise postmortem
  (2026-05-11): a chained `pull_request_target` Pwn Request + GitHub Actions
  cache poisoning. Context only; not the cause of Nx's decision.

## Verbatim tweet (Jeff Cross, @jeffbcross — May 21, 2026)

> Today we officially deprecated 4 packages that facilitated remote caching with
> Nx and different cloud providers: nx/s3-cache, nx/gcs-cache, nx/azure-cache and
> nx/shared-fs-cache. This is a proactive move to discourage a known attack
> vector in recent supply chain attacks: cache poisoning.
>
> This isn't related to Nx Cloud's remote caching which has built-in protection
> against poisoning. These plugins were used by teams who couldn't use Nx Cloud
> but wanted the speed benefits of distributed task caching.
>
> We published a CVE (CREEP CVE-2025-36852) last year against these packages to
> make it clear that they shouldn't be used for serious projects because of the
> inherent design flaw. But we still see the plugins used in irresponsible ways.
>
> Cyber attacks are ramping up, and are only going to get more effective as the
> tools the attackers use become more powerful. We're no longer compromising by
> providing tools that we know most users are using irresponsibly.
>
> The notice linked in the next tweet gives more details and recommendations.

## Article digest (the public record)

### The timeline (free → paid → free → deprecated)

- **Before Nx v20:** community plugins via the `tasksRunnerOptions` field in
  `nx.json` (e.g. `@nx-aws-plugin/nx-aws-cache`, `NiklasPor/nx-remotecache-custom`
  and its `-azure` / `-minio` variants) self-hosted the cache — free, often to
  avoid paying for Nx Cloud.
- **Nx v20 (Sep 2024):** three changes — `tasksRunnerOptions` deprecated; caching
  became database-driven; Nx introduced **`@nx/powerpack`**, an official **paid**
  self-hosted cache. Community plugins like `nx-remotecache-custom` were archived
  (custom filesystem caching stops working in Nx 21). Self-hosting effectively
  required paying for Powerpack. Community reaction was strongly negative
  (discussion #28332; Reddit; a "cautionary tale of migrating to NX" post).
- **Nx's defense:** deprecating the `tasksRunnerOptions` API was framed as a
  technical necessity for the Rust core rewrite (the old Node.js API was too
  coupled to the legacy core). They offered open-source `preTasksExecution` /
  `postTasksExecution` hooks for non-caching uses. The community still read the
  forced move to paid Powerpack as vendor lock-in.
- **Nx v20.8 (Apr 2025):** Nx reversed course and **reintroduced free official
  self-hosted plugins** (`@nx/s3-cache`, `@nx/gcs-cache`, `@nx/azure-cache`,
  `@nx/shared-fs-cache`). "Full refunds will be issued to anyone who paid for
  these packages during this transition." **But** these plugins ship under a
  **Commercial license, not MIT.**
- **May 21, 2026:** Nx **deprecated all four** free plugins, citing
  **CVE-2025-36852 (CREEP)** cache poisoning. Packages remain on npm so existing
  builds don't break, but get **no further updates or security fixes** and may be
  removed later. **Powerpack is also sunset** as a standalone product (folded into
  the Enterprise plan). Nx's recommended path is **Nx Cloud** (paid).

### CVE-2025-36852 (CREEP) — the mechanics

The flaw is **architectural, not a code bug:**

- The plugins use a **single shared credential** that both reads from and writes
  to the entire cache. Cache artifacts are **not bound to their source** (branch
  / trust boundary).
- Attack: open a PR off `main` with **no source changes** but a **modified CI
  workflow** that builds a malicious artifact. The CI workflow **isn't part of
  the cache key**, so the PR hashes to the **same key** a trusted `main` build
  will hash to. If the PR **uploads its poisoned artifact first**, every later
  `main` build gets a **cache hit on the poisoned artifact** and ships it without
  rebuilding → **arbitrary code execution**.
- Nx states this is a design issue that cannot be patched; hence deprecation
  rather than a fix.

### The options (and where this server fits)

- **Option A — Accept the risk with mitigations:** private repos, no external
  PRs, and **split/isolate caches between PR and production**. Concretely, add an
  environment variable to named inputs in `nx.json` so PR vs. prod cache keys
  diverge:
  ```json
  { "targetDefaults": { "build": { "inputs": ["default", { "env": "CI_PIPELINE_ENVIRONMENT" }] } } }
  ```
  Downside: you're on unmaintained software as Nx marches to v22+.
- **Option B — Migrate to Nx Cloud:** Nx's recommended path. Native zero-trust
  cache boundaries, token isolation, artifact-integrity verification. **Paid.**
- **Option C — Disable remote caching:** local cache only. Removes the risk;
  slows CI — fresh runners and cold checkouts rebuild from scratch, and large
  monorepos pay the most. Don't cite a specific speed figure as our measurement.
- **Option D — Build a custom zero-trust cache server:** Nx still allows a custom
  remote cache endpoint. You own all the security (signing, integrity, access
  control) or you reproduce the flaw.

> **How `remotecache` relates (for honest positioning):** this server is the
> self-hosted custom-endpoint path. Its `readonly`/`full` token split is the
> _primitive_ for Option A's "restrict writes by trust boundary" — untrusted
> contexts get `readonly` and **cannot write**, so they cannot poison the cache.
> It is **not** Nx Cloud's cryptographic artifact verification (Option B), and
> append-only is **first-writer-wins** — so do not claim it "fixes" CVE-2025-36852.
> See the spec's Honesty guardrails.

### Pricing facts (for the comparison page)

- **Nx Cloud:** Hobby **$0** (free forever — 50,000 monthly credits, remote
  caching with Nx Replay, distributed task execution with Nx Agents, for small
  teams). Team **$19 per active contributor/month** (first 5 free) + usage
  overages. Enterprise **custom**.
- **Nx Powerpack (now sunset):** **$250/seat/year** billed annually (save 20%) or
  **$26/seat/month** billed monthly.
- Verify current numbers against `nx.dev/pricing` before publishing — pricing
  drifts; cite the date observed.

### Commercial-license terms on the deprecated plugins (license page

Even while free, the `@nx/*-cache` plugins were **Commercial-licensed, not MIT**.
You may **not**: copy/modify/reverse-engineer; sell/rent/redistribute; use to
compete with Nx or benchmark; abuse/automate activation-key creation. Nx may
collect anonymous adoption data. Full terms:
<https://cloud.nx.app/terms/self-hosted-cache/2025-03-05>. This contrast — **MIT
(this project) vs. Commercial (the official plugins)** — is a legitimate,
citable differentiator.

### Nx version notes (for the migration page)

- **Nx v20:** `tasksRunnerOptions` is deprecated but still works via
  `{ "useLegacyCache": true }` in `nx.json`.
- **Nx v21+:** the legacy cache engine is removed; use the remote-cache plugin
  interface / a custom remote-cache endpoint (where this server plugs in).
