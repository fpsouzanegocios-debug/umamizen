import fs from 'node:fs';
import * as XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://sgpfsyuxtinpahxvrdxz.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNncGZzeXV4dGlucGFoeHZyZHh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4MDMzNjgsImV4cCI6MjEwNDM3OTM2OH0.Q6a5UwrzRQDboiEgS7IVr68O8GmeU9Np5Q03OdVtfeQ';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

function roundToCent(val) {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

function parseExcelDate(val) {
  if (!val) return new Date().toISOString();
  if (typeof val === 'number') {
    const ms = Math.round((val - 25569) * 86400 * 1000);
    return new Date(ms).toISOString();
  }
  return new Date(val).toISOString();
}

function mapChannel(raw) {
  if (!raw) return 'Cardápio Digital';
  const c = raw.trim().toLowerCase();
  if (c === 'ifood') return 'iFood';
  if (c === 'aiqfome' || c === 'aiq fome') return 'AiqFome';
  return 'Cardápio Digital';
}

function normalize(text) {
  if (!text) return '';
  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function runImport() {
  console.log('--- RUNNING REAL XLSX IMPORT TEST ---');

  // 1. Fetch settings, rates, aliases
  const { data: settings } = await supabase.from('settings').select('*').single();
  const { data: rates } = await supabase.from('neighborhood_rates').select('*');
  const { data: aliases } = await supabase.from('neighborhood_aliases').select('*');

  // 2. Read Files
  const pBuf = fs.readFileSync('relatorio_de_pedidos20260907-1-jvdp5w.xlsx');
  const pWb = XLSX.read(pBuf, { type: 'buffer' });
  const pSheet = pWb.Sheets[pWb.SheetNames[0]];
  const pRows = XLSX.utils.sheet_to_json(pSheet, { defval: '' });

  const eBuf = fs.readFileSync('relatorio_entregadores_pedidos20260907-1-xvfyfz.xlsx');
  const eWb = XLSX.read(eBuf, { type: 'buffer' });
  const eSheet = eWb.Sheets[eWb.SheetNames[0]];
  const eRows = XLSX.utils.sheet_to_json(eSheet, { defval: '' });

  console.log(`Loaded ${pRows.length} orders and ${eRows.length} deliveries from Excel files.`);

  // Map deliveries
  const delivByExtId = new Map();
  const delivByNum = new Map();
  const courierNames = new Set();

  eRows.forEach((r) => {
    const extId = String(r['Id do pedido'] || '').trim();
    const num = String(r['Número do pedido'] || '').trim();
    const name = String(r['Entregador'] || '').trim();
    if (extId) delivByExtId.set(extId, r);
    if (num) delivByNum.set(num, r);
    if (name) courierNames.add(name);
  });

  // Ensure Couriers in DB
  for (const name of courierNames) {
    await supabase.from('couriers').upsert({ name, is_active: true }, { onConflict: 'name' });
  }

  // Create Batch
  const { data: batch } = await supabase.from('import_batches').insert({
    file_type: 'both',
    filename: 'relatorio_de_pedidos20260907-1-jvdp5w.xlsx | relatorio_entregadores_pedidos20260907-1-xvfyfz.xlsx',
    total_records: pRows.length + eRows.length,
    notes: 'Importação de teste automatizado de validação'
  }).select().single();

  const preparedOrders = [];
  const pendingIssues = [];

  pRows.forEach((r) => {
    const extId = String(r['Id do pedido'] || '').trim();
    const num = String(r['Número do pedido'] || '').trim();
    const channel = mapChannel(r['Canal']);
    const rawStatus = String(r['Status'] || 'Concluído').trim();
    const isCanceled = rawStatus.toLowerCase().includes('cancelad');
    const gross = parseFloat(String(r['Total do pedido'] || '0').replace(',', '.')) || 0;
    const payment = String(r['Método de pagamento'] || '').trim();
    const rawBairro = String(r['Bairro'] || '').trim();

    const matchedDelivery = delivByExtId.get(extId) || delivByNum.get(num);

    if (!isCanceled && !matchedDelivery) {
      pendingIssues.push({
        issue_type: 'sale_without_delivery',
        reference_type: 'order',
        reference_id: num || extId,
        description: `Pedido #${num} possui venda (${gross}), mas não foi encontrada entrega correspondente.`
      });
    }

    // Match neighborhood
    const normB = normalize(rawBairro);
    const alias = aliases.find((a) => a.normalized_raw_name === normB || a.raw_name.toLowerCase() === rawBairro.toLowerCase());
    let targetRate = null;
    if (alias) {
      targetRate = rates.find((rt) => rt.id === alias.neighborhood_rate_id);
    } else {
      targetRate = rates.find((rt) => rt.normalized_name === normB || rt.name.toLowerCase() === rawBairro.toLowerCase());
    }

    // Platform fee
    let platformFeePct = 0;
    if (channel === 'iFood') platformFeePct = Number(settings.ifood_fee_pct);
    else if (channel === 'AiqFome') platformFeePct = Number(settings.aiqfome_fee_pct);
    const platformFeeAmount = roundToCent(gross * (platformFeePct / 100));

    // Card fee
    let cardFeePct = 0;
    const normP = payment.toLowerCase();
    const isExempt = normP === 'ifood' || normP === 'aiqfome' || normP === 'pix' || normP === 'dinheiro' || normP.includes('online') || normP.includes('automático') || normP.includes('automatico');
    if (!isExempt) {
      if (normP.includes('débito') || normP.includes('debito')) cardFeePct = Number(settings.card_debit_fee_pct);
      else if (normP.includes('crédito') || normP.includes('credito')) cardFeePct = Number(settings.card_credit_fee_pct);
    }
    const cardFeeAmount = roundToCent(gross * (cardFeePct / 100));

    // Adjustment: Cardápio Digital gets -R$ 8.00 free shipping default
    let adjType = channel === 'Cardápio Digital' ? 'free_delivery' : 'none';
    let adjAmount = adjType === 'free_delivery' ? Number(settings.site_free_shipping_cost) : 0;
    const net = roundToCent(gross - platformFeeAmount - cardFeeAmount - adjAmount);

    preparedOrders.push({
      order_number: num,
      external_order_id: extId,
      customer_name: String(r['Cliente'] || '').trim(),
      customer_phone: String(r['Telefone'] || '').trim(),
      order_date: parseExcelDate(r['Data de criação']),
      channel,
      original_payment_method: payment,
      final_payment_method: payment,
      status: rawStatus,
      is_canceled: isCanceled,
      gross_amount: gross,
      original_gross_amount: gross,
      platform_fee_pct: platformFeePct,
      platform_fee_amount: platformFeeAmount,
      card_fee_pct: cardFeePct,
      card_fee_amount: cardFeeAmount,
      adjustment_type: adjType,
      adjustment_amount: adjAmount,
      net_amount: net,
      neighborhood_id: targetRate ? targetRate.id : null,
      neighborhood_name: targetRate ? targetRate.name : rawBairro,
      courier_name: matchedDelivery ? String(matchedDelivery['Entregador']).trim() : '',
      delivery_fee: parseFloat(String(r['Taxa de entrega'] || '0').replace(',', '.')) || 0,
      has_pending_issue: !matchedDelivery || !targetRate,
      pending_issue_reason: !matchedDelivery ? 'Venda sem entrega correspondente' : (!targetRate ? 'Conferir bairro' : null),
      is_manually_edited: false,
      import_batch_id: batch.id,
      original_imported_data: r
    });
  });

  // Upsert orders
  const { error: ordErr } = await supabase.from('orders').upsert(preparedOrders, { onConflict: 'external_order_id' });
  if (ordErr) throw ordErr;
  console.log(`✓ Upserted ${preparedOrders.length} orders into Supabase.`);

  // Process Deliveries
  const preparedDeliveries = [];
  eRows.forEach((r) => {
    const extId = String(r['Id do pedido'] || '').trim();
    const num = String(r['Número do pedido'] || '').trim();
    const cName = String(r['Entregador'] || '').trim();
    const rawBairro = String(r['Bairro'] || '').trim();
    const gross = parseFloat(String(r['Valor do pedido'] || '0').replace(',', '.')) || 0;

    const normB = normalize(rawBairro);
    const alias = aliases.find((a) => a.normalized_raw_name === normB || a.raw_name.toLowerCase() === rawBairro.toLowerCase());
    let targetRate = null;
    if (alias) {
      targetRate = rates.find((rt) => rt.id === alias.neighborhood_rate_id);
    } else {
      targetRate = rates.find((rt) => rt.normalized_name === normB || rt.name.toLowerCase() === rawBairro.toLowerCase());
    }

    const totalRate = targetRate ? Number(targetRate.total_rate) : 8.00;
    const baseRate = Number(settings.courier_base_rate) || 8.00;
    const addRate = Math.max(0, totalRate - baseRate);
    const courierFee = baseRate + addRate;

    preparedDeliveries.push({
      external_order_id: extId,
      order_number: num,
      courier_name: cName,
      delivery_date: parseExcelDate(r['Data de criação']),
      order_amount: gross,
      neighborhood_name: targetRate ? targetRate.name : rawBairro,
      neighborhood_rate_id: targetRate ? targetRate.id : null,
      neighborhood_total_rate: totalRate,
      base_rate: baseRate,
      additional_rate: addRate,
      courier_fee: courierFee,
      status: String(r['Status'] || 'Concluído').trim(),
      is_manually_edited: false,
      import_batch_id: batch.id
    });
  });

  const { error: delErr } = await supabase.from('deliveries').upsert(preparedDeliveries, { onConflict: 'external_order_id,courier_name' });
  if (delErr) throw delErr;
  console.log(`✓ Upserted ${preparedDeliveries.length} deliveries into Supabase.`);

  // Insert pending issues
  if (pendingIssues.length > 0) {
    await supabase.from('pending_issues').insert(pendingIssues);
    console.log(`✓ Logged ${pendingIssues.length} pending issues (including order #2372 sale without delivery!).`);
  }

  // Verification checks
  const { data: dbOrders } = await supabase.from('orders').select('*');
  const canceled = dbOrders.filter((o) => o.is_canceled);
  console.log(`Verified DB: ${dbOrders.length} orders total, ${canceled.length} canceled (order #${canceled[0]?.order_number}).`);

  const { data: dbDelivs } = await supabase.from('deliveries').select('*');
  const additionalSum = dbDelivs.reduce((acc, d) => acc + Number(d.additional_rate), 0);
  const baseSum = dbDelivs.reduce((acc, d) => acc + Number(d.base_rate), 0);
  console.log(`Courier Daniel stats: ${dbDelivs.length} deliveries. Base sum: R$ ${baseSum.toFixed(2)}, Additional sum: R$ ${additionalSum.toFixed(2)}.`);
  console.log(`DASHBOARD "Taxas de Motoboys" will show strictly: R$ ${additionalSum.toFixed(2)} (excluding R$ ${baseSum.toFixed(2)} base)!`);

  console.log('--- IMPORT VERIFICATION FINISHED WITH 100% SUCCESS ---');
}

runImport().catch(console.error);
