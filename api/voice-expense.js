import { GoogleGenerativeAI } from "@google/generative-ai";
import { Client as NotionClient } from "@notionhq/client";

// Initialize Gemini and Notion clients using environment variables
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const notion = new NotionClient({ auth: process.env.NOTION_API_KEY });
const NOTION_DATABASE_ID = process.env.NOTION_EXPENSE_DATABASE_ID;

// Define valid types and categories for expense/income tracking.
const validTypes = ["Income", "Expense"];
const validCategories = [
    "Food", "Transport", "Shopping", "Utilities", "Rent", "Salary",
    "Gift", "Entertainment", "Healthcare", "Education", "Other",
    "Mahar Unity", "Bavin"
];

// Helper function to get today's date in YYYY-MM-DD format.
function getTodayDate() {
    const today = new Date();
    // Adjust for local timezone offset to ensure "today" is consistent with local time.
    const offset = today.getTimezoneOffset(); // Get timezone offset in minutes
    const localDate = new Date(today.getTime() - (offset * 60 * 1000)); // Apply offset to get UTC equivalent of local date

    const year = localDate.getFullYear();
    const month = String(localDate.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
    const day = String(localDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Main handler for the unified API route
export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method Not Allowed" });
    }

    try {
        const { audio, mimeType, transcript, extractedData } = req.body;

        // --- SCENARIO 1: Handle Audio Transcription and Data Extraction ---
        if (audio && mimeType) {
            console.log("API received audio for transcription and extraction.");
            // Using the same model for audio and subsequent text processing for simplicity
            const audioModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); 

            const audioPart = {
                inlineData: {
                    data: audio,
                    mimeType: mimeType,
                },
            };

            let rawTranscript = "";
            let correctedTranscript = "";
            let extractedDataFromGemini = null;

            try {
                // Step 1: Transcribe the audio to get raw text
                console.log("Transcribing audio...");
                const transcriptionPrompt = "Transcribe the following Burmese audio clearly and accurately.";
                const transcriptionResult = await audioModel.generateContent([transcriptionPrompt, audioPart]);
                rawTranscript = transcriptionResult.response.text();
                console.log("Raw Transcript:", rawTranscript);

                // Step 2: Correct spelling and grammar of the raw transcription
                console.log("Correcting spelling and grammar...");
                // The prompt asks Gemini to only return the corrected text.
                const correctionPrompt = `Correct any spelling, grammatical errors, and rephrase for natural flow in the following Burmese text. Only return the corrected text: "${rawTranscript}"`;
                const correctionResult = await audioModel.generateContent([correctionPrompt]); 
                correctedTranscript = correctionResult.response.text();
                console.log("Corrected Transcript:", correctedTranscript);

                // Step 3: Extract financial data from the corrected transcript
                console.log("Extracting data from corrected transcript...");
                const extractionPrompt = `You will be given Burmese text that describes either an income or an expense.
First, confirm the text is in Burmese. Then extract and return the following fields as JSON.

Only use the following values for each field:

- "type": must be either "Income" or "Expense"
- "category": choose only one from: ${validCategories.join(', ')}
- "amount": number (e.g. 15000). Ensure this is a numeric value.
- "date": format as YYYY-MM-DD. ONLY include this field if a date is explicitly mentioned in the text. Do NOT infer or use today's date if it's not mentioned.
- "note": short description in Burmese, capturing the essence of the transaction. This should be the original or corrected transcription of the audio.

Respond with ONLY the JSON object in this format. Do not include any additional text or markdown formatting around the JSON (e.g., no \`\`\`json\`\`\`):
{
  "type": "Expense",
  "amount": 15000,
  "category": "Food",
  "date": "2025-06-25", // Example date if explicitly mentioned
  "note": "နံနက်စာအတွက်"
}

Input Burmese text: "${correctedTranscript}"`;

                const extractionResult = await audioModel.generateContent([extractionPrompt]);
                let geminiOutputText = extractionResult.response.text();
                console.log("Gemini raw extraction output:", geminiOutputText);

                // Attempt to clean JSON from markdown fences if present (despite prompt instruction)
                const jsonMatch = geminiOutputText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
                if (jsonMatch && jsonMatch[1]) {
                    geminiOutputText = jsonMatch[1];
                } else {
                    geminiOutputText = geminiOutputText.trim();
                }

                extractedDataFromGemini = JSON.parse(geminiOutputText);
                console.log("Extracted data after JSON parse:", extractedDataFromGemini);

                // Validate and fallback for type and category
                if (!validTypes.includes(extractedDataFromGemini.type)) {
                    console.warn(`Gemini returned invalid type: ${extractedDataFromGemini.type}. Defaulting to 'Expense'.`);
                    extractedDataFromGemini.type = "Expense";
                }
                if (!validCategories.includes(extractedDataFromGemini.category)) {
                    console.warn(`Gemini returned invalid category: ${extractedDataFromGemini.category}. Defaulting to 'Other'.`);
                    extractedDataFromGemini.category = "Other";
                }

                // Handle date: if not provided or invalid from Gemini, use today's date
                const todayDate = getTodayDate();
                if (!extractedDataFromGemini.date || !/^\d{4}-\d{2}-\d{2}$/.test(extractedDataFromGemini.date)) {
                    console.log("Gemini date invalid or not provided. Falling back to today's date.");
                    extractedDataFromGemini.date = todayDate;
                } else {
                    console.log("Gemini date is valid.");
                }

                // Ensure amount is a number
                extractedDataFromGemini.amount = parseFloat(extractedDataFromGemini.amount);
                if (isNaN(extractedDataFromGemini.amount)) {
                    extractedDataFromGemini.amount = 0; // Default to 0 if amount is not a number
                }

                // Use the corrected transcript for the note, or fallback
                extractedDataFromGemini.note = extractedDataFromGemini.note || correctedTranscript || rawTranscript || "No clear transcription available.";

            } catch (err) {
                console.error("Error in Gemini processing steps (transcription, correction, extraction):", err);
                // Fallback data in case of any Gemini processing failure
                extractedDataFromGemini = {
                    type: "Expense",
                    amount: 0,
                    category: "Other",
                    date: getTodayDate(),
                    note: `Error processing audio: ${err.message}. Raw: ${rawTranscript}. Corrected: ${correctedTranscript}.`
                };
            }

            return res.status(200).json({
                originalTranscript: correctedTranscript, // Return corrected transcript to client
                extractedData: extractedDataFromGemini
            });

        }
        // --- SCENARIO 2: Handle Saving Edited Data to Notion ---
        else if (extractedData) {
            console.log("API received data for saving to Notion.");

            if (typeof extractedData.amount === 'undefined' || !extractedData.type || !extractedData.category || !extractedData.date || typeof extractedData.note === 'undefined') {
                return res.status(400).json({ error: "Invalid or incomplete transaction data provided for saving.", details: extractedData });
            }

            const amountToSave = parseFloat(extractedData.amount);
            if (isNaN(amountToSave)) {
                return res.status(400).json({ error: "Invalid amount provided for saving.", details: extractedData });
            }

            const notionProperties = {
                "Name": { title: [{ text: { content: extractedData.note || transcript || "Transaction" } }] },
                "Type": { select: { name: extractedData.type } },
                "Amount": { number: amountToSave },
                "Category": { select: { name: extractedData.category } },
                "Date": { date: { start: extractedData.date } },
            };

            console.log("Data to be sent to Notion:", notionProperties);

            const notionResponse = await notion.pages.create({
                parent: { database_id: NOTION_DATABASE_ID },
                properties: notionProperties,
            });
            console.log("Notion API response:", notionResponse);

            return res.status(200).json({ notionPageId: notionResponse.id, extractedData });

        }
        // --- SCENARIO 3: Invalid Request ---
        else {
            return res.status(400).json({ error: "Invalid request body. Missing audio for transcription or extractedData for saving." });
        }

    } catch (error) {
        console.error("API Error in voice-expense.js (outer catch):", error);
        res.status(500).json({ error: "Failed to process request.", details: error.message });
    }
}
