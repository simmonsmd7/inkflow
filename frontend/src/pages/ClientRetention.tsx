/**
 * Client Retention Analytics Page.
 * Displays detailed client retention metrics, segmentation, and trends.
 */

import { useState, useEffect } from 'react';
import type { ClientRetentionReport } from '../services/analytics';
import {
  getClientRetentionReport,
  getPresetDateRanges,
  formatCurrency,
  formatPercent,
  getSegmentColor,
  getSegmentTextColor,
  formatDateRange,
} from '../services/analytics';

export default function ClientRetention() {
  const [report, setReport] = useState<ClientRetentionReport | null>(null);
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
      const data = await getClientRetentionReport(startDate, endDate);
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load retention report');
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

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Client Retention</h1>
          <p className="text-ink-400 mt-1">
            {formatDateRange(report.period_start, report.period_end)}
          </p>
        </div>

        {/* Date Range Selector */}
        <div className="flex items-center gap-4">
          <select
            value={selectedPreset}
            onChange={(e) => handlePresetChange(e.target.value)}
            className="bg-ink-700 border border-ink-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-accent-500"
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
                className="bg-ink-700 border border-ink-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-accent-500"
              />
              <span className="text-ink-400">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-ink-700 border border-ink-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-accent-500"
              />
            </>
          )}
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Clients"
          value={report.total_clients.toLocaleString()}
          subtitle="All time"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          }
        />

        <MetricCard
          title="Retention Rate"
          value={formatPercent(report.retention_rate)}
          subtitle={report.retention_rate_change !== null ? (
            <span className={report.retention_rate_change >= 0 ? 'text-green-400' : 'text-red-400'}>
              {report.retention_rate_change >= 0 ? '+' : ''}{formatPercent(report.retention_rate_change)} vs prev
            </span>
          ) : 'Returning clients'}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          }
          highlight
        />

        <MetricCard
          title="New Clients"
          value={report.new_clients.toLocaleString()}
          subtitle={report.new_clients_change !== null ? (
            <span className={report.new_clients_change >= 0 ? 'text-green-400' : 'text-red-400'}>
              {report.new_clients_change >= 0 ? '+' : ''}{formatPercent(report.new_clients_change)} vs prev
            </span>
          ) : 'This period'}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          }
        />

        <MetricCard
          title="Churn Rate"
          value={formatPercent(report.churn_rate)}
          subtitle={`${report.lapsed_clients} lapsed clients`}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6" />
            </svg>
          }
          warning={report.churn_rate > 20}
        />
      </div>

      {/* Client Segments & Lifetime Value */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Client Segments */}
        <div className="bg-ink-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Client Segments</h2>

          {/* Segment Bar */}
          <div className="h-8 flex rounded-lg overflow-hidden mb-4">
            {report.segments.map((segment) => (
              <div
                key={segment.segment}
                className={`${getSegmentColor(segment.segment)} transition-all`}
                style={{ width: `${segment.percentage}%` }}
                title={`${segment.segment}: ${segment.count} (${formatPercent(segment.percentage)})`}
              />
            ))}
          </div>

          {/* Segment Legend */}
          <div className="grid grid-cols-2 gap-4">
            {report.segments.map((segment) => (
              <div key={segment.segment} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${getSegmentColor(segment.segment)}`} />
                  <span className={getSegmentTextColor(segment.segment)}>{segment.segment}</span>
                </div>
                <div className="text-right">
                  <span className="text-white font-medium">{segment.count}</span>
                  <span className="text-ink-400 text-sm ml-1">({formatPercent(segment.percentage)})</span>
                </div>
              </div>
            ))}
          </div>

          {/* Segment Descriptions */}
          <div className="mt-4 pt-4 border-t border-ink-700 text-sm text-ink-400 space-y-1">
            <p><span className="text-blue-400">New:</span> First booking in selected period</p>
            <p><span className="text-green-400">Returning:</span> 2 bookings total</p>
            <p><span className="text-purple-400">Loyal:</span> 3+ bookings total</p>
            <p><span className="text-red-400">Lapsed:</span> No booking in 90+ days</p>
          </div>
        </div>

        {/* Lifetime Value */}
        <div className="bg-ink-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Client Lifetime Value</h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-ink-700/50 rounded-lg">
              <div>
                <p className="text-ink-400 text-sm">Average LTV</p>
                <p className="text-2xl font-bold text-accent-400">
                  {formatCurrency(report.lifetime_value.average_lifetime_value)}
                </p>
              </div>
              <div className="w-12 h-12 bg-accent-500/20 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-accent-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-ink-700/50 rounded-lg">
                <p className="text-ink-400 text-sm">Avg Bookings</p>
                <p className="text-xl font-semibold text-white">
                  {report.lifetime_value.average_bookings.toFixed(1)}
                </p>
                <p className="text-ink-500 text-xs">per client</p>
              </div>

              <div className="p-4 bg-ink-700/50 rounded-lg">
                <p className="text-ink-400 text-sm">Avg Visit Gap</p>
                <p className="text-xl font-semibold text-white">
                  {Math.round(report.lifetime_value.average_time_between_visits)}
                </p>
                <p className="text-ink-500 text-xs">days between visits</p>
              </div>
            </div>

            <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg">
              <p className="text-ink-400 text-sm">Top Client Value</p>
              <p className="text-xl font-semibold text-purple-400">
                {formatCurrency(report.lifetime_value.highest_value_client_revenue)}
              </p>
              <p className="text-ink-500 text-xs">Highest spending client</p>
            </div>
          </div>
        </div>
      </div>

      {/* Client Acquisition Trend */}
      {report.acquisition_by_month.length > 0 && (
        <div className="bg-ink-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Client Acquisition Trend</h2>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-ink-400 text-sm">
                  <th className="pb-3 font-medium">Month</th>
                  <th className="pb-3 font-medium text-right">Clients</th>
                  <th className="pb-3 font-medium text-right">Bookings</th>
                  <th className="pb-3 font-medium">Distribution</th>
                </tr>
              </thead>
              <tbody>
                {report.acquisition_by_month.map((month) => {
                  const maxClients = Math.max(...report.acquisition_by_month.map(m => m.new_clients));
                  const barWidth = maxClients > 0 ? (month.new_clients / maxClients) * 100 : 0;

                  return (
                    <tr key={month.month} className="border-t border-ink-700">
                      <td className="py-3 text-white">{month.month_name}</td>
                      <td className="py-3 text-right text-white font-medium">{month.new_clients}</td>
                      <td className="py-3 text-right text-ink-400">{month.total_bookings}</td>
                      <td className="py-3 w-48">
                        <div className="h-4 bg-ink-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-accent-500 transition-all"
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

      {/* Artist Retention & Top Clients */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Retention by Artist */}
        {report.by_artist.length > 0 && (
          <div className="bg-ink-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Retention by Artist</h2>

            <div className="space-y-3">
              {report.by_artist.map((artist) => (
                <div key={artist.artist_id} className="p-3 bg-ink-700/50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-medium">{artist.artist_name}</span>
                    <span className={`text-sm font-medium ${
                      artist.retention_rate >= 30 ? 'text-green-400' :
                      artist.retention_rate >= 15 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {formatPercent(artist.retention_rate)} retention
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-ink-400">
                    <span>{artist.total_clients} clients</span>
                    <span>{artist.returning_clients} returning</span>
                    <span>{artist.average_bookings_per_client.toFixed(1)} avg bookings</span>
                  </div>
                  <div className="mt-2 h-2 bg-ink-600 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        artist.retention_rate >= 30 ? 'bg-green-500' :
                        artist.retention_rate >= 15 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${Math.min(artist.retention_rate, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top Clients */}
        {report.top_clients.length > 0 && (
          <div className="bg-ink-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Top Clients by Spend</h2>

            <div className="space-y-3">
              {report.top_clients.slice(0, 5).map((client, index) => (
                <div key={client.client_email} className="flex items-center gap-4 p-3 bg-ink-700/50 rounded-lg">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    index === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                    index === 1 ? 'bg-ink-400/20 text-ink-300' :
                    index === 2 ? 'bg-orange-500/20 text-orange-400' :
                    'bg-ink-600 text-ink-400'
                  }`}>
                    {index + 1}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">{client.client_name}</p>
                    <p className="text-ink-400 text-sm">{client.total_bookings} bookings</p>
                  </div>

                  <div className="text-right">
                    <p className="text-accent-400 font-semibold">{formatCurrency(client.total_spent)}</p>
                    <p className="text-ink-500 text-xs">
                      Since {new Date(client.first_visit).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {report.top_clients.length > 5 && (
              <p className="text-center text-ink-500 text-sm mt-4">
                +{report.top_clients.length - 5} more clients
              </p>
            )}
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div className="bg-ink-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Summary</h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="text-center">
            <p className="text-3xl font-bold text-white">{report.returning_clients}</p>
            <p className="text-ink-400 text-sm">Returning Clients</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-purple-400">{report.loyal_clients}</p>
            <p className="text-ink-400 text-sm">Loyal Clients (3+)</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-red-400">{report.lapsed_clients}</p>
            <p className="text-ink-400 text-sm">Lapsed (90+ days)</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-accent-400">
              {report.lifetime_value.average_bookings.toFixed(1)}
            </p>
            <p className="text-ink-400 text-sm">Avg Bookings/Client</p>
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
}

function MetricCard({ title, value, subtitle, icon, highlight, warning }: MetricCardProps) {
  return (
    <div className={`bg-ink-800 rounded-lg p-4 ${
      highlight ? 'ring-2 ring-accent-500/50' :
      warning ? 'ring-2 ring-red-500/50' : ''
    }`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-ink-400 text-sm">{title}</span>
        <span className={highlight ? 'text-accent-400' : warning ? 'text-red-400' : 'text-ink-400'}>
          {icon}
        </span>
      </div>
      <p className={`text-2xl font-bold ${
        highlight ? 'text-accent-400' : warning ? 'text-red-400' : 'text-white'
      }`}>
        {value}
      </p>
      <p className="text-ink-400 text-sm mt-1">{subtitle}</p>
    </div>
  );
}
