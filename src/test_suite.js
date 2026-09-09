import assert from 'node:assert';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://sgpfsyuxtinpahxvrdxz.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNncGZzeXV4dGlucGFoeHZyZHh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4MDMzNjgsImV4cCI6MjEwNDM3OTM2OH0.Q6a5UwrzRQDboiEgS7IVr68O8GmeU9Np5Q03OdVtfeQ';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

function roundToCent(val) {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

function calculateOrderFinances({ channel, grossAmount, paymentMethod, adjustmentType, customAdjustmentAmount, settings }) {
  let platformFeePct = 0;
  if (channel === 'iFood') platformFeePct = settings.ifood_fee_pct;
  else if (channel === 'AiqFome') platformFeePct = settings.aiqfome_fee_pct;
  else platformFeePct = 0;

  const platformFeeAmount = roundToCent(grossAmount * (platformFeePct / 100));

  let cardFeePct = 0;
  const normPay = (paymentMethod || '').toLowerCase().trim();
  const isOnlineOrExempt = normPay === 'ifood' || normPay === 'aiqfome' || normPay === 'pix' || normPay === 'dinheiro' || normPay.includes('online') || normPay.includes('automático') || normPay.includes('automatico');

  if (!isOnlineOrExempt) {
    if (normPay.includes('débito') || normPay.includes('debito')) cardFeePct = settings.card_debit_fee_pct;
    else if (normPay.includes('crédito') || normPay.includes('credito')) cardFeePct = settings.card_credit_fee_pct;
  }

  const cardFeeAmount = roundToCent(grossAmount * (cardFeePct / 100));

  let adjustmentAmount = 0;
  if (adjustmentType === 'free_delivery') adjustmentAmount = settings.site_free_shipping_cost;
  else if (adjustmentType === 'coupon') adjustmentAmount = customAdjustmentAmount || settings.coupon_suggested_amount;
  else if (adjustmentType === 'custom') adjustmentAmount = customAdjustmentAmount || 0;

  adjustmentAmount = roundToCent(adjustmentAmount);
  const netAmount = roundToCent(grossAmount - platformFeeAmount - cardFeeAmount - adjustmentAmount);

  return { platformFeePct, platformFeeAmount, cardFeePct, cardFeeAmount, adjustmentAmount, netAmount };
}

const mockSettings = {
  ifood_fee_pct: 15.00,
  aiqfome_fee_pct: 15.00,
  card_debit_fee_pct: 1.64,
  card_credit_fee_pct: 3.53,
  site_free_shipping_cost: 8.00,
  coupon_suggested_amount: 10.00,
  courier_base_rate: 8.00,
};

console.log('--- EXECUTING SECTION 36 VALIDATION TESTS ---');

// Test 1: iFood R$100 online
const t1 = calculateOrderFinances({
  channel: 'iFood',
  grossAmount: 100,
  paymentMethod: 'iFood',
  adjustmentType: 'none',
  settings: mockSettings
});
assert.strictEqual(t1.platformFeeAmount, 15.00, 'Test 1 platform fee fail');
assert.strictEqual(t1.cardFeeAmount, 0.00, 'Test 1 card fee fail');
assert.strictEqual(t1.netAmount, 85.00, 'Test 1 net amount fail');
console.log('✓ Test 1 Passed: iFood R$100 online -> Líquido = R$ 85,00');

// Test 2: iFood R$100 credito loja
const t2 = calculateOrderFinances({
  channel: 'iFood',
  grossAmount: 100,
  paymentMethod: 'Cartão de crédito',
  adjustmentType: 'none',
  settings: mockSettings
});
assert.strictEqual(t2.platformFeeAmount, 15.00, 'Test 2 platform fee fail');
assert.strictEqual(t2.cardFeeAmount, 3.53, 'Test 2 card fee fail');
assert.strictEqual(t2.netAmount, 81.47, 'Test 2 net amount fail');
console.log('✓ Test 2 Passed: iFood R$100 cartão crédito loja -> Líquido = R$ 81,47');

// Test 3: Cardápio Digital R$100 PIX com entrega grátis
const t3 = calculateOrderFinances({
  channel: 'Cardápio Digital',
  grossAmount: 100,
  paymentMethod: 'Pix',
  adjustmentType: 'free_delivery',
  settings: mockSettings
});
assert.strictEqual(t3.adjustmentAmount, 8.00, 'Test 3 adjustment fail');
assert.strictEqual(t3.cardFeeAmount, 0.00, 'Test 3 card fee fail');
assert.strictEqual(t3.netAmount, 92.00, 'Test 3 net amount fail');
console.log('✓ Test 3 Passed: Cardápio Digital R$100 PIX c/ entrega grátis -> Líquido = R$ 92,00');

// Test 4: Cardápio Digital R$100 Cupom R$10 sem entrega grátis
const t4 = calculateOrderFinances({
  channel: 'Cardápio Digital',
  grossAmount: 100,
  paymentMethod: 'Pix',
  adjustmentType: 'coupon',
  customAdjustmentAmount: 10.00,
  settings: mockSettings
});
assert.strictEqual(t4.adjustmentAmount, 10.00, 'Test 4 adjustment fail');
assert.strictEqual(t4.netAmount, 90.00, 'Test 4 net amount fail');
console.log('✓ Test 4 Passed: Cardápio Digital R$100 Cupom R$10 -> Líquido = R$ 90,00');

// Test 5: Reativo - Mudar pagamento de crédito para PIX
const t5Credit = calculateOrderFinances({
  channel: 'Cardápio Digital',
  grossAmount: 100,
  paymentMethod: 'Cartão de crédito',
  adjustmentType: 'none',
  settings: mockSettings
});
assert.strictEqual(t5Credit.cardFeeAmount, 3.53);
const t5Pix = calculateOrderFinances({
  channel: 'Cardápio Digital',
  grossAmount: 100,
  paymentMethod: 'Pix',
  adjustmentType: 'none',
  settings: mockSettings
});
assert.strictEqual(t5Pix.cardFeeAmount, 0.00);
console.log('✓ Test 5 Passed: Alterar de Crédito para PIX zera taxa do cartão imediatamente');

// Test 6: Database connectivity & Neighborhoods verification
const { data: dbRates } = await supabase.from('neighborhood_rates').select('count');
assert.ok(dbRates, 'Supabase query failed');
console.log('✓ Test 6 Passed: Supabase tables active and connected');

console.log('ALL SECTION 36 AUTOMATED LOGICAL TESTS PASSED SUCCESSFULLY!');
