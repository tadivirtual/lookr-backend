// Lookr.ai Backend API - Vercel Serverless Function
// File: api/query.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

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
    const websiteContent = await getWebsiteContent(siteKey);

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
  // Query Supabase for site
  const { data: site, error } = await supabase
    .from('sites')
    .select('*')
    .eq('site_key', siteKey)
    .single();

  if (error || !site) {
    return { valid: false };
  }

  // Check domain if origin provided
  if (origin) {
    const originDomain = extractDomain(origin);
    const allowed = site.allowed_domains || [];
    
    const domainMatches = allowed.some(domain => 
      originDomain === domain || originDomain.endsWith('.' + domain)
    );

    if (!domainMatches) {
      console.log(`Domain mismatch: ${originDomain} not in ${allowed}`);
      return { valid: false };
    }
  }

  // Check rate limit
  const limitExceeded = site.query_count >= site.query_limit;

  return {
    valid: true,
    limitExceeded,
    id: site.id,
    websiteUrl: site.website_url,
    queryLimit: site.query_limit,
    queryCount: site.query_count
  };
}

// Get website content (from cache or fresh scrape)
async function getWebsiteContent(siteKey) {
  const { data: site, error } = await supabase
    .from('sites')
    .select('content_cache')
    .eq('site_key', siteKey)
    .single();

  if (error || !site) {
    throw new Error('Site not found');
  }

  if (!site.content_cache || !site.content_cache.pages) {
    throw new Error('No content available. Please scrape the website first.');
  }

  return site.content_cache;
}

// Call Gemini AI with context
async function getAIAnswer(question, websiteContent) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

console.log('API Key exists:', !!GEMINI_API_KEY);
console.log('API Key length:', GEMINI_API_KEY?.length);
console.log('API Key starts with:', GEMINI_API_KEY?.substring(0, 10));

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
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
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
  try {
    // Log query
    await supabase.from('queries').insert({
      site_id: siteId,
      question,
      answer,
      response_time: 0
    });

    // Increment query count
    const { data: site } = await supabase
      .from('sites')
      .select('query_count')
      .eq('id', siteId)
      .single();
    
    if (site) {
      await supabase
        .from('sites')
        .update({ query_count: site.query_count + 1 })
        .eq('id', siteId);
    }
    
  } catch (error) {
    console.error('Failed to log query:', error);
  }
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
