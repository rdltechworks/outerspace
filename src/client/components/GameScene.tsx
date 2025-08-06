import React, { useRef, useEffect, useCallback } from 'react';
import * as BABYLON from '@babylonjs/core';
import { createStar } from '../StarFactory';
import '@babylonjs/core/Materials/PBR/pbrMaterial';
import '@babylonjs/core/Lights/Shadows/shadowGenerator';
import '@babylonjs/core/Layers/glowLayer';
import '@babylonjs/core/LensFlares/lensFlareSystem';
import '@babylonjs/core/Particles/pointsCloudSystem';

const SCENE_CONFIG = {
  STAR_FIELD_COUNT: 2000,
  STAR_FIELD_DISTANCE: { MIN: 200, MAX: 300 },
  ORBIT_RADIUS: {
    SOL_PLANET: 20,
    PROXIMA_PLANET: 15,
    PLAYER: 30,
  },
  ANIMATION_SPEED: {
    TIME_DELTA: 0.001,
    PLANET_ORBIT: 5,
    PLANET_ROTATION: 0.005,
    PLANET_VERTICAL: 3,
    PLAYER_ORBIT: 10,
    PLAYER_VERTICAL: 15,
    PLAYER_ROTATION: 0.02,
    SKYBOX_ROTATION: 0.0001,
  },
  RENDERING: {
    SAMPLES: 4,
    BLOOM_THRESHOLD: 0.8,
    BLOOM_WEIGHT: 0.3,
    BLOOM_KERNEL: 64,
    GLOW_TEXTURE_SIZE: 256,
    GLOW_BLUR_KERNEL: 64,
    GLOW_INTENSITY: 1.5,
  },
} as const;

type SystemId = 'sol-system' | 'proxima-system';

interface GameSceneProps {
  systemId: SystemId;
  username: string;
  onError?: (error: Error) => void;
}

interface Player {
  id: string;
  username: string;
  position: BABYLON.Vector3;
}

type WebSocketMessage =
  | { type: 'identify'; username: string }
  | { type: 'sync'; players: Player[] }
  | { type: 'join'; player: Player }
  | { type: 'leave'; id: string }
  | { type: 'move'; id?: string; position: { x: number; y: number; z: number } };

interface RemotePlayerObjects {
  mesh: BABYLON.Mesh;
  glow: BABYLON.Mesh;
}

