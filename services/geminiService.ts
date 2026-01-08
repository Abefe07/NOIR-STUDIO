
import { GoogleGenAI } from "@google/genai";

export class GeminiService {
  /**
   * Generates a cinematic portrait based on an input image and a prompt.
   * Uses gemini-2.5-flash-image for image editing.
   */
  async transformPortrait(base64Image: string, prompt: string): Promise<string | null> {
    try {
      // FIX: Always initialize a new GoogleGenAI instance right before the API call 
      // using process.env.API_KEY directly as a named parameter.
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      
      const mimeType = base64Image.split(';')[0].split(':')[1];
      const base64Data = base64Image.split(',')[1];

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType,
              },
            },
            {
              text: prompt,
            },
          ],
        },
      });

      if (!response.candidates || response.candidates.length === 0) {
        throw new Error("No candidates returned from Gemini API");
      }

      // FIX: Iterate through all parts to find the image part, as per guidelines.
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const base64EncodeString: string = part.inlineData.data;
          const mimeType: string = part.inlineData.mimeType;
          return `data:${mimeType};base64,${base64EncodeString}`;
        }
      }

      return null;
    } catch (error) {
      console.error("Gemini Image Transformation failed:", error);
      throw error;
    }
  }
}

export const geminiService = new GeminiService();
