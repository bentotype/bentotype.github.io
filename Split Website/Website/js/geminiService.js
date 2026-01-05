const GEMINI_API_KEY = "AIzaSyDoXcvx1AzyvXMGxUi8-3RDMUwaVRWWaaU";

export async function scanReceipt(file) {
    if (!file) throw new Error("No file provided");

    // Convert to Base64
    const base64Data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            // Remove data URL prefix (e.g. "data:image/jpeg;base64,")
            const result = reader.result;
            const base64 = result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });

    const prompt = `
  Analyze this receipt image. Extract items with their prices.
  Ignore subtotal, tax, and total lines.
  Return ONLY valid JSON in this format:
  {
    "items": [
      { "name": "Item Name", "price": 10.99 }
    ]
  }
  `;

    const body = {
        contents: [{
            parts: [
                { text: prompt },
                { inline_data: { mime_type: file.type || "image/jpeg", data: base64Data } }
            ]
        }]
    };

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini API Error: ${errText}`);
    }

    const json = await response.json();
    const candidate = json.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidate) throw new Error("No text returned from Gemini");

    // Clean markdown code blocks if present
    const cleanJson = candidate.replace(/```json/g, "").replace(/```/g, "").trim();

    try {
        const result = JSON.parse(cleanJson);
        return result.items || [];
    } catch (e) {
        console.error("Failed to parse Gemini JSON", cleanJson);
        throw new Error("Failed to parse receipt data");
    }
}
