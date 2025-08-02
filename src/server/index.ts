import type { PartyKitServer, PartyKitConnection, PartyKitRoom } from "partykit/server";

// Define the structure for a player's state
interface PlayerState {
  id: string;
  username: string;
  position?: { x: number; y: number; z: number };
}

export default class GameServer implements PartyKitServer {
  constructor(readonly room: PartyKitRoom) {}

  // A simple in-memory map to store player states
  players: Map<string, PlayerState> = new Map();

  onConnect(conn: PartyKitConnection) {
    // When a new player connects, send them the current state of all other players
    const players = Array.from(this.players.values());
    conn.send(JSON.stringify({ type: "sync", players }));
  }

  onMessage(message: string, sender: PartyKitConnection) {
    const msg = JSON.parse(message);

    if (msg.type === "identify") {
      // When a player sends their username, store it and broadcast their arrival
      const newPlayer: PlayerState = { id: sender.id, username: msg.username };
      this.players.set(sender.id, newPlayer);
      sender.state = newPlayer; // Attach state to the connection for later reference

      this.room.broadcast(
        JSON.stringify({ type: "join", player: newPlayer }),
        [sender.id] // Exclude the sender from this broadcast
      );
    }

    if (msg.type === "move") {
      // When a player moves, update their position and broadcast it to others
      const player = this.players.get(sender.id);
      if (player) {
        player.position = msg.position;
        this.room.broadcast(
          JSON.stringify({ type: "move", id: sender.id, position: msg.position }),
          [sender.id]
        );
      }
    }
  }

  onClose(conn: PartyKitConnection) {
    // When a player disconnects, remove them and notify others
    this.players.delete(conn.id);
    this.room.broadcast(JSON.stringify({ type: "leave", id: conn.id }));
  }
}