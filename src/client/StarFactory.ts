import * as BABYLON from '@babylonjs/core';

export function createStar(scene: BABYLON.Scene, systemId: 'sol-system' | 'proxima-system'): void {
    // Emitter object for the particle systems
    const coreSphere = BABYLON.MeshBuilder.CreateSphere("starCore", { diameter: systemId === 'sol-system' ? 10 : 5 }, scene);
    coreSphere.position = BABYLON.Vector3.Zero();

    // Determine colors based on the system
    const coreColor = systemId === 'sol-system' ? new BABYLON.Color3(1, 1, 0.8) : new BABYLON.Color3(0.9, 0.2, 0.1);
    const flareColor1 = systemId === 'sol-system' ? new BABYLON.Color4(1, 0.96, 0.51, 1.0) : new BABYLON.Color4(1, 0.5, 0.2, 1.0);
    const flareColor2 = systemId === 'sol-system' ? new BABYLON.Color4(0.9, 0.7, 0.38, 1.0) : new BABYLON.Color4(0.8, 0.3, 0.1, 1.0);

    // Core material
    const coreMat = new BABYLON.StandardMaterial("starMat", scene);
    coreMat.emissiveColor = coreColor;
    coreMat.disableLighting = true;
    coreSphere.material = coreMat;

    // Pulsating animation
    const animation = new BABYLON.Animation("pulse", "scaling.x", 30, BABYLON.Animation.ANIMATIONTYPE_FLOAT, BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE);
    const keys = [];
    keys.push({ frame: 0, value: 1 });
    keys.push({ frame: 60, value: 1.1 });
    keys.push({ frame: 120, value: 1 });
    animation.setKeys(keys);
    coreSphere.animations.push(animation);

    const yAnimation = animation.clone();
    yAnimation.targetProperty = "scaling.y";
    coreSphere.animations.push(yAnimation);

    const zAnimation = animation.clone();
    zAnimation.targetProperty = "scaling.z";
    coreSphere.animations.push(zAnimation);

    scene.beginAnimation(coreSphere, 0, 120, true);

    // Particle Systems
    const particleSystem = new BABYLON.ParticleSystem("particles", 4000, scene);
    particleSystem.particleTexture = new BABYLON.Texture("https://raw.githubusercontent.com/PatrickRyanMS/BabylonJStextures/master/ParticleSystems/Sun/T_SunSurface.png", scene);
    particleSystem.emitter = coreSphere;
    particleSystem.particleEmitterType = new BABYLON.SphereParticleEmitter(systemId === 'sol-system' ? 5.5 : 2.8);

    // Particle appearance
    particleSystem.color1 = new BABYLON.Color4(1, 0.8, 0.2, 1.0);
    particleSystem.color2 = flareColor1;
    particleSystem.colorDead = new BABYLON.Color4(0, 0, 0, 0.0);

    particleSystem.minSize = 0.4;
    particleSystem.maxSize = 0.9;

    particleSystem.minLifeTime = 2;
    particleSystem.maxLifeTime = 4;

    particleSystem.emitRate = 1000;
    particleSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;

    // Flare particle system
    const flareSystem = new BABYLON.ParticleSystem("flares", 50, scene);
    flareSystem.particleTexture = new BABYLON.Texture("https://raw.githubusercontent.com/PatrickRyanMS/BabylonJStextures/master/ParticleSystems/Sun/T_SunFlare.png", scene);
    flareSystem.emitter = coreSphere;
    flareSystem.particleEmitterType = new BABYLON.SphereParticleEmitter(systemId === 'sol-system' ? 5.6 : 2.9);

    flareSystem.color1 = flareColor1;
    flareSystem.color2 = flareColor2;
    flareSystem.colorDead = new BABYLON.Color4(0, 0, 0, 0.0);

    flareSystem.minSize = 0.5;
    flareSystem.maxSize = 1.5;
    flareSystem.minLifeTime = 1;
    flareSystem.maxLifeTime = 2;
    flareSystem.emitRate = 20;
    flareSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;

    // Start particle systems
    particleSystem.start();
    flareSystem.start();
}
