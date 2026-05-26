// NeuralNetwork.js — red neuronal 3D con nodos multi-capa orgánicos,
// conexiones curvas extendidas y soporte para señales en cada conexión.
import * as THREE from 'three';

const CATEGORY_COLORS = {
  evento:    0xff6b9d,
  personaje: 0xffd166,
  concepto:  0x6ee7ff,
  lugar:     0x9efb8c,
};

function categoryColor(cat) {
  return CATEGORY_COLORS[cat] || 0xb4b9ff;
}

// ─── Distribuciones de nodos según layout ───

// Esfera (Fibonacci sphere — distribuye N puntos uniformemente sobre una esfera)
function spherePositions(n, radius = 32) {
  const points = [];
  const phi = Math.PI * (Math.sqrt(5) - 1);
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / Math.max(n - 1, 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = phi * i;
    const x = Math.cos(theta) * r;
    const z = Math.sin(theta) * r;
    points.push(new THREE.Vector3(x * radius, y * radius, z * radius));
  }
  return points;
}

// Plano 2D (espiral de Vogel sobre el plano XY, z=0)
function planePositions(n, radius = 32) {
  const points = [];
  const phi = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const r = Math.sqrt((i + 0.5) / Math.max(n, 1)) * radius;
    const theta = phi * i;
    points.push(new THREE.Vector3(Math.cos(theta) * r, Math.sin(theta) * r, 0));
  }
  return points;
}

// Tetraedro (puntos repartidos en las 4 caras de un tetraedro regular)
function tetrahedronPositions(n, radius = 32) {
  const t = radius;
  const verts = [
    new THREE.Vector3( 1,  1,  1),
    new THREE.Vector3( 1, -1, -1),
    new THREE.Vector3(-1,  1, -1),
    new THREE.Vector3(-1, -1,  1),
  ].map(v => v.normalize().multiplyScalar(t));
  const faces = [[0,1,2],[0,1,3],[0,2,3],[1,2,3]];
  const points = [];
  // Si caben pocos, poner uno en cada vértice primero
  for (let i = 0; i < n; i++) {
    if (i < 4) { points.push(verts[i].clone()); continue; }
    const f = faces[(i - 4) % 4];
    let a = Math.random(), b = Math.random();
    if (a + b > 1) { a = 1 - a; b = 1 - b; }
    const c = 1 - a - b;
    const p = verts[f[0]].clone().multiplyScalar(a)
      .add(verts[f[1]].clone().multiplyScalar(b))
      .add(verts[f[2]].clone().multiplyScalar(c));
    points.push(p);
  }
  return points;
}

// Aleatorio dentro de un rango (cubo de lado 2*range centrado en origen,
// con repulsión simple para evitar nodos demasiado juntos)
function randomPositions(n, range = 28) {
  const points = [];
  const minDist = range * 0.32;
  let attempts = 0;
  while (points.length < n && attempts < n * 50) {
    attempts++;
    const p = new THREE.Vector3(
      (Math.random() - 0.5) * 2 * range,
      (Math.random() - 0.5) * 2 * range,
      (Math.random() - 0.5) * 2 * range,
    );
    // Mantener un buffer mínimo respecto al core
    if (p.length() < range * 0.25) continue;
    let ok = true;
    for (const q of points) {
      if (p.distanceTo(q) < minDist) { ok = false; break; }
    }
    if (ok) points.push(p);
  }
  // Si no llegamos a N (capacidad del rango), rellenar sin chequear distancia
  while (points.length < n) {
    points.push(new THREE.Vector3(
      (Math.random() - 0.5) * 2 * range,
      (Math.random() - 0.5) * 2 * range,
      (Math.random() - 0.5) * 2 * range,
    ));
  }
  return points;
}

function computePositions(n, layout) {
  switch (layout) {
    case 'plane':       return planePositions(n);
    case 'tetrahedron': return tetrahedronPositions(n);
    case 'random':      return randomPositions(n);
    case 'sphere':
    default:            return spherePositions(n);
  }
}

