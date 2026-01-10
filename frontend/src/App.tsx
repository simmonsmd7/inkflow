function App() {
  return (
    <div className="min-h-screen bg-ink-900 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-ink-100 mb-4">
          InkFlow
        </h1>
        <p className="text-ink-300 text-lg mb-8">
          Tattoo Studio Management Platform
        </p>
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
  )
}

export default App
