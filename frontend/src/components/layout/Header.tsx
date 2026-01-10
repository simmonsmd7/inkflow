import { useApiHealth } from '../../hooks/useApiHealth';

interface HeaderProps {
  sidebarCollapsed: boolean;
}

export function Header({ sidebarCollapsed }: HeaderProps) {
  const { health, isLoading, error } = useApiHealth();

  return (
    <header
      className={`fixed top-0 right-0 h-16 bg-ink-800 border-b border-ink-700 flex items-center justify-between px-6 z-30 transition-all duration-300 ${
        sidebarCollapsed ? 'left-16' : 'left-64'
      }`}
    >
      {/* Search Bar */}
      <div className="flex-1 max-w-xl">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search clients, bookings, messages..."
            className="w-full pl-10 pr-4 py-2 bg-ink-700 border border-ink-600 rounded-lg text-ink-100 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-transparent transition-all"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-ink-500 text-xs">
            <kbd className="px-1.5 py-0.5 bg-ink-600 rounded text-ink-300">⌘</kbd>
            <kbd className="px-1.5 py-0.5 bg-ink-600 rounded text-ink-300">K</kbd>
          </div>
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-4">
        {/* API Status Indicator */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-ink-700">
          {isLoading ? (
            <>
              <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
              <span className="text-xs text-ink-400">Connecting...</span>
            </>
          ) : error ? (
            <>
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-xs text-red-400">Offline</span>
            </>
          ) : health ? (
            <>
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-xs text-green-400">Online</span>
            </>
          ) : null}
        </div>

        {/* Notifications */}
        <button className="relative p-2 rounded-lg text-ink-400 hover:text-ink-100 hover:bg-ink-700 transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
          <span className="absolute top-1 right-1 w-2 h-2 bg-accent-error rounded-full" />
        </button>

        {/* Quick Actions */}
        <button className="flex items-center gap-2 px-3 py-2 bg-accent-primary text-white rounded-lg text-sm font-medium hover:bg-accent-primary/80 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>New Booking</span>
        </button>
      </div>
    </header>
  );
}
