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
