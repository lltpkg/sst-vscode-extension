#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ANALYZER_DIR="$ROOT_DIR/packages/analyzer"

echo "🚀 Publishing @cute-me-on-repos/sst-analyzer package..."

cd "$ROOT_DIR"

echo "📦 Installing dependencies..."
pnpm install --frozen-lockfile

echo "🔍 Code quality check..."
pnpm run lint --filter=@cute-me-on-repos/sst-analyzer

echo "🏗️ Building package..."
pnpm run build --filter=@cute-me-on-repos/sst-analyzer

cd "$ANALYZER_DIR"

echo "📋 Current package info:"
npm info @cute-me-on-repos/sst-analyzer version 2>/dev/null || echo "Package not yet published"

echo "📦 Current local version: $(node -p "require('./package.json').version")"

if [[ "${1:-}" == "--dry-run" ]]; then
  echo "🔍 Dry run - would publish:"
  npm publish --dry-run --access public
else
  echo "🚀 Publishing to npm..."
  npm publish --access public
  echo "✅ Successfully published @cute-me-on-repos/sst-analyzer!"
fi
