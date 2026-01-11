/**
 * Public landing page for InkFlow.
 */

import { Link } from 'react-router-dom';

const features = [
  {
    title: 'Booking Management',
    description: 'Accept and manage booking requests with a streamlined queue system. Track status from inquiry to completion.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    title: 'Deposit Payments',
    description: 'Collect deposits securely with Stripe integration. Automate payment requests and track payment status.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
  },
  {
    title: 'Digital Consent Forms',
    description: 'Create custom consent forms with e-signatures. Store and access signed forms securely anytime.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    title: 'Aftercare Tracking',
    description: 'Send automated aftercare instructions. Track healing progress and follow up with clients.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    ),
  },
];

const steps = [
  {
    number: '1',
    title: 'Sign Up',
    description: 'Create your free account in under a minute.',
  },
  {
    number: '2',
    title: 'Set Up Your Business',
    description: 'Add your studio name and customize your booking page.',
  },
  {
    number: '3',
    title: 'Share Your Booking Link',
    description: 'Send clients to your personalized booking form.',
  },
];

export function LandingPage() {
  return (
    <div className="min-h-screen bg-ink-900">
      {/* Navigation */}
      <nav className="border-b border-ink-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-accent-primary rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </div>
              <span className="font-bold text-lg text-ink-100">InkFlow</span>
            </div>
            <div className="flex items-center gap-4">
              <Link
                to="/login"
                className="text-ink-300 hover:text-ink-100 transition-colors text-sm font-medium"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="px-4 py-2 bg-accent-primary hover:bg-accent-primary/80 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Get Started Free
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-20 sm:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-ink-100 mb-6">
            Run your tattoo business,
            <br />
            <span className="text-accent-primary">not paperwork</span>
          </h1>
          <p className="text-xl text-ink-400 max-w-2xl mx-auto mb-10">
            The all-in-one platform for tattoo artists and studios. Manage bookings, collect deposits, handle consent forms, and track aftercare - all in one place.
          </p>
          <Link
            to="/register"
            className="inline-flex items-center gap-2 px-8 py-4 bg-accent-primary hover:bg-accent-primary/80 text-white rounded-xl text-lg font-semibold transition-colors"
          >
            Get Started Free
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-ink-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-ink-100 mb-4">
              Everything you need to run your studio
            </h2>
            <p className="text-ink-400 max-w-2xl mx-auto">
              Focus on your art while InkFlow handles the business side.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="bg-ink-800 border border-ink-700 rounded-xl p-6 hover:border-accent-primary/50 transition-colors"
              >
                <div className="w-12 h-12 bg-accent-primary/20 rounded-lg flex items-center justify-center text-accent-primary mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold text-ink-100 mb-2">
                  {feature.title}
                </h3>
                <p className="text-ink-400 text-sm">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-ink-100 mb-4">
              How it works
            </h2>
            <p className="text-ink-400 max-w-2xl mx-auto">
              Get up and running in minutes.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((step, index) => (
              <div key={step.number} className="relative text-center">
                {/* Connector line */}
                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-1/2 w-full h-0.5 bg-ink-700" />
                )}
                <div className="relative z-10 w-16 h-16 bg-accent-primary rounded-full flex items-center justify-center text-2xl font-bold text-white mx-auto mb-4">
                  {step.number}
                </div>
                <h3 className="text-xl font-semibold text-ink-100 mb-2">
                  {step.title}
                </h3>
                <p className="text-ink-400">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer CTA Section */}
      <section className="py-20 bg-ink-800/50 border-t border-ink-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-ink-100 mb-4">
            Ready to get started?
          </h2>
          <p className="text-ink-400 max-w-2xl mx-auto mb-8">
            Join tattoo artists and studios who are streamlining their business with InkFlow.
          </p>
          <Link
            to="/register"
            className="inline-flex items-center gap-2 px-8 py-4 bg-accent-primary hover:bg-accent-primary/80 text-white rounded-xl text-lg font-semibold transition-colors"
          >
            Get Started Free
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-ink-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-accent-primary rounded flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </div>
              <span className="font-semibold text-ink-300">InkFlow</span>
            </div>
            <p className="text-ink-500 text-sm">
              &copy; {new Date().getFullYear()} InkFlow. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
