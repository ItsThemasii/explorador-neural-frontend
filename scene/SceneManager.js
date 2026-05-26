// SceneManager.js — bootstrap de la escena Three.js
import * as THREE from 'three';

export class SceneManager {
  constructor(container) {
    this.container = container;
    this.width = container.clientWidth;
    this.height = container.clientHeight;

    // Escena — negro puro de espacio profundo
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x000000, 0.0028);

    // Cámara
    this.camera = new THREE.PerspectiveCamera(60, this.width / this.height, 0.1, 2000);
    this.camera.position.set(0, 0, 90);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(this.width, this.height);
    this.renderer.setClearColor(0x000000, 1); // NEGRO puro
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    container.appendChild(this.renderer.domElement);

    // Iluminación base — casi nula; el Sol es la fuente real (terminador día/noche claro)
    this.ambient = new THREE.AmbientLight(0x0a1018, 0.12);
    this.scene.add(this.ambient);

    // Lights del tema (tinte sobre la red neuronal)
    this.keyLight = new THREE.PointLight(0x6366f1, 1.2, 220);
    this.keyLight.position.set(40, 30, 60);
    this.scene.add(this.keyLight);

    this.fillLight = new THREE.PointLight(0xec4899, 0.6, 220);
    this.fillLight.position.set(-50, -20, 40);
    this.scene.add(this.fillLight);

    // Clock para deltas
    this.clock = new THREE.Clock();
    this.updaters = []; // funciones que se llaman cada frame con (deltaTime, elapsedTime)
    this.composer = null; // se setea desde PostFX

    // Resize
    window.addEventListener('resize', () => this.onResize());
    // Si el contenedor aún no tiene dimensiones (init asíncrono via dynamic
    // import), forzar onResize cuando el primer frame esté disponible.
    requestAnimationFrame(() => this.onResize());
  }

  onResize() {
    this.width = this.container.clientWidth;
    this.height = this.container.clientHeight;
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height);
    if (this.composer) this.composer.setSize(this.width, this.height);
  }

  addUpdater(fn) {
    this.updaters.push(fn);
  }

  setComposer(composer) {
    this.composer = composer;
  }

  setLightColors(primaryHex, accentHex) {
    this.keyLight.color.set(primaryHex);
    this.fillLight.color.set(accentHex);
  }

  start() {
    const tick = () => {
      const dt = Math.min(this.clock.getDelta(), 0.05);
      const t = this.clock.elapsedTime;
      for (const fn of this.updaters) fn(dt, t);
      if (this.composer) this.composer.render();
      else this.renderer.render(this.scene, this.camera);
      requestAnimationFrame(tick);
    };
    tick();
  }
}