// Curva orgánica core -> nodo: bezier con leve bend perpendicular
function curveCoreToNode(end) {
  const start = new THREE.Vector3(0, 0, 0);
  const mid = end.clone().multiplyScalar(0.55);
  // bend perpendicular al vector end (para evitar línea perfectamente recta)
  const perp = new THREE.Vector3(-end.y, end.x, end.z * 0.4).normalize();
  mid.add(perp.multiplyScalar(end.length() * 0.07));
  return new THREE.QuadraticBezierCurve3(start, mid, end.clone());
}

// Curva orgánica entre dos nodos: bezier con midpoint empujado hacia afuera
function curveInterNodes(a, b) {
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const avgR = (a.length() + b.length()) * 0.5;
  const len = mid.length();
  if (len > 0.001) mid.multiplyScalar((avgR * 1.12) / len);
  return new THREE.QuadraticBezierCurve3(a.clone(), mid, b.clone());
}

// Encuentra los K vecinos más cercanos de cada nodo (por distancia real)
function kNearestNeighbors(positions, k) {
  const N = positions.length;
  const result = [];
  for (let i = 0; i < N; i++) {
    const dists = [];
    for (let j = 0; j < N; j++) {
      if (i === j) continue;
      dists.push({ idx: j, d: positions[i].distanceTo(positions[j]) });
    }
    dists.sort((a, b) => a.d - b.d);
    result.push(dists.slice(0, k).map(x => x.idx));
  }
  return result;
}

export class NeuralNetwork {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'neuralNetwork';
    scene.add(this.group);

    this.nodes = [];
    // connections: { line, curve|null, getStart, getEnd, color, type }
    this.connections = [];
    this.pulses = null;
    this.primaryColor = new THREE.Color(0x6366f1);
    this.accentColor  = new THREE.Color(0xec4899);
    this.layout = 'sphere';
    this.onLayoutChanged = null;

