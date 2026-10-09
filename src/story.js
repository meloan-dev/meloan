// Meloan scroll story — scroll position drives one timeline across ten chapters.
// u = viewport-heights scrolled. Every moving thing reads its state from keyframe tracks of u,
// so scrolling backwards plays the story in reverse with no extra code.
import * as THREE from 'three';
import { createBuddy, superBlob, roundedDisc, frontDisc, vinyl, mesh } from './buddy.js';
import { createDrone, createMemeCoin, createSellCounter, createRocket } from './props.js';
import { createStorySound } from './story-sound.js';

window.__loader?.stage(0.5);   // three.js has arrived
const COIN_FACES = [/*COIN_FACES*/];
// Page timeline (uN): a space opening (0–3.5) and a lift-off finale (14.5–16) wrap the core story.
// The core story keeps its original timing (u), mapped from the page timeline by mapU().
const TOTAL = 17.05;
const CHAPTERS = [
  { id: 'hero', u: 0, name: 'Meloan' },
  { id: 'problem', u: 1.2, name: 'The problem' },
  { id: 'touchdown', u: 2.6, name: 'Touchdown' },
  { id: 'dilemma', u: 3.8, name: 'The dilemma' },
  { id: 'market', u: 5.6, name: 'One meme, one market' },
  { id: 'unlock', u: 7.1, name: 'Unlock' },
  { id: 'lenders', u: 9.1, name: 'The other side' },
  { id: 'storm', u: 10.6, name: 'The storm' },
  { id: 'shield', u: 12.6, name: 'The shield' },
  { id: 'open', u: 14.1, name: 'Nothing hidden' },
  { id: 'keep', u: 15.1, name: 'Lift-off' },
];
const OPEN_END = 3.8;
// the walk from the landing pad to the terminal (core 2.5–3.2) gets a full viewport of scroll
const mapU = (uN) => (uN < OPEN_END ? 2.5 : uN < 4.8 ? 2.5 + (uN - OPEN_END) * 0.7 : uN <= 15.36 ? uN - 1.6 : 13.76);

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------------- keyframe tracks ----------------
const smooth = (x) => x * x * (3 - 2 * x);
const clamp01 = (x) => Math.min(1, Math.max(0, x));
function track(keys) {
  return (u) => {
    if (u <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const [u1, v1] = keys[i];
      if (u <= u1) {
        const [u0, v0] = keys[i - 1];
        const k = smooth((u - u0) / (u1 - u0 || 1));
        if (Array.isArray(v0)) return v0.map((a, j) => a + (v1[j] - a) * k);
        if (typeof v0 === 'number') return v0 + (v1 - v0) * k;
        return k < 0.5 ? v0 : v1;
      }
    }
    return keys[keys.length - 1][1];
  };
}
const step = (keys) => (u) => { let v = keys[0][1]; for (const [k, val] of keys) if (u >= k) v = val; return v; };
const win = (a, b, fade = 0.12) => (u) => clamp01((u - a) / fade) * clamp01((b - u) / fade);

// ---------------- renderer, scene (futuristic night world) ----------------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
const isSmall = Math.min(innerWidth, innerHeight) < 700;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isSmall ? 1.75 : 2));
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap;

const NIGHT = new THREE.Color('#0D1130');
const scene = new THREE.Scene();
scene.background = NIGHT.clone();
scene.fog = new THREE.Fog(NIGHT.clone(), 9, 36);
{
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.45;
}
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 140);

// selective bloom: only neon (unlit, toneMapped:false) objects, sprites, points and lines glow
const bloomComposer = new EffectComposer(renderer);
bloomComposer.renderToScreen = false;
bloomComposer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.62, 0.32, 0.0);
bloomComposer.addPass(bloom);
const mixPass = new ShaderPass(new THREE.ShaderMaterial({
  uniforms: { baseTexture: { value: null }, bloomTexture: { value: bloomComposer.renderTarget2.texture } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: 'uniform sampler2D baseTexture; uniform sampler2D bloomTexture; varying vec2 vUv; void main(){ gl_FragColor = texture2D(baseTexture, vUv) + texture2D(bloomTexture, vUv); }',
}), 'baseTexture');
mixPass.needsSwap = true;
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(mixPass);
composer.addPass(new OutputPass());
// Smooth texture and silhouette edges after the final composite. Renderer MSAA
// alone does not antialias the composer's offscreen render targets.
const edgeAAPass = new ShaderPass(FXAAShader);
composer.addPass(edgeAAPass);
const BLACK = new THREE.MeshBasicMaterial({ color: '#000000' });
const stash = new Map();
const glows = (o) => o.isSprite || o.isPoints || o.isLineSegments || o.userData.bloom || (o.material && !Array.isArray(o.material) && o.material.toneMapped === false);
function renderBloomed() {
  const bgSave = scene.background, fogSave = scene.fog;
  scene.background = null; scene.fog = null;
  scene.traverseVisible((o) => {
    if (!(o.isMesh || o.isPoints || o.isLineSegments || o.isSprite) || glows(o)) return;
    const mat = o.material;
    const transparent = Array.isArray(mat) ? false : mat.transparent;
    stash.set(o, mat);
    if (transparent) o.visible = false; else o.material = BLACK;
  });
  renderer.setClearColor(0x000000, 1);
  bloomComposer.render();
  for (const [o, mat] of stash) { o.material = mat; o.visible = true; }
  stash.clear();
  scene.background = bgSave; scene.fog = fogSave;
  composer.render();
}

const hemi = new THREE.HemisphereLight('#AEB6FF', '#151A3C', 0.6);
scene.add(hemi);
const key = new THREE.DirectionalLight('#FFF3E6', 1.25);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
key.shadow.radius = 10; key.shadow.blurSamples = 16; key.shadow.bias = -0.0004;
const sc = key.shadow.camera; sc.left = -6; sc.right = 6; sc.top = 6; sc.bottom = -6; sc.near = 0.5; sc.far = 30;
scene.add(key, key.target);
const rim = new THREE.DirectionalLight('#6F84FF', 1.1);
scene.add(rim);
const alarm = new THREE.PointLight('#FF6A45', 0, 14, 1.6);
scene.add(alarm);

// floor: dark glass with a glowing cobalt grid
const gridTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = '#4256C8'; g.lineWidth = 3; g.strokeRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(66,86,200,0.35)'; g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(128, 0); g.lineTo(128, 256); g.moveTo(0, 128); g.lineTo(256, 128); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(80, 80); t.anisotropy = 8;
  return t;
})();
const floorMat = new THREE.MeshStandardMaterial({ color: '#141836', roughness: 0.32, metalness: 0.4, emissive: '#ffffff', emissiveMap: gridTex, emissiveIntensity: 0.55 });
const floor = new THREE.Mesh(new THREE.CircleGeometry(80, 96), floorMat);

floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// stars (they follow the camera, like a sky)
let stars;
{
  const n = 1400, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const th = Math.random() * Math.PI * 2, ph = Math.random() * Math.PI * 0.45;
    const r = 70;
    a[i * 3] = Math.cos(th) * Math.sin(ph) * r; a[i * 3 + 1] = Math.cos(ph) * r * 0.6 + 4; a[i * 3 + 2] = Math.sin(th) * Math.sin(ph) * r;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(a, 3));
  stars = new THREE.Points(g, new THREE.PointsMaterial({ color: '#CFD4FF', size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.85, fog: false }));
  scene.add(stars);
}

// ---------------- helpers ----------------
function glowTexture(inner = 'rgba(255,255,255,0.95)', outer = 'rgba(255,255,255,0)') {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, inner); grd.addColorStop(1, outer);
  g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function glowSprite(color, size) {
  const m = new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
  const s = new THREE.Sprite(m); s.scale.setScalar(size);
  return s;
}
const neon = (color, o = {}) => { const m = new THREE.MeshBasicMaterial({ color, toneMapped: false, ...o }); m.color.multiplyScalar(1.3); return m; };
const V = (x, y, z) => new THREE.Vector3(x, y, z);
// the Meloan platform is laid out on a roomier plan: set pieces sit SPREAD× further apart than the original sketch
const SPREAD = 1.3;
// moves that happen *at* a set piece keep their distance to it, so they are carried by that piece's shift
const DT = [-3.1 * (SPREAD - 1), 0, -2.6 * (SPREAD - 1)];    // sell terminal
const DD = [3.0 * (SPREAD - 1), 0, -3.3 * (SPREAD - 1)];     // portal
const DV = [3.0 * (SPREAD - 1), 0, -14 * (SPREAD - 1)];      // Buddy's vault at the end of the hall
const mv = (a, d) => [a[0] + d[0], a[1], a[2] + d[2]];
const spr = (a) => [a[0] * SPREAD, a[1], a[2] * SPREAD];
const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3(), tmpQ = new THREE.Quaternion();
const fadeTex = (() => {   // vertical fade for light columns
  const c = document.createElement('canvas'); c.width = 4; c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 128, 0, 0);
  grd.addColorStop(0, 'rgba(255,255,255,0.9)'); grd.addColorStop(0.6, 'rgba(255,255,255,0.25)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 4, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
function lightColumn(r, h, color, opacity = 0.35) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 40, 1, true),
    new THREE.MeshBasicMaterial({ color, map: fadeTex, transparent: true, opacity: opacity * 0.6, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  m.position.y = h / 2;
  return m;
}

// ---------------- the cast ----------------
const buddy = createBuddy({ scale: 0.2 });
scene.add(buddy.root);
buddy.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });

const memeCoin = createMemeCoin(COIN_FACES[0], { scale: 0.21 });
scene.add(memeCoin.root);
function createStableCoin(scale = 0.21) {
  const root = new THREE.Group(); root.scale.setScalar(scale);
  const rimM = vinyl('#B3B0F8', { roughness: 0.35, emissive: '#6E68E0', emissiveIntensity: 0.25 });
  const faceM = vinyl('#9897F1', { roughness: 0.3 });
  const dotM = vinyl('#4C55C9', { roughness: 0.4 });
  const e = mesh(roundedDisc(1, 0.28, 0.1, 56), rimM); e.rotation.x = Math.PI / 2; e.position.z = -0.14; root.add(e);
  for (const side of [1, -1]) {
    const f = mesh(new THREE.CircleGeometry(0.72, 48), faceM, 0, 0, side * 0.145);
    if (side < 0) f.rotation.y = Math.PI;
    root.add(f);
    for (const [dx, dy] of [[-0.18, 0.2], [0.22, 0.05], [-0.05, -0.25]]) {
      const d = mesh(new THREE.CircleGeometry(0.12, 20), dotM, dx * side, dy, side * 0.15);
      if (side < 0) d.rotation.y = Math.PI;
      root.add(d);
    }
  }
  return { root };
}
const stableCoin = createStableCoin();
scene.add(stableCoin.root);
const extraCoin = createMemeCoin(COIN_FACES[0], { scale: 0.15 });
scene.add(extraCoin.root);
const sliceCoin = createMemeCoin(COIN_FACES[0], { scale: 0.11 });
scene.add(sliceCoin.root);

