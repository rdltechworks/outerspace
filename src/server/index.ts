import { routePartykitRequest, Server } from "partyserver";
import type { Connection, ConnectionContext } from "partyserver";
import type { OutgoingMessage, Position } from "../shared";
const MODEL_ID = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

const SYSTEM_PROMPT =
  "You are a helpful, friendly assistant. Provide concise and accurate responses.";

  type ConnectionState = {
  position: Position;
};

export class Globe extends Server {
  onConnect(conn: Connection<ConnectionState>, ctx: ConnectionContext) {
    // Whenever a fresh connection is made, we'll
    // send the entire state to the new connection

    // First, let's extract the position from the Cloudflare headers
    const latitude = ctx.request.cf?.latitude as string | undefined;
    const longitude = ctx.request.cf?.longitude as string | undefined;
    if (!latitude || !longitude) {
      console.warn(`Missing position information for connection ${conn.id}`);
      return;
    }
    const position = {
      lat: parseFloat(latitude),
      lng: parseFloat(longitude),
      id: conn.id,
    };
    // And save this on the connection's state
    conn.setState({
      position,
    });

    // Now, let's send the entire state to the new connection
    for (const connection of this.getConnections<ConnectionState>()) {
      try {
        conn.send(
          JSON.stringify({
            type: "add-marker",
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            position: connection.state!.position,
          } satisfies OutgoingMessage),
        );

        // And let's send the new connection's position to all other connections
        if (connection.id !== conn.id) {
          connection.send(
            JSON.stringify({
              type: "add-marker",
              position,
            } satisfies OutgoingMessage),
          );
        }
      } catch {
        this.onCloseOrError(conn);
      }
    }
  }

  // Whenever a connection closes (or errors), we'll broadcast a message to all
  // other connections to remove the marker.
  onCloseOrError(connection: Connection) {
    this.broadcast(
      JSON.stringify({
        type: "remove-marker",
        id: connection.id,
      } satisfies OutgoingMessage),
      [connection.id],
    );
  }

  onClose(connection: Connection): void | Promise<void> {
    this.onCloseOrError(connection);
  }

  onError(connection: Connection): void | Promise<void> {
    this.onCloseOrError(connection);
  }
}
/**
 * Represents a chat message.
 */
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/chat") {
      // Handle POST requests for chat
      if (request.method === "POST") {
        return handleChatRequest(request, env);
      }

      // Method not allowed for other request types
      return new Response("Method not allowed", { status: 405 });
    }

    return (
      (await routePartykitRequest(request, { ...env })) ||
      new Response("Not Found", { status: 404 })
    );
  },
} satisfies ExportedHandler<Env>;

/**
 * Handles chat API requests
 */
async function handleChatRequest(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    // Parse JSON request body
    const { messages = [] } = (await request.json()) as {
      messages: ChatMessage[];
    };

    // Add system prompt if not present
    if (!messages.some((msg) => msg.role === "system")) {
      messages.unshift({ role: "system", content: SYSTEM_PROMPT });
    }

    const response = await env.AI.run(
      MODEL_ID,
      {
        messages,
        max_tokens: 1024,
      },
      {
        returnRawResponse: true,
        gateway: {
          id: "YOUR_GATEWAY_ID", // Replace with your AI Gateway ID
          skipCache: false,      // Set to true to bypass cache
          cacheTtl: 3600,        // Cache time-to-live in seconds
        },
      },
    );

    // Return streaming response
    return response;
  } catch (error) {
    console.error("Error processing chat request:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process request" }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      },
    );
  }
}
