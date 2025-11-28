import { GoogleGenAI, Type, Schema, Modality } from "@google/genai";
import { DubSegment } from "../types";

// Helper to convert file to Base64
export const fileToGenerativePart = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove data url prefix (e.g. "data:video/mp4;base64,")
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key not found");
  return new GoogleGenAI({ apiKey });
};

export const analyzeVideo = async (
  fileBase64: string,
  mimeType: string,
  sourceLang: string,
  targetLang: string,
  targetDialect?: string,
  dubbingStyle: string = 'Natural'
): Promise<DubSegment[]> => {
  const ai = getClient();
  
  // Define response schema for structured output
  const segmentSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      segments: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            startTime: { type: Type.NUMBER, description: "Start time in seconds (float). Extremely precise start of speech." },
            endTime: { type: Type.NUMBER, description: "End time in seconds (float). Extremely precise end of speech." },
            originalText: { type: Type.STRING, description: "The transcribed original text" },
            translatedText: { type: Type.STRING, description: "The translated text. MUST BE EXTREMELY CONCISE and have FULL TASHKEEL." },
            speakerLabel: { type: Type.STRING, description: "Identify the speaker (e.g., 'Speaker 1', 'Speaker 2')." }
          },
          required: ["startTime", "endTime", "originalText", "translatedText", "speakerLabel"]
        }
      }
    }
  };

  const dialectInstruction = targetDialect 
    ? `Translate explicitly into the **${targetDialect}** dialect of ${targetLang}. Use local idioms, slang, and phrasing specific to ${targetDialect}.`
    : `Translate into standard ${targetLang}.`;

  const styleInstructions: Record<string, string> = {
    'Natural': "Focus on conversational flow. Use ellipses (...) to indicate natural pauses and thought. Use commas frequently for breathing room. The tone should be relaxed and human.",
    'Dramatic': "Use short, punchy sentences. High emotional intensity. Use exclamation marks (!) to indicate stress, loudness, and excitement. Great for movies/stories.",
    'Formal': "Use steady, professional pacing. Full distinct pronunciation. Avoid casual ellipses. Tone is authoritative, calm, and informative (Documentary style).",
    'Energetic': "Optimize for speed and energy. Shortest possible words. Minimal pauses. Upbeat tone."
  };

  const selectedStyleInstruction = styleInstructions[dubbingStyle] || styleInstructions['Natural'];

  const prompt = `
    Analyze the audio in this video file for a professional dubbing task.
    
    1. **Speaker Diarization**: Distinctly identify different speakers. Label them 'Speaker 1', 'Speaker 2', etc.
    2. **Transcription**: Transcribe the speech (ASR) in ${sourceLang}.
    3. **Translation**: ${dialectInstruction}
    4. **DUBBING STYLE & PROSODY (CRITICAL)**:
       - **Style**: ${dubbingStyle}
       - **Instruction**: ${selectedStyleInstruction}
       - **Punctuation**: Use punctuation (.,?!...) deliberately to control the rhythm of the TTS voice.
    5. **CRITICAL - ARABIC PRONUNCIATION**: 
       - You MUST provide the Arabic text with **FULL TASHKEEL (Diacritics)** (Fatha, Kasra, Damma, Shadda, etc.).
       - This is required to prevent robotic/pitch-shifted voices.
    6. **TIMING & BREVITY**: 
       - **Summarize and Condense**: Capture meaning in the fewest words possible to fit the English timing.
       - **FINAL SENTENCE**: Ensure the very last sentence is extra concise (max 3-5 words) so it does not overflow when the video ends.
    7. **Timestamping**: 
       - Return extremely precise start and end timestamps. 
       - **Exclude Silence**: Do not include pauses in the segments. Tighten the timestamps around the speech.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { inlineData: { mimeType, data: fileBase64 } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: segmentSchema,
        systemInstruction: "You are a professional video dubbing expert. You prioritize timing, natural prosody, emotional intelligence, and correct phonetic diacritics (Tashkeel).",
      }
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("No response from AI");

    const parsed = JSON.parse(jsonText);
    
    return parsed.segments.map((seg: any, index: number) => ({
      ...seg,
      id: `seg-${index}-${Date.now()}`
    }));

  } catch (error) {
    console.error("Analysis Error:", error);
    throw error;
  }
};

export const generateSpeech = async (
  text: string,
  voiceName: string
): Promise<string> => {
  const ai = getClient();

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName }
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    
    if (!base64Audio) {
      throw new Error("No audio data generated");
    }

    // Convert base64 to Blob URL for playback
    const binaryString = window.atob(base64Audio);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    const wavBlob = pcmToWav(bytes, 24000); 
    return URL.createObjectURL(wavBlob);

  } catch (error) {
    console.error("TTS Error:", error);
    throw error;
  }
};

export const editImage = async (
  base64Image: string,
  promptText: string
): Promise<string> => {
  const ai = getClient();
  
  try {
    // Gemini 2.5 Flash Image ('nano banana') for image editing
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/png', // Assuming canvas export is PNG
              data: base64Image
            }
          },
          {
            text: promptText
          }
        ]
      },
      // Note: responseMimeType and responseSchema are NOT supported for this model
    });

    // Check parts for the image
    let base64Result = '';
    const parts = response.candidates?.[0]?.content?.parts;
    
    if (parts) {
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          base64Result = part.inlineData.data;
          break; // Found the image
        }
      }
    }

    if (!base64Result) {
      throw new Error("No image generated");
    }

    return `data:image/png;base64,${base64Result}`;

  } catch (error) {
    console.error("Image Edit Error:", error);
    throw error;
  }
};

// Helper to add WAV header to raw PCM
function pcmToWav(pcmData: Uint8Array, sampleRate: number): Blob {
  const numChannels = 1;
  const bitsPerSample = 16; 
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcmData.length; 

  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');

  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); 
  view.setUint16(20, 1, true); 
  view.setUint16(22, numChannels, true); 
  view.setUint32(24, sampleRate, true); 
  view.setUint32(28, byteRate, true); 
  view.setUint16(32, blockAlign, true); 
  view.setUint16(34, bitsPerSample, true); 

  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);
  
  // Write PCM data
  const pcmBytes = new Uint8Array(buffer, 44);
  pcmBytes.set(pcmData);

  return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}