import React, { useRef, useEffect, useCallback } from 'react';
import * as BABYLON from '@babylonjs/core';
import { createStar } from '../StarFactory';
import '@babylonjs/core/Materials/PBR/pbrMaterial';
import '@babylonjs/core/Lights/Shadows/shadowGenerator';
import '@babylonjs/core/Layers/glowLayer';
import '@babylonjs/core/LensFlares/lensFlareSystem';
import '@babylonjs/core/Particles/pointsCloudSystem';

/**
 * Configuration constants for the game scene
 */
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

/**
 * Supported star system types
 */
type SystemId = 'sol-system' | 'proxima-system';

/**
 * Component props interface
 */
interface GameSceneProps {
  /** Unique identifier for the star system */
  systemId: SystemId;
  /** Username of the current player */
  username: string;
  /** Optional callback for error handling */
  onError?: (error: Error) => void;
}

/**
 * Player data structure for multiplayer functionality
 */
interface Player {
  id: string;
  username: string;
  position: BABYLON.Vector3;
}

/**
 * WebSocket message types for multiplayer communication
 */
type WebSocketMessage =
  | { type: 'identify'; username: string }
  | { type: 'sync'; players: Player[] }
  | { type: 'join'; player: Player }
  | { type: 'leave'; id: string }
  | { type: 'move'; id?: string; position: { x: number; y: number; z: number } };

/**
 * Remote player mesh objects
 */
interface RemotePlayerObjects {
  mesh: BABYLON.Mesh;
  glow: BABYLON.Mesh;
}

/**
 * GameScene Component: Professional 3D space scene with multiplayer support
 * 
 * Features:
 * - Babylon.js 3D rendering with professional lighting and effects
 * - Real-time multiplayer via WebSocket
 * - Procedural star field generation
 * - Planetary systems with orbital mechanics
 * - Post-processing effects (bloom, FXAA)
 * 
 * @param props - Component configuration
 */
