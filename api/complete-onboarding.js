import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { website, color, additional_domains, email, tier, additional_knowledge } = req.body;

  // Ensure URL has https://
  let fullUrl = website;
  if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) {
    fullUrl = 'https://' + fullUrl;
  }

  // Generate unique site key
  const siteKey = 'site_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

  // Parse domains
  const domains = [new URL(fullUrl).hostname];
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
      website_url: fullUrl,
      allowed_domains: domains,
      button_color: color,
      query_limit: queryLimit,
      tier: tier,
      additional_knowledge: additional_knowledge || '',
      active: true
    });

  if (error) {
    console.error('Supabase error:', error);
    return res.status(500).json({ error: 'Database error', details: error.message });
  }

  // AUTO-SCRAPE: Trigger scraping for all domains in the background
  try {
    const baseUrl = req.headers.origin || `https://${req.headers.host}`;
    
    // Build array of all URLs to scrape
    const urlsToScrape = [fullUrl];
    if (additional_domains) {
      const extraUrls = additional_domains.split(',').map(d => {
        let url = d.trim();
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          url = 'https://' + url;
        }
        return url;
      });
      urlsToScrape.push(...extraUrls);
    }
    
    // Scrape all URLs
    const scrapeResponse = await fetch(`${baseUrl}/api/scrape`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        urls: urlsToScrape,
        siteKey: siteKey 
      })
    });
    
    // Don't wait for scrape to complete - let it run in background
    console.log('Scrape triggered for:', siteKey, 'URLs:', urlsToScrape.length);
  } catch (error) {
    console.error('Failed to trigger scrape:', error);
    // Don't fail the request if scraping fails - user can still get embed code
  }

  return res.json({ siteKey });
}
