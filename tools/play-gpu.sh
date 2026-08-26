#!/usr/bin/env bash
# One-command play: starts the preview server, then opens the scene in Chrome
# on the discrete GPU. Ctrl+C stops both.
#
#   bash tools/play-gpu.sh [port]
#
# Chrome's Vulkan/ANGLE path is incompatible with its native Wayland backend
# ('--ozone-platform=wayland is not compatible with Vulkan'), so this forces
# the X11 (XWayland) backend regardless of the host session type. That is
# harmless on an X11 session and required on a Wayland one.
set -euo pipefail
PORT="${1:-8000}"
URL="https://decentraland.org/bevy-web/?preview=true&realm=http://127.0.0.1:${PORT}&position=0,0"

cleanup() { kill 0 2>/dev/null || true; }
trap cleanup EXIT INT TERM

npx sdk-commands start --web --no-browser --port "$PORT" &
SERVER_PID=$!

# Wait for the preview server to actually come up before pointing Chrome at it.
for _ in $(seq 1 60); do
  curl -s -o /dev/null "http://127.0.0.1:${PORT}/about" && break
  sleep 1
done

env \
  __NV_PRIME_RENDER_OFFLOAD=1 \
  __GLX_VENDOR_LIBRARY_NAME=nvidia \
  __VK_LAYER_NV_optimus=NVIDIA_only \
  google-chrome-stable \
    --ozone-platform=x11 \
    --ignore-gpu-blocklist \
    --enable-gpu-rasterization \
    --enable-zero-copy \
    --use-angle=vulkan \
    --enable-features=Vulkan,VulkanFromANGLE,DefaultANGLEVulkan \
    --disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessChecks \
    --autoplay-policy=no-user-gesture-required \
    "$URL"

wait $SERVER_PID
