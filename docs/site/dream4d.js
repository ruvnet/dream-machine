/**
 * dream4d — a four-dimensional hero for the Dream Machine.
 *
 * A tesseract (4-cube) turning through its fourth axis, rendered with three.js.
 * The conceit: the 4th axis is TIME. One full rotation through w is one night.
 * Scroll advances the night; the hypercube unfolds from 4D shadow into 3D form.
 *
 * Self-contained: three.js is vendored locally, the glow sprite is generated at
 * runtime, and everything degrades to a single static frame under
 * prefers-reduced-motion or when WebGL is unavailable.
 */
import * as THREE from './vendor/three.module.min.js';

const canvas = document.getElementById('dream4d');
if (canvas) init(canvas);

function init(canvas) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  } catch {
    return; // no WebGL — the CSS nebula remains as the backdrop
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
  camera.position.set(0, 0, 6.4);

  // ---- glow sprite (radial gradient, drawn once) ----
  const glowTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.25, 'rgba(190,220,255,0.7)');
    grad.addColorStop(1, 'rgba(120,90,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    return t;
  })();

  // ---- 4D hypercube geometry: 16 vertices, edges differ in exactly one coord ----
  const verts4 = [];
  for (let i = 0; i < 16; i++) {
    verts4.push([(i & 1) ? 1 : -1, (i & 2) ? 1 : -1, (i & 4) ? 1 : -1, (i & 8) ? 1 : -1]);
  }
  const edges = [];
  for (let a = 0; a < 16; a++) {
    for (let b = a + 1; b < 16; b++) {
      let diff = 0;
      for (let k = 0; k < 4; k++) if (verts4[a][k] !== verts4[b][k]) diff++;
      if (diff === 1) edges.push([a, b]);
    }
  }

  function makeCube(scale, coolToWarm) {
    const positions = new Float32Array(edges.length * 2 * 3);
    const colors = new Float32Array(edges.length * 2 * 3);
    const cool = new THREE.Color(0x22d3ee); // cyan
    const warm = new THREE.Color(0xe879f9); // magenta
    for (let e = 0; e < edges.length; e++) {
      for (let s = 0; s < 2; s++) {
        const vi = edges[e][s];
        const w = verts4[vi][3];
        const col = coolToWarm ? cool.clone().lerp(warm, (w + 1) / 2) : warm.clone().lerp(cool, (w + 1) / 2);
        const o = (e * 2 + s) * 3;
        colors[o] = col.r; colors[o + 1] = col.g; colors[o + 2] = col.b;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
    const lines = new THREE.LineSegments(geo, mat);

    // vertex glows
    const pgeo = new THREE.BufferGeometry();
    pgeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(16 * 3), 3));
    const pmat = new THREE.PointsMaterial({ map: glowTex, color: 0xa78bfa, size: 0.42 * scale, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true });
    const points = new THREE.Points(pgeo, pmat);

    const group = new THREE.Group();
    group.add(lines);
    group.add(points);
    group.userData = { scale, lines, points };
    scene.add(group);
    return group;
  }

  const outer = makeCube(1.0, true);
  const inner = makeCube(0.5, false);
  inner.userData.phase = Math.PI / 3;

  // ---- particle nebula ----
  const NB = 1500;
  const nbPos = new Float32Array(NB * 3);
  for (let i = 0; i < NB; i++) {
    const r = 9 + Math.pow((i % 97) / 97, 0.5) * 26;
    const th = (i * 2.399963); // golden angle
    const ph = Math.acos(1 - 2 * ((i + 0.5) / NB));
    nbPos[i * 3] = r * Math.sin(ph) * Math.cos(th);
    nbPos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th) * 0.6;
    nbPos[i * 3 + 2] = r * Math.cos(ph) - 14;
  }
  const nbGeo = new THREE.BufferGeometry();
  nbGeo.setAttribute('position', new THREE.BufferAttribute(nbPos, 3));
  const nebula = new THREE.Points(nbGeo, new THREE.PointsMaterial({ map: glowTex, color: 0x5b6cff, size: 0.6, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
  scene.add(nebula);

  // ---- 4D rotation + projection ----
  function rot4(v, a, i, j) {
    const c = Math.cos(a), s = Math.sin(a);
    const vi = v[i], vj = v[j];
    v[i] = vi * c - vj * s;
    v[j] = vi * s + vj * c;
  }
  function projectGroup(group, aXW, aYW, aZW, aXY) {
    const { scale, lines, points } = group.userData;
    const D = 2.4;
    const p3 = [];
    for (let i = 0; i < 16; i++) {
      const v = verts4[i].slice();
      rot4(v, aXY, 0, 1);
      rot4(v, aXW, 0, 3);
      rot4(v, aYW, 1, 3);
      rot4(v, aZW, 2, 3);
      const f = (1 / (D - v[3])) * 1.6 * scale;
      p3.push([v[0] * f, v[1] * f, v[2] * f]);
    }
    const lp = lines.geometry.attributes.position.array;
    for (let e = 0; e < edges.length; e++) {
      const A = p3[edges[e][0]], B = p3[edges[e][1]];
      const o = e * 6;
      lp[o] = A[0]; lp[o + 1] = A[1]; lp[o + 2] = A[2];
      lp[o + 3] = B[0]; lp[o + 4] = B[1]; lp[o + 5] = B[2];
    }
    lines.geometry.attributes.position.needsUpdate = true;
    const pp = points.geometry.attributes.position.array;
    for (let i = 0; i < 16; i++) { pp[i * 3] = p3[i][0]; pp[i * 3 + 1] = p3[i][1]; pp[i * 3 + 2] = p3[i][2]; }
    points.geometry.attributes.position.needsUpdate = true;
  }

  // ---- narrative HUD (the 4th axis is time) ----
  const hud = document.querySelector('[data-dream4d-hud]');
  const AXES = [
    { k: 'axis x', t: 'research — what the night reads' },
    { k: 'axis y', t: 'evaluation — what it measures' },
    { k: 'axis z', t: 'critique — what would falsify it' },
    { k: 'axis w', t: 'time — one rotation is one night' },
  ];
  function setHud(scroll) {
    if (!hud) return;
    const idx = Math.min(3, Math.floor(scroll * 4));
    hud.querySelector('[data-hud-k]').textContent = AXES[idx].k;
    hud.querySelector('[data-hud-t]').textContent = AXES[idx].t;
  }

  // ---- sizing ----
  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  // ---- interaction ----
  let pointerX = 0, pointerY = 0, scrollN = 0;
  window.addEventListener('pointermove', (e) => {
    pointerX = (e.clientX / window.innerWidth - 0.5);
    pointerY = (e.clientY / window.innerHeight - 0.5);
  }, { passive: true });
  function updateScroll() {
    const hero = document.querySelector('.hero');
    const max = (hero ? hero.offsetHeight : window.innerHeight) * 2.2;
    scrollN = Math.max(0, Math.min(1, window.scrollY / max));
    setHud(scrollN);
  }
  window.addEventListener('scroll', updateScroll, { passive: true });
  updateScroll();

  function frame(tMs) {
    const t = tMs * 0.001;
    const wSpin = scrollN * Math.PI * 2; // scroll drives the 4th-axis rotation
    projectGroup(outer, t * 0.18 + wSpin, t * 0.13 + wSpin * 0.8, t * 0.09, t * 0.05);
    projectGroup(inner, -t * 0.15 + inner.userData.phase - wSpin, t * 0.11, -t * 0.14, t * 0.07);
    nebula.rotation.y = t * 0.02;
    nebula.rotation.x = t * 0.008;
    const tgX = pointerX * 0.6, tgY = -pointerY * 0.4;
    camera.position.x += (tgX - camera.position.x) * 0.05;
    camera.position.y += (tgY - camera.position.y) * 0.05;
    camera.position.z = 6.4 - scrollN * 1.4;
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
  }

  if (reduce) {
    // one static, composed frame — no animation loop
    projectGroup(outer, 0.9, 0.5, 0.2, 0.1);
    projectGroup(inner, -0.6, 0.4, -0.3, 0.2);
    renderer.render(scene, camera);
    return;
  }

  // pause when the hero scrolls away or the tab is hidden
  let running = true;
  const io = new IntersectionObserver((es) => { running = es[0].isIntersecting; if (running) loop(performance.now()); }, { threshold: 0 });
  const heroEl = document.querySelector('.hero-stage') || canvas;
  io.observe(heroEl);
  document.addEventListener('visibilitychange', () => { running = !document.hidden; if (running) loop(performance.now()); });

  function loop(t) {
    if (!running) return;
    frame(t);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}
