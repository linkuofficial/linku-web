/* ============================================================
   LINKU brand scene — gimbal-core render engine (zero deps).

   Layers   L0 far starfield → L1 gimbal machine (studio env light,
            SDF-baked vertex AO, MSAA) → L2 accretion particles.
   Post     bright pass → 3-level bloom pyramid → ACES composite
            (tone map, shadow blue-shift, vignette, dither).
   Ladder   WebGL2 + half-float FBO: full pipeline
            → WebGL1 / no float FBO: direct draw, tone map in shader
            → no GL: one static 2D frame.
   Modes    home pages ([data-screen-label="Hero"]): scroll drives the
            scene — Hero assembled/running → Statement push-in on the
            core → Pillars exploded view, lit pillar by pillar →
            Contact re-lock + pulse. Inner pages: quiet ambient.
   Motion   prefers-reduced-motion: one settled frame + a small
            injected play/pause toggle (opt-in motion).
   Perf     DPR cap + max buffer edge, idle → 30fps, hidden → stop,
            sustained low FPS tiers down (bloom off → lower res →
            static), context-lost recovery. Resize never rebuilds
            geometry, so mobile URL-bar changes cannot flash.
   Dev      #still — freeze one frame and overlay it as an <img>
            (screenshot-safe); #reduce — force the reduced path.
   ============================================================ */
