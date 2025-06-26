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
  const offset = today.getTimezoneOffset();
  const localDate = new Date(today.getTime() - (offset * 60 * 1000));
  const year = localDate.getFullYear();
  const month = String(localDate.getMonth() + 1).padStart(2, '0');
  const day = String(localDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Main handler for API route
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { audio, mimeType, transcript, extractedData } = req.body;

    // --- SCENARIO 1: Transcribe & Extract Data from Audio ---
    if (audio && mimeType) {
      console.log("API received English audio input.");
      const audioModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

      const audioPart = {
        inlineData: {
          data: audio,
          mimeType: mimeType,
        },
      };

      let rawTranscript = "";
      let extractedDataFromGemini = null;

      try {
        // Transcribe
        const transcriptionPrompt = "Transcribe the English audio.";
        const transcriptionResult = await audioModel.generateContent([transcriptionPrompt, audioPart]);
        rawTranscript = transcriptionResult.response.text();
        console.log("Transcript:", rawTranscript);

        // Extract Data
        const extractionPrompt = `You will be given English text describing an income or expense.

Extract the following fields and return them as a JSON object:
- "type": either "Income" or "Expense"
- "category": one of: ${validCategories.join(', ')}
- "amount": a number
- "date": in YYYY-MM-DD format (only include if mentioned explicitly)
- "note": a short description in English (can match the transcript)

Respond ONLY with the JSON object, no formatting or explanation.

Input: "${rawTranscript}"`;

        const extractionResult = await audioModel.generateContent([extractionPrompt]);
        let geminiOutputText = extractionResult.response.text();
        console.log("Gemini raw output:", geminiOutputText);

        // Clean JSON if wrapped in ```json ```
        const jsonMatch = geminiOutputText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch && jsonMatch[1]) {
          geminiOutputText = jsonMatch[1];
        } else {
          geminiOutputText = geminiOutputText.trim();
        }

        extractedDataFromGemini = JSON.parse(geminiOutputText);
        console.log("Parsed data:", extractedDataFromGemini);

        // Fallbacks & Validation
        if (!validTypes.includes(extractedDataFromGemini.type)) {
          console.warn(`Invalid type: ${extractedDataFromGemini.type}. Defaulting to 'Expense'.`);
          extractedDataFromGemini.type = "Expense";
        }
        if (!validCategories.includes(extractedDataFromGemini.category)) {
          console.warn(`Invalid category: ${extractedDataFromGemini.category}. Defaulting to 'Other'.`);
          extractedDataFromGemini.category = "Other";
        }

        const todayDate = getTodayDate();
        if (!extractedDataFromGemini.date || !/^\d{4}-\d{2}-\d{2}$/.test(extractedDataFromGemini.date)) {
          console.log("No valid date provided. Using today’s date.");
          extractedDataFromGemini.date = todayDate;
        }

        extractedDataFromGemini.amount = parseFloat(extractedDataFromGemini.amount);
        if (isNaN(extractedDataFromGemini.amount)) {
          extractedDataFromGemini.amount = 0;
        }

        extractedDataFromGemini.note = extractedDataFromGemini.note || rawTranscript || "No transcription available.";

      } catch (err) {
        console.error("Gemini error:", err);
        extractedDataFromGemini = {
          type: "Expense",
          amount: 0,
          category: "Other",
          date: getTodayDate(),
          note: `Error: ${err.message}. Transcript: ${rawTranscript}`
        };
      }

      return res.status(200).json({
        originalTranscript: rawTranscript,
        extractedData: extractedDataFromGemini
      });
    }

    // --- SCENARIO 2: Save Extracted Data to Notion ---
    else if (extractedData) {
      console.log("Saving parsed data to Notion...");

      if (
        typeof extractedData.amount === 'undefined' ||
        !extractedData.type || !extractedData.category ||
        !extractedData.date || typeof extractedData.note === 'undefined'
      ) {
        return res.status(400).json({ error: "Invalid or incomplete transaction data.", details: extractedData });
      }

      const amountToSave = parseFloat(extractedData.amount);
      if (isNaN(amountToSave)) {
        return res.status(400).json({ error: "Invalid amount." });
      }

      const notionProperties = {
        "Name": { title: [{ text: { content: extractedData.note || transcript || "Transaction" } }] },
        "Type": { select: { name: extractedData.type } },
        "Amount": { number: amountToSave },
        "Category": { select: { name: extractedData.category } },
        "Date": { date: { start: extractedData.date } },
      };

      const notionResponse = await notion.pages.create({
        parent: { database_id: NOTION_DATABASE_ID },
        properties: notionProperties,
      });

      return res.status(200).json({ notionPageId: notionResponse.id, extractedData });
    }

    // --- SCENARIO 3: Invalid ---
    else {
      return res.status(400).json({ error: "Invalid request. Provide audio or extractedData." });
    }

  } catch (error) {
    console.error("API Error:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
}