const GameScene: React.FC<GameSceneProps> = ({ 
  systemId, 
  username, 
  onError 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<BABYLON.Engine | null>(null);
  const sceneRef = useRef<BABYLON.Scene | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  const handleError = useCallback((error: Error, context: string) => {
    console.error(`GameScene Error (${context}):`, error);
    onError?.(error);
  }, [onError]);

const createStarField = useCallback((scene: BABYLON.Scene): void => {
  try {
    for (let i = 0; i < 200; i++) {
      const star = BABYLON.MeshBuilder.CreateSphere(`star${i}`, { diameter: 0.2 }, scene);
      const distance = SCENE_CONFIG.STAR_FIELD_DISTANCE.MIN + 
        Math.random() * (SCENE_CONFIG.STAR_FIELD_DISTANCE.MAX - SCENE_CONFIG.STAR_FIELD_DISTANCE.MIN);
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      
      star.position.x = distance * Math.sin(phi) * Math.cos(theta);
      star.position.y = distance * Math.cos(phi);
      star.position.z = distance * Math.sin(phi) * Math.sin(theta);
      
      const starMaterial = new BABYLON.StandardMaterial(`starMat${i}`, scene);
      starMaterial.emissiveColor = new BABYLON.Color3(1, 1, 1);
      starMaterial.disableLighting = true;
      star.material = starMaterial;
    }
  } catch (error) {
    handleError(error as Error, 'createStarField');
  }
}, [handleError]);

  const createPlanet = useCallback((scene: BABYLON.Scene, systemType: SystemId): BABYLON.Mesh | null => {
    try {
      let planet: BABYLON.Mesh;
      
      if (systemType === 'sol-system') {
        planet = BABYLON.MeshBuilder.CreateSphere("earth", { diameter: 2 }, scene);
        
        const earthMaterial = new BABYLON.StandardMaterial("earthMaterial", scene);
        earthMaterial.diffuseColor = new BABYLON.Color3(0.2, 0.4, 0.8);
        earthMaterial.specularColor = new BABYLON.Color3(0.1, 0.2, 0.4);
        earthMaterial.emissiveColor = new BABYLON.Color3(0.05, 0.1, 0.15);
        earthMaterial.roughness = 0.3;
        planet.material = earthMaterial;
        
        const atmosphere = BABYLON.MeshBuilder.CreateSphere("atmosphere", { diameter: 2.2 }, scene);
        const atmosphereMaterial = new BABYLON.StandardMaterial("atmosphereMaterial", scene);
        atmosphereMaterial.diffuseColor = new BABYLON.Color3(0.3, 0.6, 1);
        atmosphereMaterial.alpha = 0.1;
        atmosphere.material = atmosphereMaterial;
        atmosphere.parent = planet;
        
      } else if (systemType === 'proxima-system') {
        planet = BABYLON.MeshBuilder.CreateSphere("exoplanet", { diameter: 1.5 }, scene);
        
        const exoplanetMaterial = new BABYLON.StandardMaterial("exoplanetMaterial", scene);
        exoplanetMaterial.diffuseColor = new BABYLON.Color3(0.6, 0.3, 0.2);
        exoplanetMaterial.specularColor = new BABYLON.Color3(0.3, 0.1, 0.05);
        exoplanetMaterial.emissiveColor = new BABYLON.Color3(0.1, 0.05, 0.02);
        exoplanetMaterial.roughness = 0.8;
        planet.material = exoplanetMaterial;
      } else {
        return null;
      }
      
      return planet;
    } catch (error) {
      handleError(error as Error, 'createPlanet');
      return null;
    }
  }, [handleError]);

  const createLocalPlayer = useCallback((scene: BABYLON.Scene, playerUsername: string): BABYLON.Mesh => {
    const localPlayer = BABYLON.MeshBuilder.CreateSphere(`player-${playerUsername}`, { diameter: 1 }, scene);
    
    const localPlayerMat = new BABYLON.StandardMaterial("localPlayerMat", scene);
    localPlayerMat.emissiveColor = new BABYLON.Color3(0, 1, 0);
    localPlayerMat.diffuseColor = new BABYLON.Color3(0.2, 0.8, 0.2);
    localPlayerMat.specularColor = new BABYLON.Color3(0.5, 1, 0.5);
    localPlayer.material = localPlayerMat;
    
    const playerGlow = BABYLON.MeshBuilder.CreateSphere(`player-glow-${playerUsername}`, { diameter: 1.5 }, scene);
    playerGlow.parent = localPlayer;
    const playerGlowMat = new BABYLON.StandardMaterial("playerGlowMat", scene);
    playerGlowMat.emissiveColor = new BABYLON.Color3(0, 0.8, 0);
    playerGlowMat.alpha = 0.3;
    playerGlow.material = playerGlowMat;
    
    return localPlayer;
  }, []);

  const createRemotePlayer = useCallback((scene: BABYLON.Scene, id: string): RemotePlayerObjects => {
    const remotePlayer = BABYLON.MeshBuilder.CreateSphere(id, { diameter: 1 }, scene);
    
    const hue = (id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) * 137.5) % 360;
    const color = BABYLON.Color3.FromHSV(hue, 0.7, 1);
    
    const remotePlayerMat = new BABYLON.StandardMaterial(`remotePlayerMat-${id}`, scene);
    remotePlayerMat.emissiveColor = color;
    remotePlayerMat.diffuseColor = color.scale(0.3);
    remotePlayerMat.specularColor = color;
    remotePlayer.material = remotePlayerMat;
    
    const remoteGlow = BABYLON.MeshBuilder.CreateSphere(`remote-glow-${id}`, { diameter: 1.5 }, scene);
    remoteGlow.parent = remotePlayer;
    const remoteGlowMat = new BABYLON.StandardMaterial(`remoteGlowMat-${id}`, scene);
    remoteGlowMat.emissiveColor = color.scale(0.8);
    remoteGlowMat.alpha = 0.2;
    remoteGlow.material = remoteGlowMat;
    
    return { mesh: remotePlayer, glow: remoteGlow };
  }, []);

  const initializeWebSocket = useCallback((
    systemType: SystemId,
    playerUsername: string,
    remotePlayers: Map<string, RemotePlayerObjects>,
    scene: BABYLON.Scene
  ): WebSocket => {
    const socket = new WebSocket(`wss://${window.location.host}/party/${systemType}`);
    
    socket.onopen = () => {
      socket.send(JSON.stringify({ 
        type: 'identify', 
        username: playerUsername 
      } as WebSocketMessage));
    };
    
    socket.onmessage = (event) => {
      try {
        const msg: WebSocketMessage = JSON.parse(event.data);
        
        switch (msg.type) {
          case 'sync':
            msg.players.forEach((player: Player) => {
              if (player.id && !remotePlayers.has(player.id)) {
                const playerObjs = createRemotePlayer(scene, player.id);
                remotePlayers.set(player.id, playerObjs);
              }
            });
            break;
            
          case 'join':
            if (msg.player.id && !remotePlayers.has(msg.player.id)) {
              const playerObjs = createRemotePlayer(scene, msg.player.id);
              remotePlayers.set(msg.player.id, playerObjs);
            }
            break;
            
          case 'leave':
            const playerObjs = remotePlayers.get(msg.id);
            if (playerObjs) {
              playerObjs.mesh.dispose();
              playerObjs.glow.dispose();
              remotePlayers.delete(msg.id);
            }
            break;
            
          case 'move':
            if (msg.id) {
              const remotePlayerObjs = remotePlayers.get(msg.id);
              if (remotePlayerObjs && msg.position) {
                remotePlayerObjs.mesh.position = new BABYLON.Vector3(
                  msg.position.x, 
                  msg.position.y, 
                  msg.position.z
                );
              }
            }
            break;
        }
      } catch (error) {
        handleError(error as Error, 'WebSocket message parsing');
      }
    };
    
    socket.onerror = (error) => {
      handleError(new Error('WebSocket connection error'), 'WebSocket');
    };
    
    return socket;
  }, [createRemotePlayer, handleError]);

  useEffect(() => {
    if (!canvasRef.current) return;

    try {
      const engine = new BABYLON.Engine(canvasRef.current, true, {
        antialias: true,
        powerPreference: "high-performance"
      });
      engineRef.current = engine;

      const scene = new BABYLON.Scene(engine);
      sceneRef.current = scene;
      scene.clearColor = new BABYLON.Color4(0.01, 0.01, 0.05, 1);

      createStarField(scene);

      const camera = new BABYLON.ArcRotateCamera(
        "camera", 
        -Math.PI / 2, 
        Math.PI / 2.5, 
        80, 
        BABYLON.Vector3.Zero(), 
        scene
      );
      camera.attachControl(canvasRef.current, true);
      camera.setTarget(BABYLON.Vector3.Zero());
      camera.lowerRadiusLimit = 20;
      camera.upperRadiusLimit = 200;
      camera.wheelDeltaPercentage = 0.01;

      const ambientLight = new BABYLON.HemisphericLight("ambientLight", new BABYLON.Vector3(0, 1, 0), scene);
      ambientLight.intensity = 0.2;
      ambientLight.diffuse = new BABYLON.Color3(0.7, 0.8, 1);

      const directionalLight = new BABYLON.DirectionalLight("sunLight", new BABYLON.Vector3(-1, -1, -1), scene);
      directionalLight.intensity = 1.8;
      directionalLight.diffuse = new BABYLON.Color3(1, 0.95, 0.85);
      const sunMesh = createStar(scene, systemId);
      if (sunMesh) {
        const glowLayer = new BABYLON.GlowLayer("glow", scene, { 
          mainTextureFixedSize: SCENE_CONFIG.RENDERING.GLOW_TEXTURE_SIZE,
          blurKernelSize: SCENE_CONFIG.RENDERING.GLOW_BLUR_KERNEL
        });
        glowLayer.intensity = SCENE_CONFIG.RENDERING.GLOW_INTENSITY * 1.5;
        glowLayer.addIncludedOnlyMesh(sunMesh);

        const coronaGeometry = new BABYLON.SphereGeometry("corona", { diameter: sunMesh.scaling.x * 3 }, scene);
        const coronaMaterial = new BABYLON.StandardMaterial("coronaMaterial", scene);
        coronaMaterial.emissiveTexture = new BABYLON.NoiseProceduralTexture("noiseTexture", 512, scene);
        coronaMaterial.emissiveTexture.octaves = 4;
        coronaMaterial.emissiveTexture.persistence = 0.8;
        coronaMaterial.emissiveColor = new BABYLON.Color3(1, 0.6, 0.2);
        coronaMaterial.alpha = 0.3;
        coronaMaterial.alphaMode = BABYLON.Engine.ALPHA_ADD;
        
        const coronaMesh = new BABYLON.Mesh("corona", scene);
        coronaMesh.geometry = coronaGeometry;
        coronaMesh.material = coronaMaterial;
        coronaMesh.position = sunMesh.position.clone();
        
        scene.registerBeforeRender(() => {
          coronaMesh.rotation.y += 0.005;
          coronaMesh.rotation.x += 0.002;
        });

        const particleSystem = new BABYLON.ParticleSystem("solarFlares", 2000, scene);
        particleSystem.particleTexture = new BABYLON.Texture("https://www.babylonjs-playground.com/textures/flare.png", scene);
        particleSystem.emitter = sunMesh;
        particleSystem.minEmitBox = new BABYLON.Vector3(-sunMesh.scaling.x/2, -sunMesh.scaling.y/2, -sunMesh.scaling.z/2);
        particleSystem.maxEmitBox = new BABYLON.Vector3(sunMesh.scaling.x/2, sunMesh.scaling.y/2, sunMesh.scaling.z/2);
        
        particleSystem.color1 = new BABYLON.Color4(1, 0.8, 0.2, 1.0);
        particleSystem.color2 = new BABYLON.Color4(1, 0.4, 0.1, 1.0);
        particleSystem.colorDead = new BABYLON.Color4(0.5, 0.1, 0.1, 0.0);
        particleSystem.minSize = 0.1;
        particleSystem.maxSize = 0.8;
        particleSystem.minLifeTime = 0.3;
        particleSystem.maxLifeTime = 1.5;
        particleSystem.emitRate = 1500;
        particleSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_ONEONE;
        particleSystem.gravity = new BABYLON.Vector3(0, 0, 0);
        particleSystem.direction1 = new BABYLON.Vector3(-1, -1, -1);
        particleSystem.direction2 = new BABYLON.Vector3(1, 1, 1);
        particleSystem.minAngularSpeed = 0;
        particleSystem.maxAngularSpeed = Math.PI;
        particleSystem.minEmitPower = 1;
        particleSystem.maxEmitPower = 3;
        particleSystem.updateSpeed = 0.01;
        particleSystem.start();

        const lensFlareSystem = new BABYLON.LensFlareSystem("lensFlareSystem", directionalLight, scene);
        const flareTexture = "@babylonjs/core/assets/textures/lensflare/lens4.png";
        
        new BABYLON.LensFlare(0.3, 0, new BABYLON.Color3(1, 1, 1), flareTexture, lensFlareSystem);
        new BABYLON.LensFlare(0.6, 0.1, new BABYLON.Color3(1, 0.8, 0.6), flareTexture, lensFlareSystem);
        new BABYLON.LensFlare(0.2, 0.3, new BABYLON.Color3(1, 0.6, 0.3), flareTexture, lensFlareSystem);
        new BABYLON.LensFlare(0.4, 0.5, new BABYLON.Color3(0.8, 0.4, 0.2), flareTexture, lensFlareSystem);
        new BABYLON.LensFlare(0.1, 0.7, new BABYLON.Color3(1, 0.3, 0.1), flareTexture, lensFlareSystem);
        new BABYLON.LensFlare(0.3, 0.9, new BABYLON.Color3(1, 0.5, 0.2), flareTexture, lensFlareSystem);
        new BABYLON.LensFlare(0.15, 1.2, new BABYLON.Color3(0.9, 0.3, 0.1), flareTexture, lensFlareSystem);

        let pulseTime = 0;
        scene.registerBeforeRender(() => {
          pulseTime += 0.02;
          const pulseFactor = 1 + Math.sin(pulseTime) * 0.1;
          sunMesh.scaling = new BABYLON.Vector3(pulseFactor, pulseFactor, pulseFactor);
          
          glowLayer.intensity = (SCENE_CONFIG.RENDERING.GLOW_INTENSITY * 1.5) * (0.8 + Math.sin(pulseTime * 0.5) * 0.4);
        });

        const godraysPostProcess = new BABYLON.VolumetricLightScatteringPostProcess(
          'godrays',
          1.0,
          camera,
          sunMesh,
          100,
          BABYLON.Texture.BILINEAR_SAMPLINGMODE,
          engine,
          false
        );
        godraysPostProcess.exposure = 0.3;
        godraysPostProcess.decay = 0.96815;
        godraysPostProcess.weight = 0.58767;
        godraysPostProcess.density = 0.926;

        const heatDistortionLayer = new BABYLON.EffectLayer("heatDistortion", scene);
        const distortionTexture = new BABYLON.NoiseProceduralTexture("distortion", 256, scene);
        distortionTexture.octaves = 3;
        distortionTexture.persistence = 0.8;
        
        const heatShimmerMaterial = new BABYLON.StandardMaterial("heatShimmer", scene);
        heatShimmerMaterial.diffuseTexture = distortionTexture;
        heatShimmerMaterial.alpha = 0.1;
        heatShimmerMaterial.alphaMode = BABYLON.Engine.ALPHA_ADD;
        
        const heatSphere = BABYLON.MeshBuilder.CreateSphere("heatSphere", {diameter: sunMesh.scaling.x * 2.5}, scene);
        heatSphere.material = heatShimmerMaterial;
        heatSphere.position = sunMesh.position.clone();
        
        scene.registerBeforeRender(() => {
          if (distortionTexture) {
            distortionTexture.animationSpeed = 2;
          }
          heatSphere.rotation.y += 0.01;
        });

        let lightColorTime = 0;
        scene.registerBeforeRender(() => {
          lightColorTime += 0.01;
          const r = 1.0;
          const g = 0.7 + Math.sin(lightColorTime) * 0.2;
          const b = 0.3 + Math.sin(lightColorTime * 0.7) * 0.2;
          directionalLight.diffuse = new BABYLON.Color3(r, g, b);
          directionalLight.specular = new BABYLON.Color3(r * 0.8, g * 0.8, b * 0.8);
        });

        console.log("Amazing sun created with enhanced visual effects!");
      }

      const planet = createPlanet(scene, systemId);
      const planetOrbitRadius = systemId === 'sol-system' 
        ? SCENE_CONFIG.ORBIT_RADIUS.SOL_PLANET 
        : SCENE_CONFIG.ORBIT_RADIUS.PROXIMA_PLANET;

      const localPlayer = createLocalPlayer(scene, username);

      const remotePlayers = new Map<string, RemotePlayerObjects>();
      const socket = initializeWebSocket(systemId, username, remotePlayers, scene);
      socketRef.current = socket;

      let time = 0;
      const renderLoop = scene.onBeforeRenderObservable.add(() => {
        time += SCENE_CONFIG.ANIMATION_SPEED.TIME_DELTA;

        if (planet) {
          planet.position.x = Math.cos(time * SCENE_CONFIG.ANIMATION_SPEED.PLANET_ORBIT) * planetOrbitRadius;
          planet.position.z = Math.sin(time * SCENE_CONFIG.ANIMATION_SPEED.PLANET_ORBIT) * planetOrbitRadius;
          planet.rotation.y += SCENE_CONFIG.ANIMATION_SPEED.PLANET_ROTATION;
          planet.position.y = Math.sin(time * SCENE_CONFIG.ANIMATION_SPEED.PLANET_VERTICAL) * 0.5;
        }

        localPlayer.position.x = Math.cos(time * SCENE_CONFIG.ANIMATION_SPEED.PLAYER_ORBIT) * SCENE_CONFIG.ORBIT_RADIUS.PLAYER;
        localPlayer.position.z = Math.sin(time * SCENE_CONFIG.ANIMATION_SPEED.PLAYER_ORBIT) * SCENE_CONFIG.ORBIT_RADIUS.PLAYER;
        localPlayer.position.y = Math.sin(time * SCENE_CONFIG.ANIMATION_SPEED.PLAYER_VERTICAL) * 2;
        localPlayer.rotation.y += SCENE_CONFIG.ANIMATION_SPEED.PLAYER_ROTATION;

        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ 
            type: 'move', 
            position: { 
              x: localPlayer.position.x, 
              y: localPlayer.position.y, 
              z: localPlayer.position.z 
            } 
          } as WebSocketMessage));
        }
      });

      engine.runRenderLoop(() => {
        scene.render();
      });

      const resizeHandler = () => engine.resize();
      window.addEventListener('resize', resizeHandler);

      return () => {
        scene.onBeforeRenderObservable.remove(renderLoop);
        socket.close();
        remotePlayers.forEach(({ mesh, glow }) => {
          mesh.dispose();
          glow.dispose();
        });
        engine.dispose();
        window.removeEventListener('resize', resizeHandler);
      };

    } catch (error) {
      handleError(error as Error, 'Scene initialization');
    }
  }, [
    systemId, 
    username, 
    createStarField, 
    createPlanet, 
    createLocalPlayer, 
    initializeWebSocket, 
    handleError
  ]);

  return (
    <canvas 
      ref={canvasRef} 
      style={{ 
        width: '100vw', 
        height: '100vh', 
        display: 'block',
        cursor: 'grab'
      }} 
      aria-label="3D Space Game Scene"
    />
  );
};

export default GameScene;