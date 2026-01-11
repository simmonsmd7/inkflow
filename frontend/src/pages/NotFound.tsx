import { useNavigate } from 'react-router-dom';

export function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="text-8xl font-bold text-ink-600 mb-4">404</div>
      <h1 className="text-2xl font-semibold text-ink-100 mb-2">Page Not Found</h1>
      <p className="text-ink-400 mb-8 max-w-md">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <div className="flex gap-4">
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 bg-ink-700 text-ink-100 rounded-lg hover:bg-ink-600 transition-colors"
        >
          Go Back
        </button>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 bg-accent-primary text-white rounded-lg hover:bg-accent-primary/80 transition-colors"
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  );
}
