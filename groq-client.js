// Use local config for development if it exists, otherwise use deployment placeholders.
const GROQ_API_KEY = window.localConfig?.GROQ_API_KEY || '__GROQ_API_KEY__';

// Check if the key has been replaced. A simple check to see if the placeholder is still there.
if (GROQ_API_KEY.startsWith('__')) {
  console.warn('Groq API key is not set. AI features will be disabled. Please add the GROQ_API_KEY secret to your GitHub repository settings or create a local-secrets.js file.');
}

const groq = new Groq({
  apiKey: GROQ_API_KEY,
  // This is necessary for using the SDK in a browser environment
  dangerouslyAllowBrowser: true
});

/**
 * Sends a chat message to the Groq API.
 * @param {string} messageContent The content of the user's message.
 * @returns {Promise<string>} The assistant's response.
 */
async function getGroqChatCompletion(messageContent) {
  if (GROQ_API_KEY.startsWith('__')) {
    return "AI features are disabled because the Groq API key has not been configured for this deployment.";
  }

  console.log('Sending chat completion request to Groq...');
  try {
    const chatCompletion = await groq.chat.completions.create({
      "messages": [
        { "role": "user", "content": messageContent }
      ],
      "model": "llama3-8b-8192"
    });

    const response = chatCompletion.choices[0]?.message?.content || "No response from Groq.";
    console.log('Groq response received.');
    return response;
  } catch (error) {
    console.error("Error fetching from Groq API:", error);
    // Re-throw the error so the calling function can handle it and display a more specific message.
    throw error;
  }
}