// Buddy — the Meloan I1 Soft Buddy mascot, modelled in code from the 3D reference sheets.
// Units: 1 unit = 100px of the 1254px reference sheets; feet rest on y = 0; he faces +Z.
// Soft vinyl-toy forms come from superellipsoids; the face (visor, eye, cheeks, smile) is
// painted onto the head surface so it follows the curvature like the reference renders.

import * as THREE from 'three';

export const BRAND = {
  navy: '#232845', cobalt: '#4256C8', coral: '#EE916E', lavender: '#EEEBF7', cream: '#FFF4DF',
};

// Sampled from the reference renders (lit tones), kept near the brand tokens.
const C = {
  cream: '#F7EAD8',
  navy: '#2B3762',
  navyLight: '#3A4777',
  navyDeep: '#1A2248',
  coral: '#FA7F5C',
  cheek: '#FB8F70',
  lilacRing: '#B3B0F8',
  lilacFace: '#9897F1',
};

export function vinyl(color, o = {}) {
  return new THREE.MeshPhysicalMaterial({
    color, roughness: 0.42, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.4, ...o,
  });
}

// Superellipsoid: a sphere pushed out toward a box. p = 2 is a sphere, higher = boxier.
export function superBlob(w, h, d, p = 4, ws = 72, hs = 56) {
  const g = new THREE.SphereGeometry(1, ws, hs);
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const s = Math.pow(Math.pow(Math.abs(v.x), p) + Math.pow(Math.abs(v.y), p) + Math.pow(Math.abs(v.z), p), -1 / p);
    pos.setXYZ(i, v.x * s * w / 2, v.y * s * h / 2, v.z * s * d / 2);
  }
  g.computeVertexNormals();
  return g;
}

// Rounded-edge disc on y = 0..h, axis +Y.
export function roundedDisc(r, h, bevel = Math.min(h * 0.45, r * 0.3), seg = 48) {
  const pts = [new THREE.Vector2(0, 0)];
  const arc = (cx, cy, a0, a1) => {
    for (let i = 0; i <= 8; i++) {
      const a = a0 + ((a1 - a0) * i) / 8;
      pts.push(new THREE.Vector2(cx + Math.cos(a) * bevel, cy + Math.sin(a) * bevel));
    }
  };
  arc(r - bevel, bevel, -Math.PI / 2, 0);
  arc(r - bevel, h - bevel, 0, Math.PI / 2);
  pts.push(new THREE.Vector2(0, h));
  return new THREE.LatheGeometry(pts, seg);
}
export function frontDisc(r, h, bevel) { const g = roundedDisc(r, h, bevel); g.rotateX(Math.PI / 2); return g; }

// A sleeve that widens toward the wrist, with rounded ends; axis -Y from 0 to -len.
function sleeve(r0, r1, len) {
  const pts = [new THREE.Vector2(0, 0.25)];
  for (let i = 0; i <= 8; i++) { const a = Math.PI / 2 - (i / 8) * Math.PI / 2; pts.push(new THREE.Vector2(Math.cos(a) * r0, Math.sin(a) * 0.25)); }
  for (let i = 1; i <= 10; i++) { const t = i / 10; pts.push(new THREE.Vector2(r0 + (r1 - r0) * Math.pow(t, 1.3), -len * t)); }
  pts.push(new THREE.Vector2(0, -len));
  const g = new THREE.LatheGeometry(pts.reverse(), 40);
  return g;
}

