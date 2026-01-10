/**
 * Popular Time Slots Analytics Page.
 * Displays time slot popularity with heatmap visualization and insights.
 */

import { useState, useEffect, useMemo } from 'react';
import type { TimeSlotAnalyticsResponse, TimeRange } from '../services/analytics';
import {
  getTimeSlotAnalytics,
  formatHour,
  getDayName,
  formatPercent,
} from '../services/analytics';

// Day names for display
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Working hours range (typically tattoo studios)
const WORKING_HOURS = Array.from({ length: 14 }, (_, i) => i + 9); // 9 AM to 10 PM

export default function PopularTimeSlots() {
  const [data, setData] = useState<TimeSlotAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('month');

  useEffect(() => {
    fetchData();
  }, [timeRange]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getTimeSlotAnalytics(timeRange);
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load time slot analytics');
    } finally {
      setLoading(false);
    }
  };

  // Build heatmap data from popular slots
  const heatmapData = useMemo((): { map: Record<string, number>; maxCount: number } => {
    if (!data) return { map: {}, maxCount: 0 };
    const map: Record<string, number> = {};
    let maxCount = 0;

    for (const slot of data.popular_slots) {
      const key = `${slot.day_of_week}-${slot.hour}`;
      map[key] = slot.booking_count;
      if (slot.booking_count > maxCount) {
        maxCount = slot.booking_count;
      }
    }

    return { map, maxCount };
  }, [data]);

  // Calculate day totals
  const dayTotals = useMemo(() => {
    if (!data) return [];
    const totals: Record<number, number> = {};

    for (const slot of data.popular_slots) {
      totals[slot.day_of_week] = (totals[slot.day_of_week] || 0) + slot.booking_count;
    }

    return DAYS.map((name, index) => ({
      name,
      shortName: SHORT_DAYS[index],
      index,
      count: totals[index] || 0,
    })).sort((a, b) => b.count - a.count);
  }, [data]);

  // Calculate hour totals
  const hourTotals = useMemo(() => {
    if (!data) return [];
    const totals: Record<number, number> = {};

    for (const slot of data.popular_slots) {
      totals[slot.hour] = (totals[slot.hour] || 0) + slot.booking_count;
    }

    return WORKING_HOURS.map((hour) => ({
      hour,
      label: formatHour(hour),
      count: totals[hour] || 0,
    })).sort((a, b) => b.count - a.count);
  }, [data]);

  // Total bookings
  const totalBookings = useMemo(() => {
    if (!data) return 0;
    return data.popular_slots.reduce((sum, slot) => sum + slot.booking_count, 0);
  }, [data]);

  // Get heatmap cell color based on intensity
  const getHeatmapColor = (count: number, maxCount: number): string => {
    if (count === 0) return 'bg-ink-700';
    const intensity = count / maxCount;
    if (intensity > 0.8) return 'bg-accent-500';
    if (intensity > 0.6) return 'bg-accent-600';
    if (intensity > 0.4) return 'bg-accent-700';
    if (intensity > 0.2) return 'bg-accent-800';
    return 'bg-accent-900';
  };

  // Get bar width as percentage
  const getBarWidth = (count: number, maxCount: number): string => {
    if (maxCount === 0) return '0%';
    return `${(count / maxCount) * 100}%`;
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
            onClick={fetchData}
            className="mt-4 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { map, maxCount } = heatmapData;
  const maxDayCount = Math.max(...dayTotals.map((d) => d.count), 1);
  const maxHourCount = Math.max(...hourTotals.map((h) => h.count), 1);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Popular Time Slots</h1>
          <p className="text-ink-400 mt-1">
            Analyze booking patterns to optimize your schedule
          </p>
        </div>

        {/* Time Range Selector */}
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value as TimeRange)}
          className="bg-ink-700 border border-ink-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-accent-500"
        >
          <option value="week">This Week</option>
          <option value="month">This Month</option>
          <option value="quarter">This Quarter</option>
          <option value="year">This Year</option>
        </select>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Busiest Day"
          value={data.busiest_day}
          subtitle={`Most bookings occur on ${data.busiest_day}s`}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }
          highlight
        />

        <MetricCard
          title="Peak Hour"
          value={formatHour(data.busiest_hour)}
          subtitle="Most popular booking time"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />

        <MetricCard
          title="Quietest Day"
          value={data.quietest_day}
          subtitle={`Consider promotions on ${data.quietest_day}s`}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          }
        />

        <MetricCard
          title="Total Bookings"
          value={totalBookings.toLocaleString()}
          subtitle="In selected period"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          }
        />
      </div>

      {/* Heatmap Section */}
      <div className="bg-ink-800 rounded-lg border border-ink-700 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Booking Heatmap</h2>
        <p className="text-ink-400 text-sm mb-6">
          Darker colors indicate more bookings at that time slot
        </p>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left text-ink-400 text-xs font-medium pb-3 pr-4">Time</th>
                {DAYS.map((day, index) => (
                  <th key={day} className="text-center text-ink-400 text-xs font-medium pb-3 px-1">
                    {SHORT_DAYS[index]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {WORKING_HOURS.map((hour) => (
                <tr key={hour}>
                  <td className="text-ink-400 text-xs pr-4 py-1">{formatHour(hour)}</td>
                  {DAYS.map((_, dayIndex) => {
                    const key = `${dayIndex}-${hour}`;
                    const count = map[key] || 0;
                    return (
                      <td key={dayIndex} className="px-1 py-1">
                        <div
                          className={`w-full h-8 rounded ${getHeatmapColor(count, maxCount)} flex items-center justify-center transition-all hover:ring-2 hover:ring-white/30 cursor-default`}
                          title={`${getDayName(dayIndex)} ${formatHour(hour)}: ${count} booking${count !== 1 ? 's' : ''}`}
                        >
                          {count > 0 && (
                            <span className="text-xs text-white/80">{count}</span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-6 pt-4 border-t border-ink-700">
          <span className="text-ink-400 text-sm">Popularity:</span>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-ink-700" />
              <span className="text-ink-500 text-xs">None</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-accent-900" />
              <span className="text-ink-500 text-xs">Low</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-accent-700" />
              <span className="text-ink-500 text-xs">Medium</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-accent-500" />
              <span className="text-ink-500 text-xs">High</span>
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Day of Week */}
        <div className="bg-ink-800 rounded-lg border border-ink-700 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">By Day of Week</h2>
          <div className="space-y-3">
            {dayTotals.map((day, index) => (
              <div key={day.name} className="flex items-center gap-4">
                <div className="w-20 text-sm text-ink-300">{day.shortName}</div>
                <div className="flex-1 h-6 bg-ink-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      index === 0 ? 'bg-accent-500' : 'bg-accent-600'
                    }`}
                    style={{ width: getBarWidth(day.count, maxDayCount) }}
                  />
                </div>
                <div className="w-16 text-right">
                  <span className="text-white font-medium">{day.count}</span>
                  <span className="text-ink-500 text-sm ml-1">
                    ({totalBookings > 0 ? formatPercent((day.count / totalBookings) * 100) : '0%'})
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* By Hour */}
        <div className="bg-ink-800 rounded-lg border border-ink-700 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">By Time of Day</h2>
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {hourTotals.slice(0, 10).map((hour, index) => (
              <div key={hour.hour} className="flex items-center gap-4">
                <div className="w-20 text-sm text-ink-300">{hour.label}</div>
                <div className="flex-1 h-6 bg-ink-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      index === 0 ? 'bg-purple-500' : 'bg-purple-600'
                    }`}
                    style={{ width: getBarWidth(hour.count, maxHourCount) }}
                  />
                </div>
                <div className="w-16 text-right">
                  <span className="text-white font-medium">{hour.count}</span>
                  <span className="text-ink-500 text-sm ml-1">
                    ({totalBookings > 0 ? formatPercent((hour.count / totalBookings) * 100) : '0%'})
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Time Slots Table */}
      <div className="bg-ink-800 rounded-lg border border-ink-700 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Top 10 Time Slots</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-ink-700">
                <th className="text-left text-ink-400 text-sm font-medium pb-3">Rank</th>
                <th className="text-left text-ink-400 text-sm font-medium pb-3">Day</th>
                <th className="text-left text-ink-400 text-sm font-medium pb-3">Time</th>
                <th className="text-right text-ink-400 text-sm font-medium pb-3">Bookings</th>
                <th className="text-right text-ink-400 text-sm font-medium pb-3">% of Total</th>
              </tr>
            </thead>
            <tbody>
              {data.popular_slots.slice(0, 10).map((slot, index) => (
                <tr key={`${slot.day_of_week}-${slot.hour}`} className="border-b border-ink-700/50">
                  <td className="py-3 text-ink-400">#{index + 1}</td>
                  <td className="py-3">
                    <span className={`font-medium ${index === 0 ? 'text-accent-400' : 'text-white'}`}>
                      {getDayName(slot.day_of_week)}
                    </span>
                  </td>
                  <td className="py-3 text-ink-300">{formatHour(slot.hour)}</td>
                  <td className="py-3 text-right font-medium text-white">{slot.booking_count}</td>
                  <td className="py-3 text-right text-ink-400">{formatPercent(slot.percentage_of_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Insights & Recommendations */}
      <div className="bg-ink-800 rounded-lg border border-ink-700 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Insights & Recommendations</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InsightCard
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            }
            title="Peak Demand"
            description={`${data.busiest_day} at ${formatHour(data.busiest_hour)} is your busiest time. Consider premium pricing or priority booking for this slot.`}
            color="accent"
          />

          <InsightCard
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
              </svg>
            }
            title="Slow Periods"
            description={`${data.quietest_day} has lower demand. Consider offering discounts or promotions to boost bookings.`}
            color="blue"
          />

          <InsightCard
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            title="Off-Peak Hours"
            description={`${formatHour(data.quietest_hour)} typically sees less traffic. Great time for consultations or admin work.`}
            color="purple"
          />

          <InsightCard
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            }
            title="Staff Scheduling"
            description={`Ensure maximum coverage on ${data.busiest_day}s, especially around ${formatHour(data.busiest_hour)}.`}
            color="green"
          />
        </div>
      </div>
    </div>
  );
}

// Metric Card Component
interface MetricCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  highlight?: boolean;
}

function MetricCard({ title, value, subtitle, icon, highlight }: MetricCardProps) {
  return (
    <div className={`rounded-lg border p-4 ${
      highlight
        ? 'bg-accent-500/10 border-accent-500/30'
        : 'bg-ink-800 border-ink-700'
    }`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-ink-400 text-sm">{title}</span>
        <div className={`${highlight ? 'text-accent-400' : 'text-ink-500'}`}>
          {icon}
        </div>
      </div>
      <div className={`text-2xl font-bold ${highlight ? 'text-accent-400' : 'text-white'}`}>
        {value}
      </div>
      <p className="text-ink-500 text-sm mt-1">{subtitle}</p>
    </div>
  );
}

// Insight Card Component
interface InsightCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: 'accent' | 'blue' | 'purple' | 'green';
}

function InsightCard({ icon, title, description, color }: InsightCardProps) {
  const colorClasses = {
    accent: 'bg-accent-500/10 border-accent-500/20 text-accent-400',
    blue: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
    purple: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
    green: 'bg-green-500/10 border-green-500/20 text-green-400',
  };

  return (
    <div className={`rounded-lg border p-4 ${colorClasses[color]}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{icon}</div>
        <div>
          <h3 className="font-medium">{title}</h3>
          <p className="text-ink-400 text-sm mt-1">{description}</p>
        </div>
      </div>
    </div>
  );
}
