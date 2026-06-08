# WebGPU Acceleration Guide 🚀

LXRT includes experimental support for WebGPU, allowing for significantly faster inference (10-50x speedup compared to WASM) on supported devices.

## Requirements

### Browsers
- **Google Chrome / Chromium**: Version 113+ (Enabled by default)
- **Microsoft Edge**: Version 113+ (Enabled by default)
- **Firefox**: Nightly (requires enabling `dom.webgpu.enabled` in `about:config`)
- **Safari**: Technology Preview (requires enabling WebGPU in experimental features)

### Hardware
- GPU with Vulkan, Metal, or DirectX 12 support.
- Integrated GPUs (Intel Iris Xe, Apple M1/M2/M3) show significant improvements.
- Dedicated GPUs (NVIDIA/AMD) provide best performance.

## Enabling WebGPU

LXRT attempts to use available hardware acceleration automatically. You can explicitly request WebGPU using the `device` configuration.

```typescript
import { createAIProvider } from 'lxrt';

const provider = createAIProvider({
  llm: {
    model: 'Xenova/Qwen1.5-0.5B-Chat',
    device: 'webgpu', // Force WebGPU
    dtype: 'fp32'     // q8/q4/fp16/fp32 supported
  }
});
```

### Auto Mode (Default)
If you do not specify a device or set `device: 'auto'`, LXRT follows this fallback chain:
1. **WebGPU**: If available and supported.
2. **WASM (SIMD)**: Fallback for high performance CPU execution.
3. **CPU**: Standard fallback.

## Configuration Options

You can fine-tune WebGPU behavior via `webgpuOptions`:

```typescript
const provider = createAIProvider({
  llm: {
    model: 'Xenova/gemma-2b',
    device: 'webgpu',
    webgpuOptions: {
      powerPreference: 'high-performance', // or 'low-power'
      forceFallbackAdapter: false
    }
  }
});
```

### Advanced Settings

WebGPU sessions use optimized settings by default:
- `executionProviders`: `['webgpu']`
- `preferredOutputLocation`: `gpu-buffer` (keeps data on GPU to reduce CPU-GPU sync overhead)
- `graphOptimizationLevel`: `all`

## Performance & Profiling

You can check if WebGPU is available at runtime:

```typescript
import { gpuDetector } from 'lxrt';

const caps = await gpuDetector.detect();
if (caps.webgpuAvailable) {
  console.log('WebGPU Provider:', caps.adapterInfo);
}
```

## Node.js Support
**STATUS: NOT SUPPORTED / PLACEHOLDER**

WebGPU in Node.js currently has **no implementation** in this library (it is a stub).

### Recommended Workaround: Headless Browser Bridge
To achieve WebGPU acceleration in a Node.js environment (e.g., for Agents), you must run `lxrt` inside a Headless Browser (like Playwright or Puppeteer) and communicate with it.

1.  **Launch** Playwright with WebGPU enabled.
2.  **Load** `lxrt` in the browser context.
3.  **Bridge** calls (Chat, Embed) via `page.evaluate()` or WebSockets.

## Troubleshooting

### "WebGPU requested but not available"
- **Cause**: Browser does not support WebGPU or hardware incompatibility.
- **Solution**: LXRT automatically falls back to WASM. Ensure drivers are up to date.

### High Memory Usage
- **Cause**: Loading large models (e.g. 7B parameters) into GPU VRAM.
- **Solution**: Use quantized models (`q8`, `q4`) to reduce VRAM usage.
```typescript
{ dtype: 'q8' }
```

### First Inference Latency
- **Cause**: Shader compilation occurs during the first run.
- **Solution**: This is normal. Subsequent runs will be much faster. Use `provider.warmup()` during app initialization.
