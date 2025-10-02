import { createClient } from '@supabase/supabase-js';
import { WebScraper } from '../lib/scraper.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

export default async function handler(req, res) {
  // CORS headers
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
    const { url, siteKey, email, preview } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Validate URL
    let websiteUrl;
    try {
      websiteUrl = new URL(url);
    } catch (error) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    console.log(`Starting scrape for ${url}`);

    // Scrape the website
    const scraper = new WebScraper(url, {
      maxPages: 50,
      maxDepth: 3
    });

    let pages;
    try {
      pages = await scraper.scrape();
    } catch (error) {
      if (error.message === 'JAVASCRIPT_SITE') {
        return res.status(400).json({ 
          error: 'JavaScript-Rendered Site Detected',
          message: 'This website uses JavaScript to display content (common with Wix, Squarespace, Webflow, and modern site builders). Our basic scraper can only read traditional HTML sites like WordPress. JavaScript site support is available on our Pro plan. Contact support@lookr.ai to upgrade.',
          isJavaScriptSite: true
        });
      }
      throw error;
    }

    if (pages.length === 0) {
      return res.status(400).json({ 
        error: 'No content found',
        message: 'The website may be blocking our crawler or contains no readable text. Please ensure the site is publicly accessible.'
      });
    }

    console.log(`Scraped ${pages.length} pages`);

    // Generate site key if not provided
    const finalSiteKey = siteKey || `site_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Get domain for allowed_domains
    const domain = websiteUrl.hostname;
    const allowedDomains = [domain];
    
    // Add www variant if not present
    if (!domain.startsWith('www.')) {
      allowedDomains.push(`www.${domain}`);
    } else {
      allowedDomains.push(domain.replace('www.', ''));
    }

    // Store in database
    const { data: existingSite } = await supabase
      .from('sites')
      .select('*')
      .eq('site_key', finalSiteKey)
      .single();

    if (existingSite) {
      // Update existing site
      const { error } = await supabase
        .from('sites')
        .update({
          content_cache: { pages },
          last_scraped: new Date().toISOString(),
          website_url: url
        })
        .eq('site_key', finalSiteKey);

      if (error) {
        console.error('Database update error:', error);
        return res.status(500).json({ error: 'Failed to update site data' });
      }

      console.log(`Updated site: ${finalSiteKey}`);
    } else {
      // Insert new site
      const { error } = await supabase
        .from('sites')
        .insert({
          site_key: finalSiteKey,
          email,
          allowed_domains: allowedDomains,
          website_url: url,
          content_cache: { pages },
          last_scraped: new Date().toISOString()
        });

      if (error) {
        console.error('Database insert error:', error);
        return res.status(500).json({ error: 'Failed to save site data' });
      }

      console.log(`Created new site: ${finalSiteKey}`);
    }

    return res.status(200).json({
      success: true,
      siteKey: finalSiteKey,
      pagesScraped: pages.length,
      message: `Successfully scraped ${pages.length} pages from ${domain}`
    });

  } catch (error) {
    console.error('Scraping error:', error);
    return res.status(500).json({ 
      error: 'Failed to scrape website',
      details: error.message 
    });
  }
}
