// netlify/functions/gemini-proxy.js
// This function acts as a proxy to the Gemini API for scoring open-ended questions.
import fetch from 'node-fetch'; // 'node-fetch' is commonly available in Netlify Functions runtime

// Main function that Netlify will execute when this endpoint is called
exports.handler = async function(event, context) {
    // Ensure the request method is POST
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405, // Method Not Allowed
            body: JSON.stringify({ message: "Only POST requests are allowed." }),
            headers: { 'Content-Type': 'application/json' },
        };
    }

    // Ensure there's a request body
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
        const geminiPayload = {
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            // The responseMimeType is NOT set to application/json here
            // because the prompt explicitly asks Gemini to return a JSON string
            // as part of its text response (e.g., '{ "score": 0.75 }').
            // We want Gemini's *text* output to *contain* JSON.
            // If we set responseMimeType: "application/json" here, Gemini would
            // try to fit the entire response into a structured JSON object directly,
            // which can be more restrictive for natural language scoring.
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

        // Check for successful response from Gemini and return its content
        if (result.candidates && result.candidates.length > 0 &&
            result.candidates[0].content && result.candidates[0].content.parts &&
            result.candidates[0].content.parts.length > 0 &&
            result.candidates[0].content.parts[0].text) {
            
            // Return the raw text from Gemini, which should be a JSON string like "{ "score": 0.75 }"
            // The frontend will then parse this string.
            return {
                statusCode: 200,
                body: JSON.stringify({ success: true, response: result.candidates[0].content.parts[0].text }),
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
