import { routePartykitRequest, Server } from "partyserver";

// Model ID for Workers AI model
const MODEL_ID = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

// Game-specific system prompt
const GAME_SYSTEM_PROMPT = `You are a space exploration game assistant. You help players with:
- Ship navigation and controls
- Planet information and lore
- Mission objectives and hints
- Technical game support
Keep responses immersive and game-themed while being helpful.`;

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GameState {
  playerId: string;
  position: { x: number; y: number; z: number };
  currentPlanet?: string;
  shipHealth: number;
  credits: number;
  level: number;
}

export interface GameAction {
  type: "move" | "scan" | "dock" | "trade" | "combat";
  payload: any;
  timestamp: number;
}

// Define environment interface
interface Env {
  AI: any;
  GAME_STATE?: KVNamespace;
}

// Main export with proper Worker interface
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    
    // CORS headers for all responses
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    // Handle preflight requests
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Game entry point - serve the game client
    if (url.pathname === "/" || url.pathname === "/game") {
      return new Response(await getGameHTML(), {
        headers: { 
          "content-type": "text/html",
          ...corsHeaders 
        },
      });
    }

    // Game API endpoints
    if (url.pathname.startsWith("/api/")) {
      const response = await handleAPIRequest(request, env);
      // Add CORS headers to API responses
      const headers = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        headers.set(key, value);
      });
      return new Response(response.body, {
        status: response.status,
        headers,
      });
    }

    // Chat endpoint for game assistant
    if (url.pathname === "/chat") {
      if (request.method === "POST") {
        const response = await handleChatRequest(request, env);
        const headers = new Headers(response.headers);
        Object.entries(corsHeaders).forEach(([key, value]) => {
          headers.set(key, value);
        });
        return new Response(response.body, {
          status: response.status,
          headers,
        });
      }
      return new Response("Method not allowed", { 
        status: 405, 
        headers: corsHeaders 
      });
    }

    // Route PartyKit requests for multiplayer
    try {
      const partyResponse = await routePartykitRequest(request, { ...env });
      if (partyResponse) {
        return partyResponse;
      }
    } catch (error) {
      console.error("PartyKit routing error:", error);
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });
  },
};

/**
 * Handle API requests for game functionality
 */