export function mesh(geo, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

// ---------------- the painted face ----------------
const HEAD = { w: 7.45, h: 4.75, d: 5.0, p: 3.9, cy: 7.5 };
const CW = 2048, CH = Math.round(2048 * HEAD.h / HEAD.w);
const toU = (x) => (x / HEAD.w + 0.5) * CW;
const toV = (y) => (0.5 - (y - HEAD.cy) / HEAD.h) * CH;
const S = CW / HEAD.w; // px per unit

const VISOR = { x: 0, y: 7.55, w: 5.15, h: 2.9, r: 0.78 };
const EYE = { x: 0, y: 7.55, r: 1.45, pupil: 0.8, hl: 0.38 };

function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function visorPath(ctx, grow = 0) {
  const w = (VISOR.w + grow * 2) * S, h = (VISOR.h + grow * 2) * S;
  rrect(ctx, toU(VISOR.x) - w / 2, toV(VISOR.y) - h / 2, w, h, (VISOR.r + grow) * S);
}

function paintEye(ctx, st, glowOnly) {
  const cx = toU(EYE.x) + st.look.x * 0.32 * S, cy = toV(EYE.y) - st.look.y * 0.22 * S;
  const R = EYE.r * S;
  ctx.save();
  visorPath(ctx, -0.04);
  ctx.clip();
  if (st.mood === 'happy') {
    ctx.lineCap = 'round';
    ctx.strokeStyle = glowOnly ? '#5577FF' : '#3561F2';
    ctx.lineWidth = 0.4 * S;
    ctx.beginPath();
    ctx.arc(cx, cy + R * 0.55, R * 0.82, Math.PI * 1.13, Math.PI * 1.87);
    ctx.stroke();
    ctx.restore();
    return;
  }
  ctx.beginPath();
  ctx.ellipse(cx, cy, R + 6, Math.max(3, (R + 6) * st.open), 0, 0, Math.PI * 2);
  ctx.clip();
  const g = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.4, R * 0.15, cx, cy, R);
  g.addColorStop(0, glowOnly ? '#4C74FF' : '#5B82FF');
  g.addColorStop(0.6, glowOnly ? '#2B55E8' : '#3561F2');
  g.addColorStop(1, glowOnly ? '#1D3DC0' : '#2448D2');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
  // subtle iris rays
  if (!glowOnly) {
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 6;
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * R * 0.6, cy + Math.sin(a) * R * 0.6);
      ctx.lineTo(cx + Math.cos(a) * R * 0.97, cy + Math.sin(a) * R * 0.97);
      ctx.stroke();
    }
  }
  const pr = (st.mood === 'worried' ? 0.84 : 1) * EYE.pupil * S;
  ctx.fillStyle = glowOnly ? '#000' : '#16224A';
  ctx.beginPath(); ctx.arc(cx, cy + (st.mood === 'worried' ? 10 : 0), pr, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath(); ctx.arc(cx + 0.86 * S, cy - 0.62 * S, EYE.hl * S, 0, Math.PI * 2); ctx.fill();
  if (st.mood === 'worried') {
    ctx.fillStyle = glowOnly ? '#000' : '#141C3F';
    ctx.beginPath();
    ctx.moveTo(cx - R - 20, cy - R * 0.2);
    ctx.lineTo(cx + R + 20, cy - R * 0.66);
    ctx.lineTo(cx + R + 20, cy - R - 40);
    ctx.lineTo(cx - R - 20, cy - R - 40);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

function paintFace(cv, st) {
  const { color, glow, rough, bump } = cv;
  // colour
  let c = color.ctx;
  c.fillStyle = C.cream; c.fillRect(0, 0, CW, CH);
  // inset shadow around the visor (reads as a recessed screen)
  c.save();
  c.filter = 'blur(10px)';
  c.fillStyle = 'rgba(120,96,70,0.35)';
  visorPath(c, 0.07); c.fill();
  c.restore();
  // screen
  const vg = c.createLinearGradient(0, toV(VISOR.y + VISOR.h / 2), 0, toV(VISOR.y - VISOR.h / 2));
  vg.addColorStop(0, '#22305E'); vg.addColorStop(0.45, '#18234A'); vg.addColorStop(1, '#121A3A');
  c.fillStyle = vg; visorPath(c); c.fill();
  // soft glassy sheen in the top-right of the screen
  c.save(); visorPath(c); c.clip();
  const sg = c.createRadialGradient(toU(1.8), toV(8.7), 10, toU(1.8), toV(8.7), 2.2 * S);
  sg.addColorStop(0, 'rgba(120,140,220,0.22)'); sg.addColorStop(1, 'rgba(120,140,220,0)');
  c.fillStyle = sg; c.fillRect(0, 0, CW, CH);
  c.restore();
  paintEye(c, st, false);
  // cheeks
  c.fillStyle = C.cheek;
  for (const sx of [-1, 1]) {
    c.save();
    c.filter = 'blur(1.5px)';
    c.beginPath();
    c.ellipse(toU(sx * 2.32), toV(5.98), 0.38 * S, 0.23 * S, 0, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }
  // mouth
  c.strokeStyle = '#1C2550'; c.lineWidth = 0.11 * S; c.lineCap = 'round';
  c.beginPath();
  const my = toV(5.83);
  if (st.mood === 'worried') {
    c.moveTo(toU(-0.3), my + 0.16 * S); c.quadraticCurveTo(toU(0), my - 0.02 * S, toU(0.3), my + 0.16 * S);
  } else {
    const w = st.mood === 'happy' ? 0.55 : 0.46;
    c.moveTo(toU(-w), my - 0.04 * S); c.quadraticCurveTo(toU(0), my + (st.mood === 'happy' ? 0.6 : 0.46) * S, toU(w), my - 0.04 * S);
  }
  c.stroke();

  // glow (emissive) — only the eye
  c = glow.ctx;
  c.fillStyle = '#000'; c.fillRect(0, 0, CW, CH);
  paintEye(c, st, true);

  // roughness (green channel): matte vinyl head, glossy screen
  if (!rough.done) {
    c = rough.ctx;
    c.fillStyle = 'rgb(118,118,118)'; c.fillRect(0, 0, CW, CH);
    c.fillStyle = 'rgb(28,28,28)'; visorPath(c); c.fill();
    // bump: the screen sits a little below the head surface with a soft lip
    c = bump.ctx;
    c.fillStyle = '#808080'; c.fillRect(0, 0, CW, CH);
    c.save(); c.filter = 'blur(6px)';
    c.fillStyle = '#9a9a9a'; visorPath(c, 0.05); c.fill();
    c.fillStyle = '#4a4a4a'; visorPath(c, -0.02); c.fill();
    c.restore();
    rough.done = true;
  }
}

// Planar-projected head: front triangles carry the painted face, the rest plain cream.
function headGeometry() {
  const g = superBlob(HEAD.w, HEAD.h, HEAD.d, HEAD.p, 128, 96);
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, pos.getX(i) / HEAD.w + 0.5, pos.getY(i) / HEAD.h + 0.5);
  }
  const idx = g.index.array;
  const front = [], rest = [];
  const zCut = HEAD.d / 2 * 0.45;
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i], b = idx[i + 1], c = idx[i + 2];
    const tri = [a, b, c];
    (pos.getZ(a) > zCut && pos.getZ(b) > zCut && pos.getZ(c) > zCut ? front : rest).push(...tri);
  }
  g.setIndex([...front, ...rest]);
  g.clearGroups();
  g.addGroup(0, front.length, 0);
  g.addGroup(front.length, rest.length, 1);
  return g;
}

