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
    const { url, urls, siteKey, email, preview } = req.body;

    // Accept either single url or array of urls
    const urlsToScrape = urls || (url ? [url] : []);

    if (urlsToScrape.length === 0) {
      return res.status(400).json({ error: 'URL or URLs are required' });
    }

    console.log(`Starting scrape for ${urlsToScrape.length} URL(s)`);

    // Scrape all URLs and combine results
    const allPages = [];
    const allDomains = [];
    let totalPagesScraped = 0;

    for (const urlToScrape of urlsToScrape) {
      // Validate URL
      let websiteUrl;
      try {
        websiteUrl = new URL(urlToScrape);
      } catch (error) {
        console.error(`Invalid URL: ${urlToScrape}`);
        continue; // Skip invalid URLs
      }

      console.log(`Scraping ${urlToScrape}...`);

      // Scrape the website
      const scraper = new WebScraper(urlToScrape, {
        maxPages: 50,
        maxDepth: 3
      });

      let pages;
      try {
        pages = await scraper.scrape();
      } catch (error) {
        if (error.message === 'JAVASCRIPT_SITE') {
          console.error(`JavaScript site detected: ${urlToScrape}`);
          // Continue with other URLs instead of failing completely
          continue;
        }
        console.error(`Error scraping ${urlToScrape}:`, error);
        continue;
      }

      if (pages.length > 0) {
        allPages.push(...pages);
        totalPagesScraped += pages.length;
        console.log(`Scraped ${pages.length} pages from ${urlToScrape}`);
      }

      // Collect domains
      const domain = websiteUrl.hostname;
      if (!allDomains.includes(domain)) {
        allDomains.push(domain);
        // Add www variant
        if (!domain.startsWith('www.')) {
          allDomains.push(`www.${domain}`);
        } else {
          allDomains.push(domain.replace('www.', ''));
        }
      }
    }

    if (allPages.length === 0) {
      return res.status(400).json({ 
        error: 'No content found',
        message: 'Could not scrape any content from the provided URLs. Sites may be blocking our crawler or contain no readable text.'
      });
    }

    console.log(`Total pages scraped: ${totalPagesScraped} from ${urlsToScrape.length} site(s)`);

    // Generate site key if not provided
    const finalSiteKey = siteKey || `site_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

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
          content_cache: { pages: allPages },
          last_scraped: new Date().toISOString(),
          website_url: urlsToScrape[0], // Store primary URL
          allowed_domains: allDomains,
          expires_at: preview ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null,
          is_preview: preview || false
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
          allowed_domains: allDomains,
          website_url: urlsToScrape[0], // Store primary URL
          content_cache: { pages: allPages },
          last_scraped: new Date().toISOString(),
          expires_at: preview ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null,
          is_preview: preview || false
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
      pagesScraped: totalPagesScraped,
      sitesScraped: urlsToScrape.length,
      message: `Successfully scraped ${totalPagesScraped} pages from ${urlsToScrape.length} site(s)`
    });

  } catch (error) {
    console.error('Scraping error:', error);
    return res.status(500).json({ 
      error: 'Failed to scrape website',
      details: error.message 
    });
  }
}
