// Lookr.ai Analytics API
// File: api/get-analytics.js
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

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { siteKey } = req.body;

    if (!siteKey) {
      return res.status(400).json({ error: 'Missing site key' });
    }

    // 1. Validate site key and check tier
    const { data: site, error: siteError } = await supabase
      .from('sites')
      .select('*')
      .eq('site_key', siteKey)
      .single();

    if (siteError || !site) {
      return res.status(401).json({ error: 'Invalid site key' });
    }

    // 2. Check if tier allows analytics (Pro or Business only)
    if (site.tier === 'starter') {
      return res.status(403).json({ 
        error: 'Analytics only available for Pro and Business tiers',
        upgrade: true
      });
    }

    // 3. Get analytics data
    const { data: queries, error: queryError } = await supabase
      .from('queries')
      .select('*')
      .eq('site_id', site.id)
      .order('created_at', { ascending: false })
      .limit(100);

    if (queryError) {
      throw queryError;
    }

    // 4. Calculate stats
    const totalQueries = site.query_count || 0;
    const queriesThisMonth = queries.filter(q => {
      const queryDate = new Date(q.created_at);
      const now = new Date();
      return queryDate.getMonth() === now.getMonth() && 
             queryDate.getFullYear() === now.getFullYear();
    }).length;

    // Find most common questions (simple grouping)
    const questionCounts = {};
    queries.forEach(q => {
      const question = q.question.toLowerCase().trim();
      questionCounts[question] = (questionCounts[question] || 0) + 1;
    });

    const topQuestions = Object.entries(questionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([question, count]) => ({ question, count }));

    // 5. Return analytics
    return res.status(200).json({
      success: true,
      site: {
        website_url: site.website_url,
        tier: site.tier,
        query_limit: site.query_limit,
        query_count: site.query_count
      },
      stats: {
        totalQueries,
        queriesThisMonth,
        queriesRemaining: site.query_limit - totalQueries
      },
      recentQueries: queries.map(q => ({
        question: q.question,
        answer: q.answer,
        created_at: q.created_at
      })),
      topQuestions
    });

  } catch (error) {
    console.error('Analytics API Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
