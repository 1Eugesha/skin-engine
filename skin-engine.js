/*!
 * SkinEngine — живой 3D-скин Minecraft для сайта.
 * (c) 1Eugesha · MIT License · https://github.com/1Eugesha/skin-engine
 *
 * Однофайловый движок без зависимостей на странице: skinview3d подгружается
 * с CDN автоматически. Подключи скрипт и вызови SkinEngine.mount(canvas, opts).
 */
function loadSkinview3d() {
  if (window.__sv3d) return window.__sv3d;
  window.__sv3d = new Promise((resolve, reject) => {
    if (window.skinview3d) return resolve(window.skinview3d);
    const s = document.createElement("script");
    s.src = "https://unpkg.com/skinview3d@3.1.0/bundles/skinview3d.bundle.js";
    s.crossOrigin = "anonymous";
    s.onload = () => resolve(window.skinview3d);
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return window.__sv3d;
}
function seDetectGPU() {
  if (window.__seGPU) return window.__seGPU;
  let tier = "hardware";
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl") || c.getContext("experimental-webgl");
    if (!gl) tier = "none";else {
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      const r = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || "") : "";
      if (/swiftshader|software|llvmpipe|basic render|microsoft basic|softpipe/i.test(r)) tier = "software";
      const lose = gl.getExtension("WEBGL_lose_context");
      if (lose) lose.loseContext();
    }
  } catch (e) {
    tier = "none";
  }
  window.__seGPU = tier;
  return tier;
}
const EMOTE_TPS = 20;
const EMOTE_WAIST = -12;
const EMOTE_TORSO_BEND = 0.7;
const EMOTE_UPPER = ["body", "head", "rightArm", "leftArm"];
const EMOTE_LEGS = ["rightLeg", "leftLeg"];
const EMOTE_LIMBS = ["head", "rightArm", "leftArm", "rightLeg", "leftLeg"];
const EMOTE_BENDABLE = ["rightArm", "leftArm", "rightLeg", "leftLeg"];
function sampleTrack(pts, t) {
  if (!pts || !pts.length) return 0;
  if (t <= pts[0][0]) return pts[0][1];
  const last = pts[pts.length - 1];
  if (t >= last[0]) return last[1];
  let lo = 0,
    hi = pts.length - 1;
  while (lo + 1 < hi) {
    const mid = lo + hi >> 1;
    if (pts[mid][0] <= t) lo = mid;else hi = mid;
  }
  const a = pts[lo],
    b = pts[hi];
  return a[1] + (b[1] - a[1]) * ((t - a[0]) / (b[0] - a[0] || 1));
}
function affine3(p0, q0, v0, p1, q1, v1, p2, q2, v2) {
  const det = p0 * (q1 - q2) - q0 * (p1 - p2) + (p1 * q2 - p2 * q1);
  if (Math.abs(det) < 1e-9) return [0, 0, v0];
  const a = (v0 * (q1 - q2) - q0 * (v1 - v2) + (v1 * q2 - v2 * q1)) / det;
  const b = (p0 * (v1 - v2) - v0 * (p1 - p2) + (p1 * v2 - p2 * v1)) / det;
  const c = (p0 * (q1 * v2 - q2 * v1) - q0 * (p1 * v2 - p2 * v1) + v0 * (p1 * q2 - p2 * q1)) / det;
  return [a, b, c];
}
const FACE_PLANE = [[1, 2], [1, 2], [0, 2], [0, 2], [0, 1], [0, 1]];
function buildFaceMaps(geo) {
  const pos = geo.attributes.position,
    uv = geo.attributes.uv;
  const maps = [];
  for (let f = 0; f < 6; f++) {
    const [ai, bi] = FACE_PLANE[f];
    const idx = [f * 4, f * 4 + 1, f * 4 + 2];
    const P = idx.map(i => [pos.getX(i), pos.getY(i), pos.getZ(i)]);
    const U = idx.map(i => [uv.getX(i), uv.getY(i)]);
    const co = p => [p[ai], p[bi]];
    const [u0, u1, u2] = U.map(u => u[0]);
    const [v0, v1, v2] = U.map(u => u[1]);
    const [a0, b0] = co(P[0]),
      [a1, b1] = co(P[1]),
      [a2, b2] = co(P[2]);
    const uMap = affine3(a0, b0, u0, a1, b1, u1, a2, b2, u2);
    const vMap = affine3(a0, b0, v0, a1, b1, v1, a2, b2, v2);
    maps.push({
      ai,
      bi,
      uMap,
      vMap
    });
  }
  return maps;
}
function evalFace(m, x, y, z) {
  const c = [x, y, z];
  const p = c[m.ai],
    q = c[m.bi];
  return [m.uMap[0] * p + m.uMap[1] * q + m.uMap[2], m.vMap[0] * p + m.vMap[1] * q + m.vMap[2]];
}
function makeHalfMesh(mesh, w, h, dp, maps, isUpper) {
  const halfGeo = new mesh.geometry.constructor(w, h / 2, dp);
  const yShift = isUpper ? h / 4 : -h / 4;
  const pos = halfGeo.attributes.position,
    uv = halfGeo.attributes.uv,
    nrm = halfGeo.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i),
      oy = pos.getY(i) + yShift,
      z = pos.getZ(i);
    const nx = nrm.getX(i),
      ny = nrm.getY(i),
      nz = nrm.getZ(i);
    let face = nx > 0.5 ? 0 : nx < -0.5 ? 1 : ny > 0.5 ? 2 : ny < -0.5 ? 3 : nz > 0.5 ? 4 : 5;
    const isCut = isUpper && face === 3 || !isUpper && face === 2;
    let u, v;
    if (isCut) {
      [u, v] = evalFace(maps[4], x, 0, z);
    } else {
      [u, v] = evalFace(maps[face], x, oy, z);
    }
    uv.setXY(i, u, v);
  }
  uv.needsUpdate = true;
  const m = mesh.clone();
  m.geometry = halfGeo;
  m.position.set(0, (isUpper ? h / 4 : -h / 4) * mesh.scale.y, 0);
  return m;
}
function makeJointCap(mesh, w, dp, maps) {
  const inset = 0.24;
  const capH = dp * 0.92;
  const geo = new mesh.geometry.constructor(w - inset, capH, dp - inset);
  const pos = geo.attributes.position,
    uv = geo.attributes.uv,
    nrm = geo.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i),
      y = pos.getY(i),
      z = pos.getZ(i);
    const nx = nrm.getX(i),
      ny = nrm.getY(i),
      nz = nrm.getZ(i);
    const face = nx > 0.5 ? 0 : nx < -0.5 ? 1 : ny > 0.5 ? 2 : ny < -0.5 ? 3 : nz > 0.5 ? 4 : 5;
    const [u, v] = face === 2 || face === 3 ? evalFace(maps[4], x, 0, z) : evalFace(maps[face], x, y, z);
    uv.setXY(i, u, v);
  }
  uv.needsUpdate = true;
  const m = mesh.clone();
  m.geometry = geo;
  m.position.set(0, 0, 0);
  return m;
}
function setupBend(obj) {
  if (!obj || obj.__bendJoint) return;
  const innerGrp = obj.children && obj.children[0];
  if (!innerGrp || !innerGrp.children) return;
  const meshes = innerGrp.children.slice();
  const GroupCls = Object.getPrototypeOf(obj.constructor);
  const joint = new GroupCls();
  const cap = new GroupCls();
  let limbLen = 0;
  for (const mesh of meshes) {
    if (!mesh.geometry || !mesh.geometry.attributes) continue;
    const pa = mesh.geometry.attributes.position;
    let mnx = 1e9,
      mny = 1e9,
      mnz = 1e9,
      mxx = -1e9,
      mxy = -1e9,
      mxz = -1e9;
    for (let i = 0; i < pa.count; i++) {
      mnx = Math.min(mnx, pa.getX(i));
      mxx = Math.max(mxx, pa.getX(i));
      mny = Math.min(mny, pa.getY(i));
      mxy = Math.max(mxy, pa.getY(i));
      mnz = Math.min(mnz, pa.getZ(i));
      mxz = Math.max(mxz, pa.getZ(i));
    }
    const w = mxx - mnx,
      h = mxy - mny,
      dp = mxz - mnz;
    limbLen = Math.max(limbLen, h * (mesh.scale ? mesh.scale.y : 1));
    const maps = buildFaceMaps(mesh.geometry);
    innerGrp.remove(mesh);
    innerGrp.add(makeHalfMesh(mesh, w, h, dp, maps, true));
    joint.add(makeHalfMesh(mesh, w, h, dp, maps, false));
    cap.add(makeJointCap(mesh, w, dp, maps));
  }
  innerGrp.add(joint);
  innerGrp.add(cap);
  obj.__bendJoint = joint;
  obj.__bendCap = cap;
  obj.__origMeshes = meshes;
  obj.__limbLen = limbLen;
}
function resetBend(obj) {
  if (!obj || !obj.__bendJoint) return;
  const innerGrp = obj.children && obj.children[0];
  if (!innerGrp) return;
  for (const ch of innerGrp.children.slice()) innerGrp.remove(ch);
  for (const m of obj.__origMeshes || []) innerGrp.add(m);
  obj.__bendJoint = null;
  obj.__bendCap = null;
  obj.__origMeshes = null;
}
function seSyncModel(sk) {
  const model = sk.modelType || "default";
  if (sk.__rigModel === model) return;
  sk.__rigModel = model;
  for (const n of ["rightArm", "leftArm"]) {
    try {
      resetBend(sk[n]);
      setupBend(sk[n]);
    } catch (e) {}
  }
}
function setupHipCap(obj) {
  if (!obj || obj.__hipCap) return null;
  const innerGrp = obj.children && obj.children[0];
  if (!innerGrp || !innerGrp.children) return null;
  let base = null,
    bw = 1e9;
  for (const mesh of innerGrp.children) {
    if (!mesh.isMesh || !mesh.geometry || !mesh.geometry.attributes) continue;
    const pa = mesh.geometry.attributes.position;
    let mnx = 1e9,
      mxx = -1e9;
    for (let i = 0; i < pa.count; i++) {
      mnx = Math.min(mnx, pa.getX(i));
      mxx = Math.max(mxx, pa.getX(i));
    }
    const w = (mxx - mnx) * (mesh.scale ? mesh.scale.x : 1);
    if (w < bw) {
      bw = w;
      base = mesh;
    }
  }
  if (!base) return null;
  const pa = base.geometry.attributes.position;
  let mnx = 1e9,
    mny = 1e9,
    mnz = 1e9,
    mxx = -1e9,
    mxy = -1e9,
    mxz = -1e9;
  for (let i = 0; i < pa.count; i++) {
    mnx = Math.min(mnx, pa.getX(i));
    mxx = Math.max(mxx, pa.getX(i));
    mny = Math.min(mny, pa.getY(i));
    mxy = Math.max(mxy, pa.getY(i));
    mnz = Math.min(mnz, pa.getZ(i));
    mxz = Math.max(mxz, pa.getZ(i));
  }
  const w = mxx - mnx,
    h = mxy - mny,
    dp = mxz - mnz;
  const maps = buildFaceMaps(base.geometry);
  const inset = 0.24,
    capH = dp * 0.9;
  const geo = new base.geometry.constructor(w - inset, capH, dp - inset);
  const pos = geo.attributes.position,
    uv = geo.attributes.uv,
    nrm = geo.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i),
      y = pos.getY(i),
      z = pos.getZ(i);
    const nx = nrm.getX(i),
      ny = nrm.getY(i),
      nz = nrm.getZ(i);
    const face = nx > 0.5 ? 0 : nx < -0.5 ? 1 : ny > 0.5 ? 2 : ny < -0.5 ? 3 : nz > 0.5 ? 4 : 5;
    const oy = mny + 0.02 + Math.max(0, y + capH / 2);
    const [u, v] = face === 2 || face === 3 ? evalFace(maps[4], x, mny + 0.02, z) : evalFace(maps[face], x, oy, z);
    uv.setXY(i, u, v);
  }
  uv.needsUpdate = true;
  const GroupCls = Object.getPrototypeOf(obj.constructor);
  const capGrp = new GroupCls();
  capGrp.position.set(0, mny * (base.scale ? base.scale.y : 1), 0);
  const m = base.clone();
  m.geometry = geo;
  m.position.set(0, 0, 0);
  capGrp.add(m);
  innerGrp.add(capGrp);
  obj.__hipCap = capGrp;
  return capGrp;
}
const SE_CAPE_SEGS = 8;
const SE_CAPE_GRAV = 55;
const SE_CAPE_FOLLOW = 95;
const SE_CAPE_DAMP = 10;
const SE_CAPE_RELDAMP = 14;
const SE_CAPE_WIND = 4;
const SE_CAPE_TILT = 10.8 * Math.PI / 180;
function setCapeRest(cape) {
  if (cape) cape.rotation.set(SE_CAPE_TILT, Math.PI, 0);
}
function fixCapeMaterials(cape) {
  if (!cape || !cape.traverse) return;
  cape.traverse(o => {
    if (!o.isMesh || !o.material) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      m.alphaTest = 0.5;
      m.transparent = false;
      m.depthWrite = true;
      if ("side" in m) m.side = 2;
      m.needsUpdate = true;
    }
    o.renderOrder = 2;
  });
}
function makeCapeSegment(mesh, w, segH, dp, maps, segCenterY, isTop, isBottom) {
  const geo = new mesh.geometry.constructor(w, segH, dp);
  const pos = geo.attributes.position,
    uv = geo.attributes.uv,
    nrm = geo.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i),
      ly = pos.getY(i),
      z = pos.getZ(i);
    const oy = segCenterY + ly;
    const nx = nrm.getX(i),
      ny = nrm.getY(i),
      nz = nrm.getZ(i);
    const face = nx > 0.5 ? 0 : nx < -0.5 ? 1 : ny > 0.5 ? 2 : ny < -0.5 ? 3 : nz > 0.5 ? 4 : 5;
    let u, v;
    if (face === 2 && !isTop) {
      [u, v] = evalFace(maps[4], x, segCenterY + segH / 2, z);
    } else if (face === 3 && !isBottom) {
      [u, v] = evalFace(maps[4], x, segCenterY - segH / 2, z);
    } else {
      [u, v] = evalFace(maps[face], x, oy, z);
    }
    uv.setXY(i, u, v);
  }
  uv.needsUpdate = true;
  const m = mesh.clone();
  m.geometry = geo;
  return m;
}
function setupCapeChain(player, N) {
  const cape = player.cape;
  if (!cape || cape.__segs || cape.__noChain) return cape && cape.__segs;
  let mesh = null;
  for (const ch of cape.children) if (ch.isMesh && ch.geometry) {
    mesh = ch;
    break;
  }
  if (!mesh) return null;
  try {
    const g = mesh.geometry;
    g.computeBoundingBox();
    const bb = g.boundingBox;
    const w = bb.max.x - bb.min.x,
      H = bb.max.y - bb.min.y,
      dp = bb.max.z - bb.min.z;
    const topY = bb.max.y,
      zOff = mesh.position.z,
      baseY = mesh.position.y + topY;
    const maps = buildFaceMaps(g);
    const GroupCls = Object.getPrototypeOf(cape.constructor);
    const segH = H / N;
    const segs = [];
    let parent = cape;
    for (let i = 0; i < N; i++) {
      const joint = new GroupCls();
      joint.position.set(0, i === 0 ? baseY : -segH, i === 0 ? zOff : 0);
      parent.add(joint);
      const segCenterY = topY - (i + 0.5) * segH;
      const sm = makeCapeSegment(mesh, w, segH, dp, maps, segCenterY, i === 0, i === N - 1);
      sm.position.set(0, -segH / 2, 0);
      joint.add(sm);
      segs.push(joint);
      parent = joint;
    }
    cape.remove(mesh);
    cape.__segs = segs;
    fixCapeMaterials(cape);
    attachCapeToTorso(player);
    return segs;
  } catch (e) {
    cape.__noChain = true;
    return null;
  }
}
function attachBackItem(player, obj) {
  const r = player.skin && player.skin.__rig;
  if (!obj || !r || !r.pivot || obj.__attached) return;
  if (obj.parent === r.pivot) {
    obj.__attached = true;
    return;
  }
  try {
    if (!obj.__restPos) obj.__restPos = [obj.position.x, obj.position.y, obj.position.z];
    r.pivot.add(obj);
    obj.position.set(obj.__restPos[0] - r.skinPos[0], obj.__restPos[1] - r.skinPos[1] - EMOTE_WAIST, obj.__restPos[2] - r.skinPos[2]);
    obj.__attached = true;
  } catch (e) {}
}
function attachCapeToTorso(player) {
  attachBackItem(player, player.cape);
}
function ensureRig(p) {
  const sk = p.skin;
  if (sk.__rig) return sk.__rig;
  const skinDef = {};
  for (const n of EMOTE_UPPER.concat(EMOTE_LEGS)) {
    if (sk[n]) skinDef[n] = [sk[n].position.x, sk[n].position.y, sk[n].position.z];
  }
  const GroupCls = Object.getPrototypeOf(sk.constructor);
  const pivot = new GroupCls();
  pivot.position.set(0, EMOTE_WAIST, 0);
  for (const n of EMOTE_UPPER) {
    const part = sk[n];
    if (!part) continue;
    sk.remove(part);
    part.position.y -= EMOTE_WAIST;
    pivot.add(part);
  }
  sk.add(pivot);
  for (const n of EMOTE_BENDABLE) {
    try {
      setupBend(sk[n]);
    } catch (e) {}
  }
  let hipCap = null;
  try {
    hipCap = setupHipCap(sk.body);
  } catch (e) {}
  sk.__rigModel = sk.modelType || "default";
  sk.__rig = {
    pivot,
    hipCap,
    skinDef,
    skinPos: [sk.position.x, sk.position.y, sk.position.z]
  };
  return sk.__rig;
}
function restPose(p) {
  if (!p || !p.skin) return;
  const sk = p.skin;
  const r = ensureRig(p);
  sk.rotation.set(0, 0, 0);
  sk.position.set(r.skinPos[0], r.skinPos[1], r.skinPos[2]);
  r.pivot.rotation.set(0, 0, 0);
  r.pivot.position.set(0, EMOTE_WAIST, 0);
  for (const n of EMOTE_UPPER.concat(EMOTE_LEGS)) {
    const part = sk[n];
    if (!part) continue;
    const off = EMOTE_UPPER.indexOf(n) >= 0 ? EMOTE_WAIST : 0;
    const d = r.skinDef[n];
    part.rotation.set(0, 0, 0);
    part.position.set(d[0], d[1] - off, d[2]);
    if (part.__bendJoint) part.__bendJoint.rotation.set(0, 0, 0);
    if (part.__bendCap) part.__bendCap.rotation.set(0, 0, 0);
  }
  if (r.hipCap) r.hipCap.rotation.set(0, 0, 0);
  if (p.cape) {
    setCapeRest(p.cape);
    if (p.cape.__segs) for (const j of p.cape.__segs) j.rotation.set(0, 0, 0);
  }
}
const SE_POS_FREE = 1.2;
const SE_POS_MAX = 2.4;
const SE_TORSO_LIM = 48;
function sePosLimit(v, c) {
  const dv = v - c;
  const a = dv < 0 ? -dv : dv;
  if (a <= SE_POS_FREE) return v;
  const range = SE_POS_MAX - SE_POS_FREE;
  const soft = SE_POS_FREE + range * Math.tanh((a - SE_POS_FREE) / range);
  return dv < 0 ? c - soft : c + soft;
}
const SE_LIMB_KEYS = {};
for (const n of EMOTE_LIMBS) SE_LIMB_KEYS[n] = {
  pitch: n + ".pitch",
  yaw: n + ".yaw",
  roll: n + ".roll",
  bend: n + ".bend",
  x: n + ".x",
  y: n + ".y",
  z: n + ".z"
};
function applyPose(sk, d, gvRaw) {
  const r = sk.__rig;
  if (!r) return;
  const gv = k => {
    const v = gvRaw(k);
    return isFinite(v) ? v : 0;
  };
  const clamp = (v, c, lim) => v > c + lim ? c + lim : v < c - lim ? c - lim : v;
  sk.rotation.order = "ZYX";
  sk.rotation.set(0, -gv("turn"), 0);
  sk.position.set(r.skinPos[0] + clamp(gv("torso.x"), 0, SE_TORSO_LIM), r.skinPos[1] - clamp(gv("torso.y"), 0, SE_TORSO_LIM), r.skinPos[2] - clamp(gv("torso.z"), 0, SE_TORSO_LIM));
  r.pivot.rotation.order = "ZYX";
  r.pivot.rotation.set(gv("torso.pitch") + gv("torso.bend") * EMOTE_TORSO_BEND, -gv("torso.yaw"), -gv("torso.roll"));
  r.pivot.position.set(gv("waist.x"), EMOTE_WAIST + gv("waist.y"), gv("waist.z"));
  if (r.hipCap) {
    r.hipCap.rotation.order = "ZYX";
    r.hipCap.rotation.set(-r.pivot.rotation.x / 2, -r.pivot.rotation.y / 2, -r.pivot.rotation.z / 2);
  }
  for (const n of EMOTE_LIMBS) {
    const obj = sk[n];
    if (!obj) continue;
    const def = r.skinDef[n] || [0, 0, 0];
    const off = EMOTE_UPPER.indexOf(n) >= 0 ? EMOTE_WAIST : 0;
    const K = SE_LIMB_KEYS[n];
    obj.rotation.order = "ZYX";
    obj.rotation.set(gv(K.pitch), -gv(K.yaw), -gv(K.roll));
    if (obj.__bendJoint) {
      const b = gv(K.bend);
      obj.__bendJoint.rotation.x = b;
      if (obj.__bendCap) obj.__bendCap.rotation.x = b / 2;
    }
    obj.position.set(sePosLimit(d.tracks[K.x] ? gv(K.x) : def[0], def[0]), sePosLimit(d.tracks[K.y] ? -gv(K.y) : def[1], def[1]) - off, sePosLimit(d.tracks[K.z] ? -gv(K.z) : def[2], def[2]));
  }
}
function applyEmoteTick(sk, d, t) {
  applyPose(sk, d, key => {
    const p = d.tracks[key];
    return p ? sampleTrack(p, t) : 0;
  });
}
const SE_ANGLE_RE = /\.(pitch|yaw|roll|bend)$/;
function isAngleKey(key) {
  return key === "turn" || SE_ANGLE_RE.test(key);
}
function smooth01(x) {
  return x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
}
function loopValue(d, key, realTick, end, ret, L) {
  const pts = d.tracks[key];
  if (!pts) return 0;
  if (!d.loop || L <= 0) return sampleTrack(pts, Math.min(realTick, d.stop));
  const phase = realTick <= end ? realTick : ret + (realTick - ret) % L;
  let v = sampleTrack(pts, phase);
  const B = Math.min(8, L * 0.45);
  const dEnd = end - phase;
  if (B > 0 && dEnd < B && realTick > ret) {
    let start = sampleTrack(pts, phase - L);
    if (isAngleKey(key)) {
      while (start - v > Math.PI) start -= 2 * Math.PI;
      while (start - v < -Math.PI) start += 2 * Math.PI;
    }
    const w = smooth01((B - dEnd) / B);
    v = v * (1 - w) + start * w;
  }
  return v;
}
function updateCape(self, player, dt, t) {
  const cape = player.cape,
    sk = player.skin;
  if (!sk || !sk.__rig) return;
  if (player.elytra && player.elytra.visible) attachBackItem(player, player.elytra);
  if (!cape || !cape.visible) return;
  const r = sk.__rig;
  attachCapeToTorso(player);
  let segs = cape.__segs;
  if (!segs && !cape.__noChain) segs = setupCapeChain(player, SE_CAPE_SEGS);
  const dts = dt || 0.016;
  const lean = r.pivot.rotation.x,
    roll = r.pivot.rotation.z;
  const py = sk.position.y,
    turn = sk.rotation.y;
  const leanV = self._cLean == null ? 0 : (lean - self._cLean) / dts;
  const rollV = self._cRoll == null ? 0 : (roll - self._cRoll) / dts;
  const turnV = self._cTurn == null ? 0 : (turn - self._cTurn) / dts;
  const yVel = self._cPY == null ? 0 : (py - self._cPY) / dts;
  self._cLean = lean;
  self._cRoll = roll;
  self._cTurn = turn;
  self._cPY = py;
  const tt = t || 0;
  const wind = Math.sin(tt * 1.6) * 0.5 + Math.sin(tt * 0.9 + 1.3) * 0.4 + Math.sin(tt * 3.0 + 0.6) * 0.2;
  const gust = Math.max(0, Math.sin(tt * 0.23 - 0.5));
  let angT = 0.05 + leanV * 0.05 + Math.abs(yVel) * 0.012;
  angT = Math.max(-0.05, Math.min(1.2, angT));
  let ang = self._cAng == null ? angT : self._cAng;
  let aV = self._cAV || 0;
  aV += (-90 * (ang - angT) - 16 * aV) * dts;
  ang += aV * dts;
  self._cAng = ang;
  self._cAV = aV;
  let zT = -turnV * 0.05 - rollV * 0.04;
  zT = Math.max(-0.5, Math.min(0.5, zT));
  let zA = self._cZ == null ? zT : self._cZ;
  let zV = self._cZV || 0;
  zV += (-90 * (zA - zT) - 16 * zV) * dts;
  zA += zV * dts;
  self._cZ = zA;
  self._cZV = zV;
  if (segs && segs.length) {
    setCapeRest(cape);
    const N = segs.length;
    if (!self._th || self._th.length !== N) {
      self._th = new Array(N).fill(0);
      self._om = new Array(N).fill(0);
      self._tz = new Array(N).fill(0);
      self._oz = new Array(N).fill(0);
    }
    const th = self._th,
      om = self._om,
      tz = self._tz,
      oz = self._oz;
    const windF = (Math.sin(tt * 2.0) * 0.6 + Math.sin(tt * 1.07 + 0.7) * 0.5) * SE_CAPE_WIND + gust * SE_CAPE_WIND;
    const windZ = (Math.sin(tt * 1.5 + 0.3) * 0.5 + Math.sin(tt * 0.83) * 0.4) * SE_CAPE_WIND * 0.6;
    th[0] = ang;
    tz[0] = zA;
    om[0] = 0;
    oz[0] = 0;
    const SUB = 2,
      h = Math.min(dts, 0.033) / SUB;
    for (let s = 0; s < SUB; s++) {
      for (let i = 1; i < N; i++) {
        const lvl = 0.4 + 0.6 * i / (N - 1);
        const gX = -SE_CAPE_GRAV * Math.sin(th[i]);
        const fX = SE_CAPE_FOLLOW * (th[i - 1] - th[i]);
        const rX = SE_CAPE_RELDAMP * (om[i] - om[i - 1]);
        const aX = gX + fX + windF * lvl - SE_CAPE_DAMP * om[i] - rX;
        om[i] = Math.max(-14, Math.min(14, om[i] + aX * h));
        th[i] = Math.max(-0.06, Math.min(1.3, th[i] + om[i] * h));
        const fZ = SE_CAPE_FOLLOW * 0.7 * (tz[i - 1] - tz[i]);
        const rZ = SE_CAPE_RELDAMP * (oz[i] - oz[i - 1]);
        const aZ = fZ - SE_CAPE_GRAV * 0.18 * tz[i] + windZ * lvl - SE_CAPE_DAMP * oz[i] - rZ;
        oz[i] = Math.max(-12, Math.min(12, oz[i] + aZ * h));
        tz[i] = Math.max(-0.6, Math.min(0.6, tz[i] + oz[i] * h));
      }
    }
    for (let i = 0; i < N; i++) {
      segs[i].rotation.x = -(th[i] - (i ? th[i - 1] : 0));
      segs[i].rotation.z = -(tz[i] - (i ? tz[i - 1] : 0));
    }
  } else {
    cape.rotation.set(SE_CAPE_TILT + Math.max(-0.05, Math.min(1.2, ang)), Math.PI, Math.max(-0.5, Math.min(0.5, zA)));
  }
}
function getEmotePlayerClass(sv) {
  if (window.__seAnimPlayer) return window.__seAnimPlayer;
  class EmotePlayer extends sv.PlayerAnimation {
    constructor(data) {
      super();
      this.data = data;
      this._lt = 0;
    }
    animate(player) {
      const d = this.data;
      if (!d || !player.skin || !player.skin.__rig) return;
      const t = this.progress;
      let dt = t - this._lt;
      this._lt = t;
      if (!(dt > 0) || dt > 0.1) dt = Math.min(Math.max(dt || 0, 0), 0.05);
      const realTick = t * EMOTE_TPS;
      const end = d.end || d.stop,
        ret = d.ret || 0,
        L = end - ret;
      applyPose(player.skin, d, key => loopValue(d, key, realTick, end, ret, L));
      updateCape(this, player, dt, t);
    }
  }
  window.__seAnimPlayer = EmotePlayer;
  return EmotePlayer;
}
const SE_RED = {
  r: 0.95,
  g: 0.12,
  b: 0.10
};
function eachSkinMaterial(player, fn) {
  const sk = player && player.skin;
  if (!sk || !sk.traverse) return;
  sk.traverse(o => {
    if (!o.isMesh || !o.material) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) fn(m);
  });
}
function fixTransparency(player) {
  eachSkinMaterial(player, m => {
    if (m.transparent) {
      m.alphaTest = 0.5;
      m.transparent = false;
      m.depthWrite = true;
      m.polygonOffset = true;
      m.polygonOffsetFactor = -1;
      m.polygonOffsetUnits = -1;
      m.needsUpdate = true;
    }
  });
}
function applyDamageTint(player, amt) {
  eachSkinMaterial(player, m => {
    if (m.color) {
      if (!m.__seBase) m.__seBase = {
        r: m.color.r,
        g: m.color.g,
        b: m.color.b
      };
      const b = m.__seBase,
        k = amt * 0.6;
      m.color.r = b.r + (SE_RED.r - b.r) * k;
      m.color.g = b.g + (SE_RED.g - b.g) * k;
      m.color.b = b.b + (SE_RED.b - b.b) * k;
    }
    if (m.emissive) m.emissive.setRGB(amt * 0.42, amt * 0.02, 0);
  });
}
function resetDamageTint(player) {
  eachSkinMaterial(player, m => {
    if (m.color && m.__seBase) {
      m.color.r = m.__seBase.r;
      m.color.g = m.__seBase.g;
      m.color.b = m.__seBase.b;
    }
    if (m.emissive) m.emissive.setRGB(0, 0, 0);
  });
}
// ============================================================================
//  Встроенные анимации персонажа: базовый idle-цикл (дыхание), случайные
//  «оживители» idle_sub_1..3 (раз в ~8 с) и interact — отклик на клик.
//  Треки — в родном формате движка (тики/радианы), waist.* — смещение
//  верха тела в осях three (см. applyPose).
// ============================================================================
// Анимации персонажа подключаются отдельным файлом skin-engine.anims.js
// (window.SkinEngineAnims). Без него движок использует простой встроенный
// idle-цикл дыхания (fallback ниже) — оживители и interact недоступны.
const SE_FALLBACK_ANIMS = { idle: { loop: true, begin: 0, end: 60, ret: 0, stop: 60, tracks: {
  'waist.y': [[0, -0.5], [30, -0.2], [60, -0.5]],
  'head.pitch': [[0, 0.01], [30, -0.03], [60, 0.01]],
  'rightArm.pitch': [[0, 0.03], [30, -0.04], [60, 0.03]],
  'leftArm.pitch': [[0, 0.03], [30, -0.04], [60, 0.03]],
  'rightArm.roll': [[0, 0.02], [30, 0.05], [60, 0.02]],
  'leftArm.roll': [[0, -0.02], [30, -0.05], [60, -0.02]]
} } };
function seAnims() {
  return (typeof window !== 'undefined' && window.SkinEngineAnims) || SE_FALLBACK_ANIMS;
}
const SE_SUBS = ['idle_sub_1', 'idle_sub_2', 'idle_sub_3'];

