/**
 * Availability page for managing artist weekly schedule and time-off.
 */

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import {
  getMyAvailability,
  updateMyAvailability,
  getMyTimeOff,
  addTimeOff,
  deleteTimeOff,
} from '../services/availability';
import type {
  AvailabilitySlotCreate,
  TimeOff,
  TimeOffCreate,
} from '../types/api';

// Day names
const DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

// Common time slots for quick selection
const TIME_OPTIONS = [
  '09:00',
  '09:30',
  '10:00',
  '10:30',
  '11:00',
  '11:30',
  '12:00',
  '12:30',
  '13:00',
  '13:30',
  '14:00',
  '14:30',
  '15:00',
  '15:30',
  '16:00',
  '16:30',
  '17:00',
  '17:30',
  '18:00',
  '18:30',
  '19:00',
  '19:30',
  '20:00',
  '20:30',
  '21:00',
];

interface DaySchedule {
  enabled: boolean;
  start: string;
  end: string;
}

type WeekSchedule = Record<number, DaySchedule>;

const DEFAULT_SCHEDULE: DaySchedule = {
  enabled: false,
  start: '10:00',
  end: '18:00',
};

export function Availability() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Weekly schedule state
  const [schedule, setSchedule] = useState<WeekSchedule>(() => {
    const initial: WeekSchedule = {};
    for (let i = 0; i < 7; i++) {
      initial[i] = { ...DEFAULT_SCHEDULE };
    }
    return initial;
  });

  // Time-off state
  const [timeOffs, setTimeOffs] = useState<TimeOff[]>([]);
  const [showTimeOffModal, setShowTimeOffModal] = useState(false);
  const [newTimeOff, setNewTimeOff] = useState<TimeOffCreate>({
    start_date: '',
    end_date: '',
    reason: '',
    all_day: true,
  });

  // Check if user is an artist or owner
  const canEdit = user?.role === 'artist' || user?.role === 'owner';

  const loadData = useCallback(async () => {
    if (!canEdit) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Load availability and time-off in parallel
      const [availabilityData, timeOffData] = await Promise.all([
        getMyAvailability(),
        getMyTimeOff(),
      ]);

      // Convert slots to schedule format
      const newSchedule: WeekSchedule = {};
      for (let i = 0; i < 7; i++) {
        newSchedule[i] = { ...DEFAULT_SCHEDULE };
      }

      for (const slot of availabilityData.slots) {
        const day = slot.day_of_week;
        newSchedule[day] = {
          enabled: slot.is_available,
          start: slot.start_time.slice(0, 5), // Remove seconds
          end: slot.end_time.slice(0, 5),
        };
      }

      setSchedule(newSchedule);
      setTimeOffs(timeOffData.time_off);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load availability');
    } finally {
      setLoading(false);
    }
  }, [canEdit]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDayToggle = (day: number) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        enabled: !prev[day].enabled,
      },
    }));
  };

  const handleTimeChange = (day: number, field: 'start' | 'end', value: string) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value,
      },
    }));
  };

  const handleSaveSchedule = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      // Convert schedule to slots
      const slots: AvailabilitySlotCreate[] = [];
      for (let day = 0; day < 7; day++) {
        const daySchedule = schedule[day];
        if (daySchedule.enabled) {
          slots.push({
            day_of_week: day,
            start_time: daySchedule.start + ':00',
            end_time: daySchedule.end + ':00',
            is_available: true,
          });
        }
      }

      await updateMyAvailability({ slots });
      setSuccess('Schedule saved successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save schedule');
    } finally {
      setSaving(false);
    }
  };

  const handleAddTimeOff = async () => {
    if (!newTimeOff.start_date || !newTimeOff.end_date) {
      setError('Please select start and end dates');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const created = await addTimeOff(newTimeOff);
      setTimeOffs((prev) => [...prev, created].sort((a, b) =>
        a.start_date.localeCompare(b.start_date)
      ));
      setShowTimeOffModal(false);
      setNewTimeOff({
        start_date: '',
        end_date: '',
        reason: '',
        all_day: true,
      });
      setSuccess('Time off added successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add time off');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTimeOff = async (id: string) => {
    if (!confirm('Are you sure you want to delete this time off?')) return;

    try {
      await deleteTimeOff(id);
      setTimeOffs((prev) => prev.filter((t) => t.id !== id));
      setSuccess('Time off deleted successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete time off');
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Access denied for non-artists
  if (!canEdit) {
    return (
      <div className="p-8">
        <div className="bg-ink-800 rounded-lg border border-ink-700 p-8 text-center">
          <h2 className="text-xl font-semibold text-ink-100 mb-2">Access Denied</h2>
          <p className="text-ink-400">
            Only artists and owners can manage availability.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-ink-700 rounded w-48"></div>
          <div className="h-64 bg-ink-700 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-ink-100 mb-2">Availability</h1>
        <p className="text-ink-400">
          Set your weekly working hours and manage time off.
        </p>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-6 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-6 bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-lg">
          {success}
        </div>
      )}

      {/* Weekly Schedule */}
      <div className="bg-ink-800 rounded-lg border border-ink-700 p-6 mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-ink-100">Weekly Schedule</h2>
          <button
            onClick={handleSaveSchedule}
            disabled={saving}
            className="px-4 py-2 bg-accent-500 text-white rounded-lg hover:bg-accent-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Saving...' : 'Save Schedule'}
          </button>
        </div>

        <div className="space-y-4">
          {DAYS.map((dayName, dayIndex) => {
            const daySchedule = schedule[dayIndex];
            return (
              <div
                key={dayIndex}
                className={`flex items-center gap-4 p-4 rounded-lg border transition-colors ${
                  daySchedule.enabled
                    ? 'bg-ink-700/50 border-ink-600'
                    : 'bg-ink-800 border-ink-700'
                }`}
              >
                {/* Day toggle */}
                <button
                  onClick={() => handleDayToggle(dayIndex)}
                  className={`w-32 text-left font-medium transition-colors ${
                    daySchedule.enabled ? 'text-ink-100' : 'text-ink-500'
                  }`}
                >
                  {dayName}
                </button>

                {/* Toggle switch */}
                <button
                  onClick={() => handleDayToggle(dayIndex)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    daySchedule.enabled ? 'bg-accent-500' : 'bg-ink-600'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      daySchedule.enabled ? 'left-7' : 'left-1'
                    }`}
                  />
                </button>

                {/* Time selects */}
                {daySchedule.enabled ? (
                  <div className="flex items-center gap-2 flex-1">
                    <select
                      value={daySchedule.start}
                      onChange={(e) => handleTimeChange(dayIndex, 'start', e.target.value)}
                      className="bg-ink-700 border border-ink-600 rounded-lg px-3 py-2 text-ink-100 focus:outline-none focus:ring-2 focus:ring-accent-500"
                    >
                      {TIME_OPTIONS.map((time) => (
                        <option key={time} value={time}>
                          {time}
                        </option>
                      ))}
                    </select>
                    <span className="text-ink-400">to</span>
                    <select
                      value={daySchedule.end}
                      onChange={(e) => handleTimeChange(dayIndex, 'end', e.target.value)}
                      className="bg-ink-700 border border-ink-600 rounded-lg px-3 py-2 text-ink-100 focus:outline-none focus:ring-2 focus:ring-accent-500"
                    >
                      {TIME_OPTIONS.map((time) => (
                        <option key={time} value={time}>
                          {time}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <span className="text-ink-500 flex-1">Closed</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Time Off */}
      <div className="bg-ink-800 rounded-lg border border-ink-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-ink-100">Time Off</h2>
          <button
            onClick={() => setShowTimeOffModal(true)}
            className="px-4 py-2 bg-ink-700 text-ink-100 rounded-lg hover:bg-ink-600 transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Time Off
          </button>
        </div>

        {timeOffs.length === 0 ? (
          <div className="text-center py-8">
            <svg
              className="w-12 h-12 mx-auto text-ink-600 mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <p className="text-ink-400">No upcoming time off scheduled.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {timeOffs.map((timeOff) => (
              <div
                key={timeOff.id}
                className="flex items-center justify-between p-4 bg-ink-700/50 rounded-lg border border-ink-600"
              >
                <div>
                  <div className="font-medium text-ink-100">
                    {formatDate(timeOff.start_date)}
                    {timeOff.start_date !== timeOff.end_date && (
                      <span> - {formatDate(timeOff.end_date)}</span>
                    )}
                  </div>
                  {timeOff.reason && (
                    <div className="text-sm text-ink-400 mt-1">{timeOff.reason}</div>
                  )}
                </div>
                <button
                  onClick={() => handleDeleteTimeOff(timeOff.id)}
                  className="p-2 text-ink-400 hover:text-red-400 transition-colors"
                  title="Delete time off"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Time Off Modal */}
      {showTimeOffModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-ink-800 rounded-lg border border-ink-700 p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-ink-100 mb-4">Add Time Off</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink-300 mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  value={newTimeOff.start_date}
                  onChange={(e) =>
                    setNewTimeOff((prev) => ({ ...prev, start_date: e.target.value }))
                  }
                  className="w-full bg-ink-700 border border-ink-600 rounded-lg px-3 py-2 text-ink-100 focus:outline-none focus:ring-2 focus:ring-accent-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-300 mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  value={newTimeOff.end_date}
                  onChange={(e) =>
                    setNewTimeOff((prev) => ({ ...prev, end_date: e.target.value }))
                  }
                  min={newTimeOff.start_date}
                  className="w-full bg-ink-700 border border-ink-600 rounded-lg px-3 py-2 text-ink-100 focus:outline-none focus:ring-2 focus:ring-accent-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-300 mb-2">
                  Reason (optional)
                </label>
                <input
                  type="text"
                  value={newTimeOff.reason || ''}
                  onChange={(e) =>
                    setNewTimeOff((prev) => ({ ...prev, reason: e.target.value }))
                  }
                  placeholder="e.g., Vacation, Personal day"
                  className="w-full bg-ink-700 border border-ink-600 rounded-lg px-3 py-2 text-ink-100 placeholder-ink-500 focus:outline-none focus:ring-2 focus:ring-accent-500"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowTimeOffModal(false)}
                className="flex-1 px-4 py-2 bg-ink-700 text-ink-100 rounded-lg hover:bg-ink-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddTimeOff}
                disabled={saving || !newTimeOff.start_date || !newTimeOff.end_date}
                className="flex-1 px-4 py-2 bg-accent-500 text-white rounded-lg hover:bg-accent-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? 'Adding...' : 'Add Time Off'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
