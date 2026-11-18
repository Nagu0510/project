// The 3D pathway ribbon, built on the shared host (one renderer, disposed on unmount). setData() rebuilds the ribbon, the nodes and
// the labels from the milestones of the selected career path, so a track change never shows stale data.
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { disposeObject } from '../engine/threeHost';
import {
  buildRibbon, clampRect, fitDistance, labelRect, LIGHTING, milestoneState, NODE_RADIUS, orientationFor, resolveLabelOverlaps, RIBBON_COLORS, stateColors,
} from './ribbonLayout';

const CHIP_GAP = 18;
const TILT = 0.22; // radians above the ribbon's plane

export function createRoadmapScene(host, labelLayer, { onSelect, reducedMotion, theme: initialTheme = 'dark' }) {
  const { THREE, scene, camera, canvas } = host;
  const world = new THREE.Group();
  scene.add(world);

  let theme = initialTheme === 'light' ? 'light' : 'dark';
  const ambient = new THREE.AmbientLight(0xffffff, LIGHTING[theme].ambient);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight(0xffffff, LIGHTING[theme].sun);
  sun.position.set(4, 6, 8);
  scene.add(sun);
  const lime = new THREE.PointLight(LIGHTING[theme].pointColor, LIGHTING[theme].point, 30, 1.6);
  lime.position.set(-5, -3, 6);
  scene.add(lime);

  const controls = new OrbitControls(camera, canvas);
  controls.enablePan = false;
  controls.enableZoom = false; // the page keeps its own scrolling: zoom is Ctrl+wheel or the buttons
  controls.enableDamping = !reducedMotion;
  controls.dampingFactor = 0.08;
  controls.rotateSpeed = 0.6;
  controls.minPolarAngle = Math.PI / 2 - TILT - 0.5;
  controls.maxPolarAngle = Math.PI / 2 - TILT + 0.7;
  controls.minAzimuthAngle = -0.85;
  controls.maxAzimuthAngle = 0.85;
  canvas.style.touchAction = 'pan-y'; // a vertical swipe scrolls the page; a sideways drag orbits
  canvas.style.cursor = 'grab';
  controls.addEventListener('change', () => host.requestRender());

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const tmp = new THREE.Vector3();

  let data = { track: '', milestones: [], currentNumber: 1 };
  let orientation = 'horizontal';
  let nodes = [];
  let labels = [];
  let content = null;
  let ribbonMesh = null; // { mesh, radial, segments, doneUpTo }: its vertex colours are rewritten on a theme change
  let selectedId = null;
  let hovered = -1;
  let userUntil = 0;

  // ---- theme (colours are swapped in place: same renderer, same geometry, nothing is rebuilt) --------------------------------
  function paintRibbon() {
    if (!ribbonMesh) return;
    const { mesh, radial, segments, doneUpTo } = ribbonMesh;
    const attr = mesh.geometry.attributes.color;
    const bright = new THREE.Color(RIBBON_COLORS[theme].bright);
    const dim = new THREE.Color(RIBBON_COLORS[theme].dim);
    for (let i = 0; i < attr.count; i += 1) {
      const u = Math.floor(i / (radial + 1)) / segments;
      (u <= doneUpTo ? bright : dim).toArray(attr.array, i * 3);
    }
    attr.needsUpdate = true;
    mesh.material.emissive.set(RIBBON_COLORS[theme].emissive);
  }

  function applyTheme() {
    const light = LIGHTING[theme];
    ambient.intensity = light.ambient;
    sun.intensity = light.sun;
    lime.intensity = light.point;
    lime.color.set(light.pointColor);
    paintRibbon();
    const colors = stateColors(theme);
    nodes.forEach((n) => {
      const look = colors[n.state];
      n.sphere.material.color.set(look.node);
      n.sphere.material.emissive.set(look.emissive);
      n.sphere.material.emissiveIntensity = look.glow;
      if (n.halo) n.halo.material.color.set(RIBBON_COLORS[theme].halo);
    });
    labels.forEach((entry) => {
      const look = colors[entry.state];
      entry.el.style.background = look.chip;
      entry.el.style.color = look.text;
      entry.el.setAttribute('aria-label', `Milestone ${entry.ms.number}: ${entry.ms.title}, ${look.label}`);
    });
    host.container.dataset.theme = theme;
    host.requestRender();
  }

  // ---- content ------------------------------------------------------------------------------------------------------
  // `release` = false after a context restore: the old GPU objects died with the old context, so deleting them again would only log warnings
  function clearContent(release = true) {
    if (content) {
      world.remove(content);
      if (release) disposeObject(content);
      content = null;
    }
    labelLayer.replaceChildren();
    nodes = [];
    labels = [];
    ribbonMesh = null;
  }

  function frameCamera() {
    const ribbon = data.ribbon;
    if (!ribbon) return;
    const aspect = host.width && host.height ? host.width / host.height : 1.6;
    camera.zoom = 1;
    host.container.dataset.zoom = '1.00';
    camera.updateProjectionMatrix();
    const room = ribbon.orientation === 'vertical' ? 1.9 : undefined; // a tall ribbon leaves room for the buttons on top and the legend below
    const distance = fitDistance(ribbon.extent, { fov: camera.fov, aspect, marginY: room });
    camera.position.set(0, distance * Math.sin(TILT), distance * Math.cos(TILT)); // seen slightly from above, so the winding in depth is visible at once
    controls.target.set(0, 0, 0);
    camera.lookAt(0, 0, 0);
    controls.update();
    controls.saveState();
    host.requestRender();
  }

  function makeLabel(ms, index, state) {
    const look = stateColors(theme)[state];
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'rm3d-label';
    el.setAttribute('data-testid', 'roadmap-3d-label');
    el.dataset.index = String(index);
    el.dataset.id = ms.id;
    el.dataset.state = state;
    el.dataset.title = ms.title;
    el.dataset.number = String(ms.number);
    el.style.background = look.chip;
    el.style.color = look.text;
    el.setAttribute('aria-label', `Milestone ${ms.number}: ${ms.title}, ${look.label}`);
    const num = document.createElement('span');
    num.className = 'rm3d-num';
    num.textContent = String(ms.number).padStart(2, '0');
    const title = document.createElement('span');
    title.className = 'rm3d-title';
    title.textContent = ms.title;
    const status = document.createElement('span');
    status.className = 'rm3d-status';
    status.textContent = look.label;
    el.append(num, title, status);
    el.addEventListener('click', () => onSelect?.(ms.id));
    el.addEventListener('mouseenter', () => { hovered = index; host.requestRender(); });
    el.addEventListener('mouseleave', () => { hovered = -1; host.requestRender(); });
    el.addEventListener('focus', () => { hovered = index; host.requestRender(); });
    el.addEventListener('blur', () => { hovered = -1; host.requestRender(); });
    labelLayer.appendChild(el);
    return el;
  }

  function build(release = true) {
    clearContent(release);
    const { milestones, currentNumber } = data;
    orientation = orientationFor(host.width, host.height);
    const ribbon = buildRibbon(milestones.length, { orientation });
    data.ribbon = ribbon;
    host.container.dataset.theme = theme;
    host.container.dataset.milestones = String(milestones.length);
    host.container.dataset.orientation = orientation;
    host.container.dataset.careerPath = data.track;
    host.container.dataset.titles = milestones.map((m) => m.title).join('|');
    if (!milestones.length) { host.requestRender(); return; }

    content = new THREE.Group();
    world.add(content);
    const pts = ribbon.points.map((p) => new THREE.Vector3(p.x, p.y, p.z));
    const states = milestones.map((m) => milestoneState(m, currentNumber));

    // the ribbon: bright up to the milestone you are on, dim after it
    const frontier = Math.max(0, states.findIndex((s) => s === 'active'));
    const reached = states.reduce((last, s, i) => (s === 'completed' || s === 'active' ? i : last), -1);
    const doneUpTo = pts.length > 1 ? Math.max(reached, frontier, 0) / (pts.length - 1) : 1;
    if (pts.length > 1) {
      const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
      const radial = 10;
      const tube = new THREE.TubeGeometry(curve, Math.max(24, pts.length * 28), 0.075, radial, false);
      const segments = tube.parameters.tubularSegments;
      const count = tube.attributes.position.count;
      const colors = new Float32Array(count * 3);
      tube.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      const mesh = new THREE.Mesh(tube, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.25, emissive: RIBBON_COLORS[theme].emissive, emissiveIntensity: 0.6 }));
      content.add(mesh);
      ribbonMesh = { mesh, radial, segments, doneUpTo };
      paintRibbon();
    }

    milestones.forEach((ms, i) => {
      const state = states[i];
      const look = stateColors(theme)[state];
      const group = new THREE.Group();
      group.position.copy(pts[i]);
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(state === 'active' ? NODE_RADIUS * 1.35 : NODE_RADIUS, 28, 20),
        new THREE.MeshStandardMaterial({ color: look.node, emissive: look.emissive, emissiveIntensity: look.glow, roughness: 0.3, metalness: 0.15 }),
      );
      const hit = new THREE.Mesh(new THREE.SphereGeometry(0.38, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
      group.add(sphere, hit);
      let halo = null;
      if (state === 'active') {
        halo = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.44, 40), new THREE.MeshBasicMaterial({ color: RIBBON_COLORS[theme].halo, transparent: true, opacity: 0.75, side: THREE.DoubleSide }));
        group.add(halo);
      }
      content.add(group);
      nodes.push({ ms, state, group, sphere, hit, halo, index: i });
      labels.push({ el: makeLabel(ms, i, state), ms, state, index: i, side: ribbon.labels[i].side });
    });
    frameCamera();
    updateLabels();
    checkPixels = true;
    host.container.dataset.nonblank = 'pending';
  }

  // ---- labels ---------------------------------------------------------------------------------------------------------
  function priorityOf(entry) {
    if (entry.ms.id === selectedId) return 100;
    if (entry.index === hovered) return 90;
    if (entry.state === 'active') return 50;
    if (entry.state === 'priority') return 30;
    return entry.state === 'next' ? 20 : entry.state === 'completed' ? 10 : 0;
  }

  function updateLabels() {
    const w = host.width;
    const h = host.height;
    if (!w || !h || !labels.length) return;
    world.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
    const items = labels.map((entry) => {
      const node = nodes[entry.index];
      tmp.copy(node.group.position).applyMatrix4(world.matrixWorld).project(camera);
      const px = (tmp.x * 0.5 + 0.5) * w;
      const py = (-tmp.y * 0.5 + 0.5) * h;
      const expanded = entry.ms.id === selectedId || entry.index === hovered;
      entry.el.dataset.expanded = expanded ? 'true' : 'false';
      const full = entry.el.dataset.compact === 'true' ? entry.fullWidth || 110 : entry.el.offsetWidth || 110;
      if (entry.el.dataset.compact !== 'true') entry.fullWidth = full;
      const rect = clampRect(labelRect(px, py, entry.side, full, entry.el.offsetHeight || 26, CHIP_GAP), w, h);
      const compact = clampRect(labelRect(px, py, entry.side, 38, entry.el.offsetHeight || 26, CHIP_GAP), w, h);
      entry.px = px;
      entry.py = py;
      return { id: entry.index, rect, compact, priority: priorityOf(entry), depth: tmp.z };
    });
    const modes = resolveLabelOverlaps(items);
    items.forEach((item) => {
      const entry = labels[item.id];
      const mode = modes[item.id];
      const show = mode !== 'hidden';
      const spot = mode === 'compact' ? item.compact : item.rect;
      entry.el.style.transform = `translate(${Math.round(spot.x)}px, ${Math.round(spot.y)}px)`;
      entry.el.dataset.compact = mode === 'compact' ? 'true' : 'false';
      entry.el.dataset.hidden = show ? 'false' : 'true';
      entry.el.dataset.nx = String(Math.round(entry.px));
      entry.el.dataset.ny = String(Math.round(entry.py));
      entry.el.tabIndex = show ? 0 : -1;
      entry.el.style.zIndex = String(10 + Math.round(priorityOf(entry)));
    });
  }

  // ---- picking ---------------------------------------------------------------------------------------------------------
  function pick(event) {
    const rect = canvas.getBoundingClientRect();
    ndc.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(nodes.map((n) => n.hit), false);
    if (!hits.length) return -1;
    return nodes.findIndex((n) => n.hit === hits[0].object);
  }

  let down = null;
  const onDown = (e) => { down = { x: e.clientX, y: e.clientY }; userUntil = performance.now() + 4000; canvas.style.cursor = 'grabbing'; };
  const onUp = (e) => {
    canvas.style.cursor = 'grab';
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6) {
      const i = pick(e);
      if (i >= 0) onSelect?.(nodes[i].ms.id);
    }
    down = null;
  };
  const onMove = (e) => {
    if (down) return;
    const i = pick(e);
    if (i !== hovered) { hovered = i; canvas.style.cursor = i >= 0 ? 'pointer' : 'grab'; host.requestRender(); }
  };
  const onLeave = () => { if (hovered !== -1) { hovered = -1; host.requestRender(); } };
  const onWheel = (e) => {
    if (!(e.ctrlKey || e.metaKey)) return; // a plain wheel scrolls the page
    e.preventDefault();
    api.zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12);
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerleave', onLeave);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  // ---- per frame -----------------------------------------------------------------------------------------------------
  const removeFrame = host.onFrame((dt, t) => {
    if (!reducedMotion) {
      if (performance.now() >= userUntil) world.rotation.y += (Math.sin(t * 0.35) * 0.09 - world.rotation.y) * Math.min(1, dt * 3); // a gentle sway; it waits while you drag
      const pulse = 1 + Math.sin(t * 2.4) * 0.14;
      nodes.forEach((n) => {
        if (n.halo) { n.halo.scale.setScalar(pulse); n.halo.quaternion.copy(camera.quaternion); n.sphere.material.emissiveIntensity = stateColors(theme).active.glow * (0.8 + 0.3 * Math.sin(t * 2.4)); }
      });
    } else {
      nodes.forEach((n) => { if (n.halo) n.halo.quaternion.copy(camera.quaternion); });
    }
    nodes.forEach((n) => {
      const target = n.ms.id === selectedId ? 1.45 : n.index === hovered ? 1.2 : 1;
      n.sphere.scale.setScalar(target);
    });
    if (controls.update()) host.requestRender();
    updateLabels();
  });

  host.onFirstFrame = () => { host.container.dataset.rendered = 'true'; };

  // after a (re)build, look at the pixels of the next frame once: the panel says whether WebGL really drew something
  let checkPixels = false;
  host.onAfterRender = () => {
    if (!checkPixels || !nodes.length) return;
    checkPixels = false;
    let drew = false;
    try {
      const gl = host.renderer.getContext();
      const px = new Uint8Array(4);
      const w = gl.drawingBufferWidth;
      const h = gl.drawingBufferHeight;
      for (let gx = 1; gx < 24 && !drew; gx += 1) for (let gy = 1; gy < 14 && !drew; gy += 1) {
        gl.readPixels(Math.floor((w * gx) / 24), Math.floor((h * gy) / 14), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        if (px[3] > 0) drew = true;
      }
    } catch { /* reading pixels is only a self-check */ }
    host.container.dataset.nonblank = drew ? 'true' : 'false';
  };

  host.onResize = () => {
    if (!data.milestones.length) return;
    if (orientationFor(host.width, host.height) !== orientation) build();
    else { frameCamera(); updateLabels(); }
  };

  const api = {
    setData(next) {
      data = { track: next.track, milestones: next.milestones, currentNumber: next.currentNumber };
      selectedId = null;
      build();
    },
    rebuild() { build(false); },
    setTheme(next) {
      const value = next === 'light' ? 'light' : 'dark';
      if (value === theme) return;
      theme = value;
      applyTheme();
    },
    setSelected(id) { selectedId = id; host.container.dataset.selected = id || ''; host.requestRender(); },
    resetView() { controls.reset(); camera.zoom = 1; camera.updateProjectionMatrix(); world.rotation.y = 0; host.container.dataset.zoom = '1.00'; host.requestRender(); },
    zoomBy(factor) { camera.zoom = Math.min(2.4, Math.max(0.6, camera.zoom * factor)); camera.updateProjectionMatrix(); host.container.dataset.zoom = camera.zoom.toFixed(2); host.requestRender(); },
    dispose() {
      removeFrame();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('wheel', onWheel);
      controls.dispose();
      clearContent();
    },
  };
  return api;
}
