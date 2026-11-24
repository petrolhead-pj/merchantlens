#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

npm run build
mkdir -p .demo-tools
release=.demo-tools/merchantlens-checkout.tar.gz
COPYFILE_DISABLE=1 tar -czf "$release" \
    scripts/product.mjs \
    backend/{product,product-http,product-store,exhibition,whatsapp,payu}.mjs \
    frontend/package.json frontend/dist \
    frontend/src/{review-policy,case-data,money-trail-data}.js
if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$release"
else
    shasum -a 256 "$release"
fi