// ---------------- build ----------------
export function createBuddy({ scale = 0.2 } = {}) {
  const M = {
    cream: vinyl(C.cream),
    navy: vinyl(C.navy, { roughness: 0.38 }),
    navyLight: vinyl(C.navyLight),
    navyDeep: vinyl(C.navyDeep, { roughness: 0.6, clearcoat: 0 }),
    coral: vinyl(C.coral, { roughness: 0.32 }),
    lilacRing: vinyl(C.lilacRing, { roughness: 0.35 }),
    lilacFace: vinyl(C.lilacFace, { roughness: 0.3 }),
  };

  const root = new THREE.Group();
  const rig = new THREE.Group();
  root.add(rig);
  root.scale.setScalar(scale);
  const BODY_Z = 0.6;

  // ---- body ----
  const torso = new THREE.Group();
  rig.add(torso);
  torso.add(mesh(superBlob(6.3, 3.4, 3.6, 3.8), M.cream, 0, 3.55, BODY_Z));

  const ports = {};
  const zFront = BODY_Z + 3.6 / 2 - 0.08;
  {
    const coral = new THREE.Group();
    coral.position.set(-1.47, 3.55, zFront);
    coral.add(mesh(frontDisc(1.22, 0.16, 0.06), M.navy));
    coral.add(mesh(frontDisc(1.15, 0.27, 0.11), M.coral));
    coral.add(mesh(frontDisc(0.86, 0.26, 0.05), M.navy));
    coral.add(mesh(frontDisc(0.82, 0.3, 0.08), M.cream));
    for (const [dx, dy] of [[-0.33, 0.3], [0.3, 0.12], [-0.1, -0.3]]) {
      const dot = mesh(new THREE.SphereGeometry(0.135, 20, 12), M.coral, dx, dy, 0.27);
      dot.scale.z = 0.5;
      coral.add(dot);
    }
    torso.add(coral);
    ports.coral = coral;

    const lilac = new THREE.Group();
    lilac.position.set(1.48, 3.55, zFront);
    lilac.add(mesh(frontDisc(1.22, 0.16, 0.06), M.navy));
    lilac.add(mesh(frontDisc(1.15, 0.27, 0.11), M.lilacRing));
    lilac.add(mesh(frontDisc(0.84, 0.25, 0.04), M.navy));
    lilac.add(mesh(frontDisc(0.8, 0.31, 0.12), M.lilacFace));
    torso.add(lilac);
    ports.lilac = lilac;
  }

  // ---- legs & feet ----
  const legs = [];
  for (const sx of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(sx * 2.0, 2.05, BODY_Z);
    hip.add(mesh(new THREE.CylinderGeometry(0.64, 0.64, 1.0, 36), M.navy, 0, -0.4, 0));
    const foot = new THREE.Group();
    foot.position.set(sx * 0.08, -2.05, 0.3);
    const dome = mesh(superBlob(2.72, 2.6, 3.2, 2.6, 64, 48), M.cream, 0, 0.5, 0);
    // keep only the upper half of the blob
    {
      const g = dome.geometry, pos = g.attributes.position;
      for (let i = 0; i < pos.count; i++) if (pos.getY(i) < 0) pos.setY(i, 0);
      g.computeVertexNormals();
    }
    foot.add(dome);
    const sole = mesh(roundedDisc(1, 0.56, 0.22, 56), M.navy, 0, 0, 0);
    sole.scale.set(1.42, 1, 1.68);
    foot.add(sole);
    hip.add(foot);
    rig.add(hip);
    legs.push(hip);
  }

  // ---- arms ----
  const arms = [];
  for (const sx of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(sx * 2.85, 4.42, BODY_Z - 0.05);
    const joint = mesh(roundedDisc(0.66, 0.6, 0.22), M.navy, 0, -0.3, 0);
    shoulder.add(joint);
    shoulder.add(mesh(sleeve(0.66, 0.8, 1.6), M.cream, 0, -0.2, 0));
    const cuff = mesh(new THREE.TorusGeometry(0.76, 0.15, 16, 48), M.navy, 0, -1.82, 0);
    cuff.rotation.x = Math.PI / 2;
    shoulder.add(cuff);
    shoulder.add(mesh(roundedDisc(0.8, 0.28, 0.1), M.navy, 0, -2.06, 0));
    const hand = new THREE.Group();
    hand.position.set(0, -2.6, 0);
    const mitt = mesh(superBlob(1.6, 1.7, 1.15, 2.7, 48, 36), M.navy, 0, -0.25, 0);
    hand.add(mitt);
    const thumb = mesh(new THREE.CapsuleGeometry(0.34, 0.46, 8, 20), M.navy, sx * 0.72, 0.12, 0.12);
    thumb.rotation.z = -sx * 0.75;
    hand.add(thumb);
    shoulder.add(hand);
    shoulder.userData.rest = sx * 0.8;
    shoulder.rotation.z = shoulder.userData.rest;
    shoulder.userData.hand = hand;
    rig.add(shoulder);
    arms.push(shoulder);
  }

  // ---- head (pivot at the neck) ----
  const neck = new THREE.Group();
  neck.position.set(0, 5.15, 0.75); // head sits forward over the feet, as in the side sheet
  rig.add(neck);
  const head = new THREE.Group();
  head.position.set(0, -5.15, -0.3);
  neck.add(head);

  const mkCanvas = () => { const cv = document.createElement('canvas'); cv.width = CW; cv.height = CH; return { cv, ctx: cv.getContext('2d') }; };
  const cvs = { color: mkCanvas(), glow: mkCanvas(), rough: mkCanvas(), bump: mkCanvas() };
  const tex = {};
  for (const k of Object.keys(cvs)) {
    tex[k] = new THREE.CanvasTexture(cvs[k].cv);
    tex[k].anisotropy = 8;
  }
  tex.color.colorSpace = THREE.SRGBColorSpace;
  tex.glow.colorSpace = THREE.SRGBColorSpace;
  const faceMat = vinyl('#ffffff', {
    // Keep the visor outline smooth: the painted inset supplies depth without
    // a steep bump-map ridge that produces rippled specular highlights.
    map: tex.color, roughness: 1, roughnessMap: tex.rough,
    emissive: '#ffffff', emissiveMap: tex.glow, emissiveIntensity: 0.22, clearcoat: 0.45, clearcoatRoughness: 0.25,
  });
  const headMesh = mesh(headGeometry(), [faceMat, M.cream], 0, HEAD.cy, 0);
  head.add(headMesh);

  // ears: oval headphone cups
  for (const sx of [-1, 1]) {
    const ear = new THREE.Group();
    ear.position.set(sx * 3.4, 7.25, -0.05);
    ear.rotation.z = sx * -Math.PI / 2;
    ear.scale.set(1.12, 1, 1);
    ear.add(mesh(roundedDisc(1.18, 1.05, 0.34), M.navy));
    ear.add(mesh(roundedDisc(0.82, 1.2, 0.18), M.navyLight));
    ear.add(mesh(roundedDisc(0.36, 1.24, 0.08), M.navyDeep));
    head.add(ear);
  }

  // top tab: navy arch with a coral pillow and two corner bumps
  head.add(mesh(superBlob(3.3, 1.15, 1.3, 4, 48, 32), M.navy, 0, 10.3, -0.1));
  head.add(mesh(superBlob(2.3, 0.78, 1.52, 3.4, 48, 32), M.coral, 0, 10.33, -0.1));
  for (const sx of [-1, 1]) {
    const knob = mesh(new THREE.SphereGeometry(0.46, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2), M.navy, sx * 1.72, 9.72, -0.1);
    knob.scale.set(1, 1.0, 1.3);
    head.add(knob);
  }

  // ---------- animation state ----------
  const st = {
    t: 0, mood: 'neutral', open: 1, look: { x: 0, y: 0 },
    nextBlink: 2.5, blinkT: -1, action: null, actionT: 0,
    walk: 0, walkPhase: 0, idle: 1, dirty: true, walkExternal: false,
    pose: { lz: 0, lx: 0, rz: 0, rx: 0, w: 0 }, head: { x: 0, y: 0 },
  };

  function redrawFace() {
    paintFace(cvs, st);
    for (const k of Object.keys(tex)) tex[k].needsUpdate = true;
  }
  redrawFace();

  const ease = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
  const bump = (x) => Math.sin(Math.min(Math.max(x, 0), 1) * Math.PI);
  const ACTIONS = { wave: 2.0, nod: 0.9, hop: 0.7, shake: 1.1 };

  function update(dt) {
    st.t += dt;
    const t = st.t;
    if (st.blinkT < 0 && t > st.nextBlink && st.mood !== 'happy') st.blinkT = 0;
    if (st.blinkT >= 0) {
      st.blinkT += dt;
      const p = st.blinkT / 0.16;
      st.open = p < 1 ? 1 - bump(p) * 0.95 : 1;
      if (p >= 1) { st.blinkT = -1; st.nextBlink = t + 3 + Math.random() * 3; }
      st.dirty = true;
    }
    if (st.dirty) { redrawFace(); st.dirty = false; }

    const sway = Math.sin((t / 5) * Math.PI * 2) * st.idle;
    rig.rotation.z = sway * 0.035;
    rig.position.y = Math.sin((t / 2.5) * Math.PI * 2) * 0.05 * st.idle;
    neck.rotation.set(0, 0, -sway * 0.02);
    arms.forEach((a, i) => { a.rotation.z = a.userData.rest + Math.sin(t * 1.3 + i) * 0.03 * st.idle; a.rotation.x = 0; });
    legs.forEach((l) => { l.rotation.x = 0; });

    if (st.walk > 0) {
      if (!st.walkExternal) st.walkPhase += dt * 6.5;
      const s = Math.sin(st.walkPhase) * st.walk;
      legs[0].rotation.x = s * 0.45; legs[1].rotation.x = -s * 0.45;
      arms[0].rotation.x = -s * 0.5; arms[1].rotation.x = s * 0.5;
      rig.position.y += Math.abs(Math.cos(st.walkPhase)) * 0.25 * st.walk;
      rig.rotation.z += s * 0.04;
    }

    // pose override (story-driven arm poses), blended by weight
    if (st.pose.w > 0) {
      const w = st.pose.w, L = arms[0], R = arms[1];
      L.rotation.z = THREE.MathUtils.lerp(L.rotation.z, st.pose.lz, w);
      L.rotation.x = THREE.MathUtils.lerp(L.rotation.x, st.pose.lx, w);
      R.rotation.z = THREE.MathUtils.lerp(R.rotation.z, st.pose.rz, w);
      R.rotation.x = THREE.MathUtils.lerp(R.rotation.x, st.pose.rx, w);
    }
    neck.rotation.x += st.head.x;
    neck.rotation.y += st.head.y;

    if (st.action) {
      st.actionT += dt;
      const p = st.actionT / ACTIONS[st.action];
      if (st.action === 'wave') {
        const up = ease(Math.min(1, p * 4)) * (1 - ease(Math.max(0, (p - 0.8) / 0.2)));
        const r = arms[1];
        r.rotation.z = THREE.MathUtils.lerp(r.userData.rest, 2.5, up) + Math.sin(st.actionT * 14) * 0.28 * up;
        neck.rotation.z += 0.08 * up;
      } else if (st.action === 'nod') {
        neck.rotation.x = Math.sin(p * Math.PI * 2) * 0.22 * (1 - p);
      } else if (st.action === 'hop') {
        rig.position.y += bump(p) * 1.6;
        arms[0].rotation.z += -bump(p) * 0.6;
        arms[1].rotation.z += bump(p) * 0.6;
      } else if (st.action === 'shake') {
        neck.rotation.y = Math.sin(p * Math.PI * 5) * 0.25 * (1 - p);
      }
      if (p >= 1) st.action = null;
    }
  }

  return {
    root,
    parts: { rig, neck, head, torso, arms, legs, ports },
    update,
    setMood(mood) { st.mood = mood; st.dirty = true; },
    setLook(x, y) { st.look.x = x; st.look.y = y; st.dirty = true; },
    play(action) { st.action = action; st.actionT = 0; },
    setWalk(v) { st.walk = v; },
    setWalkPhase(ph) { st.walkExternal = true; st.walkPhase = ph; },
    setPose(p) { Object.assign(st.pose, p); },
    setHead(x, y) { st.head.x = x; st.head.y = y; },
    setIdle(v) { st.idle = v; },
    get action() { return st.action; },
    get mood() { return st.mood; },
  };
}
