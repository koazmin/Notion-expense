import { GoogleGenerativeAI } from "@google/generative-ai";
import { Client as NotionClient } from "@notionhq/client";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const notion = new NotionClient({ auth: process.env.NOTION_API_KEY });
const NOTION_DATABASE_ID = process.env.NOTION_EXPENSE_DATABASE_ID;

const validTypes = ["Income", "Expense"];
const validCategories = [
  "Food", "Transport", "Shopping", "Utilities", "Rent", "Salary",
  "Gift", "Entertainment", "Healthcare", "Education", "Other",
  "Mahar Unity", "Bavin"
];

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { audio, mimeType } = req.body;

    if (!audio || !mimeType) {
      return res.status(400).json({ error: "Audio and mimeType are required." });
    }

    // Use gemini-2.0-flash model here
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
- "category": choose only one from: Food, Transport, Shopping, Utilities, Rent, Salary, Gift, Entertainment, Healthcare, Education, Other, Mahar Unity, Bavin
- "amount": number (e.g. 15000)
- "date": format as YYYY-MM-DD (if not found, use today's date)
- "note": short description in Burmese

Respond with only the JSON object in this format:
{
  "type": "Expense",
  "amount": 15000,
  "category": "Food",
  "date": "2025-06-24",
  "note": "နံနက်စာအတွက်"
}`;

    const result = await model.generateContent([prompt, audioPart]);
    const response = result.response;
    const outputText = response.text();

    let expenseData;
    try {
      expenseData = JSON.parse(outputText);
    } catch (err) {
      console.error("Failed to parse JSON from Gemini:", outputText);
      return res.status(500).json({ error: "Gemini response was not valid JSON.", details: outputText });
    }

    if (!validTypes.includes(expenseData.type) || !validCategories.includes(expenseData.category)) {
      return res.status(400).json({ error: "Invalid type or category.", details: expenseData });
    }

    // Save to Notion
    const notionResponse = await notion.pages.create({
      parent: { database_id: NOTION_DATABASE_ID },
      properties: {
        "Name": { title: [{ text: { content: expenseData.note || "Expense" } }] },
        "Type": { select: { name: expenseData.type } },
        "Amount": { number: expenseData.amount },
        "Category": { select: { name: expenseData.category } },
        "Date": { date: { start: expenseData.date } },
      },
    });

    res.status(200).json({ notionPageId: notionResponse.id, data: expenseData });
  } catch (error) {
    console.error("API Error:", error);
    res.status(500).json({ error: "Failed to process request.", details: error.message });
  }
}
