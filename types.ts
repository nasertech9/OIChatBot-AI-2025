
export interface User {
  username: string;
}

export interface MessagePart {
  text: string;
}

export interface Message {
  role: 'user' | 'model';
  parts: MessagePart[];
  timestamp: string;
}
