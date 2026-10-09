// Story props modelled from the reference images: keeper drone, sell counter, meme coins.
// Shares the shape helpers and vinyl material with buddy.js (inlined into the same module).
import * as THREE from 'three';
import { superBlob, roundedDisc, frontDisc, vinyl, mesh } from './buddy.js';

const P = {
  navy: '#2B3762', navyDark: '#212B52', cream: '#F7EAD8', coral: '#FA7F5C', coralGlow: '#FF8A5E',
};

// ---------------- keeper drone ----------------
// Navy sphere, a glowing coral ring on the front plate, two elbow arms with rotors.
export function createDrone({ scale = 0.3 } = {}) {
  // sampled from the drone reference: near-black navy, matte; peach glow
  const navy = vinyl('#1B1F33', { roughness: 0.62, clearcoat: 0.12, clearcoatRoughness: 0.5, envMapIntensity: 0.6 });
  const navyDark = vinyl('#111426', { roughness: 0.7, clearcoat: 0, envMapIntensity: 0.5 });
  const plateMat = vinyl('#262A42', { roughness: 0.55, clearcoat: 0.1, envMapIntensity: 0.6 });
  const coral = vinyl('#FA8D68', { roughness: 0.4, envMapIntensity: 0.7 });
  const glow = new THREE.MeshStandardMaterial({ color: '#FFA27E', emissive: '#FF8C64', emissiveIntensity: 1.4, roughness: 0.4 });

  const root = new THREE.Group();
  const bob = new THREE.Group();
  root.add(bob);
  root.scale.setScalar(scale);

  bob.add(mesh(new THREE.SphereGeometry(1, 64, 48), navy));
  // panel seams
  for (const [rx, ry] of [[0, 0], [Math.PI / 2, 0.55], [Math.PI / 2, -0.55]]) {
    const seam = mesh(new THREE.TorusGeometry(1.0, 0.012, 8, 96), navyDark);
    seam.rotation.set(rx, ry, 0);
    bob.add(seam);
  }
  // front plate with the glowing ring
  const face = new THREE.Group();
  face.position.z = 0.7;
  face.add(mesh(frontDisc(0.74, 0.3, 0.1), plateMat));
  face.add(mesh(new THREE.TorusGeometry(0.75, 0.03, 8, 64), navyDark, 0, 0, 0.04));
  const ring = mesh(new THREE.TorusGeometry(0.44, 0.12, 24, 72), glow, 0, 0, 0.31);
  face.add(ring);
  face.add(mesh(frontDisc(0.32, 0.36, 0.1), plateMat));
  // soft halo around the ring
  {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(128, 128, 40, 128, 128, 128);
    grd.addColorStop(0, 'rgba(255,140,100,0)'); grd.addColorStop(0.45, 'rgba(255,140,100,0.35)'); grd.addColorStop(0.6, 'rgba(255,140,100,0.12)'); grd.addColorStop(1, 'rgba(255,140,100,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.position.z = 0.34;
    face.add(halo);
  }
  bob.add(face);

  const rotors = [];
  for (const sx of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(sx * 0.9, 0.08, -0.05);
    // socket on the body
    const socket = mesh(roundedDisc(0.38, 0.32, 0.1), navy);
    socket.rotation.z = -sx * Math.PI / 2;
    arm.add(socket);
    const band = mesh(new THREE.TorusGeometry(0.3, 0.04, 8, 40), coral, sx * 0.1, 0, 0);
    band.rotation.y = Math.PI / 2;
    arm.add(band);
    // elbow tube: out, then up
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0), new THREE.Vector3(sx * 0.4, 0, 0),
      new THREE.Vector3(sx * 0.56, 0.12, 0), new THREE.Vector3(sx * 0.58, 0.45, 0),
    ]);
    arm.add(mesh(new THREE.TubeGeometry(curve, 24, 0.17, 16, false), navy));
    // hub
    const hub = new THREE.Group();
    hub.position.set(sx * 0.58, 0.5, 0);
    hub.add(mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.5, 32), navy, 0, 0.15, 0));
    hub.add(mesh(new THREE.CylinderGeometry(0.277, 0.277, 0.08, 32), coral, 0, 0.16, 0));
    hub.add(mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.12, 24), navy, 0, 0.45, 0));
    const rotor = new THREE.Group();
    rotor.position.y = 0.52;
    for (const a of [0, Math.PI]) {
      const blade = mesh(superBlob(1.15, 0.16, 0.44, 2.4, 24, 12), navy, Math.cos(a) * 0.55, 0, Math.sin(a) * 0.55);
      blade.rotation.y = -a;
      rotor.add(blade);
    }
    const cap = mesh(new THREE.SphereGeometry(0.15, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), coral, 0, 0.07, 0);
    rotor.add(cap);
    hub.add(rotor);
    arm.add(hub);
    rotors.push(rotor);
    bob.add(arm);
  }

  let t = 0;
  return {
    root,
    update(dt) {
      t += dt;
      rotors.forEach((r, i) => { r.rotation.y += dt * (i ? -22 : 22); });
      bob.position.y = Math.sin(t * 2.2) * 0.08;
      bob.rotation.z = Math.sin(t * 1.3) * 0.05;
      glow.emissiveIntensity = 1.3 + Math.sin(t * 3) * 0.2;
    },
  };
}