(function () {
  'use strict';

  var canvas = document.getElementById('particles');
  if (!canvas) return;

  var HASH = location.hash || '';
  var STILL = HASH.indexOf('still') >= 0;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    || HASH.indexOf('reduce') >= 0 || STILL;
  var HOME = !!document.querySelector('[data-screen-label="Hero"]');
  var docLang = document.documentElement.getAttribute('lang') || 'en';

  /* ---------------- geometry (C3 gimbal core) ---------------- */
  var pos = [], nrm = [], typ = [], rnd = [];
  function tri(a, b, c, type, r) {
    var ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    var vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    var l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    var pts = [a, b, c];
    for (var i = 0; i < 3; i++) {
      var p = pts[i];
      pos.push(p[0], p[1], p[2]); nrm.push(nx, ny, nz); typ.push(type); rnd.push(r);
    }
  }
  function quadOut(a, b, c, d, ref, type, r) {
    var ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    var vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    var cx = (a[0] + b[0] + c[0] + d[0]) / 4 - ref[0];
    var cy = (a[1] + b[1] + c[1] + d[1]) / 4 - ref[1];
    var cz = (a[2] + b[2] + c[2] + d[2]) / 4 - ref[2];
    if (nx * cx + ny * cy + nz * cz < 0) { tri(a, d, c, type, r); tri(a, c, b, type, r); }
    else { tri(a, b, c, type, r); tri(a, c, d, type, r); }
  }
  var objects = {}, cur = null;
  function beginObj(name) { cur = { start: pos.length / 3 }; objects[name] = cur; }
  function endObj() { cur.count = pos.length / 3 - cur.start; }

  // ring: sweep an arbitrary closed profile [(u,v)...] around Y; diagonal
  // segments (chamfers) become type 1 so the shader can run signal light on them
  function buildRing(name, R, profile, segs) {
    beginObj(name);
    var m = profile.length, s, i;
    var segType = [];
    for (i = 0; i < m; i++) {
      var p0 = profile[i], q0 = profile[(i + 1) % m];
      segType.push((Math.abs(p0[0] - q0[0]) > 1e-6 && Math.abs(p0[1] - q0[1]) > 1e-6) ? 1 : 0);
    }
    function map(u, v, th) { return [(R + u) * Math.cos(th), v, (R + u) * Math.sin(th)]; }
    for (s = 0; s < segs; s++) {
      var th0 = s / segs * Math.PI * 2, th1 = (s + 1) / segs * Math.PI * 2;
      var thm = (th0 + th1) / 2;
      var ref = [R * Math.cos(thm), 0, R * Math.sin(thm)];
      var ang = s / segs; // angular position 0..1 — drives the traveling signal band
      for (i = 0; i < m; i++) {
        var p = profile[i], q = profile[(i + 1) % m];
        quadOut(map(p[0], p[1], th0), map(q[0], q[1], th0), map(q[0], q[1], th1), map(p[0], p[1], th1),
          ref, segType[i], ang);
      }
    }
    endObj();
  }
  function groovedProfile(t, h, c, g, d) {
    return [
      [-t / 2 + c, h / 2], [t / 2 - c, h / 2], [t / 2, h / 2 - c],
      [t / 2, g / 2], [t / 2 - d, g / 2], [t / 2 - d, -g / 2], [t / 2, -g / 2],
      [t / 2, -h / 2 + c], [t / 2 - c, -h / 2], [-t / 2 + c, -h / 2],
      [-t / 2, -h / 2 + c], [-t / 2, h / 2 - c],
    ];
  }
  function chamferProfile(t, h, c) {
    return [
      [-t / 2 + c, h / 2], [t / 2 - c, h / 2], [t / 2, h / 2 - c], [t / 2, -h / 2 + c],
      [t / 2 - c, -h / 2], [-t / 2 + c, -h / 2], [-t / 2, -h / 2 + c], [-t / 2, h / 2 - c],
    ];
  }
  function buildBox(name, cx, cy, cz, sx, sy, sz, type) {
    beginObj(name);
    var x0 = cx - sx / 2, x1 = cx + sx / 2, y0 = cy - sy / 2, y1 = cy + sy / 2, z0 = cz - sz / 2, z1 = cz + sz / 2;
    var ref = [cx, cy, cz], r = Math.abs(Math.sin(cx * 12.9 + cz * 78.2));
    quadOut([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], ref, type, r);
    quadOut([x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0], ref, type, r);
    quadOut([x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], ref, type, r);
    quadOut([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], ref, type, r);
    quadOut([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], ref, type, r);
    quadOut([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], ref, type, r);
    endObj();
  }
  function icosphere(sub) {
    function nn(p) { var l = Math.hypot(p[0], p[1], p[2]); return [p[0] / l, p[1] / l, p[2] / l]; }
    function mid(a, b) { return nn([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]); }
    var t0 = (1 + Math.sqrt(5)) / 2;
    var iv = [[-1, t0, 0], [1, t0, 0], [-1, -t0, 0], [1, -t0, 0], [0, -1, t0], [0, 1, t0], [0, -1, -t0], [0, 1, -t0], [t0, 0, -1], [t0, 0, 1], [-t0, 0, -1], [-t0, 0, 1]].map(nn);
    var ifc = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
    var tris = ifc.map(function (f) { return [iv[f[0]], iv[f[1]], iv[f[2]]]; });
    for (var s = 0; s < sub; s++) {
      var nt = [];
      for (var k = 0; k < tris.length; k++) {
        var a = tris[k][0], b = tris[k][1], c = tris[k][2];
        var ab = mid(a, b), bc = mid(b, c), ca = mid(c, a);
        nt.push([a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]);
      }
      tris = nt;
    }
    return tris;
  }
  // core: shell plates shrunk toward each face centroid + lifted along the
  // normal (light leaks through the seams) over an inner emissive sphere
  function buildCore(nameShell, nameGlow, r) {
    beginObj(nameShell);
    icosphere(2).forEach(function (f, fi) {
      var A = f[0].map(function (v) { return v * r; });
      var B = f[1].map(function (v) { return v * r; });
      var C = f[2].map(function (v) { return v * r; });
      var m = [(A[0] + B[0] + C[0]) / 3, (A[1] + B[1] + C[1]) / 3, (A[2] + B[2] + C[2]) / 3];
      var ml = Math.hypot(m[0], m[1], m[2]);
      var nl = [m[0] / ml, m[1] / ml, m[2] / ml];
      var lift = 0.010;
      function sk(p) {
        return [
          m[0] + (p[0] - m[0]) * 0.90 + nl[0] * lift,
          m[1] + (p[1] - m[1]) * 0.90 + nl[1] * lift,
          m[2] + (p[2] - m[2]) * 0.90 + nl[2] * lift,
        ];
      }
      var rr = Math.abs(Math.sin(fi * 127.1));
      var A2 = sk(A), B2 = sk(B), C2 = sk(C);
      var ux = B2[0] - A2[0], uy = B2[1] - A2[1], uz = B2[2] - A2[2];
      var vx = C2[0] - A2[0], vy = C2[1] - A2[1], vz = C2[2] - A2[2];
      var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      if (nx * m[0] + ny * m[1] + nz * m[2] < 0) tri(A2, C2, B2, 2, rr); else tri(A2, B2, C2, 2, rr);
    });
    endObj();
    beginObj(nameGlow);
    icosphere(1).forEach(function (f, fi) {
      var rg = r * 0.90;
      var A = f[0].map(function (v) { return v * rg; });
      var B = f[1].map(function (v) { return v * rg; });
      var C = f[2].map(function (v) { return v * rg; });
      var m = [(A[0] + B[0] + C[0]) / 3, (A[1] + B[1] + C[1]) / 3, (A[2] + B[2] + C[2]) / 3];
      var ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2];
      var vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
      var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      var rr = Math.abs(Math.sin(fi * 311.7));
      if (nx * m[0] + ny * m[1] + nz * m[2] < 0) tri(A, C, B, 3, rr); else tri(A, B, C, 3, rr);
    });
    endObj();
  }

  var R_OUT = 1.14, R_IN = 0.76, R_CORE = 0.335;
  var T_OUT = 0.10, H_OUT = 0.30, T_IN = 0.075, H_IN = 0.16;
  buildRing('out', R_OUT, groovedProfile(T_OUT, H_OUT, 0.022, 0.10, 0.024), 112);
  buildRing('in', R_IN, chamferProfile(T_IN, H_IN, 0.018), 96);
  var bossOuterEdge = R_OUT - T_OUT / 2 + 0.01;
  buildBox('bossPX', (bossOuterEdge - 0.09), 0, 0, 0.20, 0.17, 0.13, 4);
  buildBox('bossNX', -(bossOuterEdge - 0.09), 0, 0, 0.20, 0.17, 0.13, 4);
  var pinOut = bossOuterEdge - 0.18, pinIn = R_IN + T_IN / 2 - 0.01;
  buildBox('pinPX', (pinOut + pinIn) / 2, 0, 0, pinOut - pinIn + 0.02, 0.055, 0.055, 4);
  buildBox('pinNX', -(pinOut + pinIn) / 2, 0, 0, pinOut - pinIn + 0.02, 0.055, 0.055, 4);
  buildCore('coreShell', 'coreGlow', R_CORE);

  /* SDF-baked vertex AO — rings approximated as shells (rotation-invariant),
     each ring uses its exact torus against itself */
  function bakeAO() {
    function sdShell(p, R, th) { return Math.abs(Math.hypot(p[0], p[1], p[2]) - R) - th; }
    function sdTorus(p, R, tr) { return Math.hypot(Math.hypot(p[0], p[2]) - R, p[1]) - tr; }
    function sdSphere(p, r) { return Math.hypot(p[0], p[1], p[2]) - r; }
    var TUBE_OUT = Math.hypot(T_OUT, H_OUT) / 2 * 0.9;
    var TUBE_IN = Math.hypot(T_IN, H_IN) / 2 * 0.9;
    var n = pos.length / 3, ao = new Float32Array(n);
    var RADII = [0.035, 0.08, 0.16, 0.30, 0.5];
    for (var name in objects) {
      var o = objects[name];
      var selfOut = name === 'out', selfIn = name === 'in';
      var isCore = name === 'coreShell' || name === 'coreGlow';
      for (var i = o.start; i < o.start + o.count; i++) {
        var px = pos[i * 3], py = pos[i * 3 + 1], pz = pos[i * 3 + 2];
        var nx = nrm[i * 3], ny = nrm[i * 3 + 1], nz = nrm[i * 3 + 2];
        var a = 1, w = 0.72;
        for (var k = 0; k < RADII.length; k++) {
          var r = RADII[k];
          var q = [px + nx * r, py + ny * r, pz + nz * r];
          var d = 1e9;
          d = Math.min(d, selfOut ? sdTorus(q, R_OUT, TUBE_OUT) : sdShell(q, R_OUT, TUBE_OUT));
          d = Math.min(d, selfIn ? sdTorus(q, R_IN, TUBE_IN) : sdShell(q, R_IN, TUBE_IN));
          if (!isCore) d = Math.min(d, sdSphere(q, R_CORE));
          a -= Math.max(0, (r - Math.max(d, 0)) / r) * w;
          w *= 0.6;
        }
        ao[i] = Math.pow(Math.min(1, Math.max(0.18, a)), 1.5);
      }
    }
    return ao;
  }
  var aoArr = bakeAO();
  var NV = pos.length / 3, MESH_STRIDE = 9;
  var meshData = new Float32Array(NV * MESH_STRIDE);
  for (var vi = 0; vi < NV; vi++) {
    meshData[vi * 9] = pos[vi * 3]; meshData[vi * 9 + 1] = pos[vi * 3 + 1]; meshData[vi * 9 + 2] = pos[vi * 3 + 2];
    meshData[vi * 9 + 3] = nrm[vi * 3]; meshData[vi * 9 + 4] = nrm[vi * 3 + 1]; meshData[vi * 9 + 5] = nrm[vi * 3 + 2];
    meshData[vi * 9 + 6] = aoArr[vi]; meshData[vi * 9 + 7] = typ[vi]; meshData[vi * 9 + 8] = rnd[vi];
  }
  pos = nrm = typ = rnd = aoArr = null;

  /* -------------- particles (L2 accretion) + stars (L0) -------------- */
  // allocate for the desktop count; the drawn count follows the live canvas
  // size (applySize), so a hidden/zero-sized load can never lock in a low tier
  var NP = HOME ? 640 : 380;
  var NP_NARROW = HOME ? 340 : 200;
  var drawNP = NP;
  var NS = 140;
  var P_STRIDE = 6; // x y z size alpha warm
  var pointData = new Float32Array((NP + NS) * P_STRIDE);
  var part = []; // simulation state
  (function buildParticles() {
    for (var i = 0; i < NP; i++) {
      // orbital plane basis: two inclined accretion bands + jitter
      var band = i % 2 ? 0.42 : -0.36;
      var tilt = band + (Math.random() - 0.5) * 0.22;
      var yaw = (i % 2 ? 0.35 : 2.1) + (Math.random() - 0.5) * 0.5;
      var cy = Math.cos(tilt), sy = Math.sin(tilt);
      var cw = Math.cos(yaw), sw = Math.sin(yaw);
      // u = plane X axis, v = plane Z axis, n = plane normal (rotZ(tilt)·rotY(yaw))
      var u = [cw * cy, sy, -sw * cy];
      var n = [-cw * sy, cy, sw * sy];
      var v = [sw, 0, cw];
      part.push({
        u: u, v: v, n: n,
        r: 1.35 + Math.random() * 1.05,
        phi: Math.random() * Math.PI * 2,
        y0: (Math.random() - 0.5) * 0.30,
        size: 0.010 + Math.random() * 0.014,
        al: 0.10 + Math.random() * 0.22,
        warm: Math.random() < 0.80 ? 1 : 0,
        tw: Math.random() * Math.PI * 2,
        age: 1,
        sx: (Math.random() - 0.5) * 7, sy: (Math.random() - 0.5) * 7, sz: (Math.random() - 0.5) * 7,
        st: Math.random(), // intro stagger
      });
    }
    for (var s = 0; s < NS; s++) {
      var th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
      var rr = 7 + Math.random() * 3.2;
      var o = (NP + s) * P_STRIDE;
      pointData[o] = rr * Math.sin(ph) * Math.cos(th);
      pointData[o + 1] = rr * Math.cos(ph) * 0.72;
      pointData[o + 2] = rr * Math.sin(ph) * Math.sin(th);
      pointData[o + 3] = 0.05 + Math.random() * 0.075;
      pointData[o + 4] = 0.035 + Math.random() * 0.09;
      pointData[o + 5] = Math.random() < 0.75 ? 0.85 : 0.15;
    }
  })();

  /* ---------------- shaders (GLSL 1/3 via preamble) ---------------- */
  var SCENE_VS =
    'ATTR vec3 aPos;ATTR vec3 aNrm;ATTR float aAO;ATTR float aType;ATTR float aRnd;' +
    'uniform mat4 uProj;uniform mat3 uRot;uniform vec3 uLoc;uniform vec3 uCam;' +
    'VARYO vec3 vN;VARYO vec3 vP;VARYO vec3 vView;VARYO float vAO;VARYO float vType;VARYO float vRnd;' +
    'void main(){' +
    'vec3 p=uRot*aPos+uLoc;vP=p;vView=p+uCam;' +
    'vN=uRot*aNrm;vAO=aAO;vType=aType;vRnd=aRnd;' +
    'gl_Position=uProj*vec4(vView,1.0);}';

  var TONE_FN =
    'vec3 aces(vec3 x){return clamp(x*(2.51*x+0.03)/(x*(2.43*x+0.59)+0.14),0.0,1.0);}' +
    'float hsh(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}';

  var SCENE_FS =
    'VARYI vec3 vN;VARYI vec3 vP;VARYI vec3 vView;VARYI float vAO;VARYI float vType;VARYI float vRnd;' +
    'uniform float uT;uniform float uCoreBoost;uniform float uAOMix;uniform float uEnvBoost;' +
    'uniform float uSigOn;uniform float uSigPhase;' +
    '\n#ifdef DIRECT\nuniform vec2 uRes;uniform float uExposure;\n' + TONE_FN + '\n#endif\n' +
    // analytic studio: key milk light (upper left) + steel-blue fill (right) + top rim
    'vec3 env(vec3 d,float ex){' +
    'vec3 c=vec3(0.016,0.019,0.027);' +
    'c+=vec3(1.00,0.95,0.86)*2.7*pow(max(dot(d,normalize(vec3(-0.52,0.70,-0.44))),0.0),ex);' +
    'c+=vec3(0.40,0.56,0.90)*1.15*pow(max(dot(d,normalize(vec3(0.86,-0.06,0.30))),0.0),ex*1.5);' +
    'c+=vec3(0.90,0.95,1.00)*1.5*pow(max(dot(d,normalize(vec3(0.05,0.97,0.12))),0.0),ex*3.2);' +
    'return c;}' +
    'void main(){' +
    'vec3 N=normalize(vN);vec3 V=normalize(-vView);float t=vType;vec3 col;' +
    'if(t>2.5){' +
    'float th=0.75+0.25*sin(uT*0.8+vRnd*6.2831);' +
    'col=vec3(1.0,0.80,0.52)*2.25*th*uCoreBoost;' +
    '}else{' +
    'vec3 albedo=t<0.5?vec3(0.040,0.040,0.043):t<1.5?vec3(0.055,0.056,0.060):t<2.5?vec3(0.020,0.020,0.024):vec3(0.032,0.032,0.035);' +
    'float rough=t<0.5?0.40:t<1.5?0.20:t<2.5?0.13:0.5;' +
    'rough+=(vRnd-0.5)*0.06;' +
    'vec3 R=reflect(-V,N);' +
    'float ndv=max(dot(N,V),0.0);' +
    'float fr=0.06+0.94*pow(1.0-ndv,5.0);' +
    'float ex=mix(64.0,6.0,rough);' +
    'float ao=mix(vAO,1.0,uAOMix);' +
    'col=albedo*env(N,2.1)*ao*uEnvBoost;' +
    'col+=env(R,ex)*mix(0.06,0.9,fr)*((t>0.5&&t<1.5)?0.60:0.42)*(0.35+0.65*ao)*uEnvBoost;' +
    'float dl=max(dot(N,-normalize(vP)),0.0);' +
    'float spill=0.55/(0.18+dot(vP,vP)*2.2);' +
    'col+=vec3(1.0,0.82,0.55)*dl*spill*mix(1.0,ao,0.45)*uCoreBoost;' +
    'if(t>0.5&&t<1.5&&uSigOn>0.001){' +      // signal light traveling along chamfer facets
    'float f=fract(vRnd-uSigPhase);' +
    'float bd=min(f,1.0-f);' +
    'col+=vec3(1.0,0.82,0.55)*smoothstep(0.03,0.0,bd)*1.2*uSigOn;}' +
    'float fog=smoothstep(2.4,5.4,-vView.z);' +
    'col=mix(col,vec3(0.030),fog*0.55);}' +
    '\n#ifdef DIRECT\n' +
    'col=aces(col*uExposure);col=pow(col,vec3(1.06));' +
    'col+=vec3(0.004,0.007,0.014)*(1.0-col);' +
    'vec2 vg=gl_FragCoord.xy/uRes*2.0-1.0;' +
    'col*=1.0-0.30*dot(vg*0.62,vg*0.62);' +
    'col+=(hsh(gl_FragCoord.xy+fract(uT)*7.0)-0.5)*0.008;' +
    '\n#endif\n' +
    'FRAGOUT=vec4(col,1.0);}';

  var POINT_VS =
    'ATTR vec3 aPos;ATTR float aSize;ATTR float aAlpha;ATTR float aWarm;' +
    'uniform mat4 uProj;uniform mat3 uRot;uniform vec3 uCam;uniform float uPx;' +
    'VARYO float vA;VARYO float vWarm;' +
    'void main(){' +
    'vec3 p=uRot*aPos+uCam;' +
    'gl_Position=uProj*vec4(p,1.0);' +
    'gl_PointSize=clamp(aSize*uPx/max(0.4,-p.z),0.75,7.0);' +
    'vA=aAlpha;vWarm=aWarm;}';

  var POINT_FS =
    'VARYI float vA;VARYI float vWarm;' +
    'void main(){' +
    'float d=distance(gl_PointCoord,vec2(0.5));' +
    'float a=smoothstep(0.5,0.06,d)*vA;' +
    '\n#ifdef DIRECT\na*=0.85;\n#endif\n' +
    'vec3 c=mix(vec3(0.55,0.70,0.92),vec3(1.0,0.86,0.62),vWarm);' +
    'FRAGOUT=vec4(c*a,1.0);}';

  var QUAD_VS = 'ATTR vec2 p;VARYO vec2 vUv;void main(){vUv=p*0.5+0.5;gl_Position=vec4(p,0.0,1.0);}';
  var BRIGHT_FS =
    'VARYI vec2 vUv;uniform sampler2D uTex;' +
    'void main(){vec3 c=TEX(uTex,vUv).rgb;' +
    'float l=dot(c,vec3(0.2126,0.7152,0.0722));' +
    'FRAGOUT=vec4(c*smoothstep(1.05,2.1,l),1.0);}';
  var BLUR_FS =
    'VARYI vec2 vUv;uniform sampler2D uTex;uniform vec2 uDir;' +
    'void main(){vec3 c=TEX(uTex,vUv).rgb*0.227027;' +
    'vec2 o1=uDir*1.3846154,o2=uDir*3.2307692;' +
    'c+=TEX(uTex,vUv+o1).rgb*0.3162162;c+=TEX(uTex,vUv-o1).rgb*0.3162162;' +
    'c+=TEX(uTex,vUv+o2).rgb*0.0702703;c+=TEX(uTex,vUv-o2).rgb*0.0702703;' +
    'FRAGOUT=vec4(c,1.0);}';
  var COMP_FS =
    'VARYI vec2 vUv;' +
    'uniform sampler2D uScene;uniform sampler2D uB0;uniform sampler2D uB1;uniform sampler2D uB2;' +
    'uniform float uT;uniform vec2 uRes;uniform float uExposure;uniform float uBloomAmt;' +
    'uniform vec2 uGlowUV;uniform float uGlowAmt;' +
    TONE_FN +
    'void main(){' +
    'vec3 c=TEX(uScene,vUv).rgb;' +
    'c+=(TEX(uB0,vUv).rgb*0.42+TEX(uB1,vUv).rgb*0.55+TEX(uB2,vUv).rgb*0.50)*uBloomAmt;' +
    'vec2 q=vUv-uGlowUV;q.x*=uRes.x/uRes.y;' +          // faint warm stage glow behind the machine
    'c+=vec3(0.055,0.047,0.038)*exp(-dot(q,q)*3.2)*uGlowAmt;' +
    'c=aces(c*uExposure);' +
    'c=pow(c,vec3(1.06));' +                             // sink the shadows a touch
    'c+=vec3(0.004,0.007,0.014)*(1.0-c);' +              // shadow blue-shift (film feel)
    'vec2 v=vUv*2.0-1.0;' +
    'c*=1.0-0.30*dot(v*0.62,v*0.62);' +
    'c+=(hsh(gl_FragCoord.xy+fract(uT)*7.0)-0.5)*0.008;' + // dither vs banding (CSS grain adds texture)
    'FRAGOUT=vec4(c,1.0);}';

  /* ---------------- GL bootstrap + capability ladder ---------------- */
  var gl = null, isGL2 = false, MODE = null;
  function freshCanvas() {
    var c2 = document.createElement('canvas');
    c2.id = canvas.id;
    c2.setAttribute('aria-hidden', 'true');
    canvas.replaceWith(c2);
    canvas = c2;
  }
  (function boot() {
    var attrs = { antialias: false, alpha: false, depth: true, stencil: false, powerPreference: 'high-performance', preserveDrawingBuffer: STILL };
    try { gl = canvas.getContext('webgl2', attrs); } catch (e) { gl = null; }
    if (gl) {
      var extF = gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float');
      if (extF) { isGL2 = true; MODE = 'pipe'; return; }
      gl = null; freshCanvas(); // context type is claimed per-canvas — need a fresh node for WebGL1
    }
    var attrs1 = { antialias: true, alpha: false, depth: true, preserveDrawingBuffer: STILL };
    try {
      gl = canvas.getContext('webgl', attrs1) || canvas.getContext('experimental-webgl', attrs1);
    } catch (e) { gl = null; }
    if (gl) MODE = 'direct';
    else MODE = '2d';
  })();

  /* ---------------- 2D last-resort static frame ---------------- */
  function static2D() {
    freshCanvas();
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    var dpr = Math.min(devicePixelRatio || 1, 2);
    var w = canvas.clientWidth || innerWidth || 1024, h = canvas.clientHeight || innerHeight || 768;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#050507'; ctx.fillRect(0, 0, w, h);
    var cx = w * (w < 700 ? 0.5 : 0.62), cy = h * 0.48, R = Math.min(w, h) * 0.30;
    var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.6);
    g.addColorStop(0, 'rgba(232,180,120,0.18)'); g.addColorStop(1, 'rgba(232,180,120,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < part.length; i++) {
      var p = part[i];
      var x = p.u[0] * p.r * Math.cos(p.phi) + p.v[0] * p.r * Math.sin(p.phi);
      var y = p.u[1] * p.r * Math.cos(p.phi) + p.v[1] * p.r * Math.sin(p.phi) + p.n[1] * p.y0;
      ctx.beginPath();
      ctx.arc(cx + x * R * 0.7, cy - y * R * 0.7, Math.max(0.5, p.size * 90), 0, 6.2831853);
      ctx.fillStyle = p.warm ? 'rgba(240,216,180,' + p.al + ')' : 'rgba(150,180,220,' + p.al + ')';
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  if (MODE === '2d') { window.__scene = { mode: '2d' }; static2D(); return; }

  /* ---------------- programs / buffers ---------------- */
  var VERT_PRE = isGL2 ? '#version 300 es\n#define ATTR in\n#define VARYO out\n'
    : '#define ATTR attribute\n#define VARYO varying\n';
  var FRAG_PRE = isGL2 ? '#version 300 es\nprecision highp float;\n#define VARYI in\nout vec4 FRAGOUT;\n#define TEX texture\n'
    : 'precision highp float;\n#define VARYI varying\n#define FRAGOUT gl_FragColor\n#define TEX texture2D\n';
  var DIRECT_DEF = MODE === 'direct' ? '#define DIRECT 1\n' : '';

  var progs = [];
  function prog(vs, fs, attrs) {
    function sh(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader');
      return s;
    }
    var p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VERT_PRE + vs));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FRAG_PRE + fs));
    for (var i = 0; i < attrs.length; i++) gl.bindAttribLocation(p, i, attrs[i]);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || 'link');
    var u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (var j = 0; j < n; j++) { var inf = gl.getActiveUniform(p, j); u[inf.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, inf.name); }
    var o = { p: p, u: u, nAttr: attrs.length };
    progs.push(o);
    return o;
  }

  var P = {}, meshBuf = null, pointBuf = null, quadBuf = null, blackTex = null;
  var enabledAttrs = 0;
  function setAttrCount(n) {
    var i;
    for (i = enabledAttrs; i < n; i++) gl.enableVertexAttribArray(i);
    for (i = n; i < enabledAttrs; i++) gl.disableVertexAttribArray(i);
    enabledAttrs = n;
  }
  function bindMesh() {
    gl.bindBuffer(gl.ARRAY_BUFFER, meshBuf);
    setAttrCount(5);
    var S = MESH_STRIDE * 4;
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, S, 0);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, S, 12);
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, S, 24);
    gl.vertexAttribPointer(3, 1, gl.FLOAT, false, S, 28);
    gl.vertexAttribPointer(4, 1, gl.FLOAT, false, S, 32);
  }
  function bindPoints() {
    gl.bindBuffer(gl.ARRAY_BUFFER, pointBuf);
    setAttrCount(4);
    var S = P_STRIDE * 4;
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, S, 0);
    gl.vertexAttribPointer(1, 1, gl.FLOAT, false, S, 12);
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, S, 16);
    gl.vertexAttribPointer(3, 1, gl.FLOAT, false, S, 20);
  }
  function bindQuad() {
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    setAttrCount(1);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  }

  function initGLObjects() {
    P.scene = prog(SCENE_VS, DIRECT_DEF + SCENE_FS, ['aPos', 'aNrm', 'aAO', 'aType', 'aRnd']);
    P.points = prog(POINT_VS, DIRECT_DEF + POINT_FS, ['aPos', 'aSize', 'aAlpha', 'aWarm']);
    if (MODE === 'pipe') {
      P.bright = prog(QUAD_VS, BRIGHT_FS, ['p']);
      P.blur = prog(QUAD_VS, BLUR_FS, ['p']);
      P.comp = prog(QUAD_VS, COMP_FS, ['p']);
    }
    meshBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, meshBuf);
    gl.bufferData(gl.ARRAY_BUFFER, meshData, gl.STATIC_DRAW);
    pointBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, pointBuf);
    gl.bufferData(gl.ARRAY_BUFFER, pointData, gl.DYNAMIC_DRAW);
    quadBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    if (MODE === 'pipe') {
      blackTex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, blackTex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
    }
    enabledAttrs = 0;
  }

  /* ---------------- FBOs (pipeline mode) ---------------- */
  var W = 0, H = 0, fbo = null, msaaOK = false;
  function texFBO(w, h, withDepth) {
    var t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    var f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    if (withDepth) {
      var rb = gl.createRenderbuffer();
      gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb);
    }
    return { t: t, f: f, w: w, h: h };
  }
  function delFBO(o) { if (!o) return; gl.deleteTexture(o.t); gl.deleteFramebuffer(o.f); }
  function buildFBOs() {
    if (MODE !== 'pipe') return;
    if (fbo) {
      delFBO(fbo.scene); delFBO(fbo.bright);
      delFBO(fbo.b0a); delFBO(fbo.b0b); delFBO(fbo.b1a); delFBO(fbo.b1b); delFBO(fbo.b2a); delFBO(fbo.b2b);
      if (fbo.ms) gl.deleteFramebuffer(fbo.ms);
    }
    var ms = null;
    try {
      var samples = Math.min(4, gl.getParameter(gl.MAX_SAMPLES) || 0);
      if (samples > 1) {
        ms = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, ms);
        var rbC = gl.createRenderbuffer();
        gl.bindRenderbuffer(gl.RENDERBUFFER, rbC);
        gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.RGBA16F, W, H);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, rbC);
        var rbD = gl.createRenderbuffer();
        gl.bindRenderbuffer(gl.RENDERBUFFER, rbD);
        gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.DEPTH_COMPONENT24, W, H);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rbD);
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) { gl.deleteFramebuffer(ms); ms = null; }
      }
    } catch (e) { ms = null; }
    msaaOK = !!ms;
    var scene = texFBO(W, H, !msaaOK); // no MSAA → depth lives on the scene FBO
    var w2 = Math.max(2, W >> 1), h2 = Math.max(2, H >> 1);
    var w4 = Math.max(2, W >> 2), h4 = Math.max(2, H >> 2);
    var w8 = Math.max(2, W >> 3), h8 = Math.max(2, H >> 3);
    fbo = {
      ms: ms, scene: scene,
      bright: texFBO(w2, h2),
      b0a: texFBO(w2, h2), b0b: texFBO(w2, h2),
      b1a: texFBO(w4, h4), b1b: texFBO(w4, h4),
      b2a: texFBO(w8, h8), b2b: texFBO(w8, h8),
    };
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      // half-float unrenderable after all — drop to direct-style single frame
      MODE = 'direct-broken';
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /* ---------------- projection / sizing ---------------- */
  var FOVF = 1 / Math.tan(0.60 / 2), tier = 0;
  var TIER_SCALE = [1, 1, 0.72];
  function projArray(asp) {
    return new Float32Array([FOVF / asp, 0, 0, 0, 0, FOVF, 0, 0, 0, 0, 12.1 / (0.1 - 12), -1, 0, 0, 2 * 12 * 0.1 / (0.1 - 12), 0]);
  }
  function applySize() {
    var dprCap = HOME ? 1.75 : 1.5;
    var dpr = Math.min(devicePixelRatio || 1, dprCap);
    var cw = canvas.clientWidth || innerWidth, ch = canvas.clientHeight || innerHeight;
    var capEdge = Math.min(1, 1600 / (Math.max(cw, ch) * dpr));
    var s = dpr * capEdge * TIER_SCALE[Math.min(tier, 2)];
    W = Math.max(8, Math.round(cw * s));
    H = Math.max(8, Math.round(ch * s));
    drawNP = Math.min(cw || 9999, ch || 9999) < 700 ? NP_NARROW : NP;
    canvas.width = W; canvas.height = H;
    buildFBOs();
    var proj = projArray(W / H);
    for (var i = 0; i < progs.length; i++) {
      if (progs[i].u.uProj) { gl.useProgram(progs[i].p); gl.uniformMatrix4fv(progs[i].u.uProj, false, proj); }
      if (progs[i].u.uPx) { gl.useProgram(progs[i].p); gl.uniform1f(progs[i].u.uPx, FOVF * H / 2); }
    }
  }

  /* ---------------- matrices / servo ---------------- */
  function mul3(a, b) {
    var o = new Float32Array(9);
    for (var c = 0; c < 3; c++) for (var r = 0; r < 3; r++)
      o[c * 3 + r] = a[r] * b[c * 3] + a[3 + r] * b[c * 3 + 1] + a[6 + r] * b[c * 3 + 2];
    return o;
  }
  function rx(t) { var c = Math.cos(t), s = Math.sin(t); return new Float32Array([1, 0, 0, 0, c, s, 0, -s, c]); }
  function ry(t) { var c = Math.cos(t), s = Math.sin(t); return new Float32Array([c, 0, -s, 0, 1, 0, s, 0, c]); }

  function servo(period, stepRad, phase) { return { t: phase, target: stepRad * 0.6, a: 0, v: 0, period: period, step: stepRad }; }
  function servoTick(s, dt, hold) {
    if (!hold) {
      s.t += dt;
      if (s.t > s.period) { s.t -= s.period; s.target += s.step; }
    }
    var acc = (s.target - s.a) * 16 - s.v * 6.4; // heavy, slow, slight overshoot
    s.v += acc * dt; s.a += s.v * dt;
    return s.a;
  }
  var svOut = servo(5.6, 60 * Math.PI / 180, 0);
  var svIn = servo(8.4, -42 * Math.PI / 180, 2.6);

  /* ---------------- orchestration state ---------------- */
  var KF = [ // hero / statement / pillars / contact
    { cx: 0.68, cy: -0.05, cz: -3.65, ex: 0, core: 1.00, sig: 0.06, exp: 0.92, glow: 1.00 },
    { cx: 0.78, cy: -0.03, cz: -3.05, ex: 0, core: 1.25, sig: 0.04, exp: 0.95, glow: 1.20 },
    { cx: 0.66, cy: 0.02, cz: -4.10, ex: 1, core: 1.00, sig: 0.12, exp: 0.88, glow: 0.80 },
    { cx: 0.55, cy: -0.04, cz: -3.35, ex: 0, core: 1.10, sig: 0.25, exp: 0.94, glow: 1.00 },
  ];
  var AMBIENT = { cx: 1.05, cy: 0.55, cz: -5.20, ex: 0, core: 0.75, sig: 0.05, exp: 0.75, glow: 0.65 };
  var sections = HOME ? [].slice.call(document.querySelectorAll('[data-screen-label]')) : [];
  var pillarEls = HOME ? [].slice.call(document.querySelectorAll('.pillar')) : [];
  var chapter = 0; // smoothed

  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  function chapterTarget() {
    if (!HOME || sections.length < 2) return 0;
    var vc = innerHeight / 2, centers = [];
    for (var i = 0; i < sections.length; i++) {
      var r = sections[i].getBoundingClientRect();
      centers.push(r.top + r.height / 2);
    }
    if (vc <= centers[0]) return 0;
    for (var j = 0; j < centers.length - 1; j++) {
      if (vc < centers[j + 1]) return j + (vc - centers[j]) / (centers[j + 1] - centers[j]);
    }
    return centers.length - 1;
  }
  function pillarWeights() {
    var w = [0, 0, 0];
    var vc = innerHeight / 2;
    for (var i = 0; i < pillarEls.length && i < 3; i++) {
      var r = pillarEls[i].getBoundingClientRect();
      var d = Math.abs(r.top + r.height / 2 - vc) / (innerHeight * 0.6);
      var x = Math.max(0, 1 - d);
      w[i] = x * x;
    }
    return w;
  }

  /* ---------------- interaction / lifecycle ---------------- */
  var tmx = 0, tmy = 0, cmx = 0, cmy = 0;
  var lastActive = 0, simT = 0, introT = 0;
  var INTRO = 2.6;
  var seen = false;
  try { seen = sessionStorage.getItem('linku_scene') === '1'; } catch (e) { }
  if (seen) introT = INTRO;
  addEventListener('pointermove', function (e) {
    tmx = (e.clientX / innerWidth) * 2 - 1;
    tmy = (e.clientY / innerHeight) * 2 - 1;
    lastActive = performance.now();
  }, { passive: true });
  addEventListener('scroll', function () { lastActive = performance.now(); }, { passive: true });
  addEventListener('touchstart', function () { lastActive = performance.now(); }, { passive: true });

  /* ---------------- frame render ---------------- */
  var glowUV = [0.62, 0.5];
  function computeState(dt) {
    simT += dt;
    if (introT < INTRO) introT += dt;
    var pe = easeOutCubic(Math.min(1, introT / INTRO));

    cmx += (tmx - cmx) * 0.04;
    cmy += (tmy - cmy) * 0.04;

    var st = {}, k;
    if (HOME) {
      var ct = chapterTarget();
      chapter += (ct - chapter) * Math.min(1, dt * 4.5);
      var i0 = Math.max(0, Math.min(2, Math.floor(chapter)));
      var f = Math.max(0, Math.min(1, chapter - i0));
      var A = KF[i0], B = KF[i0 + 1];
      for (k in A) st[k] = lerp(A[k], B[k], f);
      // pillar-by-pillar lighting while the exploded chapter is active
      var wc2 = Math.max(0, 1 - Math.abs(chapter - 2));
      if (wc2 > 0.01) {
        var w = pillarWeights();
        st.core += (1.0 * w[0] - 0.35 * w[1] + 0.45 * w[2]) * wc2;
        st.sig += (0.85 * w[1] + 0.50 * w[2]) * wc2;
        st.env = 1 + 0.35 * w[2] * wc2;
        st.servoRate = 1 + 1.2 * w[1] * wc2;
      }
      // contact: lock the rings, pulse the core
      var wc3 = Math.max(0, Math.min(1, (chapter - 2.4) / 0.6));
      st.hold = chapter > 2.55;
      if (wc3 > 0.01) {
        var pulse = Math.pow(0.5 + 0.5 * Math.sin(simT * 2.0), 3) * wc3;
        st.core += pulse * 0.9;
        st.partSpeed = 1 + 2.2 * pulse;
      }
    } else {
      for (k in AMBIENT) st[k] = AMBIENT[k];
      // recede while reading: deep-scrolled inner pages dim the machine well
      // below any foreground content (e.g. the /technology/ proof canvas)
      var dim = Math.min(1, (window.scrollY || 0) / (innerHeight * 1.8));
      st.exp -= 0.18 * dim;
      st.core -= 0.25 * dim;
      st.glow -= 0.30 * dim;
      st.sig = 0.03 + 0.04 * (0.5 + 0.5 * Math.sin(simT * 0.5));
      st.servoRate = 0.55;
    }
    st.env = st.env || 1;
    st.servoRate = st.servoRate || 1;
    st.partSpeed = st.partSpeed || 1;

    // intro: converge from an exploded, dark start
    st.ex += (1 - pe) * 1.5;
    st.core *= pe * pe;
    st.exp *= 0.30 + 0.70 * pe;
    st.pe = pe;

    // portrait/narrow framing: bring the machine toward center, dolly back
    // continuously as the viewport squares up (no step at any aspect), lift
    // it into the display-type zone and dim it so small copy stays readable
    var asp = W / Math.max(1, H);
    var xf = Math.max(0.3, Math.min(1, (asp - 0.60) / 0.70));
    st.cx *= xf;
    st.cz *= 1 + 0.26 * Math.max(0, Math.min(1, (1.30 - asp) / 0.70));
    var pf = Math.max(0, Math.min(1, (1.05 - asp) / 0.50));
    st.cy += 0.42 * pf;
    st.core *= 1 - 0.20 * pf;
    st.exp *= 1 - 0.05 * pf;

    st.aoMix = Math.min(0.75, st.ex * 0.75);
    // stage glow follows the machine's screen position
    glowUV[0] = 0.5 + 0.5 * (FOVF / asp) * st.cx / (-st.cz);
    glowUV[1] = 0.5 + 0.5 * FOVF * st.cy / (-st.cz);
    return st;
  }

  function updateParticles(dt, st) {
    var pe = st.pe, spd = st.partSpeed;
    for (var i = 0; i < drawNP; i++) {
      var p = part[i];
      p.phi += 0.10 * Math.pow(2.0 / p.r, 1.5) * dt * spd;
      p.r -= 0.020 * dt * spd;
      if (p.age < 1) p.age = Math.min(1, p.age + dt * 0.8);
      if (p.r < 1.30) { p.r = 2.25 + Math.random() * 0.45; p.age = 0; }
      var rr = p.r, yy = p.y0 * (rr / 2.2) * (1 + st.ex * 0.55);
      var cph = Math.cos(p.phi) * rr, sph = Math.sin(p.phi) * rr;
      var ox = p.u[0] * cph + p.v[0] * sph + p.n[0] * yy;
      var oy = p.u[1] * cph + p.v[1] * sph + p.n[1] * yy;
      var oz = p.u[2] * cph + p.v[2] * sph + p.n[2] * yy;
      // intro coalesce: from scattered volume to the accretion orbit
      var t = Math.max(0, Math.min(1, (pe * 1.2 - p.st * 0.2)));
      var te = easeOutCubic(t);
      var x = p.sx + (ox - p.sx) * te;
      var y = p.sy + (oy - p.sy) * te;
      var z = p.sz + (oz - p.sz) * te;
      var tw = 0.7 + 0.3 * Math.sin(simT * (0.9 + p.st) + p.tw);
      var o = i * P_STRIDE;
      pointData[o] = x; pointData[o + 1] = y; pointData[o + 2] = z;
      pointData[o + 3] = p.size;
      pointData[o + 4] = p.al * tw * (0.20 + 0.80 * pe) * p.age;
      pointData[o + 5] = p.warm;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, pointBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, pointData.subarray(0, drawNP * P_STRIDE));
  }

  function drawScene(st, aOut, aIn) {
    var S = P.scene;
    gl.useProgram(S.p);
    gl.uniform1f(S.u.uT, simT);
    gl.uniform1f(S.u.uCoreBoost, st.core);
    gl.uniform1f(S.u.uAOMix, st.aoMix);
    gl.uniform1f(S.u.uEnvBoost, st.env);
    gl.uniform3f(S.u.uCam, st.cx, st.cy, st.cz);
    if (MODE !== 'pipe') {
      gl.uniform2f(S.u.uRes, W, H);
      gl.uniform1f(S.u.uExposure, st.exp);
    }
    var G = mul3(ry(0.42 + cmx * 0.4), rx(-0.52 + cmy * 0.26));
    var M1 = mul3(G, ry(aOut));
    var M2 = mul3(M1, rx(aIn));
    var Mc = mul3(M2, ry(simT * 0.10));
    var ex = st.ex;
    var oOut = [0.06 * ex, 0.58 * ex, 0], oIn = [0, 0.02 * ex, 0], oCore = [-0.04 * ex, -0.52 * ex, 0];
    bindMesh();
    function dp(name, rot, off, sigOn, sigPhase) {
      var o = objects[name];
      gl.uniformMatrix3fv(S.u.uRot, false, rot);
      gl.uniform3f(S.u.uLoc, off[0], off[1], off[2]);
      gl.uniform1f(S.u.uSigOn, sigOn);
      gl.uniform1f(S.u.uSigPhase, sigPhase);
      gl.drawArrays(gl.TRIANGLES, o.start, o.count);
    }
    dp('out', M1, oOut, st.sig, (simT * 0.22) % 1);
    dp('bossPX', M1, oOut, 0, 0); dp('bossNX', M1, oOut, 0, 0);
    dp('pinPX', M1, oOut, 0, 0); dp('pinNX', M1, oOut, 0, 0);
    dp('in', M2, oIn, st.sig * 0.7, 1 - (simT * 0.16) % 1);
    dp('coreShell', Mc, oCore, 0, 0);
    dp('coreGlow', Mc, oCore, 0, 0);
    return G;
  }

  function drawPoints(st, G) {
    var Q = P.points;
    gl.useProgram(Q.p);
    gl.uniform3f(Q.u.uCam, st.cx, st.cy, st.cz);
    gl.depthMask(false);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    bindPoints();
    gl.uniformMatrix3fv(Q.u.uRot, false, G);
    gl.drawArrays(gl.POINTS, 0, drawNP);
    // stars: damped parallax + imperceptible drift
    var Gs = mul3(ry(0.42 + cmx * 0.14 + simT * 0.004), rx(-0.52 + cmy * 0.09));
    gl.uniformMatrix3fv(Q.u.uRot, false, Gs);
    gl.drawArrays(gl.POINTS, NP, NS);
    gl.disable(gl.BLEND);
    gl.depthMask(true);
  }

  var bloomOff = false;
  function render(dt) {
    var st = computeState(dt);
    var aOut = servoTick(svOut, dt * st.servoRate, st.hold);
    var aIn = servoTick(svIn, dt * st.servoRate, st.hold);
    updateParticles(dt, st);

    if (MODE === 'pipe') {
      gl.bindFramebuffer(gl.FRAMEBUFFER, msaaOK ? fbo.ms : fbo.scene.f);
      gl.viewport(0, 0, W, H);
      gl.enable(gl.DEPTH_TEST);
      gl.clearColor(0.030, 0.030, 0.033, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      var G = drawScene(st, aOut, aIn);
      drawPoints(st, G);
      gl.disable(gl.DEPTH_TEST);
      if (msaaOK) {
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, fbo.ms);
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, fbo.scene.f);
        gl.blitFramebuffer(0, 0, W, H, 0, 0, W, H, gl.COLOR_BUFFER_BIT, gl.NEAREST);
      }
      bindQuad();
      function pass(pr, dst, binds, set) {
        gl.useProgram(pr.p);
        gl.bindFramebuffer(gl.FRAMEBUFFER, dst ? dst.f : null);
        gl.viewport(0, 0, dst ? dst.w : W, dst ? dst.h : H);
        for (var i = 0; i < binds.length; i++) {
          gl.activeTexture(gl.TEXTURE0 + i);
          gl.bindTexture(gl.TEXTURE_2D, binds[i][1]);
          gl.uniform1i(pr.u[binds[i][0]], i);
        }
        if (set) set(pr);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
      var doBloom = !bloomOff;
      if (doBloom) {
        pass(P.bright, fbo.bright, [['uTex', fbo.scene.t]]);
        pass(P.blur, fbo.b0a, [['uTex', fbo.bright.t]], function (pr) { gl.uniform2f(pr.u.uDir, 1 / fbo.bright.w, 0); });
        pass(P.blur, fbo.b0b, [['uTex', fbo.b0a.t]], function (pr) { gl.uniform2f(pr.u.uDir, 0, 1 / fbo.b0a.h); });
        pass(P.blur, fbo.b1a, [['uTex', fbo.b0b.t]], function (pr) { gl.uniform2f(pr.u.uDir, 1 / fbo.b1a.w, 0); });
        pass(P.blur, fbo.b1b, [['uTex', fbo.b1a.t]], function (pr) { gl.uniform2f(pr.u.uDir, 0, 1 / fbo.b1a.h); });
        pass(P.blur, fbo.b2a, [['uTex', fbo.b1b.t]], function (pr) { gl.uniform2f(pr.u.uDir, 1 / fbo.b2a.w, 0); });
        pass(P.blur, fbo.b2b, [['uTex', fbo.b2a.t]], function (pr) { gl.uniform2f(pr.u.uDir, 0, 1 / fbo.b2a.h); });
      }
      pass(P.comp, null, [
        ['uScene', fbo.scene.t],
        ['uB0', doBloom ? fbo.b0b.t : blackTex],
        ['uB1', doBloom ? fbo.b1b.t : blackTex],
        ['uB2', doBloom ? fbo.b2b.t : blackTex],
      ], function (pr) {
        gl.uniform1f(pr.u.uT, simT);
        gl.uniform2f(pr.u.uRes, W, H);
        gl.uniform1f(pr.u.uExposure, st.exp);
        gl.uniform1f(pr.u.uBloomAmt, doBloom ? 1 : 0);
        gl.uniform2f(pr.u.uGlowUV, glowUV[0], glowUV[1]);
        gl.uniform1f(pr.u.uGlowAmt, st.glow);
      });
    } else {
      // direct mode: tone map in-shader, no post chain
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, W, H);
      gl.enable(gl.DEPTH_TEST);
      gl.clearColor(0.0175, 0.0205, 0.0274, 1); // scene bg after the same tone curve
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      var G2 = drawScene(st, aOut, aIn);
      drawPoints(st, G2);
      gl.disable(gl.DEPTH_TEST);
    }
  }

  /* ---------------- loop / governance ---------------- */
  var rafId = 0, prevTs = 0, flip = false, running = false, seenSet = seen;
  var fpsEMA = 60, lowSince = 0;
  function loop(ts) {
    rafId = requestAnimationFrame(loop);
    var dt = prevTs ? Math.min(0.05, (ts - prevTs) / 1000) : 0.016;
    prevTs = ts;
    if (!seenSet && introT >= INTRO) {
      // mark only once the intro has actually been rendered — a prerendered
      // page (frozen rAF) must not burn the once-per-session intro unseen
      seenSet = true;
      try { sessionStorage.setItem('linku_scene', '1'); } catch (e) { }
    }
    var idle = introT >= INTRO && (ts - lastActive) > 4000;
    flip = !flip;
    if (idle && flip) return; // 30fps while reading
    render(dt);
    if (!idle && introT > 3) {
      var fps = 1 / Math.max(0.001, dt);
      fpsEMA += (fps - fpsEMA) * 0.05;
      if (fpsEMA < 40) {
        if (!lowSince) lowSince = ts;
        else if (ts - lowSince > 2500) { lowSince = 0; tierDown(); }
      } else lowSince = 0;
    }
  }
  function tierDown() {
    tier++;
    fpsEMA = 60;
    if (tier === 1) bloomOff = true;
    else if (tier === 2) applySize();
    else { stopLoop(); render(0.016); } // static endpoint for weak GPUs
  }
  function startLoop() {
    if (rafId || !running) return;
    prevTs = 0;
    lastActive = performance.now();
    rafId = requestAnimationFrame(loop);
  }
  function stopLoop() { if (rafId) { cancelAnimationFrame(rafId); rafId = 0; } }
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stopLoop(); else startLoop();
  });

  /* ---------------- reduced motion / still / boot ---------------- */
  function renderStill() {
    // one settled, composed frame: assembled machine, pleasant glow phase
    introT = INTRO; simT = 8;
    svOut.a = svOut.target = 0.35; svOut.v = 0;
    svIn.a = svIn.target = 0.75; svIn.v = 0;
    render(0.016);
  }
  function snapOverlay() {
    try {
      var img = document.createElement('img');
      img.alt = '';
      img.setAttribute('aria-hidden', 'true');
      img.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100vh;z-index:0;pointer-events:none;object-fit:cover;';
      img.src = canvas.toDataURL('image/png');
      canvas.parentNode.insertBefore(img, canvas.nextSibling);
    } catch (e) { }
  }
  var TOGGLE_LABELS = {
    en: ['Play background animation', 'Pause background animation'],
    'zh-Hant': ['播放背景動畫', '暫停背景動畫'],
    ja: ['背景アニメーションを再生', '背景アニメーションを停止'],
  };
  function injectToggle() {
    var L = TOGGLE_LABELS[docLang] || TOGGLE_LABELS.en;
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'scene-toggle';
    b.textContent = '▶'; // ▶
    b.setAttribute('aria-label', L[0]);
    b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', function () {
      running = !running;
      if (running) {
        b.textContent = '■'; b.setAttribute('aria-label', L[1]); b.setAttribute('aria-pressed', 'true');
        startLoop();
      } else {
        b.textContent = '▶'; b.setAttribute('aria-label', L[0]); b.setAttribute('aria-pressed', 'false');
        stopLoop();
      }
    });
    document.body.appendChild(b);
  }

  var resizeT = 0, lastCW = 0, lastCH = 0;
  addEventListener('resize', function () {
    clearTimeout(resizeT);
    resizeT = setTimeout(function () {
      var cw = canvas.clientWidth, ch = canvas.clientHeight;
      if (cw === lastCW && ch === lastCH) return; // e.g. mobile URL bar with lvh
      lastCW = cw; lastCH = ch;
      applySize();
      if (!rafId) render(0.016); // keep stills fresh
    }, 150);
  }, { passive: true });

  canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); stopLoop(); }, false);
  canvas.addEventListener('webglcontextrestored', function () {
    progs = []; fbo = null;
    initGLObjects();
    applySize();
    if (running) { startLoop(); } else { renderStill(); }
  }, false);

  try {
    initGLObjects();
  } catch (e) {
    console.warn('scene: GL init failed, falling back to static frame:', e && e.message);
    MODE = '2d'; static2D(); return;
  }
  lastCW = canvas.clientWidth; lastCH = canvas.clientHeight;
  applySize();
  if (MODE === 'direct-broken') { MODE = 'direct'; } // pipeline FBOs failed → plain direct draw

  // dev/introspection handle (used by verification tooling)
  window.__scene = {
    mode: MODE, get tier() { return tier; }, get fps() { return fpsEMA; },
    get chapter() { return chapter; },
  };

  if (reduce) {
    renderStill();
    if (STILL) { snapOverlay(); return; }
    injectToggle();
    return;
  }
  running = true;
  startLoop();
})();
