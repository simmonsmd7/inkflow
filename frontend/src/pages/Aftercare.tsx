/**
 * Aftercare page - manage aftercare instruction templates and sent instructions.
 */

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
  listSentAftercare,
  getTattooTypeLabel,
  getPlacementLabel,
  getStatusLabel,
  getStatusColor,
  listFollowUps,
  sendFollowUpNow,
  cancelFollowUp,
  getFollowUpTypeLabel,
  getFollowUpStatusLabel,
  getFollowUpStatusColor,
  listHealingIssues,
  getHealingIssue,
  acknowledgeHealingIssue,
  resolveHealingIssue,
  getHealingIssueSeverityLabel,
  getHealingIssueSeverityColor,
  getHealingIssueStatusLabel,
  getHealingIssueStatusColor,
  HEALING_ISSUE_SYMPTOMS,
} from '../services/aftercare';
import type {
  AftercareTemplateSummary,
  AftercareTemplateResponse,
  AftercareTemplateCreate,
  AftercareTemplateUpdate,
  AftercareSentSummary,
  PrebuiltAftercareTemplate,
  TattooType,
  TattooPlacement,
  FollowUpSummary,
  FollowUpStatus,
  HealingIssueSummary,
  HealingIssueResponse,
  HealingIssueSeverity,
  HealingIssueStatus,
} from '../types/api';

const TATTOO_TYPES: TattooType[] = [
  'traditional', 'fine_line', 'blackwork', 'watercolor', 'realism',
  'neo_traditional', 'geometric', 'tribal', 'dotwork', 'script',
  'cover_up', 'touch_up', 'other',
];

const PLACEMENTS: TattooPlacement[] = [
  'arm_upper', 'arm_lower', 'arm_inner', 'hand', 'finger',
  'leg_upper', 'leg_lower', 'foot', 'chest', 'back', 'ribs',
  'stomach', 'neck', 'face', 'head', 'shoulder', 'hip', 'other',
];

type TabType = 'templates' | 'sent' | 'followups' | 'issues';

