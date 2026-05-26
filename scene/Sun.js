// Sun.js — Sol distante REALISTA con superficie de plasma animada, corona,
// lens flare anamórfico, y DirectionalLight que ilumina la escena.
//
// Posición: lado opuesto a la Nebulosa de Orión (que está upper-left)
//          → el Sol va lower-right para crear la composición Neb --- core --- Sun
import * as THREE from 'three';

// ── Textura procedural radial para sprites de corona ──
function makeFlareTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0.00, 'rgba(255,255,255,1.00)');
  g.addColorStop(0.06, 'rgba(255,250,225,0.92)');
  g.addColorStop(0.18, 'rgba(255,220,150,0.55)');
  g.addColorStop(0.40, 'rgba(255,170, 80,0.18)');
  g.addColorStop(0.70, 'rgba(255,120, 40,0.05)');
  g.addColorStop(1.00, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ── Anamorphic streak (línea horizontal larga y fina, estilo cine) ──
function makeStreakTexture() {
  const w = 512, h = 32;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0.00, 'rgba(255,255,255,0)');
  g.addColorStop(0.30, 'rgba(255,245,210,0.4)');
  g.addColorStop(0.50, 'rgba(255,255,255,1)');
  g.addColorStop(0.70, 'rgba(255,245,210,0.4)');
  g.addColorStop(1.00, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // Soft vertical fade
  const g2 = ctx.createLinearGradient(0, 0, 0, h);
  g2.addColorStop(0.0, 'rgba(0,0,0,0.85)');
  g2.addColorStop(0.5, 'rgba(0,0,0,0)');
  g2.addColorStop(1.0, 'rgba(0,0,0,0.85)');
  ctx.fillStyle = g2;
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ── Shader de superficie solar (plasma animado) ──
const SUN_VS = /* glsl */`
  varying vec3 vNormal;
  varying vec3 vPos;
  varying vec3 vWorldPos;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPos = position;
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPosition.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SUN_FS = /* glsl */`
  precision highp float;
  varying vec3 vNormal;
  varying vec3 vPos;
  varying vec3 vWorldPos;
  uniform float uTime;
  uniform vec3 uCoreColor;   // white-hot
  uniform vec3 uMidColor;    // yellow
  uniform vec3 uEdgeColor;   // orange-red

  // Hash + 3D noise
  vec3 hash3(vec3 p) {
    p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
             dot(p, vec3(269.5, 183.3, 246.1)),
             dot(p, vec3(113.5, 271.9, 124.6)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
  }
  float noise(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    vec3 u = f*f*(3.0-2.0*f);
    return mix(mix(mix(dot(hash3(i+vec3(0,0,0)), f-vec3(0,0,0)),
                       dot(hash3(i+vec3(1,0,0)), f-vec3(1,0,0)), u.x),
                   mix(dot(hash3(i+vec3(0,1,0)), f-vec3(0,1,0)),
                       dot(hash3(i+vec3(1,1,0)), f-vec3(1,1,0)), u.x), u.y),
               mix(mix(dot(hash3(i+vec3(0,0,1)), f-vec3(0,0,1)),
                       dot(hash3(i+vec3(1,0,1)), f-vec3(1,0,1)), u.x),
                   mix(dot(hash3(i+vec3(0,1,1)), f-vec3(0,1,1)),
                       dot(hash3(i+vec3(1,1,1)), f-vec3(1,1,1)), u.x), u.y), u.z);
  }
  float fbm(vec3 p) {
    float v = 0.0; float a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.07; a *= 0.5; }
    return v;
  }

  void main() {
    // Sample plasma noise sobre la superficie esférica (animado)
    vec3 p = normalize(vPos) * 2.4;
    float t = uTime * 0.18;
    float n1 = fbm(p + vec3(t, 0.0, -t * 0.7));
    float n2 = fbm(p * 2.6 - vec3(0.0, t * 1.3, 0.0));
    float pattern = n1 * 0.65 + n2 * 0.5;
    pattern = clamp(pattern * 0.5 + 0.55, 0.0, 1.0);

    // Mezclar 3 colores: core (blanco), mid (amarillo), edge (rojo)
    vec3 col = mix(uEdgeColor, uMidColor, pattern);
    col = mix(col, uCoreColor, pow(pattern, 2.2));

    // Boost central (fresnel inverso — más brillante en el centro visible)
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float facing = max(0.0, dot(normalize(vNormal), viewDir));
    col *= 0.85 + facing * 0.6;

    // Limb darkening sutil (los bordes ligeramente más oscuros)
    col *= 0.7 + pow(facing, 0.6) * 0.4;

    gl_FragColor = vec4(col, 1.0);
  }
`;

export class Sun {
  constructor(scene, options = {}) {
    this.scene = scene;
    const {
      // Espejo horizontal de la Nebulosa de Orión (-120, 40, -480):
      // mismo Y (~50) pero al lado derecho. Composición: Nebulosa ← Núcleo → Sol
      position  = new THREE.Vector3(270, 55, -400),
      radius    = 6.2,
      intensity = 3.4,
      target    = new THREE.Vector3(0, 0, 0),
    } = options;

    this.position = position.clone();

    this.group = new THREE.Group();
    this.group.name = 'sun';
    this.group.position.copy(position);
    scene.add(this.group);

    // ── Núcleo: superficie solar con shader de plasma animado ──
    this.surfaceUniforms = {
      uTime:      { value: 0 },
      uCoreColor: { value: new THREE.Color(0xffffff) },  // blanco incandescente
      uMidColor:  { value: new THREE.Color(0xffe488) },  // amarillo solar
      uEdgeColor: { value: new THREE.Color(0xff7a30) },  // naranja al borde
    };
    const coreGeo = new THREE.SphereGeometry(radius, 48, 48);
    const coreMat = new THREE.ShaderMaterial({
      uniforms: this.surfaceUniforms,
      vertexShader: SUN_VS,
      fragmentShader: SUN_FS,
    });
    this.core = new THREE.Mesh(coreGeo, coreMat);
    this.group.add(this.core);

    // ── Corona interna ──
    const flareTex = makeFlareTexture();
    const inner = new THREE.SpriteMaterial({
      map: flareTex,
      color: 0xffe6b8,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.88,
    });
    this.inner = new THREE.Sprite(inner);
    this._innerBase = radius * 7;
    this.inner.scale.set(this._innerBase, this._innerBase, 1);
    this.group.add(this.inner);

    // ── Corona externa difusa ──
    const outer = new THREE.SpriteMaterial({
      map: flareTex,
      color: 0xffaa55,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.40,
    });
    this.outer = new THREE.Sprite(outer);
    this._outerBase = radius * 16;
    this.outer.scale.set(this._outerBase, this._outerBase, 1);
    this.group.add(this.outer);

    // ── Lens flare anamórfico SUTIL (línea horizontal apenas perceptible) ──
    const streakTex = makeStreakTexture();
    const streakMat = new THREE.SpriteMaterial({
      map: streakTex,
      color: 0xfff4d8,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.35,  // mucho más sutil para no parecer cinemático
      rotation: 0,
    });
    this.streak = new THREE.Sprite(streakMat);
    this._streakBaseW = radius * 24;
    this._streakBaseH = radius * 1.4;
    this.streak.scale.set(this._streakBaseW, this._streakBaseH, 1);
    this.group.add(this.streak);

    // ── DirectionalLight — luz solar que ilumina la escena ──
    this.light = new THREE.DirectionalLight(0xfff4d8, intensity);
    this.light.position.copy(position);
    this._target = new THREE.Object3D();
    this._target.position.copy(target);
    scene.add(this._target);
    this.light.target = this._target;
    scene.add(this.light);
  }

  update(dt, t) {
    // Animar la superficie solar (plasma fluyendo)
    this.surfaceUniforms.uTime.value = t;

    // Latido sutil de coronas (frecuencias distintas)
    const p1 = 1 + Math.sin(t * 0.7) * 0.04;
    const p2 = 1 + Math.sin(t * 0.4 + 1.5) * 0.06;
    const p3 = 1 + Math.sin(t * 1.1 + 2.3) * 0.05;

    this.inner.scale.set(this._innerBase * p1, this._innerBase * p1, 1);
    this.outer.scale.set(this._outerBase * p2, this._outerBase * p2, 1);
    this.streak.scale.set(this._streakBaseW * p3, this._streakBaseH * p1, 1);
  }

  getPosition() { return this.position.clone(); }
}
