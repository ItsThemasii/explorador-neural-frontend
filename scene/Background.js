// Background.js — fondo cósmico inspirado en la Nebulosa de Orión.
// Multi-capa: starfield variado + nebulosa shader con mezcla de magenta/cyan/rust.
import * as THREE from 'three';

// Estrellas — 4 capas con parallax + variación de color y tamaño
const STAR_LAYERS = [
  { count: 2800, radius: 320, size: 1.2, palette: ['#ffffff', '#f0f4ff', '#fff4d6', '#d6e4ff'], speed: 0.011 },
  { count: 1600, radius: 480, size: 0.9, palette: ['#bcd1ff', '#ffd9a8', '#ffffff'],            speed: 0.0075 },
  { count: 900,  radius: 700, size: 0.7, palette: ['#ffd6a0', '#a8b8ff', '#ffffff'],            speed: 0.005 },
  // Cluster de estrellas grandes (pocas, brillantes — como las del Trapecio en Orion)
  { count: 90,   radius: 260, size: 3.0, palette: ['#ffffff', '#aee9ff', '#ffe1a8'],            speed: 0.014, bright: true },
];

// ── NEBULOSA SHADER ──────────────────────────────────────────────────────────
const NEBULA_VS = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const NEBULA_FS = /* glsl */`
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform vec3 uColMagenta;  // núcleo rosa/magenta (M42)
  uniform vec3 uColCyan;     // halo azul/cian (estrellas jóvenes)
  uniform vec3 uColRust;     // óxido/rojo cálido (polvo de hidrógeno)
  uniform vec3 uColDeep;     // azul muy oscuro de fondo
  uniform vec3 uTint;        // tinte del tema (sutil)

  // Hash & noise — estilo iq
  vec3 hash3(vec3 p) {
    p = vec3(
      dot(p, vec3(127.1, 311.7, 74.7)),
      dot(p, vec3(269.5, 183.3, 246.1)),
      dot(p, vec3(113.5, 271.9, 124.6))
    );
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
  }

  float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    vec3 u = f * f * (3.0 - 2.0 * f);
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
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 6; i++) {
      v += a * noise(p);
      p *= 2.03;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 uv = vUv - 0.5;
    uv.x *= 1.35;

    float t = uTime * 0.025;

    float n1 = fbm(vec3(uv * 2.6,  t));
    float n2 = fbm(vec3(uv * 4.4 + vec2(3.1, 1.9), t * 1.3));
    float n3 = fbm(vec3(uv * 1.4 - vec2(t * 0.4, 0.0), t * 0.5));

    // Máscaras MÁS RESTRICTIVAS — solo aparece nebulosa donde realmente hay densidad
    float coreMask  = smoothstep(0.35, 0.85, n1 * 0.9 + n2 * 0.25);
    float haloMask  = smoothstep(0.25, 0.75, n3);
    float rustMask  = smoothstep(0.55, 0.95, n1 * n2);

    // Composición de colores sobre base NEGRA (no azul oscura)
    vec3 col = vec3(0.0);
    col = mix(col, uColCyan,    haloMask * 0.45);
    col = mix(col, uColMagenta, coreMask * 0.70);
    col = mix(col, uColRust,    rustMask * 0.55);

    // Tinte sutil del tema
    col = mix(col, col * uTint, 0.12);

    // Vignette MÁS AGRESIVO — concentra la nebulosa al centro
    float r = length(uv) * 1.8;
    float vignette = smoothstep(0.95, 0.15, r);

    // Densidad pow más alto (2.4) = la mayor parte queda casi en cero (negro)
    float density = pow(coreMask * 0.55 + haloMask * 0.30 + rustMask * 0.15, 2.4);
    float alpha = density * vignette * 0.55;

    col *= 0.55 + density * 0.5;

    gl_FragColor = vec4(col, alpha);
  }
`;

// ── Helpers ─────────────────────────────────────────────────────────────────
function hexToRgbArr(hex) {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
}

