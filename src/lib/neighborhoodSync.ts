import { supabase } from './supabase';
import { NeighborhoodRate, SystemSettings } from '../types';
import { normalizeNeighborhoodName } from './neighborhoodMatcher';
import { calculateOrderFinances } from './calculations';

export interface SyncResult {
  ordersUpdated: number;
  deliveriesUpdated: number;
}

/**
 * Synchronizes a single updated neighborhood rate to all matching deliveries and orders in the system.
 */
export async function syncNeighborhoodRateToOrders(
  rate: NeighborhoodRate,
  previousName?: string,
  settings?: Partial<SystemSettings>
): Promise<SyncResult> {
  let ordersUpdated = 0;
  let deliveriesUpdated = 0;

  try {
    // 1. Fetch aliases for this neighborhood
    const { data: aliases } = await supabase
      .from('neighborhood_aliases')
      .select('*')
      .eq('neighborhood_rate_id', rate.id);

    const normName = normalizeNeighborhoodName(rate.name);
    const normPrev = previousName ? normalizeNeighborhoodName(previousName) : null;
    const aliasNorms = new Set<string>();
    (aliases || []).forEach((a) => {
      if (a.normalized_raw_name) aliasNorms.add(a.normalized_raw_name);
      if (a.raw_name) aliasNorms.add(normalizeNeighborhoodName(a.raw_name));
    });

    const isMatch = (neighborhoodId?: string | null, rawName?: string | null) => {
      if (neighborhoodId && neighborhoodId === rate.id) return true;
      if (!rawName) return false;
      const norm = normalizeNeighborhoodName(rawName);
      if (norm === normName) return true;
      if (normPrev && norm === normPrev) return true;
      if (aliasNorms.has(norm)) return true;
      return false;
    };

    // 2. Fetch deliveries that match either by ID or name
    const { data: deliveries, error: delivErr } = await supabase
      .from('deliveries')
      .select('*');

    if (!delivErr && deliveries) {
      const matchingDelivs = deliveries.filter((d) =>
        isMatch(d.neighborhood_rate_id, d.neighborhood_name)
      );

      for (const d of matchingDelivs) {
        const total = Number(rate.total_rate) || 8.0;
        const base = Number(rate.base_rate) || 8.0;
        const add = Number(rate.additional_rate) || Math.max(0, Math.round((total - base) * 100) / 100);

        const isBlocked = Boolean(rate.is_blocked);
        const hasPending = isBlocked;
        const pendingReason = isBlocked ? 'Bairro bloqueado' : null;

        const { error: updDelivErr } = await supabase
          .from('deliveries')
          .update({
            neighborhood_rate_id: rate.id,
            neighborhood_name: rate.name,
            neighborhood_total_rate: total,
            base_rate: base,
            additional_rate: add,
            courier_fee: total,
            has_pending_issue: hasPending,
            pending_issue_reason: pendingReason
          })
          .eq('id', d.id);

        if (!updDelivErr) deliveriesUpdated++;
      }
    }

    // 3. Fetch orders that match either by ID or name
    const { data: orders, error: ordErr } = await supabase
      .from('orders')
      .select('*');

    if (!ordErr && orders) {
      const matchingOrders = orders.filter((o) =>
        isMatch(o.neighborhood_id, o.neighborhood_name)
      );

      for (const o of matchingOrders) {
        const grossAmount = Number(o.gross_amount) || 0;
        const deliveryFee = Number(o.delivery_fee) || 0;
        const couponAmount = Number(o.coupon_amount) || 0;

        const finances = calculateOrderFinances({
          channel: o.channel,
          grossAmount,
          paymentMethod: o.final_payment_method || o.original_payment_method,
          deliveryFee,
          couponAmount,
          settings
        });

        const isBlocked = Boolean(rate.is_blocked);
        let hasPending = false;
        let pendingReason: string | null = null;

        if (isBlocked) {
          hasPending = true;
          pendingReason = 'Bairro bloqueado';
        } else if (o.status === 'Cancelado' || o.is_canceled) {
          hasPending = false;
          pendingReason = null;
        } else if (!o.courier_name || !o.courier_name.trim()) {
          hasPending = true;
          pendingReason = 'Venda sem entrega correspondente';
        } else {
          hasPending = false;
          pendingReason = null;
        }

        const { error: updOrdErr } = await supabase
          .from('orders')
          .update({
            neighborhood_id: rate.id,
            neighborhood_name: rate.name,
            neighborhood_fee: finances.neighborhoodFee,
            normal_delivery_fee: finances.normalDeliveryFee,
            is_free_delivery: finances.isFreeDelivery,
            free_delivery_cost: finances.freeDeliveryCost,
            adjustment_type: finances.adjustmentType,
            adjustment_amount: finances.adjustmentAmount,
            net_amount: finances.netAmount,
            has_pending_issue: hasPending,
            pending_issue_reason: pendingReason,
            updated_at: new Date().toISOString()
          })
          .eq('id', o.id);

        if (!updOrdErr) ordersUpdated++;
      }
    }
  } catch (err) {
    console.error('Erro ao sincronizar tarifas do bairro com pedidos e entregas:', err);
  }

  return { ordersUpdated, deliveriesUpdated };
}

