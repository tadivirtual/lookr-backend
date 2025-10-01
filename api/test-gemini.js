export default async function handler(req, res) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  
  // Test 1: List available models
  const listResponse = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`
  );
  const models = await listResponse.json();
  
  console.log('Available models:', JSON.stringify(models, null, 2));
  
  return res.json({ models });
}
