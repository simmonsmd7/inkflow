import { useApiHealth } from './hooks/useApiHealth';

function App() {
  const { health, isLoading, error, refetch } = useApiHealth();

  return (
    <div className="min-h-screen bg-ink-900 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-ink-100 mb-4">InkFlow</h1>
        <p className="text-ink-300 text-lg mb-8">
          Tattoo Studio Management Platform
        </p>

        {/* API Connection Status */}
        <div className="mb-8 p-4 rounded-lg bg-ink-800 border border-ink-700">
          <div className="flex items-center justify-center gap-2 mb-2">
            {isLoading ? (
              <>
                <div className="w-3 h-3 rounded-full bg-yellow-500 animate-pulse" />
                <span className="text-ink-300">Connecting to API...</span>
              </>
            ) : error ? (
              <>
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-red-400">API Disconnected</span>
              </>
            ) : health ? (
              <>
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-green-400">API Connected</span>
              </>
            ) : null}
          </div>

          {health && (
            <div className="text-xs text-ink-400 space-y-1">
              <p>
                {health.app} v{health.version}
              </p>
              <p>Environment: {health.environment}</p>
            </div>
          )}

          {error && (
            <div className="mt-2">
              <p className="text-xs text-red-400 mb-2">{error}</p>
              <button
                onClick={refetch}
                className="text-xs px-3 py-1 bg-ink-700 text-ink-200 rounded hover:bg-ink-600 transition-colors"
              >
                Retry Connection
              </button>
            </div>
          )}
        </div>

        <div className="flex gap-4 justify-center">
          <button className="px-6 py-3 bg-accent-primary text-white rounded-lg font-medium hover:bg-accent-primary/80 transition-colors">
            Get Started
          </button>
          <button className="px-6 py-3 bg-ink-700 text-ink-100 rounded-lg font-medium hover:bg-ink-600 transition-colors">
            Learn More
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
