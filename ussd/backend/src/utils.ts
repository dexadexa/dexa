export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const maxDuration = 60;





import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});






export async function summarizeResponse(originalResponse: string, userQuery: string): Promise<string> {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: `You are a minimal response formatter. Format responses as follows:
                    - For balances: Return only the number and currency (e.g. "0.99 HBAR")
                    - For addresses: Return only the address
                    - For transfers: Return only "Success or "Failed: <reason>"
                    - For other responses: Maximum one short sentence
                    Never include phrases like "your balance is" or "your address is"`
                },
                {
                    role: "user",
                    content: `User Query: "${userQuery}"\nDetailed Response: "${originalResponse}"\nProvide minimal response:`
                }
            ],
            temperature: 0.6,
        });

        return response.choices[0].message.content?.trim() || originalResponse;
    } catch (error) {
        console.error("Summarization error:", error);
        return originalResponse;
    }
}