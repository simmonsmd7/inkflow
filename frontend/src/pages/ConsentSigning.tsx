/**
 * Public consent form signing page for clients.
 * Accessible at /sign/:studioSlug/:templateId
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { SignaturePad } from '../components/SignaturePad';
import { getTemplateForSigning, submitSignedConsent, uploadPhotoIdWithToken } from '../services/consent';
import type { ConsentFormTemplate, FormField, SubmitSigningInput } from '../types/api';

export function ConsentSigning() {
  const { studioSlug, templateId } = useParams<{ studioSlug: string; templateId: string }>();

  const [template, setTemplate] = useState<ConsentFormTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // Photo ID upload state
  const [showPhotoUpload, setShowPhotoUpload] = useState(false);
  const [photoIdFile, setPhotoIdFile] = useState<File | null>(null);
  const [photoIdPreview, setPhotoIdPreview] = useState<string | null>(null);
  const [uploadingPhotoId, setUploadingPhotoId] = useState(false);
  const [photoIdUploaded, setPhotoIdUploaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form data
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [responses, setResponses] = useState<Record<string, unknown>>({});
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Load template
  useEffect(() => {
    async function loadTemplate() {
      if (!studioSlug || !templateId) {
        setError('Invalid consent form link');
        setLoading(false);
        return;
      }

      try {
        const data = await getTemplateForSigning(studioSlug, templateId);
        setTemplate(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load consent form');
      } finally {
        setLoading(false);
      }
    }

    loadTemplate();
  }, [studioSlug, templateId]);

  // Handle field value changes
  const handleFieldChange = useCallback((fieldId: string, value: unknown) => {
    setResponses((prev) => ({ ...prev, [fieldId]: value }));
    // Clear error when field is modified
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
    if (!clientEmail.trim()) {
      errors['clientEmail'] = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) {
      errors['clientEmail'] = 'Please enter a valid email address';
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
          } else if (field.type === 'photo_id') {
            // Photo ID is handled separately after submission
          } else if (!value || (typeof value === 'string' && !value.trim())) {
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
  }, [template, clientName, clientEmail, dateOfBirth, responses, signatureData]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm() || !studioSlug || !templateId || !template) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const input: SubmitSigningInput = {
        template_id: templateId,
        client_name: clientName,
        client_email: clientEmail,
        client_phone: clientPhone || undefined,
        client_date_of_birth: dateOfBirth || undefined,
        responses,
        signature_data: signatureData || '',
      };

      const result = await submitSignedConsent(studioSlug, input);
      setAccessToken(result.access_token);

      // If template requires photo ID, show the photo upload step
      if (template.requires_photo_id) {
        setShowPhotoUpload(true);
      } else {
        setSubmitted(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit consent form');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle file selection for photo ID
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        setError('Please select a valid image file (JPEG, PNG, GIF, or WebP)');
        return;
      }

      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        setError('File is too large. Maximum size is 5MB');
        return;
      }

      setPhotoIdFile(file);
      setError(null);

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setPhotoIdPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle photo ID upload
  const handlePhotoIdUpload = async () => {
    if (!photoIdFile || !accessToken) return;

    setUploadingPhotoId(true);
    setError(null);

    try {
      await uploadPhotoIdWithToken(accessToken, photoIdFile);
      setPhotoIdUploaded(true);
      setSubmitted(true);
      setShowPhotoUpload(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload photo ID');
    } finally {
      setUploadingPhotoId(false);
    }
  };

  // Skip photo ID upload
  const handleSkipPhotoId = () => {
    setSubmitted(true);
    setShowPhotoUpload(false);
  };

  // Render a single form field
  const renderField = (field: FormField) => {
    const fieldError = formErrors[field.id];
    const baseInputClass = `w-full px-3 py-2 bg-white border rounded-lg focus:ring-2 focus:ring-accent-primary focus:border-accent-primary text-ink-900 ${
      fieldError ? 'border-red-500' : 'border-ink-300'
    }`;

    switch (field.type) {
      case 'heading':
        return (
          <h3 key={field.id} className="text-xl font-semibold text-ink-900 mt-6 mb-2">
            {field.content || field.label}
          </h3>
        );

      case 'paragraph':
        return (
          <p key={field.id} className="text-ink-600 mb-4 whitespace-pre-wrap">
            {field.content}
          </p>
        );

      case 'text':
        return (
          <div key={field.id} className="mb-4">
            <label className="block text-sm font-medium text-ink-700 mb-1">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              type="text"
              value={(responses[field.id] as string) || ''}
              onChange={(e) => handleFieldChange(field.id, e.target.value)}
              placeholder={field.placeholder || ''}
              className={baseInputClass}
            />
            {field.help_text && (
              <p className="text-xs text-ink-500 mt-1">{field.help_text}</p>
            )}
            {fieldError && <p className="text-xs text-red-500 mt-1">{fieldError}</p>}
          </div>
        );

      case 'textarea':
        return (
          <div key={field.id} className="mb-4">
            <label className="block text-sm font-medium text-ink-700 mb-1">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <textarea
              value={(responses[field.id] as string) || ''}
              onChange={(e) => handleFieldChange(field.id, e.target.value)}
              placeholder={field.placeholder || ''}
              rows={4}
              className={baseInputClass}
            />
            {field.help_text && (
              <p className="text-xs text-ink-500 mt-1">{field.help_text}</p>
            )}
            {fieldError && <p className="text-xs text-red-500 mt-1">{fieldError}</p>}
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
                className="w-5 h-5 mt-0.5 rounded border-ink-300 text-accent-primary focus:ring-accent-primary"
              />
              <span className="text-sm text-ink-700">
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </span>
            </label>
            {field.help_text && (
              <p className="text-xs text-ink-500 mt-1 ml-8">{field.help_text}</p>
            )}
            {fieldError && <p className="text-xs text-red-500 mt-1 ml-8">{fieldError}</p>}
          </div>
        );

      case 'date':
        return (
          <div key={field.id} className="mb-4">
            <label className="block text-sm font-medium text-ink-700 mb-1">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              type="date"
              value={(responses[field.id] as string) || ''}
              onChange={(e) => handleFieldChange(field.id, e.target.value)}
              className={baseInputClass}
            />
            {field.help_text && (
              <p className="text-xs text-ink-500 mt-1">{field.help_text}</p>
            )}
            {fieldError && <p className="text-xs text-red-500 mt-1">{fieldError}</p>}
          </div>
        );

      case 'select':
        return (
          <div key={field.id} className="mb-4">
            <label className="block text-sm font-medium text-ink-700 mb-1">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
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
              <p className="text-xs text-ink-500 mt-1">{field.help_text}</p>
            )}
            {fieldError && <p className="text-xs text-red-500 mt-1">{fieldError}</p>}
          </div>
        );

      case 'radio':
        return (
          <div key={field.id} className="mb-4">
            <label className="block text-sm font-medium text-ink-700 mb-2">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
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
                    className="w-4 h-4 border-ink-300 text-accent-primary focus:ring-accent-primary"
                  />
                  <span className="text-sm text-ink-700">{option}</span>
                </label>
              ))}
            </div>
            {field.help_text && (
              <p className="text-xs text-ink-500 mt-1">{field.help_text}</p>
            )}
            {fieldError && <p className="text-xs text-red-500 mt-1">{fieldError}</p>}
          </div>
        );

      case 'signature':
        return (
          <div key={field.id} className="mb-4">
            <label className="block text-sm font-medium text-ink-700 mb-2">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
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
              <p className="text-xs text-ink-500 mt-1">{field.help_text}</p>
            )}
            {fieldError && <p className="text-xs text-red-500 mt-1">{fieldError}</p>}
          </div>
        );

      case 'photo_id':
        return (
          <div key={field.id} className="mb-4">
            <label className="block text-sm font-medium text-ink-700 mb-2">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <p className="text-sm text-ink-500 mb-2">
              Photo ID will be requested after you submit the form.
            </p>
            {field.help_text && (
              <p className="text-xs text-ink-500 mt-1">{field.help_text}</p>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-ink-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent-primary"></div>
      </div>
    );
  }

  // Error state
  if (error && !template) {
    return (
      <div className="min-h-screen bg-ink-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-ink-900 mb-2">Consent Form Not Found</h2>
          <p className="text-ink-600 mb-6">{error}</p>
          <p className="text-sm text-ink-500">
            Please contact the studio for a valid consent form link.
          </p>
        </div>
      </div>
    );
  }

  // Photo ID upload state
  if (showPhotoUpload && !submitted) {
    return (
      <div className="min-h-screen bg-ink-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-ink-900 mb-2">Upload Photo ID</h2>
            <p className="text-ink-600">
              Please upload a clear photo of your government-issued photo ID for verification.
            </p>
          </div>

          {/* File upload area */}
          <div className="mb-6">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
              className="hidden"
            />

            {photoIdPreview ? (
              <div className="relative">
                <img
                  src={photoIdPreview}
                  alt="Photo ID preview"
                  className="w-full rounded-lg border border-ink-200"
                />
                <button
                  onClick={() => {
                    setPhotoIdFile(null);
                    setPhotoIdPreview(null);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                    }
                  }}
                  className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-12 border-2 border-dashed border-ink-300 rounded-lg hover:border-accent-primary hover:bg-ink-50 transition-colors"
              >
                <div className="text-center">
                  <svg className="w-12 h-12 text-ink-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-ink-600 font-medium">Click to upload photo</p>
                  <p className="text-ink-500 text-sm mt-1">JPEG, PNG, GIF, or WebP (max 5MB)</p>
                </div>
              </button>
            )}
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={handlePhotoIdUpload}
              disabled={!photoIdFile || uploadingPhotoId}
              className="w-full py-3 px-4 bg-accent-primary text-white font-semibold rounded-lg hover:bg-accent-primary/80 focus:ring-4 focus:ring-accent-primary/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {uploadingPhotoId ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Uploading...
                </span>
              ) : (
                'Upload Photo ID'
              )}
            </button>
            <button
              onClick={handleSkipPhotoId}
              disabled={uploadingPhotoId}
              className="w-full py-2 text-ink-500 hover:text-ink-700 text-sm transition-colors"
            >
              Skip for now
            </button>
          </div>

          <p className="text-xs text-ink-500 text-center mt-4">
            Your photo ID is securely stored and only used for age and identity verification.
          </p>
        </div>
      </div>
    );
  }

  // Success state
  if (submitted) {
    return (
      <div className="min-h-screen bg-ink-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-ink-900 mb-2">Consent Form Submitted</h2>
          <p className="text-ink-600 mb-6">
            Thank you for completing the consent form.{photoIdUploaded && ' Your photo ID has been uploaded.'} Your submission has been received.
          </p>
          <p className="text-sm text-ink-500 mb-4">
            You can view your submitted form using this link:
          </p>
          <div className="bg-ink-100 rounded-lg p-3 text-xs font-mono text-ink-700 break-all mb-4">
            {window.location.origin}/consent/view/{accessToken}
          </div>
          <p className="text-sm text-ink-500">
            Please save this link for your records.
          </p>
        </div>
      </div>
    );
  }

  // Form
  return (
    <div className="min-h-screen bg-ink-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h1 className="text-2xl font-bold text-ink-900 mb-2">{template?.name}</h1>
          {template?.description && (
            <p className="text-ink-600">{template.description}</p>
          )}
          {template?.header_text && (
            <div className="mt-4 p-4 bg-ink-50 rounded-lg text-sm text-ink-700 whitespace-pre-wrap">
              {template.header_text}
            </div>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {/* Client Information */}
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <h2 className="text-lg font-semibold text-ink-900 mb-4">Your Information</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => {
                    setClientName(e.target.value);
                    setFormErrors((prev) => ({ ...prev, clientName: '' }));
                  }}
                  className={`w-full px-3 py-2 bg-white border rounded-lg focus:ring-2 focus:ring-accent-primary focus:border-accent-primary text-ink-900 ${
                    formErrors.clientName ? 'border-red-500' : 'border-ink-300'
                  }`}
                  placeholder="Enter your full legal name"
                />
                {formErrors.clientName && (
                  <p className="text-xs text-red-500 mt-1">{formErrors.clientName}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={clientEmail}
                  onChange={(e) => {
                    setClientEmail(e.target.value);
                    setFormErrors((prev) => ({ ...prev, clientEmail: '' }));
                  }}
                  className={`w-full px-3 py-2 bg-white border rounded-lg focus:ring-2 focus:ring-accent-primary focus:border-accent-primary text-ink-900 ${
                    formErrors.clientEmail ? 'border-red-500' : 'border-ink-300'
                  }`}
                  placeholder="your.email@example.com"
                />
                {formErrors.clientEmail && (
                  <p className="text-xs text-red-500 mt-1">{formErrors.clientEmail}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-ink-300 rounded-lg focus:ring-2 focus:ring-accent-primary focus:border-accent-primary text-ink-900"
                  placeholder="(555) 555-5555"
                />
              </div>

              {template?.age_requirement && template.age_requirement > 0 && (
                <div>
                  <label className="block text-sm font-medium text-ink-700 mb-1">
                    Date of Birth <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => {
                      setDateOfBirth(e.target.value);
                      setFormErrors((prev) => ({ ...prev, dateOfBirth: '' }));
                    }}
                    className={`w-full px-3 py-2 bg-white border rounded-lg focus:ring-2 focus:ring-accent-primary focus:border-accent-primary text-ink-900 ${
                      formErrors.dateOfBirth ? 'border-red-500' : 'border-ink-300'
                    }`}
                  />
                  <p className="text-xs text-ink-500 mt-1">
                    You must be at least {template.age_requirement} years old.
                  </p>
                  {formErrors.dateOfBirth && (
                    <p className="text-xs text-red-500 mt-1">{formErrors.dateOfBirth}</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Form Fields */}
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            {template?.fields
              .sort((a, b) => a.order - b.order)
              .map((field) => renderField(field))}
          </div>

          {/* Footer Text */}
          {template?.footer_text && (
            <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
              <div className="p-4 bg-ink-50 rounded-lg text-sm text-ink-700 whitespace-pre-wrap">
                {template.footer_text}
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Submit Button */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 px-4 bg-accent-primary text-white font-semibold rounded-lg hover:bg-accent-primary/80 focus:ring-4 focus:ring-accent-primary/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Submitting...
                </span>
              ) : (
                'Submit Consent Form'
              )}
            </button>
            <p className="text-xs text-ink-500 text-center mt-3">
              By submitting this form, you agree to the terms and conditions outlined above.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ConsentSigning;
