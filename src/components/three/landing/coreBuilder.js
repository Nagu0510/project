// The landing page's "SkillSense core": a glowing sphere, three orbit rings and nine skill badges circling it. Built on the shared host, so it
// has the same lifecycle as every other 3D panel (one renderer, disposed on unmount, paused when off screen, 2D fallback without WebGL).
export const SKILLS = [
  { label: 'Python', radius: 2.7, speed: 0.35, offset: 0, height: 0.3, primary: true },
  { label: 'Java', radius: 3.1, speed: -0.3, offset: 1.2, height: -0.4, primary: false },
  { label: 'React', radius: 2.8, speed: 0.4, offset: 2.4, height: 0.6, primary: true },
  { label: 'DSA', radius: 3.4, speed: -0.28, offset: 3.6, height: 0.2, primary: true },
  { label: 'AI', radius: 2.9, speed: 0.32, offset: 4.8, height: -0.5, primary: true },
  { label: 'SQL', radius: 3.3, speed: -0.34, offset: 0.7, height: 0.7, primary: false },
  { label: 'MongoDB', radius: 3.0, speed: 0.26, offset: 1.9, height: -0.2, primary: false },
  { label: 'FastAPI', radius: 3.5, speed: -0.31, offset: 3.1, height: -0.7, primary: false },
  { label: 'Cloud', radius: 3.2, speed: 0.38, offset: 4.3, height: 0.5, primary: false },
];

// WebGL materials cannot read CSS variables: one palette per theme (documented allowlist). setTheme() swaps them in place, nothing is rebuilt.
const PALETTES = {
  dark: {
    core: '#0E3A2E', coreEmissive: '#0C6B52', coreGlow: 0.8, wire: '#2DD4BF', ring1: '#2DD4BF', ring2: '#C7F36B', ring3: '#2F7A68',
    orbPrimary: '#C7F36B', orbSecondary: '#2DD4BF', dust: '#C7F36B', dustOpacity: 0.45, ambient: 1.0, sun: 1.8, point: 20, pointColor: '#C7F36B',
  },
  light: {
    core: '#12372A', coreEmissive: '#1F6B50', coreGlow: 0.55, wire: '#1F6B50', ring1: '#1F6B50', ring2: '#5E9E1F', ring3: '#7F988C',
    orbPrimary: '#5E9E1F', orbSecondary: '#0F766E', dust: '#1F6B50', dustOpacity: 0.35, ambient: 1.5, sun: 1.2, point: 4, pointColor: '#FFFFFF',
  },
};

