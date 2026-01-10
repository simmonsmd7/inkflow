/**
 * Artist Performance page - view detailed performance metrics for artists.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type {
  ArtistPerformanceListResponse,
  ArtistDetailedPerformance,
  TimeRange,
} from '../services/analytics';
import {
  getArtistPerformanceList,
  getArtistDetailedPerformance,
  formatCurrency,
  formatPercent,
  formatHour,
} from '../services/analytics';

type ViewMode = 'list' | 'detail';

const TIME_RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'quarter', label: 'This Quarter' },
  { value: 'year', label: 'This Year' },
];

function StatCard({ label, value, subtext, icon }: { label: string; value: string; subtext?: string; icon?: React.ReactNode }) {
  return (
    <div className="bg-ink-700/50 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon && <span className="text-accent-primary">{icon}</span>}
        <p className="text-xs text-ink-400 uppercase tracking-wider">{label}</p>
      </div>
      <p className="text-xl font-bold text-ink-100">{value}</p>
      {subtext && <p className="text-xs text-ink-500 mt-1">{subtext}</p>}
    </div>
  );
}

function ProgressBar({ value, max, label }: { value: number; max: number; label: string }) {
  const percentage = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-ink-300 w-24 truncate">{label}</span>
      <div className="flex-1 bg-ink-700 rounded-full h-2">
        <div
          className="bg-accent-primary rounded-full h-2 transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-sm text-ink-400 w-8 text-right">{value}</span>
    </div>
  );
}

function ArtistCard({
  artist,
  rank,
  onClick,
}: {
  artist: ArtistPerformanceListResponse['artists'][0];
  rank: number;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="bg-ink-800 rounded-xl border border-ink-700 p-5 hover:border-accent-primary/50 transition-colors cursor-pointer"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {artist.profile_image ? (
            <img
              src={artist.profile_image}
              alt={artist.artist_name}
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-accent-primary/20 flex items-center justify-center text-accent-primary font-medium text-lg">
              {artist.artist_name.charAt(0)}
            </div>
          )}
          <div>
            <h3 className="font-semibold text-ink-100">{artist.artist_name}</h3>
            <p className="text-xs text-ink-400">{artist.completed_bookings} completed bookings</p>
          </div>
        </div>
        <div className="w-8 h-8 rounded-full bg-accent-primary/10 flex items-center justify-center text-accent-primary font-bold text-sm">
          #{rank}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <p className="text-xs text-ink-400">Revenue</p>
          <p className="text-lg font-semibold text-ink-100">{formatCurrency(artist.total_revenue)}</p>
        </div>
        <div>
          <p className="text-xs text-ink-400">Tips</p>
          <p className="text-lg font-semibold text-green-400">{formatCurrency(artist.total_tips)}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-ink-700/50 rounded-lg p-2">
          <p className="text-xs text-ink-400">Commission</p>
          <p className="text-sm font-medium text-ink-200">{formatCurrency(artist.commission_earned)}</p>
        </div>
        <div className="bg-ink-700/50 rounded-lg p-2">
          <p className="text-xs text-ink-400">Completion</p>
          <p className="text-sm font-medium text-ink-200">{formatPercent(artist.completion_rate)}</p>
        </div>
        <div className="bg-ink-700/50 rounded-lg p-2">
          <p className="text-xs text-ink-400">Utilization</p>
          <p className="text-sm font-medium text-ink-200">{formatPercent(artist.utilization_rate)}</p>
        </div>
      </div>

      {artist.no_show_count > 0 && (
        <div className="mt-3 flex items-center gap-1 text-amber-400 text-xs">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>{artist.no_show_count} no-show{artist.no_show_count > 1 ? 's' : ''}</span>
        </div>
      )}
    </div>
  );
}

function ArtistDetailView({
  artist,
  onBack,
}: {
  artist: ArtistDetailedPerformance;
  onBack: () => void;
}) {
  // Find max value for progress bars
  const maxPlacement = Math.max(...Object.values(artist.specialties_stats.placement_breakdown), 1);
  const maxSize = Math.max(...Object.values(artist.specialties_stats.size_breakdown), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 text-ink-400 hover:text-ink-200 hover:bg-ink-700 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div className="flex items-center gap-4">
          {artist.profile_image ? (
            <img
              src={artist.profile_image}
              alt={artist.artist_name}
              className="w-16 h-16 rounded-full object-cover"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-accent-primary/20 flex items-center justify-center text-accent-primary font-bold text-2xl">
              {artist.artist_name.charAt(0)}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-ink-100">{artist.artist_name}</h1>
            <p className="text-ink-400">{artist.artist_email}</p>
            {artist.specialties.length > 0 && (
              <div className="flex gap-2 mt-2">
                {artist.specialties.map((spec, i) => (
                  <span key={i} className="text-xs px-2 py-1 bg-accent-primary/10 text-accent-primary rounded-full">
                    {spec}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Revenue Stats */}
      <div className="bg-ink-800 rounded-xl border border-ink-700 p-6">
        <h2 className="text-lg font-semibold text-ink-100 mb-4">Revenue Overview</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Service Revenue"
            value={formatCurrency(artist.revenue.service_revenue)}
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <StatCard
            label="Tips Received"
            value={formatCurrency(artist.revenue.tips)}
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            }
          />
          <StatCard
            label="Commission Earned"
            value={formatCurrency(artist.revenue.commission_earned)}
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            }
          />
          <StatCard
            label="Avg. Per Booking"
            value={formatCurrency(artist.revenue.average_per_booking)}
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            }
          />
        </div>
      </div>

      {/* Booking Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-ink-800 rounded-xl border border-ink-700 p-6">
          <h2 className="text-lg font-semibold text-ink-100 mb-4">Booking Statistics</h2>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center p-3 bg-ink-700/50 rounded-lg">
              <p className="text-2xl font-bold text-ink-100">{artist.bookings.completed}</p>
              <p className="text-xs text-ink-400">Completed</p>
            </div>
            <div className="text-center p-3 bg-ink-700/50 rounded-lg">
              <p className="text-2xl font-bold text-blue-400">{artist.bookings.confirmed}</p>
              <p className="text-xs text-ink-400">Upcoming</p>
            </div>
            <div className="text-center p-3 bg-ink-700/50 rounded-lg">
              <p className="text-2xl font-bold text-ink-100">{artist.bookings.total_requests}</p>
              <p className="text-xs text-ink-400">Total Assigned</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-400">Completion Rate</span>
              <span className="text-ink-100 font-medium">{formatPercent(artist.bookings.completion_rate)}</span>
            </div>
            <div className="w-full bg-ink-700 rounded-full h-2">
              <div
                className="bg-green-500 rounded-full h-2 transition-all"
                style={{ width: `${artist.bookings.completion_rate}%` }}
              />
            </div>
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-red-500 rounded-full"></span>
                <span className="text-sm text-ink-400">No-shows: {artist.bookings.no_shows}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-amber-500 rounded-full"></span>
                <span className="text-sm text-ink-400">Cancelled: {artist.bookings.cancelled}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-ink-800 rounded-xl border border-ink-700 p-6">
          <h2 className="text-lg font-semibold text-ink-100 mb-4">Time & Utilization</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="p-3 bg-ink-700/50 rounded-lg">
              <p className="text-xs text-ink-400 mb-1">Total Hours</p>
              <p className="text-xl font-bold text-ink-100">{artist.time_stats.total_hours_booked}h</p>
            </div>
            <div className="p-3 bg-ink-700/50 rounded-lg">
              <p className="text-xs text-ink-400 mb-1">Avg. Duration</p>
              <p className="text-xl font-bold text-ink-100">{artist.time_stats.average_duration}h</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-400">Utilization Rate</span>
              <span className="text-ink-100 font-medium">{formatPercent(artist.time_stats.utilization_rate)}</span>
            </div>
            <div className="w-full bg-ink-700 rounded-full h-2">
              <div
                className="bg-accent-primary rounded-full h-2 transition-all"
                style={{ width: `${Math.min(artist.time_stats.utilization_rate, 100)}%` }}
              />
            </div>
            <div className="pt-2 text-sm text-ink-400">
              <p>Busiest day: <span className="text-ink-200">{artist.time_stats.busiest_day}</span></p>
              <p>Peak hour: <span className="text-ink-200">{formatHour(artist.time_stats.busiest_hour)}</span></p>
            </div>
          </div>
        </div>
      </div>

      {/* Specialties */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-ink-800 rounded-xl border border-ink-700 p-6">
          <h2 className="text-lg font-semibold text-ink-100 mb-4">Popular Placements</h2>
          <div className="space-y-3">
            {Object.entries(artist.specialties_stats.placement_breakdown).length > 0 ? (
              Object.entries(artist.specialties_stats.placement_breakdown)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 8)
                .map(([placement, count]) => (
                  <ProgressBar key={placement} label={placement} value={count} max={maxPlacement} />
                ))
            ) : (
              <p className="text-ink-400 text-center py-4">No placement data available</p>
            )}
          </div>
        </div>

        <div className="bg-ink-800 rounded-xl border border-ink-700 p-6">
          <h2 className="text-lg font-semibold text-ink-100 mb-4">Tattoo Sizes</h2>
          <div className="space-y-3">
            {Object.entries(artist.specialties_stats.size_breakdown).length > 0 ? (
              Object.entries(artist.specialties_stats.size_breakdown)
                .sort(([, a], [, b]) => b - a)
                .map(([size, count]) => (
                  <ProgressBar key={size} label={size} value={count} max={maxSize} />
                ))
            ) : (
              <p className="text-ink-400 text-center py-4">No size data available</p>
            )}
          </div>
        </div>
      </div>

      {/* Client Metrics */}
      <div className="bg-ink-800 rounded-xl border border-ink-700 p-6">
        <h2 className="text-lg font-semibold text-ink-100 mb-4">Client Metrics</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 bg-ink-700/50 rounded-lg">
            <p className="text-3xl font-bold text-ink-100">{artist.total_clients}</p>
            <p className="text-sm text-ink-400 mt-1">Total Clients</p>
          </div>
          <div className="text-center p-4 bg-ink-700/50 rounded-lg">
            <p className="text-3xl font-bold text-green-400">{artist.returning_clients}</p>
            <p className="text-sm text-ink-400 mt-1">Returning Clients</p>
          </div>
          <div className="text-center p-4 bg-ink-700/50 rounded-lg">
            <p className="text-3xl font-bold text-accent-primary">{formatPercent(artist.client_retention_rate)}</p>
            <p className="text-sm text-ink-400 mt-1">Retention Rate</p>
          </div>
        </div>
      </div>

      {/* Monthly Performance Chart */}
      {artist.monthly_performance.length > 0 && (
        <div className="bg-ink-800 rounded-xl border border-ink-700 p-6">
          <h2 className="text-lg font-semibold text-ink-100 mb-4">Monthly Performance</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs text-ink-400 uppercase tracking-wider">
                  <th className="pb-3 font-medium">Month</th>
                  <th className="pb-3 font-medium text-right">Bookings</th>
                  <th className="pb-3 font-medium text-right">Revenue</th>
                  <th className="pb-3 font-medium text-right">Tips</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-700">
                {artist.monthly_performance.map((month) => (
                  <tr key={month.month} className="text-sm">
                    <td className="py-3 text-ink-200 font-medium">{month.month}</td>
                    <td className="py-3 text-right text-ink-300">{month.bookings}</td>
                    <td className="py-3 text-right text-ink-100 font-medium">{formatCurrency(month.revenue)}</td>
                    <td className="py-3 text-right text-green-400">{formatCurrency(month.tips)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export function ArtistPerformance() {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [timeRange, setTimeRange] = useState<TimeRange>('month');
  const [listData, setListData] = useState<ArtistPerformanceListResponse | null>(null);
  const [selectedArtist, setSelectedArtist] = useState<ArtistDetailedPerformance | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchArtists() {
      try {
        setLoading(true);
        const response = await getArtistPerformanceList(timeRange);
        setListData(response);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch artist performance:', err);
        setError('Failed to load artist performance data');
      } finally {
        setLoading(false);
      }
    }

    fetchArtists();
  }, [timeRange]);

  const handleSelectArtist = async (artistId: string) => {
    try {
      setDetailLoading(true);
      const response = await getArtistDetailedPerformance(artistId, timeRange);
      setSelectedArtist(response);
      setViewMode('detail');
    } catch (err) {
      console.error('Failed to fetch artist details:', err);
      setError('Failed to load artist details');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleBack = () => {
    setViewMode('list');
    setSelectedArtist(null);
  };

  if (viewMode === 'detail' && selectedArtist) {
    return (
      <div className="space-y-6">
        <ArtistDetailView artist={selectedArtist} onBack={handleBack} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-100">Artist Performance</h1>
          <p className="text-ink-400 mt-1">
            Track and compare artist metrics across your studio
            {listData && <span className="text-ink-500"> - {listData.period_label}</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as TimeRange)}
            className="bg-ink-700 border border-ink-600 rounded-lg px-3 py-2 text-ink-200 focus:outline-none focus:border-accent-primary"
          >
            {TIME_RANGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <Link
            to="/dashboard"
            className="px-4 py-2 bg-ink-700 text-ink-200 rounded-lg hover:bg-ink-600 transition-colors"
          >
            Dashboard
          </Link>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {(loading || detailLoading) && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-ink-800 rounded-xl border border-ink-700 p-5 animate-pulse">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-ink-700 rounded-full"></div>
                <div>
                  <div className="h-5 bg-ink-700 rounded w-32 mb-2"></div>
                  <div className="h-3 bg-ink-700 rounded w-24"></div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="h-14 bg-ink-700 rounded-lg"></div>
                <div className="h-14 bg-ink-700 rounded-lg"></div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="h-12 bg-ink-700 rounded-lg"></div>
                <div className="h-12 bg-ink-700 rounded-lg"></div>
                <div className="h-12 bg-ink-700 rounded-lg"></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No Artists State */}
      {!loading && listData && listData.artists.length === 0 && (
        <div className="bg-ink-800 rounded-xl border border-ink-700 p-12 text-center">
          <svg className="w-16 h-16 mx-auto mb-4 text-ink-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <h2 className="text-xl font-semibold text-ink-200 mb-2">No Artists Found</h2>
          <p className="text-ink-400 mb-4">There are no artists registered in the system yet.</p>
          <Link
            to="/artists"
            className="inline-flex items-center gap-2 px-4 py-2 bg-accent-primary text-white rounded-lg hover:bg-accent-primary/90 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add Artists
          </Link>
        </div>
      )}

      {/* Artist Cards */}
      {!loading && listData && listData.artists.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {listData.artists.map((artist, index) => (
            <ArtistCard
              key={artist.artist_id}
              artist={artist}
              rank={index + 1}
              onClick={() => handleSelectArtist(artist.artist_id)}
            />
          ))}
        </div>
      )}

      {/* Summary Stats */}
      {!loading && listData && listData.artists.length > 0 && (
        <div className="bg-ink-800 rounded-xl border border-ink-700 p-6">
          <h2 className="text-lg font-semibold text-ink-100 mb-4">Studio Summary</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Total Artists"
              value={listData.total_artists.toString()}
            />
            <StatCard
              label="Total Revenue"
              value={formatCurrency(listData.artists.reduce((sum, a) => sum + a.total_revenue, 0))}
            />
            <StatCard
              label="Total Bookings"
              value={listData.artists.reduce((sum, a) => sum + a.completed_bookings, 0).toString()}
            />
            <StatCard
              label="Avg. Utilization"
              value={formatPercent(
                listData.artists.reduce((sum, a) => sum + a.utilization_rate, 0) / listData.total_artists
              )}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default ArtistPerformance;