/**
 * Synchronizes all neighborhood rates to all deliveries and orders in the system.
 */
export async function syncAllNeighborhoodRatesToOrders(
  settings?: Partial<SystemSettings>
): Promise<SyncResult> {
  let ordersUpdated = 0;
  let deliveriesUpdated = 0;

  try {
    const { data: rates } = await supabase.from('neighborhood_rates').select('*');
    const { data: aliases } = await supabase.from('neighborhood_aliases').select('*');
    const { data: orders } = await supabase.from('orders').select('*');
    const { data: deliveries } = await supabase.from('deliveries').select('*');

    if (!rates || !orders || !deliveries) return { ordersUpdated: 0, deliveriesUpdated: 0 };

    const rateByNorm = new Map<string, NeighborhoodRate>();
    rates.forEach((r) => rateByNorm.set(normalizeNeighborhoodName(r.name), r));

    const aliasMap = new Map<string, NeighborhoodRate>();
    (aliases || []).forEach((a) => {
      const rate = rates.find((r) => r.id === a.neighborhood_rate_id);
      if (rate) {
        aliasMap.set(normalizeNeighborhoodName(a.raw_name), rate);
        if (a.normalized_raw_name) aliasMap.set(a.normalized_raw_name, rate);
      }
    });

    const resolve = (rawName?: string | null, id?: string | null): NeighborhoodRate | null => {
      if (id) {
        const found = rates.find((r) => r.id === id);
        if (found) return found;
      }
      if (!rawName) return null;
      const norm = normalizeNeighborhoodName(rawName);
      if (rateByNorm.has(norm)) return rateByNorm.get(norm)!;
      if (aliasMap.has(norm)) return aliasMap.get(norm)!;
      return null;
    };

    // Update Deliveries
    for (const d of deliveries) {
      const matched = resolve(d.neighborhood_name, d.neighborhood_rate_id);
      if (matched) {
        const total = Number(matched.total_rate) || 8.0;
        const base = Number(matched.base_rate) || 8.0;
        const add = Number(matched.additional_rate) || Math.max(0, Math.round((total - base) * 100) / 100);
        const isBlocked = Boolean(matched.is_blocked);

        const { error: dErr } = await supabase
          .from('deliveries')
          .update({
            neighborhood_rate_id: matched.id,
            neighborhood_name: matched.name,
            neighborhood_total_rate: total,
            base_rate: base,
            additional_rate: add,
            courier_fee: total,
            has_pending_issue: isBlocked,
            pending_issue_reason: isBlocked ? 'Bairro bloqueado' : null
          })
          .eq('id', d.id);

        if (!dErr) deliveriesUpdated++;
      }
    }

    // Update Orders
    for (const o of orders) {
      const matched = resolve(o.neighborhood_name, o.neighborhood_id);
      if (matched) {
        const grossAmount = Number(o.gross_amount) || 0;
        const deliveryFee = Number(o.delivery_fee) || 0;
        const couponAmount = Number(o.coupon_amount) || 0;

        const finances = calculateOrderFinances({
          channel: o.channel,
          grossAmount,
          paymentMethod: o.final_payment_method || o.original_payment_method,
          deliveryFee,
          couponAmount,
          settings
        });

        const isBlocked = Boolean(matched.is_blocked);
        let hasPending = false;
        let pendingReason: string | null = null;

        if (isBlocked) {
          hasPending = true;
          pendingReason = 'Bairro bloqueado';
        } else if (o.status === 'Cancelado' || o.is_canceled) {
          hasPending = false;
          pendingReason = null;
        } else if (!o.courier_name || !o.courier_name.trim()) {
          hasPending = true;
          pendingReason = 'Venda sem entrega correspondente';
        } else {
          hasPending = false;
          pendingReason = null;
        }

        const { error: oErr } = await supabase
          .from('orders')
          .update({
            neighborhood_id: matched.id,
            neighborhood_name: matched.name,
            neighborhood_fee: finances.neighborhoodFee,
            normal_delivery_fee: finances.normalDeliveryFee,
            is_free_delivery: finances.isFreeDelivery,
            free_delivery_cost: finances.freeDeliveryCost,
            adjustment_type: finances.adjustmentType,
            adjustment_amount: finances.adjustmentAmount,
            net_amount: finances.netAmount,
            has_pending_issue: hasPending,
            pending_issue_reason: pendingReason,
            updated_at: new Date().toISOString()
          })
          .eq('id', o.id);

        if (!oErr) ordersUpdated++;
      }
    }
  } catch (err) {
    console.error('Erro na sincronização geral de bairros:', err);
  }

  return { ordersUpdated, deliveriesUpdated };
}