async function handleAPIRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  try {
    switch (path) {
      case "/api/game/join":
        return await handleGameJoin(request, env);
      
      case "/api/game/state":
        return await handleGameState(request, env);
      
      case "/api/game/action":
        return await handleGameAction(request, env);
      
      case "/api/planets":
        return await handlePlanetsInfo(request, env);
      
      case "/api/leaderboard":
        return await handleLeaderboard(request, env);
      
      default:
        return new Response(
          JSON.stringify({ error: "API endpoint not found" }),
          { status: 404, headers: { "content-type": "application/json" } }
        );
    }
  } catch (error) {
    console.error("API Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
}

/**
 * Handle player joining the game
 */
async function handleGameJoin(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const { playerName } = await request.json() as { playerName: string };
  
  if (!playerName || playerName.trim().length === 0) {
    return new Response(
      JSON.stringify({ error: "Player name is required" }),
      { status: 400, headers: { "content-type": "application/json" } }
    );
  }

  const playerId = crypto.randomUUID();
  const initialState: GameState = {
    playerId,
    position: { x: 0, y: 0, z: 0 }, // Start at center
    shipHealth: 100,
    credits: 1000,
    level: 1,
  };

  // Store player state in KV (if available)
  if (env.GAME_STATE) {
    await env.GAME_STATE.put(`player:${playerId}`, JSON.stringify(initialState));
    await env.GAME_STATE.put(`player:${playerId}:name`, playerName);
  }

  return new Response(
    JSON.stringify({ 
      success: true, 
      playerId, 
      gameState: initialState,
      message: `Welcome to the galaxy, ${playerName}!` 
    }),
    { headers: { "content-type": "application/json" } }
  );
}

/**
 * Handle game state requests
 */
async function handleGameState(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const playerId = url.searchParams.get("playerId");

  if (!playerId) {
    return new Response(
      JSON.stringify({ error: "Player ID is required" }),
      { status: 400, headers: { "content-type": "application/json" } }
    );
  }

  let gameState = null;
  if (env.GAME_STATE) {
    const stateData = await env.GAME_STATE.get(`player:${playerId}`);
    if (stateData) {
      gameState = JSON.parse(stateData);
    }
  }

  if (!gameState) {
    return new Response(
      JSON.stringify({ error: "Player not found" }),
      { status: 404, headers: { "content-type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ gameState }),
    { headers: { "content-type": "application/json" } }
  );
}

/**
 * Handle game actions
 */
async function handleGameAction(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const { playerId, action } = await request.json() as { 
    playerId: string; 
    action: GameAction 
  };

  if (!playerId || !action) {
    return new Response(
      JSON.stringify({ error: "Player ID and action are required" }),
      { status: 400, headers: { "content-type": "application/json" } }
    );
  }

  // Process the action and update game state
  const result = await processGameAction(playerId, action, env);

  return new Response(
    JSON.stringify(result),
    { headers: { "content-type": "application/json" } }
  );
}

/**
 * Handle planets information
 */
async function handlePlanetsInfo(request: Request, env: Env): Promise<Response> {
  const planets = [
    {
      id: "forest-world",
      name: "Verdania",
      type: "Forest",
      position: { x: -16, y: 0, z: 0 },
      description: "A lush world covered in ancient forests and mystical castles.",
      resources: ["Wood", "Herbs", "Crystals"],
      danger: "Low",
    },
    {
      id: "desert-world", 
      name: "Aridus Prime",
      type: "Desert",
      position: { x: 16, y: 0, z: 0 },
      description: "A harsh desert planet with valuable minerals and trading posts.",
      resources: ["Minerals", "Spices", "Solar Energy"],
      danger: "Medium",
    },
    {
      id: "ice-world",
      name: "Glacialis",
      type: "Ice",
      position: { x: 0, y: 0, z: 16 },
      description: "A frozen world with crystal formations and ancient secrets.",
      resources: ["Ice Crystals", "Rare Metals", "Frozen Artifacts"],
      danger: "High",
    },
    {
      id: "crystal-world",
      name: "Lumina",
      type: "Crystal",
      position: { x: 0, y: 0, z: -16 },
      description: "A mysterious world of living crystals and energy sources.",
      resources: ["Energy Crystals", "Plasma", "Quantum Materials"],
      danger: "Very High",
    },
  ];

  return new Response(
    JSON.stringify({ planets }),
    { headers: { "content-type": "application/json" } }
  );
}

/**
 * Handle leaderboard requests
 */
async function handleLeaderboard(request: Request, env: Env): Promise<Response> {
  // This would typically fetch from a database
  const mockLeaderboard = [
    { name: "StarExplorer", level: 15, credits: 50000 },
    { name: "GalacticTrader", level: 12, credits: 35000 },
    { name: "CosmicWanderer", level: 10, credits: 28000 },
  ];

  return new Response(
    JSON.stringify({ leaderboard: mockLeaderboard }),
    { headers: { "content-type": "application/json" } }
  );
}

/**
 * Process game actions and update state
 */
async function processGameAction(
  playerId: string, 
  action: GameAction, 
  env: Env
): Promise<any> {
  // Get current state
  let gameState: GameState | null = null;
  if (env.GAME_STATE) {
    const stateData = await env.GAME_STATE.get(`player:${playerId}`);
    if (stateData) {
      gameState = JSON.parse(stateData);
    }
  }

  if (!gameState) {
    return { error: "Player not found" };
  }

  // Process different action types
  switch (action.type) {
    case "move":
      gameState.position = action.payload.position;
      break;
    
    case "scan":
      // Return scan results for current position
      return {
        success: true,
        scanResults: {
          nearbyObjects: ["Asteroid Field", "Trading Station"],
          resources: ["Iron Ore", "Energy Crystals"],
        },
      };
    
    case "dock":
      // Handle docking at stations/planets
      gameState.currentPlanet = action.payload.planetId;
      break;
    
    default:
      return { error: "Unknown action type" };
  }

  // Save updated state
  if (env.GAME_STATE) {
    await env.GAME_STATE.put(`player:${playerId}`, JSON.stringify(gameState));
  }

  return { success: true, gameState };
}

/**
 * Handle chat requests with game context
 */
async function handleChatRequest(request: Request, env: Env): Promise<Response> {
  try {
    const { messages = [] } = (await request.json()) as {
      messages: ChatMessage[];
    };

    // Add game-specific system prompt
    if (!messages.some((msg) => msg.role === "system")) {
      messages.unshift({ role: "system", content: GAME_SYSTEM_PROMPT });
    }

    const response = await env.AI.run(
      MODEL_ID,
      {
        messages,
        max_tokens: 512, // Shorter responses for game context
      },
      {
        returnRawResponse: true,
        gateway: {
          id: "YOUR_GATEWAY_ID",
          skipCache: false,
          cacheTtl: 1800, // Shorter cache for dynamic game content
        },
      }
    );

    return response;
  } catch (error) {
    console.error("Error processing chat request:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process request" }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      }
    );
  }
}

/**
 * Return the game HTML client
 */
async function getGameHTML(): Promise<string> {
  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Galaxy Explorer - Multiplayer Space Game</title>
    <style>
        body { 
            margin: 0; 
            padding: 0; 
            background: #000; 
            color: #fff; 
            font-family: 'Courier New', monospace;
        }
        .loading { 
            display: flex; 
            justify-content: center; 
            align-items: center; 
            height: 100vh; 
            font-size: 24px;
        }
        .game-ui {
            position: absolute;
            top: 20px;
            left: 20px;
            z-index: 100;
            background: rgba(0,0,0,0.8);
            padding: 15px;
            border-radius: 10px;
            border: 1px solid #444;
        }
    </style>
</head>
<body>
    <div class="loading" id="loading">
        <div>Loading Galaxy Explorer...</div>
    </div>
    
    <div class="game-ui" id="gameUI" style="display: none;">
        <h3>Galaxy Explorer</h3>
        <div id="playerInfo">
            <div>Player: <span id="playerName">-</span></div>
            <div>Credits: <span id="credits">0</span></div>
            <div>Level: <span id="level">1</span></div>
            <div>Ship Health: <span id="health">100</span>%</div>
        </div>
        <div style="margin-top: 10px;">
            <button onclick="scanArea()">Scan Area</button>
            <button onclick="openChat()">Game Assistant</button>
        </div>
    </div>

    <script>
        // Game initialization
        let gameState = null;
        let playerId = null;

        async function initGame() {
            try {
                // Join game with random name for demo
                const playerName = 'Explorer_' + Math.floor(Math.random() * 1000);
                
                const response = await fetch('/api/game/join', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ playerName })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    playerId = data.playerId;
                    gameState = data.gameState;
                    updateUI();
                    document.getElementById('loading').style.display = 'none';
                    document.getElementById('gameUI').style.display = 'block';
                    
                    // Load the 3D world (your existing Babylon.js code would go here)
                    loadGameWorld();
                } else {
                    console.error('Failed to join game:', data.error);
                }
                
            } catch (error) {
                console.error('Game initialization error:', error);
            }
        }

        function updateUI() {
            if (!gameState) return;
            
            document.getElementById('playerName').textContent = 'Player_' + playerId.slice(-4);
            document.getElementById('credits').textContent = gameState.credits;
            document.getElementById('level').textContent = gameState.level;
            document.getElementById('health').textContent = gameState.shipHealth;
        }

        async function scanArea() {
            try {
                const response = await fetch('/api/game/action', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        playerId,
                        action: { type: 'scan', payload: {}, timestamp: Date.now() }
                    })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    alert('Scan Results: ' + data.scanResults.nearbyObjects.join(', '));
                }
            } catch (error) {
                console.error('Scan error:', error);
            }
        }

        function openChat() {
            // Implement chat interface
            const message = prompt('Ask the game assistant:');
            if (message) {
                // Call chat API
                console.log('Chat message:', message);
            }
        }

        function loadGameWorld() {
            // Your existing Babylon.js 3D world code would be integrated here
            console.log('Loading 3D galaxy world...');
        }

        // Start the game
        initGame();
    </script>
</body>
</html>`;
}