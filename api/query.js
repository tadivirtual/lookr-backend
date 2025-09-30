// Lookr.ai Backend API - Vercel Serverless Function
// File: api/query.js

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { question, siteKey, url } = req.body;

    if (!question || !siteKey) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // 1. Validate site key and check rate limits
    const siteData = await validateSiteKey(siteKey, req.headers.origin || url);
    
    if (!siteData.valid) {
      return res.status(401).json({ error: 'Invalid site key' });
    }

    if (siteData.limitExceeded) {
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }

    // 2. Get website content (from cache or scrape)
    const websiteContent = await getWebsiteContent(siteData.websiteUrl);

    // 3. Call Gemini AI with context
    const answer = await getAIAnswer(question, websiteContent);

    // 4. Log the query (for analytics)
    await logQuery(siteData.id, question, answer);

    // 5. Return response
    return res.status(200).json({
      answer: answer,
      success: true
    });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

// ============================================
// Helper Functions
// ============================================

// Validate site key and check permissions
async function validateSiteKey(siteKey, origin) {
  // TODO: Connect to Supabase
  // For now, mock validation
  
  // In production, this would:
  // 1. Query Supabase for site by siteKey
  // 2. Check if origin domain matches allowed_domains
  // 3. Check query count vs limit
  // 4. Return site data
  
  // Mock response for development
  return {
    valid: true,
    limitExceeded: false,
    id: 'site_123',
    websiteUrl: extractDomain(origin),
    queryLimit: 1000,
    queryCount: 50
  };
}

// Get website content (from cache or fresh scrape)
async function getWebsiteContent(websiteUrl) {
  // TODO: Check Supabase for cached content
  // If cache is fresh (<7 days), return it
  // Otherwise, scrape the site
  
  // For now, return mock content
  return {
    pages: [
      {
        url: websiteUrl,
        title: 'Homepage',
        content: 'Welcome to our website. We offer AI-powered search solutions for businesses. Our pricing starts at $9/month for unlimited sites. We provide 24/7 support and easy integration.'
      }
    ]
  };
}

// Call Gemini AI with context
async function getAIAnswer(question, websiteContent) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  // Prepare context from website content
  const context = websiteContent.pages
    .map(page => page.content)
    .join('\n\n');

  // Build prompt
  const prompt = `You are a helpful AI assistant for a website. Answer the user's question based ONLY on the following website content. If the answer is not in the content, politely say you don't have that information.

Website Content:
${context}

User Question: ${question}

Answer (be concise, helpful, and friendly):`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 500,
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Gemini API error: ${data.error?.message || 'Unknown error'}`);
    }

    // Extract answer from Gemini response
    const answer = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!answer) {
      throw new Error('No answer generated');
    }

    return answer.trim();

  } catch (error) {
    console.error('Gemini API error:', error);
    
    // Fallback response
    return "I'm sorry, I'm having trouble accessing the AI right now. Please try again in a moment or contact support if the issue persists.";
  }
}

// Log query for analytics
async function logQuery(siteId, question, answer) {
  // TODO: Log to Supabase
  // Insert into queries table with:
  // - site_id
  // - question
  // - answer
  // - timestamp
  // - response_time
  
  console.log('Query logged:', { siteId, question: question.substring(0, 50) });
}

// Extract domain from URL
function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return url;
  }
}
