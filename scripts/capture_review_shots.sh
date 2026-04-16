#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-https://8081-ikrklnolujvsgoyc8nrb4-f0563e0e.us2.manus.computer}"
OUT_DIR="/home/ubuntu/h-wallet-ui-rebuild/review-shots-v2"
TMP_DIR="/tmp/hwallet-shot-profiles"

mkdir -p "$OUT_DIR" "$TMP_DIR"
rm -f "$OUT_DIR"/*.png

capture() {
  local name="$1"
  local url="$2"
  local profile_dir="$3"
  rm -rf "$profile_dir"
  mkdir -p "$profile_dir"
  chromium \
    --headless=new \
    --disable-gpu \
    --hide-scrollbars \
    --force-device-scale-factor=1 \
    --window-size=520,1180 \
    --run-all-compositor-stages-before-draw \
    --virtual-time-budget=5500 \
    --user-data-dir="$profile_dir" \
    --screenshot="$OUT_DIR/$name.png" \
    "$url" >/tmp/${name}-capture.log 2>&1
}

capture "login" "$BASE_URL/" "$TMP_DIR/login"
capture "wallet" "$BASE_URL/wallet" "$TMP_DIR/wallet"
capture "chat" "$BASE_URL/chat" "$TMP_DIR/chat"
capture "earn" "$BASE_URL/earn" "$TMP_DIR/earn"
capture "community" "$BASE_URL/community" "$TMP_DIR/community"

echo "Screenshots saved to $OUT_DIR"
ls -1 "$OUT_DIR"
