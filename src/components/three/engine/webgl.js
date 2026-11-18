// Feature checks that run BEFORE Three.js is loaded, so a browser without WebGL never even downloads the 3D code.

/** True when a WebGL context can be created. The probe context is released straight away so it never counts against the browser's limit. */
export function detectWebGL() {
  try {
    if (typeof document === 'undefined') return false;
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export function prefersReducedMotion() {
  try {
    return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  } catch {
    return false;
  }
}
