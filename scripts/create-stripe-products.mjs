/**
 * Creates AgenThinkMesh subscription products and prices in Stripe.
 * Run once: node scripts/create-stripe-products.mjs
 * Outputs PRICE IDs to paste into server/lib/stripePlans.ts
 */
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-02-24.acacia',
});

async function main() {
  console.log('Creating AgenThinkMesh subscription products in Stripe...\n');

  // --- Professional Plan ---
  const proProduct = await stripe.products.create({
    name: 'AgenThinkMesh Professional',
    description: 'Unlimited access to the AgenThink Council of 10 agents. 5,000 tokens/month. Priority support.',
    metadata: { plan: 'professional' },
  });

  const proPrice = await stripe.prices.create({
    product: proProduct.id,
    unit_amount: 4900, // $49.00 USD in cents
    currency: 'usd',
    recurring: { interval: 'month' },
    nickname: 'Professional Monthly',
    metadata: { plan: 'professional', tokens_per_month: '5000' },
  });

  console.log('✅ Professional Plan created');
  console.log('   Product ID:', proProduct.id);
  console.log('   Price ID:  ', proPrice.id);

  // --- Enterprise Plan ---
  const entProduct = await stripe.products.create({
    name: 'AgenThinkMesh Enterprise',
    description: 'Full platform access with 25,000 tokens/month, dedicated support, and custom integrations.',
    metadata: { plan: 'enterprise' },
  });

  const entPrice = await stripe.prices.create({
    product: entProduct.id,
    unit_amount: 19900, // $199.00 USD in cents
    currency: 'usd',
    recurring: { interval: 'month' },
    nickname: 'Enterprise Monthly',
    metadata: { plan: 'enterprise', tokens_per_month: '25000' },
  });

  console.log('\n✅ Enterprise Plan created');
  console.log('   Product ID:', entProduct.id);
  console.log('   Price ID:  ', entPrice.id);

  console.log('\n--- COPY THESE INTO server/lib/stripePlans.ts ---');
  console.log(`PROFESSIONAL_PRICE_ID="${proPrice.id}"`);
  console.log(`ENTERPRISE_PRICE_ID="${entPrice.id}"`);
  console.log('--------------------------------------------------');

  return { proPrice: proPrice.id, entPrice: entPrice.id };
}

main().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
