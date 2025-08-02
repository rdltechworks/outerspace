
import React, { useRef, useEffect } from 'react';
import * as BABYLON from '@babylonjs/core';
import { createStar } from '../StarFactory';

// Game Scene Component: Handles Babylon.js rendering and PartyKit connection
const GameScene = ({ systemId, username }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const engine = new BABYLON.Engine(canvasRef.current, true);
    const scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0.02, 0.02, 0.1, 1);

    const camera = new BABYLON.ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 2.5, 100, BABYLON.Vector3.Zero(), scene);
    camera.attachControl(canvasRef.current, true);

    new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);

    // Use the StarFactory to create the star
    createStar(scene, systemId);

    // Scene setup based on systemId
    let planet: BABYLON.Mesh;
    if (systemId === 'sol-system') {
      planet = BABYLON.MeshBuilder.CreateSphere("earth", { diameter: 2 }, scene);
      planet.position.x = 20;
    } else if (systemId === 'proxima-system') {
      planet = BABYLON.MeshBuilder.CreateSphere("exoplanet", { diameter: 1.5 }, scene);
      planet.position.x = 15;
    }

    const localPlayer = BABYLON.MeshBuilder.CreateSphere(`player-${username}`, { diameter: 1 }, scene);
    const localPlayerMat = new BABYLON.StandardMaterial("localPlayerMat", scene);
    localPlayerMat.emissiveColor = BABYLON.Color3.Green();
    localPlayer.material = localPlayerMat;

    const remotePlayers = new Map<string, BABYLON.Mesh>();
    const partySocket = new WebSocket(`wss://${window.location.host}/party/${systemId}`);

    partySocket.onopen = () => {
      partySocket.send(JSON.stringify({ type: 'identify', username }));
    };

    partySocket.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      switch (msg.type) {
        case 'sync':
          msg.players.forEach(p => {
            if (p.id !== partySocket.id && !remotePlayers.has(p.id)) {
              const remotePlayer = BABYLON.MeshBuilder.CreateSphere(p.id, { diameter: 1 }, scene);
              remotePlayers.set(p.id, remotePlayer);
            }
          });
          break;
        case 'join':
          if (msg.player.id !== partySocket.id && !remotePlayers.has(msg.player.id)) {
            const remotePlayer = BABYLON.MeshBuilder.CreateSphere(msg.player.id, { diameter: 1 }, scene);
            remotePlayers.set(msg.player.id, remotePlayer);
          }
          break;
        case 'leave':
          remotePlayers.get(msg.id)?.dispose();
          remotePlayers.delete(msg.id);
          break;
        case 'move':
          const playerMesh = remotePlayers.get(msg.id);
          if (playerMesh) {
            playerMesh.position = new BABYLON.Vector3(msg.position.x, msg.position.y, msg.position.z);
          }
          break;
      }
    };

    let time = 0;
    const renderLoop = scene.onBeforeRenderObservable.add(() => {
        time += 0.001; // Slow down the orbit

        // Planet orbit
        if(planet) {
            const orbitRadius = systemId === 'sol-system' ? 20 : 15;
            planet.position.x = Math.cos(time * 5) * orbitRadius;
            planet.position.z = Math.sin(time * 5) * orbitRadius;
        }

        // Player movement (for testing)
        localPlayer.position.x = Math.cos(time * 10) * 30;
        localPlayer.position.z = Math.sin(time * 10) * 30;

        if (partySocket.readyState === WebSocket.OPEN) {
            partySocket.send(JSON.stringify({ type: 'move', position: { x: localPlayer.position.x, y: localPlayer.position.y, z: localPlayer.position.z } }));
        }
    });

    engine.runRenderLoop(() => scene.render());
    const resizeHandler = () => engine.resize();
    window.addEventListener('resize', resizeHandler);

    // Cleanup on component unmount
    return () => {
      scene.onBeforeRenderObservable.remove(renderLoop);
      partySocket.close();
      engine.dispose();
      window.removeEventListener('resize', resizeHandler);
    };
  }, [systemId, username]); // Re-run effect if systemId or username changes

  return <canvas ref={canvasRef} style={{ width: '100vw', height: '100vh', display: 'block' }} />;
};

export default GameScene;