const GameScene: React.FC<GameSceneProps> = ({ 
  systemId, 
  username, 
  onError 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<BABYLON.Engine | null>(null);
  const sceneRef = useRef<BABYLON.Scene | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  /**
   * Error handler with optional callback
   */
  const handleError = useCallback((error: Error, context: string) => {
    console.error(`GameScene Error (${context}):`, error);
    onError?.(error);
  }, [onError]);

  /**
   * Creates the scene skybox with space-like appearance
   */
  const createSkybox = useCallback((scene: BABYLON.Scene): BABYLON.Mesh => {
    const skybox = BABYLON.MeshBuilder.CreateSphere("skyBox", { diameter: 500 }, scene);
    const skyboxMaterial = new BABYLON.StandardMaterial("skyBox", scene);
    
    // Configure skybox for space environment
    skyboxMaterial.backFaceCulling = false;
    skyboxMaterial.emissiveColor = new BABYLON.Color3(0.01, 0.01, 0.04);
    skyboxMaterial.diffuseColor = new BABYLON.Color3(0, 0, 0);
    skyboxMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
    
    skybox.material = skyboxMaterial;
    skybox.infiniteDistance = true;
    
    return skybox;
  }, []);

  /**
   * Creates procedural star field for background
   */
  const createStarField = useCallback((scene: BABYLON.Scene): void => {
    try {
      const starField = new BABYLON.PointsCloudSystem("starField", SCENE_CONFIG.STAR_FIELD_COUNT, scene);
      
      starField.addPoints(SCENE_CONFIG.STAR_FIELD_COUNT, (particle: BABYLON.CloudPoint) => {
        const distance = SCENE_CONFIG.STAR_FIELD_DISTANCE.MIN + 
          Math.random() * (SCENE_CONFIG.STAR_FIELD_DISTANCE.MAX - SCENE_CONFIG.STAR_FIELD_DISTANCE.MIN);
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        
        // Spherical coordinate conversion
        particle.position.x = distance * Math.sin(phi) * Math.cos(theta);
        particle.position.y = distance * Math.cos(phi);
        particle.position.z = distance * Math.sin(phi) * Math.sin(theta);
        
        // Randomize star brightness and color
        const brightness = 0.6 + Math.random() * 0.4;
        const colorVariation = 0.8 + Math.random() * 0.2;
        particle.color = new BABYLON.Color4(colorVariation, colorVariation, 1, brightness);
      });
      
      starField.buildMeshAsync().catch(error => {
        handleError(new Error(`Failed to build star field: ${error.message}`), 'createStarField');
      });
    } catch (error) {
      handleError(error as Error, 'createStarField');
    }
  }, [handleError]);

  /**
   * Creates "The Peak" orbital space station
   */
  const createSpaceStation = useCallback((scene: BABYLON.Scene): BABYLON.Mesh => {
    // Main station body (cylindrical core)
    const stationCore = BABYLON.MeshBuilder.CreateCylinder("stationCore", {
      height: 15,
      diameterTop: 8,
      diameterBottom: 6,
      tessellation: 32
    }, scene);
    
    // Station material with metallic finish
    const stationMaterial = new BABYLON.StandardMaterial("stationMaterial", scene);
    stationMaterial.diffuseColor = new BABYLON.Color3(0.6, 0.7, 0.8);
    stationMaterial.specularColor = new BABYLON.Color3(0.8, 0.9, 1);
    stationMaterial.emissiveColor = new BABYLON.Color3(0.02, 0.03, 0.05);
    stationMaterial.roughness = 0.2;
    stationCore.material = stationMaterial;
    
    // Top docking ring
    const topRing = BABYLON.MeshBuilder.CreateTorus("topRing", {
      diameter: 12,
      thickness: 1,
      tessellation: 24
    }, scene);
    topRing.position.y = 6;
    topRing.parent = stationCore;
    topRing.material = stationMaterial;
    
    // Bottom engine section
    const engineSection = BABYLON.MeshBuilder.CreateCylinder("engineSection", {
      height: 4,
      diameterTop: 5,
      diameterBottom: 7,
      tessellation: 16
    }, scene);
    engineSection.position.y = -9.5;
    engineSection.parent = stationCore;
    
    const engineMaterial = new BABYLON.StandardMaterial("engineMaterial", scene);
    engineMaterial.diffuseColor = new BABYLON.Color3(0.3, 0.3, 0.4);
    engineMaterial.emissiveColor = new BABYLON.Color3(0.8, 0.3, 0.1);
    engineSection.material = engineMaterial;
    
    // Engine thrusters (orange glowing cylinders)
    for (let i = 0; i < 3; i++) {
      const angle = (i * Math.PI * 2) / 3;
      const thruster = BABYLON.MeshBuilder.CreateCylinder(`thruster${i}`, {
        height: 2,
        diameter: 1.5,
        tessellation: 8
      }, scene);
      
      thruster.position.x = Math.cos(angle) * 2.5;
      thruster.position.z = Math.sin(angle) * 2.5;
      thruster.position.y = -10.5;
      thruster.parent = stationCore;
      
      const thrusterMaterial = new BABYLON.StandardMaterial(`thrusterMaterial${i}`, scene);
      thrusterMaterial.emissiveColor = new BABYLON.Color3(1, 0.4, 0.1);
      thrusterMaterial.diffuseColor = new BABYLON.Color3(0.5, 0.2, 0.1);
      thruster.material = thrusterMaterial;
    }
    
    // Communication arrays (thin vertical structures)
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      const antenna = BABYLON.MeshBuilder.CreateCylinder(`antenna${i}`, {
        height: 8,
        diameter: 0.2,
        tessellation: 6
      }, scene);
      
      antenna.position.x = Math.cos(angle) * 4;
      antenna.position.z = Math.sin(angle) * 4;
      antenna.position.y = 2;
      antenna.parent = stationCore;
      
      const antennaMaterial = new BABYLON.StandardMaterial(`antennaMaterial${i}`, scene);
      antennaMaterial.diffuseColor = new BABYLON.Color3(0.7, 0.8, 0.9);
      antennaMaterial.emissiveColor = new BABYLON.Color3(0.1, 0.2, 0.3);
      antenna.material = antennaMaterial;
    }
    
    // Observation deck (top sphere section)
    const observationDeck = BABYLON.MeshBuilder.CreateSphere("observationDeck", {
      diameter: 6,
      segments: 16
    }, scene);
    observationDeck.position.y = 10;
    observationDeck.parent = stationCore;
    
    const deckMaterial = new BABYLON.StandardMaterial("deckMaterial", scene);
    deckMaterial.diffuseColor = new BABYLON.Color3(0.4, 0.6, 0.8);
    deckMaterial.specularColor = new BABYLON.Color3(0.6, 0.8, 1);
    deckMaterial.emissiveColor = new BABYLON.Color3(0.05, 0.1, 0.15);
    deckMaterial.alpha = 0.9;
    observationDeck.material = deckMaterial;
    
    // Warning lights
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI * 2) / 8;
      const light = BABYLON.MeshBuilder.CreateSphere(`warningLight${i}`, {
        diameter: 0.3
      }, scene);
      
      light.position.x = Math.cos(angle) * 3;
      light.position.z = Math.sin(angle) * 3;
      light.position.y = 0;
      light.parent = stationCore;
      
      const lightMaterial = new BABYLON.StandardMaterial(`lightMaterial${i}`, scene);
      lightMaterial.emissiveColor = new BABYLON.Color3(1, 0.2, 0.2);
      light.material = lightMaterial;
    }
    
    return stationCore;
  }, []);

  /**
   * Creates planet based on system type
   */
  const createPlanet = useCallback((scene: BABYLON.Scene, systemType: SystemId): BABYLON.Mesh | null => {
    try {
      let planet: BABYLON.Mesh;
      
      if (systemType === 'sol-system') {
        // Earth-like planet
        planet = BABYLON.MeshBuilder.CreateSphere("earth", { diameter: 2 }, scene);
        
        const earthMaterial = new BABYLON.StandardMaterial("earthMaterial", scene);
        earthMaterial.diffuseColor = new BABYLON.Color3(0.2, 0.4, 0.8);
        earthMaterial.specularColor = new BABYLON.Color3(0.1, 0.2, 0.4);
        earthMaterial.emissiveColor = new BABYLON.Color3(0.05, 0.1, 0.15);
        earthMaterial.roughness = 0.3;
        planet.material = earthMaterial;
        
        // Add atmospheric effect
        const atmosphere = BABYLON.MeshBuilder.CreateSphere("atmosphere", { diameter: 2.2 }, scene);
        const atmosphereMaterial = new BABYLON.StandardMaterial("atmosphereMaterial", scene);
        atmosphereMaterial.diffuseColor = new BABYLON.Color3(0.3, 0.6, 1);
        atmosphereMaterial.alpha = 0.1;
        atmosphere.material = atmosphereMaterial;
        atmosphere.parent = planet;
        
      } else if (systemType === 'proxima-system') {
        // Exoplanet
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

  /**
   * Creates the local player mesh with glow effect
   */
  const createLocalPlayer = useCallback((scene: BABYLON.Scene, playerUsername: string): BABYLON.Mesh => {
    const localPlayer = BABYLON.MeshBuilder.CreateSphere(`player-${playerUsername}`, { diameter: 1 }, scene);
    
    // Local player material (green)
    const localPlayerMat = new BABYLON.StandardMaterial("localPlayerMat", scene);
    localPlayerMat.emissiveColor = new BABYLON.Color3(0, 1, 0);
    localPlayerMat.diffuseColor = new BABYLON.Color3(0.2, 0.8, 0.2);
    localPlayerMat.specularColor = new BABYLON.Color3(0.5, 1, 0.5);
    localPlayer.material = localPlayerMat;
    
    // Glow effect
    const playerGlow = BABYLON.MeshBuilder.CreateSphere(`player-glow-${playerUsername}`, { diameter: 1.5 }, scene);
    playerGlow.parent = localPlayer;
    const playerGlowMat = new BABYLON.StandardMaterial("playerGlowMat", scene);
    playerGlowMat.emissiveColor = new BABYLON.Color3(0, 0.8, 0);
    playerGlowMat.alpha = 0.3;
    playerGlow.material = playerGlowMat;
    
    return localPlayer;
  }, []);

  /**
   * Creates a remote player mesh with unique color based on ID
   */
  const createRemotePlayer = useCallback((scene: BABYLON.Scene, id: string): RemotePlayerObjects => {
    const remotePlayer = BABYLON.MeshBuilder.CreateSphere(id, { diameter: 1 }, scene);
    
    // Generate deterministic color from player ID
    const hue = (id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) * 137.5) % 360;
    const color = BABYLON.Color3.FromHSV(hue, 0.7, 1);
    
    const remotePlayerMat = new BABYLON.StandardMaterial(`remotePlayerMat-${id}`, scene);
    remotePlayerMat.emissiveColor = color;
    remotePlayerMat.diffuseColor = color.scale(0.3);
    remotePlayerMat.specularColor = color;
    remotePlayer.material = remotePlayerMat;
    
    // Glow effect
    const remoteGlow = BABYLON.MeshBuilder.CreateSphere(`remote-glow-${id}`, { diameter: 1.5 }, scene);
    remoteGlow.parent = remotePlayer;
    const remoteGlowMat = new BABYLON.StandardMaterial(`remoteGlowMat-${id}`, scene);
    remoteGlowMat.emissiveColor = color.scale(0.8);
    remoteGlowMat.alpha = 0.2;
    remoteGlow.material = remoteGlowMat;
    
    return { mesh: remotePlayer, glow: remoteGlow };
  }, []);

  /**
   * Initializes WebSocket connection for multiplayer
   */
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

  /**
   * Sets up post-processing pipeline for enhanced visuals
   */
  const setupPostProcessing = useCallback((scene: BABYLON.Scene, camera: BABYLON.Camera): BABYLON.DefaultRenderingPipeline => {
    const pipeline = new BABYLON.DefaultRenderingPipeline("defaultPipeline", true, scene, [camera]);
    
    // Anti-aliasing
    pipeline.samples = SCENE_CONFIG.RENDERING.SAMPLES;
    pipeline.fxaaEnabled = true;
    
    // Bloom effect
    pipeline.bloomEnabled = true;
    pipeline.bloomThreshold = SCENE_CONFIG.RENDERING.BLOOM_THRESHOLD;
    pipeline.bloomWeight = SCENE_CONFIG.RENDERING.BLOOM_WEIGHT;
    pipeline.bloomKernel = SCENE_CONFIG.RENDERING.BLOOM_KERNEL;
    
    return pipeline;
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;

    try {
      // Initialize Babylon.js engine and scene
      const engine = new BABYLON.Engine(canvasRef.current, true, {
        antialias: true,
        powerPreference: "high-performance"
      });
      engineRef.current = engine;

      const scene = new BABYLON.Scene(engine);
      sceneRef.current = scene;
      scene.clearColor = new BABYLON.Color4(0.01, 0.01, 0.05, 1);

      // Create scene elements
      const skybox = createSkybox(scene);
      createStarField(scene);

      // Setup camera
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

      // Setup lighting
      const ambientLight = new BABYLON.HemisphericLight("ambientLight", new BABYLON.Vector3(0, 1, 0), scene);
      ambientLight.intensity = 0.2;
      ambientLight.diffuse = new BABYLON.Color3(0.7, 0.8, 1);

      const directionalLight = new BABYLON.DirectionalLight("sunLight", new BABYLON.Vector3(-1, -1, -1), scene);
      directionalLight.intensity = 1.8;
      directionalLight.diffuse = new BABYLON.Color3(1, 0.95, 0.85);

      // Create star
      const sunMesh = createStar(scene, systemId);
      if (sunMesh) {
        const glowLayer = new BABYLON.GlowLayer("glow", scene, { 
          mainTextureFixedSize: SCENE_CONFIG.RENDERING.GLOW_TEXTURE_SIZE,
          blurKernelSize: SCENE_CONFIG.RENDERING.GLOW_BLUR_KERNEL
        });
        glowLayer.intensity = SCENE_CONFIG.RENDERING.GLOW_INTENSITY;
        glowLayer.addIncludedOnlyMesh(sunMesh);

        // Lens flare effects
        const lensFlareSystem = new BABYLON.LensFlareSystem("lensFlareSystem", directionalLight, scene);
        const flareTexture = "@babylonjs/core/assets/textures/lensflare/lens4.png";
        
        new BABYLON.LensFlare(0.2, 0, new BABYLON.Color3(1, 1, 1), flareTexture, lensFlareSystem);
        new BABYLON.LensFlare(0.5, 0.2, new BABYLON.Color3(1, 1, 1), flareTexture, lensFlareSystem);
        new BABYLON.LensFlare(0.1, 0.5, new BABYLON.Color3(1, 1, 1), flareTexture, lensFlareSystem);
        new BABYLON.LensFlare(0.05, 0.7, new BABYLON.Color3(1, 1, 1), flareTexture, lensFlareSystem);
        new BABYLON.LensFlare(0.2, 1.0, new BABYLON.Color3(1, 1, 1), flareTexture, lensFlareSystem);
      }

      // Create planet
      const planet = createPlanet(scene, systemId);
      const planetOrbitRadius = systemId === 'sol-system' 
        ? SCENE_CONFIG.ORBIT_RADIUS.SOL_PLANET 
        : SCENE_CONFIG.ORBIT_RADIUS.PROXIMA_PLANET;

      // Create local player
      const localPlayer = createLocalPlayer(scene, username);

      // Initialize multiplayer
      const remotePlayers = new Map<string, RemotePlayerObjects>();
      const socket = initializeWebSocket(systemId, username, remotePlayers, scene);
      socketRef.current = socket;

      // Animation loop
      let time = 0;
      const renderLoop = scene.onBeforeRenderObservable.add(() => {
        time += SCENE_CONFIG.ANIMATION_SPEED.TIME_DELTA;

        // Animate planet
        if (planet) {
          planet.position.x = Math.cos(time * SCENE_CONFIG.ANIMATION_SPEED.PLANET_ORBIT) * planetOrbitRadius;
          planet.position.z = Math.sin(time * SCENE_CONFIG.ANIMATION_SPEED.PLANET_ORBIT) * planetOrbitRadius;
          planet.rotation.y += SCENE_CONFIG.ANIMATION_SPEED.PLANET_ROTATION;
          planet.position.y = Math.sin(time * SCENE_CONFIG.ANIMATION_SPEED.PLANET_VERTICAL) * 0.5;
        }

        // Animate local player
        localPlayer.position.x = Math.cos(time * SCENE_CONFIG.ANIMATION_SPEED.PLAYER_ORBIT) * SCENE_CONFIG.ORBIT_RADIUS.PLAYER;
        localPlayer.position.z = Math.sin(time * SCENE_CONFIG.ANIMATION_SPEED.PLAYER_ORBIT) * SCENE_CONFIG.ORBIT_RADIUS.PLAYER;
        localPlayer.position.y = Math.sin(time * SCENE_CONFIG.ANIMATION_SPEED.PLAYER_VERTICAL) * 2;
        localPlayer.rotation.y += SCENE_CONFIG.ANIMATION_SPEED.PLAYER_ROTATION;

        // Animate skybox
        skybox.rotation.y += SCENE_CONFIG.ANIMATION_SPEED.SKYBOX_ROTATION;

        // Send position update
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

      // Setup post-processing
      const pipeline = setupPostProcessing(scene, camera);

      // Start render loop
      engine.runRenderLoop(() => {
        scene.render();
      });

      // Handle window resize
      const resizeHandler = () => engine.resize();
      window.addEventListener('resize', resizeHandler);

      // Cleanup function
      return () => {
        scene.onBeforeRenderObservable.remove(renderLoop);
        socket.close();
        pipeline.dispose();
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
    createSkybox, 
    createStarField, 
    createPlanet, 
    createLocalPlayer, 
    initializeWebSocket, 
    setupPostProcessing,
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