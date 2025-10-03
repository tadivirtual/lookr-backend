import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { website, color, additional_domains } = req.body;

  // Generate unique site key
  const siteKey = 'site_' + Math.random().toString(36).substr(2, 9);

  // Parse domains
  const domains = [new URL(website).hostname];
  if (additional_domains) {
    const extra = additional_domains.split(',').map(d => d.trim());
    domains.push(...extra);
  }

  // Store in database
  const { error } = await supabase
    .from('sites')
    .insert({
      site_key: siteKey,
      website_url: website,
      allowed_domains: domains,
      button_color: color,
      query_limit: 2000 // Default starter tier
    });

  if (error) {
    return res.status(500).json({ error: 'Database error' });
  }

  // Send email with embed code (add later)
  
  return res.json({ siteKey });
}
