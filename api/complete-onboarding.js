import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { website, color, additional_domains, email, tier } = req.body;

  // Generate unique site key
  const siteKey = 'site_' + Math.random().toString(36).substr(2, 9);

  // Parse domains
  const domains = [new URL(website).hostname];
  if (additional_domains) {
    const extra = additional_domains.split(',').map(d => d.trim());
    domains.push(...extra);
  }

  // Set query limit based on tier
  const limits = {
    starter: 2000,
    pro: 10000,
    business: 50000
  };
  const queryLimit = limits[tier] || 2000;

  // Store in database
  const { error } = await supabase
    .from('sites')
    .insert({
      site_key: siteKey,
      email: email,
      website_url: website,
      allowed_domains: domains,
      button_color: color, // Add this column to your database first!
      query_limit: queryLimit
    });

  if (error) {
    console.error('Supabase error:', error);
    return res.status(500).json({ error: 'Database error', details: error.message });
  }

  return res.json({ siteKey });
}
