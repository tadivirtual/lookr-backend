import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { session_id } = req.query;

  if (!session_id) {
    return res.status(400).json({ error: 'Missing session_id' });
  }

  try {
    // Check if webhook has processed this session
    const { data: session, error } = await supabase
      .from('checkout_sessions')
      .select('*')
      .eq('session_id', session_id)
      .single();

    if (error || !session) {
      // Session not found yet - webhook probably hasn't processed it
      return res.status(200).json({ ready: false });
    }

    // Check if session is expired (older than 10 minutes)
    const expiresAt = new Date(session.expires_at);
    if (expiresAt < new Date()) {
      return res.status(410).json({ 
        ready: false, 
        error: 'Session expired. Please contact support.' 
      });
    }

    // Session found and valid!
    return res.status(200).json({
      ready: true,
      email: session.customer_email,
      tier: session.tier,
      dfy_purchased: session.dfy_purchased
    });

  } catch (error) {
    console.error('Error checking session:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