    this._buildCore();
  }

  _buildCore() {
    const geo = new THREE.IcosahedronGeometry(5.5, 3);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x111133,
      emissive: this.primaryColor.clone(),
      emissiveIntensity: 1.6,
      metalness: 0.55,
      roughness: 0.22,
    });
    this.core = new THREE.Mesh(geo, mat);
    this.core.name = 'neuralCore';
    this.group.add(this.core);

    // Halo interno (cerca del core)
    const haloGeo = new THREE.SphereGeometry(6.8, 32, 32);
    const haloMat = new THREE.MeshBasicMaterial({
      color: this.primaryColor.clone(),
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.coreHalo = new THREE.Mesh(haloGeo, haloMat);
    this.group.add(this.coreHalo);

    // Halo externo difuso
    const halo2Geo = new THREE.SphereGeometry(9.5, 32, 32);
    const halo2Mat = new THREE.MeshBasicMaterial({
      color: this.primaryColor.clone(),
      transparent: true,
      opacity: 0.06,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.coreHaloOuter = new THREE.Mesh(halo2Geo, halo2Mat);
    this.group.add(this.coreHaloOuter);
  }

  setData(payload) {
    this.dispose(false);

    if (payload.colores) {
      this.primaryColor.set(payload.colores.primary);
      this.accentColor.set(payload.colores.accent);
      this.core.material.emissive.copy(this.primaryColor);
      this.coreHalo.material.color.copy(this.primaryColor);
      this.coreHaloOuter.material.color.copy(this.primaryColor);
    }

    const nodos = payload.nodos || [];
    const N = nodos.length;
    if (N === 0) return;

    const positions = computePositions(N, this.layout);

    for (let i = 0; i < N; i++) {
      const data = nodos[i];
      const pos = positions[i];
      const color = new THREE.Color(categoryColor(data.categoria));
      const importance = data.importancia ?? 2;
      const baseScale = 0.7 + importance * 0.38;

      // ---------- Capa interna (núcleo emisivo de la neurona) ----------
      const coreGeo = new THREE.IcosahedronGeometry(0.85, 2);
      const coreMat = new THREE.MeshStandardMaterial({
        color: 0x05050d,
        emissive: color,
        emissiveIntensity: 1.6,
        metalness: 0.3,
        roughness: 0.35,
      });
      const mesh = new THREE.Mesh(coreGeo, coreMat);
      mesh.position.copy(pos);
      mesh.scale.setScalar(baseScale);
      mesh.userData = { ...data, isNeuralNode: true, baseScale };

      // Pequeña deformación orgánica única (jitter en los vértices)
      const posAttr = coreGeo.attributes.position;
      const seed = i * 13.37;
      for (let v = 0; v < posAttr.count; v++) {
        const vx = posAttr.getX(v), vy = posAttr.getY(v), vz = posAttr.getZ(v);
        const noise = Math.sin(vx * 4 + seed) * Math.cos(vy * 3 + seed * 0.7) * 0.08;
        posAttr.setXYZ(v,
          vx + vx * noise,
          vy + vy * noise,
          vz + vz * noise,
        );
      }
      coreGeo.computeVertexNormals();
      this.group.add(mesh);

      // ---------- Membrana intermedia (semi-translúcida) ----------
      const membraneGeo = new THREE.SphereGeometry(1.35, 24, 24);
      const membraneMat = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.18,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const membrane = new THREE.Mesh(membraneGeo, membraneMat);
      membrane.position.copy(pos);
      membrane.scale.setScalar(baseScale);
      this.group.add(membrane);

      // ---------- Halo externo difuso ----------
      const haloGeo = new THREE.SphereGeometry(2.6, 16, 16);
      const haloMat = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.12,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const halo = new THREE.Mesh(haloGeo, haloMat);
      halo.position.copy(pos);
      halo.scale.setScalar(baseScale);
      this.group.add(halo);

      // Phase individual para pulsado emisivo
      const pulsePhase = Math.random() * Math.PI * 2;

      this.nodes.push({
        mesh, membrane, halo,
        data, basePos: pos.clone(), baseScale, color,
        pulsePhase,
      });
    }

    this._buildAllConnections();
  }

  // Reposiciona los nodos sin destruirlos según el layout indicado y
  // reconstruye las conexiones. Útil para cambiar la forma de la red en vivo.
  setLayout(name) {
    this.layout = name;
    if (this.nodes.length === 0) return;
    const positions = computePositions(this.nodes.length, name);
    for (let i = 0; i < this.nodes.length; i++) {
      const n = this.nodes[i];
      n.basePos.copy(positions[i]);
      n.mesh.position.copy(positions[i]);
      n.membrane.position.copy(positions[i]);
      n.halo.position.copy(positions[i]);
    }
    // Limpiar conexiones previas
    for (const c of this.connections) {
      this.group.remove(c.line);
      c.line.geometry.dispose();
      c.line.material.dispose();
    }
    this.connections = [];
    this._buildAllConnections();
    if (this.onLayoutChanged) this.onLayoutChanged();
  }

  _buildAllConnections() {
    // Conexiones core -> nodo (curvas bezier)
    for (let i = 0; i < this.nodes.length; i++) {
      const n = this.nodes[i];
      const curve = curveCoreToNode(n.basePos);
      const points = curve.getPoints(40);
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      const mat = new THREE.LineBasicMaterial({
        color: n.color,
        transparent: true,
        opacity: 0.42,
        blending: THREE.AdditiveBlending,
      });
      const line = new THREE.Line(geo, mat);
      this.group.add(line);

      this.connections.push({
        line, curve, color: n.color, type: 'core', nodeIdx: i,
      });
    }
    // Conexiones inter-nodos: cada nodo se conecta a sus K vecinos más cercanos
    this._buildInterConnections();
  }

  _buildInterConnections() {
    const positions = this.nodes.map(n => n.basePos);
    const N = this.nodes.length;
    if (N < 3) return;
    const K = Math.min(4, N - 1);
    const neighbors = kNearestNeighbors(positions, K);
    const seen = new Set();

    for (let i = 0; i < N; i++) {
      for (const j of neighbors[i]) {
        const key = i < j ? `${i}-${j}` : `${j}-${i}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const a = this.nodes[i].basePos;
        const b = this.nodes[j].basePos;
        const curve = curveInterNodes(a, b);
        const points = curve.getPoints(36);
        const geo = new THREE.BufferGeometry().setFromPoints(points);

        // Color promedio entre los dos nodos
        const cMix = this.nodes[i].color.clone().lerp(this.nodes[j].color, 0.5);
        const mat = new THREE.LineBasicMaterial({
          color: cMix,
          transparent: true,
          opacity: 0.18,
          blending: THREE.AdditiveBlending,
        });
        const line = new THREE.Line(geo, mat);
        this.group.add(line);

        this.connections.push({
          line,
          curve,
          color: cMix,
          type: 'inter',
          nodeIdxA: i,
          nodeIdxB: j,
        });
      }
    }
  }

  getInteractableMeshes() {
    return this.nodes.map(n => n.mesh);
  }

  getNodeMeshById(id) {
    const n = this.nodes.find(x => x.data && x.data.id === id);
    return n ? n.mesh : null;
  }

  highlight(nodeMesh) {
    for (const n of this.nodes) {
      if (n.mesh === nodeMesh) {
        n.mesh.scale.setScalar(n.baseScale * 1.45);
        n.membrane.material.opacity = 0.32;
        n.halo.material.opacity = 0.32;
        n.mesh.material.emissiveIntensity = 2.4;
      }
    }
  }

  unhighlight(nodeMesh) {
    for (const n of this.nodes) {
      if (n.mesh === nodeMesh) {
        n.mesh.scale.setScalar(n.baseScale);
        n.membrane.material.opacity = 0.18;
        n.halo.material.opacity = 0.12;
        n.mesh.material.emissiveIntensity = 1.6;
      }
    }
  }

  update(dt, t) {
    // Core
    const pulse = 1 + Math.sin(t * 1.4) * 0.06;
    this.core.scale.setScalar(pulse);
    this.coreHalo.scale.setScalar(pulse * 1.08);
    this.coreHaloOuter.scale.setScalar(pulse * 1.04);
    this.core.rotation.y += dt * 0.18;
    this.core.rotation.x += dt * 0.08;
    this.core.material.emissiveIntensity = 1.4 + Math.sin(t * 1.4) * 0.25;

    // Nodos: bobbing radial sutil + pulsado emisivo individual
    for (let i = 0; i < this.nodes.length; i++) {
      const n = this.nodes[i];
      const bob = Math.sin(t * 1.1 + i * 0.7) * 0.35;
      const dir = n.basePos.clone().normalize();
      const offset = dir.multiplyScalar(bob);
      n.mesh.position.copy(n.basePos).add(offset);
      n.membrane.position.copy(n.mesh.position);
      n.halo.position.copy(n.mesh.position);

      n.mesh.rotation.y += dt * 0.4;
      n.mesh.rotation.x += dt * 0.15;

      // Emissive breathing
      const breath = 1.1 + Math.sin(t * 2.1 + n.pulsePhase) * 0.35;
      n.mesh.material.emissiveIntensity = breath;
      n.membrane.material.opacity = 0.16 + Math.sin(t * 2.1 + n.pulsePhase) * 0.05;
    }

    // Rotación global lenta
    this.group.rotation.y += dt * 0.04;
  }

  dispose(disposeCore = true) {
    for (const n of this.nodes) {
      this.group.remove(n.mesh);
      this.group.remove(n.membrane);
      this.group.remove(n.halo);
      n.mesh.geometry.dispose();
      n.mesh.material.dispose();
      n.membrane.geometry.dispose();
      n.membrane.material.dispose();
      n.halo.geometry.dispose();
      n.halo.material.dispose();
    }
    for (const c of this.connections) {
      this.group.remove(c.line);
      c.line.geometry.dispose();
      c.line.material.dispose();
    }
    this.nodes = [];
    this.connections = [];

    if (disposeCore && this.core) {
      this.group.remove(this.core);
      this.group.remove(this.coreHalo);
      this.group.remove(this.coreHaloOuter);
      this.core.geometry.dispose();
      this.core.material.dispose();
      this.coreHalo.geometry.dispose();
      this.coreHalo.material.dispose();
      this.coreHaloOuter.geometry.dispose();
      this.coreHaloOuter.material.dispose();
    }
  }
}
