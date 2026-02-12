
export enum Sender {
  ALEX = 'alex',
  USER = 'user'
}

export interface Message {
  id: string;
  sender: Sender;
  text: string;
  timestamp: Date;
  type: 'text' | 'voice';
}

export interface AudioConfig {
  sampleRate: number;
  channels: number;
}
