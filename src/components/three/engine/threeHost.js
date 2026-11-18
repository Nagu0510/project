// ONE WebGL renderer per panel, created once and disposed on unmount. Every 3D scene in the app is built on this host, so the rules live here:
//   * pixel ratio capped at 2
//   * the render loop is paused while the tab is hidden or the panel is off screen (setActive / visibilitychange)
//   * webglcontextlost: preventDefault (so the browser may restore it), stop drawing, tell the page; webglcontextrestored: rebuild the scene
//   * dispose(): cancel the frame, remove every listener, dispose geometries / materials / textures of the scene, renderer.dispose(),
//     then forceContextLoss() (in that order: dispose() first removes Three's own listener, so no "Context Lost" console message), remove the canvas
//   * THREE.Timer (not the deprecated THREE.Clock) drives time
import * as THREE from 'three';

export function disposeObject(root) {
  const seen = new Set();
  root.traverse((obj) => {
    const mats = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : [];
    obj.geometry?.dispose?.();
    mats.forEach((m) => {
      if (seen.has(m)) return;
      seen.add(m);
      Object.values(m).forEach((v) => { if (v && v.isTexture) v.dispose(); });
      m.dispose?.();
    });
  });
}

/**
 * @param container   element the canvas is appended to (its size drives the renderer)
 * @param options     { fov, near, far, animated, onStatus(status), onRestore() }
 *   animated=false: the scene is drawn only when something asks for it (requestRender), for prefers-reduced-motion.
 */
export function createThreeHost(container, { fov = 40, near = 0.1, far = 200, animated = true, onStatus = () => {}, onRestore = () => {} } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'default' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  container.appendChild(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(fov, 1, near, far);
  const timer = new THREE.Timer();
  timer.connect(document); // resets the delta when the tab comes back, so nothing jumps

  const frameCallbacks = new Set();
  let raf = 0;
  let disposed = false;
  let lost = false;
  let panelActive = true;
  let needsRender = true;
  let frames = 0;
  let width = 0;
  let height = 0;

  const draw = (now) => {
    raf = 0;
    if (disposed || lost) return;
    timer.update(now);
    const delta = timer.getDelta();
    const elapsed = timer.getElapsed();
    if (animated || needsRender) {
      frameCallbacks.forEach((fn) => fn(delta, elapsed));
      renderer.render(scene, camera);
      needsRender = false;
      frames += 1;
      container.dataset.frames = String(frames);
      if (frames === 1) host.onFirstFrame?.();
      host.onAfterRender?.(); // right after render(), while the drawing buffer is still readable
    }
    schedule();
  };

  const shouldRun = () => !disposed && !lost && panelActive && !document.hidden;
  const schedule = () => {
    if (!raf && shouldRun()) raf = requestAnimationFrame(draw);
  };
  const stop = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };

  const resize = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h || (w === width && h === height)) return;
    width = w;
    height = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    host.onResize?.(w, h);
    needsRender = true;
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);

  const onVisibility = () => {
    if (document.hidden) stop();
    else schedule();
  };
  document.addEventListener('visibilitychange', onVisibility);

  const onLost = (event) => {
    event.preventDefault(); // without this the browser never tries to restore the context
    if (disposed) return;
    lost = true;
    stop();
    onStatus('lost');
  };
  const onRestored = () => {
    if (disposed) return;
    lost = false;
    onRestore();
    needsRender = true;
    onStatus('restored');
    schedule();
  };
  canvas.addEventListener('webglcontextlost', onLost, false);
  canvas.addEventListener('webglcontextrestored', onRestored, false);

  const host = {
    THREE,
    renderer,
    scene,
    camera,
    canvas,
    container,
    get width() { return width; },
    get height() { return height; },
    get frames() { return frames; },
    get isLost() { return lost; },
    onFrame(fn) { frameCallbacks.add(fn); return () => frameCallbacks.delete(fn); },
    requestRender() { needsRender = true; schedule(); },
    setActive(active) {
      panelActive = active;
      if (active) { needsRender = true; schedule(); } else stop();
    },
    start() { resize(); schedule(); },
    resize,
    onFirstFrame: null,
    onAfterRender: null,
    onResize: null,
    dispose() {
      if (disposed) return;
      disposed = true;
      stop();
      frameCallbacks.clear();
      resizeObserver.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('webglcontextlost', onLost, false);
      canvas.removeEventListener('webglcontextrestored', onRestored, false);
      timer.disconnect?.();
      timer.dispose?.();
      disposeObject(scene);
      scene.clear();
      renderer.dispose(); // removes Three's own context listeners first ...
      if (!lost) renderer.forceContextLoss(); // ... so releasing the context logs nothing (a context that is already lost has nothing to release)
      canvas.remove();
    },
  };
  return host;
}
