import { GoogleGenerativeAI } from "@google/generative-ai";
import { Client as NotionClient } from "@notionhq/client";

// Initialize Gemini and Notion clients using environment variables
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const notion = new NotionClient({ auth: process.env.NOTION_API_KEY });
const NOTION_DATABASE_ID = process.env.NOTION_EXPENSE_DATABASE_ID;

// Define valid types and categories for expense/income tracking
const validTypes = ["Income", "Expense"];
const validCategories = [
  "Food", "Transport", "Shopping", "Utilities", "Rent", "Salary",
  "Gift", "Entertainment", "Healthcare", "Education", "Other",
  "Mahar Unity", "Bavin"
];

// Helper function to get today's date in YYYY-MM-DD format
function getTodayDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Main handler for the API route
export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { audio, mimeType } = req.body;

    // Validate incoming audio and mimeType
    if (!audio || !mimeType) {
      return res.status(400).json({ error: "Audio and mimeType are required." });
    }

    // Get the Gemini-2.0-flash model for content generation
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // Prepare the audio part for the Gemini prompt
    const audioPart = {
      inlineData: {
        data: audio,
        mimeType: mimeType,
      },
    };

    // Define the prompt for Gemini, instructing it to transcribe and extract JSON
    // The prompt now explicitly states to *only* include the date if mentioned.
    const prompt = `You will be given Burmese audio that describes either an income or an expense.
First, transcribe the audio in Burmese. Then extract and return the following fields as JSON.

Only use the following values for each field:

- "type": must be either "Income" or "Expense"
- "category": choose only one from: Food, Transport, Shopping, Utilities, Rent, Salary, Gift, Entertainment, Healthcare, Education, Other, Mahar Unity, Bavin
- "amount": number (e.g. 15000)
- "date": format as YYYY-MM-DD. ONLY include this field if a date is explicitly mentioned in the audio. Do NOT infer or use today's date if it's not mentioned.
- "note": short description in Burmese

Respond with only the JSON object in this format, do not include any additional text or markdown formatting around the JSON:
{
  "type": "Expense",
  "amount": 15000,
  "category": "Food",
  "date": "2025-06-24", // Example date if explicitly mentioned
  "note": "နံနက်စာအတွက်"
}`;

    // Generate content using Gemini model with the prompt and audio
    const result = await model.generateContent([prompt, audioPart]);
    const response = result.response;
    let outputText = response.text(); // Get the raw text output from Gemini

    let expenseData;
    try {
      // REGEX to extract JSON:
      // It looks for an optional markdown code block start (```json or ```)
      // then captures any characters (non-greedy) until an optional markdown code block end (```)
      const jsonMatch = outputText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        // If markdown block found, use the captured content
        outputText = jsonMatch[1];
      } else {
        // If no markdown block, try to clean up leading/trailing whitespace
        outputText = outputText.trim();
      }

      // Attempt to parse the extracted/cleaned JSON string
      expenseData = JSON.parse(outputText);
    } catch (err) {
      console.error("Failed to parse JSON from Gemini. Raw output:", outputText);
      return res.status(500).json({ error: "Gemini response was not valid JSON or contained unexpected characters.", details: outputText });
    }

    // --- NEW DATE HANDLING LOGIC ---
    // Validate the date. If not present or invalid, set to today's date.
    if (!expenseData.date || !/^\d{4}-\d{2}-\d{2}$/.test(expenseData.date)) {
      expenseData.date = getTodayDate();
    }
    // --- END NEW DATE HANDLING LOGIC ---

    // Validate the extracted type and category against predefined valid values
    if (!validTypes.includes(expenseData.type) || !validCategories.includes(expenseData.category)) {
      return res.status(400).json({ error: "Invalid type or category received from Gemini.", details: expenseData });
    }

    // Save the extracted data to Notion
    const notionResponse = await notion.pages.create({
      parent: { database_id: NOTION_DATABASE_ID },
      properties: {
        "Name": { title: [{ text: { content: expenseData.note || (expenseData.type === "Income" ? "Income" : "Expense") } }] },
        "Type": { select: { name: expenseData.type } },
        "Amount": { number: expenseData.amount },
        "Category": { select: { name: expenseData.category } },
        "Date": { date: { start: expenseData.date } },
      },
    });

    // Send success response with Notion page ID and parsed data
    res.status(200).json({ notionPageId: notionResponse.id, data: expenseData });
  } catch (error) {
    console.error("API Error:", error);
    // Send error response
    res.status(500).json({ error: "Failed to process request.", details: error.message });
  }
}
