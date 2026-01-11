/**
 * Client consent forms page for viewing and signing consent forms.
 */

import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SignaturePad } from '../components/SignaturePad';
import { clientPortalService } from '../services/clientPortal';
import { clientAuthService } from '../services/clientAuth';
import type {
  ClientConsentPendingBooking,
  ClientSignedConsentSummary,
  ClientConsentTemplateResponse,
  ClientConsentFormField,
} from '../types/api';

type TabType = 'pending' | 'signed';

export function ClientConsentForms() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('pending');
  const [pendingBookings, setPendingBookings] = useState<ClientConsentPendingBooking[]>([]);
  const [signedForms, setSignedForms] = useState<ClientSignedConsentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Signing form state
  const [signingBooking, setSigningBooking] = useState<ClientConsentPendingBooking | null>(null);
  const [template, setTemplate] = useState<ClientConsentTemplateResponse | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(false);

  // Form data
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [responses, setResponses] = useState<Record<string, unknown>>({});
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // Check auth and load data
  useEffect(() => {
    if (!clientAuthService.isAuthenticated()) {
      navigate('/client/login');
      return;
    }

    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const [pendingResult, signedResult] = await Promise.all([
          clientPortalService.getPendingConsentForms(),
          clientPortalService.getSignedConsentForms(),
        ]);
        setPendingBookings(pendingResult.bookings);
        setSignedForms(signedResult.submissions);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load consent forms');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [navigate]);

  // Pre-fill client name from auth
  useEffect(() => {
    async function loadClientInfo() {
      try {
        const client = await clientAuthService.getMe();
        if (client) {
          setClientName(`${client.first_name} ${client.last_name}`);
          if (client.phone) {
            setClientPhone(client.phone);
          }
        }
      } catch {
        // Ignore error - form can still be filled manually
      }
    }
    if (clientAuthService.isAuthenticated()) {
      loadClientInfo();
    }
  }, []);

  // Start signing a consent form
  const handleStartSigning = async (booking: ClientConsentPendingBooking) => {
    if (!booking.template_id) {
      setError('No consent form template configured for this studio');
      return;
    }

    setLoadingTemplate(true);
    setError(null);
    try {
      const templateData = await clientPortalService.getConsentTemplate(booking.id);
      setTemplate(templateData);
      setSigningBooking(booking);
      setResponses({});
      setSignatureData(null);
      setFormErrors({});
      setSubmitted(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load consent form');
    } finally {
      setLoadingTemplate(false);
    }
  };

  // Handle field value changes
  const handleFieldChange = useCallback((fieldId: string, value: unknown) => {
    setResponses((prev) => ({ ...prev, [fieldId]: value }));
    setFormErrors((prev) => {
      const next = { ...prev };
      delete next[fieldId];
      return next;
    });
  }, []);

  // Validate form
  const validateForm = useCallback((): boolean => {
    const errors: Record<string, string> = {};

    if (!clientName.trim()) {
      errors['clientName'] = 'Name is required';
    }

    if (template?.age_requirement && template.age_requirement > 0) {
      if (!dateOfBirth) {
        errors['dateOfBirth'] = 'Date of birth is required for age verification';
      } else {
        const dob = new Date(dateOfBirth);
        const today = new Date();
        let age = today.getFullYear() - dob.getFullYear();
        const monthDiff = today.getMonth() - dob.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
          age--;
        }
        if (age < template.age_requirement) {
          errors['dateOfBirth'] = `You must be at least ${template.age_requirement} years old`;
        }
      }
    }

    // Validate required fields
    if (template?.fields) {
      for (const field of template.fields) {
        if (field.required && field.type !== 'heading' && field.type !== 'paragraph') {
          const value = responses[field.id];
          if (field.type === 'checkbox') {
            if (!value) {
              errors[field.id] = 'This field is required';
            }
          } else if (field.type === 'signature') {
            if (!signatureData) {
              errors[field.id] = 'Signature is required';
            }
          } else if (field.type !== 'photo_id' && (!value || (typeof value === 'string' && !value.trim()))) {
            errors[field.id] = 'This field is required';
          }
        }
      }
    }

    // Check signature if required
    if (template?.requires_signature && !signatureData) {
      errors['signature'] = 'Signature is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [template, clientName, dateOfBirth, responses, signatureData]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm() || !signingBooking || !template) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const result = await clientPortalService.signConsentForm({
        booking_id: signingBooking.id,
        template_id: template.id,
        client_name: clientName,
        client_phone: clientPhone || undefined,
        date_of_birth: dateOfBirth || undefined,
        responses,
        signature_data: signatureData || '',
      });

      setAccessToken(result.access_token);
      setSubmitted(true);

      // Refresh data
      const [pendingResult, signedResult] = await Promise.all([
        clientPortalService.getPendingConsentForms(),
        clientPortalService.getSignedConsentForms(),
      ]);
      setPendingBookings(pendingResult.bookings);
      setSignedForms(signedResult.submissions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit consent form');
    } finally {
      setSubmitting(false);
    }
  };

  // Cancel signing
  const handleCancelSigning = () => {
    setSigningBooking(null);
    setTemplate(null);
    setSubmitted(false);
    setAccessToken(null);
  };

  // Render a form field
  const renderField = (field: ClientConsentFormField) => {
    const fieldError = formErrors[field.id];
    const baseInputClass = `w-full px-3 py-2 bg-ink-700 border rounded-lg focus:ring-2 focus:ring-accent-primary focus:border-accent-primary text-white ${
      fieldError ? 'border-red-500' : 'border-ink-500'
    }`;

    switch (field.type) {
      case 'heading':
        return (
          <h3 key={field.id} className="text-lg font-semibold text-white mt-6 mb-2">
            {field.content || field.label}
          </h3>
        );

      case 'paragraph':
        return (
          <p key={field.id} className="text-ink-300 mb-4 whitespace-pre-wrap">
            {field.content}
          </p>
        );

      case 'text':
        return (
          <div key={field.id} className="mb-4">
            <label className="block text-sm font-medium text-ink-200 mb-1">
              {field.label}
              {field.required && <span className="text-red-400 ml-1">*</span>}
            </label>
            <input
              type="text"
              value={(responses[field.id] as string) || ''}
              onChange={(e) => handleFieldChange(field.id, e.target.value)}
              placeholder={field.placeholder || ''}
              className={baseInputClass}
            />
            {field.help_text && (
              <p className="text-xs text-ink-400 mt-1">{field.help_text}</p>
            )}
            {fieldError && <p className="text-xs text-red-400 mt-1">{fieldError}</p>}
          </div>
        );

      case 'textarea':
        return (
          <div key={field.id} className="mb-4">
            <label className="block text-sm font-medium text-ink-200 mb-1">
              {field.label}
              {field.required && <span className="text-red-400 ml-1">*</span>}
            </label>
            <textarea
              value={(responses[field.id] as string) || ''}
              onChange={(e) => handleFieldChange(field.id, e.target.value)}
              placeholder={field.placeholder || ''}
              rows={4}
              className={baseInputClass}
            />
            {field.help_text && (
              <p className="text-xs text-ink-400 mt-1">{field.help_text}</p>
            )}
            {fieldError && <p className="text-xs text-red-400 mt-1">{fieldError}</p>}
          </div>
        );

      case 'checkbox':
        return (
          <div key={field.id} className="mb-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(responses[field.id])}
                onChange={(e) => handleFieldChange(field.id, e.target.checked)}
                className="w-5 h-5 mt-0.5 rounded border-ink-500 text-accent-primary focus:ring-accent-primary bg-ink-700"
              />
              <span className="text-sm text-ink-200">
                {field.label}
                {field.required && <span className="text-red-400 ml-1">*</span>}
              </span>
            </label>
            {field.help_text && (
              <p className="text-xs text-ink-400 mt-1 ml-8">{field.help_text}</p>
            )}
            {fieldError && <p className="text-xs text-red-400 mt-1 ml-8">{fieldError}</p>}
          </div>
        );

      case 'date':
        return (
          <div key={field.id} className="mb-4">
            <label className="block text-sm font-medium text-ink-200 mb-1">
              {field.label}
              {field.required && <span className="text-red-400 ml-1">*</span>}
            </label>
            <input
              type="date"
              value={(responses[field.id] as string) || ''}
              onChange={(e) => handleFieldChange(field.id, e.target.value)}
              className={baseInputClass}
            />
            {field.help_text && (
              <p className="text-xs text-ink-400 mt-1">{field.help_text}</p>
            )}
            {fieldError && <p className="text-xs text-red-400 mt-1">{fieldError}</p>}
          </div>
        );

      case 'select':
        return (
          <div key={field.id} className="mb-4">
            <label className="block text-sm font-medium text-ink-200 mb-1">
              {field.label}
              {field.required && <span className="text-red-400 ml-1">*</span>}
            </label>
            <select
              value={(responses[field.id] as string) || ''}
              onChange={(e) => handleFieldChange(field.id, e.target.value)}
              className={baseInputClass}
            >
              <option value="">Select an option...</option>
              {field.options?.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            {field.help_text && (
              <p className="text-xs text-ink-400 mt-1">{field.help_text}</p>
            )}
            {fieldError && <p className="text-xs text-red-400 mt-1">{fieldError}</p>}
          </div>
        );

      case 'radio':
        return (
          <div key={field.id} className="mb-4">
            <label className="block text-sm font-medium text-ink-200 mb-2">
              {field.label}
              {field.required && <span className="text-red-400 ml-1">*</span>}
            </label>
            <div className="space-y-2">
              {field.options?.map((option) => (
                <label key={option} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name={field.id}
                    value={option}
                    checked={responses[field.id] === option}
                    onChange={(e) => handleFieldChange(field.id, e.target.value)}
                    className="w-4 h-4 border-ink-500 text-accent-primary focus:ring-accent-primary bg-ink-700"
                  />
                  <span className="text-sm text-ink-200">{option}</span>
                </label>
              ))}
            </div>
            {field.help_text && (
              <p className="text-xs text-ink-400 mt-1">{field.help_text}</p>
            )}
            {fieldError && <p className="text-xs text-red-400 mt-1">{fieldError}</p>}
          </div>
        );

      case 'signature':
        return (
          <div key={field.id} className="mb-4">
            <label className="block text-sm font-medium text-ink-200 mb-2">
              {field.label}
              {field.required && <span className="text-red-400 ml-1">*</span>}
            </label>
            <SignaturePad
              onSignatureChange={(data) => {
                setSignatureData(data);
                handleFieldChange(field.id, data);
              }}
              width={Math.min(500, window.innerWidth - 80)}
              height={200}
            />
            {field.help_text && (
              <p className="text-xs text-ink-400 mt-1">{field.help_text}</p>
            )}
            {fieldError && <p className="text-xs text-red-400 mt-1">{fieldError}</p>}
          </div>
        );

      case 'photo_id':
        return (
          <div key={field.id} className="mb-4">
            <label className="block text-sm font-medium text-ink-200 mb-2">
              {field.label}
              {field.required && <span className="text-red-400 ml-1">*</span>}
            </label>
            <p className="text-sm text-ink-400">
              Photo ID upload is not available in the client portal. Please contact the studio.
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  // Format date for display
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Not scheduled';
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // Header component (reusable)
  const Header = () => (
    <header className="bg-ink-800 border-b border-ink-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/client" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-accent-primary to-accent-secondary rounded-xl flex items-center justify-center">
              <span className="text-lg font-bold text-white">IF</span>
            </div>
            <span className="text-xl font-bold text-ink-100">InkFlow</span>
          </Link>

          <div className="flex items-center gap-4">
            <Link
              to="/client"
              className="px-4 py-2 text-sm text-ink-300 hover:text-ink-100 transition-colors"
            >
              Back to Portal
            </Link>
          </div>
        </div>
      </div>
    </header>
  );

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-ink-900">
        <Header />
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent-primary"></div>
        </div>
      </div>
    );
  }

  // Signing form success state
  if (submitted && signingBooking) {
    return (
      <div className="min-h-screen bg-ink-900">
        <Header />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="max-w-2xl mx-auto">
            <div className="bg-ink-800 rounded-xl p-8 text-center">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">Consent Form Signed</h2>
              <p className="text-ink-300 mb-6">
                Thank you for completing the consent form for your appointment.
              </p>
              {accessToken && (
                <div className="mb-6">
                  <p className="text-sm text-ink-400 mb-2">
                    You can view your signed form at:
                  </p>
                  <div className="bg-ink-700 rounded-lg p-3 text-xs font-mono text-ink-300 break-all">
                    {window.location.origin}/consent/view/{accessToken}
                  </div>
                </div>
              )}
              <button
                onClick={handleCancelSigning}
                className="px-6 py-2 bg-accent-primary text-white font-medium rounded-lg hover:bg-accent-primary/80 transition-colors"
              >
                Back to Consent Forms
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Signing form
  if (signingBooking && template) {
    return (
      <div className="min-h-screen bg-ink-900">
        <Header />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="max-w-2xl mx-auto">
            {/* Form Header */}
            <div className="flex items-center gap-4 mb-6">
              <button
                onClick={handleCancelSigning}
                className="p-2 text-ink-400 hover:text-white hover:bg-ink-700 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-xl font-bold text-white">{template.name}</h1>
                <p className="text-ink-400 text-sm">
                  For: {signingBooking.design_idea} - {signingBooking.studio_name}
                </p>
              </div>
            </div>

        {/* Template description */}
        {template.description && (
          <div className="bg-ink-800 rounded-xl p-4 mb-6">
            <p className="text-ink-300">{template.description}</p>
          </div>
        )}

        {/* Header text */}
        {template.header_text && (
          <div className="bg-ink-800 rounded-xl p-4 mb-6">
            <p className="text-ink-300 whitespace-pre-wrap">{template.header_text}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {/* Client Info */}
          <div className="bg-ink-800 rounded-xl p-6 mb-6">
            <h2 className="text-lg font-semibold text-white mb-4">Your Information</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink-200 mb-1">
                  Full Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => {
                    setClientName(e.target.value);
                    setFormErrors((prev) => ({ ...prev, clientName: '' }));
                  }}
                  className={`w-full px-3 py-2 bg-ink-700 border rounded-lg focus:ring-2 focus:ring-accent-primary focus:border-accent-primary text-white ${
                    formErrors.clientName ? 'border-red-500' : 'border-ink-500'
                  }`}
                  placeholder="Enter your full legal name"
                />
                {formErrors.clientName && (
                  <p className="text-xs text-red-400 mt-1">{formErrors.clientName}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-200 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-ink-700 border border-ink-500 rounded-lg focus:ring-2 focus:ring-accent-primary focus:border-accent-primary text-white"
                  placeholder="(555) 555-5555"
                />
              </div>

              {template.age_requirement > 0 && (
                <div>
                  <label className="block text-sm font-medium text-ink-200 mb-1">
                    Date of Birth <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => {
                      setDateOfBirth(e.target.value);
                      setFormErrors((prev) => ({ ...prev, dateOfBirth: '' }));
                    }}
                    className={`w-full px-3 py-2 bg-ink-700 border rounded-lg focus:ring-2 focus:ring-accent-primary focus:border-accent-primary text-white ${
                      formErrors.dateOfBirth ? 'border-red-500' : 'border-ink-500'
                    }`}
                  />
                  <p className="text-xs text-ink-400 mt-1">
                    You must be at least {template.age_requirement} years old.
                  </p>
                  {formErrors.dateOfBirth && (
                    <p className="text-xs text-red-400 mt-1">{formErrors.dateOfBirth}</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Form Fields */}
          <div className="bg-ink-800 rounded-xl p-6 mb-6">
            {template.fields
              .sort((a, b) => a.order - b.order)
              .map((field) => renderField(field))}
          </div>

          {/* Footer text */}
          {template.footer_text && (
            <div className="bg-ink-800 rounded-xl p-4 mb-6">
              <p className="text-ink-300 whitespace-pre-wrap">{template.footer_text}</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Submit */}
          <div className="flex gap-4">
            <button
              type="button"
              onClick={handleCancelSigning}
              disabled={submitting}
              className="flex-1 py-3 px-4 bg-ink-700 text-white font-medium rounded-lg hover:bg-ink-600 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-3 px-4 bg-accent-primary text-white font-semibold rounded-lg hover:bg-accent-primary/80 focus:ring-4 focus:ring-accent-primary/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Submitting...
                </span>
                  ) : (
                    'Sign & Submit'
                  )}
                </button>
              </div>
            </form>
          </div>
        </main>
      </div>
    );
  }

  // Main list view
  return (
    <div className="min-h-screen bg-ink-900">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Page Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white mb-2">Consent Forms</h1>
            <p className="text-ink-400">
              Sign consent forms for your upcoming appointments and view your signed forms.
            </p>
          </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-ink-800 rounded-lg p-1 mb-6">
        <button
          onClick={() => setActiveTab('pending')}
          className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
            activeTab === 'pending'
              ? 'bg-accent-primary text-white'
              : 'text-ink-400 hover:text-white hover:bg-ink-700'
          }`}
        >
          Pending ({pendingBookings.length})
        </button>
        <button
          onClick={() => setActiveTab('signed')}
          className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
            activeTab === 'signed'
              ? 'bg-accent-primary text-white'
              : 'text-ink-400 hover:text-white hover:bg-ink-700'
          }`}
        >
          Signed ({signedForms.length})
        </button>
      </div>

      {/* Loading template indicator */}
      {loadingTemplate && (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-accent-primary"></div>
        </div>
      )}

      {/* Pending Tab */}
      {activeTab === 'pending' && !loadingTemplate && (
        <div className="space-y-4">
          {pendingBookings.length === 0 ? (
            <div className="bg-ink-800 rounded-xl p-8 text-center">
              <div className="w-16 h-16 bg-ink-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-ink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-white mb-2">All Caught Up!</h3>
              <p className="text-ink-400">
                You have no pending consent forms to sign.
              </p>
            </div>
          ) : (
            pendingBookings.map((booking) => (
              <div
                key={booking.id}
                className="bg-ink-800 rounded-xl p-6 border border-ink-700 hover:border-ink-600 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs font-medium rounded">
                        Needs Signature
                      </span>
                    </div>
                    <h3 className="text-lg font-medium text-white mb-1">
                      {booking.design_idea}
                    </h3>
                    <p className="text-ink-400 text-sm mb-2">
                      {booking.studio_name}
                      {booking.artist_name && ` - ${booking.artist_name}`}
                    </p>
                    <div className="flex flex-wrap gap-4 text-sm text-ink-400">
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {formatDate(booking.scheduled_date)}
                      </span>
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {booking.placement}
                      </span>
                    </div>
                    {booking.template_name && (
                      <p className="text-xs text-ink-500 mt-2">
                        Form: {booking.template_name}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleStartSigning(booking)}
                    disabled={!booking.template_id}
                    className="px-4 py-2 bg-accent-primary text-white font-medium rounded-lg hover:bg-accent-primary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    Sign Now
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Signed Tab */}
      {activeTab === 'signed' && !loadingTemplate && (
        <div className="space-y-4">
          {signedForms.length === 0 ? (
            <div className="bg-ink-800 rounded-xl p-8 text-center">
              <div className="w-16 h-16 bg-ink-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-ink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-white mb-2">No Signed Forms</h3>
              <p className="text-ink-400">
                You haven't signed any consent forms yet.
              </p>
            </div>
          ) : (
            signedForms.map((form) => (
              <div
                key={form.id}
                className="bg-ink-800 rounded-xl p-6 border border-ink-700"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs font-medium rounded">
                        Signed
                      </span>
                      {form.has_signature && (
                        <span className="px-2 py-0.5 bg-ink-700 text-ink-400 text-xs font-medium rounded">
                          Has Signature
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-medium text-white mb-1">
                      {form.template_name}
                    </h3>
                    <p className="text-ink-400 text-sm mb-2">
                      {form.studio_name}
                    </p>
                    {form.booking_design_idea && (
                      <p className="text-sm text-ink-300 mb-2">
                        For: {form.booking_design_idea}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-4 text-sm text-ink-400">
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Signed: {formatDate(form.submitted_at)}
                      </span>
                      {form.booking_scheduled_date && (
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          Appointment: {formatDate(form.booking_scheduled_date)}
                        </span>
                      )}
                    </div>
                  </div>
                  <a
                    href={`/consent/view/${form.access_token}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-ink-700 text-ink-200 font-medium rounded-lg hover:bg-ink-600 hover:text-white transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                      View
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
        </div>
      </main>
    </div>
  );
}

export default ClientConsentForms;
