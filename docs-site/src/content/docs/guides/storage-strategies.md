---
title: Storage strategies
description: Store your self-hosted Nx remote cache on local disk or any S3-compatible bucket (AWS S3, MinIO), or write a custom storage strategy.
---

The self-hosted Nx remote cache server has two built-in storage backends: **filesystem** (the default) and **S3-compatible object storage**. Both are append-only — an existing hash always returns `409` and is never overwritten.

## Filesystem (default)

When `STORAGE_STRATEGY` is not set (or is anything other than `s3`), cache entries are stored on disk under `CACHE_DIR` (default: `./cache`).

In production, mount a persistent volume at `./cache`, or point `CACHE_DIR` at a path that survives restarts. See [Configuration](/guides/configuration/) for all environment variables.

## S3-compatible storage

Set `STORAGE_STRATEGY=s3` plus the four required `S3_*` variables. `S3_ENDPOINT` is optional; only needed for MinIO or other S3-compatible providers:

```sh
export STORAGE_STRATEGY=s3
export S3_REGION=us-east-1
export S3_BUCKET=nx-cache
export S3_ACCESS_KEY_ID=...
export S3_SECRET_ACCESS_KEY=...
export S3_ENDPOINT="http://localhost:9000"  # optional (MinIO, etc.)
```

With S3 there is no local cache directory to persist; the bucket handles durability.

## Custom storage strategy

Implement the `CacheStorageStrategy` interface (`src/cache/storage-strategy/storage-strategy.interface.ts`) and register the new class in `createCacheStorage` (`src/cache/create-cache-storage.ts`). The existing `file-system.ts` and `s3.ts` are the simplest references.

All strategies are append-only: if an entry already exists for a given hash, the handler returns `409` without calling `write`. See [Security](/guides/security/) for how this ties into the server's trust model.
