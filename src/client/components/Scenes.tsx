  import * as BABYLON from '@babylonjs/core';

// Main menu scene
export const createMainMenuScene = (engine, onPlay) => {
    const scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0, 0, 0, 1);

    // Simple camera
    const camera = new BABYLON.ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 2.5, 15, new BABYLON.Vector3(0, 0, 0), scene);
    camera.attachControl(null, true);

    // Background stars
    const stars = new BABYLON.ParticleSystem("stars", 2000, scene);
    stars.particleTexture = new BABYLON.Texture("https://www.babylonjs-playground.com/textures/flare.png", scene);
    stars.emitter = new BABYLON.Vector3(0, 0, 0);
    stars.minEmitBox = new BABYLON.Vector3(-100, -100, -100);
    stars.maxEmitBox = new BABYLON.Vector3(100, 100, 100);
    stars.minSize = 0.1;
    stars.maxSize = 0.5;
    stars.minLifeTime = 10000;
    stars.maxLifeTime = 10000;
    stars.emitRate = 500;
    stars.start();

    return scene;
};