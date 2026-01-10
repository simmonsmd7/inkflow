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
  listPayPeriods,
  createPayPeriod,
  getPayPeriod,
  closePayPeriod,
  markPayPeriodPaid,
  deletePayPeriod,
  listUnassignedCommissions,
  assignToPayPeriod,
  getPayPeriodSettings,
  updatePayPeriodSettings,
  getPayoutHistory,
  getArtistPayoutsReport,
  getTipSettings,
  updateTipSettings,
  getTipReport,
  exportPayPeriodsCsv,
  exportPayPeriodsPdf,
  exportArtistPayoutsCsv,
  exportArtistPayoutsPdf,
  exportTipsCsv,
  exportTipsPdf,
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
  PayPeriodSummary,
  PayPeriodWithCommissions,
  PayPeriodSchedule,
  PayPeriodStatus,
  PayPeriodSettings,
  EarnedCommission,
  PayoutHistoryResponse,
  ArtistPayoutReportResponse,
  TipSettings,
  TipReportResponse,
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

type TabType = 'rules' | 'assignments' | 'pay_periods' | 'reports' | 'tips';

const SCHEDULE_LABELS: Record<PayPeriodSchedule, string> = {
  weekly: 'Weekly',
  biweekly: 'Bi-weekly',
  semimonthly: 'Semi-monthly (1st & 15th)',
  monthly: 'Monthly',
};

const STATUS_CONFIG: Record<PayPeriodStatus, { label: string; color: string }> = {
  open: { label: 'Open', color: 'bg-blue-500/10 text-blue-400' },
  closed: { label: 'Closed', color: 'bg-yellow-500/10 text-yellow-400' },
  paid: { label: 'Paid', color: 'bg-green-500/10 text-green-400' },
};