export function Aftercare() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('templates');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Templates state
  const [templates, setTemplates] = useState<AftercareTemplateSummary[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<AftercareTemplateResponse | null>(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showPrebuiltModal, setShowPrebuiltModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [prebuiltTemplates, setPrebuiltTemplates] = useState<PrebuiltAftercareTemplate[]>([]);
  const [loadingPrebuilt, setLoadingPrebuilt] = useState(false);

  // Sent aftercare state
  const [sentAftercare, setSentAftercare] = useState<AftercareSentSummary[]>([]);
  const [loadingSent, setLoadingSent] = useState(false);

  // Follow-ups state
  const [followUps, setFollowUps] = useState<FollowUpSummary[]>([]);
  const [followUpFilter, setFollowUpFilter] = useState<FollowUpStatus | ''>('');
  const [loadingFollowUps, setLoadingFollowUps] = useState(false);
  const [processingFollowUp, setProcessingFollowUp] = useState<string | null>(null);

  // Healing issues state
  const [healingIssues, setHealingIssues] = useState<HealingIssueSummary[]>([]);
  const [issueStatusFilter, setIssueStatusFilter] = useState<HealingIssueStatus | ''>('');
  const [issueSeverityFilter, setIssueSeverityFilter] = useState<HealingIssueSeverity | ''>('');
  const [loadingIssues, setLoadingIssues] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<HealingIssueResponse | null>(null);
  const [processingIssue, setProcessingIssue] = useState<string | null>(null);
  const [showAcknowledgeModal, setShowAcknowledgeModal] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [acknowledgeNotes, setAcknowledgeNotes] = useState('');
  const [resolveNotes, setResolveNotes] = useState('');
  const [requestTouchUp, setRequestTouchUp] = useState(false);

  // Edit form state
  const [editForm, setEditForm] = useState<AftercareTemplateCreate>({
    name: '',
    description: '',
    tattoo_type: null,
    placement: null,
    instructions_html: '',
    instructions_plain: '',
    extra_data: null,
    is_active: true,
    is_default: false,
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // RBAC check
  if (!user || !['owner', 'artist', 'receptionist'].includes(user.role)) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-ink-400">You don't have permission to view this page.</p>
      </div>
    );
  }

  const canEdit = user.role === 'owner' || user.role === 'artist';
  const canDelete = user.role === 'owner';

  // Load data based on active tab
  useEffect(() => {
    if (activeTab === 'templates') {
      loadTemplates();
    } else if (activeTab === 'sent') {
      loadSentAftercare();
    } else if (activeTab === 'followups') {
      loadFollowUps();
    } else if (activeTab === 'issues') {
      loadHealingIssues();
    }
  }, [activeTab, followUpFilter, issueStatusFilter, issueSeverityFilter]);

  async function loadSentAftercare() {
    try {
      setLoadingSent(true);
      setError(null);
      const response = await listSentAftercare({ page_size: 50 });
      setSentAftercare(response.items);
    } catch (err) {
      setError('Failed to load sent aftercare records');
      console.error(err);
    } finally {
      setLoadingSent(false);
    }
  }

  async function loadFollowUps() {
    try {
      setLoadingFollowUps(true);
      setError(null);
      const response = await listFollowUps({
        page_size: 50,
        status: followUpFilter || undefined,
      });
      setFollowUps(response.items);
    } catch (err) {
      setError('Failed to load follow-ups');
      console.error(err);
    } finally {
      setLoadingFollowUps(false);
    }
  }

  async function handleSendFollowUp(id: string) {
    try {
      setProcessingFollowUp(id);
      setError(null);
      await sendFollowUpNow(id);
      setSuccess('Follow-up sent successfully');
      loadFollowUps();
    } catch (err) {
      setError('Failed to send follow-up');
      console.error(err);
    } finally {
      setProcessingFollowUp(null);
    }
  }

  async function handleCancelFollowUp(id: string) {
    try {
      setProcessingFollowUp(id);
      setError(null);
      await cancelFollowUp(id);
      setSuccess('Follow-up cancelled');
      loadFollowUps();
    } catch (err) {
      setError('Failed to cancel follow-up');
      console.error(err);
    } finally {
      setProcessingFollowUp(null);
    }
  }

  async function loadHealingIssues() {
    try {
      setLoadingIssues(true);
      setError(null);
      const response = await listHealingIssues({
        page_size: 50,
        status: issueStatusFilter || undefined,
        severity: issueSeverityFilter || undefined,
      });
      setHealingIssues(response.items);
    } catch (err) {
      setError('Failed to load healing issues');
      console.error(err);
    } finally {
      setLoadingIssues(false);
    }
  }

  async function handleViewIssue(issue: HealingIssueSummary) {
    try {
      setLoadingIssues(true);
      const fullIssue = await getHealingIssue(issue.id);
      setSelectedIssue(fullIssue);
    } catch (err) {
      setError('Failed to load issue details');
      console.error(err);
    } finally {
      setLoadingIssues(false);
    }
  }

  async function handleAcknowledgeIssue() {
    if (!selectedIssue) return;

    try {
      setProcessingIssue(selectedIssue.id);
      setError(null);
      await acknowledgeHealingIssue(selectedIssue.id, acknowledgeNotes || undefined);
      setSuccess('Issue acknowledged and client notified');
      setShowAcknowledgeModal(false);
      setAcknowledgeNotes('');
      setSelectedIssue(null);
      loadHealingIssues();
    } catch (err) {
      setError('Failed to acknowledge issue');
      console.error(err);
    } finally {
      setProcessingIssue(null);
    }
  }

  async function handleResolveIssue() {
    if (!selectedIssue || !resolveNotes.trim()) {
      setError('Resolution notes are required');
      return;
    }

    try {
      setProcessingIssue(selectedIssue.id);
      setError(null);
      await resolveHealingIssue(selectedIssue.id, resolveNotes, requestTouchUp);
      setSuccess('Issue resolved and client notified');
      setShowResolveModal(false);
      setResolveNotes('');
      setRequestTouchUp(false);
      setSelectedIssue(null);
      loadHealingIssues();
    } catch (err) {
      setError('Failed to resolve issue');
      console.error(err);
    } finally {
      setProcessingIssue(null);
    }
  }

  function getSymptomLabel(symptomId: string): string {
    const symptom = HEALING_ISSUE_SYMPTOMS.find((s) => s.id === symptomId);
    return symptom?.label || symptomId;
  }

  async function loadTemplates() {
    try {
      setLoading(true);
      setError(null);
      const response = await listTemplates();
      setTemplates(response.items);
    } catch (err) {
      setError('Failed to load aftercare templates');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadPrebuiltTemplates() {
    try {
      setLoadingPrebuilt(true);
      const response = await listPrebuiltTemplates();
      setPrebuiltTemplates(response.templates);
    } catch (err) {
      setError('Failed to load pre-built templates');
      console.error(err);
    } finally {
      setLoadingPrebuilt(false);
    }
  }

  async function handleSelectPrebuilt(templateId: string) {
    try {
      setSaving(true);
      setError(null);
      await createFromPrebuilt(templateId);
      setShowPrebuiltModal(false);
      setSuccess('Template created from pre-built successfully');
      loadTemplates();
    } catch (err) {
      setError('Failed to create template from pre-built');
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleViewTemplate(template: AftercareTemplateSummary) {
    try {
      setLoading(true);
      const fullTemplate = await getTemplate(template.id);
      setSelectedTemplate(fullTemplate);
    } catch (err) {
      setError('Failed to load template details');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleEditTemplate(template: AftercareTemplateSummary) {
    try {
      setLoading(true);
      const fullTemplate = await getTemplate(template.id);
      setEditForm({
        name: fullTemplate.name,
        description: fullTemplate.description || '',
        tattoo_type: fullTemplate.tattoo_type,
        placement: fullTemplate.placement,
        instructions_html: fullTemplate.instructions_html,
        instructions_plain: fullTemplate.instructions_plain,
        extra_data: fullTemplate.extra_data,
        is_active: fullTemplate.is_active,
        is_default: fullTemplate.is_default,
      });
      setEditingId(template.id);
      setShowTemplateModal(true);
    } catch (err) {
      setError('Failed to load template for editing');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function handleNewTemplate() {
    setEditForm({
      name: '',
      description: '',
      tattoo_type: null,
      placement: null,
      instructions_html: '',
      instructions_plain: '',
      extra_data: null,
      is_active: true,
      is_default: false,
    });
    setEditingId(null);
    setShowTemplateModal(true);
  }

  async function handleSaveTemplate() {
    if (!editForm.name.trim()) {
      setError('Template name is required');
      return;
    }
    if (!editForm.instructions_html.trim() || !editForm.instructions_plain.trim()) {
      setError('Both HTML and plain text instructions are required');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      if (editingId) {
        await updateTemplate(editingId, editForm as AftercareTemplateUpdate);
        setSuccess('Template updated successfully');
      } else {
        await createTemplate(editForm);
        setSuccess('Template created successfully');
      }

      setShowTemplateModal(false);
      loadTemplates();
    } catch (err) {
      setError('Failed to save template');
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteTemplate() {
    if (!selectedTemplate) return;

    try {
      setSaving(true);
      setError(null);
      await deleteTemplate(selectedTemplate.id);
      setSuccess('Template deleted successfully');
      setShowDeleteModal(false);
      setSelectedTemplate(null);
      loadTemplates();
    } catch (err) {
      setError('Failed to delete template');
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  // Clear success message after 3 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  return (
    <div className="space-y-6">
      {/* Header with Tabs */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-100">Aftercare</h1>
          <p className="text-ink-400 mt-1">
            Manage aftercare templates and track sent instructions
          </p>
        </div>
        {activeTab === 'templates' && canEdit && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                loadPrebuiltTemplates();
                setShowPrebuiltModal(true);
              }}
              className="px-4 py-2 border border-ink-600 text-ink-300 rounded-lg hover:bg-ink-700 transition-colors"
            >
              Use Pre-built
            </button>
            <button
              onClick={handleNewTemplate}
              className="px-4 py-2 bg-accent-primary text-ink-900 rounded-lg hover:bg-accent-primary/90 transition-colors font-medium"
            >
              + New Template
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-ink-700">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('templates')}
            className={`py-3 px-1 border-b-2 transition-colors ${
              activeTab === 'templates'
                ? 'border-accent-primary text-ink-100 font-medium'
                : 'border-transparent text-ink-400 hover:text-ink-300'
            }`}
          >
            Templates
          </button>
          <button
            onClick={() => setActiveTab('sent')}
            className={`py-3 px-1 border-b-2 transition-colors ${
              activeTab === 'sent'
                ? 'border-accent-primary text-ink-100 font-medium'
                : 'border-transparent text-ink-400 hover:text-ink-300'
            }`}
          >
            Sent Instructions
          </button>
          <button
            onClick={() => setActiveTab('followups')}
            className={`py-3 px-1 border-b-2 transition-colors ${
              activeTab === 'followups'
                ? 'border-accent-primary text-ink-100 font-medium'
                : 'border-transparent text-ink-400 hover:text-ink-300'
            }`}
          >
            Follow-ups
          </button>
          <button
            onClick={() => setActiveTab('issues')}
            className={`py-3 px-1 border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'issues'
                ? 'border-accent-primary text-ink-100 font-medium'
                : 'border-transparent text-ink-400 hover:text-ink-300'
            }`}
          >
            Healing Issues
            {healingIssues.filter((i) => i.status === 'reported').length > 0 && (
              <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                {healingIssues.filter((i) => i.status === 'reported').length}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
          {error}
        </div>
      )}
      {success && (
        <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400">
          {success}
        </div>
      )}

      {/* Templates Tab Content */}
      {activeTab === 'templates' && (
        <>
          {/* Loading */}
          {loading && templates.length === 0 && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-primary"></div>
            </div>
          )}

          {/* Empty state */}
          {!loading && templates.length === 0 && (
        <div className="text-center py-12 bg-ink-800 rounded-xl border border-ink-700">
          <svg
            className="w-12 h-12 mx-auto text-ink-500 mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h3 className="text-lg font-medium text-ink-200 mb-2">No Aftercare Templates</h3>
          <p className="text-ink-400 mb-4">
            Create your first aftercare template or start from a pre-built one.
          </p>
          {canEdit && (
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => {
                  loadPrebuiltTemplates();
                  setShowPrebuiltModal(true);
                }}
                className="px-4 py-2 border border-ink-600 text-ink-300 rounded-lg hover:bg-ink-700 transition-colors"
              >
                Use Pre-built Template
              </button>
              <button
                onClick={handleNewTemplate}
                className="px-4 py-2 bg-accent-primary text-ink-900 rounded-lg hover:bg-accent-primary/90 transition-colors font-medium"
              >
                Create New Template
              </button>
            </div>
          )}
        </div>
      )}

      {/* Template Grid */}
      {templates.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <div
              key={template.id}
              className="bg-ink-800 rounded-xl border border-ink-700 p-5 hover:border-ink-600 transition-colors cursor-pointer"
              onClick={() => handleViewTemplate(template)}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-lg font-medium text-ink-100">{template.name}</h3>
                  {template.is_default && (
                    <span className="text-xs bg-accent-primary/20 text-accent-primary px-2 py-0.5 rounded-full">
                      Default
                    </span>
                  )}
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    template.is_active
                      ? 'bg-green-500/10 text-green-400'
                      : 'bg-ink-600 text-ink-400'
                  }`}
                >
                  {template.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>

              {template.description && (
                <p className="text-sm text-ink-400 mb-3 line-clamp-2">
                  {template.description}
                </p>
              )}

              <div className="flex flex-wrap gap-2 mb-3">
                {template.tattoo_type && (
                  <span className="text-xs bg-ink-700 text-ink-300 px-2 py-1 rounded">
                    {getTattooTypeLabel(template.tattoo_type)}
                  </span>
                )}
                {template.placement && (
                  <span className="text-xs bg-ink-700 text-ink-300 px-2 py-1 rounded">
                    {getPlacementLabel(template.placement)}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between text-xs text-ink-500">
                <span>Used {template.use_count} times</span>
                {template.last_used_at && (
                  <span>
                    Last used {new Date(template.last_used_at).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
        </>
      )}

      {/* Sent Instructions Tab Content */}
      {activeTab === 'sent' && (
        <>
          {/* Loading */}
          {loadingSent && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-primary"></div>
            </div>
          )}

          {/* Empty state */}
          {!loadingSent && sentAftercare.length === 0 && (
            <div className="text-center py-12 bg-ink-800 rounded-xl border border-ink-700">
              <svg
                className="w-12 h-12 mx-auto text-ink-500 mb-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
              <h3 className="text-lg font-medium text-ink-200 mb-2">No Sent Instructions</h3>
              <p className="text-ink-400">
                Aftercare instructions will appear here after completing appointments.
              </p>
            </div>
          )}

          {/* Sent Aftercare Table */}
          {sentAftercare.length > 0 && (
            <div className="bg-ink-800 rounded-xl border border-ink-700 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-ink-700">
                    <th className="text-left text-xs font-medium text-ink-400 px-4 py-3">Client</th>
                    <th className="text-left text-xs font-medium text-ink-400 px-4 py-3">Template</th>
                    <th className="text-left text-xs font-medium text-ink-400 px-4 py-3">Appointment</th>
                    <th className="text-left text-xs font-medium text-ink-400 px-4 py-3">Status</th>
                    <th className="text-left text-xs font-medium text-ink-400 px-4 py-3">Views</th>
                    <th className="text-left text-xs font-medium text-ink-400 px-4 py-3">Sent</th>
                  </tr>
                </thead>
                <tbody>
                  {sentAftercare.map((sent) => (
                    <tr
                      key={sent.id}
                      className="border-b border-ink-700/50 last:border-0 hover:bg-ink-700/30"
                    >
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-ink-100">{sent.client_name}</p>
                          <p className="text-xs text-ink-400">{sent.client_email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-ink-300">{sent.template_name}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-ink-300">
                          {new Date(sent.appointment_date).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(sent.status)}`}>
                          {getStatusLabel(sent.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-ink-400">{sent.view_count}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-ink-400">
                          {sent.sent_at
                            ? new Date(sent.sent_at).toLocaleDateString()
                            : '-'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Follow-ups Tab Content */}
      {activeTab === 'followups' && (
        <>
          {/* Filter controls */}
          <div className="flex items-center gap-4 mb-4">
            <label className="text-sm text-ink-400">Filter by status:</label>
            <select
              value={followUpFilter}
              onChange={(e) => setFollowUpFilter(e.target.value as FollowUpStatus | '')}
              className="px-3 py-1.5 bg-ink-800 border border-ink-600 rounded-lg text-ink-100 text-sm focus:outline-none focus:border-accent-primary"
            >
              <option value="">All</option>
              <option value="scheduled">Scheduled</option>
              <option value="sent">Sent</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          {/* Loading */}
          {loadingFollowUps && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-primary"></div>
            </div>
          )}

          {/* Empty state */}
          {!loadingFollowUps && followUps.length === 0 && (
            <div className="text-center py-12 bg-ink-800 rounded-xl border border-ink-700">
              <svg
                className="w-12 h-12 mx-auto text-ink-500 mb-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <h3 className="text-lg font-medium text-ink-200 mb-2">No Follow-ups</h3>
              <p className="text-ink-400">
                {followUpFilter
                  ? `No follow-ups with status "${getFollowUpStatusLabel(followUpFilter)}"`
                  : 'Follow-up messages will appear here when aftercare is sent with scheduled follow-ups.'}
              </p>
            </div>
          )}

          {/* Follow-ups Table */}
          {followUps.length > 0 && (
            <div className="bg-ink-800 rounded-xl border border-ink-700 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-ink-700">
                    <th className="text-left text-xs font-medium text-ink-400 px-4 py-3">Type</th>
                    <th className="text-left text-xs font-medium text-ink-400 px-4 py-3">Scheduled For</th>
                    <th className="text-left text-xs font-medium text-ink-400 px-4 py-3">Status</th>
                    <th className="text-left text-xs font-medium text-ink-400 px-4 py-3">Sent At</th>
                    <th className="text-left text-xs font-medium text-ink-400 px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {followUps.map((fu) => (
                    <tr
                      key={fu.id}
                      className="border-b border-ink-700/50 last:border-0 hover:bg-ink-700/30"
                    >
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-ink-100">
                          {getFollowUpTypeLabel(fu.follow_up_type)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm text-ink-300">
                            {new Date(fu.scheduled_for).toLocaleDateString()}
                          </p>
                          <p className="text-xs text-ink-500">
                            {new Date(fu.scheduled_for).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${getFollowUpStatusColor(fu.status)}`}
                        >
                          {getFollowUpStatusLabel(fu.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-ink-400">
                          {fu.sent_at ? new Date(fu.sent_at).toLocaleString() : '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {fu.status === 'scheduled' && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleSendFollowUp(fu.id)}
                              disabled={processingFollowUp === fu.id}
                              className="text-xs px-2 py-1 bg-accent-primary/20 text-accent-primary rounded hover:bg-accent-primary/30 disabled:opacity-50 transition-colors"
                            >
                              {processingFollowUp === fu.id ? 'Sending...' : 'Send Now'}
                            </button>
                            <button
                              onClick={() => handleCancelFollowUp(fu.id)}
                              disabled={processingFollowUp === fu.id}
                              className="text-xs px-2 py-1 text-ink-400 hover:bg-ink-700 rounded transition-colors disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                        {fu.status === 'failed' && (
                          <button
                            onClick={() => handleSendFollowUp(fu.id)}
                            disabled={processingFollowUp === fu.id}
                            className="text-xs px-2 py-1 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 disabled:opacity-50 transition-colors"
                          >
                            {processingFollowUp === fu.id ? 'Retrying...' : 'Retry'}
                          </button>
                        )}
                        {(fu.status === 'sent' || fu.status === 'delivered' || fu.status === 'cancelled') && (
                          <span className="text-xs text-ink-500">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Healing Issues Tab Content */}
      {activeTab === 'issues' && (
        <>
          {/* Filter controls */}
          <div className="flex items-center gap-4 mb-4 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-sm text-ink-400">Status:</label>
              <select
                value={issueStatusFilter}
                onChange={(e) => setIssueStatusFilter(e.target.value as HealingIssueStatus | '')}
                className="px-3 py-1.5 bg-ink-800 border border-ink-600 rounded-lg text-ink-100 text-sm focus:outline-none focus:border-accent-primary"
              >
                <option value="">All</option>
                <option value="reported">Reported</option>
                <option value="acknowledged">Acknowledged</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="escalated">Escalated</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-ink-400">Severity:</label>
              <select
                value={issueSeverityFilter}
                onChange={(e) => setIssueSeverityFilter(e.target.value as HealingIssueSeverity | '')}
                className="px-3 py-1.5 bg-ink-800 border border-ink-600 rounded-lg text-ink-100 text-sm focus:outline-none focus:border-accent-primary"
              >
                <option value="">All</option>
                <option value="minor">Minor</option>
                <option value="moderate">Moderate</option>
                <option value="concerning">Concerning</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          {/* Loading */}
          {loadingIssues && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-primary"></div>
            </div>
          )}

          {/* Empty state */}
          {!loadingIssues && healingIssues.length === 0 && (
            <div className="text-center py-12 bg-ink-800 rounded-xl border border-ink-700">
              <svg
                className="w-12 h-12 mx-auto text-ink-500 mb-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <h3 className="text-lg font-medium text-ink-200 mb-2">No Healing Issues</h3>
              <p className="text-ink-400">
                {issueStatusFilter || issueSeverityFilter
                  ? 'No issues match your filters'
                  : 'Clients can report healing concerns through their aftercare page.'}
              </p>
            </div>
          )}

          {/* Healing Issues List */}
          {healingIssues.length > 0 && (
            <div className="space-y-4">
              {healingIssues.map((issue) => (
                <div
                  key={issue.id}
                  onClick={() => handleViewIssue(issue)}
                  className="bg-ink-800 rounded-xl border border-ink-700 p-5 hover:border-ink-600 transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className={`text-xs px-2 py-1 rounded-full ${getHealingIssueSeverityColor(issue.severity)}`}>
                        {getHealingIssueSeverityLabel(issue.severity)}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded-full ${getHealingIssueStatusColor(issue.status)}`}>
                        {getHealingIssueStatusLabel(issue.status)}
                      </span>
                    </div>
                    <span className="text-xs text-ink-500">
                      {issue.days_since_appointment} days after appointment
                    </span>
                  </div>

                  <p className="text-ink-200 mb-3 line-clamp-2">{issue.description}</p>

                  {issue.symptoms.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {issue.symptoms.slice(0, 4).map((symptom) => (
                        <span key={symptom} className="text-xs bg-ink-700 text-ink-300 px-2 py-1 rounded">
                          {getSymptomLabel(symptom)}
                        </span>
                      ))}
                      {issue.symptoms.length > 4 && (
                        <span className="text-xs text-ink-500">+{issue.symptoms.length - 4} more</span>
                      )}
                    </div>
                  )}

                  <div className="text-xs text-ink-500">
                    Reported {new Date(issue.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Healing Issue Detail Modal */}
      {selectedIssue && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-ink-800 rounded-xl border border-ink-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-ink-700 sticky top-0 bg-ink-800">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`text-sm px-3 py-1 rounded-full ${getHealingIssueSeverityColor(selectedIssue.severity)}`}>
                      {getHealingIssueSeverityLabel(selectedIssue.severity)}
                    </span>
                    <span className={`text-sm px-3 py-1 rounded-full ${getHealingIssueStatusColor(selectedIssue.status)}`}>
                      {getHealingIssueStatusLabel(selectedIssue.status)}
                    </span>
                  </div>
                  <p className="text-ink-400 text-sm">
                    {selectedIssue.days_since_appointment} days after appointment
                  </p>
                </div>
                <button
                  onClick={() => setSelectedIssue(null)}
                  className="text-ink-400 hover:text-ink-200 p-1"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Description */}
              <div>
                <h3 className="text-sm font-medium text-ink-300 mb-2">Description</h3>
                <p className="text-ink-200 whitespace-pre-wrap">{selectedIssue.description}</p>
              </div>

              {/* Symptoms */}
              {selectedIssue.symptoms.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-ink-300 mb-2">Reported Symptoms</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedIssue.symptoms.map((symptom) => (
                      <span key={symptom} className="text-sm bg-ink-700 text-ink-200 px-3 py-1.5 rounded-lg">
                        {getSymptomLabel(symptom)}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Photos */}
              {selectedIssue.photo_urls.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-ink-300 mb-2">Photos</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {selectedIssue.photo_urls.map((url, i) => (
                      <img
                        key={i}
                        src={url}
                        alt={`Issue photo ${i + 1}`}
                        className="rounded-lg w-full h-40 object-cover"
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Staff Notes */}
              {selectedIssue.staff_notes && (
                <div>
                  <h3 className="text-sm font-medium text-ink-300 mb-2">Staff Notes</h3>
                  <p className="text-ink-400 whitespace-pre-wrap bg-ink-700/50 rounded-lg p-3">
                    {selectedIssue.staff_notes}
                  </p>
                </div>
              )}

              {/* Resolution Notes */}
              {selectedIssue.resolution_notes && (
                <div>
                  <h3 className="text-sm font-medium text-ink-300 mb-2">Resolution Notes</h3>
                  <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                    <p className="text-green-400 whitespace-pre-wrap">{selectedIssue.resolution_notes}</p>
                  </div>
                  {selectedIssue.touch_up_requested && (
                    <p className="text-sm text-yellow-400 mt-2">Touch-up recommended</p>
                  )}
                </div>
              )}

              {/* Timeline */}
              <div className="text-xs text-ink-500 space-y-1">
                <p>Reported: {new Date(selectedIssue.created_at).toLocaleString()}</p>
                {selectedIssue.responded_at && (
                  <p>Responded: {new Date(selectedIssue.responded_at).toLocaleString()}</p>
                )}
                {selectedIssue.resolved_at && (
                  <p>Resolved: {new Date(selectedIssue.resolved_at).toLocaleString()}</p>
                )}
              </div>
            </div>

            {/* Actions */}
            {canEdit && selectedIssue.status !== 'resolved' && (
              <div className="p-6 border-t border-ink-700 flex items-center justify-end gap-3">
                {selectedIssue.status === 'reported' && (
                  <button
                    onClick={() => setShowAcknowledgeModal(true)}
                    disabled={processingIssue === selectedIssue.id}
                    className="px-4 py-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors disabled:opacity-50"
                  >
                    Acknowledge
                  </button>
                )}
                <button
                  onClick={() => setShowResolveModal(true)}
                  disabled={processingIssue === selectedIssue.id}
                  className="px-4 py-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors disabled:opacity-50"
                >
                  Resolve Issue
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Acknowledge Modal */}
      {showAcknowledgeModal && selectedIssue && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
          <div className="bg-ink-800 rounded-xl border border-ink-700 max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-ink-100 mb-4">Acknowledge Issue</h2>
            <p className="text-ink-400 mb-4">
              This will notify the client that their concern has been received and is being reviewed.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-ink-300 mb-2">
                Initial Response (optional)
              </label>
              <textarea
                value={acknowledgeNotes}
                onChange={(e) => setAcknowledgeNotes(e.target.value)}
                className="w-full px-3 py-2 bg-ink-900 border border-ink-600 rounded-lg text-ink-100 focus:outline-none focus:border-accent-primary"
                rows={4}
                placeholder="Add a message to include in the acknowledgment email..."
              />
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowAcknowledgeModal(false);
                  setAcknowledgeNotes('');
                }}
                className="px-4 py-2 text-ink-300 hover:bg-ink-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAcknowledgeIssue}
                disabled={processingIssue === selectedIssue.id}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
              >
                {processingIssue === selectedIssue.id ? 'Sending...' : 'Send Acknowledgment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resolve Modal */}
      {showResolveModal && selectedIssue && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
          <div className="bg-ink-800 rounded-xl border border-ink-700 max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-ink-100 mb-4">Resolve Issue</h2>
            <p className="text-ink-400 mb-4">
              Provide resolution notes to close this issue. The client will be notified.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-ink-300 mb-2">
                Resolution Notes *
              </label>
              <textarea
                value={resolveNotes}
                onChange={(e) => setResolveNotes(e.target.value)}
                className="w-full px-3 py-2 bg-ink-900 border border-ink-600 rounded-lg text-ink-100 focus:outline-none focus:border-accent-primary"
                rows={4}
                placeholder="Explain the resolution and any advice for the client..."
              />
            </div>
            <label className="flex items-center gap-2 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={requestTouchUp}
                onChange={(e) => setRequestTouchUp(e.target.checked)}
                className="w-4 h-4 rounded border-ink-600 bg-ink-900 text-accent-primary focus:ring-accent-primary"
              />
              <span className="text-sm text-ink-300">Recommend touch-up session</span>
            </label>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowResolveModal(false);
                  setResolveNotes('');
                  setRequestTouchUp(false);
                }}
                className="px-4 py-2 text-ink-300 hover:bg-ink-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleResolveIssue}
                disabled={processingIssue === selectedIssue.id || !resolveNotes.trim()}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50"
              >
                {processingIssue === selectedIssue.id ? 'Resolving...' : 'Resolve Issue'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template Detail Modal */}
      {selectedTemplate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-ink-800 rounded-xl border border-ink-700 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-ink-700 sticky top-0 bg-ink-800">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-ink-100">{selectedTemplate.name}</h2>
                  <div className="flex items-center gap-2 mt-2">
                    {selectedTemplate.is_default && (
                      <span className="text-xs bg-accent-primary/20 text-accent-primary px-2 py-0.5 rounded-full">
                        Default
                      </span>
                    )}
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        selectedTemplate.is_active
                          ? 'bg-green-500/10 text-green-400'
                          : 'bg-ink-600 text-ink-400'
                      }`}
                    >
                      {selectedTemplate.is_active ? 'Active' : 'Inactive'}
                    </span>
                    {selectedTemplate.tattoo_type && (
                      <span className="text-xs bg-ink-700 text-ink-300 px-2 py-1 rounded">
                        {getTattooTypeLabel(selectedTemplate.tattoo_type)}
                      </span>
                    )}
                    {selectedTemplate.placement && (
                      <span className="text-xs bg-ink-700 text-ink-300 px-2 py-1 rounded">
                        {getPlacementLabel(selectedTemplate.placement)}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedTemplate(null)}
                  className="text-ink-400 hover:text-ink-200 p-1"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {selectedTemplate.description && (
                <div>
                  <h3 className="text-sm font-medium text-ink-300 mb-2">Description</h3>
                  <p className="text-ink-400">{selectedTemplate.description}</p>
                </div>
              )}

              {selectedTemplate.extra_data && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedTemplate.extra_data.key_points.length > 0 && (
                    <div className="bg-ink-700/50 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-ink-200 mb-2">Key Points</h4>
                      <ul className="space-y-1">
                        {selectedTemplate.extra_data.key_points.map((point, i) => (
                          <li key={i} className="text-sm text-ink-400 flex items-start gap-2">
                            <span className="text-accent-primary mt-0.5">•</span>
                            {point}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {selectedTemplate.extra_data.products_recommended.length > 0 && (
                    <div className="bg-ink-700/50 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-ink-200 mb-2">Recommended Products</h4>
                      <ul className="space-y-1">
                        {selectedTemplate.extra_data.products_recommended.map((product, i) => (
                          <li key={i} className="text-sm text-ink-400 flex items-start gap-2">
                            <span className="text-green-400 mt-0.5">✓</span>
                            {product}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {selectedTemplate.extra_data.products_to_avoid.length > 0 && (
                    <div className="bg-ink-700/50 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-ink-200 mb-2">Products to Avoid</h4>
                      <ul className="space-y-1">
                        {selectedTemplate.extra_data.products_to_avoid.map((product, i) => (
                          <li key={i} className="text-sm text-ink-400 flex items-start gap-2">
                            <span className="text-red-400 mt-0.5">✕</span>
                            {product}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {selectedTemplate.extra_data.warning_signs.length > 0 && (
                    <div className="bg-ink-700/50 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-ink-200 mb-2">Warning Signs</h4>
                      <ul className="space-y-1">
                        {selectedTemplate.extra_data.warning_signs.map((sign, i) => (
                          <li key={i} className="text-sm text-ink-400 flex items-start gap-2">
                            <span className="text-yellow-400 mt-0.5">⚠</span>
                            {sign}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <div>
                <h3 className="text-sm font-medium text-ink-300 mb-2">Instructions Preview</h3>
                <div
                  className="bg-ink-900 rounded-lg p-4 prose prose-invert prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: selectedTemplate.instructions_html }}
                />
              </div>
            </div>

            {canEdit && (
              <div className="p-6 border-t border-ink-700 flex items-center justify-end gap-3">
                {canDelete && (
                  <button
                    onClick={() => setShowDeleteModal(true)}
                    className="px-4 py-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    Delete
                  </button>
                )}
                <button
                  onClick={() => handleEditTemplate(selectedTemplate)}
                  className="px-4 py-2 bg-accent-primary text-ink-900 rounded-lg hover:bg-accent-primary/90 transition-colors font-medium"
                >
                  Edit Template
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pre-built Templates Modal */}
      {showPrebuiltModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-ink-800 rounded-xl border border-ink-700 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-ink-700">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-ink-100">Pre-built Templates</h2>
                <button
                  onClick={() => setShowPrebuiltModal(false)}
                  className="text-ink-400 hover:text-ink-200 p-1"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-ink-400 mt-1">
                Start with a professionally crafted aftercare template
              </p>
            </div>

            <div className="p-6">
              {loadingPrebuilt ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-primary"></div>
                </div>
              ) : (
                <div className="space-y-3">
                  {prebuiltTemplates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => handleSelectPrebuilt(template.id)}
                      disabled={saving}
                      className="w-full text-left p-4 bg-ink-700/50 rounded-lg hover:bg-ink-700 transition-colors disabled:opacity-50"
                    >
                      <h3 className="font-medium text-ink-100">{template.name}</h3>
                      <p className="text-sm text-ink-400 mt-1">{template.description}</p>
                      <div className="flex gap-2 mt-2">
                        {template.tattoo_type && (
                          <span className="text-xs bg-ink-600 text-ink-300 px-2 py-0.5 rounded">
                            {getTattooTypeLabel(template.tattoo_type)}
                          </span>
                        )}
                        {template.placement && (
                          <span className="text-xs bg-ink-600 text-ink-300 px-2 py-0.5 rounded">
                            {getPlacementLabel(template.placement)}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Template Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-ink-800 rounded-xl border border-ink-700 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-ink-700">
              <h2 className="text-xl font-bold text-ink-100">
                {editingId ? 'Edit Template' : 'New Template'}
              </h2>
            </div>

            <div className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-ink-300 mb-2">
                    Template Name *
                  </label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-3 py-2 bg-ink-900 border border-ink-600 rounded-lg text-ink-100 focus:outline-none focus:border-accent-primary"
                    placeholder="e.g., Standard Aftercare"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink-300 mb-2">
                    Description
                  </label>
                  <input
                    type="text"
                    value={editForm.description || ''}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    className="w-full px-3 py-2 bg-ink-900 border border-ink-600 rounded-lg text-ink-100 focus:outline-none focus:border-accent-primary"
                    placeholder="Brief description of when to use this template"
                  />
                </div>
              </div>

              {/* Categorization */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-ink-300 mb-2">
                    Tattoo Type (optional)
                  </label>
                  <select
                    value={editForm.tattoo_type || ''}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        tattoo_type: e.target.value ? (e.target.value as TattooType) : null,
                      })
                    }
                    className="w-full px-3 py-2 bg-ink-900 border border-ink-600 rounded-lg text-ink-100 focus:outline-none focus:border-accent-primary"
                  >
                    <option value="">Any type</option>
                    {TATTOO_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {getTattooTypeLabel(type)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink-300 mb-2">
                    Body Placement (optional)
                  </label>
                  <select
                    value={editForm.placement || ''}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        placement: e.target.value ? (e.target.value as TattooPlacement) : null,
                      })
                    }
                    className="w-full px-3 py-2 bg-ink-900 border border-ink-600 rounded-lg text-ink-100 focus:outline-none focus:border-accent-primary"
                  >
                    <option value="">Any placement</option>
                    {PLACEMENTS.map((p) => (
                      <option key={p} value={p}>
                        {getPlacementLabel(p)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Settings */}
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editForm.is_active}
                    onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                    className="w-4 h-4 rounded border-ink-600 bg-ink-900 text-accent-primary focus:ring-accent-primary"
                  />
                  <span className="text-sm text-ink-300">Active</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editForm.is_default}
                    onChange={(e) => setEditForm({ ...editForm, is_default: e.target.checked })}
                    className="w-4 h-4 rounded border-ink-600 bg-ink-900 text-accent-primary focus:ring-accent-primary"
                  />
                  <span className="text-sm text-ink-300">Set as default template</span>
                </label>
              </div>

              {/* Instructions - HTML */}
              <div>
                <label className="block text-sm font-medium text-ink-300 mb-2">
                  Instructions (HTML) *
                </label>
                <textarea
                  value={editForm.instructions_html}
                  onChange={(e) => setEditForm({ ...editForm, instructions_html: e.target.value })}
                  className="w-full px-3 py-2 bg-ink-900 border border-ink-600 rounded-lg text-ink-100 focus:outline-none focus:border-accent-primary font-mono text-sm"
                  rows={10}
                  placeholder="<h2>Aftercare Instructions</h2>..."
                />
              </div>

              {/* Instructions - Plain Text */}
              <div>
                <label className="block text-sm font-medium text-ink-300 mb-2">
                  Instructions (Plain Text) *
                </label>
                <textarea
                  value={editForm.instructions_plain}
                  onChange={(e) => setEditForm({ ...editForm, instructions_plain: e.target.value })}
                  className="w-full px-3 py-2 bg-ink-900 border border-ink-600 rounded-lg text-ink-100 focus:outline-none focus:border-accent-primary"
                  rows={8}
                  placeholder="AFTERCARE INSTRUCTIONS..."
                />
              </div>
            </div>

            <div className="p-6 border-t border-ink-700 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowTemplateModal(false)}
                className="px-4 py-2 text-ink-300 hover:bg-ink-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTemplate}
                disabled={saving}
                className="px-4 py-2 bg-accent-primary text-ink-900 rounded-lg hover:bg-accent-primary/90 transition-colors font-medium disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Template'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedTemplate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-ink-800 rounded-xl border border-ink-700 max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-ink-100 mb-4">Delete Template?</h2>
            <p className="text-ink-400 mb-6">
              Are you sure you want to delete "{selectedTemplate.name}"? This action cannot be
              undone.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-ink-300 hover:bg-ink-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteTemplate}
                disabled={saving}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium disabled:opacity-50"
              >
                {saving ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