// Crea una textura procedural de "estrella" (gaussiana radial) para que los Points se vean redondos y suaves
function makeStarTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0.0,  'rgba(255,255,255,1.0)');
  gradient.addColorStop(0.18, 'rgba(255,255,255,0.85)');
  gradient.addColorStop(0.45, 'rgba(255,255,255,0.22)');
  gradient.addColorStop(1.0,  'rgba(255,255,255,0.0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Background {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'background';
    scene.add(this.group);

    this.starTexture = makeStarTexture();
    this.starLayers = [];

    this._buildStars();
    this._buildNebula();
  }

  _buildStars() {
    for (const cfg of STAR_LAYERS) {
      const geo = new THREE.BufferGeometry();
      const positions = new Float32Array(cfg.count * 3);
      const colors = new Float32Array(cfg.count * 3);
      const sizes = new Float32Array(cfg.count);

      for (let i = 0; i < cfg.count; i++) {
        // Distribución esférica uniforme
        const u = Math.random();
        const v = Math.random();
        const theta = 2 * Math.PI * u;
        const phi = Math.acos(2 * v - 1);
        const r = cfg.radius * (0.85 + Math.random() * 0.18);
        positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = r * Math.cos(phi);

        // Color aleatorio de la paleta de la capa
        const c = hexToRgbArr(cfg.palette[Math.floor(Math.random() * cfg.palette.length)]);
        colors[i * 3]     = c[0];
        colors[i * 3 + 1] = c[1];
        colors[i * 3 + 2] = c[2];

        sizes[i] = cfg.size * (0.6 + Math.random() * 0.9);
      }

      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.setAttribute('color',    new THREE.BufferAttribute(colors, 3));
      geo.setAttribute('aSize',    new THREE.BufferAttribute(sizes, 1));

      const mat = new THREE.PointsMaterial({
        size: cfg.size,
        sizeAttenuation: true,
        vertexColors: true,
        transparent: true,
        opacity: cfg.bright ? 1.0 : 0.92,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        map: this.starTexture,
        alphaTest: 0.01,
      });

      const points = new THREE.Points(geo, mat);
      points.userData = {
        speed: cfg.speed,
        baseSize: cfg.size,
        twinklePhase: Math.random() * Math.PI * 2,
        bright: !!cfg.bright,
      };
      this.group.add(points);
      this.starLayers.push(points);
    }
  }

  _buildNebula() {
    const geo = new THREE.PlaneGeometry(1800, 1100, 1, 1);
    this.nebulaUniforms = {
      uTime:       { value: 0 },
      uColMagenta: { value: new THREE.Color('#c43a78') }, // núcleo rosa-magenta
      uColCyan:    { value: new THREE.Color('#2fb3d4') }, // halo cian
      uColRust:    { value: new THREE.Color('#9c3a1c') }, // óxido cálido
      uColDeep:    { value: new THREE.Color('#06091a') }, // base muy oscura
      uTint:       { value: new THREE.Color(1, 1, 1) },   // tinte tema (neutral por defecto)
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.nebulaUniforms,
      vertexShader: NEBULA_VS,
      fragmentShader: NEBULA_FS,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    this.nebula = new THREE.Mesh(geo, mat);
    this.nebula.position.set(0, 0, -560);
    this.group.add(this.nebula);
    // Una sola capa de nebulosa, mucho más restringida — el resto es negro espacial
  }

  // Aplica un tinte del tema actual SIN destruir la paleta cósmica
  setColors(primaryHex, accentHex) {
    const p = new THREE.Color(primaryHex);
    const a = new THREE.Color(accentHex);
    const mix = p.clone().lerp(a, 0.5);
    // Mezcla suave: 70% blanco neutro + 30% color del tema
    const tint = new THREE.Color(1, 1, 1).lerp(mix, 0.3);
    this.nebulaUniforms.uTint.value.copy(tint);
  }

  update(dt, t) {
    this.nebulaUniforms.uTime.value = t;

    for (const layer of this.starLayers) {
      const ud = layer.userData;
      layer.rotation.y += ud.speed * dt;
      layer.rotation.x += ud.speed * 0.3 * dt;

      // Parpadeo sutil — modula opacidad de las capas brillantes
      if (ud.bright) {
        ud.twinklePhase += dt * 1.5;
        layer.material.opacity = 0.85 + Math.sin(ud.twinklePhase) * 0.12;
      }
    }
  }
}
