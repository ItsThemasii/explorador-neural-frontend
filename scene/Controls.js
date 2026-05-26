// Controls.js — wrapper de OrbitControls con damping y autoRotate sutil
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class Controls {
  constructor(camera, domElement) {
    this.controls = new OrbitControls(camera, domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.minDistance = 28;
    this.controls.maxDistance = 180;
    this.controls.rotateSpeed = 0.9;
    this.controls.zoomSpeed = 0.9;
    // autoRotate DESACTIVADO — mantenemos la composición fija (Nebulosa / Núcleo / Sol / Tierra)
    // La sensación de dinamismo viene de cometas, planeta rotando, nebulosa respirando, etc.
    this.controls.autoRotate = false;
  }

  update() {
    this.controls.update();
  }
}
