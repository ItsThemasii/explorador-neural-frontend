// Comets.js — sistema de cometas con núcleo + halo + cola de partículas
// Spawning aleatorio, trayectorias rectas cruzando la escena, fade in/out.
import * as THREE from 'three';

const COMET_COLORS = [0xaee9ff, 0xffe1a8, 0xffffff, 0xc8d4ff, 0xffd0a0];
const MAX_ACTIVE = 4;
const TAIL_LENGTH = 60;

class Comet {
  constructor(scene, opts) {
    this.scene = scene;
    this.start = opts.start;
    this.end = opts.end;
    this.duration = opts.duration;
    this.colorHex = opts.color;
    this.color = new THREE.Color(this.colorHex);
    this.elapsed = 0;
    this.alive = true;
    this.fadeIn = 0.18;
    this.fadeOut = 0.18;

    this.group = new THREE.Group();
    scene.add(this.group);

    // ── Núcleo SOLO — punto pequeño y brillante, SIN halo (más realista) ──
    const nucGeo = new THREE.SphereGeometry(0.32, 10, 10);
    const nucMat = new THREE.MeshBasicMaterial({
      color: this.colorHex,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.nucleus = new THREE.Mesh(nucGeo, nucMat);
    this.group.add(this.nucleus);

    // ── Cola (BufferGeometry de Points con fade) ──
    this.tailPositions = new Float32Array(TAIL_LENGTH * 3);
    this.tailColors = new Float32Array(TAIL_LENGTH * 3);
    this.tailSizes = new Float32Array(TAIL_LENGTH);
    for (let i = 0; i < TAIL_LENGTH; i++) {
      const f = i / (TAIL_LENGTH - 1); // 0 (frente) → 1 (cola lejana)
      const intensity = Math.pow(1 - f, 1.6);
      this.tailColors[i * 3]     = this.color.r * intensity;
      this.tailColors[i * 3 + 1] = this.color.g * intensity;
      this.tailColors[i * 3 + 2] = this.color.b * intensity;
      this.tailSizes[i] = (1 - f) * 1.4 + 0.2;
      // Inicializar todas las posiciones en el start
      this.tailPositions[i * 3]     = this.start.x;
      this.tailPositions[i * 3 + 1] = this.start.y;
      this.tailPositions[i * 3 + 2] = this.start.z;
    }

    const tailGeo = new THREE.BufferGeometry();
    tailGeo.setAttribute('position', new THREE.BufferAttribute(this.tailPositions, 3));
    tailGeo.setAttribute('color',    new THREE.BufferAttribute(this.tailColors, 3));

    const tailMat = new THREE.PointsMaterial({
      size: 0.9,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.tail = new THREE.Points(tailGeo, tailMat);
    this.group.add(this.tail);
  }

  update(dt) {
    this.elapsed += dt;
    const k = this.elapsed / this.duration;
    if (k >= 1) { this.alive = false; return; }

    // Posición actual (interpolación lineal, los cometas casi no aceleran)
    const x = this.start.x + (this.end.x - this.start.x) * k;
    const y = this.start.y + (this.end.y - this.start.y) * k;
    const z = this.start.z + (this.end.z - this.start.z) * k;
    this.nucleus.position.set(x, y, z);

    // Desplazar cola: cada slot toma el valor del anterior, y el frente recibe la nueva posición
    for (let i = TAIL_LENGTH - 1; i > 0; i--) {
      this.tailPositions[i * 3]     = this.tailPositions[(i - 1) * 3];
      this.tailPositions[i * 3 + 1] = this.tailPositions[(i - 1) * 3 + 1];
      this.tailPositions[i * 3 + 2] = this.tailPositions[(i - 1) * 3 + 2];
    }
    this.tailPositions[0] = x;
    this.tailPositions[1] = y;
    this.tailPositions[2] = z;
    this.tail.geometry.attributes.position.needsUpdate = true;

    // Fade in/out
    let alpha = 1;
    if (k < this.fadeIn) alpha = k / this.fadeIn;
    else if (k > 1 - this.fadeOut) alpha = (1 - k) / this.fadeOut;
    this.nucleus.material.opacity = alpha;
    this.tail.material.opacity = 0.85 * alpha;
  }

  dispose() {
    this.scene.remove(this.group);
    this.nucleus.geometry.dispose();
    this.nucleus.material.dispose();
    this.tail.geometry.dispose();
    this.tail.material.dispose();
  }
}

export class Comets {
  constructor(scene) {
    this.scene = scene;
    this.active = [];
    this.spawnTimer = 1.5; // primer cometa tras 1.5s
  }

  _spawn() {
    // Trayectoria recta cruzando la escena MUY profundo (no pasan cerca de la red neuronal)
    const z = -220 - Math.random() * 260; // entre -220 y -480 (lejos del centro)
    const horizontal = Math.random() < 0.55;

    let start, end;
    // Evitar pasar por el centro de la pantalla — fuerza pasada alta o baja
    const yOffset = (Math.random() < 0.5 ? -1 : 1) * (90 + Math.random() * 120);

    if (horizontal) {
      const side = Math.random() < 0.5 ? -1 : 1;
      start = new THREE.Vector3(side * 480, yOffset, z);
      end   = new THREE.Vector3(-side * 480, yOffset + (Math.random() - 0.5) * 80, z);
    } else {
      // Diagonal: esquina a esquina
      const dirH = Math.random() < 0.5 ? -1 : 1;
      const dirV = Math.random() < 0.5 ? -1 : 1;
      start = new THREE.Vector3(dirH * 460, dirV * 280, z);
      end   = new THREE.Vector3(-dirH * 460, -dirV * 280, z);
    }

    const duration = 4 + Math.random() * 5;
    const color = COMET_COLORS[Math.floor(Math.random() * COMET_COLORS.length)];
    this.active.push(new Comet(this.scene, { start, end, duration, color }));
  }

  update(dt, t) {
    // Spawn schedule
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.active.length < MAX_ACTIVE) {
      this._spawn();
      this.spawnTimer = 1.8 + Math.random() * 3.2; // próximo cometa en 1.8-5s
    }

    // Update + cleanup
    for (let i = this.active.length - 1; i >= 0; i--) {
      const c = this.active[i];
      c.update(dt);
      if (!c.alive) {
        c.dispose();
        this.active.splice(i, 1);
      }
    }
  }
}
