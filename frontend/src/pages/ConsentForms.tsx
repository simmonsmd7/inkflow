import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import {
  listTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  listPrebuiltTemplates,
  createFromPrebuilt,
  listSubmissions,
  getSubmission,
  verifyPhotoId,
  voidSubmission,
  generateFieldId,
  getFieldTypeLabel,
  getSubmissionAuditLog,
  getDecryptedSignature,
  getDecryptedPhotoId,
  getAgeVerificationStatus,
  verifyAge,
  addGuardianConsent,
} from '../services/consent';
import type {
  ConsentFormTemplateSummary,
  ConsentFormTemplateCreate,
  ConsentFormTemplateUpdate,
  FormFieldCreate,
  ConsentFieldType,
  PrebuiltTemplateInfo,
  ConsentSubmissionSummary,
  ConsentSubmission,
  ConsentAuditLog,
  AgeVerificationStatus,
  GuardianConsentInput,
} from '../types/api';

type TabType = 'templates' | 'submissions';

const FIELD_TYPES: { value: ConsentFieldType; label: string }[] = [
  { value: 'heading', label: 'Heading' },
  { value: 'paragraph', label: 'Paragraph' },
  { value: 'text', label: 'Text Input' },
  { value: 'textarea', label: 'Text Area' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'radio', label: 'Radio Buttons' },
  { value: 'select', label: 'Dropdown' },
  { value: 'date', label: 'Date Picker' },
  { value: 'signature', label: 'Signature' },
  { value: 'photo_id', label: 'Photo ID Upload' },
];

