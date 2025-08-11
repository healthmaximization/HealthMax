// netlify/functions/gemini-proxy.js
import fetch from 'node-fetch'; // 'node-fetch' is commonly available in Netlify Functions runtime

// This is the main function that Netlify will execute when your endpoint is called
exports.handler = async function(event, context) {
    // Check if the request method is POST
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405, // Method Not Allowed
            body: JSON.stringify({ message: "Only POST requests are allowed." }),
            headers: { 'Content-Type': 'application/json' },
        };
    }

    // Ensure there's a body to parse
    if (!event.body) {
        return {
            statusCode: 400, // Bad Request
            body: JSON.stringify({ message: "Request body is missing." }),
            headers: { 'Content-Type': 'application/json' },
        };
    }

    try {
        // Parse the request body coming from your frontend
        const requestBody = JSON.parse(event.body);
        const { prompt } = requestBody; // Assuming your frontend sends { prompt: "..." }

        // Get your API key securely from Netlify environment variables
        // This variable name must match the one you set in Netlify dashboard
        const geminiApiKey = process.env.GEMINI_API_KEY; 

        if (!geminiApiKey) {
            console.error("GEMINI_API_KEY is not set in Netlify environment variables.");
            return {
                statusCode: 500,
                body: JSON.stringify({ message: "Server configuration error: API key missing." }),
                headers: { 'Content-Type': 'application/json' },
            };
        }

        // Prepare the payload for the Gemini API call
        // Explicitly tell Gemini to return raw JSON without markdown formatting
        const geminiPayload = {
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
                responseMimeType: "application/json", // This hints to Gemini to return JSON
                maxOutputTokens: 4096 
            }
        };

        // Construct the Gemini API URL
        const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${geminiApiKey}`;

        // Make the call to the Gemini API
        const response = await fetch(geminiApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(geminiPayload)
        });

        const result = await response.json();

        // Check for successful response from Gemini
        if (result.candidates && result.candidates.length > 0 &&
            result.candidates[0].content && result.candidates[0].content.parts &&
            result.candidates[0].content.parts.length > 0 &&
            result.candidates[0].content.parts[0].text) {
            
            let aiResponseText = result.candidates[0].content.parts[0].text;
            
            // --- NEW: Strip markdown code block wrappers ---
            // Example: "```json\n{ \"score\": 0.75 }\n```" -> "{ \"score\": 0.75 }"
            const jsonStartMarker = '```json';
            const jsonEndMarker = '```';

            if (aiResponseText.startsWith(jsonStartMarker)) {
                aiResponseText = aiResponseText.substring(jsonStartMarker.length);
            }
            if (aiResponseText.endsWith(jsonEndMarker)) {
                aiResponseText = aiResponseText.substring(0, aiResponseText.length - jsonEndMarker.length);
            }
            aiResponseText = aiResponseText.trim(); // Trim any remaining whitespace/newlines
            // --- END NEW ---

            return {
                statusCode: 200,
                // Return the cleaned JSON string
                body: JSON.stringify({ success: true, response: aiResponseText }),
                headers: { 'Content-Type': 'application/json' },
            };
        } else {
            console.error("Unexpected Gemini API response structure:", result);
            return {
                statusCode: 500,
                body: JSON.stringify({ message: "Failed to get a valid response from Gemini API.", details: result }),
                headers: { 'Content-Type': 'application/json' },
            };
        }

    } catch (error) {
        console.error("Error in Netlify function:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: "Internal server error.", error: error.message }),
            headers: { 'Content-Type': 'application/json' },
        };
    }
};
