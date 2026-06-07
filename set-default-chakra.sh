#!/bin/bash
# =====================================================================
# Set the default Vastu chakra image.
# Usage:  ./set-default-chakra.sh path/to/your-chakra-image.png
# Accepts PNG / JPG / WEBP / AVIF — converts to the bundled default PNG.
# =====================================================================
set -e

SRC="$1"
DEST="assets/chakras/vastu-shakti-chakra.png"

if [ -z "$SRC" ]; then
  echo "Usage: ./set-default-chakra.sh <image-file>"
  echo "Example: ./set-default-chakra.sh my-chakra.webp"
  exit 1
fi

if [ ! -f "$SRC" ]; then
  echo "Error: file not found: $SRC"
  exit 1
fi

# sips ships with macOS and handles png/jpg/webp/avif
sips -s format png "$SRC" --out "$DEST" >/dev/null
echo "Done. Default chakra set from: $SRC"
sips -g pixelWidth -g pixelHeight "$DEST"
echo "Reload the app to see it."
