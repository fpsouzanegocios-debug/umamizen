import { supabase } from './supabase';
import { NeighborhoodRate, SystemSettings } from '../types';
import { normalizeNeighborhoodName, matchNeighborhood, matchNeighborhoodByStreet } from './neighborhoodMatcher';
import { calculateOrderFinances } from './calculations';

export interface SyncResult {
  ordersUpdated: number;
  deliveriesUpdated: number;
}

export interface AutoResolveResult {
  resolvedOrders: number;
  resolvedDeliveries: number;
  registeredAliases: number;
  details: Array<{
    orderNumber: string;
    originalName: string;
    matchedName: string;
    method: string;
  }>;
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

    const resolve = (rawName?: string | null, id?: string | null, street?: string | null): NeighborhoodRate | null => {
      if (id) {
        const found = rates.find((r) => r.id === id);
        if (found) return found;
      }
      if (!rawName) return null;

      // Check street first if rawName is city name "Lavras" or empty
      const norm = normalizeNeighborhoodName(rawName);
      if (norm === 'LAVRAS' || norm === 'CIDADE' || !norm) {
        const streetMatch = matchNeighborhoodByStreet(street, rates);
        if (streetMatch) return streetMatch;
      }

      // Enhanced intelligent matching
      const match = matchNeighborhood(rawName, rates, aliases || []);
      return match.neighborhood;
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
      const street = o.original_imported_data?.Rua || null;
      const matched = resolve(o.neighborhood_name, o.neighborhood_id, street);
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

/**
 * Automatically inspects and resolves all orders and deliveries with neighborhood pendencies
 * by identifying registered neighborhoods with similar names (fuzzy, prefixes, roman numerals, street lookup).
 * Also registers the matched aliases in `neighborhood_aliases` so subsequent imports and checks are instantaneous.
 */
export async function autoResolvePendingNeighborhoodOrders(
  settings?: Partial<SystemSettings>
): Promise<AutoResolveResult> {
  const result: AutoResolveResult = {
    resolvedOrders: 0,
    resolvedDeliveries: 0,
    registeredAliases: 0,
    details: []
  };

  try {
    const { data: rates } = await supabase.from('neighborhood_rates').select('*');
    const { data: aliases } = await supabase.from('neighborhood_aliases').select('*');
    const { data: orders } = await supabase.from('orders').select('*');
    const { data: deliveries } = await supabase.from('deliveries').select('*');

    if (!rates || !orders) return result;

    const safeRates = rates;
    const safeAliases = aliases || [];
    const existingAliasKeys = new Set(
      safeAliases.map((a) => a.normalized_raw_name || normalizeNeighborhoodName(a.raw_name))
    );

    // Filter orders that have pending issues or need neighborhood check
    const candidateOrders = orders.filter((o) => {
      if (o.has_pending_issue && o.pending_issue_reason === 'Conferir bairro') return true;
      if (!o.neighborhood_id) return true;
      const found = safeRates.find((r) => r.id === o.neighborhood_id);
      return !found;
    });

    for (const o of candidateOrders) {
      const rawName = o.neighborhood_name || '';
      const normRaw = normalizeNeighborhoodName(rawName);
      const street = o.original_imported_data?.Rua || null;

      let matchedRate: NeighborhoodRate | null = null;
      let matchMethod = '';

      // 1. Street lookup if rawName is empty or city name 'LAVRAS'
      if (normRaw === 'LAVRAS' || normRaw === 'CIDADE' || !normRaw) {
        matchedRate = matchNeighborhoodByStreet(street, safeRates);
        if (matchedRate) {
          matchMethod = `Identificado pelo logradouro: ${street}`;
        }
      }

      // 2. Intelligent fuzzy & similarity matcher
      if (!matchedRate && rawName.trim()) {
        const match = matchNeighborhood(rawName, safeRates, safeAliases);
        if (match.neighborhood) {
          matchedRate = match.neighborhood;
          matchMethod = `Similaridade (${match.status}, ${Math.round(match.confidence * 100)}%)`;
        }
      }

      if (matchedRate) {
        // Recalculate financial breakdown
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

        const isBlocked = Boolean(matchedRate.is_blocked);
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

        // Update the order in database
        const { error: ordErr } = await supabase
          .from('orders')
          .update({
            neighborhood_id: matchedRate.id,
            neighborhood_name: matchedRate.name,
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

        if (!ordErr) {
          result.resolvedOrders++;
          result.details.push({
            orderNumber: o.order_number,
            originalName: rawName || (street ? `Rua ${street}` : 'Não informado'),
            matchedName: matchedRate.name,
            method: matchMethod
          });

          // Sync matching delivery if any exists
          if (deliveries) {
            const matchingDeliv = deliveries.find(
              (d) =>
                (d.order_number && d.order_number === o.order_number) ||
                (d.external_order_id && d.external_order_id === o.external_order_id)
            );
            if (matchingDeliv) {
              const total = Number(matchedRate.total_rate) || 8.0;
              const base = Number(matchedRate.base_rate) || 8.0;
              const add = Number(matchedRate.additional_rate) || Math.max(0, Math.round((total - base) * 100) / 100);

              const { error: dErr } = await supabase
                .from('deliveries')
                .update({
                  neighborhood_rate_id: matchedRate.id,
                  neighborhood_name: matchedRate.name,
                  neighborhood_total_rate: total,
                  base_rate: base,
                  additional_rate: add,
                  courier_fee: total,
                })
                .eq('id', matchingDeliv.id);

              if (!dErr) {
                result.resolvedDeliveries++;

                // Sync courier_daily_payments for this courier and date
                const dayStr = matchingDeliv.delivery_date ? matchingDeliv.delivery_date.slice(0, 10) : null;
                if (dayStr && matchingDeliv.courier_name) {
                  const { data: dayDelivs } = await supabase
                    .from('deliveries')
                    .select('base_rate, additional_rate, courier_fee')
                    .eq('courier_name', matchingDeliv.courier_name)
                    .gte('delivery_date', `${dayStr}T00:00:00`)
                    .lte('delivery_date', `${dayStr}T23:59:59.999Z`);

                  if (dayDelivs && dayDelivs.length > 0) {
                    const sBase = dayDelivs.reduce((a, b) => a + (Number(b.base_rate) || 8), 0);
                    const sAdd = dayDelivs.reduce((a, b) => a + (Number(b.additional_rate) || 0), 0);
                    const sGross = sBase + sAdd;

                    const { data: exPay } = await supabase
                      .from('courier_daily_payments')
                      .select('*')
                      .eq('payment_date', dayStr)
                      .ilike('courier_name', matchingDeliv.courier_name)
                      .maybeSingle();

                    if (exPay) {
                      const retCash = Number(exPay.retained_cash || 0);
                      await supabase
                        .from('courier_daily_payments')
                        .update({
                          base_amount: sBase,
                          base_total: sBase,
                          additional_amount: sAdd,
                          additional_total: sAdd,
                          total_amount: sGross - retCash,
                          delivery_count: dayDelivs.length,
                          total_deliveries: dayDelivs.length,
                          updated_at: new Date().toISOString()
                        })
                        .eq('id', exPay.id);
                    }
                  }
                }
              }
            }
          }

          // Register new alias if not yet registered and not generic "Lavras"
          if (rawName && normRaw !== 'LAVRAS' && normRaw !== 'CIDADE' && !existingAliasKeys.has(normRaw)) {
            try {
              const { error: aliasErr } = await supabase.from('neighborhood_aliases').insert({
                raw_name: rawName.trim(),
                normalized_raw_name: normRaw,
                neighborhood_rate_id: matchedRate.id,
                is_confirmed: true
              });
              if (!aliasErr) {
                result.registeredAliases++;
                existingAliasKeys.add(normRaw);
              }
            } catch (err) {
              console.warn('Falha ao registrar alias automático:', err);
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('Erro em autoResolvePendingNeighborhoodOrders:', err);
  }

  return result;
}
