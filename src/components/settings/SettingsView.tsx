import React, { useState } from 'react';
import { 
  Settings, 
  Save, 
  MapPin, 
  Plus, 
  Edit3, 
  Check, 
  AlertTriangle, 
  Search, 
  ShieldCheck, 
  RefreshCw,
  X
} from 'lucide-react';
import { SystemSettings, NeighborhoodRate, NeighborhoodAlias } from '../../types';
import { formatCurrency } from '../../lib/formatters';
import { supabase } from '../../lib/supabase';
import { normalizeNeighborhoodName } from '../../lib/neighborhoodMatcher';
import { syncNeighborhoodRateToOrders, syncAllNeighborhoodRatesToOrders } from '../../lib/neighborhoodSync';

interface SettingsViewProps {
  settings: SystemSettings;
  neighborhoodRates: NeighborhoodRate[];
  neighborhoodAliases: NeighborhoodAlias[];
  onRefresh: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  neighborhoodRates,
  neighborhoodAliases,
  onRefresh
}) => {
  // Settings form states
  const [ifoodFee, setIfoodFee] = useState<number>(settings.ifood_fee_pct);
  const [aiqfomeFee, setAiqfomeFee] = useState<number>(settings.aiqfome_fee_pct);
  const [debitFee, setDebitFee] = useState<number>(settings.card_debit_fee_pct);
  const [creditFee, setCreditFee] = useState<number>(settings.card_credit_fee_pct);
  const [freeShippingCost, setFreeShippingCost] = useState<number>(settings.site_free_shipping_cost);
  const [couponSuggested, setCouponSuggested] = useState<number>(settings.coupon_suggested_amount);
  const [courierBaseRate, setCourierBaseRate] = useState<number>(settings.courier_base_rate);
  const [freelancerRate, setFreelancerRate] = useState<number>(settings.freelancer_default_rate);
  const [payableAlertDays, setPayableAlertDays] = useState<number>(settings.payable_alert_days);
  const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false);

  // Neighborhood management
  const [neighborhoodSearch, setNeighborhoodSearch] = useState<string>('');
  const [showAddNeighborhood, setShowAddNeighborhood] = useState<boolean>(false);
  const [newNeighborhoodName, setNewNeighborhoodName] = useState<string>('');
  const [newNeighborhoodRate, setNewNeighborhoodRate] = useState<number>(8.00);
  const [newNeighborhoodBlocked, setNewNeighborhoodBlocked] = useState<boolean>(false);

  // Edit Neighborhood state
  const [editingNeighborhood, setEditingNeighborhood] = useState<NeighborhoodRate | null>(null);
  const [editNeighborhoodName, setEditNeighborhoodName] = useState<string>('');
  const [editNeighborhoodRate, setEditNeighborhoodRate] = useState<number>(8.00);
  const [editNeighborhoodBaseRate, setEditNeighborhoodBaseRate] = useState<number>(8.00);
  const [editNeighborhoodBlocked, setEditNeighborhoodBlocked] = useState<boolean>(false);
  const [isSavingEditNeighborhood, setIsSavingEditNeighborhood] = useState<boolean>(false);
  const [isSyncingAll, setIsSyncingAll] = useState<boolean>(false);

  // Alias management
  const [showAddAlias, setShowAddAlias] = useState<boolean>(false);
  const [newAliasRaw, setNewAliasRaw] = useState<string>('');
  const [newAliasTargetId, setNewAliasTargetId] = useState<string>('');

  const filteredRates = neighborhoodRates.filter((r) => {
    if (!neighborhoodSearch) return true;
    const q = neighborhoodSearch.toLowerCase();
    return r.name.toLowerCase().includes(q) || r.total_rate.toString().includes(q);
  });

  const handleSyncAllRates = async () => {
    setIsSyncingAll(true);
    try {
      const result = await syncAllNeighborhoodRatesToOrders(settings);
      alert(`Sincronização concluída com sucesso!\n${result.ordersUpdated} pedidos e ${result.deliveriesUpdated} entregas atualizados com a tabela oficial.`);
      onRefresh();
    } catch (err: any) {
      alert('Erro ao sincronizar tarifas: ' + err.message);
    } finally {
      setIsSyncingAll(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      const { error } = await supabase
        .from('settings')
        .update({
          ifood_fee_pct: Number(ifoodFee),
          aiqfome_fee_pct: Number(aiqfomeFee),
          card_debit_fee_pct: Number(debitFee),
          card_credit_fee_pct: Number(creditFee),
          site_free_shipping_cost: Number(freeShippingCost),
          coupon_suggested_amount: Number(couponSuggested),
          courier_base_rate: Number(courierBaseRate),
          freelancer_default_rate: Number(freelancerRate),
          payable_alert_days: Number(payableAlertDays),
          updated_at: new Date().toISOString()
        })
        .eq('id', 1);

      if (error) throw error;
      alert('Configurações atualizadas com sucesso! As novas taxas serão aplicadas aos próximos cálculos sem alterar o histórico já fechado.');
      onRefresh();
    } catch (err: any) {
      alert('Erro ao salvar configurações: ' + err.message);
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleCreateNeighborhood = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNeighborhoodName.trim()) return;

    try {
      const norm = normalizeNeighborhoodName(newNeighborhoodName);
      const base = 8.00;
      const total = Number(newNeighborhoodRate) || 8.00;
      const add = Math.max(0, total - base);

      const { data: inserted, error } = await supabase.from('neighborhood_rates').insert({
        name: newNeighborhoodName.trim().toUpperCase(),
        normalized_name: norm,
        total_rate: total,
        base_rate: base,
        additional_rate: add,
        is_blocked: newNeighborhoodBlocked,
        is_active: true
      })
      .select()
      .single();

      if (error) throw error;

      if (inserted) {
        await syncNeighborhoodRateToOrders(inserted, undefined, settings);
      }

      setNewNeighborhoodName('');
      setShowAddNeighborhood(false);
      onRefresh();
    } catch (err: any) {
      alert('Erro ao cadastrar bairro: ' + err.message);
    }
  };

  const handleCreateAlias = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAliasRaw.trim() || !newAliasTargetId) return;

    try {
      const norm = normalizeNeighborhoodName(newAliasRaw);

      const { error } = await supabase.from('neighborhood_aliases').insert({
        raw_name: newAliasRaw.trim(),
        normalized_raw_name: norm,
        neighborhood_rate_id: newAliasTargetId,
        is_confirmed: true
      });

      if (error) throw error;

      const targetRate = neighborhoodRates.find((r) => r.id === newAliasTargetId);
      if (targetRate) {
        await syncNeighborhoodRateToOrders(targetRate, undefined, settings);
      }

      setNewAliasRaw('');
      setShowAddAlias(false);
      onRefresh();
    } catch (err: any) {
      alert('Erro ao criar alias: ' + err.message);
    }
  };

  const handleToggleBlocked = async (rate: NeighborhoodRate) => {
    try {
      const newBlocked = !rate.is_blocked;
      const { error } = await supabase
        .from('neighborhood_rates')
        .update({ is_blocked: newBlocked })
        .eq('id', rate.id);

      if (error) throw error;

      await syncNeighborhoodRateToOrders({ ...rate, is_blocked: newBlocked }, rate.name, settings);

      onRefresh();
    } catch (err: any) {
      alert('Erro ao alterar status: ' + err.message);
    }
  };

  const handleOpenEditNeighborhood = (rate: NeighborhoodRate) => {
    setEditingNeighborhood(rate);
    setEditNeighborhoodName(rate.name);
    setEditNeighborhoodRate(Number(rate.total_rate) || 8.00);
    setEditNeighborhoodBaseRate(Number(rate.base_rate) || 8.00);
    setEditNeighborhoodBlocked(Boolean(rate.is_blocked));
  };

  const handleSaveEditNeighborhood = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNeighborhood || !editNeighborhoodName.trim()) return;

    setIsSavingEditNeighborhood(true);
    try {
      const norm = normalizeNeighborhoodName(editNeighborhoodName);
      const total = Number(editNeighborhoodRate) || 8.00;
      const base = Number(editNeighborhoodBaseRate) || 8.00;
      const add = Math.max(0, Math.round((total - base) * 100) / 100);

      const updatedRateObj: NeighborhoodRate = {
        ...editingNeighborhood,
        name: editNeighborhoodName.trim().toUpperCase(),
        normalized_name: norm,
        total_rate: total,
        base_rate: base,
        additional_rate: add,
        is_blocked: editNeighborhoodBlocked,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('neighborhood_rates')
        .update({
          name: updatedRateObj.name,
          normalized_name: updatedRateObj.normalized_name,
          total_rate: updatedRateObj.total_rate,
          base_rate: updatedRateObj.base_rate,
          additional_rate: updatedRateObj.additional_rate,
          is_blocked: updatedRateObj.is_blocked,
          updated_at: updatedRateObj.updated_at
        })
        .eq('id', editingNeighborhood.id);

      if (error) throw error;

      await syncNeighborhoodRateToOrders(updatedRateObj, editingNeighborhood.name, settings);

      setEditingNeighborhood(null);
      onRefresh();
    } catch (err: any) {
      alert('Erro ao atualizar bairro: ' + err.message);
    } finally {
      setIsSavingEditNeighborhood(false);
    }
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.75rem', color: '#F8FAFC', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Settings size={28} color="#F43F5E" />
          Configurações do Sistema
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          Taxas das plataformas, maquininhas, entregadores e tabela oficial de bairros (PDF Central 2024)
        </p>
      </div>

      {/* Global Financial Parameters Form */}
      <div className="card" style={{ marginBottom: '32px' }}>
        <div className="card-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={18} color="#34D399" />
            <span>Taxas & Regras Financeiras Globais</span>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Alterações não afetam pedidos passados já concluídos
          </span>
        </div>

        <form onSubmit={handleSaveSettings}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '20px' }}>
            {/* Taxa iFood */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Taxa iFood (%)</label>
              <input
                type="number"
                step="0.1"
                className="input"
                value={ifoodFee}
                onChange={(e) => setIfoodFee(parseFloat(e.target.value) || 0)}
                required
              />
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Padrão: 15%</span>
            </div>

            {/* Taxa AiqFome */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Taxa AiqFome (%)</label>
              <input
                type="number"
                step="0.1"
                className="input"
                value={aiqfomeFee}
                onChange={(e) => setAiqfomeFee(parseFloat(e.target.value) || 0)}
                required
              />
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Padrão: 15%</span>
            </div>

            {/* Taxa Débito */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Cartão de Débito Maquininha (%)</label>
              <input
                type="number"
                step="0.01"
                className="input"
                value={debitFee}
                onChange={(e) => setDebitFee(parseFloat(e.target.value) || 0)}
                required
              />
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Padrão: 1,64%</span>
            </div>

            {/* Taxa Crédito */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Cartão de Crédito Maquininha (%)</label>
              <input
                type="number"
                step="0.01"
                className="input"
                value={creditFee}
                onChange={(e) => setCreditFee(parseFloat(e.target.value) || 0)}
                required
              />
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Padrão: 3,53%</span>
            </div>

            {/* Custo Entrega Grátis Cardápio Digital */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Custo Entrega Grátis Site (R$)</label>
              <input
                type="number"
                step="0.5"
                className="input"
                value={freeShippingCost}
                onChange={(e) => setFreeShippingCost(parseFloat(e.target.value) || 0)}
                required
              />
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Padrão: R$ 8,00</span>
            </div>

            {/* Cupom Sugerido */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Cupom Sugerido Cardápio (R$)</label>
              <input
                type="number"
                step="0.5"
                className="input"
                value={couponSuggested}
                onChange={(e) => setCouponSuggested(parseFloat(e.target.value) || 0)}
                required
              />
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Padrão: R$ 10,00</span>
            </div>

            {/* Base Motoboy */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Valor Base Motoboy (R$)</label>
              <input
                type="number"
                step="0.5"
                className="input"
                value={courierBaseRate}
                onChange={(e) => setCourierBaseRate(parseFloat(e.target.value) || 0)}
                required
              />
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Padrão: R$ 8,00 por entrega</span>
            </div>

            {/* Freelancer Padrão */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Freelancer Padrão (R$/h)</label>
              <input
                type="number"
                step="0.5"
                className="input"
                value={freelancerRate}
                onChange={(e) => setFreelancerRate(parseFloat(e.target.value) || 0)}
                required
              />
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Padrão: R$ 15,00/hora</span>
            </div>

            {/* Alerta de Contas */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Antecedência Alerta Contas (Dias)</label>
              <input
                type="number"
                min="1"
                max="30"
                className="input"
                value={payableAlertDays}
                onChange={(e) => setPayableAlertDays(parseInt(e.target.value) || 3)}
                required
              />
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Avisar 3, 5 ou 7 dias antes</span>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn-primary" disabled={isSavingSettings}>
              <Save size={16} />
              {isSavingSettings ? 'Salvando...' : 'Salvar Regras de Configuração'}
            </button>
          </div>
        </form>
      </div>

      {/* Neighborhoods & Rates Management (Section 11 & 12) */}
      <div className="card" style={{ marginBottom: '32px' }}>
        <div className="card-title" style={{ flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MapPin size={18} color="#FBBF24" />
              <span>Tabela Oficial de Tarifas por Bairro ({neighborhoodRates.length} cadastrados)</span>
            </div>
            <span style={{ 
              fontSize: '0.75rem', 
              padding: '2px 8px', 
              borderRadius: '12px', 
              background: 'rgba(16, 185, 129, 0.15)', 
              color: '#10B981', 
              border: '1px solid rgba(16, 185, 129, 0.3)',
              fontWeight: 500
            }}>
              ⚡ Sincronização Automática com Pedidos Ativa
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button 
              type="button"
              onClick={handleSyncAllRates} 
              className="btn btn-secondary btn-sm"
              disabled={isSyncingAll}
              title="Recalcular e sincronizar todas as taxas de bairros com todos os pedidos e entregas do sistema"
            >
              <RefreshCw size={14} className={isSyncingAll ? 'spin' : ''} />
              {isSyncingAll ? 'Sincronizando...' : 'Sincronizar Todos os Pedidos'}
            </button>
            <button onClick={() => setShowAddAlias(true)} className="btn btn-secondary btn-sm">
              + Novo Alias / Sinônimo
            </button>
            <button onClick={() => setShowAddNeighborhood(true)} className="btn btn-primary btn-sm">
              <Plus size={14} /> + Cadastrar Bairro
            </button>
          </div>
        </div>

        {/* Search */}
        <div style={{ marginBottom: '16px', maxWidth: '350px', position: 'relative' }}>
          <Search size={15} color="#64748B" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            className="input"
            value={neighborhoodSearch}
            onChange={(e) => setNeighborhoodSearch(e.target.value)}
            placeholder="Buscar bairro na tabela..."
            style={{ paddingLeft: '32px' }}
          />
        </div>

        <div className="table-container" style={{ maxHeight: '420px', overflowY: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Nome do Bairro</th>
                <th>Tarifa Total</th>
                <th>Base Motoboy</th>
                <th>Adicional Motoboy</th>
                <th>Bloqueado (bloq)</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredRates.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600, color: '#F8FAFC' }}>
                    {r.name}
                  </td>
                  <td style={{ fontWeight: 700 }}>
                    {formatCurrency(r.total_rate)}
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>
                    {formatCurrency(r.base_rate)}
                  </td>
                  <td style={{ color: Number(r.additional_rate) > 0 ? '#FBBF24' : 'var(--text-muted)', fontWeight: 600 }}>
                    +{formatCurrency(r.additional_rate)}
                  </td>
                  <td>
                    <span className={`badge ${r.is_blocked ? 'badge-danger' : 'badge-success'}`}>
                      {r.is_blocked ? 'BLOQUEADO' : 'LIBERADO'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        onClick={() => handleOpenEditNeighborhood(r)}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.75rem', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px', color: '#38BDF8' }}
                        title="Editar nome e taxas do bairro"
                      >
                        <Edit3 size={13} />
                        <span>Editar</span>
                      </button>
                      <button
                        onClick={() => handleToggleBlocked(r)}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.72rem', padding: '4px 8px' }}
                      >
                        {r.is_blocked ? 'Desbloquear' : 'Marcar Bloq'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Aliases List */}
      <div className="card">
        <div className="card-title">
          <span>Aliases Confirmados de Bairros ({neighborhoodAliases.length})</span>
          <button onClick={() => setShowAddAlias(true)} className="btn btn-secondary btn-sm">
            <Plus size={14} /> Adicionar Equivalência
          </button>
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
          Variações de escrita que o sistema reconhece e associa automaticamente ao bairro oficial do PDF:
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {neighborhoodAliases.map((a) => {
            const targetRate = neighborhoodRates.find((r) => r.id === a.neighborhood_rate_id);
            return (
              <span key={a.id} className="badge badge-neutral" style={{ padding: '6px 12px', fontSize: '0.78rem' }}>
                <strong style={{ color: '#FBBF24' }}>"{a.raw_name}"</strong> → {targetRate?.name || 'Oficial'}
              </span>
            );
          })}
        </div>
      </div>

      {/* Add Neighborhood Modal */}
      {showAddNeighborhood && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.2rem' }}>Cadastrar Novo Bairro</h3>
              <button onClick={() => setShowAddNeighborhood(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateNeighborhood}>
              <div className="form-group">
                <label className="form-label">Nome do Bairro *</label>
                <input
                  type="text"
                  className="input"
                  value={newNeighborhoodName}
                  onChange={(e) => setNewNeighborhoodName(e.target.value)}
                  placeholder="Ex: JARDIM EUROPA"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Tarifa Total de Entrega (R$) *</label>
                <input
                  type="number"
                  step="0.5"
                  className="input"
                  value={newNeighborhoodRate}
                  onChange={(e) => setNewNeighborhoodRate(parseFloat(e.target.value) || 8.00)}
                  required
                />
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', color: '#FB7185', marginBottom: '20px' }}>
                <input
                  type="checkbox"
                  checked={newNeighborhoodBlocked}
                  onChange={(e) => setNewNeighborhoodBlocked(e.target.checked)}
                />
                <span>Marcar como Bairro Bloqueado (bloq)</span>
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setShowAddNeighborhood(false)} className="btn btn-secondary">
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Salvar Bairro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Alias Modal */}
      {showAddAlias && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.2rem' }}>Novo Alias / Sinônimo de Bairro</h3>
              <button onClick={() => setShowAddAlias(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateAlias}>
              <div className="form-group">
                <label className="form-label">Nome como vem no Relatório Excel *</label>
                <input
                  type="text"
                  className="input"
                  value={newAliasRaw}
                  onChange={(e) => setNewAliasRaw(e.target.value)}
                  placeholder="Ex: Conj. Hab. Agua Limpa"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Associar ao Bairro Oficial da Tabela *</label>
                <select
                  className="select"
                  value={newAliasTargetId}
                  onChange={(e) => setNewAliasTargetId(e.target.value)}
                  required
                >
                  <option value="">Selecione o bairro oficial...</option>
                  {neighborhoodRates.map((r) => (
                    <option key={r.id} value={r.id}>{r.name} (R$ {r.total_rate.toFixed(2)})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button type="button" onClick={() => setShowAddAlias(false)} className="btn btn-secondary">
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Salvar Equivalência
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Neighborhood Modal */}
      {editingNeighborhood && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '460px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: '#F8FAFC' }}>
                <Edit3 size={20} color="#38BDF8" />
                Editar Bairro Cadastrado
              </h3>
              <button 
                type="button" 
                onClick={() => setEditingNeighborhood(null)} 
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEditNeighborhood}>
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label">Nome Oficial do Bairro *</label>
                <input
                  type="text"
                  className="input"
                  value={editNeighborhoodName}
                  onChange={(e) => setEditNeighborhoodName(e.target.value)}
                  placeholder="Ex: RESIDENCIAL JARDIM FLORESTA"
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Tarifa Total (R$) *</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    className="input"
                    value={editNeighborhoodRate}
                    onChange={(e) => setEditNeighborhoodRate(parseFloat(e.target.value) || 0)}
                    required
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Base Motoboy (R$) *</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    className="input"
                    value={editNeighborhoodBaseRate}
                    onChange={(e) => setEditNeighborhoodBaseRate(parseFloat(e.target.value) || 0)}
                    required
                  />
                </div>
              </div>

              {/* Live Additional Rate calculation preview */}
              <div style={{
                backgroundColor: 'rgba(56, 189, 248, 0.08)',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid rgba(56, 189, 248, 0.2)',
                marginBottom: '16px',
                fontSize: '0.85rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Adicional Motoboy calculado:</span>
                  <strong style={{ color: (editNeighborhoodRate - editNeighborhoodBaseRate) > 0 ? '#FBBF24' : '#34D399', fontSize: '0.95rem' }}>
                    +R$ {Math.max(0, editNeighborhoodRate - editNeighborhoodBaseRate).toFixed(2).replace('.', ',')}
                  </strong>
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.875rem', color: editNeighborhoodBlocked ? '#FB7185' : 'var(--text-primary)', marginBottom: '20px' }}>
                <input
                  type="checkbox"
                  checked={editNeighborhoodBlocked}
                  onChange={(e) => setEditNeighborhoodBlocked(e.target.checked)}
                  style={{ accentColor: '#FB7185', width: '16px', height: '16px' }}
                />
                <span>Marcar como Bairro Bloqueado (bloq)</span>
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button 
                  type="button" 
                  onClick={() => setEditingNeighborhood(null)} 
                  className="btn btn-secondary"
                  disabled={isSavingEditNeighborhood}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={isSavingEditNeighborhood}
                >
                  {isSavingEditNeighborhood ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