// ---------------- meme coin ----------------
// Thick rounded coin; the face artwork comes from the supplied emblem images.
const coinTexCache = new Map();
export function createMemeCoin(faceDataUrl, { radius = 1, scale = 0.35 } = {}) {
  let tex = coinTexCache.get(faceDataUrl);
  if (!tex) {
    tex = new THREE.TextureLoader().load(faceDataUrl);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    coinTexCache.set(faceDataUrl, tex);
  }
  const rim = vinyl('#F57E5E', { roughness: 0.35 });
  const face = vinyl('#ffffff', { map: tex, roughness: 0.45, clearcoat: 0.4 });
  const root = new THREE.Group();
  root.scale.setScalar(scale);
  const h = 0.28;
  const edge = mesh(roundedDisc(radius, h, 0.1, 64), rim);
  edge.rotation.x = Math.PI / 2;
  edge.position.z = -h / 2;
  root.add(edge);
  for (const side of [1, -1]) {
    const f = mesh(new THREE.CircleGeometry(radius * 0.985, 64), face, 0, 0, side * (h / 2 + 0.002));
    if (side < 0) f.rotation.y = Math.PI;
    root.add(f);
  }
  return { root };
}

// ---------------- sell counter ----------------
function signTexture(text) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 352;
  const g = c.getContext('2d');
  g.fillStyle = P.cream; g.fillRect(0, 0, c.width, c.height);
  if (text) {
    g.fillStyle = '#232845';
    g.font = '700 190px "Chakra Petch", Arial, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, c.width / 2, c.height / 2 + 8);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createSellCounter({ scale = 0.2, label = '' } = {}) {
  // Measured from the front, three-quarter and side reference views (100px = 1 unit).
  // x right, y up, z toward the front; origin on the floor under the centre of the cabinet.
  const M = (color, o = {}) => vinyl(color, { roughness: 0.6, clearcoat: 0.05, clearcoatRoughness: 0.6, envMapIntensity: 0.45, ...o });
  const cream = M('#F8E7D0');
  const creamLight = M('#FCF0DF');
  const navy = M('#212E52', { roughness: 0.5 });
  const navyDeep = M('#18213E', { roughness: 0.6 });
  const coral = M('#EE6A44');
  const root = new THREE.Group();
  root.scale.setScalar(scale);
  const add = (g, m, x, y, z) => { const o = mesh(g, m, x, y, z); root.add(o); return o; };

  // ---- feet: two-tier rounded blocks under each corner ----
  for (const sx of [-1, 1]) for (const fz of [1.25, -1.35]) {
    add(superBlob(1.65, 0.95, 1.55, 3.0, 40, 28), navy, sx * 3.7, 0.88, fz);
    add(superBlob(1.25, 0.55, 1.15, 3.0, 32, 20), navy, sx * 3.7, 0.3, fz);
  }
  // ---- cabinet (flat faces, small rounded edges) ----
  add(superBlob(8.4, 3.3, 3.3, 10, 96, 64), cream, 0, 2.27, 0);
  // ---- countertop slab ----
  add(superBlob(9.1, 0.78, 3.95, 9, 96, 48), navy, 0, 4.25, 0.05);

  // ---- sign on the front: raised navy frame, cream panel, four coral studs ----
  add(superBlob(7.2, 2.3, 0.34, 8, 64, 24), navy, 0, 2.38, 1.68);
  add(superBlob(6.68, 1.75, 0.34, 8, 64, 24), creamLight, 0, 2.38, 1.72);
  if (label) add(new THREE.PlaneGeometry(6.7, 1.6), vinyl('#ffffff', { map: signTexture(label), roughness: 0.6, transparent: true }), -0.05, 2.38, 1.9);
  for (const [x, y] of [[-3.07, 3.0], [3.07, 3.0], [-3.07, 1.77], [3.07, 1.77]]) {
    const stud = add(new THREE.SphereGeometry(0.21, 24, 14), coral, x, y, 1.89);
    stud.scale.z = 0.55;
  }

  // ---- tray with recess and two coin stacks ----
  const top = 4.64;
  add(superBlob(4.35, 0.55, 2.15, 8, 64, 20), navy, -0.95, top + 0.22, 0.5);
  add(superBlob(3.88, 0.2, 1.68, 8, 64, 16), navyDeep, -0.95, top + 0.42, 0.5);
  const coinStack = (x, n) => {
    for (let i = 0; i < n; i++) {
      const y = top + 0.32 + i * 0.32;
      add(roundedDisc(0.76, 0.31, 0.1), coral, x, y, 0.5);
      if (i === n - 1) {
        const face = add(new THREE.CircleGeometry(0.55, 40), creamLight, x, y + 0.312, 0.5);
        face.rotation.x = -Math.PI / 2;
      }
    }
  };
  coinStack(-1.86, 4);
  coinStack(-0.31, 2);

  // ---- till: navy base with a tapered cream block ----
  add(superBlob(2.25, 0.55, 1.4, 6, 40, 16), navy, 2.55, top + 0.2, 0.62);
  {
    const g = superBlob(1.9, 1.1, 1.08, 5, 40, 28);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const k = 1 - 0.12 * (pos.getY(i) / 0.55 + 1) / 2;     // narrower toward the top
      pos.setX(i, pos.getX(i) * k);
    }
    g.computeVertexNormals();
    add(g, cream, 2.55, top + 0.95, 0.6);
  }

  // ---- posts, corner blocks, sloped arms and knobs (one set per side) ----
  const ARM = 0.47; // radians the arm drops toward the front
  for (const sx of [-1, 1]) {
    const x = sx * 3.9;
    add(superBlob(0.77, 6.0, 0.75, 6, 24, 40), navy, x, 7.45, -0.96);
    add(superBlob(1.05, 1.32, 1.3, 3.6, 32, 32), navy, sx * 3.95, 9.96, -1.18);
    // knob on the front-outer corner of the post
    const knob = new THREE.Group();
    knob.position.set(x + sx * 0.33, 6.8, -0.68);
    knob.lookAt(x + sx * 3, 6.8, 2.5);
    knob.add(mesh(new THREE.TorusGeometry(0.33, 0.12, 16, 40), navy));
    const cap = mesh(new THREE.SphereGeometry(0.3, 28, 18), cream, 0, 0, 0.08);
    cap.scale.z = 0.65;
    knob.add(cap);
    root.add(knob);
  }

  // ---- awning: sloped striped roof, cream roll at the back, scalloped flaps at the front ----
  const N = 5, W = 7.8, SW = W / N, T = 0.3, L = 3.5, ROOF = 0.3;
  const roof = new THREE.Group();
  roof.position.set(0, 10.45, -1.2);   // back edge sits on the corner blocks
  roof.rotation.x = ROOF;
  root.add(roof);
  for (let i = 0; i < N; i++) {
    const xi = -W / 2 + SW * (i + 0.5);
    roof.add(mesh(new THREE.BoxGeometry(SW + 0.005, T, L), i % 2 ? coral : creamLight, xi, 0, L / 2));
  }
  const roll = mesh(new THREE.CapsuleGeometry(0.3, W - 0.6, 8, 28), creamLight, 0, 0.1, 0.05);
  roll.rotation.z = Math.PI / 2;
  roof.add(roll);
  // navy arms run directly under the roof edges at the same slope, from the corner blocks forward
  for (const sx of [-1, 1]) {
    roof.add(mesh(superBlob(0.77, 0.62, L - 0.45, 4, 24, 24), navy, sx * 3.95, -(T / 2 + 0.29), (L - 0.45) / 2 + 0.1));
  }
  // flaps hang from the roof's front edge, bottoms tucked slightly back
  const fy = 10.45 - Math.sin(ROOF) * L, fz = -1.2 + Math.cos(ROOF) * L;
  const flaps = new THREE.Group();
  flaps.position.set(0, fy, fz);
  flaps.rotation.x = 0.26;
  root.add(flaps);
  const STRAIGHT = 0.8;
  for (let i = 0; i < N; i++) {
    const xi = -W / 2 + SW * (i + 0.5);
    const m = i % 2 ? coral : creamLight;
    flaps.add(mesh(new THREE.BoxGeometry(SW + 0.005, STRAIGHT, T), m, xi, -STRAIGHT / 2, 0));
    const sc = mesh(new THREE.CylinderGeometry(SW / 2, SW / 2, T, 48, 1, false, -Math.PI / 2, Math.PI), m, xi, -STRAIGHT, 0);
    sc.rotation.x = Math.PI / 2;
    flaps.add(sc);
    // rounded fold where roof meets flap
    const fold = mesh(new THREE.CylinderGeometry(T / 2 + 0.01, T / 2 + 0.01, SW + 0.005, 24), m, xi, 0, 0);
    fold.rotation.z = Math.PI / 2;
    flaps.add(fold);
  }

  return { root };
}

