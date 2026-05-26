// Interaction.js — raycaster para hover/click + tween cámara al seleccionar
import * as THREE from 'three';

export class Interaction extends EventTarget {
  constructor(camera, domElement, network, controls) {
    super();
    this.camera = camera;
    this.dom = domElement;
    this.network = network;
    this.controls = controls;

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.mouseEvent = null;
    this.hoveredMesh = null;

    this._lastHoverCheck = 0;
    this._hoverThrottle = 1 / 60; // 60fps

    this._tween = null; // { startCam, endCam, startTarget, endTarget, duration, elapsed }

    this.dom.addEventListener('pointermove', e => this._onPointerMove(e));
    this.dom.addEventListener('click', e => this._onClick(e));
    this.dom.addEventListener('pointerleave', () => this._setHover(null));
  }

  _updateMouseFromEvent(e) {
    const rect = this.dom.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.mouseEvent = e;
  }

  _onPointerMove(e) {
    this._updateMouseFromEvent(e);
  }

  _onClick(e) {
    this._updateMouseFromEvent(e);
    const hit = this._raycast();
    if (hit) {
      this.dispatchEvent(new CustomEvent('select', { detail: { node: hit.object, point: hit.point } }));
      this._startTweenTo(hit.object);
    }
  }

  _raycast() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const meshes = this.network.getInteractableMeshes();
    if (meshes.length === 0) return null;
    const intersects = this.raycaster.intersectObjects(meshes, false);
    return intersects[0] || null;
  }

  _setHover(mesh) {
    if (this.hoveredMesh === mesh) return;
    if (this.hoveredMesh) {
      this.network.unhighlight(this.hoveredMesh);
    }
    this.hoveredMesh = mesh;
    if (mesh) {
      this.network.highlight(mesh);
      this.dom.style.cursor = 'pointer';
    } else {
      this.dom.style.cursor = 'default';
    }
    this.dispatchEvent(new CustomEvent('hover', {
      detail: { node: mesh, event: this.mouseEvent },
    }));
  }

  _startTweenTo(mesh) {
    const targetWorldPos = new THREE.Vector3();
    mesh.getWorldPosition(targetWorldPos);

    // Posición de cámara: a una distancia fija del nodo, en la dirección del nodo desde origen
    const dir = targetWorldPos.clone().normalize();
    const camDistance = 55;
    const camEnd = targetWorldPos.clone().add(dir.multiplyScalar(camDistance * 0.4));
    // Asegurar distancia mínima del nodo
    const fromTarget = targetWorldPos.clone().sub(this.camera.position).normalize();
    camEnd.copy(targetWorldPos.clone().sub(fromTarget.multiplyScalar(camDistance)));

    this._tween = {
      startCam: this.camera.position.clone(),
      endCam: camEnd,
      startTarget: this.controls.controls.target.clone(),
      endTarget: targetWorldPos.clone(),
      duration: 0.9,
      elapsed: 0,
    };
  }

  resetCamera() {
    this._tween = {
      startCam: this.camera.position.clone(),
      endCam: new THREE.Vector3(0, 0, 90),
      startTarget: this.controls.controls.target.clone(),
      endTarget: new THREE.Vector3(0, 0, 0),
      duration: 0.9,
      elapsed: 0,
    };
  }

  // Selección programática de un nodo por id (lo usa el sistema cronológico)
  selectNodeById(id) {
    const mesh = this.network.getNodeMeshById(id);
    if (!mesh) return false;
    this.dispatchEvent(new CustomEvent('select', { detail: { node: mesh, point: mesh.position.clone() } }));
    this._startTweenTo(mesh);
    return true;
  }

  update(dt, t) {
    // Throttle hover detection
    this._lastHoverCheck += dt;
    if (this._lastHoverCheck >= this._hoverThrottle) {
      this._lastHoverCheck = 0;
      const hit = this._raycast();
      this._setHover(hit ? hit.object : null);
    }

    // Camera tween
    if (this._tween) {
      this._tween.elapsed += dt;
      const k = Math.min(this._tween.elapsed / this._tween.duration, 1);
      // ease-out cubic
      const e = 1 - Math.pow(1 - k, 3);
      this.camera.position.lerpVectors(this._tween.startCam, this._tween.endCam, e);
      this.controls.controls.target.lerpVectors(this._tween.startTarget, this._tween.endTarget, e);
      if (k >= 1) this._tween = null;
    }
  }
}
