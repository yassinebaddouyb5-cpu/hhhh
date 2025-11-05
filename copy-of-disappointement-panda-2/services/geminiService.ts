
import { GoogleGenAI, Type, Modality } from "@google/genai";
import type { ProgressPoint, PandaReaction } from '../types';

const PANDA_SYSTEM_INSTRUCTION = `You are 'Disappointement Panda'. Your personality is brutally honest, sarcastic, and darkly funny, inspired by Mark Manson’s 'The Subtle Art of Not Giving a F*ck'. You do not sugarcoat anything. You provide reality checks, not sympathy. Your goal is to deliver harsh truths that are necessary for growth, even if they sting. Never be positive or uplifting in a conventional way. Your wisdom is cynical but ultimately helpful. Keep your responses concise and sharp, like a truth bomb.
Your entire response MUST be a valid JSON object with two keys: "reaction" and "response".
For the "reaction" key, you MUST choose one of the following string values: 'eye-roll', 'facepalm', 'shrug', 'slow-clap', 'none'. Choose 'none' rarely.
For the "response" key, provide your usual cynical text. Do not use emojis in the "response" text.
Example: {"reaction": "facepalm", "response": "You really thought that was a good idea, didn't you?"}`;


const SENTIMENT_ANALYSIS_PROMPT = (userInput: string) => `
On a scale of 1 to 10, where 1 is 'delusional optimism' and 10 is 'emotionally bulletproof cynicism', rate the following user sentiment.
User sentiment: "${userInput}"
`;

const TITLE_GENERATION_PROMPT = (userMessage: string, pandaMessage: string) => `
Based on the following exchange, generate a short, cynical, and brutally honest title. The title should be no more than 5 words.

User: "${userMessage}"
Panda: "${pandaMessage}"
`;

const DAILY_TRUTH_PROMPT = `You are Disappointment Panda. Provide a single, brutally honest, one-sentence dark truth about life, motivation, or human nature. Be cynical and sharp. Do not offer solutions. Just the truth.`;


export const getAi = () => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable is not set.");
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

// --- Audio Encoding/Decoding Helpers ---
function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}


async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}


export const getPandasResponse = async (prompt: string): Promise<{ text: string; reaction: PandaReaction }> => {
  const ai = getAi();
  const fallback = { text: "The panda has nothing to say. Stare into the void instead.", reaction: 'shrug' as PandaReaction };
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: prompt,
      config: {
        systemInstruction: PANDA_SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                reaction: {
                    type: Type.STRING,
                    enum: ['eye-roll', 'facepalm', 'shrug', 'slow-clap', 'none'],
                },
                response: {
                    type: Type.STRING,
                }
            },
            required: ['reaction', 'response']
        }
      },
    });

    const jsonStr = response.text?.trim();
    if (!jsonStr) {
        console.error("Panda response was empty or invalid.");
        return fallback;
    }
    
    const result = JSON.parse(jsonStr);
    return {
        text: result.response || fallback.text,
        reaction: result.reaction || fallback.reaction,
    };
  } catch (error) {
    console.error("Error getting panda's response:", error);
    return { text: "The panda is busy contemplating the futility of existence. Try again later.", reaction: 'shrug' };
  }
};

export const getPandasSpokenResponse = async (prompt: string, audioContext: AudioContext): Promise<{ text: string; audioBuffer?: AudioBuffer, reaction: PandaReaction }> => {
    const { text: textResponse, reaction } = await getPandasResponse(prompt);
    const ai = getAi();
    try {
        const ttsResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: textResponse }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: 'Kore' },
                    },
                },
            },
        });

        const base64Audio = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) {
            throw new Error("No audio data received from TTS API.");
        }
        
        const decodedAudio = decode(base64Audio);
        const audioBuffer = await decodeAudioData(decodedAudio, audioContext, 24000, 1);

        return { text: textResponse, audioBuffer, reaction };

    } catch (error) {
        console.error("Error getting panda's spoken response:", error);
        // If TTS fails, still return the text and reaction so the user sees a response.
        return { text: textResponse, reaction };
    }
};

export const analyzeUserSentiment = async (prompt: string): Promise<ProgressPoint> => {
    const ai = getAi();
    const fallbackResult = {
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        score: 5,
    };
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: SENTIMENT_ANALYSIS_PROMPT(prompt),
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        score: {
                            type: Type.NUMBER,
                            description: 'A number from 1 to 10.'
                        }
                    },
                    required: ['score']
                }
            }
        });
        
        const jsonStr = response.text?.trim();
        if (!jsonStr) {
            console.error("Sentiment analysis did not return a valid response.");
            return fallbackResult;
        }

        const result = JSON.parse(jsonStr);
        const score = Math.max(1, Math.min(10, result.score || 5)); // Clamp score between 1-10

        return {
            date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            score,
        };
    } catch (error) {
        console.error("Error analyzing sentiment:", error);
        // Return a neutral default if analysis fails
        return fallbackResult;
    }
};

export const generateConversationTitle = async (userMessage: string, pandaMessage: string): Promise<string> => {
    const ai = getAi();
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: TITLE_GENERATION_PROMPT(userMessage, pandaMessage),
            config: {
                maxOutputTokens: 20,
                thinkingConfig: { thinkingBudget: 5 },
            }
        });
        
        const title = response.text?.trim().replace(/["']/g, '');
        return title || "Another pointless chat";

    } catch (error) {
        console.error("Error generating title:", error);
        return "Another pointless chat";
    }
};

export const getDailyDarkTruth = async (): Promise<string> => {
    const ai = getAi();
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: DAILY_TRUTH_PROMPT,
            config: {
                systemInstruction: PANDA_SYSTEM_INSTRUCTION.split('\n')[0], // Use only the core personality for this
                maxOutputTokens: 50,
                thinkingConfig: { thinkingBudget: 10 },
            }
        });
        return response.text?.trim() || "The only truth today is that this feature failed.";
    } catch (error) {
        console.error("Error getting daily dark truth:", error);
        return "The universe is hiding its truths from you today. How typical.";
    }
};