
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { ALEX_SYSTEM_INSTRUCTION, GEMINI_TEXT_MODEL, GEMINI_VOICE_MODEL } from "./constants";

export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  }

  async sendTextMessage(prompt: string, history: { role: string, parts: string }[]) {
    const response = await this.ai.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: [
        ...history.map(h => ({ role: h.role, parts: [{ text: h.parts }] })),
        { role: 'user', parts: [{ text: prompt }] }
      ],
      config: {
        systemInstruction: ALEX_SYSTEM_INSTRUCTION,
        temperature: 0.7,
      },
    });
    return response.text;
  }

  connectLive(callbacks: {
    onAudio: (base64: string) => void;
    onInterrupted: () => void;
    onTranscription: (text: string, isUser: boolean) => void;
  }) {
    return this.ai.live.connect({
      model: GEMINI_VOICE_MODEL,
      callbacks: {
        onopen: () => console.log('Live session opened'),
        onmessage: async (message: LiveServerMessage) => {
          if (message.serverContent?.modelTurn?.parts[0]?.inlineData?.data) {
            callbacks.onAudio(message.serverContent.modelTurn.parts[0].inlineData.data);
          }
          if (message.serverContent?.interrupted) {
            callbacks.onInterrupted();
          }
          if (message.serverContent?.inputTranscription) {
            callbacks.onTranscription(message.serverContent.inputTranscription.text, true);
          }
          if (message.serverContent?.outputTranscription) {
            callbacks.onTranscription(message.serverContent.outputTranscription.text, false);
          }
        },
        onerror: (e) => console.error('Live error:', e),
        onclose: () => console.log('Live session closed'),
      },
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction: ALEX_SYSTEM_INSTRUCTION,
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
        },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
      }
    });
  }
}

// Audio Helpers
export function decodeBase64Audio(base64: string) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function pcmToAudioBuffer(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const buffer = ctx.createBuffer(1, dataInt16.length, sampleRate);
  const channelData = buffer.getChannelData(0);
  for (let i = 0; i < dataInt16.length; i++) {
    channelData[i] = dataInt16[i] / 32768.0;
  }
  return buffer;
}

export function encodePCM(data: Float32Array): string {
  const int16 = new Int16Array(data.length);
  for (let i = 0; i < data.length; i++) {
    int16[i] = Math.max(-1, Math.min(1, data[i])) * 32767;
  }
  let binary = '';
  const bytes = new Uint8Array(int16.buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
