/**
 * Commissions management page - configure commission rules and artist assignments.
 */

import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import {
  listCommissionRules,
  getCommissionRule,
  createCommissionRule,
  updateCommissionRule,
  deleteCommissionRule,
  listArtistsWithCommission,
  assignCommissionRule,
  calculateCommission,
  formatCentsToDollars,
  parseDollarsToCents,
} from '../services/commissions';
import type {
  CommissionRuleSummary,
  CommissionRule,
  CommissionRuleCreate,
  CommissionRuleUpdate,
  CommissionType,
  CommissionTierCreate,
  ArtistCommissionInfo,
  CommissionCalculationResult,
} from '../types/api';

// ============ Commission Rule Modal ============

interface RuleModalProps {
  isOpen: boolean;
  rule: CommissionRule | null;
  onClose: () => void;
  onSave: (data: CommissionRuleCreate | CommissionRuleUpdate, ruleId?: string) => Promise<void>;
}

function RuleModal({ isOpen, rule, onClose, onSave }: RuleModalProps) {
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    commission_type: CommissionType;
    percentage: string;
    flat_fee_amount: string;
    is_default: boolean;
    is_active: boolean;
    tiers: CommissionTierCreate[];
  }>({
    name: '',
    description: '',
    commission_type: 'percentage',
    percentage: '50',
    flat_fee_amount: '100',
    is_default: false,
    is_active: true,
    tiers: [
      { min_revenue: 0, max_revenue: 500000, percentage: 40 },
      { min_revenue: 500000, max_revenue: null, percentage: 50 },
    ],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (rule) {
      setFormData({
        name: rule.name,
        description: rule.description || '',
        commission_type: rule.commission_type,
        percentage: rule.percentage?.toString() || '50',
        flat_fee_amount: ((rule.flat_fee_amount || 0) / 100).toString(),
        is_default: rule.is_default,
        is_active: rule.is_active,
        tiers: rule.tiers.length > 0
          ? rule.tiers.map(t => ({
              min_revenue: t.min_revenue,
              max_revenue: t.max_revenue,
              percentage: t.percentage,
            }))
          : [
              { min_revenue: 0, max_revenue: 500000, percentage: 40 },
              { min_revenue: 500000, max_revenue: null, percentage: 50 },
            ],
      });
    } else {
      setFormData({
        name: '',
        description: '',
        commission_type: 'percentage',
        percentage: '50',
        flat_fee_amount: '100',
        is_default: false,
        is_active: true,
        tiers: [
          { min_revenue: 0, max_revenue: 500000, percentage: 40 },
          { min_revenue: 500000, max_revenue: null, percentage: 50 },
        ],
      });
    }
    setError('');
  }, [rule, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data: CommissionRuleCreate = {
        name: formData.name,
        description: formData.description || null,
        commission_type: formData.commission_type,
        percentage: formData.commission_type === 'percentage' ? parseFloat(formData.percentage) : null,
        flat_fee_amount: formData.commission_type === 'flat_fee' ? parseDollarsToCents(formData.flat_fee_amount) : null,
        is_default: formData.is_default,
        is_active: formData.is_active,
        tiers: formData.commission_type === 'tiered' ? formData.tiers : null,
      };

      await onSave(data, rule?.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save commission rule');
    } finally {
      setLoading(false);
    }
  };

  const addTier = () => {
    const lastTier = formData.tiers[formData.tiers.length - 1];
    const newMinRevenue = lastTier?.max_revenue || 0;
    setFormData({
      ...formData,
      tiers: [
        ...formData.tiers.slice(0, -1),
        { ...lastTier, max_revenue: newMinRevenue + 100000 },
        { min_revenue: newMinRevenue + 100000, max_revenue: null, percentage: 50 },
      ],
    });
  };

  const removeTier = (index: number) => {
    if (formData.tiers.length <= 2) return;
    const newTiers = formData.tiers.filter((_, i) => i !== index);
    // Fix the min_revenue of subsequent tiers
    for (let i = 1; i < newTiers.length; i++) {
      newTiers[i].min_revenue = newTiers[i - 1].max_revenue || 0;
    }
    setFormData({ ...formData, tiers: newTiers });
  };

  const updateTier = (index: number, field: keyof CommissionTierCreate, value: number | null) => {
    const newTiers = [...formData.tiers];
    newTiers[index] = { ...newTiers[index], [field]: value };

    // If updating max_revenue, update next tier's min_revenue
    if (field === 'max_revenue' && index < newTiers.length - 1) {
      newTiers[index + 1].min_revenue = value || 0;
    }

    setFormData({ ...formData, tiers: newTiers });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm overflow-y-auto py-8">
      <div className="bg-ink-800 rounded-xl border border-ink-700 p-6 w-full max-w-lg mx-4 my-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-ink-100">
            {rule ? 'Edit Commission Rule' : 'Create Commission Rule'}
          </h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-200">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink-300 mb-1.5">Rule Name</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 bg-ink-900 border border-ink-600 rounded-lg text-ink-100 placeholder-ink-500 focus:ring-2 focus:ring-accent-primary focus:border-transparent transition-all"
              placeholder="e.g., Standard Artist Commission"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-300 mb-1.5">Description</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 bg-ink-900 border border-ink-600 rounded-lg text-ink-100 placeholder-ink-500 focus:ring-2 focus:ring-accent-primary focus:border-transparent transition-all"
              placeholder="Optional description"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-300 mb-1.5">Commission Type</label>
            <select
              value={formData.commission_type}
              onChange={(e) => setFormData({ ...formData, commission_type: e.target.value as CommissionType })}
              className="w-full px-3 py-2 bg-ink-900 border border-ink-600 rounded-lg text-ink-100 focus:ring-2 focus:ring-accent-primary focus:border-transparent transition-all"
            >
              <option value="percentage">Percentage</option>
              <option value="flat_fee">Flat Fee</option>
              <option value="tiered">Tiered</option>
            </select>
          </div>

          {formData.commission_type === 'percentage' && (
            <div>
              <label className="block text-sm font-medium text-ink-300 mb-1.5">Percentage (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                required
                value={formData.percentage}
                onChange={(e) => setFormData({ ...formData, percentage: e.target.value })}
                className="w-full px-3 py-2 bg-ink-900 border border-ink-600 rounded-lg text-ink-100 placeholder-ink-500 focus:ring-2 focus:ring-accent-primary focus:border-transparent transition-all"
              />
              <p className="text-xs text-ink-500 mt-1">Artist receives this percentage of each service</p>
            </div>
          )}

          {formData.commission_type === 'flat_fee' && (
            <div>
              <label className="block text-sm font-medium text-ink-300 mb-1.5">Flat Fee ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={formData.flat_fee_amount}
                onChange={(e) => setFormData({ ...formData, flat_fee_amount: e.target.value })}
                className="w-full px-3 py-2 bg-ink-900 border border-ink-600 rounded-lg text-ink-100 placeholder-ink-500 focus:ring-2 focus:ring-accent-primary focus:border-transparent transition-all"
              />
              <p className="text-xs text-ink-500 mt-1">Fixed amount the studio takes per service</p>
            </div>
          )}

          {formData.commission_type === 'tiered' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-ink-300">Revenue Tiers</label>
                <button
                  type="button"
                  onClick={addTier}
                  className="text-xs text-accent-primary hover:text-accent-primary/80"
                >
                  + Add Tier
                </button>
              </div>
              <div className="space-y-2">
                {formData.tiers.map((tier, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-ink-900/50 rounded-lg">
                    <div className="flex-1">
                      <span className="text-xs text-ink-400">From</span>
                      <input
                        type="number"
                        min="0"
                        value={tier.min_revenue / 100}
                        onChange={(e) => updateTier(index, 'min_revenue', parseFloat(e.target.value) * 100)}
                        disabled={index === 0}
                        className="w-full px-2 py-1 bg-ink-900 border border-ink-600 rounded text-ink-100 text-sm disabled:opacity-50"
                      />
                    </div>
                    <div className="flex-1">
                      <span className="text-xs text-ink-400">To</span>
                      {tier.max_revenue === null ? (
                        <div className="px-2 py-1 text-ink-400 text-sm">Unlimited</div>
                      ) : (
                        <input
                          type="number"
                          min={tier.min_revenue / 100}
                          value={tier.max_revenue / 100}
                          onChange={(e) => updateTier(index, 'max_revenue', parseFloat(e.target.value) * 100)}
                          className="w-full px-2 py-1 bg-ink-900 border border-ink-600 rounded text-ink-100 text-sm"
                        />
                      )}
                    </div>
                    <div className="w-20">
                      <span className="text-xs text-ink-400">Rate %</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        value={tier.percentage}
                        onChange={(e) => updateTier(index, 'percentage', parseFloat(e.target.value))}
                        className="w-full px-2 py-1 bg-ink-900 border border-ink-600 rounded text-ink-100 text-sm"
                      />
                    </div>
                    {formData.tiers.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeTier(index)}
                        className="p-1 text-red-400 hover:text-red-300"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-ink-500 mt-1">Commission rate based on artist's total revenue in the period</p>
            </div>
          )}

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.is_default}
                onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                className="rounded border-ink-600 bg-ink-900 text-accent-primary focus:ring-accent-primary"
              />
              <span className="text-sm text-ink-300">Default rule for new artists</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="rounded border-ink-600 bg-ink-900 text-accent-primary focus:ring-accent-primary"
              />
              <span className="text-sm text-ink-300">Active</span>
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-ink-700 hover:bg-ink-600 text-ink-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-accent-primary hover:bg-accent-primary/90 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Saving...' : rule ? 'Update Rule' : 'Create Rule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============ Calculator Modal ============

interface CalculatorModalProps {
  isOpen: boolean;
  rule: CommissionRuleSummary | null;
  onClose: () => void;
}

function CalculatorModal({ isOpen, rule, onClose }: CalculatorModalProps) {
  const [amount, setAmount] = useState('500');
  const [result, setResult] = useState<CommissionCalculationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (rule && isOpen) {
      handleCalculate();
    }
  }, [rule, isOpen]);

  const handleCalculate = async () => {
    if (!rule) return;
    setError('');
    setLoading(true);
    try {
      const res = await calculateCommission(rule.id, { service_total: parseDollarsToCents(amount) });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Calculation failed');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !rule) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-ink-800 rounded-xl border border-ink-700 p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-ink-100">Commission Calculator</h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-200">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="text-sm text-ink-400 mb-4">Using rule: <span className="text-ink-200">{rule.name}</span></p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink-300 mb-1.5">Service Amount ($)</label>
            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="flex-1 px-3 py-2 bg-ink-900 border border-ink-600 rounded-lg text-ink-100 placeholder-ink-500 focus:ring-2 focus:ring-accent-primary focus:border-transparent transition-all"
              />
              <button
                onClick={handleCalculate}
                disabled={loading}
                className="px-4 py-2 bg-accent-primary hover:bg-accent-primary/90 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? '...' : 'Calculate'}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {result && (
            <div className="p-4 bg-ink-900/50 rounded-lg space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-ink-400">Service Total</span>
                <span className="text-ink-100 font-medium">{formatCentsToDollars(result.service_total)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-ink-400">Studio Commission</span>
                <span className="text-red-400 font-medium">-{formatCentsToDollars(result.commission_amount)}</span>
              </div>
              <div className="border-t border-ink-700 pt-3 flex justify-between">
                <span className="text-ink-300 font-medium">Artist Payout</span>
                <span className="text-green-400 font-semibold text-lg">{formatCentsToDollars(result.artist_payout)}</span>
              </div>
              <p className="text-xs text-ink-500 mt-2">{result.calculation_details}</p>
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          className="w-full mt-4 px-4 py-2 bg-ink-700 hover:bg-ink-600 text-ink-200 rounded-lg transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}

// ============ Commission Type Badge ============

function TypeBadge({ type }: { type: CommissionType }) {
  const styles: Record<CommissionType, string> = {
    percentage: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    flat_fee: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    tiered: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  };

  const labels: Record<CommissionType, string> = {
    percentage: 'Percentage',
    flat_fee: 'Flat Fee',
    tiered: 'Tiered',
  };

  return (
    <span className={`text-xs font-medium px-2 py-1 rounded-full border ${styles[type]}`}>
      {labels[type]}
    </span>
  );
}

// ============ Main Commissions Page ============

type TabType = 'rules' | 'assignments';

export function Commissions() {
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('rules');

  // Rules state
  const [rules, setRules] = useState<CommissionRuleSummary[]>([]);
  const [loadingRules, setLoadingRules] = useState(true);

  // Artists state
  const [artists, setArtists] = useState<ArtistCommissionInfo[]>([]);
  const [loadingArtists, setLoadingArtists] = useState(true);

  // Modal state
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<CommissionRule | null>(null);
  const [calculatorModalOpen, setCalculatorModalOpen] = useState(false);
  const [calculatorRule, setCalculatorRule] = useState<CommissionRuleSummary | null>(null);

  // Messages
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    loadRules();
    loadArtists();
  }, []);

  const loadRules = async () => {
    try {
      const response = await listCommissionRules(1, 100);
      setRules(response.rules);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load commission rules');
    } finally {
      setLoadingRules(false);
    }
  };

  const loadArtists = async () => {
    try {
      const response = await listArtistsWithCommission();
      setArtists(response.artists);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load artists');
    } finally {
      setLoadingArtists(false);
    }
  };

  const handleSaveRule = async (data: CommissionRuleCreate | CommissionRuleUpdate, ruleId?: string) => {
    if (ruleId) {
      await updateCommissionRule(ruleId, data);
      setSuccessMessage('Commission rule updated successfully');
    } else {
      await createCommissionRule(data as CommissionRuleCreate);
      setSuccessMessage('Commission rule created successfully');
    }
    setTimeout(() => setSuccessMessage(''), 5000);
    loadRules();
  };

  const handleDeleteRule = async (rule: CommissionRuleSummary) => {
    if (!confirm(`Are you sure you want to delete "${rule.name}"? This cannot be undone.`)) {
      return;
    }
    try {
      await deleteCommissionRule(rule.id);
      setSuccessMessage('Commission rule deleted successfully');
      setTimeout(() => setSuccessMessage(''), 5000);
      loadRules();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete rule');
    }
  };

  const handleEditRule = async (rule: CommissionRuleSummary) => {
    try {
      const fullRule = await getCommissionRule(rule.id);
      setEditingRule(fullRule);
      setRuleModalOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rule details');
    }
  };

  const handleAssignRule = async (artistId: string, ruleId: string | null) => {
    try {
      await assignCommissionRule(artistId, { commission_rule_id: ruleId });
      setSuccessMessage('Commission rule assigned successfully');
      setTimeout(() => setSuccessMessage(''), 5000);
      loadArtists();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign rule');
    }
  };

  // Only owners can access this page
  if (currentUser?.role !== 'owner') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <svg className="w-16 h-16 text-ink-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <h2 className="text-xl font-semibold text-ink-200">Access Denied</h2>
          <p className="text-ink-400 mt-1">Only studio owners can manage commissions.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-100">Commissions</h1>
          <p className="text-ink-400 mt-1">Configure commission rules and artist payouts.</p>
        </div>
        {activeTab === 'rules' && (
          <button
            onClick={() => {
              setEditingRule(null);
              setRuleModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-accent-primary hover:bg-accent-primary/90 text-white rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Create Rule
          </button>
        )}
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          {successMessage}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
          <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-300">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-ink-700">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('rules')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'rules'
                ? 'border-accent-primary text-accent-primary'
                : 'border-transparent text-ink-400 hover:text-ink-200'
            }`}
          >
            Commission Rules
          </button>
          <button
            onClick={() => setActiveTab('assignments')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'assignments'
                ? 'border-accent-primary text-accent-primary'
                : 'border-transparent text-ink-400 hover:text-ink-200'
            }`}
          >
            Artist Assignments
          </button>
        </nav>
      </div>

      {/* Rules Tab */}
      {activeTab === 'rules' && (
        <div className="bg-ink-800 rounded-xl border border-ink-700 overflow-hidden">
          {loadingRules ? (
            <div className="p-8 text-center">
              <div className="animate-spin w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full mx-auto"></div>
              <p className="text-ink-400 mt-2">Loading commission rules...</p>
            </div>
          ) : rules.length === 0 ? (
            <div className="p-8 text-center">
              <svg className="w-12 h-12 text-ink-500 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <h3 className="text-lg font-medium text-ink-200">No commission rules yet</h3>
              <p className="text-ink-400 mt-1">Create your first rule to start tracking artist payouts.</p>
              <button
                onClick={() => {
                  setEditingRule(null);
                  setRuleModalOpen(true);
                }}
                className="mt-4 px-4 py-2 bg-accent-primary hover:bg-accent-primary/90 text-white rounded-lg transition-colors"
              >
                Create Your First Rule
              </button>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-ink-700/50 border-b border-ink-700">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-medium text-ink-300">Name</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-ink-300">Type</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-ink-300">Rate</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-ink-300">Artists</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-ink-300">Status</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-ink-300">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-700">
                {rules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-ink-700/30 transition-colors">
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium text-ink-100">
                          {rule.name}
                          {rule.is_default && (
                            <span className="ml-2 text-xs bg-accent-primary/10 text-accent-primary px-2 py-0.5 rounded-full">
                              Default
                            </span>
                          )}
                        </p>
                        {rule.description && (
                          <p className="text-xs text-ink-400 mt-0.5">{rule.description}</p>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <TypeBadge type={rule.commission_type} />
                    </td>
                    <td className="py-3 px-4 text-sm text-ink-200">
                      {rule.commission_type === 'percentage' && `${rule.percentage}%`}
                      {rule.commission_type === 'flat_fee' && formatCentsToDollars(rule.flat_fee_amount || 0)}
                      {rule.commission_type === 'tiered' && 'Variable'}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-ink-300">{rule.assigned_artist_count}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-xs font-medium px-2 py-1 rounded-full ${
                          rule.is_active
                            ? 'bg-green-500/10 text-green-400'
                            : 'bg-red-500/10 text-red-400'
                        }`}
                      >
                        {rule.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setCalculatorRule(rule);
                            setCalculatorModalOpen(true);
                          }}
                          className="p-1.5 text-ink-400 hover:text-ink-200 hover:bg-ink-700 rounded transition-colors"
                          title="Calculator"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleEditRule(rule)}
                          className="p-1.5 text-ink-400 hover:text-ink-200 hover:bg-ink-700 rounded transition-colors"
                          title="Edit"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteRule(rule)}
                          className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Artist Assignments Tab */}
      {activeTab === 'assignments' && (
        <div className="bg-ink-800 rounded-xl border border-ink-700 overflow-hidden">
          {loadingArtists ? (
            <div className="p-8 text-center">
              <div className="animate-spin w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full mx-auto"></div>
              <p className="text-ink-400 mt-2">Loading artists...</p>
            </div>
          ) : artists.length === 0 ? (
            <div className="p-8 text-center">
              <svg className="w-12 h-12 text-ink-500 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <h3 className="text-lg font-medium text-ink-200">No artists yet</h3>
              <p className="text-ink-400 mt-1">Add artists to your team to assign commission rules.</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-ink-700/50 border-b border-ink-700">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-medium text-ink-300">Artist</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-ink-300">Email</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-ink-300">Commission Rule</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-700">
                {artists.map((artist) => (
                  <tr key={artist.id} className="hover:bg-ink-700/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-accent-primary/10 flex items-center justify-center text-accent-primary font-medium">
                          {artist.first_name[0]}{artist.last_name[0]}
                        </div>
                        <p className="font-medium text-ink-100">
                          {artist.first_name} {artist.last_name}
                        </p>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-ink-300">{artist.email}</td>
                    <td className="py-3 px-4">
                      <select
                        value={artist.commission_rule_id || ''}
                        onChange={(e) => handleAssignRule(artist.id, e.target.value || null)}
                        className="px-3 py-1.5 bg-ink-900 border border-ink-600 rounded-lg text-ink-100 text-sm focus:ring-2 focus:ring-accent-primary focus:border-transparent transition-all"
                      >
                        <option value="">No rule assigned (use default)</option>
                        {rules.filter(r => r.is_active).map((rule) => (
                          <option key={rule.id} value={rule.id}>
                            {rule.name}
                            {rule.commission_type === 'percentage' && ` (${rule.percentage}%)`}
                            {rule.commission_type === 'flat_fee' && ` (${formatCentsToDollars(rule.flat_fee_amount || 0)})`}
                            {rule.is_default && ' - Default'}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Modals */}
      <RuleModal
        isOpen={ruleModalOpen}
        rule={editingRule}
        onClose={() => {
          setRuleModalOpen(false);
          setEditingRule(null);
        }}
        onSave={handleSaveRule}
      />
      <CalculatorModal
        isOpen={calculatorModalOpen}
        rule={calculatorRule}
        onClose={() => {
          setCalculatorModalOpen(false);
          setCalculatorRule(null);
        }}
      />
    </div>
  );
}

export default Commissions;
