/**
 * No-Show Tracking Analytics Page.
 * Displays comprehensive no-show metrics, patterns, and repeat offenders.
 */

import { useState, useEffect } from 'react';
import type { NoShowReport } from '../services/analytics';
import {
  getNoShowReport,
  getPresetDateRanges,
  formatCurrency,
  formatPercent,
  formatDateRange,
  getNoShowRateSeverity,
  getNoShowBarColor,
} from '../services/analytics';

export default function NoShowTracking() {
  const [report, setReport] = useState<NoShowReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Date range state
  const presetRanges = getPresetDateRanges();
  const defaultRange = presetRanges.find((r) => r.value === 'thisQuarter') || presetRanges[0];
  const [selectedPreset, setSelectedPreset] = useState(defaultRange.value);
  const [startDate, setStartDate] = useState(defaultRange.startDate);
  const [endDate, setEndDate] = useState(defaultRange.endDate);

  useEffect(() => {
    fetchReport();
  }, [startDate, endDate]);

  const fetchReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getNoShowReport(startDate, endDate);
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load no-show report');
    } finally {
      setLoading(false);
    }
  };

  const handlePresetChange = (value: string) => {
    setSelectedPreset(value);
    if (value === 'custom') return;
    const preset = presetRanges.find((r) => r.value === value);
    if (preset) {
      setStartDate(preset.startDate);
      setEndDate(preset.endDate);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-ink-700 rounded w-1/3" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-ink-700 rounded-lg" />
            ))}
          </div>
          <div className="h-64 bg-ink-700 rounded-lg" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-6 text-center">
          <p className="text-red-400">{error}</p>
          <button
            onClick={fetchReport}
            className="mt-4 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!report) return null;

  const severity = getNoShowRateSeverity(report.no_show_rate);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">No-Show Tracking</h1>
          <p className="text-ink-400 mt-1">
            {formatDateRange(report.period_start, report.period_end)}
          </p>
        </div>

        {/* Date Range Selector */}
        <div className="flex items-center gap-4">
          <select
            value={selectedPreset}
            onChange={(e) => handlePresetChange(e.target.value)}
            className="bg-ink-700 border border-ink-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-accent-primary"
          >
            {presetRanges.map((range) => (
              <option key={range.value} value={range.value}>
                {range.label}
              </option>
            ))}
            <option value="custom">Custom Range</option>
          </select>

          {selectedPreset === 'custom' && (
            <>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-ink-700 border border-ink-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-accent-primary"
              />
              <span className="text-ink-400">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-ink-700 border border-ink-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-accent-primary"
              />
            </>
          )}
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="No-Show Rate"
          value={formatPercent(report.no_show_rate)}
          subtitle={report.no_show_rate_change !== null ? (
            <span className={report.no_show_rate_change <= 0 ? 'text-green-400' : 'text-red-400'}>
              {report.no_show_rate_change > 0 ? '+' : ''}{formatPercent(report.no_show_rate_change)} vs prev
            </span>
          ) : `${report.total_no_shows} of ${report.total_appointments}`}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          }
          highlight
          severity={severity.level}
        />

        <MetricCard
          title="Total No-Shows"
          value={report.total_no_shows.toLocaleString()}
          subtitle={report.no_shows_change !== null ? (
            <span className={report.no_shows_change <= 0 ? 'text-green-400' : 'text-red-400'}>
              {report.no_shows_change > 0 ? '+' : ''}{report.no_shows_change} vs prev
            </span>
          ) : 'This period'}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          }
        />

        <MetricCard
          title="Deposits Forfeited"
          value={formatCurrency(report.total_deposits_forfeited)}
          subtitle="Collected from no-shows"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />

        <MetricCard
          title="Revenue Lost"
          value={formatCurrency(report.estimated_revenue_lost)}
          subtitle="Estimated from no-shows"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
            </svg>
          }
          warning
        />
      </div>

      {/* Risk Alert */}
      {report.high_risk_upcoming > 0 && (
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-orange-500/20 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <p className="text-orange-400 font-medium">High-Risk Appointments Detected</p>
            <p className="text-ink-400 text-sm">
              {report.high_risk_upcoming} upcoming appointment{report.high_risk_upcoming > 1 ? 's' : ''} with clients who have previous no-shows
            </p>
          </div>
        </div>
      )}

      {/* No-Show by Day & Time Patterns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Day of Week */}
        <div className="bg-ink-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-4">No-Shows by Day</h2>

          <div className="space-y-3">
            {report.by_day_of_week.map((day) => (
              <div key={day.day_of_week} className="flex items-center gap-4">
                <span className="w-24 text-ink-400 text-sm">{day.day_name}</span>
                <div className="flex-1 h-6 bg-ink-700 rounded-full overflow-hidden relative">
                  <div
                    className={`h-full ${getNoShowBarColor(day.no_show_rate)} transition-all`}
                    style={{ width: `${Math.min(day.no_show_rate * 5, 100)}%` }}
                  />
                  <span className="absolute inset-0 flex items-center justify-center text-xs text-white font-medium">
                    {day.no_shows} / {day.total_appointments}
                  </span>
                </div>
                <span className={`w-16 text-right text-sm font-medium ${
                  getNoShowRateSeverity(day.no_show_rate).color
                }`}>
                  {formatPercent(day.no_show_rate)}
                </span>
              </div>
            ))}
          </div>

          {report.by_day_of_week.length === 0 && (
            <p className="text-ink-500 text-center py-4">No data available</p>
          )}
        </div>

        {/* By Time Slot */}
        <div className="bg-ink-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-4">No-Shows by Time</h2>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {report.by_time_slot.map((slot) => (
              <div key={slot.hour} className="flex items-center gap-4">
                <span className="w-32 text-ink-400 text-sm">{slot.time_label}</span>
                <div className="flex-1 h-5 bg-ink-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${getNoShowBarColor(slot.no_show_rate)} transition-all`}
                    style={{ width: `${Math.min(slot.no_show_rate * 5, 100)}%` }}
                  />
                </div>
                <span className={`w-14 text-right text-sm font-medium ${
                  getNoShowRateSeverity(slot.no_show_rate).color
                }`}>
                  {formatPercent(slot.no_show_rate)}
                </span>
              </div>
            ))}
          </div>

          {report.by_time_slot.length === 0 && (
            <p className="text-ink-500 text-center py-4">No data available</p>
          )}
        </div>
      </div>

      {/* Weekly Trends */}
      {report.trends.length > 0 && (
        <div className="bg-ink-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Weekly Trends</h2>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-ink-400 text-sm">
                  <th className="pb-3 font-medium">Period</th>
                  <th className="pb-3 font-medium text-right">Appointments</th>
                  <th className="pb-3 font-medium text-right">No-Shows</th>
                  <th className="pb-3 font-medium text-right">Rate</th>
                  <th className="pb-3 font-medium text-right">Deposits Forfeited</th>
                  <th className="pb-3 font-medium w-32">Trend</th>
                </tr>
              </thead>
              <tbody>
                {report.trends.map((trend) => {
                  const maxNoShows = Math.max(...report.trends.map(t => t.no_shows), 1);
                  const barWidth = (trend.no_shows / maxNoShows) * 100;

                  return (
                    <tr key={trend.period} className="border-t border-ink-700">
                      <td className="py-3 text-white">{trend.period}</td>
                      <td className="py-3 text-right text-ink-400">{trend.total_appointments}</td>
                      <td className="py-3 text-right text-white font-medium">{trend.no_shows}</td>
                      <td className={`py-3 text-right font-medium ${
                        getNoShowRateSeverity(trend.no_show_rate).color
                      }`}>
                        {formatPercent(trend.no_show_rate)}
                      </td>
                      <td className="py-3 text-right text-ink-400">
                        {formatCurrency(trend.deposits_forfeited)}
                      </td>
                      <td className="py-3">
                        <div className="h-4 bg-ink-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${getNoShowBarColor(trend.no_show_rate)} transition-all`}
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* By Artist & Repeat Offenders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* No-Shows by Artist */}
        {report.by_artist.length > 0 && (
          <div className="bg-ink-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-white mb-4">No-Shows by Artist</h2>

            <div className="space-y-3">
              {report.by_artist.map((artist) => (
                <div key={artist.artist_id} className="p-3 bg-ink-700/50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-medium">{artist.artist_name}</span>
                    <span className={`text-sm font-medium ${
                      getNoShowRateSeverity(artist.no_show_rate).color
                    }`}>
                      {formatPercent(artist.no_show_rate)} rate
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-ink-400">
                    <span>{artist.no_shows} no-shows</span>
                    <span>{artist.total_appointments} appointments</span>
                    <span>{formatCurrency(artist.revenue_lost)} lost</span>
                  </div>
                  <div className="mt-2 h-2 bg-ink-600 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${getNoShowBarColor(artist.no_show_rate)}`}
                      style={{ width: `${Math.min(artist.no_show_rate * 5, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Repeat Offenders */}
        <div className="bg-ink-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Repeat Offenders</h2>
            <span className="text-sm text-ink-400">
              {report.repeat_offender_count} clients with 2+ no-shows
            </span>
          </div>

          {report.repeat_no_show_clients.length > 0 ? (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {report.repeat_no_show_clients.map((client) => (
                <div key={client.client_email} className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white font-medium">{client.client_name}</span>
                    <span className="text-red-400 text-sm font-medium">
                      {client.no_show_count} no-shows
                    </span>
                  </div>
                  <p className="text-ink-400 text-sm">{client.client_email}</p>
                  <div className="flex items-center justify-between mt-2 text-sm">
                    <span className="text-ink-400">
                      {client.total_bookings} total bookings ({formatPercent(client.no_show_rate)} rate)
                    </span>
                    <span className="text-red-400">
                      {formatCurrency(client.deposits_forfeited)} forfeited
                    </span>
                  </div>
                  {client.last_no_show && (
                    <p className="text-ink-500 text-xs mt-1">
                      Last no-show: {new Date(client.last_no_show).toLocaleDateString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-green-400 font-medium">No Repeat Offenders</p>
              <p className="text-ink-500 text-sm mt-1">No clients have multiple no-shows</p>
            </div>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="bg-ink-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Summary</h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="text-center">
            <p className="text-3xl font-bold text-white">{report.total_appointments}</p>
            <p className="text-ink-400 text-sm">Total Appointments</p>
          </div>
          <div className="text-center">
            <p className={`text-3xl font-bold ${severity.color}`}>{report.total_no_shows}</p>
            <p className="text-ink-400 text-sm">Total No-Shows</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-yellow-400">{report.clients_with_no_shows}</p>
            <p className="text-ink-400 text-sm">Clients with No-Shows</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-red-400">{report.repeat_offender_count}</p>
            <p className="text-ink-400 text-sm">Repeat Offenders</p>
          </div>
        </div>
      </div>

      {/* Tips Section */}
      <div className="bg-ink-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Reduce No-Shows</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-ink-700/50 rounded-lg">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-white font-medium">Send Reminders</h3>
            </div>
            <p className="text-ink-400 text-sm">
              Automated reminders 24 hours and 2 hours before appointments reduce no-shows by up to 50%.
            </p>
          </div>

          <div className="p-4 bg-ink-700/50 rounded-lg">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-white font-medium">Require Deposits</h3>
            </div>
            <p className="text-ink-400 text-sm">
              Clients who pay deposits are significantly less likely to skip their appointments.
            </p>
          </div>

          <div className="p-4 bg-ink-700/50 rounded-lg">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 bg-orange-500/20 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-white font-medium">Flag High Risk</h3>
            </div>
            <p className="text-ink-400 text-sm">
              Monitor repeat offenders and consider requiring larger deposits or prepayment.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Metric Card Component
interface MetricCardProps {
  title: string;
  value: string;
  subtitle: string | React.ReactNode;
  icon: React.ReactNode;
  highlight?: boolean;
  warning?: boolean;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

function MetricCard({ title, value, subtitle, icon, highlight, warning, severity }: MetricCardProps) {
  const getSeverityStyles = () => {
    if (severity) {
      switch (severity) {
        case 'low':
          return { ring: 'ring-green-500/50', text: 'text-green-400' };
        case 'medium':
          return { ring: 'ring-yellow-500/50', text: 'text-yellow-400' };
        case 'high':
          return { ring: 'ring-orange-500/50', text: 'text-orange-400' };
        case 'critical':
          return { ring: 'ring-red-500/50', text: 'text-red-400' };
      }
    }
    return { ring: '', text: 'text-white' };
  };

  const styles = getSeverityStyles();

  return (
    <div className={`bg-ink-800 rounded-lg p-4 ${
      highlight && severity ? `ring-2 ${styles.ring}` :
      warning ? 'ring-2 ring-red-500/50' : ''
    }`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-ink-400 text-sm">{title}</span>
        <span className={
          highlight && severity ? styles.text :
          warning ? 'text-red-400' : 'text-ink-400'
        }>
          {icon}
        </span>
      </div>
      <p className={`text-2xl font-bold ${
        highlight && severity ? styles.text :
        warning ? 'text-red-400' : 'text-white'
      }`}>
        {value}
      </p>
      <p className="text-ink-400 text-sm mt-1">{subtitle}</p>
    </div>
  );
}
