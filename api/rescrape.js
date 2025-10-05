// Lookr.ai Re-scrape API
// File: api/rescrape.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

export default async function handler(req, res) {
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

    // 1. Validate site key and get site info
    const { data: site, error: siteError } = await supabase
      .from('sites')
      .select('*')
      .eq('site_key', siteKey)
      .single();

    if (siteError || !site) {
      return res.status(401).json({ error: 'Invalid site key' });
    }

    // 2. Build array of URLs to scrape
    const urlsToScrape = [site.website_url];
    
    // Add allowed domains if they exist
    if (site.allowed_domains && site.allowed_domains.length > 1) {
      // Add additional domains (skip first one as it's already in website_url)
      const additionalUrls = site.allowed_domains
        .slice(1)
        .map(domain => {
          if (domain.startsWith('http')) return domain;
          return `https://${domain}`;
        });
      urlsToScrape.push(...additionalUrls);
    }

    // 3. Trigger scraping
    const SCRAPE_API_URL = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}/api/scrape`
      : 'http://localhost:3000/api/scrape';

    const scrapeResponse = await fetch(SCRAPE_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: urlsToScrape })
    });

    const scrapeData = await scrapeResponse.json();

    // Check if scraping actually succeeded
    if (!scrapeResponse.ok) {
      console.error('Scrape failed:', scrapeData);
      throw new Error(scrapeData.error || 'Scraping failed');
    }

    if (!scrapeData.content || !scrapeData.content.pages) {
      console.error('Invalid scrape data:', scrapeData);
      throw new Error('Scraping returned invalid data');
    }

    // 4. Update site with new content
    const { error: updateError } = await supabase
      .from('sites')
      .update({
        content_cache: scrapeData.content
      })
      .eq('site_key', siteKey);

    if (updateError) {
      console.error('Database update error:', updateError);
      throw updateError;
    }

    // 5. Return success
    return res.status(200).json({
      success: true,
      message: 'Site re-scraped successfully',
      pagesScraped: scrapeData.content.pages.length
    });

  } catch (error) {
    console.error('Re-scrape API Error:', error);
    return res.status(500).json({ 
      error: 'Failed to re-scrape site',
      message: error.message || 'Unknown error'
    });
  }
}