export function createCoreScene(host, labelLayer, { reducedMotion, theme: initialTheme = 'dark' }) {
  const { THREE, scene, camera } = host;
  let theme = initialTheme === 'light' ? 'light' : 'dark';
  const P = () => PALETTES[theme];
  camera.position.set(0, 0, 8.4);
  camera.lookAt(0, 0, 0);

  const ambient = new THREE.AmbientLight(0xffffff, P().ambient);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight(0xffffff, P().sun);
  sun.position.set(5, 8, 5);
  scene.add(sun);
  const lime = new THREE.PointLight(P().pointColor, P().point, 30, 1.6);
  lime.position.set(-4, -3, 3);
  scene.add(lime);

  const root = new THREE.Group();
  scene.add(root);

  const core = new THREE.Mesh(
    new THREE.SphereGeometry(1.35, 48, 48),
    new THREE.MeshStandardMaterial({ color: P().core, emissive: P().coreEmissive, emissiveIntensity: P().coreGlow, roughness: 0.25, metalness: 0.7 }),
  );
  const inner = new THREE.Mesh(
    new THREE.SphereGeometry(1.35, 32, 32),
    new THREE.MeshBasicMaterial({ color: P().wire, wireframe: true, transparent: true, opacity: 0.35 }),
  );
  inner.scale.setScalar(0.88);
  core.add(inner);
  root.add(core);

  const ring = (radius, tube, color, emissive, opacity) => new THREE.Mesh(
    new THREE.TorusGeometry(radius, tube, 16, 100),
    new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: 0.6, transparent: opacity < 1, opacity }),
  );
  const ring1 = ring(2.5, 0.02, P().ring1, P().ring1, 1);
  const ring2 = ring(3.2, 0.022, P().ring2, P().ring2, 1);
  const ring3 = ring(3.9, 0.015, P().ring3, P().ring3, 0.4);
  root.add(ring1, ring2, ring3);

  const orbs = SKILLS.map((skill) => {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 16, 16),
      new THREE.MeshStandardMaterial({ color: skill.primary ? P().orbPrimary : P().orbSecondary, emissive: skill.primary ? P().orbPrimary : P().orbSecondary, emissiveIntensity: 0.6 }),
    );
    root.add(mesh);
    const el = document.createElement('div');
    el.className = 'core-badge';
    el.dataset.primary = String(skill.primary);
    const star = document.createElement('span');
    star.textContent = '✦';
    const text = document.createElement('span');
    text.textContent = skill.label;
    el.append(star, text);
    labelLayer.appendChild(el);
    return { skill, mesh, el };
  });

  const count = 45;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = (((i * 37) % 100) / 100 - 0.5) * 10;
    positions[i * 3 + 1] = (((i * 53) % 100) / 100 - 0.5) * 8;
    positions[i * 3 + 2] = (((i * 71) % 100) / 100 - 0.5) * 6;
  }
  const dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const dust = new THREE.Points(dustGeometry, new THREE.PointsMaterial({ size: 0.06, color: P().dust, transparent: true, opacity: P().dustOpacity }));
  root.add(dust);

  const pointer = { x: 0, y: 0 };
  const onMove = (e) => {
    const rect = host.container.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    host.requestRender();
  };
  host.container.addEventListener('pointermove', onMove);

  const tmp = new THREE.Vector3();
  const place = (t) => {
    orbs.forEach(({ skill, mesh, el }) => {
      const a = t * skill.speed + skill.offset;
      mesh.position.set(Math.cos(a) * skill.radius, Math.sin(a * 1.5) * 0.45 + skill.height, Math.sin(a) * skill.radius);
      root.updateMatrixWorld();
      tmp.copy(mesh.position).applyMatrix4(root.matrixWorld).project(camera);
      const x = (tmp.x * 0.5 + 0.5) * host.width;
      const y = (-tmp.y * 0.5 + 0.5) * host.height;
      el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -50%)`;
      el.style.zIndex = String(Math.round((1 - tmp.z) * 100));
    });
  };

  const removeFrame = host.onFrame((dt, t) => {
    const time = reducedMotion ? 0 : t;
    core.rotation.y = time * 0.25;
    core.rotation.x = Math.sin(time * 0.2) * 0.1;
    core.position.x += ((pointer.x || 0) * 0.4 - core.position.x) * 0.05;
    core.position.y += ((pointer.y || 0) * 0.4 - core.position.y) * 0.05;
    ring1.rotation.z = time * 0.15;
    ring1.rotation.x = Math.PI / 3 + Math.sin(time * 0.1) * 0.05;
    ring2.rotation.z = -time * 0.12;
    ring2.rotation.y = Math.PI / 4 + Math.cos(time * 0.1) * 0.05;
    ring3.rotation.z = time * 0.08;
    dust.rotation.y = time * 0.03;
    root.position.y = Math.sin(time * 1.5) * 0.1;
    place(time);
  });

  host.onFirstFrame = () => { host.container.dataset.rendered = 'true'; };
  host.onResize = () => { host.requestRender(); };

  const applyTheme = () => {
    const p = P();
    ambient.intensity = p.ambient;
    sun.intensity = p.sun;
    lime.intensity = p.point;
    lime.color.set(p.pointColor);
    core.material.color.set(p.core);
    core.material.emissive.set(p.coreEmissive);
    core.material.emissiveIntensity = p.coreGlow;
    inner.material.color.set(p.wire);
    [[ring1, p.ring1], [ring2, p.ring2], [ring3, p.ring3]].forEach(([mesh, color]) => { mesh.material.color.set(color); mesh.material.emissive.set(color); });
    orbs.forEach(({ skill, mesh }) => {
      const color = skill.primary ? p.orbPrimary : p.orbSecondary;
      mesh.material.color.set(color);
      mesh.material.emissive.set(color);
    });
    dust.material.color.set(p.dust);
    dust.material.opacity = p.dustOpacity;
    host.container.dataset.theme = theme;
    host.requestRender();
  };
  host.container.dataset.theme = theme;

  return {
    setTheme(next) {
      const value = next === 'light' ? 'light' : 'dark';
      if (value === theme) return;
      theme = value;
      applyTheme();
    },
    rebuild() { host.requestRender(); },
    dispose() {
      removeFrame();
      host.container.removeEventListener('pointermove', onMove);
      labelLayer.replaceChildren();
    },
  };
}
