import * as cheerio from 'cheerio';

export class WebScraper {
  constructor(startUrl, options = {}) {
    this.startUrl = startUrl;
    this.baseUrl = new URL(startUrl).origin;
    this.baseDomain = new URL(startUrl).hostname;
    this.visited = new Set();
    this.pages = [];
    this.maxPages = options.maxPages || 50;
    this.maxDepth = options.maxDepth || 3;
  }

  async scrape() {
    console.log(`Starting scrape of ${this.startUrl}`);
    await this.crawlPage(this.startUrl, 0);
    console.log(`Scraping complete. Found ${this.pages.length} pages`);
    return this.pages;
  }

  async crawlPage(url, depth) {
    // Stop conditions
    if (depth > this.maxDepth) return;
    if (this.visited.has(url)) return;
    if (this.pages.length >= this.maxPages) return;

    // Skip non-HTML resources
    if (this.shouldSkipUrl(url)) return;

    try {
      this.visited.add(url);
      console.log(`Crawling (depth ${depth}): ${url}`);

      // Fetch page
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Lookr.ai Bot (Website Indexer)'
        },
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });

      if (!response.ok) {
        console.log(`Failed to fetch ${url}: ${response.status}`);
        return;
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('text/html')) {
        return;
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // Extract content
      const pageContent = this.extractContent($);
      
      if (pageContent.content.trim().length > 0) {
        this.pages.push({
          url,
          title: pageContent.title,
          content: pageContent.content,
          lastScraped: new Date().toISOString()
        });
      }

      // Find and crawl internal links
      if (depth < this.maxDepth && this.pages.length < this.maxPages) {
        const links = this.extractLinks($, url);
        
        // Crawl links in parallel but limit concurrency
        const linkBatch = links.slice(0, 10); // Process 10 links at a time
        await Promise.allSettled(
          linkBatch.map(link => this.crawlPage(link, depth + 1))
        );
      }

    } catch (error) {
      console.error(`Error crawling ${url}:`, error.message);
    }
  }

  extractContent($) {
    // Remove unwanted elements
    $('script, style, nav, header, footer, iframe, noscript').remove();

    // Extract title
    const title = $('title').text().trim() || 
                  $('h1').first().text().trim() || 
                  'Untitled Page';

    // Extract text content
    const contentParts = [];

    // Headings
    $('h1, h2, h3').each((i, el) => {
      const text = $(el).text().trim();
      if (text) contentParts.push(text);
    });

    // Paragraphs
    $('p').each((i, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 20) { // Skip very short paragraphs
        contentParts.push(text);
      }
    });

    // List items
    $('li').each((i, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 10) {
        contentParts.push(text);
      }
    });

    // Join and clean
    const content = contentParts
      .join('\n\n')
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\n\s*\n/g, '\n\n') // Remove extra newlines
      .trim();

    return { title, content };
  }

  extractLinks($, currentUrl) {
    const links = new Set();

    $('a[href]').each((i, el) => {
      try {
        const href = $(el).attr('href');
        if (!href) return;

        // Resolve relative URLs
        const absoluteUrl = new URL(href, currentUrl).href;
        const urlObj = new URL(absoluteUrl);

        // Only include links from same domain
        if (urlObj.hostname === this.baseDomain) {
          // Remove hash and query params for cleaner URLs
          const cleanUrl = `${urlObj.origin}${urlObj.pathname}`;
          links.add(cleanUrl);
        }
      } catch (error) {
        // Invalid URL, skip it
      }
    });

    return Array.from(links);
  }

  shouldSkipUrl(url) {
    const skipExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.svg', 
                           '.mp4', '.mp3', '.zip', '.exe', '.doc', '.docx'];
    
    const skipPatterns = ['/wp-admin/', '/admin/', '/login', '/logout', 
                         '/cart', '/checkout', '/account'];

    const urlLower = url.toLowerCase();

    // Skip files
    if (skipExtensions.some(ext => urlLower.endsWith(ext))) {
      return true;
    }

    // Skip admin/auth pages
    if (skipPatterns.some(pattern => urlLower.includes(pattern))) {
      return true;
    }

    return false;
  }
}
