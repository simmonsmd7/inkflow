import { Layout } from './components/layout';

function App() {
  return (
    <Layout>
      <Dashboard />
    </Layout>
  );
}

function Dashboard() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-100">Dashboard</h1>
          <p className="text-ink-400 mt-1">Welcome back! Here's what's happening at your studio.</p>
        </div>
        <div className="text-sm text-ink-400">
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Today's Bookings"
          value="8"
          subtitle="2 pending confirmation"
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }
          trend={{ value: '+12%', positive: true }}
        />
        <StatCard
          title="Unread Messages"
          value="23"
          subtitle="5 require response"
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          }
          trend={{ value: '-8%', positive: false }}
        />
        <StatCard
          title="This Week's Revenue"
          value="$4,230"
          subtitle="$2,890 in deposits"
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          trend={{ value: '+23%', positive: true }}
        />
        <StatCard
          title="Pending Consent"
          value="3"
          subtitle="Forms awaiting signature"
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming Appointments */}
        <div className="lg:col-span-2 bg-ink-800 rounded-xl border border-ink-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-ink-100">Today's Schedule</h2>
            <button className="text-sm text-accent-primary hover:text-accent-primary/80 transition-colors">
              View All
            </button>
          </div>
          <div className="space-y-3">
            <AppointmentRow
              time="10:00 AM"
              client="Sarah Mitchell"
              type="Sleeve Session (4hr)"
              artist="John Doe"
              status="confirmed"
            />
            <AppointmentRow
              time="2:00 PM"
              client="Mike Johnson"
              type="Back Piece Consult"
              artist="Jane Smith"
              status="pending"
            />
            <AppointmentRow
              time="4:30 PM"
              client="Emma Wilson"
              type="Touch-up"
              artist="John Doe"
              status="confirmed"
            />
            <AppointmentRow
              time="6:00 PM"
              client="Alex Brown"
              type="New Client Consult"
              artist="Jane Smith"
              status="confirmed"
            />
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-ink-800 rounded-xl border border-ink-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-ink-100">Recent Activity</h2>
          </div>
          <div className="space-y-4">
            <ActivityItem
              type="booking"
              message="New booking request from David Lee"
              time="5 min ago"
            />
            <ActivityItem
              type="payment"
              message="Deposit received: $150 from Sarah M."
              time="1 hour ago"
            />
            <ActivityItem
              type="message"
              message="New message in conversation with Mike J."
              time="2 hours ago"
            />
            <ActivityItem
              type="consent"
              message="Consent form signed by Emma Wilson"
              time="3 hours ago"
            />
            <ActivityItem
              type="booking"
              message="Appointment confirmed: Alex Brown"
              time="4 hours ago"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  trend?: { value: string; positive: boolean };
}

function StatCard({ title, value, subtitle, icon, trend }: StatCardProps) {
  return (
    <div className="bg-ink-800 rounded-xl border border-ink-700 p-5">
      <div className="flex items-start justify-between">
        <div className="p-2 bg-ink-700 rounded-lg text-accent-primary">{icon}</div>
        {trend && (
          <span
            className={`text-xs font-medium px-2 py-1 rounded-full ${
              trend.positive
                ? 'bg-green-500/10 text-green-400'
                : 'bg-red-500/10 text-red-400'
            }`}
          >
            {trend.value}
          </span>
        )}
      </div>
      <div className="mt-4">
        <p className="text-2xl font-bold text-ink-100">{value}</p>
        <p className="text-sm text-ink-400 mt-1">{title}</p>
        <p className="text-xs text-ink-500 mt-0.5">{subtitle}</p>
      </div>
    </div>
  );
}

interface AppointmentRowProps {
  time: string;
  client: string;
  type: string;
  artist: string;
  status: 'confirmed' | 'pending' | 'cancelled';
}

function AppointmentRow({ time, client, type, artist, status }: AppointmentRowProps) {
  const statusStyles = {
    confirmed: 'bg-green-500/10 text-green-400',
    pending: 'bg-yellow-500/10 text-yellow-400',
    cancelled: 'bg-red-500/10 text-red-400',
  };

  return (
    <div className="flex items-center gap-4 p-3 bg-ink-700/50 rounded-lg hover:bg-ink-700 transition-colors">
      <div className="text-sm font-medium text-ink-300 w-20">{time}</div>
      <div className="flex-1">
        <p className="text-sm font-medium text-ink-100">{client}</p>
        <p className="text-xs text-ink-400">{type}</p>
      </div>
      <div className="text-sm text-ink-400">{artist}</div>
      <span className={`text-xs font-medium px-2 py-1 rounded-full capitalize ${statusStyles[status]}`}>
        {status}
      </span>
    </div>
  );
}

interface ActivityItemProps {
  type: 'booking' | 'payment' | 'message' | 'consent';
  message: string;
  time: string;
}

function ActivityItem({ type, message, time }: ActivityItemProps) {
  const icons = {
    booking: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    payment: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    message: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
    consent: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  };

  const colors = {
    booking: 'bg-accent-primary/10 text-accent-primary',
    payment: 'bg-green-500/10 text-green-400',
    message: 'bg-accent-secondary/10 text-accent-secondary',
    consent: 'bg-yellow-500/10 text-yellow-400',
  };

  return (
    <div className="flex items-start gap-3">
      <div className={`p-2 rounded-lg ${colors[type]}`}>{icons[type]}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-ink-200 truncate">{message}</p>
        <p className="text-xs text-ink-500 mt-0.5">{time}</p>
      </div>
    </div>
  );
}

export default App;
