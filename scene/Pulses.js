// Pulses.js — señales que recorren todas las conexiones de la red
// con cabezas brillantes + estela de puntos detrás (más realista).
import * as THREE from 'three';

// Pulsos por tipo de conexión
const PULSES_CORE     = 2; // core <-> nodo
const PULSES_INTER    = 1; // inter-nodos
const TRAIL_LENGTH    = 6; // puntos de estela detrás de la cabeza
const TRAIL_SPACING   = 0.025; // separación de cada punto de estela en parámetro t

// Textura procedural de blob suave (gradiente radial) para los puntos
function makePulseTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0,    'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.85)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.32)');
  grad.addColorStop(1,    'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

export class Pulses {
  constructor(scene, network) {
    this.scene = scene;
    this.network = network;
    this.heads = null;     // THREE.Points (cabezas grandes)
    this.trails = null;    // THREE.Points (estelas)
    this.pulseData = [];   // { conn, phase, speed }
    this.texture = makePulseTexture();
  }

  _disposeSystems() {
    if (this.heads) {
      this.network.group.remove(this.heads);
      this.heads.geometry.dispose();
      this.heads.material.dispose();
      this.heads = null;
    }
    if (this.trails) {
      this.network.group.remove(this.trails);
      this.trails.geometry.dispose();
      this.trails.material.dispose();
      this.trails = null;
    }
  }

  rebuild() {
    this._disposeSystems();
    this.pulseData = [];

    const connections = this.network.connections;
    if (!connections || connections.length === 0) return;

    // Generar metadata de pulsos
    for (const c of connections) {
      const count = c.type === 'core' ? PULSES_CORE : PULSES_INTER;
      for (let p = 0; p < count; p++) {
        this.pulseData.push({
          conn: c,
          phase: Math.random(),
          speed: c.type === 'core'
            ? 0.20 + Math.random() * 0.18
            : 0.10 + Math.random() * 0.12,
        });
      }
    }

    const total = this.pulseData.length;
    if (total === 0) return;

    // --------- Cabezas ---------
    const headPos = new Float32Array(total * 3);
    const headCol = new Float32Array(total * 3);
    for (let i = 0; i < total; i++) {
      const c = this.pulseData[i].conn.color;
      headCol[i * 3]     = c.r;
      headCol[i * 3 + 1] = c.g;
      headCol[i * 3 + 2] = c.b;
    }
    const headGeo = new THREE.BufferGeometry();
    headGeo.setAttribute('position', new THREE.BufferAttribute(headPos, 3));
    headGeo.setAttribute('color',    new THREE.BufferAttribute(headCol, 3));

    const headMat = new THREE.PointsMaterial({
      size: 2.6,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      map: this.texture,
      alphaTest: 0.01,
    });
    this.heads = new THREE.Points(headGeo, headMat);
    this.network.group.add(this.heads);

    // --------- Estelas ---------
    const trailTotal = total * TRAIL_LENGTH;
    const trailPos = new Float32Array(trailTotal * 3);
    const trailCol = new Float32Array(trailTotal * 3);
    for (let i = 0; i < total; i++) {
      const c = this.pulseData[i].conn.color;
      for (let k = 0; k < TRAIL_LENGTH; k++) {
        // Decae el color un poco para sensación de desvanecimiento
        const fade = 1 - (k + 1) / (TRAIL_LENGTH + 1);
        const idx = i * TRAIL_LENGTH + k;
        trailCol[idx * 3]     = c.r * fade;
        trailCol[idx * 3 + 1] = c.g * fade;
        trailCol[idx * 3 + 2] = c.b * fade;
      }
    }
    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
    trailGeo.setAttribute('color',    new THREE.BufferAttribute(trailCol, 3));

    const trailMat = new THREE.PointsMaterial({
      size: 1.6,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      map: this.texture,
      alphaTest: 0.01,
    });
    this.trails = new THREE.Points(trailGeo, trailMat);
    this.network.group.add(this.trails);
  }

  _sampleConnection(conn, t) {
    // Clamp t a [0, 1]
    const tt = Math.max(0, Math.min(1, t));
    if (conn.curve) {
      return conn.curve.getPoint(tt);
    }
    // Fallback: lerp entre extremos (no debería ocurrir con la red actual)
    return new THREE.Vector3(0, 0, 0).lerp(new THREE.Vector3(0, 0, 0), tt);
  }

  update(dt, t) {
    if (!this.heads || this.pulseData.length === 0) return;

    const headPos = this.heads.geometry.attributes.position.array;
    const trailPos = this.trails.geometry.attributes.position.array;

    for (let i = 0; i < this.pulseData.length; i++) {
      const p = this.pulseData[i];
      p.phase = (p.phase + dt * p.speed) % 1;

      // Cabeza
      const head = this._sampleConnection(p.conn, p.phase);
      headPos[i * 3]     = head.x;
      headPos[i * 3 + 1] = head.y;
      headPos[i * 3 + 2] = head.z;

      // Estela: puntos detrás de la cabeza a lo largo de la curva
      for (let k = 0; k < TRAIL_LENGTH; k++) {
        const tk = p.phase - (k + 1) * TRAIL_SPACING;
        const idx = i * TRAIL_LENGTH + k;
        if (tk < 0) {
          // Si la estela cruzaría el inicio, la "esconde" en el origen del pulso
          const at = this._sampleConnection(p.conn, 0);
          trailPos[idx * 3]     = at.x;
          trailPos[idx * 3 + 1] = at.y;
          trailPos[idx * 3 + 2] = at.z;
        } else {
          const at = this._sampleConnection(p.conn, tk);
          trailPos[idx * 3]     = at.x;
          trailPos[idx * 3 + 1] = at.y;
          trailPos[idx * 3 + 2] = at.z;
        }
      }
    }

    this.heads.geometry.attributes.position.needsUpdate = true;
    this.trails.geometry.attributes.position.needsUpdate = true;
  }
}