// ============================================================================
//  SEMixer — единый аниматор с кроссфейдом «источников поз»: каждый режим
//  (idle / walk / stand / анимация) отдаёт карту каналов позы в смещениях от
//  стойки покоя, микшер плавно перетекает между текущим источником и снимком
//  предыдущей позы — конечности никогда не телепортируются.
// ============================================================================

const SE_POSKEY_RE = /^(head|rightArm|leftArm|rightLeg|leftLeg)\.([xyz])$/;
const SE_POSKEY_CACHE = {};
function sePosKeyInfo(key) {
  let m = SE_POSKEY_CACHE[key];
  if (m === undefined) m = SE_POSKEY_CACHE[key] = SE_POSKEY_RE.exec(key);
  return m;
}
function seDefFor(rig, m) {
  const def = rig && rig.skinDef[m[1]];
  if (!def) return 0;
  return m[2] === "x" ? def[0] : m[2] === "y" ? -def[1] : -def[2];
}
function seSnapshotSource(pose) {
  const snap = Object.assign({}, pose || {});
  return { kind: "snapshot", sample(st, player, t, dt, out) { for (const k in snap) out[k] = snap[k]; } };
}
function seStandSource() { return { kind: "stand", sample() {} }; }
function seIdleSource(stage) {
  const subs = !stage || !stage.cfg || stage.cfg.gestures !== false;
  let nextSubAt = 4 + Math.random() * 4;
  return {
    kind: "idle",
    sample(st, player, t, dt, out) {
      const d = seAnims().idle;
      const end = d.end || d.stop;
      const realTick = t * EMOTE_TPS;
      for (const key in d.tracks) out[key] = loopValue(d, key, realTick, end, 0, end);
      const dmg = st._ctx.damage || 0;
      const shake = dmg > 0 ? Math.sin(t * 46) * dmg : 0;
      const lk = st._lookCur || { yaw: 0, pitch: 0 };
      out["torso.x"] = (out["torso.x"] || 0) + shake * 0.6;
      out["torso.roll"] = (out["torso.roll"] || 0) + shake * 0.03;
      out["torso.yaw"] = (out["torso.yaw"] || 0) + lk.yaw * 0.14;
      out["head.yaw"] = (out["head.yaw"] || 0) + lk.yaw * 0.85;
      out["head.pitch"] = (out["head.pitch"] || 0) + lk.pitch * 0.8;
      out["head.roll"] = (out["head.roll"] || 0) + shake * 0.04;
      if (subs && t >= nextSubAt) {
        nextSubAt = t + 8;
        st._playSub();
      }
    }
  };
}
function seWalkSource(stage) {
  return {
    kind: "walk",
    sample(st, player, t, dt, out) {
      const w = t * 6.4, sw = Math.sin(w), cw = Math.cos(w);
      const lk = st._lookCur || { yaw: 0, pitch: 0 };
      out["rightLeg.pitch"] = sw * 0.72;
      out["leftLeg.pitch"] = -sw * 0.72;
      out["rightLeg.bend"] = Math.max(0, -cw) * 0.8;
      out["leftLeg.bend"] = Math.max(0, cw) * 0.8;
      out["rightArm.pitch"] = -sw * 0.6;
      out["leftArm.pitch"] = sw * 0.6;
      out["rightArm.bend"] = -0.28;
      out["leftArm.bend"] = -0.28;
      out["rightArm.roll"] = -0.04;
      out["leftArm.roll"] = 0.04;
      out["torso.y"] = 0.45 - Math.abs(cw) * 0.9;
      out["torso.pitch"] = 0.06 + Math.sin(w * 2) * 0.012;
      out["torso.yaw"] = sw * 0.05 + lk.yaw * 0.1;
      out["head.pitch"] = -0.02 + lk.pitch * 0.6;
      out["head.yaw"] = lk.yaw * 0.7;
    }
  };
}
function seEmoteSource(stage, d) {
  return {
    kind: "emote", data: d, done: false,
    sample(st, player, t, dt, out) {
      const realTick = t * EMOTE_TPS;
      const end = d.end || d.stop, ret = d.ret || 0, L = end - ret;
      const rig = player.skin.__rig;
      for (const key in d.tracks) {
        let v = loopValue(d, key, realTick, end, ret, L);
        const m = sePosKeyInfo(key);
        if (m) v -= seDefFor(rig, m);
        out[key] = v;
      }
      if (!d.loop && !this.done && realTick >= (d.stop || end || 0)) {
        this.done = true;
        st._onEmoteEnd();
      }
    }
  };
}
function getMixerClass(sv) {
  if (window.__seMixer) return window.__seMixer;
  class SEMixer extends sv.PlayerAnimation {
    constructor(stage) { super(); this.st = stage; this._t = 0; }
    animate(player) {
      const t = this.progress;
      let dt = t - this._t; this._t = t;
      if (!(dt > 0) || dt > 0.1) dt = Math.min(Math.max(dt || 0, 0), 0.05);
      try { this.st._tick(player, t, dt); } catch (e) {}
    }
  }
  window.__seMixer = SEMixer;
  return SEMixer;
}
function seEaseOutBack(u) { const c = 2.0, x = u - 1; return 1 + (c + 1) * x * x * x + c * x * x; }
function seEaseInOutCubic(u) { return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; }
const SE_DEFAULTS = {
  width: 300,
  height: 420,
  fov: 45,
  zoom: 0.66,
  idle: true,
  gestures: true,
  nameTag: null,
  nameTagHeight: 21.5,
  pixelRatio: 0,
  interactive: true,
  xfade: 0.45,
  lookFollow: true,
  intro: true,
  initialYaw: 0.14,
  skinSwapFx: true,
  spinDur: 0.72,
  lights: true,
  clickMaxEnergy: 5,
  clickEnergyPerHit: 1,
  clickDecay: 2,
  damageFlash: 0.7,
  damageDecay: 3.5,
  tapMoveThreshold: 6,
  tapTimeThreshold: 400
};
class SkinStage {
  constructor(canvas, opts) {
    this.canvas = canvas;
    this.cfg = Object.assign({}, SE_DEFAULTS, opts || {});
    this.mode = "loading";
    this._ctx = { damage: 0 };
    this._lastSub = null;
    this._listeners = {};
    this._detach = null;
    this._mixer = null;
    this._src = null;
    this._prev = null;
    this._fadeT = 0;
    this._fadeDur = 1;
    this._lastPose = {};
    this._capeSt = {};
    this._fx = { intro: null, spin: null, popT: null };
    this._lookTgt = { yaw: 0, pitch: 0, w: 0 };
    this._lookCur = { yaw: 0, pitch: 0 };
    this._lookDetach = null;
    this._skinLoaded = false;
    this._imp = { energy: 0, phase: 0 };
    this._flashCd = 0;
    this._dmgWas = false;
    this._lookRect = null;
    this._lookRectAt = 0;
    this.ready = this._init();
    this.ready.catch(() => {});
  }
  async _init() {
    this.gpu = seDetectGPU();
    if (this.gpu === "none") throw new Error("WebGL unavailable");
    const sv = await loadSkinview3d();
    this.sv = sv;
    const c = this.cfg;
    this.viewer = new sv.SkinViewer({
      canvas: this.canvas,
      width: c.width,
      height: c.height
    });
    this.viewer.fov = c.fov;
    this.viewer.zoom = c.zoom;
    this.viewer.autoRotate = false;
    try {
      const dpr = typeof window !== "undefined" && window.devicePixelRatio || 1;
      let pr = this.cfg.pixelRatio;
      if (!(pr > 0)) pr = this.gpu === "software" ? 1 : Math.min(Math.max(dpr, 1.5), 2.5);
      this.viewer.renderer.setPixelRatio(pr);
    } catch (e) {}
    try {
      const ctrl = this.viewer.controls;
      ctrl.enableZoom = false;
      ctrl.enableDamping = true;
      ctrl.dampingFactor = 0.08;
      ctrl.rotateSpeed = 0.65;
    } catch (e) {}
    if (this.cfg.nameTag) this.setNameTag(this.cfg.nameTag);
    if (this.cfg.skin) await this.setSkin(this.cfg.skin);
    return this;
  }
  setNameTag(name) {
    if (!this.viewer) return this;
    this._tagName = name == null || name === "" ? null : String(name);
    const apply = () => {
      try {
        if (!this._tagName) {
          this.viewer.nameTag = null;
          return;
        }
        const NT = this.sv && this.sv.NameTagObject;
        const tag = NT ? new NT(this._tagName, { font: "48px Minecraft, Minecraftia, monospace" }) : this._tagName;
        this.viewer.nameTag = tag;
        const obj = this.viewer.nameTag;
        if (obj && obj.position) obj.position.y = this.cfg.nameTagHeight || 23;
      } catch (e) {}
    };
    apply();
    try {
      if (document.fonts && document.fonts.load) {
        const want = this._tagName;
        document.fonts.load("48px Minecraft").then(() => {
          if (this.viewer && want && this._tagName === want) apply();
        }).catch(() => {});
      }
    } catch (e) {}
    return this;
  }
  async setSkin(url) {
    if (!this.viewer) await this.ready;
    if (this._skinLoaded && this.cfg.skinSwapFx !== false) {
      this._fx.spin = { t: 0, dur: this.cfg.spinDur || 0.72, url, fired: false, popped: false };
      this._emit("skinchange", url);
      return this;
    }
    await this.viewer.loadSkin(url);
    const p = this.viewer.playerObject;
    ensureRig(p);
    seSyncModel(p.skin);
    restPose(p);
    fixTransparency(p);
    this._skinLoaded = true;
    if (this.cfg.cape) this.setCape(this.cfg.cape);
    if (this.cfg.interactive) this._attachInteraction();
    if (this.cfg.lookFollow !== false) this._attachLook();
    if (this.cfg.lights !== false) this._tuneLights();
    if (this.cfg.idle) this.idle();else this.stand();
    if (this.cfg.intro !== false) this._fx.intro = { t: 0, dur: 1.05 };
    this._emit("ready", this);
    return this;
  }
  setCape(url) {
    if (!this.viewer || !url) return this;
    try {
      const r = this.viewer.loadCape(url, {
        backEquipment: "cape"
      });
      const p = this.viewer.playerObject;
      const fix = () => {
        if (p && p.cape) {
          setCapeRest(p.cape);
          fixCapeMaterials(p.cape);
        }
      };
      if (r && r.then) r.then(fix, () => {});else fix();
    } catch (e) {}
    return this;
  }
  clearCape() {
    if (this.viewer) {
      try {
        this.viewer.resetCape();
      } catch (e) {}
    }
    return this;
  }
  setElytra(url) {
    if (!this.viewer || !url) return this;
    try {
      const r = this.viewer.loadCape(url, { backEquipment: "elytra" });
      const p = this.viewer.playerObject;
      const fix = () => {
        try {
          attachBackItem(p, p.elytra);
        } catch (e) {}
      };
      if (r && r.then) r.then(fix, () => {});else fix();
    } catch (e) {}
    return this;
  }
  setEars(url) {
    if (!this.viewer || !url) return this;
    try {
      this.viewer.loadEars(url);
    } catch (e) {}
    return this;
  }
  snapshot(type, quality) {
    if (!this.viewer || !this.canvas) return null;
    try {
      this.viewer.render();
      return this.canvas.toDataURL(type || "image/png", quality);
    } catch (e) {
      return null;
    }
  }
  idle() {
    if (!this.viewer) return this;
    this._transition(seIdleSource(this), this.cfg.xfade);
    this._setControls(true);
    this.mode = "idle";
    return this;
  }
  stand() {
    if (!this.viewer) return this;
    this._transition(seStandSource(), 0.35);
    this._setControls(true);
    this.mode = "stand";
    return this;
  }
  walk() {
    if (!this.viewer) return this;
    this._transition(seWalkSource(this), this.cfg.xfade);
    this._setControls(true);
    this.mode = "walk";
    return this;
  }
  play(data) {
    if (!this.viewer || !data) return this;
    this._transition(seEmoteSource(this, data), Math.min(this.cfg.xfade, 0.4));
    this._setControls(true);
    this.mode = "emote";
    return this;
  }
  stop() {
    return this.idle();
  }
  _onEmoteEnd() {
    this._emit("emoteend");
    if (this.cfg.idle !== false) this.idle();else this.stand();
  }
  _ensureMixer() {
    if (!this.viewer) return;
    if (this._mixer && this.viewer.animation === this._mixer) return;
    this._mixer = new (getMixerClass(this.sv))(this);
    this.viewer.animation = this._mixer;
  }
  _transition(src, dur) {
    this._ensureMixer();
    if (this._src) {
      this._prev = seSnapshotSource(this._lastPose);
      this._fadeT = 0;
      this._fadeDur = Math.max(0.01, dur == null ? 0.45 : dur);
    } else this._prev = null;
    src.t0 = null;
    this._src = src;
  }
  _tick(player, t, dt) {
    const sk = player.skin;
    if (!sk || !sk.__rig) return;
    const ctx = this._ctx,
      cfg = this.cfg;
    if (ctx.damage > 0) ctx.damage = Math.max(0, ctx.damage - dt * (cfg.damageDecay || 3.5));
    if (this._flashCd > 0) this._flashCd -= dt;
    const lt = this._lookTgt,
      lc = this._lookCur;
    const lb = 1 - Math.exp(-dt * 6.5);
    lc.yaw += (lt.yaw * lt.w - lc.yaw) * lb;
    lc.pitch += (lt.pitch * lt.w - lc.pitch) * lb;
    let p = 1;
    if (this._prev) {
      this._fadeT += dt;
      p = smooth01(this._fadeT / this._fadeDur);
      if (p >= 1) {
        this._prev = null;
        p = 1;
      }
    }
    const pose = {};
    const cur = this._src;
    if (cur) {
      if (cur.t0 == null) cur.t0 = t;
      const o = {};
      cur.sample(this, player, t - cur.t0, dt, o);
      for (const k in o) pose[k] = o[k] * p;
    }
    if (this._prev) {
      const o = {};
      this._prev.sample(this, player, 0, dt, o);
      for (const k in o) pose[k] = (pose[k] || 0) + o[k] * (1 - p);
    }
    this._lastPose = pose;
    const rig = sk.__rig;
    applyPose(sk, { tracks: pose }, (k) => {
      const v = pose[k] || 0;
      const m = sePosKeyInfo(k);
      return m ? v + seDefFor(rig, m) : v;
    });
    sk.rotation.y += cfg.initialYaw || 0;
    let scl = 1;
    const fx = this._fx;
    if (fx.intro) {
      fx.intro.t += dt;
      const u = Math.min(1, fx.intro.t / fx.intro.dur);
      const e = 1 - Math.pow(1 - u, 3);
      sk.position.y += (1 - e) * 26;
      sk.rotation.y += (1 - e) * -0.6;
      scl *= 0.9 + 0.1 * seEaseOutBack(u);
      if (u >= 1) fx.intro = null;
    }
    if (fx.spin) {
      const s = fx.spin;
      s.t += dt;
      const u = Math.min(1, s.t / s.dur);
      sk.rotation.y += seEaseInOutCubic(u) * Math.PI * 2;
      sk.position.y += Math.sin(u * Math.PI) * 3.2;
      if (!s.fired && u >= 0.3) {
        s.fired = true;
        this._swapSkin(s.url);
      }
      if (!s.popped && u >= 0.55) {
        s.popped = true;
        fx.popT = 0;
      }
      if (u >= 1) fx.spin = null;
    }
    if (fx.popT != null) {
      fx.popT += dt;
      const pu = fx.popT / 0.34;
      if (pu >= 1) fx.popT = null;else scl *= 1 + Math.sin(pu * Math.PI) * 0.06;
    }
    let sclX = 1,
      sclY = 1;
    const imp = this._imp;
    if (imp.energy > 0) {
      imp.energy = Math.max(0, imp.energy - (cfg.clickDecay || 2) * dt);
      imp.phase += dt * (18 + imp.energy * 7);
      const inten = imp.energy / (cfg.clickMaxEnergy || 5);
      const shake = Math.sin(imp.phase) * inten;
      const squash = Math.abs(Math.sin(imp.phase * 1.7)) * inten;
      sk.position.x += shake * 0.6;
      sk.rotation.z += shake * 0.055;
      sclX = 1 + squash * 0.018;
      sclY = 1 - squash * 0.025;
    }
    try {
      player.scale.set(scl * sclX, scl * sclY, scl);
    } catch (e) {}
    const dmgNow = ctx.damage || 0;
    if (dmgNow > 0 || this._dmgWas) applyDamageTint(player, dmgNow);
    this._dmgWas = dmgNow > 0;
    updateCape(this._capeSt, player, dt, t);
  }
  _swapSkin(url) {
    try {
      const r = this.viewer.loadSkin(url);
      const fin = () => {
        try {
          const p = this.viewer.playerObject;
          ensureRig(p);
          seSyncModel(p.skin);
          fixTransparency(p);
        } catch (e) {}
        this._emit("skin", url);
      };
      if (r && r.then) r.then(fin, () => {});else fin();
    } catch (e) {}
  }
  _attachLook() {
    if (this._lookDetach) return;
    const mv = (e) => {
      const c = this.canvas;
      if (!c) return;
      const now = performance.now();
      let r = this._lookRect;
      if (!r || now - this._lookRectAt > 400) {
        r = this._lookRect = c.getBoundingClientRect();
        this._lookRectAt = now;
      }
      if (!r.width || !r.height) return;
      const cx = r.left + r.width / 2,
        cy = r.top + r.height * 0.28;
      const dx = (e.clientX - cx) / r.width,
        dy = (e.clientY - cy) / r.height;
      const dist = Math.hypot(dx, dy);
      this._lookTgt.w = Math.max(0, 1 - Math.max(0, dist - 1.1) / 1.8);
      this._lookTgt.yaw = Math.max(-0.55, Math.min(0.55, dx * 1.05));
      this._lookTgt.pitch = Math.max(-0.42, Math.min(0.5, dy * 0.95));
    };
    const lv = () => {
      this._lookTgt.w = 0;
    };
    window.addEventListener("pointermove", mv, { passive: true });
    document.addEventListener("pointerleave", lv);
    this._lookDetach = () => {
      window.removeEventListener("pointermove", mv);
      document.removeEventListener("pointerleave", lv);
    };
  }
  _tuneLights() {
    if (this._rim) return;
    try {
      const v = this.viewer;
      if (v.globalLight) v.globalLight.intensity *= 0.88;
      if (v.cameraLight) v.cameraLight.intensity *= 1.15;
      if (v.scene && v.cameraLight) {
        const L = v.cameraLight.constructor;
        const rim = new L(0xbfd7ff, v.cameraLight.intensity * 0.55);
        rim.position.set(-32, 44, -46);
        v.scene.add(rim);
        const warm = new L(0xffd9a6, v.cameraLight.intensity * 0.3);
        warm.position.set(38, 16, 34);
        v.scene.add(warm);
        this._rim = rim;
        this._warm = warm;
      }
    } catch (e) {}
  }
  hit(power) {
    const imp = this._imp;
    const max = this.cfg.clickMaxEnergy || 5;
    imp.energy = Math.min(max, imp.energy + (this.cfg.clickEnergyPerHit || 1) * (power == null ? 1 : power));
    this._emit("hit", imp.energy / max);
    if (this.mode === "idle") this._playClip("interact");
    if (imp.energy >= max && this._flashCd <= 0) this.damageFlash();
    return this;
  }
  damageFlash() {
    this._ctx.damage = this.cfg.damageFlash;
    this._flashCd = 0.7;
    this._emit("damage");
    return this;
  }
  _playSub() {
    const pool = SE_SUBS.filter(n => n !== this._lastSub && seAnims()[n]);
    const name = pool.length ? pool[Math.floor(Math.random() * pool.length)] : SE_SUBS[0];
    this._lastSub = name;
    return this._playClip(name);
  }
  _playClip(name) {
    const d = seAnims()[name];
    if (!d || !this.viewer) return this;
    this._transition(seEmoteSource(this, d), 0.2);
    this.mode = "emote";
    return this;
  }
  setInteractive(on) {
    this.cfg.interactive = !!on;
    return this;
  }
  get damage() {
    return this._ctx.damage;
  }
  get software() {
    return this.gpu === "software";
  }
  setPaused(on) {
    if (!this.viewer) return this;
    try {
      if ("renderPaused" in this.viewer) this.viewer.renderPaused = !!on;else if (typeof this.viewer.setPaused === "function") this.viewer.setPaused(!!on);
    } catch (e) {}
    return this;
  }
  _attachInteraction() {
    if (this._detach) return;
    const c = this.canvas;
    let sx = null,
      sy = 0,
      st = 0,
      moved = false;
    const down = e => {
      sx = e.clientX;
      sy = e.clientY;
      st = performance.now();
      moved = false;
    };
    const move = e => {
      if (sx == null) return;
      if (Math.hypot(e.clientX - sx, e.clientY - sy) > this.cfg.tapMoveThreshold) moved = true;
    };
    const up = () => {
      if (sx == null) return;
      const took = performance.now() - st;
      if (!moved && took < this.cfg.tapTimeThreshold && this.cfg.interactive && this.mode === "idle") this.hit(1);
      sx = null;
    };
    c.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerup", up, { passive: true });
    this._detach = () => {
      c.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }
  _setControls(on) {
    try {
      this.viewer.controls.enabled = on;
    } catch (e) {}
  }
  on(ev, cb) {
    (this._listeners[ev] = this._listeners[ev] || []).push(cb);
    return this;
  }
  off(ev, cb) {
    const a = this._listeners[ev];
    if (!a) return this;
    this._listeners[ev] = a.filter(f => f !== cb);
    return this;
  }
  _emit(ev, arg) {
    (this._listeners[ev] || []).forEach(f => {
      try {
        f(arg);
      } catch (e) {}
    });
  }
  dispose() {
    if (this._detach) {
      this._detach();
      this._detach = null;
    }
    if (this._lookDetach) {
      this._lookDetach();
      this._lookDetach = null;
    }
    this._listeners = {};
    try {
      this.viewer && this.viewer.dispose();
    } catch (e) {}
    this.viewer = null;
    this._mixer = null;
    this._src = null;
    this._prev = null;
    this._fx = { intro: null, spin: null, popT: null };
    this.mode = "disposed";
  }
}
const CAPE_CACHE = {};
function loadCapeUrl(nick) {
  if (CAPE_CACHE[nick]) return CAPE_CACHE[nick];
  CAPE_CACHE[nick] = fetch(`https://api.capes.dev/load/${encodeURIComponent(nick)}`).then(r => r.ok ? r.json() : null).then(j => {
    if (!j) return null;
    const src = j.minecraft && j.minecraft.exists && j.minecraft || j.optifine && j.optifine.exists && j.optifine || null;
    return src && src.imageUrl ? src.imageUrl : null;
  }).catch(() => null);
  return CAPE_CACHE[nick];
}
window.SkinEngine = {
  version: "1.0.0",
  author: "1Eugesha",
  load: loadSkinview3d,
  gpu: seDetectGPU,
  Stage: SkinStage,
  mount: (canvas, opts) => new SkinStage(canvas, opts),
  ensureRig,
  restPose,
  applyPose,
  applyAnimTick: applyEmoteTick,
  sampleTrack,
  fixTransparency,
  applyDamageTint,
  resetDamageTint,
  AnimPlayer: sv => getEmotePlayerClass(sv || window.skinview3d),
  loadCape: loadCapeUrl,
  defaults: SE_DEFAULTS
};

// ============================================================================
//  Веб-компонент <skin-viewer> — персонаж на странице без единой строки JS:
//    <skin-viewer nick="1Eugesha"></skin-viewer>
//  Атрибуты: nick | skin (URL текстуры) | name-tag | cape (URL / auto / none) |
//  elytra (URL) | width | height. nick сам тянет скин, плащ и нейм-тег.
// ============================================================================
if (typeof customElements !== "undefined" && typeof HTMLElement !== "undefined" && !customElements.get("skin-viewer")) {
  class SkinViewerElement extends HTMLElement {
    static get observedAttributes() {
      return ["nick", "skin", "cape", "elytra", "name-tag"];
    }
    connectedCallback() {
      if (this._stage) return;
      const w = parseInt(this.getAttribute("width"), 10) || 300;
      const h = parseInt(this.getAttribute("height"), 10) || 420;
      if (!this.style.display) this.style.display = "inline-block";
      const c = document.createElement("canvas");
      this.appendChild(c);
      this._canvas = c;
      this._key = null;
      this._stage = new SkinStage(c, { width: w, height: h });
      this._apply();
    }
    attributeChangedCallback() {
      if (this._stage) this._apply();
    }
    disconnectedCallback() {
      if (this._stage) {
        try {
          this._stage.dispose();
        } catch (e) {}
        this._stage = null;
      }
      if (this._canvas) {
        this._canvas.remove();
        this._canvas = null;
      }
    }
    _apply() {
      const st = this._stage;
      const nick = this.getAttribute("nick");
      const skin = this.getAttribute("skin") || (nick ? "https://mc-heads.net/skin/" + encodeURIComponent(nick) : null);
      const tag = this.hasAttribute("name-tag") ? this.getAttribute("name-tag") : nick;
      const cape = this.getAttribute("cape");
      const elytra = this.getAttribute("elytra");
      const key = [skin, tag, cape, elytra].join("|");
      if (this._key === key || !skin) return;
      this._key = key;
      st.ready.then(() => {
        if (this._stage !== st || this._key !== key) return;
        st.setNameTag(tag || null);
        st.setSkin(skin).catch(() => {});
        if (elytra) st.setElytra(elytra);
        else if (cape && cape !== "auto" && cape !== "none") st.setCape(cape);
        else if (cape !== "none" && nick) {
          loadCapeUrl(nick).then(u => {
            if (u && this._stage === st && this._key === key) st.setCape(u);
          });
        }
      }).catch(() => {});
    }
  }
  customElements.define("skin-viewer", SkinViewerElement);
}
