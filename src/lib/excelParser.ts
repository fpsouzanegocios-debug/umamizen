import * as XLSX from 'xlsx';
import { ChannelType } from '../types';

export interface ParsedOrderRow {
  order_number: string;
  external_order_id: string;
  customer_name: string;
  customer_phone: string;
  order_date: string; // ISO string
  channel: ChannelType;
  payment_method: string;
  status: string;
  is_canceled: boolean;
  gross_amount: number;
  delivery_fee: number;
  coupon_amount?: number;
  coupon_name?: string;
  discount_amount?: number;
  neighborhood_name: string;
  raw_data: Record<string, any>;
}

export interface ParsedCourierRow {
  courier_name: string;
  external_order_id: string;
  order_number: string;
  delivery_date: string; // ISO string
  status: string;
  order_amount: number;
  neighborhood_name: string;
  raw_data: Record<string, any>;
}

export function parseMoney(val: any): number {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const str = String(val).trim().replace(/[R$\s]/g, '');
  if (!str) return 0;
  // If Brazilian format like 1.250,50
  if (str.includes(',') && str.includes('.')) {
    const clean = str.replace(/\./g, '').replace(',', '.');
    const n = parseFloat(clean);
    return isNaN(n) ? 0 : n;
  }
  if (str.includes(',')) {
    const n = parseFloat(str.replace(',', '.'));
    return isNaN(n) ? 0 : n;
  }
  const n = parseFloat(str);
  return isNaN(n) ? 0 : n;
}

export function parseExcelDate(val: any): string {
  if (!val) return new Date().toISOString();

  // If already a JS Date
  if (val instanceof Date && !isNaN(val.getTime())) {
    const y = val.getUTCFullYear();
    const m = val.getUTCMonth();
    const d = val.getUTCDate();
    const h = val.getUTCHours();
    const min = val.getUTCMinutes();
    const s = val.getUTCSeconds();
    return new Date(y, m, d, h, min, s).toISOString();
  }

  // If Excel serial number (e.g. 46271.77605556784)
  if (typeof val === 'number') {
    const ms = Math.round((val - 25569) * 86400 * 1000);
    const tempDate = new Date(ms);
    if (!isNaN(tempDate.getTime())) {
      const y = tempDate.getUTCFullYear();
      const m = tempDate.getUTCMonth();
      const d = tempDate.getUTCDate();
      const h = tempDate.getUTCHours();
      const min = tempDate.getUTCMinutes();
      const s = tempDate.getUTCSeconds();
      return new Date(y, m, d, h, min, s).toISOString();
    }
    return new Date().toISOString();
  }

  if (typeof val === 'string') {
    const str = val.trim();
    if (!str) return new Date().toISOString();

    // Check Brazilian date DD/MM/YYYY or DD/MM/YYYY HH:mm:ss
    const brMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
    if (brMatch) {
      const [_, d, m, y, h, min, s] = brMatch;
      const hour = h !== undefined ? Number(h) : 12;
      const minute = min !== undefined ? Number(min) : 0;
      const second = s !== undefined ? Number(s) : 0;
      const dt = new Date(Number(y), Number(m) - 1, Number(d), hour, minute, second);
      if (!isNaN(dt.getTime())) return dt.toISOString();
    }

    // Check ISO date YYYY-MM-DD or YYYY-MM-DD HH:mm:ss or YYYY-MM-DDTHH:mm:ss
    const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
    if (isoMatch) {
      const [_, y, m, d, h, min, s] = isoMatch;
      const hour = h !== undefined ? Number(h) : 12;
      const minute = min !== undefined ? Number(min) : 0;
      const second = s !== undefined ? Number(s) : 0;
      const dt = new Date(Number(y), Number(m) - 1, Number(d), hour, minute, second);
      if (!isNaN(dt.getTime())) return dt.toISOString();
    }

    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) return parsed.toISOString();
  }

  return new Date().toISOString();
}

export function mapChannel(rawChannel: string): ChannelType {
  if (!rawChannel) return 'Cardápio Digital';
  const c = rawChannel.trim().toLowerCase();
  if (c === 'ifood') return 'iFood';
  if (c === 'aiqfome' || c === 'aiq fome') return 'AiqFome';
  if (c === 'site' || c === 'cardapio digital' || c === 'cardápio digital') return 'Cardápio Digital';
  return 'Cardápio Digital';
}

async function getUint8Array(file: File | ArrayBuffer | Blob): Promise<Uint8Array> {
  if (file instanceof Uint8Array) {
    return file;
  }
  if (file instanceof ArrayBuffer) {
    return new Uint8Array(file);
  }
  if (ArrayBuffer.isView(file)) {
    return new Uint8Array(file.buffer, file.byteOffset, file.byteLength);
  }
  if (typeof (file as any)?.arrayBuffer === 'function') {
    const ab = await (file as any).arrayBuffer();
    return new Uint8Array(ab);
  }
  // Browser FileReader fallback
  return new Promise<Uint8Array>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(new Uint8Array(reader.result));
      } else {
        reject(new Error('Não foi possível ler o arquivo.'));
      }
    };
    reader.onerror = () => reject(reader.error || new Error('Erro ao ler arquivo'));
    reader.readAsArrayBuffer(file as any);
  });
}

