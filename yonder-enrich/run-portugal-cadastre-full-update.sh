#!/bin/bash

# Full Portugal Cadastre Update - Production Run
# This script updates ALL Portuguese plots with cadastral data (DGT + BUPi)
# SAFE: Only updates cadastral field, preserves all other enrichments

echo "=================================================="
echo "Portugal Cadastre - Full Production Update"
echo "=================================================="
echo ""
echo "⚠️  IMPORTANT SAFETY FEATURES:"
echo "  ✅ Updates ONLY the 'cadastral' field"
echo "  ✅ Preserves ALL other enrichments (cafe, beach, zoning, etc.)"
echo "  ✅ Skips any plot if data loss is detected"
echo "  ✅ Calls both DGT and BUPi in parallel for maximum coverage"
echo "  ✅ Stores BUPi geometry for validation when DGT has data"
echo ""
echo "📊 EXPECTED COVERAGE:"
echo "  - Total PT plots: ~2M+"
echo "  - DGT coverage: ~18% (urban areas)"
echo "  - BUPi coverage: ~64% (rural areas)"
echo "  - Combined success: ~82%"
echo ""
echo "⏱️  ESTIMATED RUNTIME:"
echo "  - At 3 workers × 500ms delay: ~6-8 hours for 2M plots"
echo "  - Progress logged to console"
echo ""
echo "Press CTRL+C to stop at any time (safe to resume later)"
echo ""
read -p "Ready to start full production run? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
  echo "Aborted by user"
  exit 0
fi

echo ""
echo "🚀 Starting full production update..."
echo ""

# Run with production settings
PORTUGAL_CADASTRE_FORCE_CADASTRAL_ONLY=true \
PORTUGAL_CADASTRE_DRY_RUN=false \
PORTUGAL_CADASTRE_CONCURRENCY=3 \
PORTUGAL_CADASTRE_INTER_PLOT_DELAY_MS=500 \
npm run portugal-cadastre

echo ""
echo "=================================================="
echo "✅ Portugal Cadastre Update Complete!"
echo "=================================================="
