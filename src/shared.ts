export type ChatMessage = {
  id: string;
  content: string;
  user: string;
  role: "user" | "assistant";
};

export type Message =
  | {
    type: "add";
    id: string;
    content: string;
    user: string;
    role: "user" | "assistant";
  }
  | {
    type: "update";
    id: string;
    content: string;
    user: string;
    role: "user" | "assistant";
  }
  | {
    type: "all";
    messages: ChatMessage[];
  };

export const names = [
  "Alice",
  "Bob",
  "Charlie",
  "David",
  "Eve",
  "Frank",
  "Grace",
  "Heidi",
  "Ivan",
  "Judy",
  "Kevin",
  "Linda",
  "Mallory",
  "Nancy",
  "Oscar",
  "Peggy",
  "Quentin",
  "Randy",
  "Steve",
  "Trent",
  "Ursula",
  "Victor",
  "Walter",
  "Xavier",
  "Yvonne",
  "Zoe",
];
// Messages that we'll send to the client

// Representing a person's position
export type Position = {
  lat: number;
  lng: number;
  id: string;
};

export type OutgoingMessage =
  | {
    type: "add-marker";
    position: Position;
  }
  | {
    type: "remove-marker";
    id: string;
  };