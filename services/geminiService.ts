import { GoogleGenAI } from "@google/genai";
import { RouteStep } from '../types';

export const optimizeRoute = async (
  startAddress: string,
  deliveryAddresses: string[],
  userLocation: { latitude: number; longitude: number } | null,
  isRoundTrip: boolean
): Promise<{ route: RouteStep[]; groundingChunks: any[]; totalTravelTime: string }> => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const addressList = deliveryAddresses.map((addr, index) => `${index + 1}. ${addr}`).join('\n');
  
  const finalStopInstruction = isRoundTrip
    ? "The final stop should be back at the warehouse."
    : "The final stop should be the last delivery address.";

  const prompt = `
    You are a logistics and route optimization expert for delivery services in Sydney, Australia.
    Your task is to determine the most efficient, shortest-distance driving route and estimate travel times based on real-time data.

    Start Point (Warehouse): ${startAddress}
    Delivery Destinations:
    ${addressList}

    Please provide the most optimal route as a sequence of stops. The route must start at the warehouse. ${finalStopInstruction}

    Return the result as a single JSON object with two keys: "route" and "totalTravelTime".
    - The "route" key should contain an array of objects, where each object represents a stop in the route and has the following structure:
      - "stop": A number representing the order of the stop (e.g., 1, 2, 3...).
      - "address": The full address of the stop.
      - "instructions": Brief, clear driving instructions to get to this stop from the previous one. For the first stop, the instructions should be from the warehouse.
      - "travelTimeFromPrevious": A string representing the estimated travel time *from the previous stop* (e.g., "15 minutes"). For the first stop (from the warehouse), this should be a valid time.
    - The "totalTravelTime" key should contain a string estimating the total driving time for the entire route (e.g., "2 hours 45 minutes").

    Example format:
    {
      "route": [
        { "stop": 1, "address": "Warehouse, 123 Industrial Rd, Sydney NSW 2000", "instructions": "Start of the route.", "travelTimeFromPrevious": "0 minutes" },
        { "stop": 2, "address": "456 Customer Ave, Sydney NSW 2000", "instructions": "Head north on Industrial Rd, turn right on Main St.", "travelTimeFromPrevious": "12 minutes" }
      ],
      "totalTravelTime": "1 hour 30 minutes"
    }
    Do not include any text, notes, or explanations outside of the JSON object.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleMaps: {} }],
        toolConfig: userLocation ? {
          retrievalConfig: {
            latLng: {
              latitude: userLocation.latitude,
              longitude: userLocation.longitude
            }
          }
        } : undefined,
      },
    });

    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    // Clean the response text to extract only the JSON part
    let jsonString = response.text.trim();
    const jsonStart = jsonString.indexOf('{');
    const jsonEnd = jsonString.lastIndexOf('}');
    
    if (jsonStart !== -1 && jsonEnd !== -1) {
      jsonString = jsonString.substring(jsonStart, jsonEnd + 1);
    } else {
      throw new Error("Invalid JSON response from API.");
    }
    
    const parsedResponse = JSON.parse(jsonString);
    if (!parsedResponse.route || !Array.isArray(parsedResponse.route)) {
        throw new Error("API response is missing the 'route' array.");
    }
    if (!parsedResponse.totalTravelTime || typeof parsedResponse.totalTravelTime !== 'string') {
        throw new Error("API response is missing the 'totalTravelTime' string.");
    }
    parsedResponse.route.forEach((step: any, index: number) => {
        if (typeof step.travelTimeFromPrevious !== 'string') {
            throw new Error(`Route step ${index + 1} is missing 'travelTimeFromPrevious'.`);
        }
    });
    
    return { route: parsedResponse.route, groundingChunks, totalTravelTime: parsedResponse.totalTravelTime };

  } catch (error) {
    console.error("Error calling Gemini API:", error);
    if (error instanceof Error) {
        throw new Error(`Failed to optimize route: ${error.message}`);
    }
    throw new Error("An unknown error occurred while optimizing the route.");
  }
};