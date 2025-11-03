
// FIX: Import HarmBlockThreshold and use the enum for safety settings thresholds to fix the type error.
import { GoogleGenAI, Chat, Modality, HarmCategory, HarmBlockThreshold } from "@google/genai";
import type { Message, MessagePart } from '../types';

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable is not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// FIX: Combined generationConfig and safetySettings into a single config object for the new API.
const config = {
  temperature: 0.9,
  topK: 1,
  topP: 1,
  maxOutputTokens: 2048,
  // FIX: Use HarmCategory enum and HarmBlockThreshold enum for BlockThreshold to match API requirements and fix type error.
  safetySettings: [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  ],
};

export function createChatSession(history: Message[]): Chat {
  // FIX: Updated to use ai.chats.create, which is the correct API for starting a chat.
  // The 'models.create' and 'startChat' methods are deprecated.
  const formattedHistory = history.map(msg => ({
    role: msg.role,
    // FIX: The API expects an array of part objects, not a single concatenated string.
    parts: msg.parts,
  }));

  return ai.chats.create({
    model: 'gemini-2.5-flash',
    config,
    history: formattedHistory,
  });
}

export async function generateSpeech(text: string): Promise<string | null> {
  if (!text) return null;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' }, // A pleasant, neutral voice
            },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
        return base64Audio;
    }
    return null;
  } catch (error) {
    console.error("Error generating speech:", error);
    return null;
  }
}
