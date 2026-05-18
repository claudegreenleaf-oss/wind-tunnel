export interface WebGPUInfo {
  supported: boolean;
  adapter: GPUAdapter | null;
  reason?: string;
}

/**
 * Probe the browser for WebGPU support.
 * Returns { supported: true, adapter } on success; otherwise { supported: false, reason }.
 */
export async function detectWebGPU(): Promise<WebGPUInfo> {
  if (typeof navigator === 'undefined' || !navigator.gpu) {
    return { supported: false, adapter: null, reason: 'navigator.gpu is undefined' };
  }
  try {
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) {
      return { supported: false, adapter: null, reason: 'no GPU adapter available' };
    }
    return { supported: true, adapter };
  } catch (err) {
    return { supported: false, adapter: null, reason: `adapter request failed: ${(err as Error).message}` };
  }
}