export function Commissions() {
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('rules');

  // Rules state
  const [rules, setRules] = useState<CommissionRuleSummary[]>([]);
  const [loadingRules, setLoadingRules] = useState(true);

  // Artists state
  const [artists, setArtists] = useState<ArtistCommissionInfo[]>([]);
  const [loadingArtists, setLoadingArtists] = useState(true);

  // Pay periods state
  const [payPeriods, setPayPeriods] = useState<PayPeriodSummary[]>([]);
  const [loadingPayPeriods, setLoadingPayPeriods] = useState(true);
  const [payPeriodSettings, setPayPeriodSettings] = useState<PayPeriodSettings | null>(null);
  const [unassignedCommissions, setUnassignedCommissions] = useState<EarnedCommission[]>([]);
  const [selectedPayPeriod, setSelectedPayPeriod] = useState<PayPeriodWithCommissions | null>(null);

  // Reports state
  const [payoutHistory, setPayoutHistory] = useState<PayoutHistoryResponse | null>(null);
  const [artistPayouts, setArtistPayouts] = useState<ArtistPayoutReportResponse | null>(null);
  const [loadingReports, setLoadingReports] = useState(true);
  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate, setReportEndDate] = useState('');
  const [reportView, setReportView] = useState<'history' | 'artists'>('history');
  const [expandedPayPeriod, setExpandedPayPeriod] = useState<string | null>(null);

  // Tips state
  const [tipSettings, setTipSettings] = useState<TipSettings | null>(null);
  const [tipReport, setTipReport] = useState<TipReportResponse | null>(null);
  const [loadingTips, setLoadingTips] = useState(true);
  const [tipStartDate, setTipStartDate] = useState('');
  const [tipEndDate, setTipEndDate] = useState('');
  const [savingTipSettings, setSavingTipSettings] = useState(false);
  const [editingTipPercentage, setEditingTipPercentage] = useState<number | null>(null);

  // Export state
  const [exporting, setExporting] = useState(false);
  const [exportDropdownOpen, setExportDropdownOpen] = useState<string | null>(null);

  // Modal state
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<CommissionRule | null>(null);
  const [calculatorModalOpen, setCalculatorModalOpen] = useState(false);
  const [calculatorRule, setCalculatorRule] = useState<CommissionRuleSummary | null>(null);
  const [payPeriodModalOpen, setPayPeriodModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);

  // Messages
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    loadRules();
    loadArtists();
    loadPayPeriods();
    loadPayPeriodSettings();
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

  const loadPayPeriods = async () => {
    try {
      const response = await listPayPeriods(1, 50);
      setPayPeriods(response.pay_periods);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pay periods');
    } finally {
      setLoadingPayPeriods(false);
    }
  };

  const loadPayPeriodSettings = async () => {
    try {
      const settings = await getPayPeriodSettings();
      setPayPeriodSettings(settings);
    } catch (err) {
      // Settings might not exist yet, that's okay
      console.log('No pay period settings found');
    }
  };

  const loadUnassignedCommissions = async () => {
    try {
      const response = await listUnassignedCommissions(1, 100);
      setUnassignedCommissions(response.commissions);
    } catch (err) {
      console.error('Failed to load unassigned commissions:', err);
    }
  };

  const loadReports = async () => {
    setLoadingReports(true);
    try {
      const options = {
        startDate: reportStartDate || undefined,
        endDate: reportEndDate || undefined,
      };
      const [historyResponse, artistsResponse] = await Promise.all([
        getPayoutHistory(1, 50, options),
        getArtistPayoutsReport(options),
      ]);
      setPayoutHistory(historyResponse);
      setArtistPayouts(artistsResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reports');
    } finally {
      setLoadingReports(false);
    }
  };

  // Load reports when switching to reports tab or when date filters change
  useEffect(() => {
    if (activeTab === 'reports') {
      loadReports();
    }
  }, [activeTab, reportStartDate, reportEndDate]);

  const loadTips = async () => {
    setLoadingTips(true);
    try {
      const options = {
        startDate: tipStartDate || undefined,
        endDate: tipEndDate || undefined,
      };
      const [settings, report] = await Promise.all([
        getTipSettings(),
        getTipReport(options),
      ]);
      setTipSettings(settings);
      setTipReport(report);
      if (editingTipPercentage === null) {
        setEditingTipPercentage(settings.tip_artist_percentage);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tip data');
    } finally {
      setLoadingTips(false);
    }
  };

  // Load tips when switching to tips tab or when date filters change
  useEffect(() => {
    if (activeTab === 'tips') {
      loadTips();
    }
  }, [activeTab, tipStartDate, tipEndDate]);

  const handleSaveTipSettings = async () => {
    if (editingTipPercentage === null) return;
    setSavingTipSettings(true);
    try {
      await updateTipSettings({ tip_artist_percentage: editingTipPercentage });
      setTipSettings({ tip_artist_percentage: editingTipPercentage });
      setSuccessMessage('Tip settings updated successfully');
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update tip settings');
    } finally {
      setSavingTipSettings(false);
    }
  };

  // Export handlers
  const handleExportPayPeriods = async (format: 'csv' | 'pdf') => {
    setExporting(true);
    setExportDropdownOpen(null);
    try {
      if (format === 'csv') {
        await exportPayPeriodsCsv();
      } else {
        await exportPayPeriodsPdf();
      }
      setSuccessMessage('Export downloaded successfully');
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export pay periods');
    } finally {
      setExporting(false);
    }
  };

  const handleExportArtistPayouts = async (format: 'csv' | 'pdf') => {
    setExporting(true);
    setExportDropdownOpen(null);
    try {
      const options = {
        startDate: reportStartDate || undefined,
        endDate: reportEndDate || undefined,
      };
      if (format === 'csv') {
        await exportArtistPayoutsCsv(options);
      } else {
        await exportArtistPayoutsPdf(options);
      }
      setSuccessMessage('Export downloaded successfully');
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export artist payouts');
    } finally {
      setExporting(false);
    }
  };

  const handleExportTips = async (format: 'csv' | 'pdf') => {
    setExporting(true);
    setExportDropdownOpen(null);
    try {
      const options = {
        startDate: tipStartDate || undefined,
        endDate: tipEndDate || undefined,
      };
      if (format === 'csv') {
        await exportTipsCsv(options);
      } else {
        await exportTipsPdf(options);
      }
      setSuccessMessage('Export downloaded successfully');
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export tips report');
    } finally {
      setExporting(false);
    }
  };

  const handleCreatePayPeriod = async (startDate: string, endDate: string) => {
    try {
      await createPayPeriod({ start_date: startDate, end_date: endDate });
      setSuccessMessage('Pay period created successfully');
      setTimeout(() => setSuccessMessage(''), 5000);
      setPayPeriodModalOpen(false);
      loadPayPeriods();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create pay period');
    }
  };

  const handleViewPayPeriod = async (payPeriod: PayPeriodSummary) => {
    try {
      const fullPayPeriod = await getPayPeriod(payPeriod.id);
      setSelectedPayPeriod(fullPayPeriod);
      loadUnassignedCommissions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pay period details');
    }
  };

  const handleClosePayPeriod = async (payPeriodId: string, notes?: string) => {
    try {
      await closePayPeriod(payPeriodId, { notes });
      setSuccessMessage('Pay period closed successfully');
      setTimeout(() => setSuccessMessage(''), 5000);
      setSelectedPayPeriod(null);
      loadPayPeriods();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to close pay period');
    }
  };

  const handleMarkPaid = async (payPeriodId: string, payoutReference?: string, paymentNotes?: string) => {
    try {
      await markPayPeriodPaid(payPeriodId, {
        payout_reference: payoutReference,
        payment_notes: paymentNotes,
      });
      setSuccessMessage('Pay period marked as paid');
      setTimeout(() => setSuccessMessage(''), 5000);
      setPayModalOpen(false);
      setSelectedPayPeriod(null);
      loadPayPeriods();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark pay period as paid');
    }
  };

  const handleDeletePayPeriod = async (payPeriodId: string) => {
    if (!confirm('Are you sure you want to delete this pay period?')) return;
    try {
      await deletePayPeriod(payPeriodId);
      setSuccessMessage('Pay period deleted successfully');
      setTimeout(() => setSuccessMessage(''), 5000);
      setSelectedPayPeriod(null);
      loadPayPeriods();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete pay period');
    }
  };

  const handleAssignCommissions = async (payPeriodId: string, commissionIds: string[]) => {
    try {
      await assignToPayPeriod(payPeriodId, { commission_ids: commissionIds });
      setSuccessMessage('Commissions assigned successfully');
      setTimeout(() => setSuccessMessage(''), 5000);
      setAssignModalOpen(false);
      // Reload the pay period to see updated totals
      const updatedPayPeriod = await getPayPeriod(payPeriodId);
      setSelectedPayPeriod(updatedPayPeriod);
      loadUnassignedCommissions();
      loadPayPeriods();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign commissions');
    }
  };

  const handleUpdateSettings = async (schedule: PayPeriodSchedule, startDay: number) => {
    try {
      await updatePayPeriodSettings({
        pay_period_schedule: schedule,
        pay_period_start_day: startDay,
      });
      setPayPeriodSettings({ pay_period_schedule: schedule, pay_period_start_day: startDay });
      setSuccessMessage('Pay period settings updated');
      setTimeout(() => setSuccessMessage(''), 5000);
      setSettingsModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update settings');
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
        {activeTab === 'pay_periods' && !selectedPayPeriod && (
          <div className="flex items-center gap-2">
            {/* Export Dropdown */}
            <div className="relative">
              <button
                onClick={() => setExportDropdownOpen(exportDropdownOpen === 'pay_periods' ? null : 'pay_periods')}
                disabled={exporting}
                className="flex items-center gap-2 px-4 py-2 bg-ink-700 hover:bg-ink-600 text-ink-200 rounded-lg transition-colors disabled:opacity-50"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                {exporting ? 'Exporting...' : 'Export'}
              </button>
              {exportDropdownOpen === 'pay_periods' && (
                <div className="absolute right-0 mt-2 w-48 bg-ink-800 border border-ink-700 rounded-lg shadow-xl z-10">
                  <button
                    onClick={() => handleExportPayPeriods('csv')}
                    className="w-full text-left px-4 py-2 text-ink-200 hover:bg-ink-700 rounded-t-lg"
                  >
                    Export as CSV
                  </button>
                  <button
                    onClick={() => handleExportPayPeriods('pdf')}
                    className="w-full text-left px-4 py-2 text-ink-200 hover:bg-ink-700 rounded-b-lg"
                  >
                    Export as PDF
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={() => setSettingsModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-ink-700 hover:bg-ink-600 text-ink-200 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Settings
            </button>
            <button
              onClick={() => setPayPeriodModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-accent-primary hover:bg-accent-primary/90 text-white rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Create Pay Period
            </button>
          </div>
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
          <button
            onClick={() => setActiveTab('pay_periods')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'pay_periods'
                ? 'border-accent-primary text-accent-primary'
                : 'border-transparent text-ink-400 hover:text-ink-200'
            }`}
          >
            Pay Periods
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'reports'
                ? 'border-accent-primary text-accent-primary'
                : 'border-transparent text-ink-400 hover:text-ink-200'
            }`}
          >
            Payout Reports
          </button>
          <button
            onClick={() => setActiveTab('tips')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'tips'
                ? 'border-accent-primary text-accent-primary'
                : 'border-transparent text-ink-400 hover:text-ink-200'
            }`}
          >
            Tips
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

      {/* Pay Periods Tab */}
      {activeTab === 'pay_periods' && !selectedPayPeriod && (
        <div className="space-y-4">
          {/* Settings Summary */}
          {payPeriodSettings && (
            <div className="bg-ink-800 rounded-xl border border-ink-700 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-ink-300">Pay Period Schedule</h3>
                  <p className="text-ink-100 mt-1">
                    {SCHEDULE_LABELS[payPeriodSettings.pay_period_schedule]}
                    {payPeriodSettings.pay_period_schedule === 'weekly' || payPeriodSettings.pay_period_schedule === 'biweekly'
                      ? ` (starting ${['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][payPeriodSettings.pay_period_start_day]})`
                      : ` (starting on day ${payPeriodSettings.pay_period_start_day})`}
                  </p>
                </div>
                <button
                  onClick={() => setSettingsModalOpen(true)}
                  className="text-sm text-accent-primary hover:text-accent-primary/80"
                >
                  Change
                </button>
              </div>
            </div>
          )}

          {/* Pay Periods List */}
          <div className="bg-ink-800 rounded-xl border border-ink-700 overflow-hidden">
            {loadingPayPeriods ? (
              <div className="p-8 text-center">
                <div className="animate-spin w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full mx-auto"></div>
                <p className="text-ink-400 mt-2">Loading pay periods...</p>
              </div>
            ) : payPeriods.length === 0 ? (
              <div className="p-8 text-center">
                <svg className="w-12 h-12 text-ink-500 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <h3 className="text-lg font-medium text-ink-200">No pay periods yet</h3>
                <p className="text-ink-400 mt-1">Create your first pay period to start tracking payouts.</p>
                <button
                  onClick={() => setPayPeriodModalOpen(true)}
                  className="mt-4 px-4 py-2 bg-accent-primary hover:bg-accent-primary/90 text-white rounded-lg transition-colors"
                >
                  Create Your First Pay Period
                </button>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-ink-700/50 border-b border-ink-700">
                  <tr>
                    <th className="text-left py-3 px-4 text-sm font-medium text-ink-300">Period</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-ink-300">Status</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-ink-300">Commissions</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-ink-300">Artist Payout</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-ink-300">Studio Commission</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-ink-300">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-700">
                  {payPeriods.map((pp) => (
                    <tr key={pp.id} className="hover:bg-ink-700/30 transition-colors cursor-pointer" onClick={() => handleViewPayPeriod(pp)}>
                      <td className="py-3 px-4">
                        <p className="font-medium text-ink-100">
                          {new Date(pp.start_date).toLocaleDateString()} - {new Date(pp.end_date).toLocaleDateString()}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_CONFIG[pp.status].color}`}>
                          {STATUS_CONFIG[pp.status].label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right text-sm text-ink-200">{pp.commission_count}</td>
                      <td className="py-3 px-4 text-right text-sm text-ink-200">{formatCentsToDollars(pp.total_artist_payout)}</td>
                      <td className="py-3 px-4 text-right text-sm text-ink-200">{formatCentsToDollars(pp.total_studio_commission)}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewPayPeriod(pp);
                          }}
                          className="text-accent-primary hover:text-accent-primary/80 text-sm"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Pay Period Detail View */}
      {activeTab === 'pay_periods' && selectedPayPeriod && (
        <div className="space-y-4">
          {/* Back Button */}
          <button
            onClick={() => setSelectedPayPeriod(null)}
            className="flex items-center gap-2 text-ink-400 hover:text-ink-200 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Pay Periods
          </button>

          {/* Period Header */}
          <div className="bg-ink-800 rounded-xl border border-ink-700 p-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold text-ink-100">
                  {new Date(selectedPayPeriod.start_date).toLocaleDateString()} - {new Date(selectedPayPeriod.end_date).toLocaleDateString()}
                </h2>
                <span className={`inline-block mt-2 text-xs font-medium px-2 py-1 rounded-full ${STATUS_CONFIG[selectedPayPeriod.status].color}`}>
                  {STATUS_CONFIG[selectedPayPeriod.status].label}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {selectedPayPeriod.status === 'open' && (
                  <>
                    <button
                      onClick={() => setAssignModalOpen(true)}
                      className="px-3 py-1.5 bg-ink-700 hover:bg-ink-600 text-ink-200 rounded-lg text-sm transition-colors"
                    >
                      Assign Commissions
                    </button>
                    <button
                      onClick={() => handleClosePayPeriod(selectedPayPeriod.id)}
                      className="px-3 py-1.5 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 rounded-lg text-sm transition-colors"
                    >
                      Close Period
                    </button>
                    <button
                      onClick={() => handleDeletePayPeriod(selectedPayPeriod.id)}
                      className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-sm transition-colors"
                    >
                      Delete
                    </button>
                  </>
                )}
                {selectedPayPeriod.status === 'closed' && (
                  <button
                    onClick={() => setPayModalOpen(true)}
                    className="px-3 py-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-400 rounded-lg text-sm transition-colors"
                  >
                    Mark as Paid
                  </button>
                )}
              </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-4 gap-4 mt-6">
              <div className="bg-ink-900 rounded-lg p-4">
                <p className="text-sm text-ink-400">Total Service</p>
                <p className="text-xl font-semibold text-ink-100 mt-1">{formatCentsToDollars(selectedPayPeriod.total_service)}</p>
              </div>
              <div className="bg-ink-900 rounded-lg p-4">
                <p className="text-sm text-ink-400">Studio Commission</p>
                <p className="text-xl font-semibold text-ink-100 mt-1">{formatCentsToDollars(selectedPayPeriod.total_studio_commission)}</p>
              </div>
              <div className="bg-ink-900 rounded-lg p-4">
                <p className="text-sm text-ink-400">Artist Payouts</p>
                <p className="text-xl font-semibold text-ink-100 mt-1">{formatCentsToDollars(selectedPayPeriod.total_artist_payout)}</p>
              </div>
              <div className="bg-ink-900 rounded-lg p-4">
                <p className="text-sm text-ink-400">Tips</p>
                <p className="text-xl font-semibold text-ink-100 mt-1">{formatCentsToDollars(selectedPayPeriod.total_tips)}</p>
              </div>
            </div>

            {selectedPayPeriod.payout_reference && (
              <div className="mt-4 p-3 bg-green-500/10 rounded-lg">
                <p className="text-sm text-green-400">
                  Payout Reference: <span className="font-mono">{selectedPayPeriod.payout_reference}</span>
                </p>
              </div>
            )}
          </div>

          {/* Commissions Table */}
          <div className="bg-ink-800 rounded-xl border border-ink-700 overflow-hidden">
            <div className="p-4 border-b border-ink-700">
              <h3 className="font-medium text-ink-100">Commissions in this Period ({selectedPayPeriod.commission_count})</h3>
            </div>
            {selectedPayPeriod.commissions.length === 0 ? (
              <div className="p-8 text-center text-ink-400">
                No commissions assigned to this pay period yet.
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-ink-700/50 border-b border-ink-700">
                  <tr>
                    <th className="text-left py-3 px-4 text-sm font-medium text-ink-300">Artist</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-ink-300">Client</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-ink-300">Completed</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-ink-300">Service</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-ink-300">Studio</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-ink-300">Artist</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-ink-300">Tips</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-700">
                  {selectedPayPeriod.commissions.map((comm) => (
                    <tr key={comm.id} className="hover:bg-ink-700/30">
                      <td className="py-3 px-4 text-sm text-ink-200">{comm.artist_name || 'Unknown'}</td>
                      <td className="py-3 px-4 text-sm text-ink-200">{comm.client_name}</td>
                      <td className="py-3 px-4 text-sm text-ink-400">{new Date(comm.completed_at).toLocaleDateString()}</td>
                      <td className="py-3 px-4 text-sm text-ink-200 text-right">{formatCentsToDollars(comm.service_total)}</td>
                      <td className="py-3 px-4 text-sm text-ink-200 text-right">{formatCentsToDollars(comm.studio_commission)}</td>
                      <td className="py-3 px-4 text-sm text-ink-200 text-right">{formatCentsToDollars(comm.artist_payout)}</td>
                      <td className="py-3 px-4 text-sm text-ink-200 text-right">{formatCentsToDollars(comm.tips_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Reports Tab */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="bg-ink-800 rounded-xl border border-ink-700 p-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-ink-300 mb-1">Start Date</label>
                <input
                  type="date"
                  value={reportStartDate}
                  onChange={(e) => setReportStartDate(e.target.value)}
                  className="w-full px-3 py-2 bg-ink-900 border border-ink-700 rounded-lg text-ink-100 focus:outline-none focus:border-accent-primary"
                />
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-ink-300 mb-1">End Date</label>
                <input
                  type="date"
                  value={reportEndDate}
                  onChange={(e) => setReportEndDate(e.target.value)}
                  className="w-full px-3 py-2 bg-ink-900 border border-ink-700 rounded-lg text-ink-100 focus:outline-none focus:border-accent-primary"
                />
              </div>
              <button
                onClick={() => {
                  setReportStartDate('');
                  setReportEndDate('');
                }}
                className="px-4 py-2 text-ink-400 hover:text-ink-200 transition-colors"
              >
                Clear Filters
              </button>
              {/* Export Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setExportDropdownOpen(exportDropdownOpen === 'reports' ? null : 'reports')}
                  disabled={exporting}
                  className="flex items-center gap-2 px-4 py-2 bg-ink-700 hover:bg-ink-600 text-ink-200 rounded-lg transition-colors disabled:opacity-50"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  {exporting ? 'Exporting...' : 'Export'}
                </button>
                {exportDropdownOpen === 'reports' && (
                  <div className="absolute right-0 mt-2 w-48 bg-ink-800 border border-ink-700 rounded-lg shadow-xl z-10">
                    <button
                      onClick={() => handleExportArtistPayouts('csv')}
                      className="w-full text-left px-4 py-2 text-ink-200 hover:bg-ink-700 rounded-t-lg"
                    >
                      Export as CSV
                    </button>
                    <button
                      onClick={() => handleExportArtistPayouts('pdf')}
                      className="w-full text-left px-4 py-2 text-ink-200 hover:bg-ink-700 rounded-b-lg"
                    >
                      Export as PDF
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* View Toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setReportView('history')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                reportView === 'history'
                  ? 'bg-accent-primary text-white'
                  : 'bg-ink-700 text-ink-300 hover:text-ink-100'
              }`}
            >
              Payout History
            </button>
            <button
              onClick={() => setReportView('artists')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                reportView === 'artists'
                  ? 'bg-accent-primary text-white'
                  : 'bg-ink-700 text-ink-300 hover:text-ink-100'
              }`}
            >
              Artist Breakdown
            </button>
          </div>

          {loadingReports ? (
            <div className="p-8 text-center">
              <div className="animate-spin w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full mx-auto"></div>
              <p className="text-ink-400 mt-2">Loading reports...</p>
            </div>
          ) : reportView === 'history' ? (
            <div className="space-y-4">
              {/* Summary Cards */}
              {payoutHistory && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-ink-800 rounded-xl border border-ink-700 p-4">
                    <p className="text-ink-400 text-sm">Total Paid Out</p>
                    <p className="text-2xl font-bold text-ink-100">{formatCentsToDollars(payoutHistory.summary.total_artist_payout)}</p>
                  </div>
                  <div className="bg-ink-800 rounded-xl border border-ink-700 p-4">
                    <p className="text-ink-400 text-sm">Studio Revenue</p>
                    <p className="text-2xl font-bold text-ink-100">{formatCentsToDollars(payoutHistory.summary.total_studio_commission)}</p>
                  </div>
                  <div className="bg-ink-800 rounded-xl border border-ink-700 p-4">
                    <p className="text-ink-400 text-sm">Pay Periods</p>
                    <p className="text-2xl font-bold text-ink-100">{payoutHistory.summary.total_pay_periods}</p>
                  </div>
                  <div className="bg-ink-800 rounded-xl border border-ink-700 p-4">
                    <p className="text-ink-400 text-sm">Artists Paid</p>
                    <p className="text-2xl font-bold text-ink-100">{payoutHistory.summary.artists_paid}</p>
                  </div>
                </div>
              )}

              {/* Payout History Table */}
              <div className="bg-ink-800 rounded-xl border border-ink-700 overflow-hidden">
                {!payoutHistory || payoutHistory.history.length === 0 ? (
                  <div className="p-8 text-center">
                    <svg className="w-12 h-12 text-ink-500 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <h3 className="text-lg font-medium text-ink-200">No payout history yet</h3>
                    <p className="text-ink-400 mt-1">Complete pay periods to see payout history.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-ink-700">
                    {payoutHistory.history.map((item) => (
                      <div key={item.id}>
                        <div
                          onClick={() => setExpandedPayPeriod(expandedPayPeriod === item.id ? null : item.id)}
                          className="flex items-center gap-4 p-4 hover:bg-ink-700/30 cursor-pointer transition-colors"
                        >
                          <div className="flex-shrink-0">
                            <svg
                              className={`w-5 h-5 text-ink-400 transition-transform ${expandedPayPeriod === item.id ? 'rotate-90' : ''}`}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-ink-100">
                              {new Date(item.start_date).toLocaleDateString()} - {new Date(item.end_date).toLocaleDateString()}
                            </p>
                            <p className="text-sm text-ink-400">
                              {item.commission_count} bookings{item.payout_reference && ` • Ref: ${item.payout_reference}`}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-ink-100">{formatCentsToDollars(item.total_artist_payout)}</p>
                            <p className="text-xs text-ink-400">artist payouts</p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-green-400">{formatCentsToDollars(item.total_studio_commission)}</p>
                            <p className="text-xs text-ink-400">studio revenue</p>
                          </div>
                          {item.paid_at && (
                            <div className="text-sm text-ink-400">
                              Paid {new Date(item.paid_at).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                        {/* Expanded Artist Breakdown */}
                        {expandedPayPeriod === item.id && item.artist_breakdown.length > 0 && (
                          <div className="bg-ink-900/50 border-t border-ink-700 p-4">
                            <h4 className="text-sm font-medium text-ink-300 mb-3">Artist Breakdown</h4>
                            <table className="w-full">
                              <thead>
                                <tr className="text-left text-xs text-ink-400 border-b border-ink-700">
                                  <th className="pb-2">Artist</th>
                                  <th className="pb-2 text-right">Bookings</th>
                                  <th className="pb-2 text-right">Service Total</th>
                                  <th className="pb-2 text-right">Payout</th>
                                  <th className="pb-2 text-right">Tips</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-ink-700/50">
                                {item.artist_breakdown.map((artist) => (
                                  <tr key={artist.artist_id} className="text-sm">
                                    <td className="py-2 text-ink-200">{artist.artist_name}</td>
                                    <td className="py-2 text-ink-300 text-right">{artist.booking_count}</td>
                                    <td className="py-2 text-ink-300 text-right">{formatCentsToDollars(artist.total_service)}</td>
                                    <td className="py-2 text-ink-100 text-right font-medium">{formatCentsToDollars(artist.total_artist_payout)}</td>
                                    <td className="py-2 text-green-400 text-right">{formatCentsToDollars(artist.total_tips)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Artist Summary Cards */}
              {artistPayouts && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-ink-800 rounded-xl border border-ink-700 p-4">
                    <p className="text-ink-400 text-sm">Total Service Revenue</p>
                    <p className="text-2xl font-bold text-ink-100">{formatCentsToDollars(artistPayouts.summary.total_service)}</p>
                  </div>
                  <div className="bg-ink-800 rounded-xl border border-ink-700 p-4">
                    <p className="text-ink-400 text-sm">Artist Payouts</p>
                    <p className="text-2xl font-bold text-ink-100">{formatCentsToDollars(artistPayouts.summary.total_artist_payout)}</p>
                  </div>
                  <div className="bg-ink-800 rounded-xl border border-ink-700 p-4">
                    <p className="text-ink-400 text-sm">Total Bookings</p>
                    <p className="text-2xl font-bold text-ink-100">{artistPayouts.summary.total_bookings}</p>
                  </div>
                  <div className="bg-ink-800 rounded-xl border border-ink-700 p-4">
                    <p className="text-ink-400 text-sm">Total Tips</p>
                    <p className="text-2xl font-bold text-green-400">{formatCentsToDollars(artistPayouts.summary.total_tips)}</p>
                  </div>
                </div>
              )}

              {/* Artists Table */}
              <div className="bg-ink-800 rounded-xl border border-ink-700 overflow-hidden">
                {!artistPayouts || artistPayouts.artists.length === 0 ? (
                  <div className="p-8 text-center">
                    <svg className="w-12 h-12 text-ink-500 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <h3 className="text-lg font-medium text-ink-200">No artist payouts yet</h3>
                    <p className="text-ink-400 mt-1">Complete bookings and pay periods to see artist payouts.</p>
                  </div>
                ) : (
                  <table className="w-full">
                    <thead className="bg-ink-700/50 border-b border-ink-700">
                      <tr>
                        <th className="text-left py-3 px-4 text-sm font-medium text-ink-300">Artist</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-ink-300">Bookings</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-ink-300">Pay Periods</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-ink-300">Service Total</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-ink-300">Studio Cut</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-ink-300">Artist Payout</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-ink-300">Tips</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-700">
                      {artistPayouts.artists.map((artist) => (
                        <tr key={artist.artist_id} className="hover:bg-ink-700/30 transition-colors">
                          <td className="py-3 px-4">
                            <p className="font-medium text-ink-100">{artist.artist_name}</p>
                            <p className="text-xs text-ink-400">{artist.email}</p>
                          </td>
                          <td className="py-3 px-4 text-sm text-ink-200 text-right">{artist.booking_count}</td>
                          <td className="py-3 px-4 text-sm text-ink-200 text-right">{artist.pay_period_count}</td>
                          <td className="py-3 px-4 text-sm text-ink-200 text-right">{formatCentsToDollars(artist.total_service)}</td>
                          <td className="py-3 px-4 text-sm text-ink-200 text-right">{formatCentsToDollars(artist.total_studio_commission)}</td>
                          <td className="py-3 px-4 text-sm font-medium text-ink-100 text-right">{formatCentsToDollars(artist.total_artist_payout)}</td>
                          <td className="py-3 px-4 text-sm text-green-400 text-right">{formatCentsToDollars(artist.total_tips)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-ink-700/30 border-t border-ink-700">
                      <tr className="font-medium">
                        <td className="py-3 px-4 text-ink-100">Total</td>
                        <td className="py-3 px-4 text-ink-100 text-right">{artistPayouts.summary.total_bookings}</td>
                        <td className="py-3 px-4 text-ink-100 text-right">{artistPayouts.summary.total_pay_periods}</td>
                        <td className="py-3 px-4 text-ink-100 text-right">{formatCentsToDollars(artistPayouts.summary.total_service)}</td>
                        <td className="py-3 px-4 text-ink-100 text-right">{formatCentsToDollars(artistPayouts.summary.total_studio_commission)}</td>
                        <td className="py-3 px-4 text-ink-100 text-right">{formatCentsToDollars(artistPayouts.summary.total_artist_payout)}</td>
                        <td className="py-3 px-4 text-green-400 text-right">{formatCentsToDollars(artistPayouts.summary.total_tips)}</td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tips Tab */}
      {activeTab === 'tips' && (
        <div className="space-y-6">
          {/* Tip Settings Card */}
          <div className="bg-ink-800 rounded-xl border border-ink-700 p-6">
            <h3 className="text-lg font-semibold text-ink-100 mb-4">Tip Distribution Settings</h3>
            <p className="text-ink-400 text-sm mb-4">
              Configure how tips are split between artists and the studio. This affects all future bookings.
            </p>
            <div className="flex items-end gap-4">
              <div className="flex-1 max-w-xs">
                <label className="block text-sm font-medium text-ink-300 mb-1">
                  Artist Tip Percentage
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={editingTipPercentage ?? 100}
                    onChange={(e) => setEditingTipPercentage(parseInt(e.target.value) || 0)}
                    className="w-24 px-3 py-2 bg-ink-900 border border-ink-700 rounded-lg text-ink-100 focus:outline-none focus:border-accent-primary"
                  />
                  <span className="text-ink-300">%</span>
                </div>
                <p className="text-xs text-ink-500 mt-1">
                  Studio receives {100 - (editingTipPercentage ?? 100)}% of tips
                </p>
              </div>
              <button
                onClick={handleSaveTipSettings}
                disabled={savingTipSettings || editingTipPercentage === tipSettings?.tip_artist_percentage}
                className="px-4 py-2 bg-accent-primary hover:bg-accent-primary/90 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingTipSettings ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>

          {/* Date Filters */}
          <div className="bg-ink-800 rounded-xl border border-ink-700 p-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-ink-300 mb-1">Start Date</label>
                <input
                  type="date"
                  value={tipStartDate}
                  onChange={(e) => setTipStartDate(e.target.value)}
                  className="w-full px-3 py-2 bg-ink-900 border border-ink-700 rounded-lg text-ink-100 focus:outline-none focus:border-accent-primary"
                />
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-ink-300 mb-1">End Date</label>
                <input
                  type="date"
                  value={tipEndDate}
                  onChange={(e) => setTipEndDate(e.target.value)}
                  className="w-full px-3 py-2 bg-ink-900 border border-ink-700 rounded-lg text-ink-100 focus:outline-none focus:border-accent-primary"
                />
              </div>
              <button
                onClick={() => {
                  setTipStartDate('');
                  setTipEndDate('');
                }}
                className="px-4 py-2 text-ink-400 hover:text-ink-200 transition-colors"
              >
                Clear Filters
              </button>
              {/* Export Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setExportDropdownOpen(exportDropdownOpen === 'tips' ? null : 'tips')}
                  disabled={exporting}
                  className="flex items-center gap-2 px-4 py-2 bg-ink-700 hover:bg-ink-600 text-ink-200 rounded-lg transition-colors disabled:opacity-50"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  {exporting ? 'Exporting...' : 'Export'}
                </button>
                {exportDropdownOpen === 'tips' && (
                  <div className="absolute right-0 mt-2 w-48 bg-ink-800 border border-ink-700 rounded-lg shadow-xl z-10">
                    <button
                      onClick={() => handleExportTips('csv')}
                      className="w-full text-left px-4 py-2 text-ink-200 hover:bg-ink-700 rounded-t-lg"
                    >
                      Export as CSV
                    </button>
                    <button
                      onClick={() => handleExportTips('pdf')}
                      className="w-full text-left px-4 py-2 text-ink-200 hover:bg-ink-700 rounded-b-lg"
                    >
                      Export as PDF
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {loadingTips ? (
            <div className="p-8 text-center">
              <div className="animate-spin w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full mx-auto"></div>
              <p className="text-ink-400 mt-2">Loading tip data...</p>
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              {tipReport && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-ink-800 rounded-xl border border-ink-700 p-4">
                    <p className="text-ink-400 text-sm">Total Tips</p>
                    <p className="text-2xl font-bold text-green-400">{formatCentsToDollars(tipReport.summary.total_tips)}</p>
                  </div>
                  <div className="bg-ink-800 rounded-xl border border-ink-700 p-4">
                    <p className="text-ink-400 text-sm">Card Tips</p>
                    <p className="text-2xl font-bold text-ink-100">{formatCentsToDollars(tipReport.summary.total_tips_card)}</p>
                  </div>
                  <div className="bg-ink-800 rounded-xl border border-ink-700 p-4">
                    <p className="text-ink-400 text-sm">Cash Tips</p>
                    <p className="text-2xl font-bold text-ink-100">{formatCentsToDollars(tipReport.summary.total_tips_cash)}</p>
                  </div>
                  <div className="bg-ink-800 rounded-xl border border-ink-700 p-4">
                    <p className="text-ink-400 text-sm">Bookings with Tips</p>
                    <p className="text-2xl font-bold text-ink-100">{tipReport.summary.total_bookings_with_tips}</p>
                  </div>
                </div>
              )}

              {/* Distribution Summary */}
              {tipReport && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-ink-800 rounded-xl border border-ink-700 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-5 h-5 text-accent-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <p className="text-ink-400 text-sm">Artist Share</p>
                    </div>
                    <p className="text-2xl font-bold text-ink-100">{formatCentsToDollars(tipReport.summary.total_artist_share)}</p>
                    <p className="text-xs text-ink-500 mt-1">
                      {tipReport.summary.total_tips > 0
                        ? `${Math.round((tipReport.summary.total_artist_share / tipReport.summary.total_tips) * 100)}% of total tips`
                        : 'No tips recorded'}
                    </p>
                  </div>
                  <div className="bg-ink-800 rounded-xl border border-ink-700 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-5 h-5 text-accent-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      <p className="text-ink-400 text-sm">Studio Share</p>
                    </div>
                    <p className="text-2xl font-bold text-ink-100">{formatCentsToDollars(tipReport.summary.total_studio_share)}</p>
                    <p className="text-xs text-ink-500 mt-1">
                      {tipReport.summary.total_tips > 0
                        ? `${Math.round((tipReport.summary.total_studio_share / tipReport.summary.total_tips) * 100)}% of total tips`
                        : 'No tips recorded'}
                    </p>
                  </div>
                </div>
              )}

              {/* Artist Tips Table */}
              <div className="bg-ink-800 rounded-xl border border-ink-700 overflow-hidden">
                {!tipReport || tipReport.artists.length === 0 ? (
                  <div className="p-8 text-center">
                    <svg className="w-12 h-12 text-ink-500 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h3 className="text-lg font-medium text-ink-200">No tips recorded yet</h3>
                    <p className="text-ink-400 mt-1">Tips will appear here as bookings are completed.</p>
                  </div>
                ) : (
                  <table className="w-full">
                    <thead className="bg-ink-700/50 border-b border-ink-700">
                      <tr>
                        <th className="text-left py-3 px-4 text-sm font-medium text-ink-300">Artist</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-ink-300">Bookings</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-ink-300">Total Tips</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-ink-300">Card</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-ink-300">Cash</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-ink-300">Artist Share</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-ink-300">Studio Share</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-700">
                      {tipReport.artists.map((artist) => (
                        <tr key={artist.artist_id} className="hover:bg-ink-700/30 transition-colors">
                          <td className="py-3 px-4">
                            <p className="font-medium text-ink-100">{artist.artist_name}</p>
                            <p className="text-xs text-ink-400">{artist.email}</p>
                          </td>
                          <td className="py-3 px-4 text-sm text-ink-200 text-right">{artist.booking_count}</td>
                          <td className="py-3 px-4 text-sm font-medium text-green-400 text-right">
                            {formatCentsToDollars(artist.total_tips)}
                          </td>
                          <td className="py-3 px-4 text-sm text-ink-200 text-right">
                            {formatCentsToDollars(artist.total_tips_card)}
                          </td>
                          <td className="py-3 px-4 text-sm text-ink-200 text-right">
                            {formatCentsToDollars(artist.total_tips_cash)}
                          </td>
                          <td className="py-3 px-4 text-sm text-ink-100 text-right">
                            {formatCentsToDollars(artist.tip_artist_share)}
                          </td>
                          <td className="py-3 px-4 text-sm text-ink-300 text-right">
                            {formatCentsToDollars(artist.tip_studio_share)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-ink-700/30 border-t border-ink-700">
                      <tr className="font-medium">
                        <td className="py-3 px-4 text-ink-100">Total ({tipReport.summary.artists_with_tips} artists)</td>
                        <td className="py-3 px-4 text-ink-100 text-right">{tipReport.summary.total_bookings_with_tips}</td>
                        <td className="py-3 px-4 text-green-400 text-right">{formatCentsToDollars(tipReport.summary.total_tips)}</td>
                        <td className="py-3 px-4 text-ink-100 text-right">{formatCentsToDollars(tipReport.summary.total_tips_card)}</td>
                        <td className="py-3 px-4 text-ink-100 text-right">{formatCentsToDollars(tipReport.summary.total_tips_cash)}</td>
                        <td className="py-3 px-4 text-ink-100 text-right">{formatCentsToDollars(tipReport.summary.total_artist_share)}</td>
                        <td className="py-3 px-4 text-ink-100 text-right">{formatCentsToDollars(tipReport.summary.total_studio_share)}</td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            </>
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

      {/* Create Pay Period Modal */}
      {payPeriodModalOpen && (
        <PayPeriodModal
          onClose={() => setPayPeriodModalOpen(false)}
          onSave={handleCreatePayPeriod}
        />
      )}

      {/* Pay Period Settings Modal */}
      {settingsModalOpen && payPeriodSettings && (
        <SettingsModal
          settings={payPeriodSettings}
          onClose={() => setSettingsModalOpen(false)}
          onSave={handleUpdateSettings}
        />
      )}

      {/* Mark as Paid Modal */}
      {payModalOpen && selectedPayPeriod && (
        <MarkPaidModal
          payPeriod={selectedPayPeriod}
          onClose={() => setPayModalOpen(false)}
          onSave={(ref, notes) => handleMarkPaid(selectedPayPeriod.id, ref, notes)}
        />
      )}

      {/* Assign Commissions Modal */}
      {assignModalOpen && selectedPayPeriod && (
        <AssignCommissionsModal
          payPeriod={selectedPayPeriod}
          unassignedCommissions={unassignedCommissions}
          onClose={() => setAssignModalOpen(false)}
          onSave={(ids) => handleAssignCommissions(selectedPayPeriod.id, ids)}
          formatCentsToDollars={formatCentsToDollars}
        />
      )}
    </div>
  );
}

// ============ Pay Period Modals ============

interface PayPeriodModalProps {
  onClose: () => void;
  onSave: (startDate: string, endDate: string) => Promise<void>;
}

function PayPeriodModal({ onClose, onSave }: PayPeriodModalProps) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave(startDate + 'T00:00:00Z', endDate + 'T23:59:59Z');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-ink-800 rounded-xl border border-ink-700 p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-ink-100">Create Pay Period</h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-200">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink-300 mb-1.5">Start Date</label>
            <input
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 bg-ink-900 border border-ink-600 rounded-lg text-ink-100 focus:ring-2 focus:ring-accent-primary focus:border-transparent transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-300 mb-1.5">End Date</label>
            <input
              type="date"
              required
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate}
              className="w-full px-3 py-2 bg-ink-900 border border-ink-600 rounded-lg text-ink-100 focus:ring-2 focus:ring-accent-primary focus:border-transparent transition-all"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-ink-400 hover:text-ink-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !startDate || !endDate}
              className="px-4 py-2 bg-accent-primary hover:bg-accent-primary/90 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Pay Period'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface SettingsModalProps {
  settings: PayPeriodSettings;
  onClose: () => void;
  onSave: (schedule: PayPeriodSchedule, startDay: number) => Promise<void>;
}

function SettingsModal({ settings, onClose, onSave }: SettingsModalProps) {
  const [schedule, setSchedule] = useState<PayPeriodSchedule>(settings.pay_period_schedule);
  const [startDay, setStartDay] = useState(settings.pay_period_start_day);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave(schedule, startDay);
    } finally {
      setLoading(false);
    }
  };

  const isWeeklySchedule = schedule === 'weekly' || schedule === 'biweekly';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-ink-800 rounded-xl border border-ink-700 p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-ink-100">Pay Period Settings</h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-200">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink-300 mb-1.5">Schedule</label>
            <select
              value={schedule}
              onChange={(e) => {
                setSchedule(e.target.value as PayPeriodSchedule);
                setStartDay(e.target.value === 'weekly' || e.target.value === 'biweekly' ? 0 : 1);
              }}
              className="w-full px-3 py-2 bg-ink-900 border border-ink-600 rounded-lg text-ink-100 focus:ring-2 focus:ring-accent-primary focus:border-transparent transition-all"
            >
              <option value="weekly">Weekly</option>
              <option value="biweekly">Bi-weekly</option>
              <option value="semimonthly">Semi-monthly (1st & 15th)</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-300 mb-1.5">
              {isWeeklySchedule ? 'Start Day' : 'Start Day of Month'}
            </label>
            {isWeeklySchedule ? (
              <select
                value={startDay}
                onChange={(e) => setStartDay(parseInt(e.target.value))}
                className="w-full px-3 py-2 bg-ink-900 border border-ink-600 rounded-lg text-ink-100 focus:ring-2 focus:ring-accent-primary focus:border-transparent transition-all"
              >
                <option value="0">Monday</option>
                <option value="1">Tuesday</option>
                <option value="2">Wednesday</option>
                <option value="3">Thursday</option>
                <option value="4">Friday</option>
                <option value="5">Saturday</option>
                <option value="6">Sunday</option>
              </select>
            ) : (
              <input
                type="number"
                min="1"
                max="28"
                value={startDay}
                onChange={(e) => setStartDay(parseInt(e.target.value))}
                className="w-full px-3 py-2 bg-ink-900 border border-ink-600 rounded-lg text-ink-100 focus:ring-2 focus:ring-accent-primary focus:border-transparent transition-all"
              />
            )}
            <p className="text-xs text-ink-500 mt-1">
              {isWeeklySchedule
                ? 'The day of the week when pay periods start.'
                : 'Day of the month when pay periods start (1-28).'}
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-ink-400 hover:text-ink-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-accent-primary hover:bg-accent-primary/90 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface MarkPaidModalProps {
  payPeriod: PayPeriodWithCommissions;
  onClose: () => void;
  onSave: (payoutReference?: string, paymentNotes?: string) => Promise<void>;
}

function MarkPaidModal({ payPeriod, onClose, onSave }: MarkPaidModalProps) {
  const [payoutReference, setPayoutReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave(payoutReference || undefined, paymentNotes || undefined);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-ink-800 rounded-xl border border-ink-700 p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-ink-100">Mark Pay Period as Paid</h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-200">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-4 p-3 bg-ink-900 rounded-lg">
          <p className="text-sm text-ink-400">Total Artist Payout</p>
          <p className="text-2xl font-semibold text-ink-100">{formatCentsToDollars(payPeriod.total_artist_payout)}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink-300 mb-1.5">
              Payout Reference <span className="text-ink-500">(optional)</span>
            </label>
            <input
              type="text"
              value={payoutReference}
              onChange={(e) => setPayoutReference(e.target.value)}
              placeholder="Check #, transfer ID, etc."
              className="w-full px-3 py-2 bg-ink-900 border border-ink-600 rounded-lg text-ink-100 placeholder-ink-500 focus:ring-2 focus:ring-accent-primary focus:border-transparent transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-300 mb-1.5">
              Notes <span className="text-ink-500">(optional)</span>
            </label>
            <textarea
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
              rows={3}
              placeholder="Any additional notes about this payment..."
              className="w-full px-3 py-2 bg-ink-900 border border-ink-600 rounded-lg text-ink-100 placeholder-ink-500 focus:ring-2 focus:ring-accent-primary focus:border-transparent transition-all resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-ink-400 hover:text-ink-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Mark as Paid'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface AssignCommissionsModalProps {
  payPeriod: PayPeriodWithCommissions;
  unassignedCommissions: EarnedCommission[];
  onClose: () => void;
  onSave: (commissionIds: string[]) => Promise<void>;
  formatCentsToDollars: (cents: number) => string;
}

function AssignCommissionsModal({
  payPeriod,
  unassignedCommissions,
  onClose,
  onSave,
  formatCentsToDollars,
}: AssignCommissionsModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const selectAll = () => {
    setSelectedIds(new Set(unassignedCommissions.map(c => c.id)));
  };

  const selectNone = () => {
    setSelectedIds(new Set());
  };

  const handleSubmit = async () => {
    if (selectedIds.size === 0) return;
    setLoading(true);
    try {
      await onSave(Array.from(selectedIds));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm overflow-y-auto py-8">
      <div className="bg-ink-800 rounded-xl border border-ink-700 p-6 w-full max-w-2xl mx-4 my-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-ink-100">Assign Commissions to Pay Period</h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-200">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-4 text-sm text-ink-400">
          Select commissions to add to the pay period: {new Date(payPeriod.start_date).toLocaleDateString()} - {new Date(payPeriod.end_date).toLocaleDateString()}
        </div>

        {unassignedCommissions.length === 0 ? (
          <div className="p-8 text-center text-ink-400">
            No unassigned commissions available.
          </div>
        ) : (
          <>
            <div className="flex items-center gap-4 mb-4">
              <button
                onClick={selectAll}
                className="text-sm text-accent-primary hover:text-accent-primary/80"
              >
                Select All
              </button>
              <button
                onClick={selectNone}
                className="text-sm text-ink-400 hover:text-ink-200"
              >
                Select None
              </button>
              <span className="text-sm text-ink-400">
                {selectedIds.size} of {unassignedCommissions.length} selected
              </span>
            </div>

            <div className="max-h-64 overflow-y-auto border border-ink-700 rounded-lg divide-y divide-ink-700">
              {unassignedCommissions.map((comm) => (
                <label
                  key={comm.id}
                  className="flex items-center gap-3 p-3 hover:bg-ink-700/30 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(comm.id)}
                    onChange={() => toggleSelection(comm.id)}
                    className="w-4 h-4 rounded border-ink-600 bg-ink-900 text-accent-primary focus:ring-accent-primary focus:ring-offset-0"
                  />
                  <div className="flex-1">
                    <p className="text-sm text-ink-100">{comm.client_name}</p>
                    <p className="text-xs text-ink-400">
                      {comm.artist_name} - {new Date(comm.completed_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-ink-200">{formatCentsToDollars(comm.artist_payout)}</p>
                    <p className="text-xs text-ink-500">artist payout</p>
                  </div>
                </label>
              ))}
            </div>
          </>
        )}

        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-ink-400 hover:text-ink-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || selectedIds.size === 0}
            className="px-4 py-2 bg-accent-primary hover:bg-accent-primary/90 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Assigning...' : `Assign ${selectedIds.size} Commission${selectedIds.size !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Commissions;
