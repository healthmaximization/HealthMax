// netlify/functions/gemini-proxy.js
/**
 * Dit is een Netlify Serverless Function die fungeert als een proxy
 * voor aanvragen aan de Google Gemini API.
 * Het voorkomt blootstelling van de API-sleutel aan de client-side
 * en omzeilt eventuele CORS-beperkingen.
 */
exports.handler = async (event) => {
    // 1. Controleer de HTTP-methode
    // Deze functie accepteert alleen POST-aanvragen.
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405, // Methode niet toegestaan
            body: JSON.stringify({ success: false, message: 'Method Not Allowed. Only POST requests are supported.' }),
            headers: { "Content-Type": "application/json" }
        };
    }

    let requestBody;
    try {
        // 2. Parse de aanvraagbody
        // De aanvraagbody wordt verwacht als een JSON-string.
        requestBody = JSON.parse(event.body);
    } catch (error) {
        console.error("Error parsing request body:", error);
        return {
            statusCode: 400, // Slechte aanvraag
            body: JSON.stringify({ success: false, message: 'Invalid JSON in request body.' }),
            headers: { "Content-Type": "application/json" }
        };
    }

    // 3. Controleer op de aanwezigheid van de 'prompt' in de body
    // De client-side code stuurt een object met een 'prompt' property.
    const { prompt } = requestBody;
    if (!prompt) {
        return {
            statusCode: 400, // Slechte aanvraag
            body: JSON.stringify({ success: false, message: 'Missing "prompt" in request body.' }),
            headers: { "Content-Type": "application/json" }
        };
    }

    // 4. Haal de Gemini API-sleutel op uit de Netlify omgevingsvariabelen
    // BELANGRIJK: Zorg ervoor dat je deze variabele instelt in je Netlify site-instellingen.
    // Ga naar: Site settings -> Build & deploy -> Environment variables
    // Voeg een nieuwe variabele toe: KEY = GEMINI_API_KEY, VALUE = jouw Gemini API-sleutel
    const apiKey = process.env.GEMINI_API_KEY; 
    if (!apiKey) {
        console.error("GEMINI_API_KEY environment variable is not set.");
        return {
            statusCode: 500, // Interne serverfout
            body: JSON.stringify({ success: false, message: 'Server configuration error: Gemini API Key is not set.' }),
            headers: { "Content-Type": "application/json" }
        };
    }

    // 5. Definieer het Gemini API-eindpunt
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

    try {
        // 6. Bereid de payload voor de Gemini API-aanvraag voor
        // De structuur moet overeenkomen met wat de Gemini API verwacht.
        const payload = {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                responseMimeType: "application/json", // Vraag JSON-output aan
                maxOutputTokens: 4096 // Limiet voor de lengte van het antwoord
            }
        };

        // 7. Voer de aanroep naar de Gemini API uit
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json(); // Parse de respons van Gemini

        // 8. Controleer op succesvolle respons van de Gemini API
        if (response.ok && result.candidates && result.candidates.length > 0 && 
            result.candidates[0].content && result.candidates[0].content.parts && 
            result.candidates[0].content.parts.length > 0) {
            
            // Haal de gegenereerde tekst op
            const aiText = result.candidates[0].content.parts[0].text;

            // Stuur een succesrespons terug naar de client
            return {
                statusCode: 200,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ success: true, response: aiText })
            };
        } else {
            // Log de fout en stuur een passende foutrespons terug
            console.error("Gemini API response error or unexpected format:", result);
            return {
                statusCode: response.status || 500, // Gebruik de status van Gemini of 500
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ success: false, message: result.error?.message || 'Unexpected response from Gemini API.' })
            };
        }
    } catch (error) {
        // Vang netwerkfouten of andere uitzonderingen op tijdens de aanroep
        console.error("Error in Netlify function calling Gemini API:", error);
        return {
            statusCode: 500, // Interne serverfout
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ success: false, message: error.message || 'Internal Server Error during API call.' })
        };
    }
};
