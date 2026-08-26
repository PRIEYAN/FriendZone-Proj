/**
 * One place that decides how Chrome is launched for this project.
 *
 * Two things have to be true or the preview is useless:
 *
 *  1. The page must render on the discrete GPU. On an Optimus laptop Chrome
 *     defaults to the integrated adapter, and the Bevy web explorer on a
 *     software or iGPU path drops to single-digit FPS — which tells you nothing
 *     about how the scene actually performs. The __NV_PRIME_* / __VK_LAYER_*
 *     variables push the process onto the NVIDIA card; --use-angle=vulkan makes
 *     ANGLE go through the NVIDIA Vulkan ICD rather than GL.
 *
 *  2. The page must be allowed to reach the local preview server. The explorer
 *     is served from https://decentraland.org and fetches the scene from
 *     http://127.0.0.1:<port>, which Chrome 142+ gates behind a Local Network
 *     Access prompt. Unattended runs can never click that prompt, so the check
 *     is disabled for the automated launch only.
 */
export const CHROME = '/usr/sbin/google-chrome-stable'

export function chromeArgs(extra = []) {
  return [
    '--window-size=1600,900',
    // GPU: force the hardware path and refuse to silently fall back.
    '--ignore-gpu-blocklist',
    '--enable-gpu-rasterization',
    '--enable-zero-copy',
    '--use-angle=vulkan',
    '--enable-features=Vulkan,VulkanFromANGLE,DefaultANGLEVulkan',
    '--enable-unsafe-webgpu',
    // Local preview server reachability (see note 2 above).
    '--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessChecks',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-session-crashed-bubble',
    '--autoplay-policy=no-user-gesture-required',
    ...extra
  ]
}

export function gpuEnv(base = process.env) {
  return {
    ...base,
    DISPLAY: base.DISPLAY || ':0',
    __NV_PRIME_RENDER_OFFLOAD: '1',
    __GLX_VENDOR_LIBRARY_NAME: 'nvidia',
    __VK_LAYER_NV_optimus: 'NVIDIA_only'
  }
}
