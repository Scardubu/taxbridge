#!/usr/bin/env bash
# TaxBridge V12 — Asset Compression Script
# Compresses PNG assets with pngquant and minifies Lottie JSON.
# Run: bash scripts/compress-assets.sh
# Requires: pngquant (brew install pngquant / apt install pngquant)
#           jq       (brew install jq      / apt install jq)

set -euo pipefail

MOBILE_ASSETS="mobile/src/assets"
LOTTIE_DIR="$MOBILE_ASSETS/animations"

echo "=== TaxBridge V12 Asset Compression ==="
echo ""

# ── PNG compression ──────────────────────────────────────────────────────────
PNG_COUNT=0
PNG_SAVED=0

if command -v pngquant &>/dev/null; then
  echo "▸ Compressing PNG assets..."
  while IFS= read -r -d '' png; do
    BEFORE=$(stat -f%z "$png" 2>/dev/null || stat -c%s "$png" 2>/dev/null)
    pngquant --quality=65-80 --speed 1 --force --output "$png" -- "$png" 2>/dev/null || true
    AFTER=$(stat -f%z "$png" 2>/dev/null || stat -c%s "$png" 2>/dev/null)
    SAVED=$((BEFORE - AFTER))
    if [ "$SAVED" -gt 0 ]; then
      echo "  ✓ $(basename "$png"): saved $SAVED bytes"
      PNG_SAVED=$((PNG_SAVED + SAVED))
    fi
    PNG_COUNT=$((PNG_COUNT + 1))
  done < <(find "$MOBILE_ASSETS" -name "*.png" -print0 2>/dev/null)
  echo "  PNG: $PNG_COUNT files processed, ${PNG_SAVED} bytes saved"
else
  echo "⚠ pngquant not installed — skipping PNG compression"
fi

echo ""

# ── Lottie JSON minification ────────────────────────────────────────────────
LOTTIE_COUNT=0
LOTTIE_SAVED=0

if command -v jq &>/dev/null; then
  echo "▸ Minifying Lottie JSON..."
  if [ -d "$LOTTIE_DIR" ]; then
    while IFS= read -r -d '' json; do
      BEFORE=$(stat -f%z "$json" 2>/dev/null || stat -c%s "$json" 2>/dev/null)
      # Compact JSON — remove whitespace
      jq -c '.' "$json" > "${json}.tmp" && mv "${json}.tmp" "$json"
      AFTER=$(stat -f%z "$json" 2>/dev/null || stat -c%s "$json" 2>/dev/null)
      SAVED=$((BEFORE - AFTER))
      if [ "$SAVED" -gt 0 ]; then
        echo "  ✓ $(basename "$json"): saved $SAVED bytes"
        LOTTIE_SAVED=$((LOTTIE_SAVED + SAVED))
      fi
      LOTTIE_COUNT=$((LOTTIE_COUNT + 1))
    done < <(find "$LOTTIE_DIR" -name "*.json" -print0 2>/dev/null)
    echo "  Lottie: $LOTTIE_COUNT files processed, ${LOTTIE_SAVED} bytes saved"
  else
    echo "  No Lottie directory found at $LOTTIE_DIR"
  fi
else
  echo "⚠ jq not installed — skipping Lottie minification"
fi

echo ""

# ── Size audit ───────────────────────────────────────────────────────────────
echo "▸ Asset size audit:"
TOTAL=0
if [ -d "$LOTTIE_DIR" ]; then
  while IFS= read -r -d '' f; do
    SIZE=$(stat -f%z "$f" 2>/dev/null || stat -c%s "$f" 2>/dev/null)
    NAME=$(basename "$f")
    TOTAL=$((TOTAL + SIZE))
    # Gate: Lottie files should be < 50KB
    if [ "$SIZE" -gt 51200 ]; then
      echo "  ⚠ $NAME: ${SIZE} bytes (EXCEEDS 50KB LIMIT)"
    else
      echo "  ✓ $NAME: ${SIZE} bytes"
    fi
  done < <(find "$LOTTIE_DIR" -name "*.json" -print0 2>/dev/null)
fi
echo "  Total Lottie: ${TOTAL} bytes"

echo ""
echo "=== Compression complete ==="
TOTAL_SAVED=$((PNG_SAVED + LOTTIE_SAVED))
echo "Total saved: ${TOTAL_SAVED} bytes"
