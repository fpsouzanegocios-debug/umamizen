import { ChannelType, OrderAdjustmentType, SystemSettings } from '../types';

export function roundToCent(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

export function isOnlineOrExemptPayment(paymentMethod: string): boolean {
  if (!paymentMethod) return true;
  const norm = paymentMethod.toLowerCase().trim();
  if (norm === 'ifood' || norm === 'aiqfome' || norm === 'pix automático' || norm === 'pix automatico') {
    return true;
  }
  if (norm === 'pix' || norm === 'dinheiro') {
    return true;
  }
  if (norm.includes('online')) {
    return true;
  }
  return false;
}

export function getCardFeePct(paymentMethod: string, settings?: Partial<SystemSettings>): number {
  if (!paymentMethod) return 0;
  if (isOnlineOrExemptPayment(paymentMethod)) return 0;

  const norm = paymentMethod.toLowerCase().trim();
  if (norm.includes('débito') || norm.includes('debito')) {
    return Number(settings?.card_debit_fee_pct) || 1.64;
  }
  if (norm.includes('crédito') || norm.includes('credito')) {
    return Number(settings?.card_credit_fee_pct) || 3.53;
  }
  return 0;
}

export function calculateOrderFinances(params: {
  channel: ChannelType;
  grossAmount: number;
  paymentMethod: string;
  deliveryFee?: number;
  neighborhoodFee?: number;
  neighborhoodAdditionalRate?: number;
  isFreeDelivery?: boolean;
  freeDeliveryCost?: number;
  couponAmount?: number;
  couponName?: string;
  couponAlreadyDiscounted?: boolean;
  adjustmentType?: OrderAdjustmentType;
  customAdjustmentAmount?: number;
  settings?: Partial<SystemSettings>;
  customPlatformFeePct?: number;
}) {
  const { 
    channel, 
    grossAmount, 
    paymentMethod, 
    deliveryFee = 0,
    couponName,
    settings, 
    customPlatformFeePct 
  } = params;

  // 1. Platform Fee
  let platformFeePct = 0;
  if (customPlatformFeePct !== undefined && customPlatformFeePct !== null) {
    platformFeePct = customPlatformFeePct;
  } else if (channel === 'iFood') {
    platformFeePct = Number(settings?.ifood_fee_pct) || 15.0;
  } else if (channel === 'AiqFome') {
    platformFeePct = Number(settings?.aiqfome_fee_pct) || 15.0;
  } else {
    platformFeePct = 0;
  }
  const platformFeeAmount = roundToCent(grossAmount * (platformFeePct / 100));

  // 2. POS Card Fee
  const cardFeePct = getCardFeePct(paymentMethod, settings);
  const cardFeeAmount = roundToCent(grossAmount * (cardFeePct / 100));

  // 3. Free Delivery, Neighborhood Additional Fee & Coupon rules (Cardápio Digital / Site)
  let isFreeDelivery = false;
  let freeDeliveryCost = 0;
  let neighborhoodFee = 0;
  let normalDeliveryFee = 0;
  const couponAmount = roundToCent(Number(params.couponAmount) || 0);
  const couponAlreadyDiscounted = params.couponAlreadyDiscounted !== undefined ? params.couponAlreadyDiscounted : true;
  const numDeliveryFee = roundToCent(Number(deliveryFee) || 0);

  if (channel === 'Cardápio Digital') {
    // Distinguish:
    // 1. TAXA NORMAL DE ENTREGA: R$ 7,99 cobrada porque o pedido não atingiu o valor mínimo (< R$ 49,90)
    //    -> NÃO descontar os R$ 8,00 de entrega grátis.
    // 2. TAXA/ADICIONAL DO BAIRRO: Mesmo que o pedido tenha direito à entrega grátis (>= R$ 49,90 ou fee = 0),
    //    pode existir cobrança adicional de bairro (ex: R$ 3,00) no campo Taxa de entrega do relatório.
    //    -> CONTINUA com entrega grátis;
    //    -> Desconta os R$ 8,00 de entrega grátis;
    //    -> A taxa do bairro cobrada fica registrada separadamente.
    if (params.isFreeDelivery !== undefined) {
      isFreeDelivery = Boolean(params.isFreeDelivery);
    } else if (numDeliveryFee === 0) {
      isFreeDelivery = true;
    } else if (grossAmount >= 49.90) {
      isFreeDelivery = true;
    } else {
      isFreeDelivery = false;
    }

    if (isFreeDelivery) {
      freeDeliveryCost = params.freeDeliveryCost !== undefined 
        ? Number(params.freeDeliveryCost) 
        : (Number(settings?.site_free_shipping_cost) || 8.00);
      neighborhoodFee = params.neighborhoodFee !== undefined 
        ? Number(params.neighborhoodFee) 
        : numDeliveryFee;
      normalDeliveryFee = 0;
    } else {
      freeDeliveryCost = 0;
      if (params.neighborhoodFee !== undefined) {
        neighborhoodFee = Number(params.neighborhoodFee);
        normalDeliveryFee = roundToCent(Math.max(0, numDeliveryFee - neighborhoodFee));
      } else if (numDeliveryFee > 7.99) {
        normalDeliveryFee = 7.99;
        neighborhoodFee = roundToCent(numDeliveryFee - 7.99);
      } else {
        normalDeliveryFee = numDeliveryFee;
        neighborhoodFee = 0;
      }
    }
  } else {
    isFreeDelivery = params.isFreeDelivery || false;
    freeDeliveryCost = isFreeDelivery ? (Number(params.freeDeliveryCost) || 0) : 0;
    neighborhoodFee = Number(params.neighborhoodFee || 0);
    normalDeliveryFee = numDeliveryFee;
  }
  freeDeliveryCost = roundToCent(freeDeliveryCost);
  neighborhoodFee = roundToCent(neighborhoodFee);
  normalDeliveryFee = roundToCent(normalDeliveryFee);

  // Determine adjustment amount that directly reduces net revenue:
  // - freeDeliveryCost is absorbed by the restaurant, reducing net revenue.
  // - if coupon is ALREADY discounted from gross total (standard Excel case): do not discount twice!
  // - if coupon is NOT discounted from gross total: discount coupon from net!
  let adjustmentAmount = freeDeliveryCost;
  if (!couponAlreadyDiscounted && couponAmount > 0) {
    adjustmentAmount = roundToCent(adjustmentAmount + couponAmount);
  }

  // If a legacy adjustmentType was explicitly provided and no freeDelivery/coupon logic applied:
  if (params.adjustmentType === 'custom' && params.customAdjustmentAmount !== undefined) {
    adjustmentAmount = roundToCent(Number(params.customAdjustmentAmount) || 0);
  }

  // Determine adjustment type representation
  let adjustmentType: OrderAdjustmentType = 'none';
  if (isFreeDelivery && couponAmount > 0) {
    adjustmentType = 'custom';
  } else if (isFreeDelivery) {
    adjustmentType = 'free_delivery';
  } else if (couponAmount > 0) {
    adjustmentType = 'coupon';
  } else if (params.adjustmentType) {
    adjustmentType = params.adjustmentType;
  }

  // 4. Net Amount
  const netAmount = roundToCent(grossAmount - platformFeeAmount - cardFeeAmount - adjustmentAmount);

  return {
    platformFeePct,
    platformFeeAmount,
    cardFeePct,
    cardFeeAmount,
    isFreeDelivery,
    freeDeliveryCost,
    neighborhoodFee,
    normalDeliveryFee,
    couponAmount,
    couponName,
    couponAlreadyDiscounted,
    adjustmentType,
    adjustmentAmount,
    netAmount
  };
}

export function calculateDeliveryRates(totalNeighborhoodRate: number, baseRate: number = 8.00) {
  const base = roundToCent(Number(baseRate) || 8.00);
  const total = roundToCent(Number(totalNeighborhoodRate) || 0);
  const additional = roundToCent(Math.max(0, total - base));
  const courierFee = roundToCent(base + additional);

  return {
    baseRate: base,
    additionalRate: additional,
    courierFee
  };
}

export function calculateShiftHours(startTime: string, endTime: string, breakMinutes: number = 0): number {
  if (!startTime || !endTime) return 0;
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);

  if (isNaN(startH) || isNaN(startM) || isNaN(endH) || isNaN(endM)) return 0;

  let startTotalM = startH * 60 + startM;
  let endTotalM = endH * 60 + endM;

  if (endTotalM < startTotalM) {
    // Crosses midnight!
    endTotalM += 24 * 60;
  }

  const workedMinutes = Math.max(0, endTotalM - startTotalM - (breakMinutes || 0));
  return roundToCent(workedMinutes / 60);
}
