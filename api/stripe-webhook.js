import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  // ADD THESE DEBUG LINES HERE (right after the method check)
  console.log('=== WEBHOOK DEBUG ===');
  console.log('STRIPE_WEBHOOK_SECRET exists:', !!process.env.STRIPE_WEBHOOK_SECRET);
  console.log('STRIPE_WEBHOOK_SECRET starts with:', process.env.STRIPE_WEBHOOK_SECRET?.substring(0, 10));
  console.log('STRIPE_SECRET_KEY exists:', !!process.env.STRIPE_SECRET_KEY);
  console.log('Body type:', typeof req.body);
  console.log('Signature present:', !!req.headers['stripe-signature']);
  console.log('=====================');

  try {
    const sig = req.headers['stripe-signature'];
    const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    
    let event;
    try {
      event = stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.error('Signature verification error:', err.message);
      console.error('Expected secret starts with:', STRIPE_WEBHOOK_SECRET?.substring(0, 10));
      return res.status(400).json({ error: 'Webhook signature verification failed' });
    }
    
    // YOUR EXISTING CODE CONTINUES HERE...

  try {
    const sig = req.headers['stripe-signature'];
    
    // Vercel provides body as string when bodyParser is disabled
    const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    
    let event;
    try {
      event = stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.error('Webhook error:', err.message);
      return res.status(400).json({ error: 'Webhook signature verification failed' });
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const customerEmail = session.customer_details?.email || session.customer_email;
      const sessionId = session.id;

      const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 100 });

      let tier = 'starter';
      let dfyPurchased = false;

      for (const item of lineItems.data) {
        const productName = item.description?.toLowerCase() || '';
        if (productName.includes('done for you') || productName.includes('installation')) {
          dfyPurchased = true;
        }

        const amount = item.amount_total / 100;
        if (amount >= 90) tier = 'business';
        else if (amount >= 25) tier = 'pro';
      }

      await supabase.from('checkout_sessions').insert({
        session_id: sessionId,
        customer_email: customerEmail,
        tier: tier,
        dfy_purchased: dfyPurchased,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString()
      });

      console.log(`Checkout completed: ${customerEmail}, tier: ${tier}, DFY: ${dfyPurchased}`);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook handler failed:', error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
}

export const config = {
  api: { bodyParser: false }
};
