import { Client as NotionClient } from "@notionhq/client";

// Initialize Notion client using environment variables
const notion = new NotionClient({ auth: process.env.NOTION_API_KEY });
const NOTION_DATABASE_ID = process.env.NOTION_EXPENSE_DATABASE_ID;

// Main handler for saving transaction data to Notion
export default async function handler(req, res) {
  // Only allow POST requests to this endpoint
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    // Destructure the expected data from the request body.
    // This data is expected to be already extracted and potentially edited by the user on the frontend.
    const { transcript, extractedData } = req.body;

    // Basic validation of the incoming data structure
    if (!extractedData || typeof extractedData.amount === 'undefined' || !extractedData.type || !extractedData.category || !extractedData.date || typeof extractedData.note === 'undefined') {
      return res.status(400).json({ error: "Invalid or incomplete transaction data provided.", details: extractedData });
    }

    // Prepare data for Notion API call
    // The "Name" property is typically the title in Notion, using the note or transcript as fallback.
    // Other properties are directly mapped from the extractedData.
    const notionProperties = {
      "Name": { title: [{ text: { content: extractedData.note || transcript || "Transaction" } }] },
      "Type": { select: { name: extractedData.type } },
      "Amount": { number: parseFloat(extractedData.amount) }, // Ensure amount is a number
      "Category": { select: { name: extractedData.category } },
      "Date": { date: { start: extractedData.date } },
    };

    // Add notes only if present and not empty, to avoid creating empty text properties if not needed
    if (extractedData.note && extractedData.note.trim() !== '') {
        // You might consider adding a separate "Notes" rich_text property in your Notion database
        // if 'note' is meant to be a longer description separate from the title.
        // For simplicity, it's currently used as the title and could be appended to "Notes" if a Notion prop exists.
        // For now, we'll ensure 'Name' always has content and assume 'note' populates it.
    }


    // Create a new page (entry) in the specified Notion database
    const notionResponse = await notion.pages.create({
      parent: { database_id: NOTION_DATABASE_ID },
      properties: notionProperties,
    });

    // Send a success response with the Notion page ID and the data that was saved.
    res.status(200).json({ notionPageId: notionResponse.id, extractedData });

  } catch (error) {
    console.error("API Error in save-transaction:", error);
    // Return a generic error message for security and user experience.
    res.status(500).json({ error: "Failed to save transaction to Notion.", details: error.message });
  }
}