export async function parseOrdersExcel(file: File | ArrayBuffer): Promise<ParsedOrderRow[]> {
  const bytes = await getUint8Array(file);
  const workbook = XLSX.read(bytes, { type: 'array' });
  
  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('O arquivo XLSX de vendas não possui planilhas válidas.');
  }

  // Find sheet: either one named 'orders', 'pedidos', 'vendas', or the first sheet
  const sheetName = workbook.SheetNames.find((s) => {
    const l = s.toLowerCase();
    return l.includes('pedid') || l.includes('order') || l.includes('venda');
  }) || workbook.SheetNames[0];

  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error('Não foi possível ler a planilha de vendas no arquivo XLSX.');
  }

  // Convert to JSON objects with raw header names
  const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  if (!rows || rows.length === 0) {
    throw new Error('A planilha de vendas está vazia ou sem linhas de dados.');
  }

  const result: ParsedOrderRow[] = [];

  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx];
    try {
      const rawChannel = String(row['Canal'] || row['Canal de vendas'] || '').trim();
      const channel = mapChannel(rawChannel);

      const rawStatus = String(row['Status'] || '').trim();
      const isCanceled = rawStatus.toLowerCase().includes('cancelad');

      const rawDate = row['Data de criação'] || row['Data'] || row['Data do pedido'];
      const orderDate = parseExcelDate(rawDate);

      const grossAmount = parseMoney(row['Total do pedido'] || row['Total'] || '0');
      const deliveryFee = parseMoney(row['Taxa de entrega'] || '0');
      const discountVal = parseMoney(row['Desconto'] || row['Valor do desconto'] || '0');
      const couponVal = parseMoney(row['Cupom'] || row['Valor do cupom'] || '0') || discountVal;
      
      let couponName: string | undefined = undefined;
      const rawCupom = row['Cupom'] || row['Código do cupom'] || row['Codigo do cupom'] || row['Nome do cupom'];
      if (rawCupom && typeof rawCupom === 'string' && isNaN(Number(rawCupom.trim()))) {
        couponName = rawCupom.trim();
      }

      const externalId = String(row['Id do pedido'] || row['ID'] || row['Id'] || '').trim();
      const orderNumber = String(row['Número do pedido'] || row['Numero'] || row['Pedido'] || '').trim();

      if (!externalId && !orderNumber) {
        // Skip blank / footer rows
        continue;
      }

      result.push({
        order_number: orderNumber || externalId,
        external_order_id: externalId || orderNumber,
        customer_name: String(row['Cliente'] || '').trim(),
        customer_phone: String(row['Telefone'] || '').trim(),
        order_date: orderDate,
        channel,
        payment_method: String(row['Método de pagamento'] || row['Forma de pagamento'] || '').trim(),
        status: rawStatus || 'Concluído',
        is_canceled: isCanceled,
        gross_amount: Math.round(grossAmount * 100) / 100,
        delivery_fee: Math.round(deliveryFee * 100) / 100,
        coupon_amount: Math.round(couponVal * 100) / 100,
        coupon_name: couponName,
        discount_amount: Math.round(discountVal * 100) / 100,
        neighborhood_name: String(row['Bairro'] || '').trim(),
        raw_data: row
      });
    } catch (rowErr) {
      console.warn(`Erro ao processar linha ${idx + 1} de vendas:`, rowErr);
    }
  }

  return result;
}

export async function parseCouriersExcel(file: File | ArrayBuffer): Promise<ParsedCourierRow[]> {
  const bytes = await getUint8Array(file);
  const workbook = XLSX.read(bytes, { type: 'array' });

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('O arquivo XLSX de entregadores não possui planilhas válidas.');
  }

  const sheetName = workbook.SheetNames.find((s) => {
    const l = s.toLowerCase();
    return l.includes('entreg') || l.includes('courier') || l.includes('motoboy') || l.includes('resumo');
  }) || workbook.SheetNames[0];

  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error('Não foi possível ler a planilha de entregadores no arquivo XLSX.');
  }

  const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  if (!rows || rows.length === 0) {
    throw new Error('A planilha de entregadores está vazia ou sem linhas de dados.');
  }

  const result: ParsedCourierRow[] = [];

  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx];
    try {
      const rawDate = row['Data de criação'] || row['Data'];
      const deliveryDate = parseExcelDate(rawDate);

      const orderAmount = parseMoney(row['Valor do pedido'] || row['Total'] || '0');
      const externalId = String(row['Id do pedido'] || row['ID'] || '').trim();
      const orderNumber = String(row['Número do pedido'] || row['Numero'] || '').trim();
      const courierName = String(row['Entregador'] || row['Motoboy'] || '').trim();

      if (!externalId && !orderNumber && !courierName) {
        // Skip blank / footer rows
        continue;
      }

      result.push({
        courier_name: courierName || 'Sem entregador',
        external_order_id: externalId || orderNumber,
        order_number: orderNumber || externalId,
        delivery_date: deliveryDate,
        status: String(row['Status'] || 'Concluído').trim(),
        order_amount: Math.round(orderAmount * 100) / 100,
        neighborhood_name: String(row['Bairro'] || '').trim(),
        raw_data: row
      });
    } catch (rowErr) {
      console.warn(`Erro ao processar linha ${idx + 1} de entregadores:`, rowErr);
    }
  }

  return result;
}
