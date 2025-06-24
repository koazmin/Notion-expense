import { GoogleGenerativeAI } from "@google/generative-ai";
import { Client as NotionClient } from "@notionhq/client";

// Initialize Gemini and Notion clients using environment variables
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const notion = new NotionClient({ auth: process.env.NOTION_API_KEY });
const NOTION_DATABASE_ID = process.env.NOTION_EXPENSE_DATABASE_ID;

// Define valid types and categories for expense/income tracking.
// These are used for validation purposes.
const validTypes = ["Income", "Expense"];
const validCategories = [
  "Food", "Transport", "Shopping", "Utilities", "Rent", "Salary",
  "Gift", "Entertainment", "Healthcare", "Education", "Other",
  "Mahar Unity", "Bavin"
];

// Helper function to get today's date in YYYY-MM-DD format.
// This is critical for consistent date representation.
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
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      const audioPart = {
        inlineData: {
          data: audio,
          mimeType: mimeType,
        },
      };

      const prompt = `You will be given Burmese audio that describes either an income or an expense.
First, transcribe the audio in Burmese. Then extract and return the following fields as JSON.

Only use the following values for each field:

- "type": must be either "Income" or "Expense"
- "category": choose only one from: ${validCategories.join(', ')}
- "amount": number (e.g. 15000)
- "date": format as YYYY-MM-DD. ONLY include this field if a date is explicitly mentioned in the audio. Do NOT infer or use today's date if it's not mentioned.
- "note": short description in Burmese, capturing the essence of the transaction. This can also serve as the original transcription of the audio.

Respond with ONLY the JSON object in this format. Do not include any additional text or markdown formatting around the JSON (e.g., no \`\`\`json\`\`\`):
{
  "type": "Expense",
  "amount": 15000,
  "category": "Food",
  "date": "2025-06-24", // Example date if explicitly mentioned
  "note": "နံနက်စာအတွက်"
}`;

      const result = await model.generateContent([prompt, audioPart]);
      const response = result.response;
      let geminiOutputText = response.text();
      console.log("Gemini raw output:", geminiOutputText); // Log raw output from Gemini

      let extractedDataFromGemini;
      let originalTranscriptFromGemini = "";

      try {
        const jsonMatch = geminiOutputText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch && jsonMatch[1]) {
          geminiOutputText = jsonMatch[1];
        } else {
          geminiOutputText = geminiOutputText.trim();
        }

        extractedDataFromGemini = JSON.parse(geminiOutputText);
        console.log("Extracted data after JSON parse:", extractedDataFromGemini);

        if (!validTypes.includes(extractedDataFromGemini.type)) {
          console.warn(`Gemini returned invalid type: ${extractedDataFromGemini.type}. Defaulting to 'Expense'.`);
          extractedDataFromGemini.type = "Expense";
        }
        if (!validCategories.includes(extractedDataFromGemini.category)) {
          console.warn(`Gemini returned invalid category: ${extractedDataFromGemini.category}. Defaulting to 'Other'.`);
          extractedDataFromGemini.category = "Other";
        }

        originalTranscriptFromGemini = extractedDataFromGemini.note || "No clear transcription available.";

        // --- ENHANCED DATE HANDLING ---
        const todayDate = getTodayDate(); // Get current date once
        console.log("Today's date (server-side):", todayDate);
        console.log("Date extracted from Gemini (before validation):", extractedDataFromGemini.date);

        // Validate if the date exists and matches the YYYY-MM-DD format
        if (!extractedDataFromGemini.date || !/^\d{4}-\d{2}-\d{2}$/.test(extractedDataFromGemini.date)) {
            console.log("Gemini date invalid or not provided. Falling back to today's date.");
            extractedDataFromGemini.date = todayDate;
        } else {
            // Optional: You might want to parse and re-format the date from Gemini
            // to ensure it's strictly YYYY-MM-DD, even if Gemini provides it slightly differently.
            // For now, if it matches the regex, we assume it's good.
            console.log("Gemini date is valid.");
        }
        console.log("Final date after processing:", extractedDataFromGemini.date);
        // --- END ENHANCED DATE HANDLING ---

      } catch (err) {
        console.error("Failed to parse JSON from Gemini or process data. Raw output:", geminiOutputText, "Error:", err);
        extractedDataFromGemini = {
          type: "Expense",
          amount: 0,
          category: "Other",
          date: getTodayDate(), // Fallback for entire parsing failure
          note: "Error transcribing or extracting. Please edit manually."
        };
        originalTranscriptFromGemini = `Error: ${err.message}. Raw Gemini output: ${geminiOutputText}`;
      }

      return res.status(200).json({ originalTranscript: originalTranscriptFromGemini, extractedData: extractedDataFromGemini });

    }
    // --- SCENARIO 2: Handle Saving Edited Data to Notion ---
    else if (extractedData) {
      console.log("API received data for saving to Notion.");
      // `transcript` is also passed for potential use in the Notion "Name" field.

      // Basic validation of the incoming data structure
      if (typeof extractedData.amount === 'undefined' || !extractedData.type || !extractedData.category || !extractedData.date || typeof extractedData.note === 'undefined') {
        return res.status(400).json({ error: "Invalid or incomplete transaction data provided for saving.", details: extractedData });
      }

      // Ensure the amount is a valid number, even if it comes from a text input
      const amountToSave = parseFloat(extractedData.amount);
      if (isNaN(amountToSave)) {
          return res.status(400).json({ error: "Invalid amount provided for saving.", details: extractedData });
      }

      // Prepare data for Notion API call
      const notionProperties = {
        "Name": { title: [{ text: { content: extractedData.note || transcript || "Transaction" } }] },
        "Type": { select: { name: extractedData.type } },
        "Amount": { number: amountToSave },
        "Category": { select: { name: extractedData.category } },
        "Date": { date: { start: extractedData.date } },
      };

      console.log("Data to be sent to Notion:", notionProperties); // Log data before sending to Notion

      // Create a new page (entry) in the specified Notion database
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
