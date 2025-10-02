import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const { key } = req.query;
  
  if (!key) {
    return res.json({ error: 'No preview key provided' });
  }
  
  const { data: site, error } = await supabase
    .from('sites')
    .select('*')
    .eq('site_key', key)
    .single();

  if (error || !site) {
    return res.json({ error: 'Preview not found' });
  }

  // Check expiration
  if (site.expires_at && new Date(site.expires_at) < new Date()) {
    return res.json({ error: 'This 24-hour preview has expired. Sign up to get full access!' });
  }

  return res.json({
    title: site.website_url,
    pages: site.content_cache.pages
  });
}