const portGlow = glowSprite('#FF9A70', 1.1);
scene.add(portGlow);
const lilacGlow = glowSprite('#AFA9FF', 0.9);
scene.add(lilacGlow);

// hologram of the stablecoin he wishes for (chapter 1)
const wishRing = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.016, 12, 64), neon('#9C98FF', { transparent: true, opacity: 0 }));
scene.add(wishRing);

// halo ring behind Buddy in the opening and finale
const halo = new THREE.Group();
halo.add(new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.025, 12, 160), neon('#5B72FF', { transparent: true, opacity: 0.9 })));
halo.add(new THREE.Mesh(new THREE.TorusGeometry(2.15, 0.01, 8, 160), neon('#EE916E', { transparent: true, opacity: 0.8 })));
halo.position.set(0, 1.25, -2.6);
scene.add(halo);

// ---------------- the fork: holographic sell terminal and the portal ----------------
function createSellTerminal() {
  const root = new THREE.Group();
  const navy = vinyl('#1E2650', { roughness: 0.35, metalness: 0.2 });
  // hover base with a glow pool
  root.add(mesh(roundedDisc(0.55, 0.14, 0.06), navy, 0, 0.12, 0));
  const pool = new THREE.Mesh(new THREE.CircleGeometry(0.9, 48), new THREE.MeshBasicMaterial({ map: glowTexture('rgba(255,120,80,0.8)', 'rgba(255,120,80,0)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  pool.rotation.x = -Math.PI / 2; pool.position.y = 0.012;
  root.add(pool);
  root.add(mesh(new THREE.TorusGeometry(0.55, 0.02, 8, 64), neon('#FF7A52'), 0, 0.2, 0).rotateX(Math.PI / 2));
  // slim pillar
  root.add(mesh(superBlob(0.36, 1.2, 0.28, 5, 24, 32), navy, 0, 0.82, -0.05));
  // angled screen
  const screen = new THREE.Group();
  screen.position.set(0, 1.62, 0.02);
  screen.rotation.x = -0.32;
  screen.add(mesh(superBlob(1.35, 0.82, 0.08, 7, 40, 24), navy));
  const c = document.createElement('canvas'); c.width = 512; c.height = 300;
  const g = c.getContext('2d');
  g.fillStyle = '#120E2A'; g.fillRect(0, 0, 512, 300);
  g.strokeStyle = 'rgba(255,122,82,0.25)'; g.lineWidth = 1;
  for (let x = 0; x < 512; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 300); g.stroke(); }
  g.strokeStyle = '#FF7A52'; g.lineWidth = 6; g.lineJoin = 'round';
  g.beginPath(); [[30, 90], [110, 110], [170, 95], [240, 160], [310, 150], [390, 230], [480, 250]].forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
  g.fillStyle = '#FF7A52'; g.font = '700 92px "Chakra Petch", Arial, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'top';
  g.fillText('SELL', 26, 150);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1.24, 0.72), new THREE.MeshBasicMaterial({ map: t, toneMapped: false }));
  face.position.z = 0.045;
  screen.add(face);
  root.add(screen);
  // hologram coin above the screen, flickering as it "dissolves"
  const holo = new THREE.Group();
  holo.position.set(0, 2.45, 0);
  const coinTex = new THREE.TextureLoader().load(COIN_FACES[0]); coinTex.colorSpace = THREE.SRGBColorSpace;
  const holoMat = new THREE.MeshBasicMaterial({ map: coinTex, color: '#FFB08F', transparent: true, opacity: 0.65, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  holo.add(new THREE.Mesh(new THREE.CircleGeometry(0.3, 48), holoMat));
  holo.add(new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.012, 8, 64), neon('#FF7A52', { transparent: true, opacity: 0.8 })));
  root.add(holo);
  root.add(lightColumn(0.32, 2.7, '#FF7A52', 0.18));
  root.userData = { holo, holoMat };
  return { root };
}
const counter = createSellTerminal();
counter.root.position.set(-3.1 * SPREAD, 0, -2.6 * SPREAD);
counter.root.rotation.y = 0.5;
counter.root.traverse((o) => { if (o.isMesh && o.material.toneMapped !== false) o.castShadow = true; });
scene.add(counter.root);

const DOOR = V(3.0 * SPREAD, 0, -3.3 * SPREAD);
const door = new THREE.Group();
door.position.copy(DOOR);
const portalMat = new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 }, uOpacity: { value: 1 } },
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform float uTime; uniform float uOpacity; varying vec2 vUv;
    void main(){ vec2 p = vUv*2.0-1.0; float r = length(p); float a = atan(p.y,p.x);
      float s = sin(a*3.0 + r*12.0 - uTime*2.2)*0.5+0.5;
      float s2 = sin(a*5.0 - r*7.0 + uTime*1.3)*0.5+0.5;
      vec3 c = mix(vec3(0.20,0.27,0.80), vec3(0.85,0.86,1.0), smoothstep(0.95,0.0,r)*0.6 + s*0.3*(1.0-r));
      c = mix(c, vec3(0.93,0.57,0.43), s2*0.18*(1.0-r));
      float alpha = smoothstep(1.0,0.86,r) * uOpacity * (0.45 + 0.55*(1.0-r));
      gl_FragColor = vec4(c*alpha*0.9, alpha); }`,
});
{
  const navy = vinyl('#1E2650', { roughness: 0.35, metalness: 0.2 });
  door.add(mesh(superBlob(2.9, 0.22, 1.1, 5, 40, 16), navy, 0, 0.11, 0));
  door.add(mesh(new THREE.TorusGeometry(1.3, 0.16, 24, 96), vinyl('#2A3570', { roughness: 0.3, metalness: 0.3 }), 0, 1.5, 0));
  door.add(mesh(new THREE.TorusGeometry(1.3, 0.035, 12, 128), neon('#7D8BFF'), 0, 1.5, 0.15));
  door.add(mesh(new THREE.TorusGeometry(1.3, 0.035, 12, 128), neon('#7D8BFF'), 0, 1.5, -0.15));
  for (const sx of [-1, 1]) {
    door.add(mesh(superBlob(0.32, 0.9, 0.5, 4, 24, 24), navy, sx * 1.15, 0.5, 0));
    door.add(mesh(new THREE.SphereGeometry(0.07, 16, 12), neon('#EE916E'), sx * 1.15, 0.85, 0.26));
  }
  const core = new THREE.Mesh(new THREE.CircleGeometry(1.2, 64), portalMat);
  core.position.y = 1.5;
  door.add(core);
  door.add(lightColumn(1.25, 4, '#5B72FF', 0.06));
}
door.userData.glow = { set opacity(v) { portalMat.uniforms.uOpacity.value = v / 0.95; } };
door.rotation.y = -0.15;
scene.add(door);

// ---------------- the market hall: arches of light and glowing pods ----------------
const HALL_X = 3.0 * SPREAD;
const HZ = (z) => z * SPREAD;   // hall depth on the roomier plan
const ARCH_R = 2.7 * SPREAD;
const runner = new THREE.Group();
for (const sx of [-1, 1]) runner.add(mesh(new THREE.BoxGeometry(0.05, 0.02, 11.5 * SPREAD), neon('#5B72FF'), HALL_X + sx * 1.75 * SPREAD, 0.02, HZ(-10.1)));
for (let z = -5.2; z >= -15.2; z -= 2.5) {
  const arch = new THREE.Mesh(new THREE.TorusGeometry(ARCH_R, 0.03, 8, 96, Math.PI), neon('#5B72FF', { transparent: true, opacity: 0.55 }));
  arch.position.set(HALL_X, 0, HZ(z));
  runner.add(arch);
  for (const sx of [-1, 1]) runner.add(mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.12, 20), vinyl('#1E2650'), HALL_X + sx * ARCH_R, 0.06, HZ(z)));
}
scene.add(runner);

function createVault(faceIdx, { closed = false } = {}) {
  const g = new THREE.Group();
  const navy = vinyl('#1E2650', { roughness: 0.35, metalness: 0.2 });
  const accent = closed ? '#FF6A45' : '#6F84FF';
  g.add(mesh(roundedDisc(0.68, 0.24, 0.08), navy));
  g.add(mesh(new THREE.TorusGeometry(0.64, 0.025, 8, 64), neon(accent), 0, 0.24, 0).rotateX(Math.PI / 2));
  g.add(lightColumn(0.56, 2.4, accent, closed ? 0.08 : 0.13));
  g.add(mesh(new THREE.TorusGeometry(0.56, 0.05, 12, 48), navy, 0, 1.95, 0).rotateX(Math.PI / 2));
  g.add(mesh(new THREE.TorusGeometry(0.56, 0.015, 8, 64), neon(accent), 0, 1.95, 0).rotateX(Math.PI / 2));
  const glass = new THREE.MeshPhysicalMaterial({
    color: closed ? '#7D5A72' : '#A9B2FF', roughness: 0.1, metalness: 0, transparent: true,
    opacity: closed ? 0.32 : 0.2, clearcoat: 1, clearcoatRoughness: 0.08, depthWrite: false,
  });
  const cap = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 1.0, 12, 40), glass);
  cap.position.y = 1.1; cap.renderOrder = 2;
  g.add(cap);
  let coin = null;
  if (!closed && faceIdx != null) {
    coin = createMemeCoin(COIN_FACES[faceIdx], { scale: 0.26 });
    coin.root.position.y = 1.1;
    g.add(coin.root);
  }
  if (closed) for (const y of [0.85, 1.35]) g.add(mesh(new THREE.TorusGeometry(0.575, 0.03, 8, 64), neon('#FF6A45'), 0, y, 0).rotateX(Math.PI / 2));
  g.userData = { coin, glass };
  return g;
}
const vaults = [];
const VAULT_SPOTS = [
  { x: -2.1, z: -7.2, f: 1 }, { x: 2.1, z: -7.2, f: 2 },
  { x: -2.1, z: -10.2, closed: true }, { x: 2.1, z: -10.2, f: 3 },
  { x: -2.15, z: -14, f: 2 }, { x: 0, z: -14, f: 0, mine: true }, { x: 2.15, z: -14, f: 1 },
].map((v) => ({ ...v, x: HALL_X + v.x * SPREAD, z: HZ(v.z) }));
let myVault, lockedVault;
for (const s of VAULT_SPOTS) {
  const v = createVault(s.f, { closed: s.closed });
  v.position.set(s.x, 0, s.z);
  scene.add(v);
  vaults.push(v);
  if (s.mine) myVault = v;
  if (s.closed) lockedVault = v;
}
const VAULT_C = V(HALL_X, 1.1, HZ(-14));
const fill = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1, 40), new THREE.MeshStandardMaterial({ color: '#A9A4F6', emissive: '#8A84FF', emissiveIntensity: 0.55, transparent: true, opacity: 0.55, toneMapped: false }));
fill.position.set(HALL_X, 0.24, HZ(-14));
scene.add(fill);
const vaultGlow = glowSprite('#8F98FF', 2.6);
vaultGlow.position.copy(VAULT_C);
scene.add(vaultGlow);

// lender coins streaming in (chapter 5)
const LENDERS = 34;
const lenderGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.05, 28);
lenderGeo.rotateX(Math.PI / 2);
const lenderMat = new THREE.MeshStandardMaterial({ color: '#B3B0F8', emissive: '#8F8AFF', emissiveIntensity: 2.2, roughness: 0.4, toneMapped: false });
const lenders = [];
for (let i = 0; i < LENDERS; i++) {
  const m = new THREE.Mesh(lenderGeo, lenderMat);
  const side = i % 2 ? 1 : -1;
  const from = V(HALL_X + side * (9 + Math.random() * 5), 4 + Math.random() * 4, HZ(-22 - Math.random() * 8));
  const mid = V(HALL_X + side * (2 + Math.random()), 4 + Math.random() * 1.5, HZ(-16 - Math.random() * 2));
  m.userData = { from, mid, delay: (i / LENDERS) * 0.8, spin: Math.random() * 6 };
  m.visible = false;
  scene.add(m);
  lenders.push(m);
}

// ---------------- storm: falling data streaks, keeper drone ----------------
const RAIN = 320;
const dustGeo = new THREE.BufferGeometry();
{
  const a = new Float32Array(RAIN * 6);
  for (let i = 0; i < RAIN; i++) {
    const x = HALL_X + (Math.random() - 0.5) * 16 * SPREAD, y = Math.random() * 7, z = HZ(-12 + (Math.random() - 0.5) * 14), l = 0.15 + Math.random() * 0.35;
    a.set([x, y, z, x, y + l, z], i * 6);
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(a, 3));
}
const dust = new THREE.LineSegments(dustGeo, new THREE.LineBasicMaterial({ color: '#FF8A66', transparent: true, opacity: 0, toneMapped: false, depthWrite: false }));
scene.add(dust);

const drone = createDrone({ scale: 0.26 });
drone.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
scene.add(drone.root);

// ---------------- shield chapter: glowing crack + hexagonal energy barrier ----------------
const crackTex = (() => {
  const c = document.createElement('canvas'); c.width = 256; c.height = 512;
  const g = c.getContext('2d');
  g.strokeStyle = '#FF8A5C'; g.lineWidth = 7; g.lineCap = 'round'; g.lineJoin = 'round';
  const path = [[128, 40], [110, 120], [150, 190], [104, 270], [140, 340], [118, 420], [132, 480]];
  g.beginPath(); path.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
  g.lineWidth = 4;
  for (const [x0, y0, x1, y1] of [[150, 190, 196, 168], [104, 270, 62, 252], [140, 340, 182, 372], [110, 120, 72, 104]]) { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const crack = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 1.5), new THREE.MeshBasicMaterial({ map: crackTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
crack.position.set(HALL_X, 1.15, HZ(-14) + 0.57);
scene.add(crack);

const hexTex = (() => {
  const c = document.createElement('canvas'); c.width = 512; c.height = 512;
  const g = c.getContext('2d');
  g.strokeStyle = 'rgba(160,175,255,1)'; g.lineWidth = 3;
  const r = 28, w = Math.sqrt(3) * r;
  for (let row = -1; row < 13; row++) for (let col = -1; col < 12; col++) {
    const cx = col * w + (row % 2 ? w / 2 : 0), cy = row * r * 1.5;
    g.beginPath();
    for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + k * Math.PI / 3; const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r; k ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.closePath(); g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1.5, 1.5);
  return t;
})();
const shield = new THREE.Group();
const shieldMat = new THREE.MeshBasicMaterial({ map: hexTex, color: '#7D8BFF', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
const shieldFill = new THREE.MeshBasicMaterial({ color: '#4256C8', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
{
  const geo = new THREE.CylinderGeometry(0.98, 0.98, 2.3, 48, 1, true, -1.05, 2.1);
  shield.add(new THREE.Mesh(geo, shieldMat));
  shield.add(new THREE.Mesh(geo, shieldFill));
  for (const y of [-1.15, 1.15]) shield.add(new THREE.Mesh(new THREE.TorusGeometry(0.98, 0.02, 8, 64, 2.1), neon('#9AA6FF', { transparent: true })).translateY(y).rotateX(Math.PI / 2).rotateZ(Math.PI / 2 - 1.05));
}
scene.add(shield);

// blueprint grid (chapter 8)
const grid = new THREE.GridHelper(40, 80, '#7D8BFF', '#4256C8');
grid.material.transparent = true; grid.material.opacity = 0; grid.material.depthWrite = false; grid.material.toneMapped = false;
grid.position.set(HALL_X, 0.03, HZ(-10));
scene.add(grid);

// floating holographic rings in the opening scene
const rings = new THREE.Group();
for (let i = 0; i < 9; i++) {
  const r = 0.3 + Math.random() * 0.6;
  const col = ['#5B72FF', '#9C98FF', '#EE916E'][i % 3];
  const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.018, 8, 64), neon(col, { transparent: true, opacity: 0.85 }));
  m.position.set((-9 + (i / 8) * 18 + Math.random()) * SPREAD, 1.5 + Math.random() * 4.5, (-8 - Math.random() * 10) * SPREAD);
  m.rotation.set(Math.random() * 3, Math.random() * 3, 0);
  m.userData.spin = (Math.random() - 0.5) * 0.5;
  rings.add(m);
}
scene.add(rings);


// ---------------- space: Buddy's rocket, planet Meloan, speed streaks, nebulae ----------------
const rocket = createRocket({ scale: 1.5 });
scene.add(rocket.root);
const RK = rocket.root.userData;
const PARK = V(8.8, RK.groundY, 4.6);    // landing pad off to the right and forward, out of the terminal / portal / hall shots
const PD = [PARK.x - 5.8, 0, PARK.z - 1.0]; // shift from the old pad, used to carry the hand-framed shots across
const pd = (a) => [a[0] + PD[0], a[1], a[2] + PD[2]];
const SPACE_Y = 80;

const planet = new THREE.Group();
planet.position.set(2, SPACE_Y - 8, -95);
{
  const pc = document.createElement('canvas'); pc.width = 1024; pc.height = 512;
  const g = pc.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 512);
  grd.addColorStop(0, '#1B2466'); grd.addColorStop(0.5, '#2A2F7A'); grd.addColorStop(1, '#141A4A');
  g.fillStyle = grd; g.fillRect(0, 0, 1024, 512);
  g.strokeStyle = 'rgba(125,139,255,0.9)'; g.lineWidth = 2;
  for (let x = 0; x <= 1024; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 512); g.stroke(); }
  for (let y = 0; y <= 512; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(1024, y); g.stroke(); }
  g.fillStyle = 'rgba(238,145,110,0.9)';
  for (let i = 0; i < 60; i++) { g.beginPath(); g.arc(Math.random() * 1024, 160 + Math.random() * 200, 2 + Math.random() * 3, 0, Math.PI * 2); g.fill(); }
  const tex = new THREE.CanvasTexture(pc); tex.colorSpace = THREE.SRGBColorSpace;
  const pm = new THREE.MeshStandardMaterial({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.55, roughness: 0.8, fog: false });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(16, 64, 48), pm);
  planet.add(ball);
  planet.userData.ball = ball;
  const ringA = new THREE.Mesh(new THREE.TorusGeometry(25, 0.25, 8, 160), neon('#EE916E', { fog: false }));
  ringA.rotation.set(1.25, 0.25, 0);
  const ringB = new THREE.Mesh(new THREE.TorusGeometry(28.5, 0.12, 8, 160), neon('#7D8BFF', { fog: false }));
  ringB.rotation.set(1.3, 0.2, 0.1);
  planet.add(ringA, ringB);
  const atmo = glowSprite('#6F7BFF', 48);
  atmo.material.fog = false; atmo.material.opacity = 0.55;
  planet.add(atmo);
}
scene.add(planet);

const nebulae = new THREE.Group();
for (const [x, y, z, c, s] of [[-60, SPACE_Y + 25, -90, '#5B3FC8', 90], [70, SPACE_Y - 10, -80, '#C2537A', 70], [10, SPACE_Y + 40, -120, '#3D5BFF', 110]]) {
  const n = glowSprite(c, s);
  n.material.fog = false; n.material.opacity = 0.28; n.material.blending = THREE.NormalBlending;
  n.position.set(x, y, z);
  nebulae.add(n);
}
scene.add(nebulae);

// speed streaks travel past the rocket in its local frame
const STREAKS = 220;
const streakGeo = new THREE.BufferGeometry();
{
  const a = new Float32Array(STREAKS * 6);
  for (let i = 0; i < STREAKS; i++) {
    const x = (Math.random() - 0.5) * 60, y = (Math.random() - 0.5) * 24, z = -4 - Math.random() * 30 * (Math.random() < 0.5 ? 1 : -0.4), l = 0.8 + Math.random() * 2.5;
    a.set([x, y, z, x + l, y, z], i * 6);
  }
  streakGeo.setAttribute('position', new THREE.BufferAttribute(a, 3));
}
const streaks = new THREE.LineSegments(streakGeo, new THREE.LineBasicMaterial({ color: '#AEB8FF', transparent: true, opacity: 0.55, toneMapped: false, fog: false, depthWrite: false }));
scene.add(streaks);

// the signal: a ping that sweeps over the rocket
const ping = new THREE.Mesh(new THREE.TorusGeometry(1, 0.03, 8, 96), neon('#7D8BFF', { transparent: true, opacity: 0, fog: false }));
scene.add(ping);

// page-timeline tracks for the opening and finale
const F0 = 15.1;   // finale starts
const rkPos = track([
  [0, [-1.5, SPACE_Y, 0]], [1.2, [0.4, SPACE_Y, 0]], [2.2, [1.8, SPACE_Y, 0]], [2.6, [2.0, SPACE_Y, -5]], [2.95, [2.0, SPACE_Y - 1.5, -58]],
  [2.951, pd([10, 12, 6])], [3.22, [PARK.x, PARK.y + 0.3, PARK.z]], [3.32, [PARK.x, PARK.y, PARK.z]],
  [F0 + 1.38, [PARK.x, PARK.y, PARK.z]], [F0 + 1.66, [PARK.x - 0.8, PARK.y + 2.6, PARK.z - 0.3]], [F0 + 1.95, [-2.5, 17, -5]],
]);
const rkYaw = track([[0, 0], [2.2, 0], [2.6, Math.PI / 2], [2.95, Math.PI / 2], [2.951, Math.PI - 0.4], [3.3, Math.PI], [F0 + 1.38, Math.PI], [F0 + 1.95, Math.PI + 0.6]]);
const rkPitch = track([[0, 0], [2.6, 0], [2.95, -0.12], [2.951, -0.18], [3.25, 0], [F0 + 1.38, 0], [F0 + 1.66, 0.55], [F0 + 1.95, 0.95]]);
const rkFlame = track([[0, 1], [2.95, 1], [2.951, 0.7], [3.2, 0.5], [3.3, 0], [F0 + 1.32, 0], [F0 + 1.42, 1.25], [F0 + 1.95, 1.45]]);
const rkLegs = track([[0, 0], [3.02, 0], [3.24, 1], [F0 + 1.4, 1], [F0 + 1.54, 0]]);
const canopyT = track([[0, 0], [3.3, 0], [3.38, 1], [3.74, 1], [3.84, 0], [F0 + 0.8, 0], [F0 + 0.9, 1], [F0 + 1.26, 1], [F0 + 1.36, 0]]);
const ladderT = track([[0, 0], [3.31, 0], [3.4, 1], [3.74, 1], [3.84, 0], [F0 + 0.78, 0], [F0 + 0.9, 1], [F0 + 1.28, 1], [F0 + 1.38, 0]]);
const spaceT = track([[0, 1], [2.95, 1], [2.951, 0]]);
const openVeil = track([[0, 0], [2.86, 0], [2.94, 1], [2.99, 1], [3.12, 0]]);
const pingT = (uN) => clamp01((uN - 2.15) / 0.4);
const openYaw = track([[0, 0], [2.18, 0], [2.5, Math.PI], [2.95, Math.PI], [2.951, 0.3], [3.36, 0.3], [3.43, Math.PI], [3.66, Math.PI], [3.75, 0.3]]);
const openMood = step([[0, 'neutral'], [1.62, 'worried'], [2.25, 'happy'], [2.62, 'neutral']]);
const REST = [-0.8, 0, 0.8, 0, 1], CARRY = [-0.45, -0.55, 0.8, 0, 1], BALANCE = [-1.45, 0, 1.45, 0, 1];
const openPose = track([[0, CARRY], [1.85, CARRY], [2.0, [-0.2, -1.05, 0.8, 0, 1]], [2.15, [-0.2, -1.05, 0.8, 0, 1]], [2.3, CARRY], [3.36, CARRY], [3.42, REST], [3.46, BALANCE], [3.5, BALANCE], [3.7, BALANCE], [3.76, CARRY]]);
// where Buddy is, as named points that are resolved against the parked ship every frame
const PATH_OPEN = [[0, 'seat'], [3.36, 'seat'], [3.44, 'stand'], [3.5, 'top', 'arc'], [3.66, 'base', 'climb'], [3.74, 'hop'], [3.8, 'hop']];
const PATH_FIN = [[F0, 'origin'], [F0 + 0.25, 'origin'], [F0 + 0.47, 'padWay'], [F0 + 0.7, 'portFront'], [F0 + 0.82, 'portFront'], [F0 + 0.95, 'hop'], [F0 + 1.0, 'base'], [F0 + 1.17, 'top', 'climb'], [F0 + 1.23, 'stand', 'arc'], [F0 + 1.28, 'seat'], [F0 + 2.2, 'seat']];
const HOP = V(PARK.x - 1.5 * 0.15, 0, PARK.z + 1.5 * 1.28 + 1.05);   // just behind the ladder foot
const boardPoint = (name, out) => {
  const P = RK.points, ship = RK.ship;
  switch (name) {
    case 'seat': return RK.seat.getWorldPosition(out);
    case 'stand': return ship.localToWorld(out.copy(P.stand));
    case 'top': return ship.localToWorld(out.copy(P.ladderTop)).add(V(0, -0.15, 0.5));
    case 'base': return ship.localToWorld(out.copy(P.ladderBase)).add(V(0, 0, 0.5));
    case 'hop': return out.copy(HOP);
    case 'padWay': return out.set(PARK.x - 5.4, 0, PARK.z + 2.4);   // in front of the nose
    case 'portFront': { RK.fuelPort.getWorldPosition(out); return out.set(out.x + 0.1, 0, out.z + 0.75); }
    default: return out.set(0, 0, 0);
  }
};
function boardAt(path, uN, out) {
  if (uN <= path[0][0]) return { pos: boardPoint(path[0][1], out), mode: null, k: 0 };
  for (let i = 1; i < path.length; i++) {
    if (uN <= path[i][0]) {
      const [u0, n0] = path[i - 1], [u1, n1, mode] = path[i];
      const k = (uN - u0) / (u1 - u0);
      const a = boardPoint(n0, new THREE.Vector3()), b = boardPoint(n1, new THREE.Vector3());
      out.copy(a).lerp(b, mode === 'climb' ? k : smooth(k));
      if (mode === 'arc') out.y += Math.sin(k * Math.PI) * 0.45;
      return { pos: out, mode, k };
    }
  }
  return { pos: boardPoint(path[path.length - 1][1], out), mode: null, k: 1 };
}
const finYaw = track([[F0, 0], [F0 + 0.27, 0], [F0 + 0.31, 0.51], [F0 + 0.43, 0.51], [F0 + 0.5, 1.35], [F0 + 0.67, 1.35], [F0 + 0.71, Math.PI], [F0 + 0.82, Math.PI], [F0 + 0.85, 0.6], [F0 + 0.93, 0.6], [F0 + 0.99, Math.PI], [F0 + 1.17, Math.PI], [F0 + 1.26, 0.35]]);
const finPose = track([[F0, [-0.8, 0, 0.55, -0.75, 1]], [F0 + 0.7, [-0.8, 0, 0.55, -0.75, 1]], [F0 + 0.76, [-0.8, 0, 0.35, -1.3, 1]], [F0 + 0.8, [-0.8, 0, 0.35, -1.3, 1]], [F0 + 0.86, REST], [F0 + 1.17, REST], [F0 + 1.2, BALANCE], [F0 + 1.25, BALANCE], [F0 + 1.3, REST]]);
const finMood = step([[F0, 'neutral'], [F0 + 1.25, 'happy']]);
const fuelT = track([[0, 0.34], [1.3, 0.34], [1.72, 0.06], [F0 + 0.7, 0.06], [F0 + 0.82, 1]]);
const finStable = track([[F0, 0], [F0 + 0.7, 0], [F0 + 0.8, 1]]);   // rhand → fuel port
const finCam = [
  [F0, null], [F0 + 0.3, [0.6, 2.2, 13.5], [3.0, 1.2, 4.0]], [F0 + 0.75, pd([2.6, 2.0, 10.5]), pd([4.6, 1.4, 1.4])],
  [F0 + 1.0, pd([2.6, 2.8, 11.8]), pd([5.4, 2.0, 2.2])], [F0 + 1.3, pd([2.4, 3.0, 11.8]), pd([5.4, 2.6, 1.4])],
  [F0 + 1.65, pd([1.2, 3.6, 15.5]), pd([3.4, 6.0, 0])], [F0 + 1.95, pd([0.4, 4.6, 16.5]), [-1.5, 12.5, -3.5]],
];

// ---------------- timelines ----------------
const CAM = [];
const camKey = (u, p, t) => CAM.push([u, p, t]);
// shots between set pieces: the aim point moves with the roomier plan, the lens keeps its distance
const spreadShot = (p, t, back = 1) => [[t[0] * SPREAD + (p[0] - t[0]) * back, t[1] + (p[1] - t[1]) * back, t[2] * SPREAD + (p[2] - t[2]) * back], spr(t)];
// overview shots: the whole view scales up with the plan
const wideShot = (p, t) => [[t[0] * SPREAD + (p[0] - t[0]) * SPREAD, p[1] * SPREAD, t[2] * SPREAD + (p[2] - t[2]) * SPREAD], spr(t)];
camKey(0, [0, 1.3, 7.4], [0, 1.05, 0]);
camKey(1.0, [0, 1.3, 7.2], [0, 1.0, 0]);
camKey(2.35, [5.2, 3.0, 17.2], [8.2, 1.5, 5.8]);   // = the disembark view at the pad, so the hand-off is seamless
camKey(2.75, [4.6, 3.0, 15.8], [1.6, 1.0, 3.6]);
camKey(3.25, mv([-0.8, 3.1, 6.6], DT), mv([-2.0, 0.8, -1.8], DT));
camKey(3.6, ...spreadShot([-0.4, 3.5, 7.4], [0.2, 0.8, -2.6], 1.2));   // the fork: terminal and portal both in frame
camKey(4.0, mv([3.0, 2.7, 2.6], DD), mv([3.0, 1.0, -4.6], DD));
camKey(4.6, ...spreadShot([3.0, 2.5, -0.4], [3.0, 1.0, -8.5]));
camKey(5.1, mv([3.0, 2.0, -4.6], DV), mv([3.0, 1.0, -12.5], DV));
camKey(5.5, mv([3.0, 1.35, -7.4], DV), mv([3.0, 1.0, -12.4], DV));
camKey(5.8, mv([3.0, 1.3, -7.6], DV), mv([3.0, 0.95, -12.3], DV));
camKey(6.05, mv([3.0, 1.05, -8.1], DV), mv([3.0, 0.8, -12.2], DV));
camKey(6.55, mv([3.0, 1.05, -8.1], DV), mv([3.0, 0.8, -12.2], DV));
camKey(6.95, mv([3.3, 1.45, -6.9], DV), mv([3.0, 0.95, -12.6], DV));
camKey(7.5, mv([3.0, 1.8, -6.8], DV), mv([3.0, 1.0, -13.4], DV));
// 360° orbit around the vault (computed analytically between ORBIT[0] and ORBIT[1])
const ORBIT = [7.62, 9.32];
const orbitAt = (a) => [HALL_X + Math.sin(a) * 8.2, 2.0 + Math.sin(a / 2) * 1.2, HZ(-14) + Math.cos(a) * 8.2];
camKey(ORBIT[0], orbitAt(0), [HALL_X, 1.0, HZ(-14) + 0.6]);
camKey(ORBIT[1], orbitAt(Math.PI * 2), [HALL_X, 1.0, HZ(-14) + 0.6]);
camKey(9.45, mv([3.0, 1.7, -6.4], DV), mv([3.0, 1.0, -12.4], DV));
camKey(10.3, mv([3.1, 1.7, -6.5], DV), mv([3.0, 1.0, -12.4], DV));
camKey(10.6, mv([3.9, 1.8, -6.8], DV), mv([3.4, 1.1, -12.2], DV));
camKey(10.95, mv([3.4, 1.8, -6.7], DV), mv([3.0, 1.0, -12.6], DV));
camKey(11.3, mv([3.0, 2.3, -5.6], DV), mv([3.0, 1.0, -14.0], DV));
camKey(12.4, mv([2.8, 2.6, -6.2], DV), mv([3.0, 1.0, -14.0], DV));
camKey(12.8, ...wideShot([3.0, 8.5, -6.0], [3.0, 0.0, -10.6]));
camKey(13.1, ...wideShot([3.2, 15.5, -9.8], [3.0, 0.0, -10.6]));
camKey(13.49, ...wideShot([3.6, 16.5, -9.6], [3.0, 0.0, -10.6]));
camKey(13.51, [0, 1.35, 8.2], [0, 1.05, 0]);
camKey(13.8, [0, 1.3, 7.4], [0, 1.05, 0]);
camKey(14.5, [0, 1.25, 6.7], [0, 1.0, 0]);
const camPos = track(CAM.map(([u, p]) => [u, p]));
const camTgt = track(CAM.map(([u, , t]) => [u, t]));

const budPos = track([
  [0, [8.575, 0, 7.57]], [2.5, [8.575, 0, 7.57]], [2.78, [3.2, 0, 6.6]],   // off the pad, round the nose,
  [3.2, mv([-1.6, 0, -1.3], DT)], [3.42, mv([-1.6, 0, -1.3], DT)],         // on to the terminal
  [3.95, mv([2.9, 0, -2.6], DD)], [4.15, mv([3.0, 0, -3.8], DD)], [5.1, mv([3.0, 0, -12.2], DV)],
  [11.0, mv([3.0, 0, -12.2], DV)], [11.35, mv([1.65, 0, -11.5], DV)], [13.49, mv([1.65, 0, -11.5], DV)], [13.51, [0, 0, 0]],
]);
const budRot = track([
  [0, 0.3], [2.5, 0.3], [2.58, -1.75], [2.73, -1.75], [2.83, -2.6], [3.15, -2.6], [3.3, -2.27], [3.46, -4.48], [3.95, -4.48], [4.12, -Math.PI], [5.1, -Math.PI], [5.42, 0],
  [11.0, 0], [11.12, -1.1], [11.35, -1.1], [11.55, -3.6], [13.49, -3.6], [13.51, 0],
]);
const budMood = step([[0, 'neutral'], [1.55, 'happy'], [2.45, 'neutral'], [6.25, 'happy'], [6.95, 'neutral'], [9.45, 'worried'], [10.2, 'neutral'], [10.42, 'worried'], [10.85, 'neutral'], [14.15, 'happy']]);
const ACTIONS_AT = [[3.28, 'shake'], [7.95, 'wave'], [10.22, 'nod'], [12.95, 'nod'], [14.18, 'hop']];
// arm poses [lz, lx, rz, rx, weight]
const pose = track([
  [0, [-0.45, -0.55, 0.8, 0, 1]], [5.6, [-0.45, -0.55, 0.8, 0, 1]],            // carry the coin
  [5.95, [0.38, -1.15, 0.8, 0, 1]], [6.2, [0.38, -1.15, 0.8, 0, 1]],              // press it into the port
  [6.4, [-0.8, 0, 0.55, -0.75, 1]], [7.45, [-0.8, 0, 0.55, -0.75, 1]],            // hold the stablecoin out
  [7.7, [-0.8, 0, 0.9, -0.2, 1]], [9.85, [-0.8, 0, 0.9, -0.2, 1]],
  [10.0, [0.38, -1.15, 0.9, -0.2, 1]], [10.16, [0.38, -1.15, 0.9, -0.2, 1]],      // add collateral
  [10.3, [-0.8, 0, 0.9, -0.2, 1]], [13.49, [-0.8, 0, 0.9, -0.2, 1]],
  [13.51, [-0.8, 0, 0.55, -0.75, 1]], [13.85, [-0.8, 0, 0.45, -1.1, 1]],          // repay: hand it back
  [14.0, [-0.5, -0.75, 0.8, 0, 1]], [14.3, [-0.62, -0.38, 0.8, 0, 1]], [14.5, [-0.62, -0.38, 0.8, 0, 1]],
]);
const headTilt = track([[0, [0, 0]], [3.15, [0, 0]], [3.22, [0.25, 0]], [3.4, [0.25, 0]], [3.5, [0, 0]], [12.6, [0, 0]], [12.8, [-0.3, 0]], [13.4, [-0.3, 0]], [13.5, [0, 0]]]);

// coins: anchor names, scale
const memeScale = track([[0, 0], [1.02, 0], [1.3, 1], [9.15, 1], [9.6, 0.74], [9.95, 0.72], [10.2, 0.9], [10.42, 0.9], [10.55, 0.62], [10.8, 0.7], [11.2, 0.82], [13.49, 0.82], [13.51, 1]]);
const stableScale = track([[0, 0], [6.25, 0], [6.4, 1], [13.85, 1], [14.02, 0]]);
const portGlowT = track([[0, 0], [5.95, 0], [6.12, 1], [6.5, 0.35], [7.4, 0], [10.05, 0], [10.18, 0.8], [10.4, 0]]);
const lilacGlowT = track([[0, 0], [6.25, 0], [6.4, 0.9], [6.7, 0]]);
const wishT = win(1.8, 2.45, 0.12);
const extraT = track([[0, [0, 0]], [9.85, [0, 0]], [9.9, [0, 1]], [10.17, [1, 1]], [10.24, [1, 0]]]);    // [progress, scale]
const sliceT = track([[0, [0, 0]], [10.6, [0, 0]], [10.64, [0, 1]], [10.78, [1, 1]], [11.0, [2, 1]], [11.05, [2, 0]]]);
// keeper drone: Meloan's keeper flies out to meet Buddy at the pad, then shadows him through the system.
// Between scripted moments it trails him (behind his right shoulder) with a soft lag.
// it keeps to whichever side of him is toward the middle of the frame, a little behind him, so it never blocks the shot
const droneArrive = track([[3.15, [1.5, 5.2, -4.0]], [3.42, [5.6, 3.0, 5.2]], [3.62, [5.8, 2.1, 8.6]]]);   // page time
const droneArriveW = track([[0, 1], [3.66, 1], [3.86, 0]]);
const SLICE_AT = mv([4.2, 1.35, -11.6], DV), SLICE_UP = mv([5.4, 4.6, -12.8], DV);
const droneStorm = track([[10.4, SLICE_AT], [10.8, [SLICE_AT[0], 1.3, SLICE_AT[2]]], [11.0, SLICE_UP], [11.15, SLICE_UP]]);   // core time
const droneStormW = track([[0, 0], [10.36, 0], [10.56, 1], [11.12, 1], [11.42, 0]]);
const droneBye = track([[F0 + 1.15, [PARK.x - 4.6, 1.6, PARK.z + 3.0]], [F0 + 1.38, [PARK.x - 4.6, 1.6, PARK.z + 3.0]], [F0 + 1.8, [PARK.x - 4.4, 2.8, PARK.z + 2.8]]]);
const droneByeW = track([[0, 0], [F0 + 1.12, 0], [F0 + 1.3, 1]]);
const droneTarget = new THREE.Vector3(), droneLook = new THREE.Vector3();
let droneReady = false, droneSide = 1;
const fillT = track([[0, 0.15], [7.7, 0.15], [8.9, 0.95], [10.5, 0.95], [10.7, 0.88], [11.5, 0.88], [11.85, 0.78]]);
const lenderT = (u) => clamp01((u - 7.75) / 1.15);
const crackT = track([[0, 0], [11.28, 0], [11.42, 1], [11.75, 1], [11.95, 0.3], [13.4, 0.3], [13.46, 0]]);
const shieldT = track([[0, [HALL_X, 4.5, -13.25, 0]], [11.35, [HALL_X, 4.5, -13.25, 0]], [11.75, [HALL_X, 1.15, -13.2, 1]], [12.4, [HALL_X, 1.15, -13.2, 1]], [12.7, [HALL_X, 1.15, -13.2, 0.6]], [13.4, [HALL_X, 1.15, -13.2, 0.6]], [13.46, [HALL_X, 1.15, -13.2, 0]]]);
const stormT = track([[0, 0], [9.05, 0], [9.4, 1], [10.85, 1], [11.15, 0]]);
const blueprintT = track([[0, 0], [12.55, 0], [12.9, 1], [13.4, 1], [13.5, 0]]);
const veilT = track([[0, 0], [13.3, 0], [13.45, 1], [13.55, 1], [13.75, 0]]);
const ringsT = track([[0, 1], [2.4, 1], [2.9, 0], [13.5, 0], [13.7, 1]]);
const counterT = track([[0, 0], [2.45, 0], [2.8, 1], [4.3, 1], [4.6, 0]]);
const worldT = track([[0, 0], [2.5, 0], [2.85, 1], [13.49, 1], [13.51, 0]]);

// ---------------- overlay (copy, cards, labels) ----------------
const $ = (s) => document.querySelector(s);
const lines = [...document.querySelectorAll('[data-in]')].map((el) => {
  const ins = el.dataset.in.split(',').map(Number), outs = el.dataset.out.split(',').map(Number), fade = +(el.dataset.fade || 0.12);
  const fs = ins.map((a, i) => win(a, outs[i], fade));
  return { el, f: (x) => Math.max(...fs.map((f) => f(x))) };
});
const dots = [...document.querySelectorAll('.rail button')];
dots.forEach((b, i) => b.addEventListener('click', () => scrollToU(CHAPTERS[i].u + (i ? 0.2 : 0))));
const healthEl = $('#health-val'), healthBar = $('#health-bar'), healthCard = $('#card-health');
const healthT = track([[0, 1.8], [9.2, 1.8], [9.6, 1.15], [9.95, 1.06], [10.22, 1.45], [10.42, 1.4], [10.55, 0.92], [10.78, 1.22], [11.0, 1.3]]);
const tags = [
  { el: $('#tag-locked'), at: () => tmpV.set(lockedVault.position.x, 2.35, lockedVault.position.z), f: win(4.55, 5.45) },
  { el: $('#tag-rate'), at: () => tmpV.set(HALL_X - 2.15 * SPREAD, 2.2, HZ(-14)), f: win(12.85, 13.42, 0.08) },
  { el: $('#tag-reserve'), at: () => tmpV.set(HALL_X, 2.3, HZ(-14)), f: win(12.9, 13.42, 0.08) },
  { el: $('#tag-liq'), at: () => tmpV.set(HALL_X + 2.15 * SPREAD, 2.2, HZ(-14)), f: win(12.95, 13.42, 0.08) },
  { el: $('#tag-debt'), at: () => tmpV.set(HALL_X + 2.1 * SPREAD, 2.2, HZ(-10.2)), f: win(13.0, 13.42, 0.08) },
  { el: $('#tag-admin'), at: () => tmpV.set(HALL_X - 2.1 * SPREAD, 2.2, HZ(-7.2)), f: win(13.05, 13.42, 0.08) },
  { el: $('#tag-fees'), at: () => tmpV.set(HALL_X + 2.1 * SPREAD, 2.2, HZ(-7.2)), f: win(13.1, 13.42, 0.08) },
];
const veil = $('#veil');
const fuelVal = $('#fuel-val'), fuelBar = $('#fuel-bar'), fuelCard = $('#card-fuel');
const openCamRel = track([[0, [0.6, 1.4, 16]], [1.2, [0.4, 1.8, 12]], [1.9, [0.3, 2.4, 7.4]], [2.2, [0.3, 2.4, 7.6]], [2.6, [0, 3.2, 9.5]], [2.95, [0, 2.8, 8.0]]]);
const openTgtRel = track([[0, [0.6, 0.5, 0]], [1.2, [0.4, 0.9, 0]], [1.9, [0.25, 1.7, 0]], [2.2, [0.25, 1.7, 0]], [2.6, [0, 1.4, -8]], [2.95, [0, 0.8, -24]]]);
const openCamAbs = track([[2.951, pd([1.0, 3.6, 17])], [3.25, pd([1.6, 2.4, 12.5])], [3.5, pd([1.4, 1.8, 10])]]);
const openTgtAbs = track([[2.951, pd([6.0, 6.0, 1.5])], [3.25, pd([4.6, 2.0, 1.0])], [3.5, pd([3.6, 1.2, 0.8])]]);
let finCamPos, finCamTgt;
{
  const lazy = () => {
    finCamPos = track(finCam.map(([k, pp]) => [k, pp]));
    finCamTgt = track(finCam.map(([k, , tt]) => [k, tt]));
  };
  finCamPos = (uN) => { if (!finCam[0][1]) { finCam[0][1] = camPos(13.76); finCam[0][2] = camTgt(13.76); } lazy(); return finCamPos(uN); };
  finCamTgt = (uN) => { if (!finCam[0][1]) { finCam[0][1] = camPos(13.76); finCam[0][2] = camTgt(13.76); } lazy(); return finCamTgt(uN); };
}
const scrollCue = $('#cue');

function scrollToU(u) {
  window.scrollTo({ top: u * innerHeight, behavior: reduceMotion ? 'auto' : 'smooth' });
}

// ---------------- frame loop ----------------
const anchor = (name, out) => {
  const fwd = tmpV2.set(0, 0, 1).applyQuaternion(buddy.root.quaternion);
  const bp = buddy.root.position;
  switch (name) {
    case 'ground': return out.set(bp.x + fwd.x * 0.75, 0.24, bp.z + fwd.z * 0.75);
    case 'hug': buddy.parts.ports.coral.getWorldPosition(out); out.x = bp.x + fwd.x * 0.62; out.z = bp.z + fwd.z * 0.62; out.y += 0.05; return out.addScaledVector(V(-fwd.z, 0, fwd.x), 0.29);
    case 'port': buddy.parts.ports.coral.getWorldPosition(out); return out.addScaledVector(fwd, 0.08);
    case 'lilacPort': buddy.parts.ports.lilac.getWorldPosition(out); return out.addScaledVector(fwd, 0.08);
    case 'lhand': buddy.parts.arms[0].userData.hand.getWorldPosition(out); return out.addScaledVector(fwd, 0.13);
    case 'rhand': buddy.parts.arms[1].userData.hand.getWorldPosition(out); return out.addScaledVector(fwd, 0.13);
    case 'away': return out.set(bp.x + 1.8, 4.2, bp.z + 1.2);
    default: return out.copy(bp);
  }
};
// position tracks of named anchors blend smoothly: sample names at segment ends
function namedTrack(keys) {
  const f = (u, out) => {
    if (u <= keys[0][0]) return anchor(keys[0][1], out);
    for (let i = 1; i < keys.length; i++) {
      if (u <= keys[i][0]) {
        const [u0, n0] = keys[i - 1], [u1, n1] = keys[i];
        const k = smooth((u - u0) / (u1 - u0 || 1));
        const a = anchor(n0, new THREE.Vector3()), b = anchor(n1, new THREE.Vector3());
        return out.copy(a).lerp(b, k);
      }
    }
    return anchor(keys[keys.length - 1][1], out);
  };
  return f;
}
const memePos = namedTrack([[0, 'lhand'], [5.92, 'lhand'], [6.18, 'port'], [14.5, 'port']]);
const stablePos = namedTrack([[0, 'lilacPort'], [6.32, 'lilacPort'], [6.55, 'rhand'], [13.7, 'rhand'], [13.98, 'away']]);
const memeInPort = track([[0, 0], [5.95, 0], [6.18, 1], [14.0, 1], [14.25, 0]]);

let scrollU = 0, shownU = 0, lastPos = new THREE.Vector3(), walkBlend = 0, walkPhase = 0;

// ---------------- sound ----------------
const sfx = createStorySound();
// one-shot cues, fired only when scrolling forward past them (not on big jumps)
const PAGE_CUES = [
  [2.15, 'ping'], [2.86, 'whoosh', 1.4, 0.4], [3.31, 'thud'], [3.33, 'hiss'], [3.34, 'servo'], [3.74, 'hiss'], [3.76, 'servo', true],
  [F0 + 0.58, 'servo'], [F0 + 0.6, 'hiss'], [F0 + 0.7, 'fuel'], [F0 + 1.06, 'hiss'], [F0 + 1.1, 'servo', true], [F0 + 1.38, 'whoosh', 2.2, 0.45],
];
const CORE_CUES = [
  [4.06, 'whoosh', 0.9, 0.2], [6.16, 'coinIn'], [6.38, 'pop'], [10.15, 'coinIn'], [10.66, 'zap'], [10.95, 'whoosh', 0.6, 0.15],
  [11.72, 'shield'], [12.88, 'blips'], [13.0, 'blips'],
];
// the camera comes out of the white hole close to Buddy and swings back to the opening shot
let emergeAt = window.__loader ? -1 : 0;
let lastStep = 0, lastRung = 0, chimeAt = 0, glitchAt = 0, lastDronePos = new THREE.Vector3(), droneSpeed = 0;
let lastActionU = 0;
const clock = new THREE.Clock();
const camOffset = new THREE.Vector3();

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  const renderScale = renderer.getPixelRatio();
  edgeAAPass.material.uniforms.resolution.value.set(1 / (w * renderScale), 1 / (h * renderScale));
  bloomComposer.setSize(Math.round(w / 2), Math.round(h / 2));
  camera.aspect = w / h;
  camera.fov = w / h < 0.8 ? 40 : 30;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

function readScroll() { scrollU = Math.min(TOTAL, Math.max(0, scrollY / innerHeight)); }
addEventListener('scroll', readScroll, { passive: true });
readScroll();
shownU = scrollU;

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const prevN = shownU;
  shownU += (scrollU - shownU) * (reduceMotion ? 1 : 1 - Math.pow(0.0009, dt));
  if (Math.abs(scrollU - shownU) < 0.0004) shownU = scrollU;
  const uN = shownU;          // page timeline
  const u = mapU(uN);         // core story timeline
  const prevU = mapU(prevN);
  const t = clock.elapsedTime;

  // ---- one-shot actions when scrolling forward past a cue ----
  for (const [au, name] of ACTIONS_AT) if (prevU < au && u >= au && !reduceMotion) buddy.play(name);
  if (sfx.enabled && uN > prevN && uN - prevN < 0.8) {
    for (const [a, name, ...args] of PAGE_CUES) if (prevN < a && uN >= a) sfx.play(name, ...args);
    if (u > prevU) {
      for (const [a, name, ...args] of CORE_CUES) if (prevU < a && u >= a) sfx.play(name, ...args);
      for (const [a, name] of ACTIONS_AT) if (prevU < a && u >= a) sfx.play('voice', name);
    }
    if (prevN < F0 + 1.42 && uN >= F0 + 1.42) sfx.play('voice', 'wave');
  }
  if (prevN < F0 + 1.42 && uN >= F0 + 1.42 && !reduceMotion) buddy.play('wave');

  // ---- rocket ----
  const rp = rkPos(uN);
  const inSpace = spaceT(uN) > 0.5;
  rocket.root.position.set(rp[0], rp[1] + (inSpace ? Math.sin(t * 1.4) * 0.12 : 0), rp[2]);
  rocket.root.rotation.set(0, rkYaw(uN), rkPitch(uN));
  RK.setFlame(reduceMotion ? Math.min(1, rkFlame(uN)) : rkFlame(uN), t);
  RK.setLegs(rkLegs(uN));
  RK.setCanopy(canopyT(uN));
  RK.setLadder(ladderT(uN));
  rocket.root.updateMatrixWorld(true);

  // ---- Buddy ----
  let bp = budPos(u), rotY = budRot(u), mood = budMood(u), p = pose(u), ht = headTilt(u);
  const opening = uN < OPEN_END, finale = uN > F0;
  let climbing = false;
  if (opening || finale) {
    const r = boardAt(opening ? PATH_OPEN : PATH_FIN, uN, new THREE.Vector3());
    bp = [r.pos.x, r.pos.y, r.pos.z];
    if (opening) { rotY = openYaw(uN); mood = openMood(uN); p = openPose(uN); }
    else { rotY = finYaw(uN); mood = finMood(uN); p = finPose(uN); }
    if (r.mode === 'climb') {
      // hand over hand: arms reach up the ladder in turn, facing the ship
      climbing = true;
      const ph = r.k * 18;
      const rung = Math.floor(ph / Math.PI);
      if (rung !== lastRung) { lastRung = rung; sfx.play('clink'); }
      p = [-0.12, -2.45 + 0.38 * Math.sin(ph), 0.12, -2.45 - 0.38 * Math.sin(ph), 1];
      rotY = Math.PI;
    }
    ht = [climbing ? -0.25 : 0, 0];
  }
  buddy.root.position.set(bp[0], bp[1], bp[2]);
  buddy.root.rotation.y = rotY;
  const seated = (opening && uN < 3.36) || (finale && uN > F0 + 1.28);
  const moved = Math.min(0.5, lastPos.distanceTo(buddy.root.position)) * (seated ? 0 : 1);
  lastPos.copy(buddy.root.position);
  walkPhase += moved * 7.5;
  walkBlend += ((moved / Math.max(dt, 1e-3) > 0.12 ? 1 : 0) - walkBlend) * Math.min(1, dt * 8);
  buddy.setWalk(walkBlend);
  buddy.setWalkPhase(walkPhase);
  if (buddy.mood !== mood) {
    if (Math.abs(uN - prevN) < 0.8 && mood !== 'neutral') sfx.play('voice', mood);
    buddy.setMood(mood);
  }
  // footsteps on each footfall while walking
  const stepN = Math.floor(walkPhase / Math.PI);
  if (stepN !== lastStep) { if (walkBlend > 0.4 && !climbing && moved < 0.4) sfx.play('step'); lastStep = stepN; }
  buddy.setPose({ lz: p[0], lx: p[1], rz: p[2], rx: p[3], w: p[4] });
  buddy.setHead(ht[0], ht[1]);
  buddy.setIdle(reduceMotion ? 0 : 1);
  buddy.update(reduceMotion ? 0 : dt);
  buddy.root.updateMatrixWorld(true);

  // ---- coins ----
  memePos(u, memeCoin.root.position);
  const ms = memeScale(u);
  memeCoin.root.scale.setScalar(0.21 * ms);
  memeCoin.root.visible = ms > 0.01;
  const inPort = memeInPort(u);
  const spinQ = tmpQ.setFromEuler(new THREE.Euler(0, Math.sin(clock.elapsedTime * 1.2) * 0.5 * (1 - inPort), 0));
  memeCoin.root.quaternion.copy(buddy.root.quaternion).multiply(spinQ);
  if (u < 1.62) memeCoin.root.position.y += Math.sin(clock.elapsedTime * 2) * 0.03 * clamp01((u - 1.1) / 0.3);

  stablePos(u, stableCoin.root.position);
  let ss = stableScale(u);
  if (finale) {
    const k = smooth(finStable(uN));
    anchor('rhand', stableCoin.root.position).lerp(RK.fuelPort.getWorldPosition(tmpV), k);
    ss = k < 0.98 ? 1 : 0;
  }
  stableCoin.root.scale.setScalar(0.21 * ss);
  stableCoin.root.visible = ss > 0.01;
  stableCoin.root.quaternion.copy(buddy.root.quaternion);

  buddy.parts.ports.coral.getWorldPosition(portGlow.position);
  portGlow.material.opacity = portGlowT(u) * 0.9;
  buddy.parts.ports.lilac.getWorldPosition(lilacGlow.position);
  lilacGlow.material.opacity = lilacGlowT(u) * 0.9;

  wishRing.position.set(bp[0] + 0.62, 2.3, bp[2] + 0.2);
  wishRing.material.opacity = wishT(u) * 0.9;
  wishRing.rotation.y = clock.elapsedTime * 0.8;

  const ex = extraT(u);
  extraCoin.root.visible = ex[1] > 0.01;
  if (extraCoin.root.visible) {
    const from = tmpV.set(bp[0] - 2.2, 1.8, bp[2] + 1.2);
    const to = anchor('port', new THREE.Vector3());
    extraCoin.root.position.copy(from).lerp(to, smooth(ex[0]));
    extraCoin.root.position.y += Math.sin(ex[0] * Math.PI) * 0.5;
    extraCoin.root.scale.setScalar(0.15 * ex[1]);
    extraCoin.root.quaternion.copy(buddy.root.quaternion);
  }

  // ---- drone + the slice it takes ----
  {
    // trailing spot behind Buddy's right shoulder, follows him up and down the ladder too
    const B = buddy.root.position;
    const ndcX = tmpV.copy(B).project(camera).x;
    if (ndcX > 0.22) droneSide = -1; else if (ndcX < -0.22) droneSide = 1;
    const away = tmpV2.set(B.x - camera.position.x, 0, B.z - camera.position.z).normalize();   // camera → Buddy, flat
    droneTarget.set(B.x - away.z * droneSide * 1.0 + away.x * 0.45, B.y + 1.7, B.z + away.x * droneSide * 1.0 + away.z * 0.45);
    droneLook.set(bp[0], bp[1] + 1.0, bp[2]);
    const wa = opening ? droneArriveW(uN) : 0, ws = finale ? 0 : droneStormW(u), wb = finale ? droneByeW(uN) : 0;
    if (wa > 0) droneTarget.lerp(tmpV.fromArray(droneArrive(uN)), wa);
    if (ws > 0) droneTarget.lerp(tmpV.fromArray(droneStorm(u)), ws);
    if (wb > 0) { droneTarget.lerp(tmpV.fromArray(droneBye(uN)), wb); droneLook.lerp(rocket.root.position, wb); }
    const show = uN >= 3.15;
    // scripted moments are followed tightly, free trailing has a softer lag; big jumps (fast scrolls, cuts) snap
    const rate = wa > 0.5 || ws > 0.5 || wb > 0.5 ? 9 : 3.2;
    if (!droneReady || !show || drone.root.position.distanceTo(droneTarget) > 6) drone.root.position.copy(droneTarget);
    else drone.root.position.lerp(droneTarget, 1 - Math.exp(-dt * rate));
    droneReady = show;
    drone.root.visible = show;
    drone.root.lookAt(droneLook);
    drone.update(reduceMotion ? 0 : dt);
  }
  const sl = sliceT(u);
  sliceCoin.root.visible = sl[1] > 0.01;
  if (sliceCoin.root.visible) {
    const a = anchor('port', new THREE.Vector3());
    const b = tmpV.copy(drone.root.position).add(V(0, -0.22, 0));
    if (sl[0] <= 1) sliceCoin.root.position.copy(a).lerp(b, smooth(sl[0]));
    else sliceCoin.root.position.copy(b);
    sliceCoin.root.scale.setScalar(0.11 * sl[1]);
    sliceCoin.root.lookAt(camera.position);
  }

  // ---- world dressing ----
  const ct0 = counterT(u);
  counter.root.visible = ct0 > 0.01;
  counter.root.scale.setScalar(0.6 + 0.4 * ct0);
  if (counter.root.visible) {
    const h = counter.root.userData.holo;
    h.rotation.y = clock.elapsedTime * 0.9;
    h.position.y = 2.45 + Math.sin(clock.elapsedTime * 1.6) * 0.05;
    // the coin hologram breaks up while Buddy considers selling
    const glitch = u > 2.95 && u < 3.45 ? (Math.random() < 0.25 ? 0.15 : 1) : 1;
    counter.root.userData.holoMat.opacity = (0.5 + Math.sin(clock.elapsedTime * 11) * 0.08) * glitch;
    if (glitch < 1 && t - glitchAt > 0.12) { glitchAt = t; sfx.play('glitch'); }
  }
  portalMat.uniforms.uTime.value = clock.elapsedTime;
  const wt = worldT(u);
  door.visible = runner.visible = wt > 0.01;
  door.scale.setScalar(Math.max(0.001, wt));
  door.userData.glow.opacity = 0.95 * clamp01((4.12 - u) / 0.22);
  vaults.forEach((v) => { v.visible = wt > 0.01; });
  fill.visible = wt > 0.01;
  rings.visible = halo.visible = ringsT(u) > 0.01;
  halo.rotation.z = clock.elapsedTime * 0.05;
  halo.children[1].rotation.x = Math.sin(clock.elapsedTime * 0.4) * 0.25;
  rings.children.forEach((r) => { r.rotation.y += r.userData.spin * dt; r.rotation.x += r.userData.spin * 0.5 * dt; });
  const vf = fillT(u);
  fill.scale.y = vf * 1.65;
  fill.position.y = 0.22 + (vf * 1.65) / 2;
  vaultGlow.material.opacity = clamp01((u - 7.6) / 0.4) * clamp01((9.1 - u) / 0.3) * 0.35;
  vaults.forEach((v) => { if (v.userData.coin) v.userData.coin.root.rotation.y = clock.elapsedTime * 0.7 + v.position.x; });

  const lt = lenderT(u);
  if (lt > 0 && lt < 1 && u > prevU && t - chimeAt > 0.11) { chimeAt = t; sfx.play('chime'); }
  lenders.forEach((c) => {
    const k = clamp01((lt - c.userData.delay) / 0.22);
    c.visible = k > 0 && k < 1;
    if (!c.visible) return;
    const a = c.userData.from, b = c.userData.mid, e = VAULT_C;
    const q = (1 - k) * (1 - k), r = 2 * (1 - k) * k, s2 = k * k;
    c.position.set(a.x * q + b.x * r + e.x * s2, a.y * q + b.y * r + (e.y + 0.6) * s2, a.z * q + b.z * r + e.z * s2);
    c.rotation.y = c.userData.spin + k * 8;
  });

  crack.material.opacity = crackT(u);
  crack.visible = crack.material.opacity > 0.01;
  const sh = shieldT(u);
  shield.position.set(sh[0], sh[1] - 0.05, HZ(-14));
  shield.visible = sh[3] > 0.01;
  const flick = u < 11.8 && Math.random() < 0.2 ? 0.4 : 1;
  shieldMat.opacity = 0.95 * sh[3] * flick;
  shieldFill.opacity = 0.12 * sh[3] * (0.8 + Math.sin(clock.elapsedTime * 3) * 0.2);
  hexTex.offset.y = clock.elapsedTime * 0.04;

  // storm: light, fog and dust
  const st = stormT(u);
  const bpT = blueprintT(u);
  const sp = spaceT(uN);
  const bg = tmpColor.copy(NIGHT).lerp(tmpColor2.set('#2A0E26'), st * 0.9).lerp(tmpColor2.set('#14205A'), bpT * 0.8).lerp(tmpColor2.set('#03051A'), sp);
  scene.background.copy(bg);
  scene.fog.color.copy(bg);
  scene.fog.near = sp > 0.5 ? 200 : 9 - st * 4; scene.fog.far = sp > 0.5 ? 400 : 36 - st * 14;
  planet.visible = nebulae.visible = streaks.visible = sp > 0.5;
  floor.visible = sp < 0.5;
  if (planet.visible) {
    planet.userData.ball.rotation.y = t * 0.03;
    // streaks run backwards past the ship along its heading
    streaks.position.copy(rocket.root.position);
    streaks.rotation.set(0, rocket.root.rotation.y, 0);
    const pa = streakGeo.attributes.position;
    for (let i = 0; i < STREAKS; i++) {
      let x0 = pa.getX(i * 2) - dt * 26, x1 = pa.getX(i * 2 + 1) - dt * 26;
      if (x1 < -30) { x0 += 60; x1 += 60; }
      pa.setX(i * 2, x0); pa.setX(i * 2 + 1, x1);
    }
    pa.needsUpdate = true;
  }
  const pk = pingT(uN);
  ping.visible = pk > 0 && pk < 1;
  if (ping.visible) {
    ping.position.copy(rocket.root.position);
    ping.scale.setScalar(1 + pk * 9);
    ping.rotation.set(Math.PI / 2 * 0.85, 0, 0);
    ping.material.opacity = (1 - pk) * 0.9;
  }
  stars.position.copy(camera.position);
  if (sp > 0.5) { rings.visible = halo.visible = false; }
  floorMat.emissive.set('#ffffff').lerp(tmpColor2.set('#FF6A45'), st);
  floorMat.emissiveIntensity = 0.55 + bpT * 0.6 - st * 0.15;
  hemi.intensity = 0.6 - st * 0.25;
  key.intensity = 1.25 - st * 0.5;
  key.color.set('#FFF3E6').lerp(tmpColor2.set('#FFB3A0'), st);
  rim.color.set('#6F84FF').lerp(tmpColor2.set('#FF5A3A'), st);
  alarm.intensity = st * (3 + Math.sin(clock.elapsedTime * 7) * 2.5);
  alarm.position.set(bp[0] + 2, 3, bp[2] + 1);
  dust.material.opacity = st * 0.75;
  if (st > 0) {
    const pa = dustGeo.attributes.position;
    for (let i = 0; i < RAIN; i++) {
      let y0 = pa.getY(i * 2) - dt * 3.2, y1 = pa.getY(i * 2 + 1) - dt * 3.2;
      if (y1 < 0) { y0 += 7; y1 += 7; }
      pa.setY(i * 2, y0); pa.setY(i * 2 + 1, y1);
    }
    pa.needsUpdate = true;
  }
  grid.material.opacity = bpT * 0.7;

  // key light follows the action
  key.position.set(bp[0] - 3, bp[1] + 8, bp[2] + 5);
  key.target.position.set(bp[0], bp[1], bp[2] - 1);
  rim.position.set(bp[0] + 4, bp[1] + 3, bp[2] - 6);

  // ---- camera ----
  let cp = camPos(u), ct = camTgt(u);
  if (opening) {
    const R = rocket.root.position;
    if (uN < 2.951) {
      let rel = openCamRel(uN);
      const tg = openTgtRel(uN);
      const em = emergeAt < 0 ? 0 : clamp01((t - emergeAt) / 2.6), e = 1 - Math.pow(1 - em, 3);
      if (em < 1) {
        const a = (1 - e) * 0.7, k = 0.35 + 0.65 * e;
        rel = [(rel[0] * Math.cos(a) + rel[2] * Math.sin(a)) * k, rel[1] * k + (1 - e) * 0.6, (-rel[0] * Math.sin(a) + rel[2] * Math.cos(a)) * k];
      }
      cp = [R.x + rel[0], R.y + rel[1], R.z + rel[2]];
      ct = [R.x + tg[0], R.y + tg[1], R.z + tg[2]];
    } else {
      // follow the ship down, frame Buddy climbing out, then hand over to the core camera
      const k1 = smooth(clamp01((uN - 3.26) / 0.1)), k2 = smooth(clamp01((uN - 3.72) / 0.08));
      const fp = [R.x - 4.5, R.y + 1.0, R.z + 11.5], ft = [R.x - 1.6, R.y - 0.4, R.z];
      // pull back and follow Buddy's height so his whole body stays in frame on top of the hull and down the ladder
      const by = Math.max(0, buddy.root.position.y);
      const dp = pd([2.2, 3.0 + by * 0.55, 13.6]), dt2 = pd([5.2, 1.5 + by * 0.75, 2.2]);
      const c0 = camPos(2.5), c1 = camTgt(2.5);
      cp = fp.map((v, i) => { const m = v + (dp[i] - v) * k1; return m + (c0[i] - m) * k2; });
      ct = ft.map((v, i) => { const m = v + (dt2[i] - v) * k1; return m + (c1[i] - m) * k2; });
    }
  } else if (finale) {
    if (!finCam[0][1]) { finCam[0][1] = camPos(13.76); finCam[0][2] = camTgt(13.76); }
    cp = finCamPos(uN); ct = finCamTgt(uN);
  }
  if (u > ORBIT[0] && u < ORBIT[1]) {
    const k = (u - ORBIT[0]) / (ORBIT[1] - ORBIT[0]);
    cp = orbitAt(smooth(k) * Math.PI * 2);
    ct = [HALL_X, 1.0, HZ(-14) + 0.6];
  }
  const narrow = camera.aspect < 0.8;
  camOffset.set(cp[0] - ct[0], cp[1] - ct[1], cp[2] - ct[2]);
  if (narrow) camOffset.multiplyScalar(1.35);
  camera.position.set(ct[0] + camOffset.x, ct[1] + camOffset.y, ct[2] + camOffset.z);
  // on phones, lift the subject into the top half (copy sits at the bottom); more so for the hero and finale
  // keep the subject above the subtitles at the bottom of the screen
  const lift = narrow ? 0.45 : 0.18;
  camera.lookAt(ct[0], ct[1] - lift, ct[2]);

  // continuous sound beds
  droneSpeed += ((drone.root.visible ? lastDronePos.distanceTo(drone.root.position) / Math.max(dt, 1e-3) : 0) - droneSpeed) * Math.min(1, dt * 6);
  lastDronePos.copy(drone.root.position);
  sfx.update({
    engine: Math.min(1, rkFlame(uN)) * (inSpace ? 0.55 : 1),
    drone: drone.root.visible ? 1 : 0, droneSpeed,
    alarm: st,
    space: sp,
    platform: (1 - sp) * (1 - st * 0.6),
    portal: door.visible ? clamp01(wt) * clamp01((4.4 - u) / 0.4) : 0,
  });

  renderBloomed();

  // ---- overlay ----
  for (const l of lines) {
    const o = l.f(uN);
    l.el.style.opacity = o.toFixed(3);
    l.el.style.transform = `translateY(${((1 - o) * 14).toFixed(1)}px)`;
    l.el.style.visibility = o > 0.002 ? 'visible' : 'hidden';
  }
  document.body.classList.toggle('alert', st > 0.5);
  const h = healthT(u);
  healthEl.textContent = h.toFixed(2);
  healthBar.style.width = `${Math.min(100, (h / 2) * 100)}%`;
  healthCard.classList.toggle('low', h < 1);
  for (const t of tags) {
    const o = t.f(u);
    t.el.style.opacity = o.toFixed(3);
    t.el.style.visibility = o > 0.002 ? 'visible' : 'hidden';
    if (o > 0.002) {
      const v = t.at().project(camera);
      t.el.style.transform = `translate(${((v.x * 0.5 + 0.5) * innerWidth).toFixed(1)}px, ${((-v.y * 0.5 + 0.5) * innerHeight).toFixed(1)}px) translate(-50%, -100%)`;
    }
  }
  veil.style.opacity = Math.max(veilT(u), openVeil(uN)).toFixed(3);
  scrollCue.style.opacity = (1 - clamp01(uN / 0.3)).toFixed(3);
  const fv = fuelT(uN);
  fuelVal.textContent = `${Math.round(fv * 100)}%`;
  fuelBar.style.width = `${fv * 100}%`;
  fuelCard.classList.toggle('low', fv < 0.2);
  let ci = 0;
  CHAPTERS.forEach((c, i) => { if (uN >= c.u - 0.05) ci = i; });
  dots.forEach((d, i) => d.setAttribute('aria-current', i === ci ? 'step' : 'false'));

  requestAnimationFrame(frame);
}
const tmpColor = new THREE.Color(), tmpColor2 = new THREE.Color();
// loader: the scene is built; report done once a few frames have actually been drawn (shaders compiled)
window.__loader?.stage(0.72);
let framesDrawn = 0;
const countFrames = () => { if (++framesDrawn >= 4) window.__loader?.complete(); else requestAnimationFrame(countFrames); };
requestAnimationFrame(countFrames);
document.addEventListener('meloan:launched', () => {
  emergeAt = clock.elapsedTime;
  sfx.playWhenReady('emerge');
});
requestAnimationFrame(frame);
window.__story = { scrollToU, get u() { return shownU; }, set u(v) { scrollU = shownU = v; } };

