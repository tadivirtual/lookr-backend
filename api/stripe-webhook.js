import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

export const config = {
  api: {
    bodyParser: false,
  },
};

async function getRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const rawBody = await getRawBody(req);
    const sig = req.headers['stripe-signature'];

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    let event;

    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.error('Webhook signature verification failed');
      return res.status(400).json({ error: 'Webhook signature verification failed' });
    }

    // Handle checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const customerEmail = session.customer_details?.email || session.customer_email;
      const sessionId = session.id;

      const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
        limit: 100,
      });

      let tier = 'starter';
      let dfyPurchased = false;

      for (const item of lineItems.data) {
        const priceId = item.price?.id;
        const productName = item.description?.toLowerCase() || '';

        if (productName.includes('done for you') || productName.includes('installation')) {
          dfyPurchased = true;
        }

        const amount = item.amount_total / 100;
        
        if (amount >= 90 && amount <= 150) {
          tier = 'business';
        } else if (amount >= 25 && amount <= 80) {
          tier = 'pro';
        } else if (amount >= 5 && amount <= 60) {
          tier = 'starter';
        }
      }

      const { error } = await supabase
        .from('checkout_sessions')
        .insert({
          session_id: sessionId,
          customer_email: customerEmail,
          tier: tier,
          dfy_purchased: dfyPurchased,
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString()
        });

      if (error) {
        console.error('Failed to store session:', error);
      }

      console.log(`Checkout completed: ${customerEmail}, tier: ${tier}, DFY: ${dfyPurchased}`);
    }

    // ===== HANDLE SUBSCRIPTION CANCELLATIONS =====
    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object;
      const customerEmail = subscription.customer_email;

      console.log(`Subscription cancelled for: ${customerEmail}`);

      // Mark all sites for this customer as inactive
      const { error } = await supabase
        .from('sites')
        .update({ active: false })
        .eq('email', customerEmail);

      if (error) {
        console.error('Failed to deactivate sites:', error);
        return res.status(500).json({ error: 'Failed to deactivate' });
      }

      console.log(`Deactivated all sites for ${customerEmail}`);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
}
