import React, { useState } from 'react';
import { 
  X, 
  UploadCloud, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight,
  ShieldCheck,
  Info,
  AlertCircle,
  Trash2,
  RefreshCw
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { parseOrdersExcel, parseCouriersExcel, ParsedOrderRow, ParsedCourierRow } from '../../lib/excelParser';
import { matchNeighborhood } from '../../lib/neighborhoodMatcher';
import { calculateOrderFinances, calculateDeliveryRates } from '../../lib/calculations';
import { NeighborhoodRate, NeighborhoodAlias, SystemSettings } from '../../types';
import { formatCurrency } from '../../lib/formatters';
import { ImportBatchManager } from './ImportBatchManager';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  settings: SystemSettings;
  neighborhoodRates: NeighborhoodRate[];
  neighborhoodAliases: NeighborhoodAlias[];
  initialTab?: 'import' | 'history';
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  settings,
  neighborhoodRates,
  neighborhoodAliases,
  initialTab = 'import'
}) => {
  const [activeModalTab, setActiveModalTab] = useState<'import' | 'history'>(initialTab);

  React.useEffect(() => {
    if (isOpen) {
      setActiveModalTab(initialTab);
    }
  }, [isOpen, initialTab]);
  const [ordersFile, setOrdersFile] = useState<File | null>(null);
  const [couriersFile, setCouriersFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<{
    totalOrders: number;
    newOrders: number;
    existingOrders: number;
    canceledOrders: number;
    totalDeliveries: number;
    matchedCount: number;
    recognizedNeighborhoods: number;
    unrecognizedNeighborhoods: number;
    pendingIssues: Array<{ type: string; title: string; desc: string }>;
    preparedOrders: any[];
    preparedDeliveries: any[];
    courierNames: string[];
  } | null>(null);

  if (!isOpen) return null;

  const handleProcessFiles = async () => {
    if (!ordersFile && !couriersFile) {
      alert('Selecione pelo menos um dos arquivos XLSX para processar.');
      return;
    }

    setProcessingError(null);
    setIsProcessing(true);
    try {
      let parsedOrders: ParsedOrderRow[] = [];
      let parsedCouriers: ParsedCourierRow[] = [];

      if (ordersFile) {
        parsedOrders = await parseOrdersExcel(ordersFile);
      }
      if (couriersFile) {
        parsedCouriers = await parseCouriersExcel(couriersFile);
      }

      // Safe collections
      const safeRates = Array.isArray(neighborhoodRates) ? neighborhoodRates : [];
      const safeAliases = Array.isArray(neighborhoodAliases) ? neighborhoodAliases : [];
      const safeSettings = settings || { courier_base_rate: 8.00 };

      // 1. Fetch existing orders to prevent duplicate overwriting and check manual edits
      const orderIds = parsedOrders.map((o) => o.external_order_id).filter(Boolean);
      const existingOrdersMap = new Map<string, any>();

      if (orderIds.length > 0) {
        // Query in chunks of 50 to prevent URL length issues
        const chunkSize = 50;
        for (let i = 0; i < orderIds.length; i += chunkSize) {
          const chunk = orderIds.slice(i, i + chunkSize);
          try {
            const { data: existingData, error: chunkErr } = await supabase
              .from('orders')
              .select('*')
              .in('external_order_id', chunk);

            if (!chunkErr && existingData) {
              existingData.forEach((row) => existingOrdersMap.set(row.external_order_id, row));
            }
          } catch (e) {
            console.warn('Erro ao consultar lote de pedidos existentes:', e);
          }
        }
      }

      // Fetch existing deliveries to preserve manual edits and reuse UUIDs
      const deliveryExtIds = parsedCouriers.map((c) => c.external_order_id).filter(Boolean);
      const existingDeliveriesMap = new Map<string, any>();

      if (deliveryExtIds.length > 0) {
        const chunkSize = 50;
        for (let i = 0; i < deliveryExtIds.length; i += chunkSize) {
          const chunk = deliveryExtIds.slice(i, i + chunkSize);
          try {
            const { data: existingData, error: chunkErr } = await supabase
              .from('deliveries')
              .select('*')
              .in('external_order_id', chunk);

            if (!chunkErr && existingData) {
              existingData.forEach((row) => existingDeliveriesMap.set(`${row.external_order_id}_${row.courier_name}`, row));
            }
          } catch (e) {
            console.warn('Erro ao consultar lote de entregas existentes:', e);
          }
        }
      }

      // Map courier deliveries by external_order_id and order_number
      const couriersByExtId = new Map<string, ParsedCourierRow>();
      const couriersByNum = new Map<string, ParsedCourierRow>();
      const courierNamesSet = new Set<string>();

      parsedCouriers.forEach((c) => {
        if (c.external_order_id) couriersByExtId.set(c.external_order_id, c);
        if (c.order_number) couriersByNum.set(c.order_number, c);
        if (c.courier_name) courierNamesSet.add(c.courier_name);
      });

      // Track order UUIDs so deliveries can be linked with order_id
      const orderIdByExtId = new Map<string, string>();
      const orderIdByNum = new Map<string, string>();

      parsedOrders.forEach((o) => {
        const existing = existingOrdersMap.get(o.external_order_id);
        const orderUuid = existing?.id || crypto.randomUUID();
        if (o.external_order_id) orderIdByExtId.set(o.external_order_id, orderUuid);
        if (o.order_number) orderIdByNum.set(o.order_number, orderUuid);
      });

      const pendingIssues: Array<{ type: string; title: string; desc: string }> = [];
      let matchedCount = 0;
      let recognizedNeighborhoods = 0;
      let unrecognizedNeighborhoods = 0;
      let canceledCount = 0;
      let newOrdersCount = 0;
      let existingOrdersCount = 0;

      const preparedOrders: any[] = [];
      const preparedDeliveries: any[] = [];

      // 2. Process Orders
      parsedOrders.forEach((o) => {
        const existing = existingOrdersMap.get(o.external_order_id);
        const orderUuid = existing?.id || orderIdByExtId.get(o.external_order_id) || crypto.randomUUID();

        if (existing) {
          existingOrdersCount++;
        } else {
          newOrdersCount++;
        }

        if (o.is_canceled) {
          canceledCount++;
        }

        // Check courier match
        const matchedCourier = couriersByExtId.get(o.external_order_id) || couriersByNum.get(o.order_number);
        if (matchedCourier) {
          matchedCount++;
        } else if (!o.is_canceled && couriersFile) {
          pendingIssues.push({
            type: 'sale_without_delivery',
            title: `Pedido #${o.order_number || o.external_order_id} sem entrega`,
            desc: `Possui venda de ${formatCurrency(o.gross_amount)}, mas não foi encontrada entrega correspondente.`
          });
        }

        // Neighborhood matching
        const rawBairro = o.neighborhood_name || (matchedCourier ? matchedCourier.neighborhood_name : '');
        const match = matchNeighborhood(rawBairro, safeRates, safeAliases);
        let neighborhoodId: string | null = null;
        let neighborhoodTotalRate = 8.00;
        let hasNeighborhoodIssue = false;

        if (match.neighborhood) {
          recognizedNeighborhoods++;
          neighborhoodId = match.neighborhood.id;
          neighborhoodTotalRate = Number(match.neighborhood.total_rate) || 8.00;
          if (match.neighborhood.is_blocked) {
            hasNeighborhoodIssue = true;
            pendingIssues.push({
              type: 'blocked_neighborhood',
              title: `Bairro bloqueado: ${match.neighborhood.name}`,
              desc: `Pedido #${o.order_number} possui entrega em local bloqueado pela tabela oficial.`
            });
          }
        } else {
          unrecognizedNeighborhoods++;
          hasNeighborhoodIssue = true;
          pendingIssues.push({
            type: 'unknown_neighborhood',
            title: `Conferir bairro: "${rawBairro}"`,
            desc: `Pedido #${o.order_number}: bairro não identificado com exatidão na tabela de tarifas.`
          });
        }

        // Calculations with strict Cardápio Digital / Site delivery fee, neighborhood additional fee and coupon rules
        const deliveryFee = Number(o.delivery_fee || 0);
        const couponAmount = Number(o.coupon_amount || o.discount_amount || 0);

        const finances = calculateOrderFinances({
          channel: o.channel,
          grossAmount: o.gross_amount,
          paymentMethod: o.payment_method,
          deliveryFee,
          couponAmount,
          couponName: o.coupon_name,
          couponAlreadyDiscounted: true,
          settings: safeSettings
        });

        // Don't overwrite if manually edited!
        if (existing && existing.is_manually_edited) {
          preparedOrders.push({
            id: orderUuid,
            order_number: existing.order_number,
            external_order_id: existing.external_order_id,
            customer_name: existing.customer_name || '',
            customer_phone: existing.customer_phone || '',
            order_date: existing.order_date,
            channel: existing.channel,
            original_payment_method: existing.original_payment_method,
            final_payment_method: existing.final_payment_method,
            status: existing.status,
            is_canceled: existing.is_canceled,
            gross_amount: existing.gross_amount,
            original_gross_amount: existing.original_gross_amount,
            platform_fee_pct: existing.platform_fee_pct,
            platform_fee_amount: existing.platform_fee_amount,
            card_fee_pct: existing.card_fee_pct,
            card_fee_amount: existing.card_fee_amount,
            adjustment_type: existing.adjustment_type,
            adjustment_amount: existing.adjustment_amount,
            net_amount: existing.net_amount,
            neighborhood_id: existing.neighborhood_id,
            neighborhood_name: existing.neighborhood_name,
            courier_id: existing.courier_id,
            courier_name: existing.courier_name,
            delivery_fee: existing.delivery_fee,
            neighborhood_fee: existing.neighborhood_fee ?? (existing.is_free_delivery ? existing.delivery_fee : 0),
            normal_delivery_fee: existing.normal_delivery_fee ?? (!existing.is_free_delivery ? existing.delivery_fee : 0),
            is_free_delivery: existing.is_free_delivery ?? (existing.channel === 'Cardápio Digital' && (Number(existing.delivery_fee || 0) === 0 || Number(existing.gross_amount || 0) >= 49.90)),
            free_delivery_cost: existing.free_delivery_cost ?? 0,
            coupon_amount: existing.coupon_amount ?? 0,
            coupon_name: existing.coupon_name ?? null,
            has_pending_issue: existing.has_pending_issue,
            pending_issue_reason: existing.pending_issue_reason,
            is_manually_edited: true,
            manual_edit_at: existing.manual_edit_at,
            manual_edit_user: existing.manual_edit_user,
            original_imported_data: existing.original_imported_data,
            notes: existing.notes,
            import_batch_id: existing.import_batch_id
          });
        } else {
          preparedOrders.push({
            id: orderUuid,
            order_number: o.order_number,
            external_order_id: o.external_order_id,
            customer_name: o.customer_name || '',
            customer_phone: o.customer_phone || '',
            order_date: o.order_date,
            channel: o.channel,
            original_payment_method: o.payment_method,
            final_payment_method: o.payment_method,
            status: o.status,
            is_canceled: o.is_canceled,
            gross_amount: o.gross_amount,
            original_gross_amount: o.gross_amount,
            platform_fee_pct: finances.platformFeePct,
            platform_fee_amount: finances.platformFeeAmount,
            card_fee_pct: finances.cardFeePct,
            card_fee_amount: finances.cardFeeAmount,
            adjustment_type: finances.adjustmentType,
            adjustment_amount: finances.adjustmentAmount,
            net_amount: finances.netAmount,
            neighborhood_id: neighborhoodId,
            neighborhood_name: match.neighborhood ? match.neighborhood.name : rawBairro,
            courier_id: null,
            courier_name: matchedCourier ? matchedCourier.courier_name : '',
            delivery_fee: deliveryFee,
            neighborhood_fee: finances.neighborhoodFee,
            normal_delivery_fee: finances.normalDeliveryFee,
            is_free_delivery: finances.isFreeDelivery,
            free_delivery_cost: finances.freeDeliveryCost,
            coupon_amount: finances.couponAmount,
            coupon_name: finances.couponName || null,
            has_pending_issue: !matchedCourier || hasNeighborhoodIssue,
            pending_issue_reason: !matchedCourier 
              ? 'Venda sem entrega correspondente' 
              : (hasNeighborhoodIssue ? 'Conferir bairro' : null),
            is_manually_edited: false,
            manual_edit_at: null,
            manual_edit_user: null,
            original_imported_data: o.raw_data,
            notes: null,
            import_batch_id: null
          });
        }
      });

      // 3. Check for deliveries without sales
      const orderExtIdsSet = new Set(parsedOrders.map((o) => o.external_order_id));
      const orderNumsSet = new Set(parsedOrders.map((o) => o.order_number));

      parsedCouriers.forEach((c) => {
        const hasSale = orderExtIdsSet.has(c.external_order_id) || orderNumsSet.has(c.order_number);
        if (!hasSale && ordersFile) {
          pendingIssues.push({
            type: 'delivery_without_sale',
            title: `Entrega #${c.order_number || c.external_order_id} sem venda`,
            desc: `Motoboy ${c.courier_name} realizou entrega, mas não há pedido no relatório de vendas.`
          });
        }

        const match = matchNeighborhood(c.neighborhood_name, safeRates, safeAliases);
        const rateTotal = match.neighborhood ? Number(match.neighborhood.total_rate) : 8.00;
        const rates = calculateDeliveryRates(rateTotal, safeSettings.courier_base_rate);

        const delKey = `${c.external_order_id}_${c.courier_name}`;
        const existingDel = existingDeliveriesMap.get(delKey);
        const deliveryUuid = existingDel?.id || crypto.randomUUID();
        const matchedOrderId = orderIdByExtId.get(c.external_order_id) || orderIdByNum.get(c.order_number) || null;

        if (existingDel && existingDel.is_manually_edited) {
          preparedDeliveries.push({
            id: deliveryUuid,
            external_order_id: existingDel.external_order_id,
            order_number: existingDel.order_number,
            order_id: existingDel.order_id || matchedOrderId,
            courier_id: existingDel.courier_id,
            courier_name: existingDel.courier_name,
            delivery_date: existingDel.delivery_date,
            order_amount: existingDel.order_amount,
            payment_method: existingDel.payment_method,
            neighborhood_name: existingDel.neighborhood_name,
            neighborhood_rate_id: existingDel.neighborhood_rate_id,
            neighborhood_total_rate: existingDel.neighborhood_total_rate,
            base_rate: existingDel.base_rate,
            additional_rate: existingDel.additional_rate,
            courier_fee: existingDel.courier_fee,
            status: existingDel.status,
            is_manually_edited: true,
            has_pending_issue: existingDel.has_pending_issue,
            pending_issue_reason: existingDel.pending_issue_reason,
            notes: existingDel.notes,
            import_batch_id: existingDel.import_batch_id
          });
        } else {
          preparedDeliveries.push({
            id: deliveryUuid,
            external_order_id: c.external_order_id,
            order_number: c.order_number,
            order_id: matchedOrderId,
            courier_id: null,
            courier_name: c.courier_name,
            delivery_date: c.delivery_date,
            order_amount: c.order_amount,
            payment_method: null,
            neighborhood_name: match.neighborhood ? match.neighborhood.name : c.neighborhood_name,
            neighborhood_rate_id: match.neighborhood ? match.neighborhood.id : null,
            neighborhood_total_rate: rateTotal,
            base_rate: rates.baseRate,
            additional_rate: rates.additionalRate,
            courier_fee: rates.courierFee,
            status: c.status,
            is_manually_edited: false,
            has_pending_issue: !hasSale || !match.neighborhood,
            pending_issue_reason: !hasSale ? 'Entrega sem venda' : (!match.neighborhood ? 'Conferir bairro' : null),
            notes: null,
            import_batch_id: null
          });
        }
      });

      setPreviewData({
        totalOrders: parsedOrders.length,
        newOrders: newOrdersCount,
        existingOrders: existingOrdersCount,
        canceledOrders: canceledCount,
        totalDeliveries: parsedCouriers.length,
        matchedCount,
        recognizedNeighborhoods,
        unrecognizedNeighborhoods,
        pendingIssues,
        preparedOrders,
        preparedDeliveries,
        courierNames: Array.from(courierNamesSet)
      });
    } catch (err: any) {
      console.error('Error processing files:', err);
      const errMsg = err?.message || (typeof err === 'object' ? JSON.stringify(err) : String(err));
      setProcessingError(errMsg);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmAndSave = async () => {
    if (!previewData) return;
    setIsSaving(true);
    setProcessingError(null);

    try {
      // 1. Create Import Batch record
      const { data: batchData, error: batchErr } = await supabase
        .from('import_batches')
        .insert({
          file_type: ordersFile && couriersFile ? 'both' : (ordersFile ? 'orders' : 'couriers'),
          filename: `${ordersFile?.name || ''} | ${couriersFile?.name || ''}`.trim(),
          total_records: previewData.totalOrders + previewData.totalDeliveries,
          notes: `Cruzados: ${previewData.matchedCount}, Pendências: ${previewData.pendingIssues.length}`
        })
        .select()
        .single();

      if (batchErr) throw batchErr;
      const batchId = batchData.id;

      // 2. Ensure Couriers exist in `couriers` table
      if (previewData.courierNames.length > 0) {
        for (const name of previewData.courierNames) {
          if (name.trim()) {
            await supabase
              .from('couriers')
              .upsert({ name: name.trim(), is_active: true }, { onConflict: 'name' });
          }
        }
      }

      // 3. Upsert Orders in chunks of 40
      if (previewData.preparedOrders.length > 0) {
        const ordersToInsert = previewData.preparedOrders.map((o) => ({
          ...o,
          import_batch_id: o.is_manually_edited && o.import_batch_id ? o.import_batch_id : batchId
        }));

        for (let i = 0; i < ordersToInsert.length; i += 40) {
          const chunk = ordersToInsert.slice(i, i + 40);
          const { error: ordErr } = await supabase
            .from('orders')
            .upsert(chunk, { onConflict: 'external_order_id' });

          if (ordErr) throw ordErr;
        }
      }

      // 4. Upsert Deliveries in chunks of 40
      if (previewData.preparedDeliveries.length > 0) {
        const deliveriesToInsert = previewData.preparedDeliveries.map((d) => ({
          ...d,
          import_batch_id: d.is_manually_edited && d.import_batch_id ? d.import_batch_id : batchId
        }));

        for (let i = 0; i < deliveriesToInsert.length; i += 40) {
          const chunk = deliveriesToInsert.slice(i, i + 40);
          const { error: delErr } = await supabase
            .from('deliveries')
            .upsert(chunk, { onConflict: 'external_order_id,courier_name' });

          if (delErr) throw delErr;
        }
      }

      // 5. Insert Pending Issues
      if (previewData.pendingIssues.length > 0) {
        const issuesToInsert = previewData.pendingIssues.map((p) => ({
          id: crypto.randomUUID(),
          issue_type: p.type,
          reference_type: 'order',
          reference_id: p.title,
          description: p.desc,
          status: 'open'
        }));

        await supabase.from('pending_issues').insert(issuesToInsert);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error saving imported data:', err);
      const errMsg = err?.message || (typeof err === 'object' ? JSON.stringify(err) : String(err));
      setProcessingError(errMsg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: activeModalTab === 'history' ? '860px' : '780px', transition: 'max-width 0.3s ease' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileSpreadsheet size={24} color="#F43F5E" />
            <h2 style={{ fontSize: '1.25rem' }}>Importação e Gestão de Relatórios</h2>
          </div>
          <button 
            onClick={onClose} 
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Abas de Navegação */}
        <div style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          marginBottom: '20px'
        }}>
          <button
            type="button"
            onClick={() => setActiveModalTab('import')}
            style={{
              padding: '10px 18px',
              background: 'none',
              border: 'none',
              borderBottom: activeModalTab === 'import' ? '2px solid #F43F5E' : '2px solid transparent',
              color: activeModalTab === 'import' ? '#FFFFFF' : 'var(--text-muted)',
              fontWeight: 600,
              fontSize: '0.88rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s'
            }}
          >
            <UploadCloud size={16} color={activeModalTab === 'import' ? '#F43F5E' : undefined} />
            <span>Nova Importação</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveModalTab('history')}
            style={{
              padding: '10px 18px',
              background: 'none',
              border: 'none',
              borderBottom: activeModalTab === 'history' ? '2px solid #F43F5E' : '2px solid transparent',
              color: activeModalTab === 'history' ? '#FFFFFF' : 'var(--text-muted)',
              fontWeight: 600,
              fontSize: '0.88rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s'
            }}
          >
            <Trash2 size={16} color={activeModalTab === 'history' ? '#FB7185' : undefined} />
            <span>Gerenciar / Remover Relatórios</span>
          </button>
        </div>

        {activeModalTab === 'history' ? (
          <ImportBatchManager onDataChanged={onSuccess} />
        ) : (
          <>

        {processingError && (
          <div style={{
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            padding: '12px 14px',
            marginBottom: '16px',
            color: '#FB7185',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px'
          }}>
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ flex: 1 }}>
              <strong style={{ display: 'block', marginBottom: '4px' }}>Erro ao processar:</strong>
              <span>{processingError}</span>
            </div>
            <button onClick={() => setProcessingError(null)} style={{ background: 'none', border: 'none', color: '#FB7185', cursor: 'pointer' }}>
              <X size={16} />
            </button>
          </div>
        )}

        {!previewData ? (
          <div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: 1.5 }}>
              Importe os arquivos Excel diários para processamento, cálculo automático de taxas, cruzamento por Id do pedido e geração de pendências.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
              {/* Vendas File Upload */}
              <div style={{
                border: '2px dashed rgba(255, 255, 255, 0.12)',
                borderRadius: '12px',
                padding: '18px 20px',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px'
              }}>
                <div>
                  <h4 style={{ fontSize: '0.95rem', marginBottom: '4px', color: '#F8FAFC' }}>
                    1. Relatório de Vendas (Pedidos)
                  </h4>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Ex: relatorio_de_pedidos*.xlsx (iFood, AiqFome, Site)
                  </p>
                  {ordersFile && (
                    <span style={{ fontSize: '0.8rem', color: '#34D399', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
                      <CheckCircle2 size={14} /> {ordersFile.name} ({(ordersFile.size / 1024).toFixed(1)} KB)
                    </span>
                  )}
                </div>
                <div>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    id="orders-file-input"
                    style={{ display: 'none' }}
                    onChange={(e) => setOrdersFile(e.target.files?.[0] || null)}
                  />
                  <label htmlFor="orders-file-input" className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                    <UploadCloud size={15} />
                    <span>{ordersFile ? 'Trocar Arquivo' : 'Selecionar Arquivo'}</span>
                  </label>
                </div>
              </div>

              {/* Entregadores File Upload */}
              <div style={{
                border: '2px dashed rgba(255, 255, 255, 0.12)',
                borderRadius: '12px',
                padding: '18px 20px',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px'
              }}>
                <div>
                  <h4 style={{ fontSize: '0.95rem', marginBottom: '4px', color: '#F8FAFC' }}>
                    2. Relatório de Entregadores (Motoboys)
                  </h4>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Ex: relatorio_entregadores_pedidos*.xlsx
                  </p>
                  {couriersFile && (
                    <span style={{ fontSize: '0.8rem', color: '#34D399', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
                      <CheckCircle2 size={14} /> {couriersFile.name} ({(couriersFile.size / 1024).toFixed(1)} KB)
                    </span>
                  )}
                </div>
                <div>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    id="couriers-file-input"
                    style={{ display: 'none' }}
                    onChange={(e) => setCouriersFile(e.target.files?.[0] || null)}
                  />
                  <label htmlFor="couriers-file-input" className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                    <UploadCloud size={15} />
                    <span>{couriersFile ? 'Trocar Arquivo' : 'Selecionar Arquivo'}</span>
                  </label>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={onClose} className="btn btn-secondary">
                Cancelar
              </button>
              <button 
                onClick={handleProcessFiles} 
                className="btn btn-primary"
                disabled={isProcessing || (!ordersFile && !couriersFile)}
              >
                {isProcessing ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <span>PROCESSAR RELATÓRIOS</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* Review & Summary Step */
          <div>
            <div style={{
              backgroundColor: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              padding: '14px',
              borderRadius: '10px',
              marginBottom: '18px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <ShieldCheck size={24} color="#34D399" />
              <div style={{ fontSize: '0.85rem' }}>
                <strong style={{ color: '#34D399' }}>Processamento concluído com sucesso!</strong>
                <p style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Revise o resumo do cruzamento antes de persistir no Supabase. Edições manuais prévias são preservadas.
                </p>
              </div>
            </div>

            {/* Metrics Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '10px',
              marginBottom: '20px'
            }}>
              <div style={{ backgroundColor: 'var(--bg-input)', padding: '12px', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Pedidos Vendas</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '2px' }}>{previewData.totalOrders}</div>
                <div style={{ fontSize: '0.7rem', color: '#34D399' }}>{previewData.newOrders} novos / {previewData.existingOrders} já salvos</div>
              </div>
              <div style={{ backgroundColor: 'var(--bg-input)', padding: '12px', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Entregas Motoboys</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '2px' }}>{previewData.totalDeliveries}</div>
                <div style={{ fontSize: '0.7rem', color: '#38BDF8' }}>{previewData.matchedCount} cruzados</div>
              </div>
              <div style={{ backgroundColor: 'var(--bg-input)', padding: '12px', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Cancelados</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#FB7185', marginTop: '2px' }}>{previewData.canceledOrders}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>fora do faturamento</div>
              </div>
              <div style={{ backgroundColor: 'var(--bg-input)', padding: '12px', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Bairros</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '2px' }}>{previewData.recognizedNeighborhoods}</div>
                <div style={{ fontSize: '0.7rem', color: previewData.unrecognizedNeighborhoods > 0 ? '#FBBF24' : '#34D399' }}>
                  {previewData.unrecognizedNeighborhoods} para conferir
                </div>
              </div>
            </div>

            {/* Pending Issues Detected */}
            {previewData.pendingIssues.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ fontSize: '0.9rem', marginBottom: '8px', color: '#FBBF24', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertTriangle size={16} />
                  Pendências detectadas para resolução ({previewData.pendingIssues.length}):
                </h4>
                <div style={{
                  maxHeight: '160px',
                  overflowY: 'auto',
                  backgroundColor: 'var(--bg-input)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}>
                  {previewData.pendingIssues.map((p, idx) => (
                    <div key={idx} style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <span style={{ color: '#FBBF24', fontWeight: 600 }}>• {p.title}:</span>
                      <span style={{ color: 'var(--text-secondary)' }}>{p.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
              <button 
                onClick={() => setPreviewData(null)} 
                className="btn btn-secondary"
                disabled={isSaving}
              >
                Voltar
              </button>
              <button 
                onClick={handleConfirmAndSave} 
                className="btn btn-primary"
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Salvando no Banco...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    <span>CONFIRMAR E SALVAR NO BANCO</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
        </>
        )}
      </div>
    </div>
  );
};
