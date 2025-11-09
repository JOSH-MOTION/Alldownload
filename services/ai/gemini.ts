import { GoogleGenAI } from "@google/genai";

// This check is to prevent the app from crashing in environments where process.env.API_KEY is not defined.
const apiKey = process.env.API_KEY;
if (!apiKey) {
  console.warn("Gemini API key not found. AI features will be disabled.");
}

const ai = new GoogleGenAI({ apiKey: apiKey || "" });

/**
 * Generates a concise summary for a video using the Gemini API.
 * @param title The title of the video.
 * @param description The description of the video.
 * @returns A promise that resolves to the generated summary string, or null if the API key is missing.
 */
export const generateSummary = async (title: string, description?: string): Promise<string | null> => {
    if (!apiKey) {
        return null;
    }

    try {
        const prompt = `Summarize this video in one short, engaging sentence for a user who is about to download it. Be friendly and concise.\n\nTitle: ${title}\n\nDescription: ${description || 'No description provided.'}`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        
        const text = response.text;
        return text.trim();
    } catch (error) {
        console.error("Error generating summary with Gemini:", error);
        // Return a graceful fallback or null
        return "Could not generate AI summary at this time.";
    }
};
