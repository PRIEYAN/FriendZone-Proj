#!/usr/bin/env bash
# Opens the scene preview in Chrome on the discrete GPU.
#
#   bash tools/gpu-preview.sh [port]
#
# Start the preview server first:  npm run start:web -- --no-browser
set -euo pipefail
PORT="${1:-8000}"
URL="https://decentraland.org/bevy-web/?preview=true&realm=http://127.0.0.1:${PORT}&position=0,0"

exec env \
  __NV_PRIME_RENDER_OFFLOAD=1 \
  __GLX_VENDOR_LIBRARY_NAME=nvidia \
  __VK_LAYER_NV_optimus=NVIDIA_only \
  google-chrome-stable \
    --ignore-gpu-blocklist \
    --enable-gpu-rasterization \
    --enable-zero-copy \
    --use-angle=vulkan \
    --enable-features=Vulkan,VulkanFromANGLE,DefaultANGLEVulkan \
    --disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessChecks \
    --autoplay-policy=no-user-gesture-required \
    "$URL"
