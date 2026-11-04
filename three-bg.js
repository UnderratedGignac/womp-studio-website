/**
 * womp-studio/three-bg.js â€” WebGL 3D hero: a morphing iridescent liquid blob.
 * A shader-displaced sphere (simplex-noise vertex warp + fresnel iridescent rim)
 * that writhes over time and reacts to cursor + scroll, framed by orbiting
 * wireframe rings, floating accent shapes, and a particle field. No game art.
 *
 * Public API (window.WompThree):
 *   boot(canvasEl) -> teardown | null ; pause(bool) ; setReducedMotion(bool) ; setScroll(0..1)
 * Requires global THREE (r128). If absent, silently no-ops.
 */
'use strict';

(function () {
  if (typeof THREE === 'undefined') {
    window.WompThree = { boot: function () { return null; }, pause: function () {}, setReducedMotion: function () {}, setScroll: function () {} };
    return;
  }

  var DPR_CAP = 1.75, PARTICLES = 850;
  var renderer, scene, camera, clock;
  var group, blob, blobMat, rings = [], accents = [], particles, halo;
  var propGroup, props = [];
  var lights = [];
  var bubbles, blooms = [], satellites = [], streaks = [], bursts = [], grid = null;
  var shell, swarm, fireflies, haloRing, fishSchool = [], streamBubbles = [];
  var dnaHelix, auroraRibbon, leafParticles, shockwaves = [], orbLightning, proximityGlow;
  var raf = 0, running = false, booted = false, disposed = false, reduced = false;
  var canvas, host = null, ro = null;
  var W = 0, H = 0, scrollP = 0;
  var mouse = { x: 0, y: 0, tx: 0, ty: 0, vx: 0, vy: 0, excite: 0 };
  var scatterT = 0, spinAcc = 0, lastScrollP = 0;

  function rand(a, b) { return a + Math.random() * (b - a); }

  var NOISE = [
    'vec3 mod289(vec3 x){return x - floor(x*(1.0/289.0))*289.0;}',
    'vec4 mod289(vec4 x){return x - floor(x*(1.0/289.0))*289.0;}',
    'vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}',
    'vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}',
    'float snoise(vec3 v){',
    '  const vec2 C = vec2(1.0/6.0, 1.0/3.0); const vec4 D = vec4(0.0,0.5,1.0,2.0);',
    '  vec3 i  = floor(v + dot(v, C.yyy)); vec3 x0 = v - i + dot(i, C.xxx);',
    '  vec3 g = step(x0.yzx, x0.xyz); vec3 l = 1.0 - g;',
    '  vec3 i1 = min(g.xyz, l.zxy); vec3 i2 = max(g.xyz, l.zxy);',
    '  vec3 x1 = x0 - i1 + C.xxx; vec3 x2 = x0 - i2 + C.yyy; vec3 x3 = x0 - D.yyy;',
    '  i = mod289(i);',
    '  vec4 p = permute(permute(permute( i.z + vec4(0.0,i1.z,i2.z,1.0)) + i.y + vec4(0.0,i1.y,i2.y,1.0)) + i.x + vec4(0.0,i1.x,i2.x,1.0));',
    '  float n_ = 0.142857142857; vec3 ns = n_ * D.wyz - D.xzx;',
    '  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);',
    '  vec4 x_ = floor(j * ns.z); vec4 y_ = floor(j - 7.0 * x_);',
    '  vec4 x = x_ * ns.x + ns.yyyy; vec4 y = y_ * ns.x + ns.yyyy; vec4 h = 1.0 - abs(x) - abs(y);',
    '  vec4 b0 = vec4(x.xy, y.xy); vec4 b1 = vec4(x.zw, y.zw);',
    '  vec4 s0 = floor(b0)*2.0 + 1.0; vec4 s1 = floor(b1)*2.0 + 1.0; vec4 sh = -step(h, vec4(0.0));',
    '  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy; vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;',
    '  vec3 p0 = vec3(a0.xy,h.x); vec3 p1 = vec3(a0.zw,h.y); vec3 p2 = vec3(a1.xy,h.z); vec3 p3 = vec3(a1.zw,h.w);',
    '  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));',
    '  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;',
    '  vec4 m = max(0.6 - vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)), 0.0); m = m*m;',
    '  return 42.0 * dot(m*m, vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));',
    '}'
  ].join('\n');

  var VERT = NOISE + '\n' + [
    'uniform float uTime; uniform float uAmp; uniform float uFreq;',
    'varying vec3 vNormal; varying vec3 vPos; varying float vNoise;',
    'void main(){',
    '  float n = snoise(normal * uFreq + vec3(uTime * 0.25));',
    '  float n2 = snoise(normal * uFreq * 2.3 + vec3(uTime * 0.45));',
    '  float disp = (n * 0.65 + n2 * 0.35) * uAmp;',
    '  vNoise = n;',
    '  vec3 newPos = position + normal * disp;',
    '  vNormal = normalize(normalMatrix * normal);',
    '  vec4 mv = modelViewMatrix * vec4(newPos, 1.0);',
    '  vPos = mv.xyz;',
    '  gl_Position = projectionMatrix * mv;',
    '}'
  ].join('\n');

  var FRAG = [
    'uniform float uTime; varying vec3 vNormal; varying vec3 vPos; varying float vNoise;',
    'void main(){',
    '  vec3 viewDir = normalize(-vPos);',
    '  vec3 N = normalize(vNormal);',
    '  float fres = pow(1.0 - max(dot(viewDir, N), 0.0), 2.2);',
    '  vec3 violet = vec3(0.49,0.36,1.0); vec3 cyan = vec3(0.22,0.90,0.83); vec3 magenta = vec3(1.0,0.36,0.54);',
    '  vec3 amber = vec3(1.0,0.71,0.33); vec3 indigo = vec3(0.31,0.47,1.0);',
    '  float t = vNoise * 0.5 + 0.5;',
    '  float shift = sin(uTime * 0.4 + vPos.y * 0.5) * 0.5 + 0.5;',
    '  vec3 base = mix(violet, cyan, smoothstep(0.0, 0.6, t));',
    '  base = mix(base, magenta, smoothstep(0.55, 1.0, fres));',
    '  base = mix(base, amber, smoothstep(0.3, 0.7, shift) * 0.4);',
    '  base = mix(base, indigo, smoothstep(0.2, 0.8, t * shift) * 0.35);',
    '  float spec = pow(max(dot(reflect(-viewDir, N), normalize(vec3(0.5, 0.8, 0.6))), 0.0), 24.0);',
    '  vec3 col = base + fres * 0.7 + spec * 0.5;',
    '  col += fres * vec3(0.3, 0.5, 0.6) * 0.4;',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  function texCircle() {
    var c = document.createElement('canvas'); c.width = c.height = 64;
    var g = c.getContext('2d'); var grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.4, 'rgba(255,255,255,0.5)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }
  function texGlow() {
    var c = document.createElement('canvas'); c.width = c.height = 256;
    var g = c.getContext('2d'); var grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grd.addColorStop(0, 'rgba(124,92,255,0.55)'); grd.addColorStop(0.5, 'rgba(55,230,213,0.18)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  }
  function texStreak() {
    var c = document.createElement('canvas'); c.width = c.height = 128;
    var g = c.getContext('2d');
    var grd = g.createLinearGradient(0, 0, 0, 128);
    grd.addColorStop(0, 'rgba(255,255,255,0)'); grd.addColorStop(0.75, 'rgba(190,215,255,0.55)'); grd.addColorStop(1, 'rgba(255,255,255,1)');
    g.fillStyle = grd; g.fillRect(56, 0, 16, 128);
    var hd = g.createRadialGradient(64, 120, 0, 64, 120, 18);
    hd.addColorStop(0, 'rgba(255,255,255,0.9)'); hd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = hd; g.fillRect(32, 90, 64, 48);
    return new THREE.CanvasTexture(c);
  }
  function texStripes(a, b) {
    var c = document.createElement('canvas'); c.width = c.height = 128;
    var g = c.getContext('2d');
    g.fillStyle = a; g.fillRect(0, 0, 128, 128);
    g.fillStyle = b;
    for (var i = 0; i < 4; i++) g.fillRect(i * 32, 0, 16, 128);
    return new THREE.CanvasTexture(c);
  }

  function metalMat(color, emissive) {
    return new THREE.MeshStandardMaterial({ color: color, metalness: 0.55, roughness: 0.35, emissive: (emissive != null ? emissive : color), emissiveIntensity: 0.22, flatShading: true });
  }
  function makeRocket() {
    var g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.75, 16), metalMat(0xdfe3ff, 0x2a2f55)));
    var nose = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.42, 16), metalMat(0xff5c8a)); nose.position.y = 0.58; g.add(nose);
    var win = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 16), metalMat(0x37e6d5)); win.position.set(0, 0.18, 0.2); g.add(win);
    for (var i = 0; i < 3; i++) { var fin = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.32, 4), metalMat(0x7c5cff)); var a = i / 3 * 6.283; fin.position.set(Math.cos(a) * 0.24, -0.4, Math.sin(a) * 0.24); fin.rotation.z = 0.35; g.add(fin); }
    var flame = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.4, 12), new THREE.MeshBasicMaterial({ color: 0xffb454 })); flame.position.y = -0.62; flame.rotation.x = Math.PI; g.add(flame);
    return g;
  }
  function makeDumbbell() {
    var g = new THREE.Group();
    var bar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 12), metalMat(0xcfd3e8)); bar.rotation.z = Math.PI / 2; g.add(bar);
    [-1, 1].forEach(function (s) {
      var w = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.18, 20), metalMat(0x7c5cff)); w.rotation.z = Math.PI / 2; w.position.x = s * 0.42; g.add(w);
      var cap = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.26, 20), metalMat(0x37e6d5)); cap.rotation.z = Math.PI / 2; cap.position.x = s * 0.56; g.add(cap);
    });
    return g;
  }
  function makeRemote() {
    var g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.92, 0.12), metalMat(0x20243c, 0x0a0c18)));
    for (var r = 0; r < 4; r++) for (var c = 0; c < 3; c++) { var b = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 10), metalMat(r === 0 ? 0xff5c8a : 0x37e6d5)); b.rotation.x = Math.PI / 2; b.position.set((c - 1) * 0.13, 0.3 - r * 0.17, 0.08); g.add(b); }
    return g;
  }
  function makeGamepad() {
    var g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.44, 0.16), metalMat(0x242844, 0x0a0c18)));
    var dp = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.05, 0.05), metalMat(0x9aa0d0)); dp.position.set(-0.22, 0.02, 0.1); g.add(dp);
    var dp2 = dp.clone(); dp2.rotation.z = Math.PI / 2; dp2.position.set(-0.22, 0.02, 0.1); g.add(dp2);
    var b1 = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 12), metalMat(0x37e6d5)); b1.position.set(0.22, 0.07, 0.1); g.add(b1);
    var b2 = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 12), metalMat(0xff5c8a)); b2.position.set(0.3, -0.03, 0.1); g.add(b2);
    return g;
  }
  function makeStar() {
    var s = new THREE.Shape(); var spikes = 5, outer = 0.42, inner = 0.18;
    for (var i = 0; i < spikes * 2; i++) { var rr = i % 2 ? inner : outer; var a = (i / (spikes * 2)) * 6.283 - 1.571; var x = Math.cos(a) * rr, y = Math.sin(a) * rr; if (i) s.lineTo(x, y); else s.moveTo(x, y); } s.closePath();
    var geo = new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1 }); geo.center();
    return new THREE.Mesh(geo, metalMat(0xffb454));
  }
  function makeCoin() {
    var g = new THREE.Group();
    var c = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.09, 28), metalMat(0xffb454, 0x7a4a10)); c.rotation.x = Math.PI / 2; g.add(c);
    return g;
  }
  function makePlanet() {
    var g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.32, 20, 20), metalMat(0x7c5cff)));
    var ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.035, 8, 40), metalMat(0x37e6d5)); ring.rotation.x = Math.PI / 2.4; g.add(ring);
    return g;
  }
  function makeHeart() {
    var s = new THREE.Shape();
    s.moveTo(0, 0.12); s.bezierCurveTo(0, 0.28, -0.38, 0.36, -0.38, 0.04); s.bezierCurveTo(-0.38, -0.18, 0, -0.32, 0, -0.46);
    s.bezierCurveTo(0, -0.32, 0.38, -0.18, 0.38, 0.04); s.bezierCurveTo(0.38, 0.36, 0, 0.28, 0, 0.12);
    var geo = new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1 }); geo.center();
    return new THREE.Mesh(geo, metalMat(0xff5c8a));
  }
  function makeFish() {
    var g = new THREE.Group();
    var body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), metalMat(0x37e6d5));
    body.scale.set(1.4, 0.8, 0.6); g.add(body);
    var tail = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.3, 4), metalMat(0xff5c8a));
    tail.position.x = -0.38; tail.rotation.z = Math.PI / 2; tail.scale.z = 0.4; g.add(tail);
    var fin = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.2, 4), metalMat(0xffb454));
    fin.position.set(0.05, 0.2, 0); fin.scale.z = 0.3; g.add(fin);
    var eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    eye.position.set(0.18, 0.06, 0.14); g.add(eye);
    var eye2 = eye.clone(); eye2.position.z = -0.14; g.add(eye2);
    return g;
  }
  function makeGem() {
    var g = new THREE.Group();
    var gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.3), new THREE.MeshStandardMaterial({ color: 0x7c5cff, metalness: 0.8, roughness: 0.15, emissive: 0x7c5cff, emissiveIntensity: 0.5, flatShading: true }));
    g.add(gem);
    var gem2 = new THREE.Mesh(new THREE.OctahedronGeometry(0.18), metalMat(0x37e6d5));
    gem2.position.set(0.25, 0.2, 0.1); g.add(gem2);
    return g;
  }
  function makeChest() {
    var g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.35), metalMat(0x8b5e3c, 0x2a1a0a)));
    var lid = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.5, 12, 1, false, 0, Math.PI), metalMat(0xa0693a, 0x2a1a0a));
    lid.rotation.z = Math.PI / 2; lid.position.y = 0.17; g.add(lid);
    var lock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.06), metalMat(0xffb454, 0x7a4a10));
    lock.position.set(0, 0.02, 0.19); g.add(lock);
    var gold = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.04, 16), metalMat(0xffb454, 0xffb454));
    gold.position.set(0.1, 0.1, 0.1); gold.rotation.x = 0.3; g.add(gold);
    return g;
  }
  function makeAnchor() {
    var g = new THREE.Group();
    var mat = metalMat(0x9aa0d0, 0x2a2f55);
    var shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.8, 10), mat); g.add(shaft);
    var ring = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.03, 8, 20), mat); ring.position.y = 0.45; g.add(ring);
    var cross = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 8), mat); cross.rotation.z = Math.PI / 2; cross.position.y = 0.25; g.add(cross);
    var arc = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.04, 8, 20, Math.PI), mat); arc.position.y = -0.35; arc.rotation.z = Math.PI; g.add(arc);
    for (var i = 0; i < 2; i++) {
      var fluke = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.18, 4), mat);
      fluke.position.set(i ? 0.2 : -0.2, -0.35, 0);
      fluke.rotation.z = i ? -0.6 : 0.6;
      g.add(fluke);
    }
    return g;
  }
  function makeShell() {
    var g = new THREE.Group();
    var pts = [];
    for (var i = 0; i <= 20; i++) {
      var a = (i / 20) * Math.PI * 0.55;
      var r = 0.08 + (i / 20) * 0.22;
      pts.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r * 0.6));
    }
    var geo = new THREE.LatheGeometry(pts, 20);
    var shell = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xffb4c8, metalness: 0.3, roughness: 0.5, side: THREE.DoubleSide }));
    g.add(shell);
    var pearl = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 16), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.9, roughness: 0.1, emissive: 0xffffff, emissiveIntensity: 0.3 }));
    pearl.position.y = 0.12; g.add(pearl);
    return g;
  }
  function makeCrystal() {
    var g = new THREE.Group();
    var mat = new THREE.MeshStandardMaterial({ color: 0x7c5cff, metalness: 0.7, roughness: 0.2, emissive: 0x7c5cff, emissiveIntensity: 0.4, transparent: true, opacity: 0.9, flatShading: true });
    var c1 = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.55, 6), mat); c1.position.y = 0.1; g.add(c1);
    var c2 = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.35, 6), mat); c2.position.set(0.14, 0, 0.08); c2.rotation.z = -0.3; g.add(c2);
    var c3 = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.25, 6), mat); c3.position.set(-0.12, -0.05, 0.06); c3.rotation.z = 0.35; g.add(c3);
    return g;
  }
  function makeBubble() {
    var g = new THREE.Group();
    var b = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 16), new THREE.MeshStandardMaterial({ color: 0x9adfff, metalness: 0.1, roughness: 0.05, transparent: true, opacity: 0.45, emissive: 0x9adfff, emissiveIntensity: 0.15 }));
    g.add(b);
    var hi = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 }));
    hi.position.set(0.04, 0.05, 0.08); g.add(hi);
    return g;
  }
  function makeCoral() {
    var g = new THREE.Group();
    var mat = metalMat(0xff5c8a, 0x5c1a2a);
    for (var i = 0; i < 5; i++) {
      var h = rand(0.2, 0.45);
      var branch = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, h, 6), mat);
      var a = (i / 5) * Math.PI * 2;
      branch.position.set(Math.cos(a) * 0.08, h / 2 - 0.1, Math.sin(a) * 0.08);
      branch.rotation.z = Math.cos(a) * 0.4;
      branch.rotation.x = Math.sin(a) * 0.4;
      g.add(branch);
      var tip = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), metalMat(0xffb454, 0xffb454));
      tip.position.set(Math.cos(a) * 0.16, h - 0.08, Math.sin(a) * 0.16);
      g.add(tip);
    }
    return g;
  }
  function makeDice() {
    var m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshStandardMaterial({ color: 0xf2f2fa, metalness: 0.1, roughness: 0.35, flatShading: true }));
    var dot = new THREE.MeshBasicMaterial({ color: 0x20243c });
    var dg = new THREE.SphereGeometry(0.045, 8, 8);
    var faces = [
      [0, 0, 0.26, 1], [0, 0, -0.26, 6], [0.26, 0, 0, 2], [-0.26, 0, 0, 5], [0, 0.26, 0, 3], [0, -0.26, 0, 4]
    ];
    for (var f = 0; f < faces.length; f++) {
      var spec = faces[f], n = spec[3];
      var off = 0.12;
      if (n === 1) addDot(spec[0], spec[1], spec[2], 0, 0, m, dot, dg);
      else if (n === 2) { addDot(spec[0], spec[1], spec[2], -off, -off, m, dot, dg); addDot(spec[0], spec[1], spec[2], off, off, m, dot, dg); }
      else if (n === 3) { addDot(spec[0], spec[1], spec[2], -off, -off, m, dot, dg); addDot(spec[0], spec[1], spec[2], 0, 0, m, dot, dg); addDot(spec[0], spec[1], spec[2], off, off, m, dot, dg); }
      else if (n === 4) { addDot(spec[0], spec[1], spec[2], -off, -off, m, dot, dg); addDot(spec[0], spec[1], spec[2], -off, off, m, dot, dg); addDot(spec[0], spec[1], spec[2], off, -off, m, dot, dg); addDot(spec[0], spec[1], spec[2], off, off, m, dot, dg); }
      else if (n === 5) { addDot(spec[0], spec[1], spec[2], -off, -off, m, dot, dg); addDot(spec[0], spec[1], spec[2], -off, off, m, dot, dg); addDot(spec[0], spec[1], spec[2], 0, 0, m, dot, dg); addDot(spec[0], spec[1], spec[2], off, -off, m, dot, dg); addDot(spec[0], spec[1], spec[2], off, off, m, dot, dg); }
      else { addDot(spec[0], spec[1], spec[2], -off, -off, m, dot, dg); addDot(spec[0], spec[1], spec[2], -off, 0, m, dot, dg); addDot(spec[0], spec[1], spec[2], -off, off, m, dot, dg); addDot(spec[0], spec[1], spec[2], off, -off, m, dot, dg); addDot(spec[0], spec[1], spec[2], off, 0, m, dot, dg); addDot(spec[0], spec[1], spec[2], off, off, m, dot, dg); }
    }
    return m;
  }
  function addDot(nx, ny, nz, u, v, parent, dotMat, dotGeo) {
    // place pip on the face whose normal is (nx,ny,nz); u/v are in-face offsets
    var d = new THREE.Mesh(dotGeo, dotMat);
    var eps = 0.001;
    if (nz !== 0) d.position.set(u, v, nz + nz * eps);
    else if (nx !== 0) d.position.set(nx + nx * eps, u, v);
    else d.position.set(u, ny + ny * eps, v);
    parent.add(d);
  }
  function makeTrophy() {
    var g = new THREE.Group();
    var gold = metalMat(0xffb454, 0x6b4a12);
    var cup = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.14, 0.34, 18), gold); cup.position.y = 0.16; g.add(cup);
    var bowl = new THREE.Mesh(new THREE.SphereGeometry(0.26, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), gold); bowl.rotation.x = Math.PI; bowl.position.y = 0.33; g.add(bowl);
    for (var s = -1; s <= 1; s += 2) { var h = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.025, 8, 16, Math.PI), gold); h.position.set(s * 0.33, 0.3, 0); h.rotation.z = s > 0 ? -Math.PI / 2 : Math.PI / 2; g.add(h); }
    var stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.16, 10), gold); stem.position.y = -0.08; g.add(stem);
    var base = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.3), metalMat(0x2a2140, 0x100c20)); base.position.y = -0.2; g.add(base);
    return g;
  }
  function makeCrown() {
    var g = new THREE.Group();
    var gold = metalMat(0xffb454, 0x6b4a12);
    var band = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.22, 20, 1, true), new THREE.MeshStandardMaterial({ color: 0xffb454, metalness: 0.7, roughness: 0.3, side: THREE.DoubleSide, flatShading: true }));
    g.add(band);
    for (var i = 0; i < 5; i++) {
      var a = (i / 5) * Math.PI * 2;
      var spike = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.22, 4), gold);
      spike.position.set(Math.cos(a) * 0.29, 0.2, Math.sin(a) * 0.29);
      spike.rotation.y = -a;
      g.add(spike);
      var gem = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), metalMat(i % 2 ? 0xff5c8a : 0x37e6d5, i % 2 ? 0xff5c8a : 0x37e6d5));
      gem.position.set(Math.cos(a) * 0.31, 0.02, Math.sin(a) * 0.31);
      g.add(gem);
    }
    return g;
  }
  function makeJoystick() {
    var g = new THREE.Group();
    var base = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.16, 0.5), metalMat(0x20243c, 0x0a0c18)); g.add(base);
    var shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.4, 10), metalMat(0xcfd3e8)); shaft.position.set(0, 0.24, 0); shaft.rotation.z = 0.22; g.add(shaft);
    var ball = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 16), metalMat(0xff5c8a, 0x4a1020)); ball.position.set(-0.09, 0.44, 0); g.add(ball);
    for (var b = 0; b < 2; b++) { var btn = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 12), metalMat(b ? 0x37e6d5 : 0xffb454)); btn.position.set(0.18 + b * 0.14, 0.1, 0.08); g.add(btn); }
    return g;
  }
  function makeBomb() {
    var g = new THREE.Group();
    var body = new THREE.Mesh(new THREE.SphereGeometry(0.32, 18, 18), new THREE.MeshStandardMaterial({ color: 0x14141f, metalness: 0.5, roughness: 0.3 }));
    g.add(body);
    var cap = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.1, 10), metalMat(0x9aa0d0)); cap.position.y = 0.33; g.add(cap);
    var fuse = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.02, 6, 14, Math.PI * 1.4), metalMat(0x8b5e3c)); fuse.position.set(0.1, 0.44, 0); fuse.rotation.y = Math.PI / 2; g.add(fuse);
    var spark = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffe08a })); spark.position.set(0.24, 0.5, 0); g.add(spark);
    g.userData.spark = spark;
    return g;
  }
  function makeUfo() {
    var g = new THREE.Group();
    var disc = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 10), metalMat(0xcfd3e8, 0x232746)); disc.scale.y = 0.22; g.add(disc);
    var dome = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x37e6d5, metalness: 0.1, roughness: 0.1, transparent: true, opacity: 0.7, emissive: 0x37e6d5, emissiveIntensity: 0.5 }));
    dome.position.y = 0.08; g.add(dome);
    for (var i = 0; i < 6; i++) {
      var a = (i / 6) * Math.PI * 2;
      var lamp = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffb454 : 0xff5c8a }));
      lamp.position.set(Math.cos(a) * 0.36, -0.06, Math.sin(a) * 0.36);
      g.add(lamp);
    }
    return g;
  }
  function makeGhost() {
    var g = new THREE.Group();
    var mat = new THREE.MeshStandardMaterial({ color: 0xf2f2fa, metalness: 0.05, roughness: 0.5, transparent: true, opacity: 0.85, flatShading: true });
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat);
    head.position.y = 0.12; g.add(head);
    var skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.34, 12, 1, true), new THREE.MeshStandardMaterial({ color: 0xf2f2fa, metalness: 0.05, roughness: 0.5, transparent: true, opacity: 0.85, side: THREE.DoubleSide, flatShading: true }));
    skirt.position.y = -0.05; g.add(skirt);
    var eye = new THREE.MeshBasicMaterial({ color: 0x20243c });
    var e1 = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), eye); e1.position.set(-0.1, 0.16, 0.24); g.add(e1);
    var e2 = e1.clone(); e2.position.x = 0.1; g.add(e2);
    return g;
  }
  function makeLightning() {
    var s = new THREE.Shape();
    s.moveTo(-0.12, 0.4); s.lineTo(0.1, 0.42); s.lineTo(0.0, 0.08); s.lineTo(0.2, 0.12);
    s.lineTo(-0.06, -0.42); s.lineTo(0.02, -0.04); s.lineTo(-0.16, -0.08); s.closePath();
    var geo = new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1 }); geo.center();
    return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xffe08a, emissive: 0xffb454, emissiveIntensity: 0.8, metalness: 0.3, roughness: 0.3, flatShading: true }));
  }
  function makeHourglass() {
    var g = new THREE.Group();
    var frame = metalMat(0x8b5e3c, 0x2a1a0a);
    var top = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.04, 14), frame); top.position.y = 0.36; g.add(top);
    var bot = top.clone(); bot.position.y = -0.36; g.add(bot);
    var glassMat = new THREE.MeshStandardMaterial({ color: 0x9adfff, metalness: 0.1, roughness: 0.05, transparent: true, opacity: 0.35 });
    var up = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.36, 14, 1, true), new THREE.MeshStandardMaterial({ color: 0x9adfff, metalness: 0.1, roughness: 0.05, transparent: true, opacity: 0.35, side: THREE.DoubleSide })); up.position.y = 0.18; up.rotation.x = Math.PI; g.add(up);
    var dn = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.36, 14), glassMat); dn.position.y = -0.18; g.add(dn);
    var sand = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.22, 12), metalMat(0xffb454, 0xffb454)); sand.position.y = -0.22; g.add(sand);
    for (var p = 0; p < 3; p++) { var post = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.76, 6), frame); var a = p / 3 * Math.PI * 2; post.position.set(Math.cos(a) * 0.24, 0, Math.sin(a) * 0.24); g.add(post); }
    return g;
  }
  function makeBalloon() {
    var g = new THREE.Group();
    var mat = new THREE.MeshStandardMaterial({ color: 0xff5c8a, metalness: 0.15, roughness: 0.35, flatShading: true });
    var b = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 12), mat); b.scale.y = 1.2; g.add(b);
    var knot = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.1, 6), mat); knot.position.y = -0.34; g.add(knot);
    return g;
  }
  function makeBee() {
    var g = new THREE.Group();
    var body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), metalMat(0xffb454, 0x6b4a12)); body.scale.set(1.3, 0.9, 0.9); g.add(body);
    var stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.152, 0.152, 0.06, 14), metalMat(0x20243c)); stripe.rotation.z = Math.PI / 2; stripe.position.x = 0.03; g.add(stripe);
    var wingMat = new THREE.MeshStandardMaterial({ color: 0xcfe8ff, metalness: 0.1, roughness: 0.2, transparent: true, opacity: 0.55, side: THREE.DoubleSide });
    var w1 = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 6), wingMat); w1.scale.set(1.6, 0.18, 0.9); w1.position.set(0.02, 0.14, 0.08); g.add(w1);
    var w2 = w1.clone(); w2.position.z = -0.08; g.add(w2);
    var eye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), new THREE.MeshBasicMaterial({ color: 0x20243c })); eye.position.set(0.16, 0.04, 0.07); g.add(eye);
    var eye2 = eye.clone(); eye2.position.z = -0.07; g.add(eye2);
    g.userData.wings = [w1, w2];
    return g;
  }
  function makeBoat() {
    var g = new THREE.Group();
    var hull = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.16, 0.8, 4), metalMat(0xdfe3ff, 0x2a2f55));
    hull.rotation.x = Math.PI / 2; hull.rotation.y = Math.PI / 4; g.add(hull);
    var mast = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.7, 6), metalMat(0x8b5e3c)); mast.position.y = 0.4; g.add(mast);
    var s = new THREE.Shape(); s.moveTo(0, 0.35); s.lineTo(0, -0.3); s.lineTo(0.34, -0.3); s.closePath();
    var sail = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: false }), metalMat(0xff5c8a, 0x5c1a2a));
    sail.position.set(0.03, 0.42, 0); g.add(sail);
    return g;
  }
  function makeSubmarine() {
    var g = new THREE.Group();
    var body = new THREE.Mesh(new THREE.SphereGeometry(0.28, 18, 14), metalMat(0xffb454, 0x6b4a12)); body.scale.set(1.9, 0.9, 0.9); g.add(body);
    var tower = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.14), metalMat(0xe8a13c, 0x6b4a12)); tower.position.set(0.02, 0.26, 0); g.add(tower);
    var peri = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.2, 6), metalMat(0xcfd3e8)); peri.position.set(0.02, 0.42, 0); g.add(peri);
    for (var i = 0; i < 3; i++) {
      var p = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 10), new THREE.MeshStandardMaterial({ color: 0x37e6d5, emissive: 0x37e6d5, emissiveIntensity: 0.7, metalness: 0.2, roughness: 0.2 }));
      p.position.set(-0.25 + i * 0.25, 0, 0.23); g.add(p);
    }
    var prop = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.16, 4), metalMat(0xcfd3e8)); prop.rotation.z = Math.PI / 2; prop.position.x = -0.56; g.add(prop);
    return g;
  }
  function makeDuck() {
    var g = new THREE.Group();
    var orange = metalMat(0xffb454, 0x6b4a12);
    var body = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12), orange); body.scale.set(1.25, 0.9, 0.9); body.position.y = -0.05; g.add(body);
    var tail = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.24, 4), orange); tail.position.set(-0.28, 0.1, 0); tail.rotation.z = 1.1; g.add(tail);
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 12), orange); head.position.set(0.2, 0.22, 0); g.add(head);
    var beak = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.14, 6), metalMat(0xff7a3c)); beak.position.set(0.36, 0.2, 0); beak.rotation.z = -Math.PI / 2; g.add(beak);
    var eye = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 8), new THREE.MeshBasicMaterial({ color: 0x20243c })); eye.position.set(0.25, 0.28, 0.09); g.add(eye);
    var eye2 = eye.clone(); eye2.position.z = -0.09; g.add(eye2);
    return g;
  }
  function makeJelly2() {
    var g = new THREE.Group();
    var bell = new THREE.Mesh(new THREE.SphereGeometry(0.3, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xff9ec4, emissive: 0xff5c8a, emissiveIntensity: 0.45, transparent: true, opacity: 0.6, side: THREE.DoubleSide, flatShading: true }));
    bell.rotation.x = Math.PI; bell.position.y = 0.1; g.add(bell);
    var tm = new THREE.MeshStandardMaterial({ color: 0xffc0dd, transparent: true, opacity: 0.5, emissive: 0xff5c8a, emissiveIntensity: 0.3 });
    var tents = [];
    for (var i = 0; i < 6; i++) {
      var a = (i / 6) * Math.PI * 2;
      var tent = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.008, 0.5, 6), tm);
      tent.position.set(Math.cos(a) * 0.14, -0.28, Math.sin(a) * 0.14);
      g.add(tent); tents.push(tent);
    }
    g.userData.tents = tents;
    return g;
  }
  function makeBeachBall() {
    return new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 18), new THREE.MeshStandardMaterial({ map: texStripes('#ff5c8a', '#f2f2fa'), roughness: 0.35, metalness: 0.1 }));
  }
  function makeHook() {
    var g = new THREE.Group();
    var mat = metalMat(0xcfd3e8, 0x2a2f55);
    var curve = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.03, 8, 20, Math.PI * 1.4), mat); curve.rotation.z = -0.7; g.add(curve);
    var shank = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.42, 8), mat); shank.position.y = 0.36; g.add(shank);
    var barb = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.1, 4), mat); barb.position.set(0.2, -0.02, 0); barb.rotation.z = -2.3; g.add(barb);
    return g;
  }
  function makeLighthouse() {
    var g = new THREE.Group();
    var base = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 0.5, 12), metalMat(0xf2f2fa, 0x2a2f55)); g.add(base);
    var stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.16, 12), metalMat(0xff5c8a, 0x5c1a2a)); stripe.position.y = 0.12; g.add(stripe);
    var top = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.3, 12), metalMat(0xf2f2fa, 0x2a2f55)); top.position.y = 0.38; g.add(top);
    var lamp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 10), new THREE.MeshBasicMaterial({ color: 0xffe08a })); lamp.position.y = 0.58; g.add(lamp);
    var beam = new THREE.Sprite(new THREE.SpriteMaterial({ map: texGlow(), color: 0xffe08a, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }));
    beam.scale.set(2.5, 0.4, 1); beam.position.set(1.2, 0.58, 0); g.add(beam);
    g.userData.beam = beam;
    return g;
  }
  function makeCupcake() {
    var g = new THREE.Group();
    var base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.3, 12), metalMat(0x8b5e3c, 0x2a1a0a)); g.add(base);
    var frost = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 10), new THREE.MeshStandardMaterial({ color: 0xff9ec4, emissive: 0xff5c8a, emissiveIntensity: 0.2, metalness: 0.15, roughness: 0.4, flatShading: true }));
    frost.scale.y = 0.7; frost.position.y = 0.24; g.add(frost);
    var cherry = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 10), metalMat(0xff5c8a, 0x5c1a2a)); cherry.position.y = 0.42; g.add(cherry);
    return g;
  }
  function makeCamera() {
    var g = new THREE.Group();
    var body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.26), metalMat(0x20243c, 0x0a0c18)); g.add(body);
    var lens = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.22, 14), metalMat(0x14141f, 0x0a0c18)); lens.rotation.z = Math.PI / 2; lens.position.x = 0.34; g.add(lens);
    var glass = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 12), new THREE.MeshStandardMaterial({ color: 0x37e6d5, metalness: 0.9, roughness: 0.05, emissive: 0x37e6d5, emissiveIntensity: 0.3 }));
    glass.position.set(0.46, 0, 0); g.add(glass);
    var view = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.14), metalMat(0x7c5cff)); view.position.set(-0.14, 0.26, 0); g.add(view);
    var btn = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.05, 8), metalMat(0xff5c8a)); btn.position.set(0.2, 0.24, 0.08); g.add(btn);
    return g;
  }
  function makeGlobe() {
    var g = new THREE.Group();
    var sphere = new THREE.Mesh(new THREE.SphereGeometry(0.28, 20, 16), new THREE.MeshStandardMaterial({ color: 0x37e6d5, metalness: 0.2, roughness: 0.45, emissive: 0x234a4a, emissiveIntensity: 0.15, flatShading: true })); g.add(sphere);
    var ring = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.015, 8, 40), metalMat(0xffb454, 0x6b4a12)); ring.rotation.x = Math.PI / 6; g.add(ring);
    var stand = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.4, 6), metalMat(0x8b5e3c)); stand.position.y = -0.42; g.add(stand);
    var base = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.06, 12), metalMat(0x8b5e3c, 0x2a1a0a)); base.position.y = -0.64; g.add(base);
    g.userData.sphere = sphere;
    return g;
  }
  function makeCompass() {
    var g = new THREE.Group();
    var disc = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.08, 24), metalMat(0xffb454, 0x6b4a12)); disc.rotation.x = Math.PI / 2; g.add(disc);
    var face = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.02, 24), metalMat(0xf2f2fa, 0x2a2f55)); face.rotation.x = Math.PI / 2; face.position.z = 0.05; g.add(face);
    var needle = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.3, 4), metalMat(0xff5c8a, 0x5c1a2a)); needle.position.z = 0.07; g.add(needle);
    var needle2 = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.3, 4), metalMat(0xf2f2fa, 0x2a2f55)); needle2.rotation.x = Math.PI; needle2.position.z = 0.07; g.add(needle2);
    g.userData.needle = needle; g.userData.needle2 = needle2;
    return g;
  }
  function makeTelescope() {
    var g = new THREE.Group();
    var tube = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.8, 12), metalMat(0x8b5e3c, 0x2a1a0a)); tube.rotation.z = Math.PI / 6; g.add(tube);
    var lens = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 12), new THREE.MeshStandardMaterial({ color: 0x9adfff, metalness: 0.3, roughness: 0.1, emissive: 0x37e6d5, emissiveIntensity: 0.2 }));
    lens.scale.y = 0.3; lens.position.set(0.4, 0.23, 0); g.add(lens);
    var tripod = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.5, 4), metalMat(0x20243c)); tripod.position.set(-0.1, -0.35, 0); g.add(tripod);
    return g;
  }
  function makePotion() {
    var g = new THREE.Group();
    var bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.4, 12), new THREE.MeshStandardMaterial({ color: 0x9adfff, metalness: 0.1, roughness: 0.05, transparent: true, opacity: 0.5 })); g.add(bottle);
    var neck = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.16, 10), new THREE.MeshStandardMaterial({ color: 0x9adfff, metalness: 0.1, roughness: 0.05, transparent: true, opacity: 0.5 })); neck.position.y = 0.28; g.add(neck);
    var liquid = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.15, 0.25, 12), new THREE.MeshStandardMaterial({ color: 0x7c5cff, emissive: 0x7c5cff, emissiveIntensity: 0.6, metalness: 0.1, roughness: 0.2, transparent: true, opacity: 0.7 })); liquid.position.y = -0.05; g.add(liquid);
    var cork = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.08, 8), metalMat(0x8b5e3c, 0x2a1a0a)); cork.position.y = 0.4; g.add(cork);
    var bub = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), new THREE.MeshBasicMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.6 })); bub.position.set(0.04, -0.08, 0); g.add(bub);
    g.userData.potBub = bub;
    return g;
  }
  function makeMushroom() {
    var g = new THREE.Group();
    var stem = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.35, 10), metalMat(0xf2f2fa, 0x2a2f55)); stem.position.y = -0.05; g.add(stem);
    var cap = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xff5c8a, emissive: 0xff5c8a, emissiveIntensity: 0.3, metalness: 0.2, roughness: 0.4, flatShading: true })); cap.position.y = 0.12; g.add(cap);
    for (var i = 0; i < 4; i++) {
      var dot = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), new THREE.MeshBasicMaterial({ color: 0xf2f2fa }));
      var a = (i / 4) * Math.PI * 2 + 0.3;
      dot.position.set(Math.cos(a) * 0.18, 0.22, Math.sin(a) * 0.18);
      g.add(dot);
    }
    return g;
  }
  function makeVinyl() {
    var g = new THREE.Group();
    var disc = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.03, 32), new THREE.MeshStandardMaterial({ color: 0x14141f, metalness: 0.7, roughness: 0.15 })); disc.rotation.x = Math.PI / 2; g.add(disc);
    var label = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.035, 20), metalMat(0xff5c8a, 0x5c1a2a)); label.rotation.x = Math.PI / 2; label.position.z = 0.003; g.add(label);
    var hole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.04, 8), new THREE.MeshBasicMaterial({ color: 0x20243c })); hole.rotation.x = Math.PI / 2; hole.position.z = 0.01; g.add(hole);
    g.userData.disc = disc;
    return g;
  }
  function makeIceCream() {
    var g = new THREE.Group();
    var cone = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.4, 12), metalMat(0x8b5e3c, 0x2a1a0a)); cone.rotation.x = Math.PI; cone.position.y = -0.1; g.add(cone);
    var scoop1 = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), new THREE.MeshStandardMaterial({ color: 0xffc0dd, metalness: 0.1, roughness: 0.5, flatShading: true })); scoop1.position.y = 0.18; g.add(scoop1);
    var scoop2 = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 10), new THREE.MeshStandardMaterial({ color: 0xffb454, metalness: 0.1, roughness: 0.5, flatShading: true })); scoop2.position.set(0.06, 0.34, 0); g.add(scoop2);
    var cherry = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), metalMat(0xff5c8a, 0x5c1a2a)); cherry.position.y = 0.48; g.add(cherry);
    return g;
  }
  function makeCrystal2() {
    var g = new THREE.Group();
    var mat = new THREE.MeshStandardMaterial({ color: 0x9a7bff, metalness: 0.7, roughness: 0.18, emissive: 0x7c5cff, emissiveIntensity: 0.5, transparent: true, opacity: 0.9, flatShading: true });
    var c1 = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.7, 6), mat); c1.position.y = 0.2; g.add(c1);
    var c2 = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.5, 6), mat); c2.position.set(0.18, 0.05, 0.08); c2.rotation.z = -0.25; g.add(c2);
    var c3 = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.4, 6), mat); c3.position.set(-0.14, 0, 0.1); c3.rotation.z = 0.3; g.add(c3);
    var c4 = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.35, 6), mat); c4.position.set(0.06, -0.05, -0.12); c4.rotation.z = -0.15; g.add(c4);
    return g;
  }
  function makeWindmill() {
    var g = new THREE.Group();
    var tower = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.6, 6), metalMat(0xf2f2fa, 0x2a2f55)); g.add(tower);
    var hub = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), metalMat(0xff5c8a, 0x5c1a2a)); hub.position.y = 0.32; g.add(hub);
    var blades = new THREE.Group(); blades.position.y = 0.32;
    for (var i = 0; i < 4; i++) {
      var blade = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.35, 0.01), metalMat(0xdfe3ff, 0x2a2f55));
      blade.position.y = 0.18;
      var arm = new THREE.Group(); arm.rotation.z = (i / 4) * Math.PI * 2; arm.add(blade); blades.add(arm);
    }
    g.add(blades);
    g.userData.blades = blades;
    return g;
  }

  function build() {
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x07070c, 0.05);
    camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
    camera.position.set(0, 0, 7);
    group = new THREE.Group();
    scene.add(group);

    // Morphing iridescent blob
    blobMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uAmp: { value: 0.42 }, uFreq: { value: 1.15 } },
      vertexShader: VERT, fragmentShader: FRAG
    });
    blob = new THREE.Mesh(new THREE.SphereGeometry(1.7, 128, 128), blobMat);
    group.add(blob);

    // Halo glow behind
    halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: texGlow(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    halo.scale.set(9, 9, 9); halo.position.z = -1.6;
    group.add(halo);

    // Orbiting wireframe rings
    var ringColors = [0x7c5cff, 0x37e6d5, 0xff5c8a];
    for (var i = 0; i < 0; i++) {
      var r = new THREE.Mesh(new THREE.TorusGeometry(2.7 + i * 0.75, 0.012, 8, 140),
        new THREE.MeshBasicMaterial({ color: ringColors[i], transparent: true, opacity: 0.5 }));
      r.rotation.x = Math.PI / 2 + (i - 1) * 0.5; r.rotation.y = i * 0.6;
      group.add(r); rings.push(r);
    }

    // Floating accent shapes
    var ag = [new THREE.OctahedronGeometry(0.3), new THREE.TorusKnotGeometry(0.22, 0.07, 64, 8), new THREE.IcosahedronGeometry(0.3)];
    var ac = [0x37e6d5, 0xffb454, 0xff5c8a];
    for (var a = 0; a < 0; a++) {
      var am = new THREE.Mesh(ag[a], new THREE.MeshStandardMaterial({ color: ac[a], metalness: 0.6, roughness: 0.3, emissive: ac[a], emissiveIntensity: 0.3, flatShading: true }));
      am.userData = { ang: (a / 3) * Math.PI * 2, rad: 3.7, sp: 0.22 + a * 0.08, yb: rand(-0.6, 0.6) };
      group.add(am); accents.push(am);
    }

    // Floating 3D props â€” everyday objects drifting in the field
    propGroup = new THREE.Group(); scene.add(propGroup);
    var propDefs = [];
    for (var pd = 0; pd < propDefs.length; pd++) {
      var def = propDefs[pd], obj = def.f();
      obj.position.set(def.x, def.y, def.z);
      obj.scale.setScalar(def.s || 1);
      obj.userData = { bx: def.x, by: def.y, ph: rand(0, 6.28), os: rand(0.15, 0.4), oa: rand(0.3, 0.9), rx: rand(-0.006, 0.006), ry: rand(0.004, 0.012), spark: obj.userData && obj.userData.spark, wings: obj.userData && obj.userData.wings, tents: obj.userData && obj.userData.tents, beam: obj.userData && obj.userData.beam, disc: obj.userData && obj.userData.disc, sphere: obj.userData && obj.userData.sphere, needle: obj.userData && obj.userData.needle, needle2: obj.userData && obj.userData.needle2, blades: obj.userData && obj.userData.blades, potBub: obj.userData && obj.userData.potBub };
      propGroup.add(obj); props.push(obj);
    }

    // Satellites â€” small shapes on tilted orbits around the blob.
    var satGeo = [new THREE.OctahedronGeometry(0.14), new THREE.TetrahedronGeometry(0.16), new THREE.BoxGeometry(0.18, 0.18, 0.18), new THREE.TorusGeometry(0.12, 0.04, 8, 20)];
    var satCols = [0x37e6d5, 0xffb454, 0xff5c8a, 0x7c5cff];
    for (var st = 0; st < 0; st++) {
      var sm = new THREE.Mesh(satGeo[st % satGeo.length], new THREE.MeshStandardMaterial({ color: satCols[st % satCols.length], emissive: satCols[st % satCols.length], emissiveIntensity: 0.5, metalness: 0.5, roughness: 0.3, flatShading: true }));
      sm.userData = { ang: (st / 6) * Math.PI * 2, rad: 3.2 + (st % 3) * 0.5, sp: 0.5 + st * 0.07, tilt: 0.5 + st * 0.32, ph: rand(0, 6.28) };
      group.add(sm); satellites.push(sm);
    }

    // Perspective grid drifting under the scene for depth.
    grid = new THREE.GridHelper(60, 60, 0x7c5cff, 0x23284a);
    grid.position.y = -7;
    grid.material.transparent = true; grid.material.opacity = 0.14; grid.material.depthWrite = false;
    // grid removed

    // Shooting stars â€” streak sprites that periodically slash across the field.
    var streakTex = texStreak();
    for (var sk = 0; sk < 3; sk++) {
      var stm = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 3.4), new THREE.MeshBasicMaterial({ map: streakTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      stm.userData = { v: new THREE.Vector3(), life: 0, delay: rand(2, 9) };
      stm.visible = false;
      scene.add(stm); streaks.push(stm);
    }

    // Click bursts â€” expanding rings spawned where the user clicks.
    for (var bu = 0; bu < 4; bu++) {
      var ring = new THREE.Mesh(new THREE.RingGeometry(0.46, 0.5, 48), new THREE.MeshBasicMaterial({ color: bu % 2 ? 0x37e6d5 : 0x7c5cff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      ring.visible = false; ring.userData = { life: 0 };
      scene.add(ring); bursts.push(ring);
    }

    // Enormous slow wireframe shell enclosing everything â€” depth cue.
    shell = new THREE.Mesh(new THREE.IcosahedronGeometry(13, 1), new THREE.MeshBasicMaterial({ color: 0x2a2f55, wireframe: true, transparent: true, opacity: 0.14 }));
    scene.add(shell);

    // Tilted glowing particle halo ring around the blob.
    var hpg = new THREE.BufferGeometry(); var hpos = new Float32Array(160 * 3);
    for (var hpi = 0; hpi < 160; hpi++) {
      var ha = (hpi / 160) * Math.PI * 2, hr = 4.6 + rand(-0.25, 0.25);
      hpos[hpi * 3] = Math.cos(ha) * hr; hpos[hpi * 3 + 1] = rand(-0.12, 0.12); hpos[hpi * 3 + 2] = Math.sin(ha) * hr;
    }
    hpg.setAttribute('position', new THREE.BufferAttribute(hpos, 3));
    haloRing = new THREE.Points(hpg, new THREE.PointsMaterial({ size: 0.07, map: texCircle(), color: 0x8f7bff, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
    haloRing.rotation.x = 0.5;
    group.add(haloRing);

    // Firefly swarm â€” additive points that drift and chase the cursor.
    var FLY = 26;
    var fpg = new THREE.BufferGeometry(); var fpos = new Float32Array(FLY * 3);
    for (var fi = 0; fi < FLY; fi++) { fpos[fi * 3] = rand(-9, 9); fpos[fi * 3 + 1] = rand(-5, 5); fpos[fi * 3 + 2] = rand(-7, -1); }
    fpg.setAttribute('position', new THREE.BufferAttribute(fpos, 3));
    fireflies = new THREE.Points(fpg, new THREE.PointsMaterial({ size: 0.12, map: texCircle(), color: 0x37e6d5, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
    fireflies.userData = { ph: [], sp: [] };
    for (var fj = 0; fj < FLY; fj++) { fireflies.userData.ph.push(rand(0, 6.28)); fireflies.userData.sp.push(rand(0.4, 1.2)); }
    scene.add(fireflies);

    // Shell swarm â€” glowing sprites in loose orbit for a busy-space feel.
    var swarmCols = [0xff5c8a, 0x37e6d5, 0xffb454, 0x7c5cff];
    for (var sw = 0; sw < 12; sw++) {
      var spr2 = new THREE.Sprite(new THREE.SpriteMaterial({ map: texGlow(), color: swarmCols[sw % swarmCols.length], transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
      spr2.scale.setScalar(0.45);
      spr2.userData = { ang: (sw / 12) * Math.PI * 2, rad: rand(5.2, 7.6), sp: rand(0.06, 0.2) * (sw % 2 ? -1 : 1), yb: rand(-4, 4), ph: rand(0, 6.28), orbit: true, baseOp: 0.5, baseS: 0.45 };
      scene.add(spr2); blooms.push(spr2); // pulse with the bloom loop
    }

    // School of fish swimming in V-formation across the scene (removed as requested)
    // var offsets = [[0, 0], [-0.55, -0.3], [-0.55, 0.3], [-1.1, -0.55], [-1.1, 0.55]];
    // for (var fs = 0; fs < offsets.length; fs++) {
    //   var fm = makeFish();
    //   fm.scale.setScalar(fs ? 0.45 : 0.6);
    //   fm.userData = { off: offsets[fs], lead: fs === 0 };
    //   scene.add(fm); fishSchool.push(fm);
    // }

    // Rising 3D bubble streams from the lower corners.
    for (var sb = 0; sb < 12; sb++) {
      var bs = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshStandardMaterial({ color: 0x9adfff, metalness: 0.1, roughness: 0.05, transparent: true, opacity: 0.35, emissive: 0x9adfff, emissiveIntensity: 0.15 }));
      var base = sb % 2 ? { x: rand(-6.5, -5), z: rand(-5, -2.5) } : { x: rand(5, 6.5), z: rand(-5, -2.5) };
      bs.userData = { bx: base.x, bz: base.z, ph: rand(0, 6.28), sp: rand(0.5, 1.2), y: rand(-7.5, 3.5) };
      bs.scale.setScalar(rand(0.05, 0.12));
      scene.add(bs); streamBubbles.push(bs);
    }

    // DNA Helix — double helix of glowing particles orbiting the blob vertically
    var HELIX = 80;
    var hg2 = new THREE.BufferGeometry(); var hpos2 = new Float32Array(HELIX * 2 * 3);
    for (var hi = 0; hi < HELIX; hi++) {
      var ha2 = (hi / HELIX) * Math.PI * 8, hy = (hi / HELIX) * 10 - 5;
      hpos2[hi * 6] = Math.cos(ha2) * 1.8; hpos2[hi * 6 + 1] = hy; hpos2[hi * 6 + 2] = Math.sin(ha2) * 1.8;
      hpos2[hi * 6 + 3] = Math.cos(ha2 + Math.PI) * 1.8; hpos2[hi * 6 + 4] = hy; hpos2[hi * 6 + 5] = Math.sin(ha2 + Math.PI) * 1.8;
    }
    hg2.setAttribute('position', new THREE.BufferAttribute(hpos2, 3));
    dnaHelix = new THREE.Points(hg2, new THREE.PointsMaterial({ size: 0.09, map: texCircle(), color: 0x37e6d5, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
    dnaHelix.position.x = -4;
    group.add(dnaHelix);

    // Aurora Ribbon — flowing translucent ribbon above the scene
    var ribGeo = new THREE.PlaneGeometry(12, 1.2, 60, 2);
    var ribMat = new THREE.MeshBasicMaterial({ color: 0x7c5cff, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    auroraRibbon = new THREE.Mesh(ribGeo, ribMat);
    auroraRibbon.position.set(0, 5.5, -6);
    auroraRibbon.rotation.x = -0.4;
    scene.add(auroraRibbon);

    // Falling Leaf Particles — drifting down from above
    var LEAF = 40;
    var lg2 = new THREE.BufferGeometry(); var lpos = new Float32Array(LEAF * 3); var lspd = new Float32Array(LEAF);
    for (var li = 0; li < LEAF; li++) { lpos[li * 3] = rand(-14, 14); lpos[li * 3 + 1] = rand(5, 15); lpos[li * 3 + 2] = rand(-12, 2); lspd[li] = rand(0.08, 0.25); }
    lg2.setAttribute('position', new THREE.BufferAttribute(lpos, 3));
    leafParticles = new THREE.Points(lg2, new THREE.PointsMaterial({ size: 0.12, map: texCircle(), color: 0xff9ec4, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
    leafParticles.userData = { speeds: lspd };
    scene.add(leafParticles);

    // Click Shockwave Rings — expanding rings from click point
    for (var swi = 0; swi < 3; swi++) {
      var swr = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.56, 48), new THREE.MeshBasicMaterial({ color: 0x37e6d5, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      swr.visible = false; swr.userData = { life: 0, delay: 0 };
      scene.add(swr); shockwaves.push(swr);
    }

    // Lightning Orb — electric orb with glowing arcs near the blob
    orbLightning = new THREE.Group();
    var orbCore = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 12), new THREE.MeshBasicMaterial({ color: 0x7c5cff, transparent: true, opacity: 0.8 }));
    orbLightning.add(orbCore);
    for (var oi = 0; oi < 6; oi++) {
      var arc = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.8, 4), new THREE.MeshBasicMaterial({ color: 0x9adfff, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending }));
      var oa3 = (oi / 6) * Math.PI * 2;
      arc.position.set(Math.cos(oa3) * 0.3, Math.sin(oa3) * 0.3, 0);
      arc.lookAt(0, 0, 0);
      orbLightning.add(arc);
    }
    orbLightning.position.set(4.5, 2.5, -3);
    scene.add(orbLightning);

    // Proximity Glow — sprite that follows the cursor with delay
    proximityGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: texGlow(), color: 0x7c5cff, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false }));
    proximityGlow.scale.set(3, 3, 3);
    proximityGlow.position.z = -2;
    scene.add(proximityGlow);

    // Particles
    var pg = new THREE.BufferGeometry(); var pos = new Float32Array(PARTICLES * 3);
    for (var p = 0; p < PARTICLES; p++) { pos[p * 3] = rand(-16, 16); pos[p * 3 + 1] = rand(-10, 10); pos[p * 3 + 2] = rand(-14, 4); }
    pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    particles = new THREE.Points(pg, new THREE.PointsMaterial({ size: 0.09, map: texCircle(), color: 0x9aa0d0, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
    scene.add(particles);

    // Rising bubbles particle system
    var BUBBLES = 120;
    var bg = new THREE.BufferGeometry(); var bpos = new Float32Array(BUBBLES * 3); var bspd = new Float32Array(BUBBLES);
    for (var b = 0; b < BUBBLES; b++) { bpos[b * 3] = rand(-14, 14); bpos[b * 3 + 1] = rand(-10, 10); bpos[b * 3 + 2] = rand(-12, 2); bspd[b] = rand(0.15, 0.5); }
    bg.setAttribute('position', new THREE.BufferAttribute(bpos, 3));
    bubbles = new THREE.Points(bg, new THREE.PointsMaterial({ size: 0.14, map: texCircle(), color: 0x9adfff, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
    scene.add(bubbles);
    bubbles.userData = { speeds: bspd };

    // Bloom glow sprites behind key objects
    var bloomPositions = [
      { x: 0, y: 0, z: -1.5, s: 10, c: 0x7c5cff, o: 0.3 },
      { x: -5, y: 2, z: -3.5, s: 5, c: 0xff5c8a, o: 0.2 },
      { x: 5.2, y: -1.8, z: -2.5, s: 5, c: 0x37e6d5, o: 0.2 },
      { x: 0.6, y: 3, z: -5.5, s: 4, c: 0xffb454, o: 0.2 },
      { x: -2.5, y: -3.2, z: -4, s: 4, c: 0xffb454, o: 0.15 },
      { x: 2.8, y: -3, z: -4.5, s: 4, c: 0x7c5cff, o: 0.2 }
    ];
    for (var bl = 0; bl < bloomPositions.length; bl++) {
      var bp = bloomPositions[bl];
      var spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: texGlow(), color: bp.c, transparent: true, opacity: bp.o, blending: THREE.AdditiveBlending, depthWrite: false }));
      spr.position.set(bp.x, bp.y, bp.z); spr.scale.set(bp.s, bp.s, bp.s);
      spr.userData = { baseOp: bp.o, baseS: bp.s };
      scene.add(spr); blooms.push(spr);
    }

    // Lights (for accent shapes)
    scene.add(new THREE.AmbientLight(0x404060, 0.8));
    var lc = [0x7c5cff, 0x37e6d5, 0xff5c8a];
    for (var l = 0; l < 3; l++) {
      var pl = new THREE.PointLight(lc[l], 1.5, 30);
      pl.userData = { ang: l * 2.1, rad: 6, sp: 0.3 + l * 0.1 };
      scene.add(pl); lights.push(pl);
    }
  }

  function resize() {
    if (!renderer) return;
    W = window.innerWidth || 1; H = window.innerHeight || 1;
    var dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
    renderer.setPixelRatio(dpr); renderer.setSize(W, H, false);
    camera.aspect = W / H; camera.updateProjectionMatrix();
    if (group) {
      if (W > 860) { group.position.x = 2.4; group.position.y = 0; group.scale.set(1, 1, 1); }
      else if (W > 640) { group.position.x = 0; group.position.y = -1.5; group.scale.set(0.78, 0.78, 0.78); }
      else { group.position.x = 0; group.position.y = -2.3; group.scale.set(0.6, 0.6, 0.6); }
    }
    var ringOp = W < 640 ? 0.2 : W <= 860 ? 0.32 : 0.5;
    for (var ri = 0; ri < rings.length; ri++) rings[ri].material.opacity = ringOp;
    if (propGroup) {
      var ps = W < 640 ? 0.6 : W <= 860 ? 0.8 : 1;
      propGroup.scale.set(ps, ps, ps);
      propGroup.position.y = W <= 860 ? -1.2 : 0;
    }
    if (grid) grid.visible = W >= 760;
    if (shell) shell.visible = W >= 760;
  }

  function animate() {
    raf = requestAnimationFrame(animate);
    if (!running) return;
    var t = clock.getElapsedTime();
    mouse.x += (mouse.tx - mouse.x) * 0.05; mouse.y += (mouse.ty - mouse.y) * 0.05;

    // blob morph: amplitude breathes with scroll, cursor speed and time
    mouse.excite *= 0.94;
    spinAcc += (scrollP - lastScrollP) * 7; lastScrollP = scrollP;
    blobMat.uniforms.uTime.value = t;
    blobMat.uniforms.uAmp.value = 0.4 + scrollP * 0.35 + Math.sin(t * 0.5) * 0.06 + Math.min(0.25, mouse.excite);
    blobMat.uniforms.uFreq.value = 1.15 + scrollP * 0.6;
    blob.rotation.y = t * 0.15 + spinAcc; blob.rotation.x = Math.sin(t * 0.2) * 0.2;
    // Blob stretch toward cursor (d reactivity)
    var stretchX = 1 + Math.abs(mouse.x) * 0.12, stretchY = 1 + Math.abs(mouse.y) * 0.1;
    blob.scale.set(stretchX, stretchY, 2 - (stretchX + stretchY) / 2);
    // Scroll-driven hue shift on the blob
    blobMat.uniforms.uTime.value = t + scrollP * 2.5;

    for (var i = 0; i < rings.length; i++) {
      rings[i].rotation.z = t * (0.15 + i * 0.05) * (i % 2 ? -1 : 1);
      rings[i].rotation.x = Math.PI / 2 + (i - 1) * 0.5 + Math.sin(t * 0.3 + i) * 0.15;
    }
    for (var a = 0; a < accents.length; a++) {
      var ac = accents[a], u = ac.userData, ang = u.ang + t * u.sp;
      ac.position.set(Math.cos(ang) * u.rad, u.yb + Math.sin(t * 0.6 + a) * 0.4, Math.sin(ang) * u.rad);
      ac.rotation.x = t * 0.6; ac.rotation.y = t * 0.4;
    }
    for (var pr = 0; pr < props.length; pr++) {
      var o = props[pr], d = o.userData;
      o.rotation.x += d.rx; o.rotation.y += d.ry;
      var tx = d.bx + Math.sin(t * d.os + d.ph) * d.oa;
      var ty = d.by + Math.cos(t * d.os * 0.8 + d.ph) * d.oa * 0.7;
      // Cursor gravity: props near the pointer's world position lean toward it (with parallax depth).
      var dist7 = 7 - o.position.z;
      var hh = Math.tan(0.4803) * dist7, hw = hh * (W / (H || 1));
      var cxw = mouse.x * hw, cyw = -mouse.y * hh;
      var gdx = cxw - o.position.x, gdy = cyw - o.position.y;
      var gd = Math.sqrt(gdx * gdx + gdy * gdy);
      // Parallax: closer props (z > -4) move more, far props move less
      var parallax = Math.max(0.02, Math.min(0.25, (o.position.z + 7) / 14)) * 0.8;
      if (gd < 3.5) { tx += gdx * parallax; ty += gdy * parallax; }
      if (scatterT > 0) {
        var dx = o.position.x - group.position.x, dy = o.position.y;
        var dist = Math.sqrt(dx * dx + dy * dy) || 1;
        tx += (dx / dist) * scatterT * 3;
        ty += (dy / dist) * scatterT * 3;
      }
      o.position.x += (tx - o.position.x) * 0.06;
      o.position.y += (ty - o.position.y) * 0.06;
    }
    if (scatterT > 0) scatterT -= 0.016;
    if (propGroup) propGroup.rotation.y = scrollP * 0.7;

    // Satellites on tilted orbits
    for (var sAt = 0; sAt < satellites.length; sAt++) {
      var sat = satellites[sAt], su = sat.userData, sa = su.ang + t * su.sp;
      sat.position.set(Math.cos(sa) * su.rad, Math.sin(sa + su.tilt) * su.rad * 0.45 + Math.sin(t * 0.8 + su.ph) * 0.2, Math.sin(sa) * su.rad * Math.cos(su.tilt * 0.35));
      sat.rotation.x = t * 0.9; sat.rotation.z = t * 0.5;
    }

    // Bomb sparks flicker + bee wing flutter + jelly tentacle sway + new prop animations
    for (var pw = 0; pw < props.length; pw++) {
      var ud = props[pw].userData;
      if (ud.spark) ud.spark.visible = Math.sin(t * 14 + pw) > -0.35;
      if (ud.wings) { var wf = Math.sin(t * 26 + pw) * 0.5 + 0.6; ud.wings[0].rotation.x = wf * 0.5; ud.wings[1].rotation.x = -wf * 0.5; }
      if (ud.tents) for (var ti = 0; ti < ud.tents.length; ti++) {
        ud.tents[ti].rotation.z = Math.sin(t * 2.2 + ti * 1.1 + pw) * 0.3;
        ud.tents[ti].rotation.x = Math.cos(t * 1.7 + ti) * 0.2;
      }
      // Windmill blades spin
      if (ud.blades) ud.blades.rotation.z = t * 1.8 + pw;
      // Lighthouse beam rotates
      if (ud.beam) { var ba = t * 1.2 + pw; ud.beam.position.x = Math.cos(ba) * 1.4; ud.beam.position.z = Math.sin(ba) * 1.4; ud.beam.material.opacity = 0.3 + Math.sin(t * 3 + pw) * 0.15; }
      // Globe sphere spins
      if (ud.sphere) ud.sphere.rotation.y = t * 0.5 + pw;
      // Vinyl disc spins
      if (ud.disc) ud.disc.rotation.y = t * 3.5 + pw;
      // Compass needle oscillates
      if (ud.needle) { ud.needle.rotation.z = Math.sin(t * 0.8 + pw) * 0.4; ud.needle2.rotation.z = Math.sin(t * 0.8 + pw) * 0.4; }
      // Potion bubble rises
      if (ud.potBub) { var by = -0.08 + Math.sin(t * 1.5 + pw) * 0.08; ud.potBub.position.y = by; ud.potBub.material.opacity = 0.4 + Math.sin(t * 2 + pw) * 0.2; }
    }

    // Drifting grid under the scene
    if (grid) grid.position.z = (t * 0.4) % 1;

    // Wireframe shell slow rotation
    if (shell) { shell.rotation.y = t * 0.02; shell.rotation.x = 0.3 + Math.sin(t * 0.05) * 0.1; }

    // Halo ring around the blob
    if (haloRing) { haloRing.rotation.y = t * 0.25; haloRing.rotation.z = Math.sin(t * 0.2) * 0.1; }

    // Fireflies: drift + gentle chase toward the cursor column
    if (fireflies) {
      var fArr = fireflies.geometry.attributes.position.array;
      var fph = fireflies.userData.ph, fsp = fireflies.userData.sp;
      for (var fk = 0; fk < fph.length; fk++) {
        var fx = fk * 3;
        fArr[fx] += Math.sin(t * fsp[fk] + fph[fk]) * 0.012 + (mouse.x * 6 - fArr[fx]) * 0.0008;
        fArr[fx + 1] += Math.cos(t * fsp[fk] * 0.8 + fph[fk]) * 0.008 + (-mouse.y * 4 - fArr[fx + 1]) * 0.0006;
      }
      fireflies.geometry.attributes.position.needsUpdate = true;
    }

    // Fish school on a Lissajous path; leader faces along its velocity
    if (fishSchool.length) {
      var sx = Math.sin(t * 0.13) * 6.5, sy = Math.sin(t * 0.34) * 1.7 + 1.2, sz = Math.cos(t * 0.1) * 4 - 3;
      var vx = Math.cos(t * 0.13) * 6.5 * 0.13, vy = Math.cos(t * 0.34) * 1.7 * 0.34;
      for (var fs2 = 0; fs2 < fishSchool.length; fs2++) {
        var sfx = fishSchool[fs2], o2 = sfx.userData.off;
        sfx.position.set(sx + o2[0], sy + o2[1], sz);
        sfx.rotation.y = vx >= 0 ? -1.57 : 1.57;
        sfx.rotation.z = Math.sin(t * 4 + fs2) * 0.08 + vy * 0.25;
      }
    }

    // Rising 3D bubble streams
    for (var sb2 = 0; sb2 < streamBubbles.length; sb2++) {
      var bub = streamBubbles[sb2], ub = bub.userData;
      ub.y += ub.sp * 0.016;
      if (ub.y > 6.5) ub.y = -7.5;
      bub.position.set(ub.bx + Math.sin(t * 1.6 + ub.ph) * 0.22, ub.y, ub.bz + Math.cos(t * 1.3 + ub.ph) * 0.18);
    }

    // DNA Helix rotation
    if (dnaHelix) {
      dnaHelix.rotation.y = t * 0.3;
      var hArr = dnaHelix.geometry.attributes.position.array;
      for (var hi2 = 0; hi2 < 80; hi2++) {
        var ha3 = (hi2 / 80) * Math.PI * 8 + t * 0.5, hy2 = (hi2 / 80) * 10 - 5;
        hArr[hi2 * 6] = Math.cos(ha3) * 1.8; hArr[hi2 * 6 + 2] = Math.sin(ha3) * 1.8;
        hArr[hi2 * 6 + 3] = Math.cos(ha3 + Math.PI) * 1.8; hArr[hi2 * 6 + 5] = Math.sin(ha3 + Math.PI) * 1.8;
      }
      dnaHelix.geometry.attributes.position.needsUpdate = true;
    }

    // Aurora Ribbon wave
    if (auroraRibbon) {
      var ribPos = auroraRibbon.geometry.attributes.position.array;
      for (var ri2 = 0; ri2 < ribPos.length; ri2 += 3) {
        var rx = ribPos[ri2];
        ribPos[ri2 + 1] = Math.sin(rx * 0.5 + t * 0.8) * 0.4 + Math.sin(rx * 0.3 + t * 0.4) * 0.3;
      }
      auroraRibbon.geometry.attributes.position.needsUpdate = true;
      auroraRibbon.rotation.y = t * 0.04;
      auroraRibbon.material.opacity = 0.14 + Math.sin(t * 0.6) * 0.06;
    }

    // Falling leaf particles
    if (leafParticles) {
      var lArr = leafParticles.geometry.attributes.position.array;
      var lSpd = leafParticles.userData.speeds;
      for (var li2 = 0; li2 < lSpd.length; li2++) {
        lArr[li2 * 3 + 1] -= lSpd[li2] * 0.016;
        lArr[li2 * 3] += Math.sin(t * 0.6 + li2) * 0.004;
        if (lArr[li2 * 3 + 1] < -8) { lArr[li2 * 3 + 1] = 10; lArr[li2 * 3] = rand(-14, 14); }
      }
      leafParticles.geometry.attributes.position.needsUpdate = true;
    }

    // Shockwave rings (triggered by click in onScatter)
    for (var swi2 = 0; swi2 < shockwaves.length; swi2++) {
      var swr2 = shockwaves[swi2];
      if (swr2.userData.life > 0) {
        swr2.userData.life -= 0.016;
        var sk = 1 - swr2.userData.life / 1.2;
        swr2.scale.setScalar(0.5 + sk * 8);
        swr2.material.opacity = Math.max(0, (1 - sk)) * 0.6;
        if (swr2.userData.life <= 0) { swr2.visible = false; swr2.material.opacity = 0; }
      }
    }

    // Lightning orb arcs flicker and rotate
    if (orbLightning) {
      orbLightning.rotation.y = t * 0.5;
      orbLightning.rotation.x = Math.sin(t * 0.3) * 0.3;
      for (var oi2 = 1; oi2 < orbLightning.children.length; oi2++) {
        var arc2 = orbLightning.children[oi2];
        arc2.visible = Math.sin(t * 12 + oi2 * 2.1) > -0.2;
        arc2.material.opacity = 0.3 + Math.sin(t * 8 + oi2) * 0.3;
        arc2.scale.setScalar(0.8 + Math.sin(t * 6 + oi2 * 1.7) * 0.3);
      }
    }

    // Proximity glow follows cursor with delay
    if (proximityGlow) {
      var pgx = mouse.x * 5, pgy = -mouse.y * 3.5;
      proximityGlow.position.x += (pgx - proximityGlow.position.x) * 0.04;
      proximityGlow.position.y += (pgy - proximityGlow.position.y) * 0.04;
      proximityGlow.material.opacity = 0.2 + mouse.excite * 0.5;
    }

    // Shooting stars
    for (var sk2 = 0; sk2 < streaks.length; sk2++) {
      var stm2 = streaks[sk2], sud = stm2.userData;
      if (sud.life > 0) {
        stm2.position.add(sud.v);
        sud.life -= 0.016;
        sud.flick = (sud.flick || 1) * 0.985;
        stm2.material.opacity = Math.min(1, sud.life * 2.5) * sud.flick * 0.85;
        if (sud.life <= 0) { stm2.visible = false; stm2.material.opacity = 0; sud.delay = rand(3, 9); }
      } else {
        sud.delay -= 0.016;
        if (sud.delay <= 0) {
          stm2.position.set(rand(-4, 12), rand(4, 9), rand(-8, -3));
          var sp = rand(0.12, 0.22);
          sud.v.set(-sp * rand(0.5, 1), -sp, 0);
          var ang = Math.atan2(-sud.v.y, sud.v.x) - Math.PI / 2;
          stm2.rotation.z = ang;
          sud.flick = 1;
          sud.life = rand(1.2, 2.2);
          stm2.visible = true;
        }
      }
    }

    // Expanding click bursts
    for (var br = 0; br < bursts.length; br++) {
      var bg2 = bursts[br];
      if (bg2.userData.life > 0) {
        bg2.userData.life -= 0.016;
        var k = 1 - bg2.userData.life / 0.7;
        bg2.scale.setScalar(0.5 + k * 4.5);
        bg2.material.opacity = Math.max(0, (1 - k)) * 0.8;
        if (bg2.userData.life <= 0) { bg2.visible = false; bg2.material.opacity = 0; }
      }
    }

    for (var l = 0; l < lights.length; l++) {
      var pl = lights[l], lu = pl.userData, la = lu.ang + t * lu.sp;
      pl.position.set(Math.cos(la) * lu.rad, Math.sin(la * 0.8) * 3, Math.sin(la) * lu.rad);
    }
    particles.rotation.y = t * 0.02; particles.position.z = scrollP * 6;

    // Rising bubbles
    if (bubbles) {
      var bArr = bubbles.geometry.attributes.position.array;
      var bSpd = bubbles.userData.speeds;
      for (var bi = 0; bi < bSpd.length; bi++) {
        bArr[bi * 3 + 1] += bSpd[bi] * 0.016;
        bArr[bi * 3] += Math.sin(t * 0.8 + bi) * 0.003;
        if (bArr[bi * 3 + 1] > 10) { bArr[bi * 3 + 1] = -10; bArr[bi * 3] = rand(-14, 14); }
      }
      bubbles.geometry.attributes.position.needsUpdate = true;
      bubbles.rotation.y = t * 0.015;
    }

    // Pulsing blooms (and orbiting swarm sprites)
    for (var bl = 0; bl < blooms.length; bl++) {
      var bm = blooms[bl], pulse = 1 + Math.sin(t * 1.2 + bl * 1.5) * 0.12;
      bm.material.opacity = bm.userData.baseOp * pulse;
      bm.scale.set(bm.userData.baseS * pulse, bm.userData.baseS * pulse, bm.userData.baseS * pulse);
      if (bm.userData.orbit) {
        var ou = bm.userData, oa2 = ou.ang + t * ou.sp;
        bm.position.set(Math.cos(oa2) * ou.rad, ou.yb + Math.sin(t * 0.4 + ou.ph) * 0.6, Math.sin(oa2) * ou.rad * 0.6 - 2);
      }
    }

    camera.position.x += (mouse.x * 1.4 - camera.position.x) * 0.05;
    camera.position.y += (-mouse.y * 1.0 - camera.position.y) * 0.05;
    camera.position.z = 7 - scrollP * 2.5;
    group.rotation.y = mouse.x * 0.25; group.rotation.x = -mouse.y * 0.18;
    camera.lookAt(group.position.x * 0.3, 0, 0);

    renderer.render(scene, camera);
  }

  function staticRender() { if (renderer && scene && camera) { blobMat.uniforms.uTime.value = 1.2; renderer.render(scene, camera); } }

  function onMove(e) {
    var nx = (e.clientX / window.innerWidth) * 2 - 1, ny = (e.clientY / window.innerHeight) * 2 - 1;
    var dvx = nx - mouse.tx, dvy = ny - mouse.ty;
    mouse.excite += Math.min(0.2, Math.sqrt(dvx * dvx + dvy * dvy) * 1.4);
    mouse.tx = nx; mouse.ty = ny;
  }
  var raycaster = new THREE.Raycaster(), burstPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), burstVec = new THREE.Vector3(), burstIdx = 0, shockIdx = 0;
  function onScatter(e) {
    scatterT = 1.2;
    if (reduced || !scene || !camera) return;
    try {
      raycaster.setFromCamera({ x: (e.clientX / window.innerWidth) * 2 - 1, y: -(e.clientY / window.innerHeight) * 2 + 1 }, camera);
      if (raycaster.ray.intersectPlane(burstPlane, burstVec)) {
        var ring = bursts[burstIdx % bursts.length]; burstIdx++;
        ring.position.copy(burstVec);
        ring.lookAt(camera.position);
        ring.userData.life = 0.7;
        ring.visible = true;
        // Trigger shockwave ring too
        var sw = shockwaves[shockIdx % shockwaves.length]; shockIdx++;
        sw.position.copy(burstVec);
        sw.lookAt(camera.position);
        sw.userData.life = 1.2;
        sw.visible = true;
      }
    } catch (err) { /* burst is decorative; never break interaction */ }
  }
  var hoverTarget = null;

  function boot(canvasEl) {
    if (booted || !canvasEl) return null;
    try { renderer = new THREE.WebGLRenderer({ canvas: canvasEl, alpha: true, antialias: true, powerPreference: 'high-performance' }); }
    catch (err) { return null; }
    canvas = canvasEl; host = canvasEl.parentElement || null; booted = true; disposed = false;
    clock = new THREE.Clock();
    try { if (window.matchMedia) reduced = !!window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { reduced = false; }
    build(); resize();
    if (window.ResizeObserver) { ro = new ResizeObserver(resize); ro.observe(host || canvas); } else window.addEventListener('resize', resize);
    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('click', onScatter);
    if (reduced) { staticRender(); } else { running = true; raf = requestAnimationFrame(animate); }
    return function teardown() {
      disposed = true; running = false;
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      window.removeEventListener('pointermove', onMove);
      if (ro) { ro.disconnect(); ro = null; } else window.removeEventListener('resize', resize);
      if (renderer) renderer.dispose();
      scene = null; camera = null; renderer = null; booted = false;
    };
  }

  function pause(should) {
    if (should) { running = false; if (raf) { cancelAnimationFrame(raf); raf = 0; } }
    else if (booted && !reduced && !running && renderer) { running = true; raf = requestAnimationFrame(animate); }
  }
  function setReducedMotion(v) {
    reduced = !!v;
    if (reduced) { pause(true); staticRender(); }
    else if (booted && renderer && !running) { pause(false); }
  }
  function setScroll(p) { scrollP = Math.max(0, Math.min(1, p || 0)); if (!running) staticRender(); }

  window.WompThree = { boot: boot, pause: pause, setReducedMotion: setReducedMotion, setScroll: setScroll };
})();
