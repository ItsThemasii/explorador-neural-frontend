// PostFX.js — EffectComposer + bloom
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export class PostFX {
  constructor(renderer, scene, camera) {
    this.composer = new EffectComposer(renderer);

    const renderPass = new RenderPass(scene, camera);
    this.composer.addPass(renderPass);

    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(renderer.domElement.clientWidth, renderer.domElement.clientHeight),
      0.95,  // strength (un poco menor para no quemar el planeta)
      0.6,   // radius
      0.88   // threshold (solo lo muy brillante hace bloom)
    );
    this.composer.addPass(this.bloom);

    this.output = new OutputPass();
    this.composer.addPass(this.output);
  }

  setSize(w, h) {
    this.composer.setSize(w, h);
  }
}
