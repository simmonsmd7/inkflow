/**
 * Revenue Reports page - detailed revenue reporting with daily, weekly, monthly views.
 */

import { useEffect, useState } from 'react';
import {
  formatCurrency,
  formatDateRange,
  getPresetDateRanges,
  getRevenueReport,
  type ReportType,
  type RevenueReport,
  type RevenueSummary,
  type RevenueByArtist,
  type RevenueByDay,
  type RevenueByWeek,
  type RevenueByMonth,
  type RevenueByCategory,
} from '../services/analytics';

// Icons
function ChartIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}

function TrendIcon({ up }: { up: boolean }) {
  return up ? (
    <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  ) : (
    <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
    </svg>
  );
}

// Summary Card Component
function SummaryCard({
  label,
  value,
  subtext,
  highlight,
}: {
  label: string;
  value: string;
  subtext?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-lg p-4 ${highlight ? 'bg-accent-primary/10 border border-accent-primary/20' : 'bg-ink-700/50'}`}>
      <p className="text-xs text-ink-400 uppercase tracking-wider">{label}</p>
      <p className={`text-xl font-bold mt-1 ${highlight ? 'text-accent-primary' : 'text-ink-100'}`}>{value}</p>
      {subtext && <p className="text-xs text-ink-500 mt-1">{subtext}</p>}
    </div>
  );
}

// Revenue Summary Section
function RevenueSummarySection({ summary, loading }: { summary: RevenueSummary | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="bg-ink-800 rounded-xl border border-ink-700 p-6">
        <h3 className="text-lg font-semibold text-ink-100 mb-4">Revenue Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse bg-ink-700/50 rounded-lg p-4">
              <div className="h-3 bg-ink-600 rounded w-16 mb-2"></div>
              <div className="h-6 bg-ink-600 rounded w-24"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div className="bg-ink-800 rounded-xl border border-ink-700 p-6">
      <h3 className="text-lg font-semibold text-ink-100 mb-4">Revenue Summary</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard
          label="Total Revenue"
          value={formatCurrency(summary.total_revenue)}
          highlight
        />
        <SummaryCard
          label="Total Tips"
          value={formatCurrency(summary.total_tips)}
        />
        <SummaryCard
          label="Total Deposits"
          value={formatCurrency(summary.total_deposits)}
        />
        <SummaryCard
          label="Total Bookings"
          value={summary.total_bookings.toString()}
          subtext={`Avg: ${formatCurrency(summary.average_booking_value)}`}
        />
      </div>
      {(summary.highest_day || summary.lowest_day) && (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {summary.highest_day && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
              <p className="text-xs text-green-400 uppercase tracking-wider">Best Day</p>
              <p className="text-lg font-bold text-green-300 mt-1">{formatCurrency(summary.highest_day_revenue)}</p>
              <p className="text-xs text-ink-400 mt-1">{new Date(summary.highest_day).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</p>
            </div>
          )}
          {summary.lowest_day && summary.lowest_day_revenue > 0 && (
            <div className="bg-ink-700/50 rounded-lg p-4">
              <p className="text-xs text-ink-400 uppercase tracking-wider">Slowest Day</p>
              <p className="text-lg font-bold text-ink-100 mt-1">{formatCurrency(summary.lowest_day_revenue)}</p>
              <p className="text-xs text-ink-400 mt-1">{new Date(summary.lowest_day).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Daily Data Table
function DailyDataTable({ data }: { data: RevenueByDay[] }) {
  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-ink-400">
        No revenue data for this period.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-ink-700">
            <th className="text-left py-3 px-4 text-xs font-medium text-ink-400 uppercase tracking-wider">Date</th>
            <th className="text-right py-3 px-4 text-xs font-medium text-ink-400 uppercase tracking-wider">Revenue</th>
            <th className="text-right py-3 px-4 text-xs font-medium text-ink-400 uppercase tracking-wider">Tips</th>
            <th className="text-right py-3 px-4 text-xs font-medium text-ink-400 uppercase tracking-wider">Deposits</th>
            <th className="text-right py-3 px-4 text-xs font-medium text-ink-400 uppercase tracking-wider">Bookings</th>
            <th className="text-right py-3 px-4 text-xs font-medium text-ink-400 uppercase tracking-wider">Avg Booking</th>
          </tr>
        </thead>
        <tbody>
          {data.map((day, idx) => (
            <tr key={day.date} className={`border-b border-ink-700/50 ${idx % 2 === 0 ? 'bg-ink-800/50' : ''}`}>
              <td className="py-3 px-4">
                <div className="text-sm font-medium text-ink-100">
                  {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
                <div className="text-xs text-ink-400">{day.day_name}</div>
              </td>
              <td className="py-3 px-4 text-right text-sm font-medium text-ink-100">{formatCurrency(day.revenue)}</td>
              <td className="py-3 px-4 text-right text-sm text-ink-300">{formatCurrency(day.tips)}</td>
              <td className="py-3 px-4 text-right text-sm text-ink-300">{formatCurrency(day.deposits)}</td>
              <td className="py-3 px-4 text-right text-sm text-ink-300">{day.bookings}</td>
              <td className="py-3 px-4 text-right text-sm text-ink-300">{formatCurrency(day.average_booking)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Weekly Data Table
function WeeklyDataTable({ data }: { data: RevenueByWeek[] }) {
  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-ink-400">
        No revenue data for this period.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-ink-700">
            <th className="text-left py-3 px-4 text-xs font-medium text-ink-400 uppercase tracking-wider">Week</th>
            <th className="text-right py-3 px-4 text-xs font-medium text-ink-400 uppercase tracking-wider">Revenue</th>
            <th className="text-right py-3 px-4 text-xs font-medium text-ink-400 uppercase tracking-wider">Change</th>
            <th className="text-right py-3 px-4 text-xs font-medium text-ink-400 uppercase tracking-wider">Tips</th>
            <th className="text-right py-3 px-4 text-xs font-medium text-ink-400 uppercase tracking-wider">Bookings</th>
            <th className="text-right py-3 px-4 text-xs font-medium text-ink-400 uppercase tracking-wider">Avg Booking</th>
          </tr>
        </thead>
        <tbody>
          {data.map((week, idx) => (
            <tr key={week.week_start} className={`border-b border-ink-700/50 ${idx % 2 === 0 ? 'bg-ink-800/50' : ''}`}>
              <td className="py-3 px-4">
                <div className="text-sm font-medium text-ink-100">Week {week.week_number}</div>
                <div className="text-xs text-ink-400">
                  {new Date(week.week_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(week.week_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
              </td>
              <td className="py-3 px-4 text-right text-sm font-medium text-ink-100">{formatCurrency(week.revenue)}</td>
              <td className="py-3 px-4 text-right">
                {week.change_from_previous !== null && (
                  <span className={`inline-flex items-center gap-1 text-sm ${week.change_from_previous >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    <TrendIcon up={week.change_from_previous >= 0} />
                    {Math.abs(week.change_from_previous).toFixed(1)}%
                  </span>
                )}
              </td>
              <td className="py-3 px-4 text-right text-sm text-ink-300">{formatCurrency(week.tips)}</td>
              <td className="py-3 px-4 text-right text-sm text-ink-300">{week.bookings}</td>
              <td className="py-3 px-4 text-right text-sm text-ink-300">{formatCurrency(week.average_booking)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Monthly Data Table
function MonthlyDataTable({ data }: { data: RevenueByMonth[] }) {
  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-ink-400">
        No revenue data for this period.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-ink-700">
            <th className="text-left py-3 px-4 text-xs font-medium text-ink-400 uppercase tracking-wider">Month</th>
            <th className="text-right py-3 px-4 text-xs font-medium text-ink-400 uppercase tracking-wider">Revenue</th>
            <th className="text-right py-3 px-4 text-xs font-medium text-ink-400 uppercase tracking-wider">Change</th>
            <th className="text-right py-3 px-4 text-xs font-medium text-ink-400 uppercase tracking-wider">Tips</th>
            <th className="text-right py-3 px-4 text-xs font-medium text-ink-400 uppercase tracking-wider">Bookings</th>
            <th className="text-right py-3 px-4 text-xs font-medium text-ink-400 uppercase tracking-wider">Avg Booking</th>
          </tr>
        </thead>
        <tbody>
          {data.map((month, idx) => (
            <tr key={month.month} className={`border-b border-ink-700/50 ${idx % 2 === 0 ? 'bg-ink-800/50' : ''}`}>
              <td className="py-3 px-4">
                <div className="text-sm font-medium text-ink-100">{month.month_name}</div>
              </td>
              <td className="py-3 px-4 text-right text-sm font-medium text-ink-100">{formatCurrency(month.revenue)}</td>
              <td className="py-3 px-4 text-right">
                {month.change_from_previous !== null && (
                  <span className={`inline-flex items-center gap-1 text-sm ${month.change_from_previous >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    <TrendIcon up={month.change_from_previous >= 0} />
                    {Math.abs(month.change_from_previous).toFixed(1)}%
                  </span>
                )}
              </td>
              <td className="py-3 px-4 text-right text-sm text-ink-300">{formatCurrency(month.tips)}</td>
              <td className="py-3 px-4 text-right text-sm text-ink-300">{month.bookings}</td>
              <td className="py-3 px-4 text-right text-sm text-ink-300">{formatCurrency(month.average_booking)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Artist Breakdown Table
function ArtistBreakdownTable({ data }: { data: RevenueByArtist[] }) {
  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-ink-400">
        No artist data available.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-ink-700">
            <th className="text-left py-3 px-4 text-xs font-medium text-ink-400 uppercase tracking-wider">Artist</th>
            <th className="text-right py-3 px-4 text-xs font-medium text-ink-400 uppercase tracking-wider">Revenue</th>
            <th className="text-right py-3 px-4 text-xs font-medium text-ink-400 uppercase tracking-wider">Share</th>
            <th className="text-right py-3 px-4 text-xs font-medium text-ink-400 uppercase tracking-wider">Tips</th>
            <th className="text-right py-3 px-4 text-xs font-medium text-ink-400 uppercase tracking-wider">Bookings</th>
          </tr>
        </thead>
        <tbody>
          {data.map((artist, idx) => (
            <tr key={artist.artist_id} className={`border-b border-ink-700/50 ${idx % 2 === 0 ? 'bg-ink-800/50' : ''}`}>
              <td className="py-3 px-4">
                <div className="text-sm font-medium text-ink-100">{artist.artist_name}</div>
              </td>
              <td className="py-3 px-4 text-right text-sm font-medium text-ink-100">{formatCurrency(artist.revenue)}</td>
              <td className="py-3 px-4 text-right">
                <div className="flex items-center justify-end gap-2">
                  <div className="w-16 bg-ink-700 rounded-full h-2">
                    <div
                      className="bg-accent-primary h-2 rounded-full"
                      style={{ width: `${Math.min(artist.percentage, 100)}%` }}
                    ></div>
                  </div>
                  <span className="text-sm text-ink-300 w-12 text-right">{artist.percentage.toFixed(1)}%</span>
                </div>
              </td>
              <td className="py-3 px-4 text-right text-sm text-ink-300">{formatCurrency(artist.tips)}</td>
              <td className="py-3 px-4 text-right text-sm text-ink-300">{artist.bookings}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Category Breakdown Table
function CategoryBreakdownTable({ data, title }: { data: RevenueByCategory[]; title: string }) {
  if (data.length === 0) {
    return null;
  }

  return (
    <div className="bg-ink-800 rounded-xl border border-ink-700 p-6">
      <h3 className="text-lg font-semibold text-ink-100 mb-4">By {title}</h3>
      <div className="space-y-3">
        {data.map((item) => (
          <div key={item.category} className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-ink-100 capitalize">{item.category.replace('_', ' ')}</span>
                <span className="text-sm text-ink-300">{formatCurrency(item.revenue)}</span>
              </div>
              <div className="w-full bg-ink-700 rounded-full h-2">
                <div
                  className="bg-accent-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(item.percentage, 100)}%` }}
                ></div>
              </div>
            </div>
            <div className="text-right w-20">
              <span className="text-sm text-ink-400">{item.count} bookings</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function RevenueReports() {
  const presets = getPresetDateRanges();
  const [reportType, setReportType] = useState<ReportType>('daily');
  const [selectedPreset, setSelectedPreset] = useState('thisMonth');
  const [startDate, setStartDate] = useState(presets.find(p => p.value === 'thisMonth')?.startDate || '');
  const [endDate, setEndDate] = useState(presets.find(p => p.value === 'thisMonth')?.endDate || '');
  const [report, setReport] = useState<RevenueReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadReport() {
      if (!startDate || !endDate) return;

      setLoading(true);
      setError(null);
      try {
        const data = await getRevenueReport(reportType, startDate, endDate);
        setReport(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load report');
      } finally {
        setLoading(false);
      }
    }

    loadReport();
  }, [reportType, startDate, endDate]);

  const handlePresetChange = (value: string) => {
    setSelectedPreset(value);
    const preset = presets.find(p => p.value === value);
    if (preset) {
      setStartDate(preset.startDate);
      setEndDate(preset.endDate);
    }
  };

  const handleExportCSV = () => {
    if (!report) return;

    let csvContent = 'data:text/csv;charset=utf-8,';

    // Add header based on report type
    if (report.report_type === 'daily' || report.report_type === 'custom') {
      csvContent += 'Date,Day,Revenue,Tips,Deposits,Bookings,Avg Booking\n';
      const data = report.report_type === 'daily' ? report.daily_data : report.daily_data;
      data.forEach((day: RevenueByDay) => {
        csvContent += `${day.date},${day.day_name},${(day.revenue / 100).toFixed(2)},${(day.tips / 100).toFixed(2)},${(day.deposits / 100).toFixed(2)},${day.bookings},${(day.average_booking / 100).toFixed(2)}\n`;
      });
    } else if (report.report_type === 'weekly') {
      csvContent += 'Week,Start,End,Revenue,Tips,Deposits,Bookings,Avg Booking,Change %\n';
      report.weekly_data.forEach((week: RevenueByWeek) => {
        csvContent += `Week ${week.week_number},${week.week_start},${week.week_end},${(week.revenue / 100).toFixed(2)},${(week.tips / 100).toFixed(2)},${(week.deposits / 100).toFixed(2)},${week.bookings},${(week.average_booking / 100).toFixed(2)},${week.change_from_previous ?? ''}\n`;
      });
    } else if (report.report_type === 'monthly') {
      csvContent += 'Month,Revenue,Tips,Deposits,Bookings,Avg Booking,Change %\n';
      report.monthly_data.forEach((month: RevenueByMonth) => {
        csvContent += `${month.month_name},${(month.revenue / 100).toFixed(2)},${(month.tips / 100).toFixed(2)},${(month.deposits / 100).toFixed(2)},${month.bookings},${(month.average_booking / 100).toFixed(2)},${month.change_from_previous ?? ''}\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `revenue_report_${report.report_type}_${startDate}_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-100 flex items-center gap-2">
            <ChartIcon />
            Revenue Reports
          </h1>
          <p className="text-ink-400 mt-1">Track your studio's revenue performance</p>
        </div>
        <button
          onClick={handleExportCSV}
          disabled={!report || loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-ink-700 hover:bg-ink-600 disabled:opacity-50 disabled:cursor-not-allowed text-ink-100 rounded-lg transition-colors"
        >
          <DownloadIcon />
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="bg-ink-800 rounded-xl border border-ink-700 p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Report Type */}
          <div className="flex-shrink-0">
            <label className="block text-xs text-ink-400 mb-2">Report Type</label>
            <div className="flex rounded-lg overflow-hidden border border-ink-600">
              {(['daily', 'weekly', 'monthly', 'custom'] as ReportType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => setReportType(type)}
                  className={`px-4 py-2 text-sm font-medium transition-colors capitalize ${
                    reportType === type
                      ? 'bg-accent-primary text-white'
                      : 'bg-ink-700 text-ink-300 hover:bg-ink-600'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Preset Selector */}
          <div className="flex-shrink-0">
            <label className="block text-xs text-ink-400 mb-2">Preset</label>
            <select
              value={selectedPreset}
              onChange={(e) => handlePresetChange(e.target.value)}
              className="w-full px-3 py-2 bg-ink-700 border border-ink-600 rounded-lg text-ink-100 focus:outline-none focus:ring-2 focus:ring-accent-primary/50"
            >
              {presets.map((preset) => (
                <option key={preset.value} value={preset.value}>
                  {preset.label}
                </option>
              ))}
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {/* Date Range */}
          <div className="flex gap-4 flex-1">
            <div className="flex-1">
              <label className="block text-xs text-ink-400 mb-2">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setSelectedPreset('custom');
                }}
                className="w-full px-3 py-2 bg-ink-700 border border-ink-600 rounded-lg text-ink-100 focus:outline-none focus:ring-2 focus:ring-accent-primary/50"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-ink-400 mb-2">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setSelectedPreset('custom');
                }}
                className="w-full px-3 py-2 bg-ink-700 border border-ink-600 rounded-lg text-ink-100 focus:outline-none focus:ring-2 focus:ring-accent-primary/50"
              />
            </div>
          </div>
        </div>

        {/* Date Range Display */}
        <div className="mt-4 flex items-center gap-2 text-sm text-ink-400">
          <CalendarIcon />
          <span>Showing data for: {formatDateRange(startDate, endDate)}</span>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Summary Section */}
      <RevenueSummarySection summary={report?.summary || null} loading={loading} />

      {/* Main Data Table */}
      <div className="bg-ink-800 rounded-xl border border-ink-700 p-6">
        <h3 className="text-lg font-semibold text-ink-100 mb-4">
          {reportType === 'daily' && 'Daily Revenue'}
          {reportType === 'weekly' && 'Weekly Revenue'}
          {reportType === 'monthly' && 'Monthly Revenue'}
          {reportType === 'custom' && 'Revenue by Day'}
        </h3>
        {loading ? (
          <div className="animate-pulse space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-ink-700/50 rounded"></div>
            ))}
          </div>
        ) : report ? (
          <>
            {(report.report_type === 'daily' || report.report_type === 'custom') && (
              <DailyDataTable data={report.daily_data} />
            )}
            {report.report_type === 'weekly' && <WeeklyDataTable data={report.weekly_data} />}
            {report.report_type === 'monthly' && <MonthlyDataTable data={report.monthly_data} />}
          </>
        ) : null}
      </div>

      {/* Artist Breakdown */}
      {report && report.by_artist.length > 0 && (
        <div className="bg-ink-800 rounded-xl border border-ink-700 p-6">
          <h3 className="text-lg font-semibold text-ink-100 mb-4">Revenue by Artist</h3>
          <ArtistBreakdownTable data={report.by_artist} />
        </div>
      )}

      {/* Category Breakdowns (only for daily and custom reports) */}
      {report && (report.report_type === 'daily' || report.report_type === 'custom') && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <CategoryBreakdownTable data={report.by_size} title="Size" />
          <CategoryBreakdownTable data={report.by_placement} title="Placement" />
        </div>
      )}
    </div>
  );
}
