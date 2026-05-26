// OrionNebula.js — Nebulosa de Orión real (M42) como elemento de fondo.
// Carga imagen pública de Wikimedia Commons y la pinta con additive blending
// (el negro de la imagen desaparece, solo brillan los colores de la nebulosa).
import * as THREE from 'three';

// Hubble 2006 mosaic de la Nebulosa de Orión (Wikimedia Commons, CORS *)
const ORION_TEXTURE_URL =
  'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Orion_Nebula_-_Hubble_2006_mosaic_18000.jpg/1280px-Orion_Nebula_-_Hubble_2006_mosaic_18000.jpg';

export class OrionNebula {
  constructor(scene, options = {}) {
    this.scene = scene;
    const {
      position = new THREE.Vector3(-120, 40, -480),
      size     = 520,
      opacity  = 0.85,
    } = options;

    this.baseOpacity = opacity;

    // Geometría cuadrada gigante en el fondo profundo
    const geo = new THREE.PlaneGeometry(size, size * 0.72);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.0, // empieza invisible hasta que cargue la textura
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.copy(position);
    this._basePos = position.clone();
    // Leve inclinación para sensación de profundidad
    this.mesh.rotation.z = -0.25;
    scene.add(this.mesh);

    // Cargar textura asincrónicamente
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    loader.load(
      ORION_TEXTURE_URL,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 4;
        this.mesh.material.map = texture;
        this.mesh.material.opacity = this.baseOpacity;
        this.mesh.material.needsUpdate = true;
        console.log('🌌 Nebulosa de Orión cargada');
      },
      undefined,
      (err) => {
        console.warn('Error cargando textura de Orion:', err);
      }
    );

    this._driftPhase = Math.random() * Math.PI * 2;
  }

  update(dt, t) {
    if (!this.mesh.material.map) return; // textura aún no carga

    // Rotación lentísima sobre el eje Z (giro casi imperceptible)
    this.mesh.rotation.z += dt * 0.008;

    // Drift suave en X/Y para que se sienta viva
    this._driftPhase += dt * 0.15;
    const dx = Math.cos(this._driftPhase * 0.4) * 18;
    const dy = Math.sin(this._driftPhase * 0.6) * 10;
    this.mesh.position.set(this._basePos.x + dx, this._basePos.y + dy, this._basePos.z);

    // Pulse muy sutil de la opacidad (efecto "respiración")
    const breathe = 0.92 + Math.sin(t * 0.4) * 0.08;
    this.mesh.material.opacity = this.baseOpacity * breathe;
  }

  setTint(colorHex) {
    // Tinte muy sutil del tema (mezcla con blanco para no destruir la imagen)
    const tint = new THREE.Color(colorHex).lerp(new THREE.Color(1, 1, 1), 0.7);
    this.mesh.material.color.copy(tint);
  }
}
