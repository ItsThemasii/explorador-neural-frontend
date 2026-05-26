// Planet.js — Tierra texturizada como elemento de fondo (no protagonista).
// Usa texturas oficiales de los ejemplos de Three.js (CORS habilitado).
import * as THREE from 'three';

const EARTH_DAY  = 'https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg';
const EARTH_BUMP = 'https://threejs.org/examples/textures/planets/earth_normal_2048.jpg';
const EARTH_SPEC = 'https://threejs.org/examples/textures/planets/earth_specular_2048.jpg';

export class Planet {
  constructor(scene, options = {}) {
    this.scene = scene;
    const {
      // Lejos y arriba-derecha para que sea claramente "fondo"
      position = new THREE.Vector3(180, 90, -260),
      radius   = 8,
      rotationSpeed = 0.025,
      orbitSpeed    = 0.008,
    } = options;

    this.rotationSpeed = rotationSpeed;
    this.orbitSpeed = orbitSpeed;

    this.group = new THREE.Group();
    this.group.name = 'planet';
    this.group.position.copy(position);
    scene.add(this.group);

    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');

    const dayTex    = loader.load(EARTH_DAY);
    const normalTex = loader.load(EARTH_BUMP);
    const specTex   = loader.load(EARTH_SPEC);
    dayTex.colorSpace = THREE.SRGBColorSpace;
    for (const t of [dayTex, normalTex, specTex]) t.anisotropy = 4;

    // Esfera de la Tierra — todo dentro del group para que se mueva como unidad
    const earthGeo = new THREE.SphereGeometry(radius, 64, 64);
    const earthMat = new THREE.MeshStandardMaterial({
      map: dayTex,
      normalMap: normalTex,
      normalScale: new THREE.Vector2(0.7, 0.7),
      roughnessMap: specTex,
      roughness: 1.0,
      metalness: 0.0,
      // Emissive MUY bajo → el lado nocturno queda casi negro, solo se ve el lado iluminado
      emissive: new THREE.Color(0x05101e),
      emissiveIntensity: 0.05,
    });
    this.earth = new THREE.Mesh(earthGeo, earthMat);
    this.earth.rotation.z = THREE.MathUtils.degToRad(23.5);
    this.group.add(this.earth);

    // Atmósfera — esfera back-side ligeramente más grande con shader rim
    const atmoGeo = new THREE.SphereGeometry(radius * 1.05, 64, 64);
    const atmoMat = new THREE.ShaderMaterial({
      uniforms: {
        uGlowColor: { value: new THREE.Color(0x4a90d9) },
        uIntensity: { value: 0.8 },
      },
      vertexShader: /* glsl */`
        varying vec3 vNormal;
        varying vec3 vWorldPos;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */`
        varying vec3 vNormal;
        varying vec3 vWorldPos;
        uniform vec3 uGlowColor;
        uniform float uIntensity;
        void main() {
          vec3 viewDir = normalize(cameraPosition - vWorldPos);
          float rim = 1.0 - abs(dot(viewDir, vNormal));
          rim = pow(rim, 2.8);
          gl_FragColor = vec4(uGlowColor * rim * uIntensity, rim * 0.9);
        }
      `,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
    this.atmo = new THREE.Mesh(atmoGeo, atmoMat);
    this.earth.add(this.atmo); // child de earth → se mueve y rota con ella

    // Nota: la DirectionalLight que crea el terminador día/noche está en Sun.js.
    // La Tierra usa MeshStandardMaterial → la captura automáticamente.

    this._orbitAngle = 0;
    this._basePos = position.clone();
  }

  update(dt, t) {
    // Rotación de la Tierra sobre su eje (visible aunque esté lejos)
    this.earth.rotation.y += dt * this.rotationSpeed;

    // Drift muy sutil — recordemos que es fondo, no protagonista
    this._orbitAngle += dt * this.orbitSpeed;
    const offsetX = Math.cos(this._orbitAngle) * 6;
    const offsetY = Math.sin(this._orbitAngle * 0.7) * 3;
    this.group.position.set(
      this._basePos.x + offsetX,
      this._basePos.y + offsetY,
      this._basePos.z
    );
  }

  setTint(colorHex) {
    // Tinte muy sutil del tema en la atmósfera
    const base = new THREE.Color(0x4a90d9);
    const tint = new THREE.Color(colorHex);
    const mixed = base.clone().lerp(tint, 0.25);
    this.atmo.material.uniforms.uGlowColor.value.copy(mixed);
  }
}