// ---------------- Buddy's rocket ----------------
// Retro-futurist ship in brand colours. Nose along +X, canopy on top.
// userData: seat, fuelPort, flame, legs, setFlame(v, t), setLegs(v), groundY, tick(t)
export function createRocket({ scale = 1.5 } = {}) {
  const cream = vinyl('#F7EAD8', { roughness: 0.38, clearcoat: 0.5, clearcoatRoughness: 0.25 });
  const creamDark = vinyl('#E9D9C2', { roughness: 0.45 });
  const navy = vinyl('#1E2650', { roughness: 0.32, metalness: 0.25, clearcoat: 0.4 });
  const metal = vinyl('#2A3366', { roughness: 0.25, metalness: 0.7 });
  const coral = vinyl('#F07B55', { roughness: 0.32, clearcoat: 0.5 });
  const neonM = (c, k = 1.5) => { const m = new THREE.MeshBasicMaterial({ color: c, toneMapped: false }); m.color.multiplyScalar(k); return m; };
  const root = new THREE.Group();
  const ship = new THREE.Group();
  ship.scale.setScalar(scale);
  root.add(ship);

  // ---- fuselage: lathe profile along X, split into tail / body / nose sections ----
  const R = (x) => {             // radius at station x (tail -2.3 … nose tip 2.55)
    const pts = [[-2.3, 0.5], [-2.0, 0.66], [-1.4, 0.83], [-0.6, 0.9], [0.3, 0.9], [0.95, 0.84], [1.5, 0.7], [1.95, 0.5], [2.25, 0.3], [2.45, 0.13], [2.55, 0.0]];
    for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) {
      const [x0, r0] = pts[i - 1], [x1, r1] = pts[i]; const k = (x - x0) / (x1 - x0);
      const s = k * k * (3 - 2 * k); return r0 + (r1 - r0) * (0.5 * k + 0.5 * s);
    }
    return 0;
  };
  const section = (x0, x1, mat, n = 28) => {
    const pts = [];
    for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * (i / n); pts.push(new THREE.Vector2(Math.max(0.001, R(x)), x)); }
    const g = new THREE.LatheGeometry(pts, 64);
    g.rotateZ(-Math.PI / 2);
    return mesh(g, mat);
  };
  ship.add(section(-2.3, -1.38, navy, 16));
  const bodyMesh = section(-1.4, 1.52, cream, 60);
  ship.add(bodyMesh);
  ship.add(section(1.5, 2.55, coral, 24));
  const ring = (x, r, tube, mat) => { const m = mesh(new THREE.TorusGeometry(r, tube, 14, 72), mat, x, 0, 0); m.rotation.y = Math.PI / 2; ship.add(m); return m; };
  ring(1.51, R(1.51) + 0.01, 0.055, navy);
  ring(-1.39, R(-1.39) + 0.01, 0.055, coral);
  ring(0.95, R(0.95) + 0.004, 0.012, creamDark);      // panel lines
  ring(-0.55, R(-0.55) + 0.004, 0.012, creamDark);
  ring(2.27, R(2.27) + 0.008, 0.035, navy);            // nose tip band
  ring(-2.0, R(-2.0) + 0.012, 0.018, neonM('#7D8BFF'));

  // coral racing stripe along both flanks
  for (const sz of [-1, 1]) {
    const pts = [];
    for (let i = 0; i <= 30; i++) { const x = -1.3 + (2.75 * i) / 30; const r = R(x); pts.push(new THREE.Vector3(x, -0.28, sz * Math.sqrt(Math.max(0, r * r - 0.28 * 0.28)) * 1.004)); }
    ship.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.05, 10, false), coral));
  }
  // portholes
  for (const sz of [-1, 1]) for (const x of [-1.0, -0.62, -0.24]) {
    const r = R(x);
    const p = new THREE.Group();
    p.position.set(x, 0.12, sz * Math.sqrt(r * r - 0.0144) * 0.995);
    p.rotation.y = sz > 0 ? 0 : Math.PI;
    p.add(mesh(frontDisc(0.12, 0.05, 0.02), vinyl('#2B3A8A', { roughness: 0.1, clearcoat: 1 })));
    p.add(mesh(new THREE.TorusGeometry(0.12, 0.022, 8, 32), navy, 0, 0, 0.04));
    p.add(mesh(new THREE.TorusGeometry(0.12, 0.009, 8, 32), neonM('#7D8BFF'), 0, 0, 0.065));
    ship.add(p);
  }

  // ---- cockpit: opening cut into the fuselage, cream collar, dark tub, glass canopy on top ----
  const CX = 0.15, CY = 0.84, EX = 0.9, EZ = 0.6;   // sits over the widest part of the fuselage
  {
    // remove the fuselage skin inside the cockpit footprint so nothing covers the glass
    const g = bodyMesh.geometry, pos = g.attributes.position, idx = g.index.array, keep = [];
    for (let i = 0; i < idx.length; i += 3) {
      let cx = 0, cy = 0, cz = 0;
      for (let k = 0; k < 3; k++) { cx += pos.getX(idx[i + k]); cy += pos.getY(idx[i + k]); cz += pos.getZ(idx[i + k]); }
      cx /= 3; cy /= 3; cz /= 3;
      const inside = ((cx - CX) / (EX - 0.03)) ** 2 + (cz / (EZ - 0.03)) ** 2 < 1;
      if (!(inside && cy > 0.2)) keep.push(idx[i], idx[i + 1], idx[i + 2]);
    }
    g.setIndex(keep);
  }
  const collarH = CY - 0.2;
  const collar = mesh(new THREE.CylinderGeometry(1, 1, 1, 72, 1, true), new THREE.MeshPhysicalMaterial({ color: '#F7EAD8', roughness: 0.38, clearcoat: 0.5, side: THREE.DoubleSide }), CX, 0.2 + collarH / 2, 0);
  collar.scale.set(EX, collarH, EZ);
  ship.add(collar);
  const tub = mesh(new THREE.CylinderGeometry(1, 1, 1, 72, 1, true), new THREE.MeshStandardMaterial({ color: '#141A3C', roughness: 0.8, side: THREE.BackSide }), CX, 0.2 + collarH / 2, 0);
  tub.scale.set(EX - 0.03, collarH, EZ - 0.03);
  ship.add(tub);
  const floorC = mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshStandardMaterial({ color: '#10153A', roughness: 0.9 }), CX, 0.22, 0);
  floorC.rotation.x = -Math.PI / 2; floorC.scale.set(EX, EZ, 1);
  ship.add(floorC);
  const canopyGlass = new THREE.MeshPhysicalMaterial({ color: '#C4CCFF', transparent: true, opacity: 0.22, roughness: 0.02, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.4, depthWrite: false });
  const canopy = new THREE.Group();          // hinged at the rear edge of the rim
  canopy.position.set(CX - EX, CY + 0.02, 0);
  ship.add(canopy);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 56, 28, 0, Math.PI * 2, 0, Math.PI / 2), canopyGlass);
  dome.scale.set(EX, 0.98, EZ);
  dome.position.set(EX, -0.02, 0);
  dome.renderOrder = 3;
  canopy.add(dome);
  const canopyRim = mesh(new THREE.TorusGeometry(1, 0.035, 10, 96), navy, EX, -0.01, 0);
  canopyRim.rotation.x = Math.PI / 2; canopyRim.scale.set(EX, EZ, 1);
  canopy.add(canopyRim);
  const hinge = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 16), metal, 0, 0, 0);
  hinge.rotation.x = Math.PI / 2;
  ship.add(hinge); hinge.position.copy(canopy.position);
  const rim = mesh(new THREE.TorusGeometry(1, 0.065, 12, 96), navy, CX, CY, 0);
  rim.rotation.x = Math.PI / 2; rim.scale.set(EX, EZ, 1);
  ship.add(rim);
  const rimGlow = mesh(new THREE.TorusGeometry(1, 0.016, 8, 96), neonM('#7D8BFF'), CX, CY + 0.06, 0);
  rimGlow.rotation.x = Math.PI / 2; rimGlow.scale.set(EX + 0.02, EZ + 0.02, 1);
  ship.add(rimGlow);
  // two thin frame ribs that follow the glass
  for (const x of [-0.36, 0.36]) {
    const k = Math.sqrt(1 - (x / EX) ** 2);
    const rib = mesh(new THREE.TorusGeometry(1, 0.02, 8, 48, Math.PI), navy, EX + x, -0.02, 0);
    rib.rotation.y = Math.PI / 2;
    rib.scale.set(EZ * k * 1.01, 0.98 * k * 1.01, 1);
    canopy.add(rib);
  }
  const ladderTopL = new THREE.Vector3(CX, CY - 0.02, -EZ - 0.1);
  const ladderBaseL = new THREE.Vector3(CX, -1.4, -1.28);
  const ladder = new THREE.Group();
  ladder.position.copy(ladderTopL);
  {
    const d = ladderBaseL.clone().sub(ladderTopL), len = d.length();
    ladder.rotation.x = Math.atan2(-d.z, -d.y);
    for (const sx of [-0.2, 0.2]) {
      ladder.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, len, 10), navy, sx, -len / 2, 0));
      ladder.add(mesh(new THREE.SphereGeometry(0.045, 10, 8), coral, sx, 0.02, 0));
    }
    for (let y = 0.25; y < len - 0.1; y += 0.32) {
      const r = mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.4, 8), metal, 0, -y, 0);
      r.rotation.z = Math.PI / 2;
      ladder.add(r);
    }
    ladder.add(mesh(new THREE.TorusGeometry(0.2, 0.012, 6, 24), neonM('#7D8BFF'), 0, -len + 0.02, 0).rotateX(Math.PI / 2));
  }
  ship.add(ladder);
  const seat = new THREE.Object3D();
  seat.position.set(CX - 0.02, 0.16, 0);   // high enough that Buddy's whole head clears the rim
  ship.add(seat);
  // antenna with a blinking tip, behind the cockpit
  ship.add(mesh(new THREE.CylinderGeometry(0.018, 0.025, 0.5, 8), navy, -1.08, R(-1.08) + 0.2, 0));
  const beacon = mesh(new THREE.SphereGeometry(0.05, 12, 8), neonM('#FF7A52', 2), -1.08, R(-1.08) + 0.47, 0);
  ship.add(beacon);

  // ---- wings (swept), with coral tips and neon leading edges ----
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0.55, 0); wingShape.lineTo(-0.85, 1.3); wingShape.quadraticCurveTo(-1.05, 1.42, -1.3, 1.36); wingShape.lineTo(-1.35, 0); wingShape.closePath();
  const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.035, bevelSegments: 3, curveSegments: 12 });
  wingGeo.rotateX(Math.PI / 2);
  for (const sz of [-1, 1]) {
    const w = mesh(wingGeo, navy, 0, -0.22, sz * 0.62);
    if (sz < 0) w.scale.z = -1;
    w.material = navy;
    ship.add(w);
    // wingtip pod
    const tip = mesh(new THREE.CapsuleGeometry(0.09, 0.42, 6, 16), coral, -1.1, -0.27, sz * (0.62 + 1.36));
    tip.rotation.z = Math.PI / 2;
    ship.add(tip);
    ship.add(mesh(new THREE.SphereGeometry(0.045, 12, 8), neonM(sz > 0 ? '#57E39B' : '#FF5A3A', 2), -0.82, -0.27, sz * (0.62 + 1.36)));
    // neon leading edge
    const le = new THREE.LineCurve3(new THREE.Vector3(0.55, -0.24, sz * 0.66), new THREE.Vector3(-0.85, -0.24, sz * (0.62 + 1.3)));
    ship.add(mesh(new THREE.TubeGeometry(le, 8, 0.016, 6, false), neonM('#7D8BFF')));
    // booster under each wing
    const b = new THREE.Group();
    b.position.set(-1.05, -0.5, sz * 0.98);
    const body = mesh(new THREE.CapsuleGeometry(0.2, 0.9, 8, 24), cream, 0, 0, 0); body.rotation.z = Math.PI / 2; b.add(body);
    const cap = mesh(new THREE.SphereGeometry(0.205, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), coral, 0.45, 0, 0); cap.rotation.z = -Math.PI / 2; b.add(cap);
    const bn = mesh(new THREE.CylinderGeometry(0.15, 0.2, 0.22, 24, 1, true), metal, -0.72, 0, 0); bn.rotation.z = Math.PI / 2; b.add(bn);
    const band = mesh(new THREE.TorusGeometry(0.205, 0.02, 8, 32), navy, -0.25, 0, 0); band.rotation.y = Math.PI / 2; b.add(band);
    b.userData.booster = true;
    ship.add(b);
  }

  // ---- fins: tall dorsal fin + two angled ventral fins ----
  const finShape = new THREE.Shape();
  finShape.moveTo(-1.15, 0); finShape.lineTo(-1.95, 1.0); finShape.quadraticCurveTo(-2.15, 1.12, -2.35, 1.05); finShape.lineTo(-2.25, 0); finShape.closePath();
  const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 3, curveSegments: 10 });
  finGeo.translate(0, 0, -0.04);
  const dorsal = mesh(finGeo, navy, 0, 0.55, 0);
  ship.add(dorsal);
  ship.add(mesh(new THREE.CapsuleGeometry(0.055, 0.32, 6, 12), coral, -2.18, 1.6, 0).rotateZ(1.25));
  for (const sz of [-1, 1]) {
    const v = mesh(finGeo, navy, 0, -0.35, sz * 0.25);
    v.scale.set(1, 0.62, 1);
    v.rotation.x = sz * (Math.PI - 0.75);
    ship.add(v);
  }

  // ---- main engine bell ----
  const bellPts = [new THREE.Vector2(0.36, 0), new THREE.Vector2(0.42, -0.08), new THREE.Vector2(0.52, -0.3), new THREE.Vector2(0.6, -0.48), new THREE.Vector2(0.56, -0.5), new THREE.Vector2(0.46, -0.32), new THREE.Vector2(0.34, -0.06)];
  const bell = new THREE.LatheGeometry(bellPts, 48);
  bell.rotateZ(-Math.PI / 2);   // axis along X, opening toward -X
  const bellM = mesh(bell, metal, -2.25, 0, 0);
  ship.add(bellM);
  const core = mesh(new THREE.CircleGeometry(0.42, 40), neonM('#9AA6FF', 1.2), -2.62, 0, 0);
  core.rotation.y = -Math.PI / 2;
  ship.add(core);

  // ---- flames ----
  const flameMat = (c, k, o) => { const m = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }); m.color.multiplyScalar(k); return m; };
  const mkFlame = (r, len) => {
    const g = new THREE.Group();
    const a = new THREE.Mesh(new THREE.ConeGeometry(r, len, 32, 1, true), flameMat('#FF8A5C', 1.6, 0.8)); a.rotation.z = Math.PI / 2; a.position.x = -len / 2;
    const b = new THREE.Mesh(new THREE.ConeGeometry(r * 0.55, len * 0.6, 24, 1, true), flameMat('#FFF0D8', 1.9, 0.95)); b.rotation.z = Math.PI / 2; b.position.x = -len * 0.3;
    const c = new THREE.Mesh(new THREE.ConeGeometry(r * 1.25, len * 0.45, 32, 1, true), flameMat('#7D8BFF', 1.4, 0.35)); c.rotation.z = Math.PI / 2; c.position.x = -len * 0.22;
    g.add(a, b, c);
    return g;
  };
  const flame = new THREE.Group();
  const main = mkFlame(0.48, 2.2); main.position.x = -2.62; flame.add(main);
  for (const sz of [-1, 1]) { const f = mkFlame(0.15, 1.0); f.position.set(-1.9, -0.5, sz * 0.98); flame.add(f); }
  ship.add(flame);

  // ---- fuel port (faces -Z locally; the camera side when parked nose-left) ----
  const fuelPort = new THREE.Group();
  {
    const x = 0.95, r = R(x);
    fuelPort.position.set(x, -0.05, -r * 0.985);
    fuelPort.rotation.y = Math.PI;
    fuelPort.add(mesh(frontDisc(0.2, 0.06, 0.02), navy));
    fuelPort.add(mesh(new THREE.TorusGeometry(0.17, 0.022, 8, 32), neonM('#AFA9FF', 1.8), 0, 0, 0.07));
    ship.add(fuelPort);
  }

  // ---- landing gear: nose strut + two rear struts under the boosters ----
  const legs = new THREE.Group();
  for (const [x, y, z] of [[1.25, -0.62, 0], [-1.05, -0.7, 0.98], [-1.05, -0.7, -0.98]]) {
    const leg = new THREE.Group();
    leg.position.set(x, y, z);
    const L = 1.36 + y;   // strut reaches the pad
    leg.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, L, 12), metal, 0, -L / 2, 0));
    leg.add(mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.14, 12), navy, 0, -0.08, 0));
    leg.add(mesh(roundedDisc(0.17, 0.07, 0.03), navy, 0, y === -0.62 ? -0.78 : -0.7, 0));
    legs.add(leg);
  }
  ship.add(legs);

  let tt = 0;
  root.userData = {
    seat, fuelPort, flame, legs, ship,
    setFlame(v, t = 0) {
      flame.visible = v > 0.01;
      flame.children.forEach((f, i) => {
        const w = (0.85 + Math.sin(t * 40 + i) * 0.08 + Math.sin(t * 23 + i * 2) * 0.06);
        f.scale.set(v * w, 0.9 + Math.sin(t * 31 + i) * 0.06, 0.9 + Math.sin(t * 31 + i) * 0.06);
      });
      beacon.visible = Math.sin(t * 5) > 0;
    },
    setLegs(v) { legs.visible = v > 0.01; legs.scale.set(1, Math.max(0.001, v), 1); },
    setCanopy(v) { canopy.rotation.z = v * 1.75; },                 // 0 closed, 1 open
    setLadder(v) { ladder.visible = v > 0.01; ladder.scale.set(1, Math.max(0.001, v), 1); },
    // ship-local points for boarding (convert with ship.localToWorld)
    points: { ladderTop: ladderTopL, ladderBase: ladderBaseL, stand: new THREE.Vector3(CX - 0.02, 0.46, 0) },
    groundY: 1.4 * scale,
  };
  root.traverse((o) => { if (o.isMesh && o.material.toneMapped !== false && o !== dome) o.castShadow = true; });
  return { root };
}