export function ConsentForms() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('templates');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Templates state
  const [templates, setTemplates] = useState<ConsentFormTemplateSummary[]>([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showPrebuiltModal, setShowPrebuiltModal] = useState(false);
  const [prebuiltTemplates, setPrebuiltTemplates] = useState<PrebuiltTemplateInfo[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<ConsentFormTemplateCreate | null>(null);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);

  // Submissions state
  const [submissions, setSubmissions] = useState<ConsentSubmissionSummary[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<ConsentSubmission | null>(null);
  const [showSubmissionModal, setShowSubmissionModal] = useState(false);
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [searchEmail, setSearchEmail] = useState('');

  // Audit log state
  const [auditLogs, setAuditLogs] = useState<ConsentAuditLog[]>([]);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [loadingAuditLog, setLoadingAuditLog] = useState(false);

  // Decrypted data state
  const [decryptedSignature, setDecryptedSignature] = useState<string | null>(null);
  const [decryptedPhotoId, setDecryptedPhotoId] = useState<string | null>(null);
  const [loadingDecryption, setLoadingDecryption] = useState(false);

  // Age verification state
  const [ageStatus, setAgeStatus] = useState<AgeVerificationStatus | null>(null);
  const [showAgeVerifyModal, setShowAgeVerifyModal] = useState(false);
  const [showGuardianModal, setShowGuardianModal] = useState(false);
  const [ageVerifyNotes, setAgeVerifyNotes] = useState('');
  const [guardianData, setGuardianData] = useState<Omit<GuardianConsentInput, 'guardian_signature_data'>>({
    guardian_name: '',
    guardian_relationship: '',
    guardian_phone: '',
    guardian_email: '',
    notes: '',
  });
  const [guardianSignature, setGuardianSignature] = useState('');

  const isOwner = user?.role === 'owner';

  // Load templates
  const loadTemplates = async () => {
    try {
      setLoading(true);
      const response = await listTemplates({ page: 1, page_size: 50, active_only: false });
      setTemplates(response.templates);
    } catch (err) {
      setError('Failed to load consent form templates');
    } finally {
      setLoading(false);
    }
  };

  // Load submissions
  const loadSubmissions = async () => {
    try {
      setLoading(true);
      const response = await listSubmissions({
        page: 1,
        page_size: 50,
        client_email: searchEmail || undefined,
        include_voided: true,
      });
      setSubmissions(response.submissions);
    } catch (err) {
      setError('Failed to load consent form submissions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Only load data if user has permission
    if (!user || !['owner', 'artist', 'receptionist'].includes(user.role)) {
      setLoading(false);
      return;
    }
    if (activeTab === 'templates') {
      loadTemplates();
    } else {
      loadSubmissions();
    }
  }, [activeTab, user]);

  // RBAC check - must be after all hooks
  if (!user || !['owner', 'artist', 'receptionist'].includes(user.role)) {
    return (
      <div className="p-8">
        <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-6 text-center">
          <h2 className="text-xl font-semibold text-red-400">Access Denied</h2>
          <p className="text-ink-400 mt-2">You don't have permission to view consent forms.</p>
        </div>
      </div>
    );
  }

  // Load prebuilt templates
  const loadPrebuiltTemplates = async () => {
    try {
      const response = await listPrebuiltTemplates();
      setPrebuiltTemplates(response.templates);
    } catch (err) {
      console.error('Failed to load prebuilt templates:', err);
    }
  };

  // Handle create from prebuilt
  const handleCreateFromPrebuilt = async (prebuiltId: string) => {
    try {
      await createFromPrebuilt({ prebuilt_id: prebuiltId, is_default: templates.length === 0 });
      setShowPrebuiltModal(false);
      await loadTemplates();
    } catch (err) {
      setError('Failed to create template from prebuilt');
    }
  };

  // Handle template edit
  const handleEditTemplate = async (template: ConsentFormTemplateSummary) => {
    try {
      const fullTemplate = await getTemplate(template.id);
      setEditingTemplate({
        name: fullTemplate.name,
        description: fullTemplate.description || undefined,
        header_text: fullTemplate.header_text || undefined,
        footer_text: fullTemplate.footer_text || undefined,
        requires_photo_id: fullTemplate.requires_photo_id,
        requires_signature: fullTemplate.requires_signature,
        age_requirement: fullTemplate.age_requirement,
        fields: fullTemplate.fields,
        is_active: fullTemplate.is_active,
        is_default: fullTemplate.is_default,
      });
      setEditingTemplateId(fullTemplate.id);
      setShowTemplateModal(true);
    } catch (err) {
      setError('Failed to load template details');
    }
  };

  // Handle template save
  const handleSaveTemplate = async () => {
    if (!editingTemplate) return;

    try {
      if (editingTemplateId) {
        await updateTemplate(editingTemplateId, editingTemplate as ConsentFormTemplateUpdate);
      } else {
        await createTemplate(editingTemplate);
      }
      setShowTemplateModal(false);
      setEditingTemplate(null);
      setEditingTemplateId(null);
      await loadTemplates();
    } catch (err) {
      setError('Failed to save template');
    }
  };

  // Handle template delete
  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      await deleteTemplate(templateId);
      await loadTemplates();
    } catch (err) {
      setError('Failed to delete template');
    }
  };

  // Handle view submission
  const handleViewSubmission = async (submission: ConsentSubmissionSummary) => {
    try {
      // Reset decrypted data and audit log state
      setDecryptedSignature(null);
      setDecryptedPhotoId(null);
      setAuditLogs([]);
      setShowAuditLog(false);
      setAgeStatus(null);

      const fullSubmission = await getSubmission(submission.id);
      setSelectedSubmission(fullSubmission);
      setShowSubmissionModal(true);

      // Load age status
      try {
        const status = await getAgeVerificationStatus(submission.id);
        setAgeStatus(status);
      } catch {
        // Age status may not be available for older submissions
      }
    } catch (err) {
      setError('Failed to load submission details');
    }
  };

  // Handle verify photo ID
  const handleVerifyPhotoId = async () => {
    if (!selectedSubmission) return;

    try {
      await verifyPhotoId(selectedSubmission.id, {});
      const updated = await getSubmission(selectedSubmission.id);
      setSelectedSubmission(updated);
      await loadSubmissions();
    } catch (err) {
      setError('Failed to verify photo ID');
    }
  };

  // Handle void submission
  const handleVoidSubmission = async () => {
    if (!selectedSubmission || !voidReason.trim()) return;

    try {
      await voidSubmission(selectedSubmission.id, { reason: voidReason });
      setShowVoidModal(false);
      setVoidReason('');
      const updated = await getSubmission(selectedSubmission.id);
      setSelectedSubmission(updated);
      await loadSubmissions();
    } catch (err) {
      setError('Failed to void submission');
    }
  };

  // Load audit log for submission
  const loadAuditLog = async (submissionId: string) => {
    try {
      setLoadingAuditLog(true);
      const response = await getSubmissionAuditLog(submissionId, { page: 1, page_size: 100 });
      setAuditLogs(response.logs);
      setShowAuditLog(true);
    } catch (err) {
      setError('Failed to load audit log');
    } finally {
      setLoadingAuditLog(false);
    }
  };

  // Load decrypted signature
  const loadDecryptedSignature = async (submissionId: string) => {
    try {
      setLoadingDecryption(true);
      const response = await getDecryptedSignature(submissionId);
      setDecryptedSignature(response.signature_data);
    } catch (err) {
      setError('Failed to decrypt signature');
    } finally {
      setLoadingDecryption(false);
    }
  };

  // Load decrypted photo ID
  const loadDecryptedPhotoId = async (submissionId: string) => {
    try {
      setLoadingDecryption(true);
      const blobUrl = await getDecryptedPhotoId(submissionId);
      setDecryptedPhotoId(blobUrl);
    } catch (err) {
      setError('Failed to decrypt photo ID');
    } finally {
      setLoadingDecryption(false);
    }
  };

  // Handle manual age verification
  const handleVerifyAge = async (verified: boolean) => {
    if (!selectedSubmission) return;

    try {
      await verifyAge(selectedSubmission.id, {
        age_verified: verified,
        notes: ageVerifyNotes || undefined,
      });
      setShowAgeVerifyModal(false);
      setAgeVerifyNotes('');

      // Refresh submission and age status
      const updated = await getSubmission(selectedSubmission.id);
      setSelectedSubmission(updated);
      const status = await getAgeVerificationStatus(selectedSubmission.id);
      setAgeStatus(status);
      await loadSubmissions();
    } catch (err) {
      setError('Failed to verify age');
    }
  };

  // Handle guardian consent submission
  const handleGuardianConsent = async () => {
    if (!selectedSubmission || !guardianSignature) return;

    try {
      await addGuardianConsent(selectedSubmission.id, {
        guardian_name: guardianData.guardian_name,
        guardian_relationship: guardianData.guardian_relationship,
        guardian_phone: guardianData.guardian_phone || undefined,
        guardian_email: guardianData.guardian_email || undefined,
        guardian_signature_data: guardianSignature,
        notes: guardianData.notes || undefined,
      });
      setShowGuardianModal(false);
      setGuardianData({
        guardian_name: '',
        guardian_relationship: '',
        guardian_phone: '',
        guardian_email: '',
        notes: '',
      });
      setGuardianSignature('');

      // Refresh submission and age status
      const updated = await getSubmission(selectedSubmission.id);
      setSelectedSubmission(updated);
      const status = await getAgeVerificationStatus(selectedSubmission.id);
      setAgeStatus(status);
      await loadSubmissions();
    } catch (err) {
      setError('Failed to add guardian consent');
    }
  };

  // Add field to template
  const addField = (type: ConsentFieldType) => {
    if (!editingTemplate) return;

    const newField: FormFieldCreate = {
      id: generateFieldId(),
      type,
      label: type === 'heading' ? 'New Section' : type === 'paragraph' ? '' : `New ${getFieldTypeLabel(type)}`,
      required: !['heading', 'paragraph'].includes(type),
      order: (editingTemplate.fields?.length || 0) + 1,
      options: ['select', 'radio'].includes(type) ? ['Option 1', 'Option 2'] : undefined,
      content: ['heading', 'paragraph'].includes(type) ? 'Enter content here' : undefined,
    };

    setEditingTemplate({
      ...editingTemplate,
      fields: [...(editingTemplate.fields || []), newField],
    });
  };

  // Update field
  const updateField = (index: number, updates: Partial<FormFieldCreate>) => {
    if (!editingTemplate || !editingTemplate.fields) return;

    const fields = [...editingTemplate.fields];
    fields[index] = { ...fields[index], ...updates };
    setEditingTemplate({ ...editingTemplate, fields });
  };

  // Remove field
  const removeField = (index: number) => {
    if (!editingTemplate || !editingTemplate.fields) return;

    const fields = editingTemplate.fields.filter((_, i) => i !== index);
    setEditingTemplate({ ...editingTemplate, fields });
  };

  // Move field
  const moveField = (index: number, direction: 'up' | 'down') => {
    if (!editingTemplate || !editingTemplate.fields) return;

    const fields = [...editingTemplate.fields];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= fields.length) return;

    [fields[index], fields[newIndex]] = [fields[newIndex], fields[index]];
    fields.forEach((f, i) => (f.order = i + 1));
    setEditingTemplate({ ...editingTemplate, fields });
  };

  // Start new template
  const startNewTemplate = () => {
    setEditingTemplate({
      name: 'New Consent Form',
      description: '',
      header_text: '',
      footer_text: '',
      requires_photo_id: false,
      requires_signature: true,
      age_requirement: 18,
      fields: [],
      is_active: true,
      is_default: false,
    });
    setEditingTemplateId(null);
    setShowTemplateModal(true);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-ink-100">Consent Forms</h1>
        <p className="text-ink-400 mt-2">Manage digital consent forms and view submissions</p>
      </div>

      {error && (
        <div className="mb-6 bg-red-900/20 border border-red-500/50 rounded-lg p-4">
          <p className="text-red-400">{error}</p>
          <button onClick={() => setError(null)} className="text-red-300 underline text-sm mt-1">
            Dismiss
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex space-x-4 mb-6 border-b border-ink-700">
        <button
          onClick={() => setActiveTab('templates')}
          className={`pb-3 px-1 text-sm font-medium transition-colors ${
            activeTab === 'templates'
              ? 'text-accent-400 border-b-2 border-accent-400'
              : 'text-ink-400 hover:text-ink-200'
          }`}
        >
          Templates
        </button>
        <button
          onClick={() => setActiveTab('submissions')}
          className={`pb-3 px-1 text-sm font-medium transition-colors ${
            activeTab === 'submissions'
              ? 'text-accent-400 border-b-2 border-accent-400'
              : 'text-ink-400 hover:text-ink-200'
          }`}
        >
          Submissions
        </button>
      </div>

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <div>
          {isOwner && (
            <div className="flex space-x-3 mb-6">
              <button
                onClick={() => {
                  loadPrebuiltTemplates();
                  setShowPrebuiltModal(true);
                }}
                className="px-4 py-2 bg-accent-600 hover:bg-accent-500 text-white rounded-lg transition-colors"
              >
                + Use Template
              </button>
              <button
                onClick={startNewTemplate}
                className="px-4 py-2 bg-ink-700 hover:bg-ink-600 text-ink-200 rounded-lg transition-colors"
              >
                + Create Custom
              </button>
            </div>
          )}

          {loading ? (
            <div className="text-center py-12 text-ink-400">Loading templates...</div>
          ) : templates.length === 0 ? (
            <div className="text-center py-12 bg-ink-800/50 rounded-lg border border-ink-700">
              <p className="text-ink-300 text-lg">No consent form templates yet</p>
              <p className="text-ink-500 mt-2">
                Create a template from a pre-built option or build your own
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="bg-ink-800/50 rounded-lg border border-ink-700 p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <h3 className="text-lg font-medium text-ink-100">{template.name}</h3>
                        {template.is_default && (
                          <span className="px-2 py-0.5 text-xs bg-accent-600/30 text-accent-400 rounded">
                            Default
                          </span>
                        )}
                        {!template.is_active && (
                          <span className="px-2 py-0.5 text-xs bg-red-600/30 text-red-400 rounded">
                            Inactive
                          </span>
                        )}
                      </div>
                      {template.description && (
                        <p className="text-ink-400 text-sm mt-1">{template.description}</p>
                      )}
                      <div className="flex items-center space-x-4 mt-3 text-sm text-ink-500">
                        <span>{template.field_count} fields</span>
                        <span>v{template.version}</span>
                        <span>Used {template.use_count} times</span>
                        {template.requires_signature && <span>Signature required</span>}
                        {template.requires_photo_id && <span>Photo ID required</span>}
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEditTemplate(template)}
                        className="px-3 py-1.5 text-sm bg-ink-700 hover:bg-ink-600 text-ink-200 rounded transition-colors"
                      >
                        {isOwner ? 'Edit' : 'View'}
                      </button>
                      {isOwner && (
                        <button
                          onClick={() => handleDeleteTemplate(template.id)}
                          className="px-3 py-1.5 text-sm bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded transition-colors"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Submissions Tab */}
      {activeTab === 'submissions' && (
        <div>
          <div className="flex items-center space-x-4 mb-6">
            <input
              type="text"
              placeholder="Search by email..."
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              className="flex-1 max-w-md px-4 py-2 bg-ink-800 border border-ink-600 rounded-lg text-ink-100 focus:outline-none focus:ring-2 focus:ring-accent-500"
            />
            <button
              onClick={loadSubmissions}
              className="px-4 py-2 bg-accent-600 hover:bg-accent-500 text-white rounded-lg transition-colors"
            >
              Search
            </button>
          </div>

          {loading ? (
            <div className="text-center py-12 text-ink-400">Loading submissions...</div>
          ) : submissions.length === 0 ? (
            <div className="text-center py-12 bg-ink-800/50 rounded-lg border border-ink-700">
              <p className="text-ink-300 text-lg">No submissions found</p>
              <p className="text-ink-500 mt-2">
                Submissions will appear here when clients sign consent forms
              </p>
            </div>
          ) : (
            <div className="bg-ink-800/50 rounded-lg border border-ink-700 overflow-hidden">
              <table className="w-full">
                <thead className="bg-ink-900/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-ink-300">Client</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-ink-300">Form</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-ink-300">Submitted</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-ink-300">Status</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-ink-300">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-700">
                  {submissions.map((submission) => (
                    <tr key={submission.id} className="hover:bg-ink-700/30">
                      <td className="px-4 py-3">
                        <div className="text-ink-100">{submission.client_name}</div>
                        <div className="text-ink-500 text-sm">{submission.client_email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-ink-200">{submission.template_name}</div>
                        <div className="text-ink-500 text-sm">v{submission.template_version}</div>
                      </td>
                      <td className="px-4 py-3 text-ink-300 text-sm">
                        {new Date(submission.submitted_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {submission.is_voided ? (
                            <span className="px-2 py-0.5 text-xs bg-red-900/30 text-red-400 rounded">
                              Voided
                            </span>
                          ) : (
                            <>
                              {submission.has_signature && (
                                <span className="px-2 py-0.5 text-xs bg-green-900/30 text-green-400 rounded">
                                  Signed
                                </span>
                              )}
                              {submission.has_photo_id && (
                                <span
                                  className={`px-2 py-0.5 text-xs rounded ${
                                    submission.photo_id_verified
                                      ? 'bg-green-900/30 text-green-400'
                                      : 'bg-yellow-900/30 text-yellow-400'
                                  }`}
                                >
                                  {submission.photo_id_verified ? 'ID Verified' : 'ID Pending'}
                                </span>
                              )}
                              {submission.age_verified ? (
                                <span className="px-2 py-0.5 text-xs bg-blue-900/30 text-blue-400 rounded">
                                  Age OK{submission.age_at_signing !== null ? ` (${submission.age_at_signing})` : ''}
                                </span>
                              ) : submission.age_at_signing !== null && submission.age_at_signing < 18 ? (
                                <span className="px-2 py-0.5 text-xs bg-orange-900/30 text-orange-400 rounded">
                                  Underage ({submission.age_at_signing})
                                </span>
                              ) : null}
                              {submission.has_guardian_consent && (
                                <span className="px-2 py-0.5 text-xs bg-purple-900/30 text-purple-400 rounded">
                                  Guardian OK
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleViewSubmission(submission)}
                          className="px-3 py-1.5 text-sm bg-ink-700 hover:bg-ink-600 text-ink-200 rounded transition-colors"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Prebuilt Templates Modal */}
      {showPrebuiltModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-ink-800 rounded-lg border border-ink-600 max-w-lg w-full p-6">
            <h2 className="text-xl font-semibold text-ink-100 mb-4">Choose a Template</h2>
            <div className="space-y-3">
              {prebuiltTemplates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleCreateFromPrebuilt(template.id)}
                  className="w-full text-left p-4 bg-ink-700/50 hover:bg-ink-700 rounded-lg border border-ink-600 transition-colors"
                >
                  <h3 className="font-medium text-ink-100">{template.name}</h3>
                  <p className="text-ink-400 text-sm mt-1">{template.description}</p>
                  <p className="text-ink-500 text-sm mt-2">{template.field_count} fields</p>
                </button>
              ))}
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowPrebuiltModal(false)}
                className="px-4 py-2 text-ink-400 hover:text-ink-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template Editor Modal */}
      {showTemplateModal && editingTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-ink-800 rounded-lg border border-ink-600 max-w-4xl w-full my-8">
            <div className="sticky top-0 bg-ink-800 border-b border-ink-600 p-6 z-10">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-ink-100">
                  {editingTemplateId ? 'Edit Template' : 'Create Template'}
                </h2>
                <button
                  onClick={() => {
                    setShowTemplateModal(false);
                    setEditingTemplate(null);
                    setEditingTemplateId(null);
                  }}
                  className="text-ink-400 hover:text-ink-200"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-ink-400 mb-1">Template Name *</label>
                  <input
                    type="text"
                    value={editingTemplate.name}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                    className="w-full px-3 py-2 bg-ink-700 border border-ink-600 rounded text-ink-100 focus:outline-none focus:ring-2 focus:ring-accent-500"
                    disabled={!isOwner}
                  />
                </div>
                <div>
                  <label className="block text-sm text-ink-400 mb-1">Age Requirement</label>
                  <input
                    type="number"
                    value={editingTemplate.age_requirement || 18}
                    onChange={(e) =>
                      setEditingTemplate({
                        ...editingTemplate,
                        age_requirement: parseInt(e.target.value) || 18,
                      })
                    }
                    className="w-full px-3 py-2 bg-ink-700 border border-ink-600 rounded text-ink-100 focus:outline-none focus:ring-2 focus:ring-accent-500"
                    disabled={!isOwner}
                    min={0}
                    max={100}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-ink-400 mb-1">Description</label>
                <textarea
                  value={editingTemplate.description || ''}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, description: e.target.value })}
                  className="w-full px-3 py-2 bg-ink-700 border border-ink-600 rounded text-ink-100 focus:outline-none focus:ring-2 focus:ring-accent-500"
                  rows={2}
                  disabled={!isOwner}
                />
              </div>

              <div>
                <label className="block text-sm text-ink-400 mb-1">Header Text</label>
                <textarea
                  value={editingTemplate.header_text || ''}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, header_text: e.target.value })}
                  className="w-full px-3 py-2 bg-ink-700 border border-ink-600 rounded text-ink-100 focus:outline-none focus:ring-2 focus:ring-accent-500"
                  rows={3}
                  disabled={!isOwner}
                />
              </div>

              {/* Settings */}
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={editingTemplate.requires_signature}
                    onChange={(e) =>
                      setEditingTemplate({ ...editingTemplate, requires_signature: e.target.checked })
                    }
                    className="rounded bg-ink-700 border-ink-600"
                    disabled={!isOwner}
                  />
                  <span className="text-ink-300">Requires Signature</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={editingTemplate.requires_photo_id}
                    onChange={(e) =>
                      setEditingTemplate({ ...editingTemplate, requires_photo_id: e.target.checked })
                    }
                    className="rounded bg-ink-700 border-ink-600"
                    disabled={!isOwner}
                  />
                  <span className="text-ink-300">Requires Photo ID</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={editingTemplate.is_active}
                    onChange={(e) =>
                      setEditingTemplate({ ...editingTemplate, is_active: e.target.checked })
                    }
                    className="rounded bg-ink-700 border-ink-600"
                    disabled={!isOwner}
                  />
                  <span className="text-ink-300">Active</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={editingTemplate.is_default}
                    onChange={(e) =>
                      setEditingTemplate({ ...editingTemplate, is_default: e.target.checked })
                    }
                    className="rounded bg-ink-700 border-ink-600"
                    disabled={!isOwner}
                  />
                  <span className="text-ink-300">Default Template</span>
                </label>
              </div>

              {/* Fields */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-medium text-ink-100">Form Fields</h3>
                  {isOwner && (
                    <div className="flex items-center space-x-2">
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            addField(e.target.value as ConsentFieldType);
                            e.target.value = '';
                          }
                        }}
                        className="px-3 py-1.5 bg-ink-700 border border-ink-600 rounded text-ink-200 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
                        defaultValue=""
                      >
                        <option value="">+ Add Field</option>
                        {FIELD_TYPES.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  {editingTemplate.fields?.map((field, index) => (
                    <div
                      key={field.id}
                      className="bg-ink-700/50 rounded-lg border border-ink-600 p-4"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <span className="px-2 py-0.5 text-xs bg-ink-600 text-ink-300 rounded">
                            {getFieldTypeLabel(field.type)}
                          </span>
                          {field.required && (
                            <span className="text-xs text-red-400">Required</span>
                          )}
                        </div>
                        {isOwner && (
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={() => moveField(index, 'up')}
                              disabled={index === 0}
                              className="p-1 text-ink-400 hover:text-ink-200 disabled:opacity-50"
                            >
                              Up
                            </button>
                            <button
                              onClick={() => moveField(index, 'down')}
                              disabled={index === (editingTemplate.fields?.length || 0) - 1}
                              className="p-1 text-ink-400 hover:text-ink-200 disabled:opacity-50"
                            >
                              Dn
                            </button>
                            <button
                              onClick={() => removeField(index)}
                              className="p-1 text-red-400 hover:text-red-300"
                            >
                              X
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-ink-400 mb-1">Label</label>
                          <input
                            type="text"
                            value={field.label}
                            onChange={(e) => updateField(index, { label: e.target.value })}
                            className="w-full px-2 py-1.5 bg-ink-700 border border-ink-600 rounded text-ink-100 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
                            disabled={!isOwner}
                          />
                        </div>

                        {['text', 'textarea', 'date', 'select'].includes(field.type) && (
                          <div>
                            <label className="block text-xs text-ink-400 mb-1">Placeholder</label>
                            <input
                              type="text"
                              value={field.placeholder || ''}
                              onChange={(e) => updateField(index, { placeholder: e.target.value })}
                              className="w-full px-2 py-1.5 bg-ink-700 border border-ink-600 rounded text-ink-100 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
                              disabled={!isOwner}
                            />
                          </div>
                        )}

                        {['heading', 'paragraph'].includes(field.type) && (
                          <div className="col-span-2">
                            <label className="block text-xs text-ink-400 mb-1">Content</label>
                            <textarea
                              value={field.content || ''}
                              onChange={(e) => updateField(index, { content: e.target.value })}
                              className="w-full px-2 py-1.5 bg-ink-700 border border-ink-600 rounded text-ink-100 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
                              rows={2}
                              disabled={!isOwner}
                            />
                          </div>
                        )}

                        {['select', 'radio'].includes(field.type) && (
                          <div className="col-span-2">
                            <label className="block text-xs text-ink-400 mb-1">
                              Options (one per line)
                            </label>
                            <textarea
                              value={(field.options || []).join('\n')}
                              onChange={(e) =>
                                updateField(index, {
                                  options: e.target.value.split('\n').filter((o) => o.trim()),
                                })
                              }
                              className="w-full px-2 py-1.5 bg-ink-700 border border-ink-600 rounded text-ink-100 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
                              rows={3}
                              disabled={!isOwner}
                            />
                          </div>
                        )}

                        {!['heading', 'paragraph'].includes(field.type) && (
                          <div className="col-span-2">
                            <label className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={field.required}
                                onChange={(e) => updateField(index, { required: e.target.checked })}
                                className="rounded bg-ink-700 border-ink-600"
                                disabled={!isOwner}
                              />
                              <span className="text-sm text-ink-300">Required field</span>
                            </label>
                          </div>
                        )}

                        {!['heading', 'paragraph', 'signature', 'photo_id'].includes(field.type) && (
                          <div className="col-span-2">
                            <label className="block text-xs text-ink-400 mb-1">Help Text</label>
                            <input
                              type="text"
                              value={field.help_text || ''}
                              onChange={(e) => updateField(index, { help_text: e.target.value })}
                              className="w-full px-2 py-1.5 bg-ink-700 border border-ink-600 rounded text-ink-100 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
                              disabled={!isOwner}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {(!editingTemplate.fields || editingTemplate.fields.length === 0) && (
                    <div className="text-center py-8 text-ink-500">
                      No fields yet. Add fields using the dropdown above.
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm text-ink-400 mb-1">Footer Text</label>
                <textarea
                  value={editingTemplate.footer_text || ''}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, footer_text: e.target.value })}
                  className="w-full px-3 py-2 bg-ink-700 border border-ink-600 rounded text-ink-100 focus:outline-none focus:ring-2 focus:ring-accent-500"
                  rows={3}
                  disabled={!isOwner}
                />
              </div>
            </div>

            {isOwner && (
              <div className="sticky bottom-0 bg-ink-800 border-t border-ink-600 p-6">
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      setShowTemplateModal(false);
                      setEditingTemplate(null);
                      setEditingTemplateId(null);
                    }}
                    className="px-4 py-2 text-ink-400 hover:text-ink-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveTemplate}
                    className="px-6 py-2 bg-accent-600 hover:bg-accent-500 text-white rounded-lg transition-colors"
                  >
                    Save Template
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Submission Detail Modal */}
      {showSubmissionModal && selectedSubmission && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-ink-800 rounded-lg border border-ink-600 max-w-3xl w-full my-8">
            <div className="sticky top-0 bg-ink-800 border-b border-ink-600 p-6 z-10">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-ink-100">Consent Submission</h2>
                  <p className="text-ink-400 text-sm">
                    {selectedSubmission.template_name} v{selectedSubmission.template_version}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowSubmissionModal(false);
                    setSelectedSubmission(null);
                  }}
                  className="text-ink-400 hover:text-ink-200"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Status badges */}
              <div className="flex flex-wrap gap-2">
                {selectedSubmission.is_voided ? (
                  <span className="px-3 py-1 text-sm bg-red-900/30 text-red-400 rounded">
                    Voided: {selectedSubmission.voided_reason}
                  </span>
                ) : (
                  <>
                    {selectedSubmission.signature_data && (
                      <span className="px-3 py-1 text-sm bg-green-900/30 text-green-400 rounded">
                        Signed
                      </span>
                    )}
                    {selectedSubmission.photo_id_url && (
                      <span
                        className={`px-3 py-1 text-sm rounded ${
                          selectedSubmission.photo_id_verified
                            ? 'bg-green-900/30 text-green-400'
                            : 'bg-yellow-900/30 text-yellow-400'
                        }`}
                      >
                        {selectedSubmission.photo_id_verified ? 'Photo ID Verified' : 'Photo ID Pending'}
                      </span>
                    )}
                    {selectedSubmission.age_verified && (
                      <span className="px-3 py-1 text-sm bg-blue-900/30 text-blue-400 rounded">
                        Age Verified ({selectedSubmission.age_at_signing} years)
                      </span>
                    )}
                  </>
                )}
              </div>

              {/* Client info */}
              <div className="bg-ink-700/50 rounded-lg p-4">
                <h3 className="font-medium text-ink-100 mb-3">Client Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-ink-500">Name:</span>
                    <span className="ml-2 text-ink-200">{selectedSubmission.client_name}</span>
                  </div>
                  <div>
                    <span className="text-ink-500">Email:</span>
                    <span className="ml-2 text-ink-200">{selectedSubmission.client_email}</span>
                  </div>
                  {selectedSubmission.client_phone && (
                    <div>
                      <span className="text-ink-500">Phone:</span>
                      <span className="ml-2 text-ink-200">{selectedSubmission.client_phone}</span>
                    </div>
                  )}
                  {selectedSubmission.client_date_of_birth && (
                    <div>
                      <span className="text-ink-500">DOB:</span>
                      <span className="ml-2 text-ink-200">
                        {new Date(selectedSubmission.client_date_of_birth).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Form responses */}
              <div className="bg-ink-700/50 rounded-lg p-4">
                <h3 className="font-medium text-ink-100 mb-3">Form Responses</h3>
                <div className="space-y-3">
                  {selectedSubmission.template_fields_snapshot.map((field) => {
                    const response = selectedSubmission.responses[field.id];
                    if (field.type === 'heading' || field.type === 'paragraph') return null;
                    if (field.type === 'signature' || field.type === 'photo_id') return null;

                    return (
                      <div key={field.id} className="text-sm">
                        <span className="text-ink-400">{field.label}:</span>
                        <span className="ml-2 text-ink-200">
                          {field.type === 'checkbox'
                            ? response
                              ? 'Yes'
                              : 'No'
                            : response?.toString() || '-'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Signature */}
              {selectedSubmission.signature_data && (
                <div className="bg-ink-700/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-ink-100">Signature</h3>
                    {!decryptedSignature && (
                      <button
                        onClick={() => loadDecryptedSignature(selectedSubmission.id)}
                        disabled={loadingDecryption}
                        className="px-3 py-1.5 text-sm bg-accent-600 hover:bg-accent-500 text-white rounded transition-colors disabled:opacity-50"
                      >
                        {loadingDecryption ? 'Decrypting...' : 'View Signature'}
                      </button>
                    )}
                  </div>
                  {decryptedSignature ? (
                    <img
                      src={decryptedSignature}
                      alt="Client signature"
                      className="max-h-32 bg-white rounded"
                    />
                  ) : (
                    <p className="text-ink-500 text-sm">
                      Signature is encrypted. Click "View Signature" to decrypt.
                    </p>
                  )}
                  <p className="text-ink-500 text-sm mt-2">
                    Signed at: {new Date(selectedSubmission.signature_timestamp!).toLocaleString()}
                  </p>
                </div>
              )}

              {/* Photo ID */}
              {selectedSubmission.photo_id_url && (
                <div className="bg-ink-700/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-ink-100">Photo ID</h3>
                    <div className="flex items-center space-x-2">
                      {!decryptedPhotoId && (
                        <button
                          onClick={() => loadDecryptedPhotoId(selectedSubmission.id)}
                          disabled={loadingDecryption}
                          className="px-3 py-1.5 text-sm bg-accent-600 hover:bg-accent-500 text-white rounded transition-colors disabled:opacity-50"
                        >
                          {loadingDecryption ? 'Decrypting...' : 'View ID'}
                        </button>
                      )}
                      {!selectedSubmission.photo_id_verified && !selectedSubmission.is_voided && (isOwner || user?.role === 'artist') && (
                        <button
                          onClick={handleVerifyPhotoId}
                          className="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-500 text-white rounded transition-colors"
                        >
                          Verify ID
                        </button>
                      )}
                    </div>
                  </div>
                  {decryptedPhotoId ? (
                    <img
                      src={decryptedPhotoId}
                      alt="Photo ID"
                      className="max-h-48 rounded"
                    />
                  ) : (
                    <p className="text-ink-500 text-sm">
                      Photo ID is encrypted. Click "View ID" to decrypt and view.
                    </p>
                  )}
                  {selectedSubmission.photo_id_verified && (
                    <p className="text-green-400 text-sm mt-2">
                      Verified at: {new Date(selectedSubmission.photo_id_verified_at!).toLocaleString()}
                    </p>
                  )}
                </div>
              )}

              {/* Age Verification */}
              {ageStatus && (
                <div className="bg-ink-700/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-ink-100">Age Verification</h3>
                    {!selectedSubmission.is_voided && (isOwner || user?.role === 'artist') && (
                      <div className="flex items-center space-x-2">
                        {!ageStatus.age_verified && (
                          <button
                            onClick={() => setShowAgeVerifyModal(true)}
                            className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
                          >
                            Verify Age
                          </button>
                        )}
                        {ageStatus.needs_guardian_consent && !selectedSubmission.has_guardian_consent && (
                          <button
                            onClick={() => setShowGuardianModal(true)}
                            className="px-3 py-1.5 text-sm bg-orange-600 hover:bg-orange-500 text-white rounded transition-colors"
                          >
                            Add Guardian Consent
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center">
                      <span className="text-ink-500 w-32">Age Requirement:</span>
                      <span className="text-ink-200">{ageStatus.age_requirement} years</span>
                    </div>
                    {ageStatus.age_at_signing !== null && (
                      <div className="flex items-center">
                        <span className="text-ink-500 w-32">Age at Signing:</span>
                        <span className={`${ageStatus.is_underage ? 'text-orange-400' : 'text-ink-200'}`}>
                          {ageStatus.age_at_signing} years
                          {ageStatus.is_underage && ' (under requirement)'}
                        </span>
                      </div>
                    )}
                    {ageStatus.client_date_of_birth && (
                      <div className="flex items-center">
                        <span className="text-ink-500 w-32">Date of Birth:</span>
                        <span className="text-ink-200">
                          {new Date(ageStatus.client_date_of_birth).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center">
                      <span className="text-ink-500 w-32">Status:</span>
                      {ageStatus.age_verified ? (
                        <span className="text-green-400">Verified</span>
                      ) : ageStatus.is_underage ? (
                        <span className="text-orange-400">Underage - Requires Review</span>
                      ) : (
                        <span className="text-yellow-400">Pending Verification</span>
                      )}
                    </div>

                    {/* Guardian consent info */}
                    {selectedSubmission.has_guardian_consent && (
                      <div className="mt-3 p-3 bg-ink-800/50 rounded border border-ink-600">
                        <p className="text-ink-300 font-medium mb-2">Guardian Consent</p>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-ink-500">Guardian:</span>
                            <span className="ml-2 text-ink-200">{selectedSubmission.guardian_name}</span>
                          </div>
                          <div>
                            <span className="text-ink-500">Relationship:</span>
                            <span className="ml-2 text-ink-200">{selectedSubmission.guardian_relationship}</span>
                          </div>
                          {selectedSubmission.guardian_phone && (
                            <div>
                              <span className="text-ink-500">Phone:</span>
                              <span className="ml-2 text-ink-200">{selectedSubmission.guardian_phone}</span>
                            </div>
                          )}
                          {selectedSubmission.guardian_email && (
                            <div>
                              <span className="text-ink-500">Email:</span>
                              <span className="ml-2 text-ink-200">{selectedSubmission.guardian_email}</span>
                            </div>
                          )}
                          <div className="col-span-2">
                            <span className="text-ink-500">Consented at:</span>
                            <span className="ml-2 text-green-400">
                              {new Date(selectedSubmission.guardian_consent_at!).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Age verification notes */}
                    {selectedSubmission.age_verification_notes && (
                      <div className="mt-2">
                        <span className="text-ink-500">Notes:</span>
                        <span className="ml-2 text-ink-300">{selectedSubmission.age_verification_notes}</span>
                      </div>
                    )}
                    {selectedSubmission.age_verified_at && (
                      <p className="text-green-400 text-sm mt-2">
                        Verified at: {new Date(selectedSubmission.age_verified_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Metadata */}
              <div className="bg-ink-700/50 rounded-lg p-4">
                <h3 className="font-medium text-ink-100 mb-3">Submission Details</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-ink-500">Submitted:</span>
                    <span className="ml-2 text-ink-200">
                      {new Date(selectedSubmission.submitted_at).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-ink-500">IP Address:</span>
                    <span className="ml-2 text-ink-200">{selectedSubmission.ip_address || '-'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-ink-500">Access Token:</span>
                    <span className="ml-2 text-ink-200 font-mono text-xs">
                      {selectedSubmission.access_token}
                    </span>
                  </div>
                </div>
              </div>

              {/* Audit Log */}
              {isOwner && (
                <div className="bg-ink-700/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-ink-100">Audit Log</h3>
                    {!showAuditLog && (
                      <button
                        onClick={() => loadAuditLog(selectedSubmission.id)}
                        disabled={loadingAuditLog}
                        className="px-3 py-1.5 text-sm bg-ink-600 hover:bg-ink-500 text-ink-200 rounded transition-colors disabled:opacity-50"
                      >
                        {loadingAuditLog ? 'Loading...' : 'View Audit Log'}
                      </button>
                    )}
                  </div>
                  {showAuditLog ? (
                    auditLogs.length > 0 ? (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {auditLogs.map((log) => (
                          <div
                            key={log.id}
                            className="flex items-start justify-between p-2 bg-ink-800/50 rounded text-sm"
                          >
                            <div>
                              <span className={`inline-block px-2 py-0.5 rounded text-xs mr-2 ${
                                log.action === 'created' ? 'bg-green-900/30 text-green-400' :
                                log.action === 'viewed' ? 'bg-blue-900/30 text-blue-400' :
                                log.action === 'verified' ? 'bg-green-900/30 text-green-400' :
                                log.action === 'voided' ? 'bg-red-900/30 text-red-400' :
                                log.action === 'downloaded' ? 'bg-purple-900/30 text-purple-400' :
                                'bg-ink-600 text-ink-300'
                              }`}>
                                {log.action}
                              </span>
                              <span className="text-ink-300">
                                {log.is_client_access ? 'Client' : log.performed_by_name || 'System'}
                              </span>
                              {log.notes && (
                                <p className="text-ink-500 text-xs mt-1">{log.notes}</p>
                              )}
                            </div>
                            <div className="text-right text-ink-500 text-xs">
                              <div>{new Date(log.created_at).toLocaleString()}</div>
                              {log.ip_address && <div>IP: {log.ip_address}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-ink-500 text-sm">No audit log entries found.</p>
                    )
                  ) : (
                    <p className="text-ink-500 text-sm">
                      Audit log tracks all access and modifications to this consent form.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            {!selectedSubmission.is_voided && isOwner && (
              <div className="sticky bottom-0 bg-ink-800 border-t border-ink-600 p-6">
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setShowVoidModal(true)}
                    className="px-4 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-lg transition-colors"
                  >
                    Void Submission
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Void Modal */}
      {showVoidModal && selectedSubmission && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-ink-800 rounded-lg border border-ink-600 max-w-md w-full p-6">
            <h2 className="text-xl font-semibold text-ink-100 mb-4">Void Consent Form</h2>
            <p className="text-ink-400 mb-4">
              This will invalidate the consent form. This action cannot be undone.
            </p>
            <div className="mb-4">
              <label className="block text-sm text-ink-400 mb-1">Reason for voiding *</label>
              <textarea
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                className="w-full px-3 py-2 bg-ink-700 border border-ink-600 rounded text-ink-100 focus:outline-none focus:ring-2 focus:ring-accent-500"
                rows={3}
                placeholder="Enter the reason for voiding this consent form..."
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowVoidModal(false);
                  setVoidReason('');
                }}
                className="px-4 py-2 text-ink-400 hover:text-ink-200"
              >
                Cancel
              </button>
              <button
                onClick={handleVoidSubmission}
                disabled={!voidReason.trim()}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Void Form
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Age Verify Modal */}
      {showAgeVerifyModal && selectedSubmission && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-ink-800 rounded-lg border border-ink-600 max-w-md w-full p-6">
            <h2 className="text-xl font-semibold text-ink-100 mb-4">Verify Client Age</h2>
            <p className="text-ink-400 mb-4">
              Confirm the client's age has been verified via photo ID or other means.
            </p>
            {ageStatus && (
              <div className="mb-4 p-3 bg-ink-700/50 rounded text-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-ink-400">Age Requirement:</span>
                  <span className="text-ink-200">{ageStatus.age_requirement} years</span>
                </div>
                {ageStatus.age_at_signing !== null && (
                  <div className="flex items-center justify-between">
                    <span className="text-ink-400">Age at Signing:</span>
                    <span className={ageStatus.is_underage ? 'text-orange-400' : 'text-green-400'}>
                      {ageStatus.age_at_signing} years
                    </span>
                  </div>
                )}
              </div>
            )}
            <div className="mb-4">
              <label className="block text-sm text-ink-400 mb-1">Notes (optional)</label>
              <textarea
                value={ageVerifyNotes}
                onChange={(e) => setAgeVerifyNotes(e.target.value)}
                className="w-full px-3 py-2 bg-ink-700 border border-ink-600 rounded text-ink-100 focus:outline-none focus:ring-2 focus:ring-accent-500"
                rows={2}
                placeholder="Any notes about age verification..."
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowAgeVerifyModal(false);
                  setAgeVerifyNotes('');
                }}
                className="px-4 py-2 text-ink-400 hover:text-ink-200"
              >
                Cancel
              </button>
              <button
                onClick={() => handleVerifyAge(true)}
                className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors"
              >
                Confirm Age Verified
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Guardian Consent Modal */}
      {showGuardianModal && selectedSubmission && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-ink-800 rounded-lg border border-ink-600 max-w-md w-full p-6 my-8">
            <h2 className="text-xl font-semibold text-ink-100 mb-4">Guardian Consent</h2>
            <p className="text-ink-400 mb-4">
              The client is under the age requirement. A parent or legal guardian must provide consent.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-ink-400 mb-1">Guardian Name *</label>
                <input
                  type="text"
                  value={guardianData.guardian_name}
                  onChange={(e) => setGuardianData({ ...guardianData, guardian_name: e.target.value })}
                  className="w-full px-3 py-2 bg-ink-700 border border-ink-600 rounded text-ink-100 focus:outline-none focus:ring-2 focus:ring-accent-500"
                  placeholder="Full legal name"
                />
              </div>
              <div>
                <label className="block text-sm text-ink-400 mb-1">Relationship *</label>
                <select
                  value={guardianData.guardian_relationship}
                  onChange={(e) => setGuardianData({ ...guardianData, guardian_relationship: e.target.value })}
                  className="w-full px-3 py-2 bg-ink-700 border border-ink-600 rounded text-ink-100 focus:outline-none focus:ring-2 focus:ring-accent-500"
                >
                  <option value="">Select relationship</option>
                  <option value="Parent">Parent</option>
                  <option value="Legal Guardian">Legal Guardian</option>
                  <option value="Step-Parent">Step-Parent</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-ink-400 mb-1">Phone</label>
                <input
                  type="tel"
                  value={guardianData.guardian_phone || ''}
                  onChange={(e) => setGuardianData({ ...guardianData, guardian_phone: e.target.value })}
                  className="w-full px-3 py-2 bg-ink-700 border border-ink-600 rounded text-ink-100 focus:outline-none focus:ring-2 focus:ring-accent-500"
                  placeholder="(555) 123-4567"
                />
              </div>
              <div>
                <label className="block text-sm text-ink-400 mb-1">Email</label>
                <input
                  type="email"
                  value={guardianData.guardian_email || ''}
                  onChange={(e) => setGuardianData({ ...guardianData, guardian_email: e.target.value })}
                  className="w-full px-3 py-2 bg-ink-700 border border-ink-600 rounded text-ink-100 focus:outline-none focus:ring-2 focus:ring-accent-500"
                  placeholder="guardian@example.com"
                />
              </div>
              <div>
                <label className="block text-sm text-ink-400 mb-1">Guardian Signature *</label>
                <p className="text-ink-500 text-xs mb-2">
                  Have the guardian sign below or enter their signature confirmation.
                </p>
                <input
                  type="text"
                  value={guardianSignature}
                  onChange={(e) => setGuardianSignature(e.target.value)}
                  className="w-full px-3 py-2 bg-ink-700 border border-ink-600 rounded text-ink-100 focus:outline-none focus:ring-2 focus:ring-accent-500"
                  placeholder="Type guardian's full name as signature"
                />
              </div>
              <div>
                <label className="block text-sm text-ink-400 mb-1">Notes</label>
                <textarea
                  value={guardianData.notes || ''}
                  onChange={(e) => setGuardianData({ ...guardianData, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-ink-700 border border-ink-600 rounded text-ink-100 focus:outline-none focus:ring-2 focus:ring-accent-500"
                  rows={2}
                  placeholder="Any additional notes..."
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowGuardianModal(false);
                  setGuardianData({
                    guardian_name: '',
                    guardian_relationship: '',
                    guardian_phone: '',
                    guardian_email: '',
                    notes: '',
                  });
                  setGuardianSignature('');
                }}
                className="px-4 py-2 text-ink-400 hover:text-ink-200"
              >
                Cancel
              </button>
              <button
                onClick={handleGuardianConsent}
                disabled={!guardianData.guardian_name || !guardianData.guardian_relationship || !guardianSignature}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save Guardian Consent
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ConsentForms;
