import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Gemini client using environment variables
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Define valid types and categories for expense/income tracking.
// These are used for validation purposes on the server-side,
// ensuring Gemini's output adheres to predefined categories.
const validTypes = ["Income", "Expense"];
const validCategories = [
  "Food", "Transport", "Shopping", "Utilities", "Rent", "Salary",
  "Gift", "Entertainment", "Healthcare", "Education", "Other",
  "Mahar Unity", "Bavin"
];

// Helper function to get today's date in YYYY-MM-DD format.
// This is used as a fallback if Gemini does not provide a date.
function getTodayDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Main handler for the transcription and extraction API route
// This file is intended to handle the initial audio processing (transcription and data extraction)
// and return the data to the frontend for user review and editing.
// It does NOT save directly to Notion. That functionality is handled by 'save-transaction.js'.
export default async function handler(req, res) {
  // Only allow POST requests to this endpoint
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { audio, mimeType } = req.body;

    // Validate incoming audio and mimeType
    if (!audio || !mimeType) {
      return res.status(400).json({ error: "Audio and mimeType are required." });
    }

    // Get the Gemini-2.0-flash model for audio understanding and content generation
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // Prepare the audio part for the Gemini prompt as inline data
    const audioPart = {
      inlineData: {
        data: audio,
        mimeType: mimeType,
      },
    };

    // Define the prompt for Gemini.
    // It instructs Gemini to transcribe the audio and then extract structured JSON data.
    // The prompt explicitly asks Gemini to *only* include the date if mentioned in the audio,
    // otherwise, the date will be handled on the server-side.
    // It also asks for "note" which can serve as the default transaction title in Notion.
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

    // Generate content using Gemini model with the prompt and audio
    const result = await model.generateContent([prompt, audioPart]);
    const response = result.response;
    let geminiOutputText = response.text(); // Get the raw text output from Gemini

    let extractedData;
    let originalTranscript = ""; // Initialize original transcript

    try {
      // Robust JSON extraction using regex to handle potential markdown formatting from Gemini.
      // This regex captures content within optional ```json or ``` blocks.
      const jsonMatch = geminiOutputText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        geminiOutputText = jsonMatch[1]; // Use the captured content if markdown block found
      } else {
        geminiOutputText = geminiOutputText.trim(); // Otherwise, just trim whitespace
      }

      // Attempt to parse the extracted/cleaned JSON string
      extractedData = JSON.parse(geminiOutputText);

      // Validate the extracted type and category against predefined valid values.
      // This is crucial for preventing unexpected data in Notion.
      if (!validTypes.includes(extractedData.type)) {
        console.warn(`Gemini returned invalid type: ${extractedData.type}. Defaulting to 'Expense'.`);
        extractedData.type = "Expense"; // Fallback to a default valid type
      }
      if (!validCategories.includes(extractedData.category)) {
        console.warn(`Gemini returned invalid category: ${extractedData.category}. Defaulting to 'Other'.`);
        extractedData.category = "Other"; // Fallback to a default valid category
      }

      // If 'note' is available, use it as the original transcript.
      // If not, fall back to a generic message.
      originalTranscript = extractedData.note || "No clear transcription available.";

      // Date handling: If Gemini did not provide a valid date, use today's date.
      if (!extractedData.date || !/^\d{4}-\d{2}-\d{2}$/.test(extractedData.date)) {
        extractedData.date = getTodayDate();
      }

    } catch (err) {
      console.error("Failed to parse JSON from Gemini or process data. Raw output:", geminiOutputText, "Error:", err);
      // If parsing fails, create a default structure and indicate an error.
      // This allows the frontend to still display something for the user to edit.
      extractedData = {
        type: "Expense",
        amount: 0,
        category: "Other",
        date: getTodayDate(),
        note: "Error transcribing or extracting. Please edit manually."
      };
      originalTranscript = `Error: ${err.message}. Raw Gemini output: ${geminiOutputText}`;
    }

    // Send the original transcript and extracted data back to the frontend.
    // This allows the user to review and edit before saving to Notion.
    res.status(200).json({ originalTranscript, extractedData });

  } catch (error) {
    console.error("API Error in voice-expense.js:", error);
    // Return a generic error message for security and user experience.
    res.status(500).json({ error: "Failed to process audio for transcription and extraction.", details: error.message });
  }
}
