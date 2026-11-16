/* LINKU brand scene — the pin bed (zero deps, WebGL2).
   Home: a shape display. Machined pins (steel bead, gold collar, slender
   shaft) rise and sink to give computed forms a body — a solid that keeps
   becoming another, the pillar numerals, the wordmark. All on the GPU:
   field (target heights) → servo (mass, damping, speed limit) → light
   (shadow / occlusion from the heights) → one quad per pin, intersected
   analytically per pixel, painter's order → blur pyramid → ACES grade.
   Inner pages: a starfield (direct draw). Reduced motion: one settled frame
   (home) or a zero-GL poster (inner), plus a play toggle.
   Dev flags (exact match): #still, #reduce. */
(function () {
  'use strict';

  var canvas = document.getElementById('particles');
  if (!canvas) return;
  var root = document.documentElement;

  // exact match: a substring test would misfire on real anchors (#stillness)
  var HASH = location.hash || '';
  var STILL = HASH === '#still';
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    || HASH === '#reduce' || STILL;
  var HOME = !!document.querySelector('[data-screen-label="Hero"]');
  var INNER = !HOME; // inner pages (about/technology): pure deep space, no bed

  // inner pages, reduced motion: a zero-GL poster (Play can still boot the renderer)
  function staticPoster() {
    var stars = '<g fill="#e8e6e0" fill-opacity=".13">';
    for (var i = 0; i < 28; i++) {
      var x = (i * 347 + 83) % 1200, y = (i * 193 + 61) % 700;
      stars += '<circle cx="' + x + '" cy="' + y + '" r="' + (i % 5 ? 1 : 2) + '"/>';
    }
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 700">'
      + '<defs><radialGradient id="g"><stop stop-color="#e8b478" stop-opacity=".12"/><stop offset="1" stop-color="#0a0a0a" stop-opacity="0"/></radialGradient></defs>'
      + '<rect width="1200" height="700" fill="#0a0a0a"/><circle cx="600" cy="310" r="360" fill="url(#g)"/>'
      + stars + '</g></svg>';
    canvas.style.background = 'center / cover no-repeat url("data:image/svg+xml,'
      + encodeURIComponent(svg) + '")';
  }
  // main.js and proof.js follow the same play / pause
  function emit(on) {
    try { document.dispatchEvent(new CustomEvent('linku-motion-toggle', { detail: { running: on } })); } catch (e) { }
  }
  var refocus = false;   // the preboot button hands keyboard focus to the real one
  function prebootToggle() {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'scene-toggle'; b.textContent = '▶';
    b.setAttribute('aria-label', canvas.getAttribute('data-l-play') || 'Play background animation');
    b.title = b.getAttribute('aria-label');
    b.addEventListener('click', function () {
      refocus = document.activeElement === b;
      b.remove(); reduce = false;
      root.classList.remove('motion-paused');
      canvas.style.background = 'none';
      emit(true);
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(boot); else boot();
    });
    document.body.appendChild(b);
  }

  // heavy init runs on the first animation frame, off the parse path
  function boot() {

  var gl = null;
  try {
    gl = canvas.getContext('webgl2', {
      antialias: false, alpha: false, depth: false, stencil: false,
      powerPreference: 'high-performance', preserveDrawingBuffer: STILL,
    });
  } catch (e) { gl = null; }
  if (!gl) { window.__scene = { mode: 'none' }; return; }
  // Inner pages only draw a starfield: direct path, never an off-screen FBO.
  var MODE = INNER ? 'direct' : 'pipe';
  // extensions are per-context-lifetime: this runs again after a context restore
  function floatTargets() { return !!(gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float')); }
  // the bed lives in float textures: without them, the plain page
  if (HOME && !floatTargets()) { window.__scene = { mode: 'none' }; return; }

  /* ---------------- shaders ---------------- */
  // samplers default to lowp: the bed's heights live in float textures
  var HEAD = '#version 300 es\nprecision highp float;precision highp int;precision highp sampler2D;\n';
  var HASHFN = 'float hs(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}\n';

  var GRADE_FN = [
    'vec3 aces(vec3 x){return clamp(x*(2.51*x+.03)/(x*(2.43*x+.59)+.14),0.,1.);}',
    'float hsh(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}',
    'vec3 grade(vec3 c,vec2 v,vec2 fc,float t){',
    'c=aces(c);c=pow(c,vec3(1.06));',              // sink the shadows a touch
    'c+=vec3(.004,.007,.014)*(1.-c);',             // shadow blue-shift (film feel)
    'c*=1.-.34*dot(v*.62,v*.62);',                 // vignette
    'c+=(hsh(fc+fract(t)*7.)-.5)*.008;',           // dither vs banding
    'return c;}',
  ].join('\n');

  var QUAD_VS = HEAD + 'layout(location=0) in vec2 p;out vec2 vUv;void main(){vUv=p*.5+.5;gl_Position=vec4(p,0.,1.);}';

  /* 1 · field: the height every pin is asked for (one texel per pin). Numerals
     and wordmark are stroke distance fields raised as half-tubes: no font. */
  var FORM_FS = HEAD + HASHFN + [
    'out vec4 o;',
    'uniform vec2 uOrg,uScr;uniform float uT,uSwell,uSpin,uWs,uU,uIn;',
    'uniform vec4 uHero,uMorph,uPtr,uNum,uWord,uAx,uAxW;uniform vec3 uNumA;uniform vec4 uRip[4],uTr[10];',
    'float sg(vec2 p,vec2 a,vec2 b){vec2 d=b-a;return length(p-a-d*clamp(dot(p-a,d)/(dot(d,d)+1e-6),0.,1.));}',
    // arc: centre c, radius r, facing angle f, half-aperture ha
    'float ar(vec2 p,vec2 c,float r,float f,float ha){p-=c;float cf=cos(f),sf=sin(f);p=vec2(cf*p.x+sf*p.y,cf*p.y-sf*p.x);',
    'if(abs(atan(p.y,p.x))<ha)return abs(length(p)-r);vec2 e=r*vec2(cos(ha),sin(ha));return min(length(p-e),length(p-vec2(e.x,-e.y)));}',
    'float tb(float d,float w){d/=w;return sqrt(max(1.-d*d,0.));}',        // half-tube profile
    'float g0(vec2 p){vec2 q=abs(p)-vec2(0.,1.2);return abs(length(max(q,0.))+min(max(q.x,q.y),0.)-1.55);}',
    'float g1(vec2 p){return min(sg(p,vec2(.35,-2.75),vec2(.35,2.75)),sg(p,vec2(.35,2.75),vec2(-1.,1.7)));}',
    'float g2(vec2 p){return min(ar(p,vec2(0.,1.25),1.5,1.239,1.902),min(sg(p,vec2(1.18,.33),vec2(-1.55,-2.75)),sg(p,vec2(-1.55,-2.75),vec2(1.6,-2.75))));}',
    'float g3(vec2 p){return min(ar(p,vec2(-.05,1.3),1.45,.5236,2.0944),ar(p,vec2(-.05,-1.3),1.45,-.5236,2.0944));}',
    'float gw(vec2 p){',                                                   // L I N K U
    'float d=min(sg(p,vec2(-11.2,2.75),vec2(-11.2,-2.75)),sg(p,vec2(-11.2,-2.75),vec2(-8.4,-2.75)));',
    'd=min(d,sg(p,vec2(-6.,2.75),vec2(-6.,-2.75)));',
    'd=min(d,min(sg(p,vec2(-3.6,-2.75),vec2(-3.6,2.75)),min(sg(p,vec2(-3.6,2.75),vec2(-.2,-2.75)),sg(p,vec2(-.2,-2.75),vec2(-.2,2.75)))));',
    'd=min(d,min(sg(p,vec2(2.2,-2.75),vec2(2.2,2.75)),min(sg(p,vec2(2.2,-.4),vec2(5.4,2.75)),sg(p,vec2(3.35,.72),vec2(5.5,-2.75)))));',
    'd=min(d,min(sg(p,vec2(7.8,2.75),vec2(7.8,-1.05)),min(ar(p,vec2(9.5,-1.05),1.7,-1.5708,1.5708),sg(p,vec2(11.2,-1.05),vec2(11.2,2.75)))));',
    'return d;}',
    'float ss(float x){x=clamp(x,0.,1.);return x*x*(3.-2.*x);}',
    'void main(){',
    // P = this pin; p = the same place in design units (uU pins each)
    'vec2 P=uOrg+floor(gl_FragCoord.xy),p=P/uU;',
    // the surface is never dead: a long slow swell
    'float h=uSwell*sin(.13*p.x+.07*p.y+uT*.42)*sin(.09*p.y-.05*p.x-uT*.31);',
    // power-on: one homing pass crosses the bed — every pin dips, then seats
    'float w=(dot(p-uHero.xy,vec2(.8,.6))-uIn)*.06;h-=1.9*w*exp(-w*w);',
    // hero: dome · torus · stepped pyramid · drop impact, each becoming the next
    'vec2 q=(p-uHero.xy)/uHero.w;float d=length(q),D=d*uHero.w;',
    'float cs=cos(uSpin),sn=sin(uSpin);vec2 qr=abs(vec2(cs*q.x+sn*q.y,cs*q.y-sn*q.x))-.50;',
    'float f=uMorph.x*.66*sqrt(max(1.-d*d,0.))',
    '+uMorph.y*1.25*sqrt(max(.085-(d-.64)*(d-.64),0.))',
    '+uMorph.z*.115*clamp(floor(-(length(max(qr,0.))+min(max(qr.x,qr.y),0.)-.30)*7.2+1.),0.,5.)',
    '+uMorph.w*.62*sin(7.5*d)/(7.5*d+.001)*(1.+1.3*smoothstep(.3,.6,d))*exp(-d*d*.55);',
    'h+=uHero.z*(uHero.w*f+.22*cos(D*.9-uT*1.1)*exp(-D/16.)*smoothstep(.9,1.4,d));',
    // pillar numerals: 0 + {1,2,3}, each with its own way of arriving
    'vec2 v=p-uNum.xy;vec2 g=vec2(dot(v,uAx.xy),dot(v,uAx.zw)/uNum.w)/uNum.z;',
    'float z0=g0(g+vec2(2.35,0.));vec2 gr=g-vec2(2.35,0.);',
    'h+=3.2*(ss(uNumA.x*1.8-hs(P)*.8)*tb(min(z0,g1(gr)),.62)',                       // 01: every pin decides alone
    '+ss(uNumA.y*1.8-(g.x+4.2)/8.4*.8)*tb(min(z0,g2(gr)),.62)',                      // 02: one swept front
    '+ss(uNumA.z*1.8-length(g*vec2(1.,.7))/5.*.8)*tb(min(z0,g3(gr)),.62));',         // 03: outward from the centre
    // wordmark, swept in
    'v=p-uWord.xy;g=vec2(dot(v,uAxW.xy),dot(v,uAxW.zw)/uWs)/uWord.z;',
    'h+=2.2*ss(uWord.w*1.7-(g.x+11.4)/22.8*.7)*tb(gw(g),.52);',
    // the pointer presses in: a dent with a displaced rim
    'v=p-uPtr.xy;float dd=dot(v,v),rr=sqrt(dd)-3.4;',
    'h+=uPtr.z*(-1.7*exp(-dd/7.)+.5*exp(-rr*rr/2.4));',
    // …and leaves a wake (uTr, newest first: xy place, z age, w joined to the next)
    'for(int i=0;i<9;i++){vec4 a=uTr[i],b=uTr[i+1];float s=sg(p,a.xy,b.xy);h+=a.w*1.3*exp(-b.z-s*s*.22);}',
    // click ripples
    'for(int i=0;i<4;i++){float r=length(p-uRip[i].xy),ph=r-9.*uRip[i].z;',
    'h+=uRip[i].w*exp(-uRip[i].z*1.3)*cos(ph*1.25)*exp(-ph*ph/10.)/(1.+r*.04);}',
    'h+=uScr.y*sin(p.y*.42+p.x*.08-uScr.x);',                              // scrolling drags a wave train through the bed
    'o=vec4(clamp(h,-2.5,12.)*uU+(hs(P+7.3)-.5)*.05,0.,0.,1.);}',             // + seating tolerance
  ].join('\n');

  /* 2 · servo: second-order, speed-limited — mass, a little overshoot, late arrival */
  var SIM_FS = HEAD + HASHFN + [
    'out vec4 o;uniform sampler2D uPrev,uTgt;uniform float uDt,uU;',
    'void main(){ivec2 c=ivec2(gl_FragCoord.xy);vec4 s=texelFetch(uPrev,c,0);float tg=texelFetch(uTgt,c,0).r;',
    'float K=120.*(.8+.4*hs(vec2(c))),C=1.24*sqrt(K);',
    'float v=clamp(s.g+((tg-s.r)*K-s.g*C)*uDt,-17.*uU,17.*uU);',
    'o=vec4(s.r+v*uDt,v,0.,1.);}',
  ].join('\n');

  /* 3 · light, per pin: key visibility (a short march through the heights),
     occlusion by taller neighbours, how far down its shaft shows */
  var LIGHT_FS = HEAD + [
    'out vec4 o;uniform sampler2D uSt;uniform vec2 uLd,uGs;uniform float uLs,uU;uniform int uSx;uniform vec3 uLk;',
    'float H(ivec2 c){return texelFetch(uSt,c,0).r;}',
    'void main(){ivec2 c=ivec2(gl_FragCoord.xy);vec4 s=texelFetch(uSt,c,0);float h=s.r;',
    'float sh=1.;',
    'for(int k=1;k<=12;k++){float d=float(k)*1.25*uU;',
    'float hk=texture(uSt,(gl_FragCoord.xy+uLd*d)/uGs).r;',
    'sh=min(sh,clamp(.6-(hk-h-d*uLs)*4.5/d,0.,1.));}',   // penumbra widens with distance
    'float a=0.;',
    'a+=max(H(c+ivec2(1,0))-h,0.)+max(H(c+ivec2(-1,0))-h,0.)+max(H(c+ivec2(0,1))-h,0.)+max(H(c+ivec2(0,-1))-h,0.);',
    'a+=.7*(max(H(c+ivec2(1,1))-h,0.)+max(H(c+ivec2(-1,1))-h,0.)+max(H(c+ivec2(1,-1))-h,0.)+max(H(c+ivec2(-1,-1))-h,0.));',
    'a+=.4*(max(H(c+ivec2(2,0))-h,0.)+max(H(c+ivec2(-2,0))-h,0.)+max(H(c+ivec2(0,2))-h,0.)+max(H(c+ivec2(0,-2))-h,0.));',
    'float b=min(min(H(c+ivec2(0,1)),H(c+ivec2(uSx,1))),min(H(c+ivec2(uSx,0)),min(H(c+ivec2(0,2)),H(c+ivec2(uSx,2)))));',
    'vec3 nm=normalize(vec3(H(c+ivec2(-2,0))-H(c+ivec2(2,0)),4.,H(c+ivec2(0,-2))-H(c+ivec2(0,2))));',
    'float av=(H(c+ivec2(3,0))+H(c+ivec2(-3,0))+H(c+ivec2(0,3))+H(c+ivec2(0,-3))+H(c+ivec2(2,2))+H(c+ivec2(-2,2))+H(c+ivec2(2,-2))+H(c+ivec2(-2,-2)))*.125;',
    'float cr=clamp(1.+.26*uU*(h-av),.5,1.8);',                                  // crests stand in more light than hollows
    // r key · g occlusion · b lowest height the shaft shows down to · a fill
    'float oc=1./(1.+.5*a/uU),fs=dot(nm,vec3(.6202,.6202,.4802))/.6202;',
    'o=vec4(sh*cr*clamp(dot(nm,uLk)/uLk.y,.25,1.7),(.55+.45*cr)*oc,min(b,h)-.9,cr*clamp(fs,.4,1.6)*mix(oc,1.,smoothstep(.95,1.35,fs)));}',
  ].join('\n');

  /* 4 · the pins: one instanced quad each, in the plane facing the camera
     through the pin's axis; bead, collar and shaft are intersected analytically */
  var PIN_VS = HEAD + [
    'layout(location=0) in vec2 aC;',
    'uniform sampler2D uSt,uLt;uniform ivec2 uGrid;uniform vec2 uOrg;uniform int uIc;',
    'uniform vec3 uEye;uniform mat4 uVP;uniform float uPxK;uniform vec4 uSpot;uniform vec3 uFog,uPl;',
    'out vec2 vQ;flat out vec4 vD,vL,vG;flat out vec3 vVd;',
    'void main(){',
    'int id=gl_InstanceID,k=id%uGrid.x,j=id/uGrid.x,i;',
    // painter order: rows far → near; in a row, outer columns first
    'int a=uIc,b=uGrid.x-1-uIc,lo=min(a,b),hi=max(a,b);',
    'if(k<hi-lo){int d=hi-k;i=a>b?uIc-d:uIc+d;}',
    'else{int kk=k-(hi-lo),d=lo-kk/2;i=d==0?uIc:((kk&1)==0?uIc-d:uIc+d);}',
    'ivec2 c=ivec2(i,j);vec4 s=texelFetch(uSt,c,0),L=texelFetch(uLt,c,0);',
    'vec3 top=vec3(uOrg.x+float(i),s.r,uOrg.y+float(j));',
    'vec3 vd=top-uEye;float dist=length(vd);vd/=dist;',
    'vec3 rt=normalize(vec3(-vd.z,0.,vd.x)),up=cross(rt,vd);',
    'float cu=up.y,px=dist*uPxK,m=px;',      // foreshortening · world units per pixel · AA skirt
    'float len=max(s.r-L.b,0.)*cu;',             // visible shaft, measured on the view plane
    'vec2 qd=vec2(aC.x*(.46+m),mix(-len-m,.46+m,aC.y));',
    'float fog=smoothstep(uFog.x,uFog.y,dist);',
    // per-pin constants, decided once: light pool (the resting bed sits a
    // stop under what rises out of it), shaft glow, view basis
    'vec2 e=top.xz-uSpot.xy;',
    'float sp=.03+.97*exp(-dot(e,e)/(uSpot.z*uSpot.z))*mix(uSpot.w,1.,smoothstep(.15,1.5,s.r/uFog.z));',
    'sp*=.94+.12*fract(sin(dot(vec2(c),vec2(12.9898,78.233)))*43758.5453);',   // no two turned parts take the light quite alike
    // the pointer carries a small light of its own
    'e=top.xz-uPl.xy;sp+=uPl.z*exp(-dot(e,e)/(60.*uFog.z*uFog.z));',
    'vQ=qd;vD=vec4(len,px,cu,fog);vL=vec4(L.r*sp,L.g,L.a*sp,sp);',
    'float ex=len/max(cu,.05);',                 // how much of this pin stands clear of the ones in front
    'vG=vec4(smoothstep(.5,3.2,ex),rt.x,rt.z,smoothstep(1.,1.6,ex));vVd=vd;',
    // a pin the fog has fully taken draws nothing
    'gl_Position=fog>.996?vec4(2.,2.,2.,1.):uVP*vec4(top+rt*qd.x+up*qd.y,1.);}',
  ].join('\n');

  var PIN_FS = HEAD + [
    'in vec2 vQ;flat in vec4 vD,vL,vG;flat in vec3 vVd;out vec4 o;',
    'const float RB=.455,RS=.11;',       // bead · shaft radii (pitch = 1)
    // key softbox, cool fill, amber strip: direction + the rectangle's two axes
    'const vec3 LK=vec3(-.8287,.4662,-.3108),KT=vec3(-.3512,0.,.9363),KB=vec3(.4365,.8851,.1637);',
    'const vec3 LF=vec3(.6202,.6202,.4802),FT=vec3(.6122,0.,-.7907),FB=vec3(-.4904,.7844,-.3797);',
    'const vec3 LA=vec3(.7509,.1602,-.6407),AT=vec3(-.6491,0.,-.7607),AB=vec3(-.1219,.9871,.1040);',
    'const vec3 KC=vec3(1.,.95,.86),FC=vec3(.42,.56,.86),AM=vec3(1.,.62,.26);',
    // a soft rectangular light at infinity: half-size hs (tan units), edge softness sf
    'float box(vec3 d,vec3 D,vec3 T,vec3 B,vec2 hs,float sf){',
    'float k=dot(d,D);vec2 q=vec2(dot(d,T),dot(d,B))/max(k,.001);',
    'vec2 e=smoothstep(hs+sf,hs-sf,abs(q));return e.x*e.y*step(0.,k);}',
    // the studio a polished part mirrors (K key, F fill, ao occlusion, sp pool)
    'vec3 studio(vec3 R,float K,float ao,float F,float sp,float sf){',
    'vec3 c=(vec3(.008,.009,.012)+vec3(.40,.41,.44)*smoothstep(-.18,.62,R.y)*sp)*ao;',  // tent: soft light from above
    'c+=KC*(8.*box(R,LK,KT,KB,vec2(.30,.20),.03+sf)+1.9*pow(max(dot(R,LK),0.),7.))*K;',
    'c+=FC*(4.2*box(R,LF,FT,FB,vec2(.20,.42),.06+sf)+.6*pow(max(dot(R,LF),0.),6.))*F;',
    'c+=AM*2.2*box(R,LA,AT,AB,vec2(.42,.06),.04+sf)*sp;',
    'return c;}',
    'void main(){',
    'float len=vD.x,px=vD.y,cu=vD.z;',
    'vec3 vd=vVd,rt=vec3(vG.y,0.,vG.z),up=cross(rt,vd),th=vec3(-rt.z,0.,rt.x);',
    'float d=length(vQ);',
    // coverage of each part (analytic anti-aliasing)
    'float cb=clamp(.5-(d-RB)/px,0.,1.);',
    'float lo=clamp(.5+(vQ.y+len)/px,0.,1.);',   // above the foot of the visible shaft
    // ferrule profile: flange, cut groove, barrel, taper to the shaft (ya 0 → 1)
    'float y0=-.36*cu,y1=-.90*cu,ya=(y0-vQ.y)/(y0-y1);',
    'float rp=mix(mix(mix(.33,.21,smoothstep(.12,.17,ya)),.275,smoothstep(.26,.31,ya)),RS,smoothstep(.72,1.,ya));',
    'float cc=clamp(.5-(abs(vQ.x)-rp)/px,0.,1.)*clamp(.5+(y0-vQ.y)/px,0.,1.)*clamp(.5+(vQ.y-y1)/px,0.,1.)*lo;',
    'float cs=clamp(.5-(abs(vQ.x)-RS)/px,0.,1.)*step(vQ.y,0.)*lo;',
    'float al=max(cb,max(cc,cs));',
    'if(al<.004)discard;',
    'float K=vL.r,ao=vL.g,F=vL.b,sp=vL.a,gl=vG.x;',
    'vec3 col=vec3(0.),n;',
    // only the part this pixel actually shows is shaded
    'if(cb<.999){',
    'float up01=clamp((vQ.y+len)/max(cu,.05),0.,40.),sx,cz,kk,kf;',    // height above the foot of the visible shaft
    // a turned cylinder answers a light with one streak down its length (ak key, af fill)
    'vec3 hk=LK-vd,hf=LF-vd;',
    'vec2 ak=normalize(vec2(dot(rt,hk),dot(th,hk)+.9)),af=normalize(vec2(dot(rt,hf),dot(th,hf))+1e-4);',   // +.9: turned toward the camera, off the rod's edge
    'if(vG.w>0.){',
    // shaft: a slim satin-steel rod — a key line, a cool one, dark further down
    'sx=clamp(vQ.x/RS,-1.,1.);cz=sqrt(1.-sx*sx);',
    'kk=max(sx*ak.x+cz*ak.y,0.);kf=max(sx*af.x+cz*af.y,0.);',
    'col=vec3(.44,.45,.48)*((.01+.07*sp*ao)*(.3+.7*cz)+KC*K*(.12*kk+2.0*pow(kk,12.))+FC*F*(.04*kf+.22*pow(kf,10.)))*mix(.10,1.,smoothstep(-.3,2.6,up01));',
    'col+=AM*gl*.20*exp(-up01/.9)*(.25+.75*cz);',       // what little the base throws back up
    'if(cc>0.){',
    // ferrule: gold; a lit flange lip and a dark groove, each ≥ 1px
    'sx=clamp(vQ.x/rp,-1.,1.);cz=sqrt(1.-sx*sx);',
    'kk=max(sx*ak.x+cz*ak.y,0.);kf=max(sx*af.x+cz*af.y,0.);',
    'float gw=max(.06,px/(y0-y1)*.8);',
    'vec3 cg=vec3(1.,.74,.40)*((.03+.34*sp*ao)*(.35+.65*cz)+KC*K*(.34*kk+3.0*pow(kk,10.))+FC*F*(.08*kf+.3*pow(kf,8.)));',
    'cg*=1.-.78*exp(-(ya-.21)*(ya-.21)/(gw*gw));',
    'cg+=vec3(1.,.86,.58)*(.38*K+.08*ao*sp)*exp(-ya*ya/(gw*gw*1.4))*(.35+.65*cz);',
    'col=mix(col,cg+AM*gl*.05,cc);}',
    '}',
    // a seated pin shows only slivers of ferrule: one highlight line will do
    'if(vG.w<1.){',
    'sx=clamp(vQ.x/(cc>0.?rp:RS),-1.,1.);cz=sqrt(1.-sx*sx);kk=max(sx*ak.x+cz*ak.y,0.);',
    'col=mix(mix(vec3(.05,.052,.06),vec3(1.,.74,.40),cc)*((.02+.2*sp)*ao+KC*K*(.3*kk+1.6*pow(kk,6.))),col,vG.w);}',
    '}',
    'if(cb>0.){',
    // bead: satin steel sphere
    'n=(vQ.x*rt+vQ.y*up-sqrt(max(RB*RB-d*d,0.))*vd)/RB;',
    'vec3 R=reflect(vd,n);float fr=pow(clamp(1.-dot(n,-vd),0.,1.),5.);',   // clamped: pow of a negative base is undefined
    'float lh=mix(.30,1.,smoothstep(-.75,.45,n.y));',      // beads touch: their lower halves sit in each other's shade
    'vec3 bd=studio(R,K,ao*lh,F*lh,sp,px*.6);',
    // beads mirror each other: the reflected ray against the neighbour on its
    // dominant grid axis (assumed level) — only where a bead is big enough
    'if(px<.088){vec3 q=n*RB-(abs(R.x)>abs(R.z)?vec3(sign(R.x),0.,0.):vec3(0.,0.,sign(R.z)));',
    'float b=dot(q,R),e=b*b-dot(q,q)+RB*RB;',
    'if(e>0.&&b<0.)bd=mix(bd,studio(reflect(R,(q+R*(-b-sqrt(e)))/RB),K,ao,F*.5,sp,.1)*.62,smoothstep(0.,.012+px*.25,e)*smoothstep(.088,.072,px)*(1.-gl));}',
    'bd=bd*mix(vec3(.80,.78,.74),vec3(1.),fr*.6)+vec3(.035,.04,.05)*fr*sp*ao;',   // + a rim that draws each sphere out of its neighbours
    'bd+=AM*gl*.10*max(-n.y,0.);',
    'col=mix(col,bd,cb);}',
    'col=mix(col,vec3(.014,.014,.017),vD.w);',
    'o=vec4(col*al,al);}',
  ].join('\n');

  var COPY_FS = HEAD + 'in vec2 vUv;out vec4 o;uniform sampler2D uTex;void main(){o=vec4(texture(uTex,vUv).rgb,1.);}';
  var BLUR_FS = HEAD + [
    'in vec2 vUv;out vec4 o;uniform sampler2D uTex;uniform vec2 uDir;',
    'void main(){vec3 c=texture(uTex,vUv).rgb*.227027;',
    'vec2 o1=uDir*1.3846154,o2=uDir*3.2307692;',
    'c+=texture(uTex,vUv+o1).rgb*.3162162;c+=texture(uTex,vUv-o1).rgb*.3162162;',
    'c+=texture(uTex,vUv+o2).rgb*.0702703;c+=texture(uTex,vUv-o2).rgb*.0702703;',
    'o=vec4(c,1.);}',
  ].join('\n');
  // composite: focus (analytic — the bed is a plane), bloom, grade
  var COMP_FS = HEAD + GRADE_FN + [
    'in vec2 vUv;out vec4 o;',
    'uniform sampler2D uScene,uB0,uB1,uB2;uniform vec3 uEye,uF,uR,uU;uniform vec2 uTan;',
    'uniform float uT,uExposure,uBloomAmt,uDof,uFoc;',
    'void main(){',
    'vec2 nd=vUv*2.-1.;',
    'vec3 rd=normalize(uF+uR*nd.x*uTan.x+uU*nd.y*uTan.y);',
    'float t=rd.y<-.001?-uEye.y/rd.y:1e4;',
    'float coc=clamp(abs(t-uFoc)/uFoc*uDof,0.,1.);',
    'vec3 c=texture(uScene,vUv).rgb,b0=texture(uB0,vUv).rgb,b1=texture(uB1,vUv).rgb,b2=texture(uB2,vUv).rgb;',
    'c=mix(c,b0,smoothstep(0.,.5,coc));c=mix(c,b1,smoothstep(.4,1.,coc));',
    'c+=max(b0*.3+b1*.4+b2*.5-.05,0.)*uBloomAmt;',
    'o=vec4(grade(c*uExposure,nd,gl_FragCoord.xy,uT),1.);}',
  ].join('\n');

  var POINT_VS = HEAD + [
    'layout(location=0) in vec3 aPos;layout(location=1) in float aSize;layout(location=2) in float aAlpha;layout(location=3) in float aWarm;',
    'uniform mat4 uProj;uniform mat3 uRot;uniform float uPx;',
    'out float vA;out float vWarm;',
    'void main(){vec3 p=uRot*aPos+vec3(0.,0.,-4.);gl_Position=uProj*vec4(p,1.);',
    'gl_PointSize=clamp(aSize*uPx/max(.4,-p.z),.75,7.);vA=aAlpha;vWarm=aWarm;}',
  ].join('\n');
  var POINT_FS = HEAD + [
    'in float vA;in float vWarm;out vec4 o;',
    'void main(){float a=smoothstep(.5,.06,distance(gl_PointCoord,vec2(.5)))*vA*.85;',
    'o=vec4(mix(vec3(.55,.70,.92),vec3(1.,.86,.62),vWarm)*a,1.);}',
  ].join('\n');

  /* ---------------- programs ----------------
     Compile and link are only started here; with KHR_parallel_shader_compile
     nothing waits on them (boot polls progsDone()), so a first visit does not
     stall for the length of a shader compile. */
  var progs = [], PSC = null;
  function prog(vs, fs) {
    var o = { p: gl.createProgram(), u: {}, s: [] };
    [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]].forEach(function (d) {
      var s = gl.createShader(d[0]);
      gl.shaderSource(s, d[1]); gl.compileShader(s); gl.attachShader(o.p, s);
      o.s.push(s);
    });
    gl.linkProgram(o.p);
    progs.push(o);
    return o;
  }
  function progsDone() {
    if (PSC) for (var i = 0; i < progs.length; i++) if (!gl.getProgramParameter(progs[i].p, PSC.COMPLETION_STATUS_KHR)) return false;
    return true;
  }
  // link status + uniform table (this is the call that blocks without the extension)
  function progsFinish() {
    progs.forEach(function (o) {
      var p = o.p, j, n, inf;
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || gl.getShaderInfoLog(o.s[0]) || gl.getShaderInfoLog(o.s[1]) || 'link');
      n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (j = 0; j < n; j++) { inf = gl.getActiveUniform(p, j); o.u[inf.name.replace('[0]', '')] = gl.getUniformLocation(p, inf.name); }
    });
  }

  var P = {}, vaoQuad = null, vaoPin = null, vaoPts = null, blackTex = null;

  /* inner-page stars (L0) */
  var NS = 140, pointData = new Float32Array(NS * 6);
  if (INNER) for (var s0 = 0; s0 < NS; s0++) {
    var th0 = Math.random() * 6.2831853, ph0 = Math.acos(2 * Math.random() - 1), rr0 = 7 + Math.random() * 3.2, o0 = s0 * 6;
    pointData[o0] = rr0 * Math.sin(ph0) * Math.cos(th0);
    pointData[o0 + 1] = rr0 * Math.cos(ph0) * 0.72;
    pointData[o0 + 2] = rr0 * Math.sin(ph0) * Math.sin(th0);
    pointData[o0 + 3] = 0.05 + Math.random() * 0.075;
    pointData[o0 + 4] = 0.035 + Math.random() * 0.09;
    pointData[o0 + 5] = Math.random() < 0.75 ? 0.85 : 0.15;
  }

  function initGLObjects() {
    var b;
    PSC = gl.getExtension('KHR_parallel_shader_compile');
    TQ = HOME && gl.getExtension('EXT_disjoint_timer_query_webgl2');
    tq = null; tqOpen = false;
    vaoQuad = gl.createVertexArray();
    gl.bindVertexArray(vaoQuad);
    b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    if (INNER) {
      P.points = prog(POINT_VS, POINT_FS);
      vaoPts = gl.createVertexArray();
      gl.bindVertexArray(vaoPts);
      b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, pointData, gl.STATIC_DRAW);
      for (var i = 0; i < 4; i++) {
        gl.enableVertexAttribArray(i);
        gl.vertexAttribPointer(i, i ? 1 : 3, gl.FLOAT, false, 24, i ? 8 + i * 4 : 0);
      }
    } else {
      P.form = prog(QUAD_VS, FORM_FS);
      P.sim = prog(QUAD_VS, SIM_FS);
      P.light = prog(QUAD_VS, LIGHT_FS);
      P.pin = prog(PIN_VS, PIN_FS);
      P.copy = prog(QUAD_VS, COPY_FS);
      P.blur = prog(QUAD_VS, BLUR_FS);
      P.comp = prog(QUAD_VS, COMP_FS);
      blackTex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, blackTex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
      vaoPin = gl.createVertexArray();
      gl.bindVertexArray(vaoPin);
      b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, 0, 1, 0, -1, 1, 1, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    }
    gl.bindVertexArray(null);
    grid = null;
  }

  /* ---------------- targets ---------------- */
  var W = 0, H = 0, cssW = 0, cssH = 0, fbo = null, grid = null, tier = 0;
  var TIER_SCALE = [1, 0.8, 0.64];
  // long-edge cap of the drawing buffer: 2200, or 3200 once the GPU has
  // proved it has room (sharpen()) — native sharpness on dense screens
  var EDGE = HOME ? 2200 : 1600, TQ = null, tq = null, tqOpen = false, tqN = 0, tqNs = 1e12, tqWarm = 0;
  function texFBO(w, h, linear, check) {
    var t = gl.createTexture(), flt = linear ? gl.LINEAR : gl.NEAREST;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, flt);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, flt);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    var f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    // a float target the device cannot render to must fail here, loudly (the
    // callers fall back to the plain page); asked once per set — a GPU round trip
    if (check && !gl.isContextLost() && gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('incomplete framebuffer ' + w + 'x' + h);
    return { t: t, f: f, w: w, h: h };
  }
  function delSet(set) {
    for (var k in set) if (set[k] && set[k].t) { gl.deleteTexture(set[k].t); gl.deleteFramebuffer(set[k].f); }
  }
  function buildFBOs() {
    if (fbo) delSet(fbo);
    var w2 = Math.max(2, W >> 1), h2 = Math.max(2, H >> 1);
    var w4 = Math.max(2, W >> 2), h4 = Math.max(2, H >> 2);
    var w8 = Math.max(2, W >> 3), h8 = Math.max(2, H >> 3);
    fbo = {
      scene: texFBO(W, H, true, 1), half: texFBO(w2, h2, true),
      b0a: texFBO(w2, h2, true), b0b: texFBO(w2, h2, true),
      b1a: texFBO(w4, h4, true), b1b: texFBO(w4, h4, true),
      b2a: texFBO(w8, h8, true), b2b: texFBO(w8, h8, true),
    };
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /* ---------------- camera (y up, bed = plane y 0) ---------------- */
  var TANY = Math.tan(0.16);   // ≈18° lens: long, so the bed does not splay
  function mkCam(yaw, el, dist) {
    var ce = Math.cos(el);
    var C = [dist * Math.sin(yaw) * ce, dist * Math.sin(el), dist * Math.cos(yaw) * ce];
    var f = [-C[0] / dist, -C[1] / dist, -C[2] / dist];
    var r = [-f[2], 0, f[0]], l = Math.hypot(r[0], r[2]); r[0] /= l; r[2] /= l;
    return { C: C, f: f, r: r, u: [-r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1]], D: dist };
  }
  // screen (0..1, y down) → bed hit [x, z, distance]; null above the horizon
  function unproj(c, sx, sy) {
    var ax = (sx * 2 - 1) * TANY * cssW / cssH, ay = (1 - sy * 2) * TANY;
    var dx = c.f[0] + c.r[0] * ax + c.u[0] * ay, dy = c.f[1] + c.u[1] * ay, dz = c.f[2] + c.r[2] * ax + c.u[2] * ay;
    if (dy > -0.004) return null;
    var t = -c.C[1] / dy;
    return [c.C[0] + dx * t, c.C[2] + dz * t, t * Math.hypot(dx, dy, dz)];
  }
  var vp = new Float32Array(16);
  function camVP(c) {
    var fy = 1 / TANY, fx = fy * H / W, n = 1, fa = 2000, A = (fa + n) / (n - fa), Bq = 2 * fa * n / (n - fa);
    var C = c.C, r = c.r, u = c.u, f = c.f;
    var rc = r[0] * C[0] + r[2] * C[2], uc = u[0] * C[0] + u[1] * C[1] + u[2] * C[2], fc = f[0] * C[0] + f[1] * C[1] + f[2] * C[2];
    vp[0] = fx * r[0]; vp[4] = 0; vp[8] = fx * r[2]; vp[12] = -fx * rc;
    vp[1] = fy * u[0]; vp[5] = fy * u[1]; vp[9] = fy * u[2]; vp[13] = -fy * uc;
    vp[2] = -A * f[0]; vp[6] = -A * f[1]; vp[10] = -A * f[2]; vp[14] = A * fc + Bq;
    vp[3] = f[0]; vp[7] = f[1]; vp[11] = f[2]; vp[15] = -fc;
    return vp;
  }

  /* ---------------- composition: one keyframe per home section ----------------
     el / yaw = camera, px = pin pitch on screen, sx / sy = where the subject
     sits, spot = light-pool radius, swell = idle surface amplitude. */
  var KF = [], LKH = [-0.9363, -0.3511], LKS = 0.5267;   // key light: horizontal direction (toward it) and slope
  function layout() {
    var asp = cssW / cssH, port = asp < 0.9, i, k;
    // `ref` is the pitch the forms were composed at; the bed is finer, and
    // U (pins per design unit) keeps every form the size it was drawn
    var ref = port ? Math.max(9.5, Math.min(16, cssW / 38)) : Math.max(12, Math.min(19, cssH / 56));
    var base = port ? Math.max(7.6, Math.min(12, cssW / 50)) : Math.max(11, Math.min(17, cssH / 76));
    var U, x0, x1, z0, z1, pass;
    // ultrawide / tall portrait: more pins wanted than the grid holds. The
    // pitch coarsens until the bed covers the frame (8% over is overscan + fog)
    for (pass = 0; pass < 2; pass++) {
      U = ref / base;
      KF = [
        { el: 0.56, yaw: 0.30, px: base, sx: port ? 0.5 : 0.715, sy: port ? 0.84 : 0.58, exp: 1.00, dof: 1.7, swell: 0.16, spot: port ? 15 : 27, bed: 0.62, ptr: 1 },          // hero
        { el: 0.36, yaw: 0.18, px: base * 2.6, sx: port ? 0.5 : 0.84, sy: port ? 0.93 : 1.10, exp: 0.74, dof: 1.5, swell: 0.38, spot: port ? 7 : 11, bed: 1, ptr: 0.4 },                    // statement (macro, under the sentence — not behind it)
        { el: 0.80, yaw: 0.20, px: base * 1.07, sx: port ? 0.5 : 0.75, sy: port ? 0.96 : 0.50, exp: port ? 0.70 : 1.00, dof: 1.5, swell: 0.10, spot: port ? 16 : 30, bed: 0.62, ptr: 1 },  // pillars
        { el: 0.95, yaw: 0.30, px: base * 0.88, sx: port ? 0.5 : 0.62, sy: 0.96, exp: 0.50, dof: 1.8, swell: 0.30, spot: 30, bed: 1, ptr: 0 },                     // work (quiet: the pool sinks below the copy)
        { el: 0.82, yaw: 0.07, px: base * (port ? 0.72 : 0.90), sx: port ? 0.5 : 0.645, sy: port ? 0.70 : 0.55, exp: 1.15, dof: 1.2, swell: 0.08, spot: port ? 34 : 50, bed: 0.55, ptr: 1 }, // contact (finer: the wordmark needs pins)
      ];
      x0 = 1e9; x1 = -1e9; z0 = 1e9; z1 = -1e9;
      for (i = 0; i < KF.length; i++) {
        var K = KF[i];
        K.spot *= U;
        K.D = cssH / (2 * TANY * K.px);
        var c = mkCam(K.yaw, K.el, K.D), h = unproj(c, K.sx, K.sy);
        K.hx = h[0]; K.hz = h[1];
        // glyphs lie on the bed facing this chapter's camera: right / away axes
        var fl = Math.hypot(c.f[0], c.f[2]);
        K.ax = [c.r[0], c.r[2], c.f[0] / fl, c.f[2] / fl];
        K.st = 0.92 / Math.max(0.5, Math.sin(K.el));     // undo most of the vertical foreshortening
        for (k = 0; k < 4; k++) {
          var e = unproj(mkCam(K.yaw + 0.06, K.el, K.D), k & 1 ? 1.06 : -0.06, k & 2 ? 1.08 : -0.10) || [c.C[0], c.C[2] - 9e9, 9e9];
          var lim = K.D * 1.62;                           // past the fog nothing reads — don't pay for it
          if (e[2] > lim) { e[0] = c.C[0] + (e[0] - c.C[0]) * lim / e[2]; e[1] = c.C[2] + (e[1] - c.C[2]) * lim / e[2]; }
          x0 = Math.min(x0, e[0]); x1 = Math.max(x1, e[0]); z0 = Math.min(z0, e[1]); z1 = Math.max(z1, e[1]);
        }
      }
      x0 = Math.floor(x0) - 2; z0 = Math.floor(z0) - 2; x1 = Math.ceil(x1) + 2; z1 = Math.ceil(z1) + 4;
      var over = Math.max((x1 - x0 + 1) / 340, (z1 - z0 + 1) / 310) / 1.08;
      if (over <= 1) break;
      base *= over;
    }
    var nx = Math.min(340, x1 - x0 + 1), ny = Math.min(310, z1 - z0 + 1);
    x0 = Math.max(x0, x1 - nx + 1) | 0; z0 = Math.max(z0, z1 - ny + 1) | 0;   // if capped, keep the near / right side
    if (grid) delSet(grid);
    grid = { nx: nx, ny: ny, ox: x0, oz: z0, tgt: texFBO(nx, ny, false), a: texFBO(nx, ny, true, 1), b: texFBO(nx, ny, true), lt: texFBO(nx, ny, false) };
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    // subjects
    var hero = KF[0], num = KF[2], word = KF[4];
    grid.heroR = Math.min(cssW * (port ? 0.32 : 0.175), cssH * (port ? 0.20 : 0.27)) / hero.px;
    grid.numU = cssW * (port ? 0.76 : 0.285) / 8.6 / num.px;
    grid.wordU = cssW * (port ? 0.70 : 0.57) / 22.6 / word.px;
    grid.port = port; grid.U = U;
  }

  function applySize(force) {
    var dpr = Math.min(devicePixelRatio || 1, HOME ? 2 : 1.5);
    var cw = canvas.clientWidth || innerWidth, ch = canvas.clientHeight || innerHeight;
    var capEdge = Math.min(1, EDGE / (Math.max(cw, ch) * dpr));
    var s = dpr * capEdge * TIER_SCALE[Math.min(tier, 2)];
    W = Math.max(8, Math.round(cw * s));
    H = Math.max(8, Math.round(ch * s));
    canvas.width = W; canvas.height = H;
    if (INNER) {
      var fv = 1 / Math.tan(0.30);
      gl.useProgram(P.points.p);
      gl.uniformMatrix4fv(P.points.u.uProj, false, new Float32Array([fv * H / W, 0, 0, 0, 0, fv, 0, 0, 0, 0, 12.1 / (0.1 - 12), -1, 0, 0, 2 * 12 * 0.1 / (0.1 - 12), 0]));
      gl.uniform1f(P.points.u.uPx, fv * H / 2);
      return;
    }
    buildFBOs();
    if (force || !grid || cw !== cssW || ch !== cssH) { cssW = cw; cssH = ch; layout(); }
  }

  /* ---------------- orchestration state ---------------- */
  var sections = HOME ? [].slice.call(document.querySelectorAll('[data-screen-label]')) : [];
  var pillarEls = HOME ? [].slice.call(document.querySelectorAll('.pillar')) : [];
  var chapter = 0; // smoothed

  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function smooth(x) { x = clamp01(x); return x * x * (3 - 2 * x); }
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  // section tops, re-measured only when the document height changes
  var secTops = [], pilCenters = [], measuredSH = -1;
  function freshLayout() {
    if (root.scrollHeight === measuredSH) return;
    var sy = window.scrollY || 0, i, r;
    measuredSH = root.scrollHeight;
    secTops = []; pilCenters = [];
    for (i = 0; i < sections.length; i++) secTops.push(sy + sections[i].getBoundingClientRect().top);
    for (i = 0; i < pillarEls.length && i < 3; i++) {
      r = pillarEls[i].getBoundingClientRect();
      pilCenters.push(sy + r.top + r.height / 2);
    }
  }
  // one plateau per section, blended while the next one slides in
  function chapterTarget() {
    freshLayout();
    var vc = (window.scrollY || 0) + innerHeight / 2, c = 0;
    for (var i = 1; i < secTops.length; i++) c += smooth((vc - secTops[i]) / innerHeight + 0.5);
    return c;
  }
  // main.js publishes the pinned index; flowing layouts fall back to proximity
  function pillarIndex() {
    if (typeof window.__pillar === 'number') return window.__pillar;
    var vc = (window.scrollY || 0) + innerHeight / 2, best = -1, bd = 1e9;
    for (var i = 0; i < pilCenters.length; i++) {
      var d = Math.abs(pilCenters[i] - vc);
      if (d < bd) { bd = d; best = i; }
    }
    return bd < innerHeight * 0.5 ? best : -1;   // only while a pillar is actually being read
  }

  /* ---------------- interaction / lifecycle ---------------- */
  var tmx = 0, tmy = 0, cmx = 0, cmy = 0, ptrX = -1, ptrY = -1, ptrT = -1e9;
  var lastActive = 0, simT = 0, introT = 0;
  var INTRO = 2.6;
  var seen = false;
  try { seen = sessionStorage.getItem('linku_scene') === '1'; } catch (e) { }
  if (seen) introT = INTRO;
  var clicks = [];
  addEventListener('pointermove', function (e) {
    tmx = (e.clientX / innerWidth) * 2 - 1;
    tmy = (e.clientY / innerHeight) * 2 - 1;
    ptrX = e.clientX; ptrY = e.clientY;
    lastActive = ptrT = performance.now();
  }, { passive: true });
  addEventListener('pointerdown', function (e) {
    if (HOME) clicks.push([e.clientX, e.clientY]);   // client px; normalised against the canvas box where it is used
    lastActive = performance.now();
  }, { passive: true });
  addEventListener('scroll', function () { lastActive = performance.now(); }, { passive: true });

  /* ---------------- per-frame state ---------------- */
  var cam = null, S = null;
  var numA = [0, 0, 0], press = 0, ptrW = [0, 0], rip = new Float32Array(16), ripN = 0, morph = [1, 0, 0, 0];
  var trail = new Float32Array(40), trailT = 0;
  var scrY = window.scrollY || 0, scrPh = 0, scrAmp = 0;
  for (var r0 = 0; r0 < 4; r0++) rip[r0 * 4 + 2] = 99;
  for (r0 = 0; r0 < 10; r0++) { trail[r0 * 4] = 1e4 + r0; trail[r0 * 4 + 2] = 99; }
  function computeState(dt) {
    simT += dt;
    var pe = easeOutCubic(Math.min(1, introT / INTRO)), st = {}, k, i;
    cmx += (tmx - cmx) * Math.min(1, dt * 2.5);
    cmy += (tmy - cmy) * Math.min(1, dt * 2.5);
    chapter += (chapterTarget() - chapter) * Math.min(1, dt * 5);
    var i0 = Math.max(0, Math.min(KF.length - 2, Math.floor(chapter)));
    var f = clamp01(chapter - i0), A = KF[i0], B = KF[i0 + 1];
    for (k in A) if (typeof A[k] === 'number') st[k] = lerp(A[k], B[k], f);
    // pointer parallax + a slow drift. Yaw never crosses zero (painter order)
    cam = mkCam(Math.max(0.04, st.yaw + cmx * 0.02 + 0.012 * Math.sin(simT * 0.13)), st.el - cmy * 0.012, st.D);
    st.exp *= pe * (0.4 + 0.6 * pe);         // up from black
    if (cssW / cssH < 0.9) st.exp *= 0.84;      // portrait: copy crosses the bed — dim it
    // the copy leads: the solid rises once the headline has landed, and it
    // changes slowly enough to be looked away from
    st.hero = clamp01(1 - chapter * 1.7) * smooth((introT - 1.05) / 1.2);
    var seg = simT * 0.1, sk = Math.floor(seg) % 4, sf = smooth((seg - Math.floor(seg) - 0.72) / 0.28);
    for (i = 0; i < 4; i++) morph[i] = i === sk ? 1 - sf : i === (sk + 1) % 4 ? sf : 0;
    var pi = Math.abs(chapter - 2) < 0.5 && !grid.port ? pillarIndex() : -1;
    for (k = 0; k < 3; k++) numA[k] = clamp01(numA[k] + dt * (k === pi ? 0.9 : -1.9));
    st.word = clamp01((chapter - 3.3) / 0.6);
    var active = running && performance.now() - ptrT < 2600 && ptrX >= 0, h = active ? unproj(cam, ptrX / cssW, ptrY / cssH) : null;
    if (h) { ptrW[0] = h[0]; ptrW[1] = h[1]; }
    // the wake: the path every 40ms; a jump or a pause starts a new stroke
    for (i = 0; i < 10; i++) trail[i * 4 + 2] += dt;
    trailT += dt;
    var tdx = h ? h[0] / grid.U - trail[0] : 0, tdz = h ? h[1] / grid.U - trail[1] : 0, tdd = tdx * tdx + tdz * tdz;
    // the pointer's dent, wake and light keep off the copy (the text column,
    // portrait, and as much as each chapter's `ptr` allows)
    var keep = st.ptr * (grid.port ? 0.3 : smooth((ptrX / cssW - 0.34) / 0.22));
    if (h && trailT > 0.04 && tdd > 0.2) {
      trail.copyWithin(4, 0, 36);
      trail[0] = h[0] / grid.U; trail[1] = h[1] / grid.U; trail[2] = 0;
      trail[3] = tdd < 900 && trail[6] < 0.25 ? keep : 0;
      trailT = 0;
    }
    press += ((h ? 1 : 0) - press) * Math.min(1, dt * (h ? 7 : 2.2));
    st.pl = press * keep;
    for (i = 0; i < 4; i++) rip[i * 4 + 2] += dt;
    while (clicks.length) {
      var ck = clicks.pop(), hh = running ? unproj(cam, ck[0] / cssW, ck[1] / cssH) : null;
      if (hh) { rip[ripN * 4] = hh[0] / grid.U; rip[ripN * 4 + 1] = hh[1] / grid.U; rip[ripN * 4 + 2] = 0; rip[ripN * 4 + 3] = 1.5; ripN = (ripN + 1) % 4; }
    }
    // scroll: phase follows position, amplitude follows speed
    var sy = window.scrollY || 0, sv = running && dt > 0 ? (sy - scrY) / innerHeight / dt : 0;
    scrY = sy; scrPh = sy / innerHeight * 7;
    scrAmp += (Math.min(0.55, Math.abs(sv) * 0.4) - scrAmp) * Math.min(1, dt * (Math.abs(sv) > 0.05 ? 6 : 2.2));
    st.spx = lerp(A.hx, B.hx, f); st.spz = lerp(A.hz, B.hz, f);
    st.foc = Math.hypot(cam.C[0] - st.spx, cam.C[1], cam.C[2] - st.spz);
    S = st;
    return st;
  }

  /* ---------------- GPU passes ---------------- */
  function quadPass(pr, dst, w, h) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst);
    gl.viewport(0, 0, w, h);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function tex(unit, t, loc) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.uniform1i(loc, unit);
  }
  function advance(st, dt) {
    var g = grid, u = P.form.u, hero = KF[0], num = KF[2], word = KF[4], U = g.U;
    gl.disable(gl.BLEND);
    gl.bindVertexArray(vaoQuad);
    gl.useProgram(P.form.p);
    gl.uniform2f(u.uOrg, g.ox, g.oz);
    gl.uniform1f(u.uT, simT);
    gl.uniform1f(u.uU, U);
    gl.uniform1f(u.uSwell, st.swell);
    gl.uniform1f(u.uSpin, simT * 0.12);
    gl.uniform4f(u.uHero, hero.hx / U, hero.hz / U, st.hero, g.heroR / U);
    gl.uniform4fv(u.uMorph, morph);
    gl.uniform4f(u.uPtr, ptrW[0] / U, ptrW[1] / U, st.pl, 0);
    gl.uniform4fv(u.uRip, rip);
    gl.uniform4fv(u.uTr, trail);
    gl.uniform4f(u.uNum, num.hx / U, num.hz / U, g.numU / U, num.st);
    gl.uniform3fv(u.uNumA, numA);
    gl.uniform4fv(u.uAx, num.ax);
    gl.uniform4f(u.uWord, word.hx / U, word.hz / U, g.wordU / U, st.word);
    gl.uniform4fv(u.uAxW, word.ax);
    gl.uniform1f(u.uWs, word.st);
    gl.uniform2f(u.uScr, scrPh, scrAmp);
    gl.uniform1f(u.uIn, introT < INTRO ? introT * 80 - 46 : 1e4);   // the homing pass; parked far away afterwards
    quadPass(P.form, g.tgt.f, g.nx, g.ny);
    gl.useProgram(P.sim.p);
    gl.uniform1f(P.sim.u.uU, U);
    var steps = dt > 0.02 ? 2 : 1;
    for (var i = 0; i < steps; i++) {
      tex(0, g.a.t, P.sim.u.uPrev);
      tex(1, g.tgt.t, P.sim.u.uTgt);
      gl.uniform1f(P.sim.u.uDt, dt / steps);
      quadPass(P.sim, g.b.f, g.nx, g.ny);
      var sw = g.a; g.a = g.b; g.b = sw;
    }
  }

  function mul3(a, b) {
    var o = new Float32Array(9);
    for (var c = 0; c < 3; c++) for (var r = 0; r < 3; r++)
      o[c * 3 + r] = a[r] * b[c * 3] + a[3 + r] * b[c * 3 + 1] + a[6 + r] * b[c * 3 + 2];
    return o;
  }
  function rx(t) { var c = Math.cos(t), s = Math.sin(t); return new Float32Array([1, 0, 0, 0, c, s, 0, -s, c]); }
  function ry(t) { var c = Math.cos(t), s = Math.sin(t); return new Float32Array([c, 0, -s, 0, 1, 0, s, 0, c]); }

  var bloomOff = false;
  function draw(st) {
    if (INNER) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, W, H);
      gl.clearColor(0.0175, 0.0205, 0.0274, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(P.points.p);
      gl.uniformMatrix3fv(P.points.u.uRot, false, mul3(ry(0.42 + cmx * 0.14 + simT * 0.004), rx(-0.52 + cmy * 0.09)));
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.bindVertexArray(vaoPts);
      gl.drawArrays(gl.POINTS, 0, NS);
      gl.disable(gl.BLEND);
      return;
    }
    var g = grid, u;
    gl.disable(gl.BLEND);
    gl.bindVertexArray(vaoQuad);
    gl.useProgram(P.light.p);
    u = P.light.u;
    tex(0, g.a.t, u.uSt);
    gl.uniform2f(u.uLd, LKH[0], LKH[1]);
    gl.uniform2f(u.uGs, g.nx, g.ny);
    gl.uniform1f(u.uLs, LKS);
    gl.uniform1f(u.uU, g.U);
    gl.uniform1i(u.uSx, 1);                       // the camera always stands on the +x side
    gl.uniform3f(u.uLk, -0.8287, 0.4662, -0.3108);
    quadPass(P.light, g.lt.f, g.nx, g.ny);
    // pins, back to front, composited "over"
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.scene.f);
    gl.viewport(0, 0, W, H);
    gl.clearColor(0.014, 0.014, 0.017, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(P.pin.p);
    u = P.pin.u;
    tex(0, g.a.t, u.uSt);
    tex(1, g.lt.t, u.uLt);
    gl.uniform2i(u.uGrid, g.nx, g.ny);
    gl.uniform2f(u.uOrg, g.ox, g.oz);
    gl.uniform1i(u.uIc, Math.max(0, Math.min(g.nx - 1, Math.round(cam.C[0] - g.ox))));
    gl.uniform3fv(u.uEye, cam.C);
    gl.uniformMatrix4fv(u.uVP, false, camVP(cam));
    gl.uniform1f(u.uPxK, 2 * TANY / H);
    gl.uniform4f(u.uSpot, st.spx, st.spz, st.spot, st.bed);
    gl.uniform3f(u.uFog, cam.D * 1.06, cam.D * 1.50, g.U);
    gl.uniform3f(u.uPl, ptrW[0], ptrW[1], st.pl * 0.35);
    gl.bindVertexArray(vaoPin);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, g.nx * g.ny);
    gl.disable(gl.BLEND);
    // post
    gl.bindVertexArray(vaoQuad);
    function pass(pr, dst, binds, set) {
      gl.useProgram(pr.p);
      for (var i = 0; i < binds.length; i++) tex(i, binds[i][1], pr.u[binds[i][0]]);
      if (set) set(pr.u);
      quadPass(pr, dst ? dst.f : null, dst ? dst.w : W, dst ? dst.h : H);
    }
    function blur(src, a, b) {
      pass(P.blur, a, [['uTex', src.t]], function (c) { gl.uniform2f(c.uDir, 1 / a.w, 0); });
      pass(P.blur, b, [['uTex', a.t]], function (c) { gl.uniform2f(c.uDir, 0, 1 / a.h); });
    }
    var post = !bloomOff;
    if (post) {
      pass(P.copy, fbo.half, [['uTex', fbo.scene.t]]);
      blur(fbo.half, fbo.b0a, fbo.b0b);
      blur(fbo.b0b, fbo.b1a, fbo.b1b);
      blur(fbo.b1b, fbo.b2a, fbo.b2b);
    }
    pass(P.comp, null, [
      ['uScene', fbo.scene.t],
      ['uB0', post ? fbo.b0b.t : blackTex],
      ['uB1', post ? fbo.b1b.t : blackTex],
      ['uB2', post ? fbo.b2b.t : blackTex],
    ], function (c) {
      gl.uniform3fv(c.uEye, cam.C); gl.uniform3fv(c.uF, cam.f); gl.uniform3fv(c.uR, cam.r); gl.uniform3fv(c.uU, cam.u);
      gl.uniform2f(c.uTan, TANY * W / H, TANY);
      gl.uniform1f(c.uT, simT);
      gl.uniform1f(c.uExposure, st.exp);
      gl.uniform1f(c.uBloomAmt, post ? 0.14 : 0);
      gl.uniform1f(c.uDof, post ? st.dof : 0);
      gl.uniform1f(c.uFoc, st.foc);
    });
  }
  // a zero-height viewport would divide by zero into accumulators for good
  function sane() { return innerHeight > 0 && cssW > 0 && cssH > 0; }
  function render(dt) {
    if (INNER) { simT += dt; cmx += (tmx - cmx) * 0.04; cmy += (tmy - cmy) * 0.04; draw(null); return; }
    if (!sane()) return;
    var st = computeState(dt);
    advance(st, dt);
    draw(st);
  }

  /* ---------------- loop / governance ---------------- */
  var rafId = 0, prevTs = 0, beatTs = 0, running = false, glReady = false, syncToggle = null, toggleEl = null;
  var fpsEMA = 60, lowSince = 0, held = false, dead = false;
  // Every failure ends here: the scene steps aside for the plain page and
  // takes the rest of the ambient motion with it.
  function die(e, where) {
    console.warn('scene: ' + where + ' failed, leaving the page background plain:', e && e.message);
    dead = true; running = false;
    stopLoop();
    canvas.style.visibility = 'hidden';
    if (toggleEl) { toggleEl.remove(); toggleEl = null; }
    root.classList.add('motion-paused');
    emit(false);
    if (!window.__scene) window.__scene = { mode: 'none' };
  }
  // Once, after the intro: time six frames on the GPU (timer extension); if
  // the frame at up to 3200px would still cost under 3.5 ms, draw at that.
  function sharpen(end) {
    if (!TQ || tqN < 0) return;
    var px = Math.max(cssW, cssH) * Math.min(devicePixelRatio || 1, 2);
    if (end) {
      if (tqOpen) { gl.endQuery(TQ.TIME_ELAPSED_EXT); tqOpen = false; }
    } else if (tq) {
      if (!gl.getQueryParameter(tq, gl.QUERY_RESULT_AVAILABLE)) return;
      // the quickest of the six is the steady state (first frames carry warm-up)
      if (!gl.getParameter(TQ.GPU_DISJOINT_EXT)) { tqNs = Math.min(tqNs, gl.getQueryParameter(tq, gl.QUERY_RESULT)); tqN++; }
      gl.deleteQuery(tq); tq = null;
      if (tqN > 5) {
        var k = Math.min(3200, px) / EDGE;
        tqN = -1;
        if (tqNs / 1e6 * k * k < 3.5) { EDGE = 3200; applySize(); }
      }
    } else if (introT >= INTRO && !tier && px > EDGE * 1.04 && ++tqWarm > 60) {
      tq = gl.createQuery(); gl.beginQuery(TQ.TIME_ELAPSED_EXT, tq); tqOpen = true;
    }
  }
  function loop(ts) {
    rafId = requestAnimationFrame(loop);
    // the beat: how often this device is given a frame at all, drawn or not
    var beat = beatTs ? (ts - beatTs) / 1000 : 0;
    beatTs = ts;
    // Idle (intro done, untouched for 4s): draw at ~30fps. Skipped BEFORE the
    // timestamp is consumed, so the frame rate drops and the motion does not
    // slow; by time, not parity (30 Hz is not halved again, 120 not left at 60).
    var throttle = introT >= INTRO && (ts - lastActive) > 4000;
    if (!(throttle && prevTs && ts - prevTs < 28)) {
      var rawDt = prevTs ? Math.max(0, (ts - prevTs) / 1000) : 0.016;
      prevTs = ts;
      // dt is clamped for stability; the intro follows real visible time
      if (introT < INTRO) introT = Math.min(INTRO, introT + rawDt);
      try { sharpen(0); render(Math.min(0.05, rawDt)); sharpen(1); } catch (e) { die(e, 'frame'); return; }
      if (!seen && introT >= INTRO) {
        // only once the intro has been drawn
        seen = true;
        try { sessionStorage.setItem('linku_scene', '1'); } catch (e) { }
      }
    }
    // Governance reads the beat (so it watches through idle skips): under 40
    // fps the resolution steps down, under 26 the bed freezes — 30 Hz (iOS Low
    // Power Mode) is a frame rate, not a failure. Play after a freeze overrules.
    if (beat) {
      var fps = 1 / Math.max(0.001, beat);
      fpsEMA += (fps - fpsEMA) * 0.05;
      if (fpsEMA < (tier < 2 ? 40 : 26) && !(tier > 1 && held)) {
        if (!lowSince) lowSince = ts;
        else if (ts - lowSince > 2500) { lowSince = 0; tierDown(); }
      } else lowSince = 0;
    }
  }
  function tierDown() {
    tier++;
    fpsEMA = 60;
    try {
      if (tier < 3) {
        // a fifth off the resolution; then more, and the blur pyramid goes too
        bloomOff = tier > 1;
        applySize();
        // resizing cleared the canvas after this frame: redraw (no black frame)
        if (INNER) draw(null); else if (S) draw(S);
      } else {
        // static endpoint: running=false so visibilitychange can't resurrect it
        running = false;
        stopLoop();
        root.classList.add('motion-paused');
        renderStill();
        if (syncToggle) syncToggle();          // the button must say what is true: paused, press to play
        emit(false);                           // …and whatever follows the button stops with it
      }
    } catch (e) { die(e, 'tier-down'); }       // e.g. the smaller targets could not be allocated
  }
  function startLoop() {
    if (rafId || !running || !glReady) return;
    prevTs = beatTs = 0;
    lowSince = 0; fpsEMA = 60;               // a pause or a hidden tab is not part of the measurement
    lastActive = performance.now();
    rafId = requestAnimationFrame(loop);
  }
  function stopLoop() { if (rafId) { cancelAnimationFrame(rafId); rafId = 0; } }
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stopLoop(); else startLoop();
  });

  /* ---------------- reduced motion / still / boot ---------------- */
  // one settled frame for the current scroll position
  function renderStill() {
    introT = INTRO;
    if (INNER) { simT = 8; draw(null); return; }
    if (!sane()) return;
    chapter = chapterTarget();
    simT = 0;                                // every still is the same moment: the solid does not change shape between two of them
    clicks.length = 0; ptrT = -1e9;
    for (var r = 0; r < 4; r++) rip[r * 4 + 2] = 99;   // a still is at rest: no wave caught mid-pass
    var st;
    for (var i = 0; i < 110; i++) { st = computeState(1 / 30); advance(st, 1 / 30); }
    draw(st);
  }
  var stillT = 0;
  addEventListener('scroll', function () {
    if (dead || running || INNER || !grid) return;
    clearTimeout(stillT);
    // paused: follow the chapter without animating
    stillT = setTimeout(function () {
      if (dead || running || gl.isContextLost()) return;
      try { renderStill(); } catch (e) { die(e, 'still'); }
    }, 140);
  }, { passive: true });

  function injectToggle() {
    // localized labels live in each page's HTML (data-l-*), never in shared JS
    var L = [
      canvas.getAttribute('data-l-play') || 'Play background animation',
      canvas.getAttribute('data-l-pause') || 'Pause background animation',
    ];
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'scene-toggle';
    function sync() {
      b.textContent = running ? '■' : '▶';
      b.setAttribute('aria-label', running ? L[1] : L[0]);
      b.title = b.getAttribute('aria-label');
    }
    sync();
    syncToggle = sync;
    b.addEventListener('click', function () {
      if (dead) return;
      running = !running;
      if (running) {
        if (tier > 2) { tier = 2; held = true; }   // an explicit Play outranks the automatic freeze
        root.classList.remove('motion-paused');
        startLoop();
      } else {
        root.classList.add('motion-paused');
        stopLoop();
      }
      sync();
      emit(running);
    });
    document.body.appendChild(b);
    toggleEl = b;
    if (refocus) { refocus = false; b.focus({ preventScroll: true }); }
  }

  var resizeT = 0, lastCW = 0, lastCH = 0, lastDPR = 0;
  addEventListener('resize', function () {
    clearTimeout(resizeT);
    resizeT = setTimeout(function () {
      var cw = canvas.clientWidth, ch = canvas.clientHeight;
      var dpr = devicePixelRatio || 1; // dpr alone changes when dragging across monitors with different OS scaling
      if (dead || !glReady) return;             // not built yet, or lost: boot / restore size everything themselves
      if (cw === lastCW && ch === lastCH && dpr === lastDPR) return; // e.g. mobile URL bar with lvh
      lastCW = cw; lastCH = ch; lastDPR = dpr;
      try {
        applySize();
        measuredSH = -1;
        if (!rafId) renderStill(); // keep stills fresh
      } catch (e) { die(e, 'resize'); }
    }, 150);
  }, { passive: true });

  // carry on when the programs are built (boot and context restore share this)
  function whenBuilt(then) {
    (function poll() {
      if (dead) return;
      if (!progsDone()) { requestAnimationFrame(poll); return; }
      if (gl.isContextLost()) return;          // the restore handler starts over
      try { progsFinish(); applySize(true); glReady = true; then(); } catch (e) { die(e, 'GL init'); }
    })();
  }

  canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); glReady = false; stopLoop(); }, false);
  canvas.addEventListener('webglcontextrestored', function () {
    if (dead) return;
    try {
      progs = []; P = {}; fbo = null; grid = null;
      if (HOME && !floatTargets()) throw new Error('float targets lost');
      initGLObjects();
    } catch (e) { die(e, 'context restore'); return; }
    whenBuilt(function () { if (running) startLoop(); else renderStill(); });
  }, false);

  try { initGLObjects(); } catch (e) { die(e, 'GL init'); return; }
  lastCW = canvas.clientWidth; lastCH = canvas.clientHeight; lastDPR = devicePixelRatio || 1;

  whenBuilt(function () {
    // introspection (verification tooling)
    window.__scene = {
      mode: MODE, get tier() { return tier; }, get fps() { return fpsEMA; },
      get chapter() { return chapter; }, get introT() { return introT; },
      get pins() { return grid ? grid.nx * grid.ny : 0; }, get size() { return [W, H]; },
      get gpuMs() { return tqN < 0 ? tqNs / 1e6 : null; },
      tierDown: function () { tierDown(); return tier; },
    };
    if (reduce) {
      root.classList.add('motion-paused');
      renderStill();
      if (!STILL) injectToggle();
    } else {
      running = true;
      startLoop();
      injectToggle();
    }
  });
  } // end boot()

  if (INNER && reduce) {
    staticPoster();
    root.classList.add('motion-paused');
    window.__scene = { mode: 'poster' };
    if (!STILL) prebootToggle();
  } else if (typeof requestAnimationFrame === 'function') requestAnimationFrame(boot);
  else boot();
})();
