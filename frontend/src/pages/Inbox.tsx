/**
 * Inbox page for unified messaging.
 */

import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import {
  listConversations,
  getConversation,
  updateConversation,
  sendMessage,
  markConversationRead,
  createConversation,
  getInboxStats,
  getTeamMembers,
  assignConversation,
  listReplyTemplates,
  createReplyTemplate,
  updateReplyTemplate,
  deleteReplyTemplate,
  useReplyTemplate,
} from '../services/messages';
import type {
  ConversationWithBooking,
  ConversationStatus,
  ConversationSummary,
  InboxStats,
  MessageChannel,
  TeamMember,
  ReplyTemplate,
  ReplyTemplateCreate,
} from '../types/api';

// Status configuration for badges and labels
const STATUS_CONFIG: Record<
  ConversationStatus,
  { label: string; color: string; bgColor: string }
> = {
  unread: { label: 'Unread', color: 'text-red-400', bgColor: 'bg-red-400/10' },
  pending: { label: 'Pending', color: 'text-yellow-400', bgColor: 'bg-yellow-400/10' },
  resolved: { label: 'Resolved', color: 'text-green-400', bgColor: 'bg-green-400/10' },
};

// Channel configuration for badges and icons
const CHANNEL_CONFIG: Record<
  MessageChannel,
  { label: string; icon: string; color: string; bgColor: string }
> = {
  internal: { label: 'Internal', icon: '💬', color: 'text-ink-400', bgColor: 'bg-ink-700' },
  email: { label: 'Email', icon: '📧', color: 'text-blue-400', bgColor: 'bg-blue-400/10' },
  sms: { label: 'SMS', icon: '📱', color: 'text-green-400', bgColor: 'bg-green-400/10' },
};

// Filter tabs for status
const STATUS_TABS: { value: ConversationStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'pending', label: 'Pending' },
  { value: 'resolved', label: 'Resolved' },
];

export function Inbox() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ConversationStatus | 'all'>('all');
  const [assignedToMe, setAssignedToMe] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState<InboxStats | null>(null);

  // Selected conversation
  const [selectedConversation, setSelectedConversation] = useState<ConversationWithBooking | null>(null);
  const [conversationLoading, setConversationLoading] = useState(false);

  // Team members for assignment
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [assigningTo, setAssigningTo] = useState(false);

  // New message form
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<MessageChannel>('internal');

  // New conversation modal
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [newConversationData, setNewConversationData] = useState({
    client_name: '',
    client_email: '',
    client_phone: '',
    subject: '',
    initial_message: '',
  });
  const [creatingConversation, setCreatingConversation] = useState(false);

  // Reply templates
  const [templates, setTemplates] = useState<ReplyTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ReplyTemplate | null>(null);
  const [templateFormData, setTemplateFormData] = useState<ReplyTemplateCreate>({
    name: '',
    content: '',
    category: '',
  });
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateSearch, setTemplateSearch] = useState('');

  // Load conversations
  useEffect(() => {
    async function loadConversations() {
      try {
        setLoading(true);
        setError(null);
        const params: {
          status?: ConversationStatus;
          assigned_to_me?: boolean;
          search?: string;
        } = {};
        if (statusFilter !== 'all') params.status = statusFilter;
        if (assignedToMe) params.assigned_to_me = true;
        if (searchQuery.trim()) params.search = searchQuery.trim();

        const [conversationsData, statsData] = await Promise.all([
          listConversations(params),
          getInboxStats(),
        ]);
        setConversations(conversationsData.conversations);
        setStats(statsData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load conversations');
      } finally {
        setLoading(false);
      }
    }

    loadConversations();
  }, [statusFilter, assignedToMe, searchQuery]);

  // Load team members for assignment dropdown
  useEffect(() => {
    async function loadTeamMembers() {
      try {
        const data = await getTeamMembers();
        setTeamMembers(data.members);
      } catch (err) {
        console.error('Failed to load team members:', err);
      }
    }
    loadTeamMembers();
  }, []);

  // Load reply templates
  useEffect(() => {
    async function loadTemplates() {
      if (!showTemplates) return;
      try {
        setTemplatesLoading(true);
        const data = await listReplyTemplates({
          search: templateSearch || undefined,
        });
        setTemplates(data.templates);
      } catch (err) {
        console.error('Failed to load templates:', err);
      } finally {
        setTemplatesLoading(false);
      }
    }
    loadTemplates();
  }, [showTemplates, templateSearch]);

  // Load selected conversation
  async function loadConversation(id: string) {
    try {
      setConversationLoading(true);
      const conversation = await getConversation(id);
      setSelectedConversation(conversation);

      // Mark as read if there are unread messages
      if (conversation.unread_count > 0) {
        await markConversationRead(id);
        // Update stats
        const newStats = await getInboxStats();
        setStats(newStats);
        // Update conversation in list
        setConversations((prev) =>
          prev.map((c) => (c.id === id ? { ...c, unread_count: 0 } : c))
        );
      }
    } catch (err) {
      console.error('Failed to load conversation:', err);
    } finally {
      setConversationLoading(false);
    }
  }

  // Send a message
  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedConversation || !newMessage.trim()) return;

    try {
      setSendingMessage(true);
      const message = await sendMessage(selectedConversation.id, {
        content: newMessage,
        channel: selectedChannel,
      });

      // Add message to conversation
      setSelectedConversation((prev) =>
        prev ? { ...prev, messages: [...prev.messages, message] } : null
      );

      // Update conversation in list
      setConversations((prev) =>
        prev.map((c) =>
          c.id === selectedConversation.id
            ? {
                ...c,
                last_message_at: message.created_at,
                last_message_preview: message.content.slice(0, 200),
              }
            : c
        )
      );

      setNewMessage('');
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSendingMessage(false);
    }
  }

  // Change conversation status
  async function handleStatusChange(status: ConversationStatus) {
    if (!selectedConversation) return;

    try {
      await updateConversation(selectedConversation.id, { status });
      setSelectedConversation((prev) => (prev ? { ...prev, status } : null));
      setConversations((prev) =>
        prev.map((c) => (c.id === selectedConversation.id ? { ...c, status } : c))
      );
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  }

  // Change conversation assignment
  async function handleAssignmentChange(assigneeId: string | null) {
    if (!selectedConversation) return;

    try {
      setAssigningTo(true);
      const result = await assignConversation(selectedConversation.id, assigneeId);

      // Update selected conversation
      setSelectedConversation((prev) =>
        prev
          ? {
              ...prev,
              assigned_to_id: result.assigned_to_id,
              assigned_to_name: result.assigned_to_name,
            }
          : null
      );

      // Update conversation in list
      setConversations((prev) =>
        prev.map((c) =>
          c.id === selectedConversation.id
            ? {
                ...c,
                assigned_to_id: result.assigned_to_id,
                assigned_to_name: result.assigned_to_name,
              }
            : c
        )
      );
    } catch (err) {
      console.error('Failed to assign conversation:', err);
    } finally {
      setAssigningTo(false);
    }
  }

  // Create new conversation
  async function handleCreateConversation(e: React.FormEvent) {
    e.preventDefault();
    if (!newConversationData.client_name.trim()) return;

    try {
      setCreatingConversation(true);
      const conversation = await createConversation({
        client_name: newConversationData.client_name,
        client_email: newConversationData.client_email || undefined,
        client_phone: newConversationData.client_phone || undefined,
        subject: newConversationData.subject || undefined,
        initial_message: newConversationData.initial_message || undefined,
      });

      // Add to list and select it
      setConversations((prev) => [conversation, ...prev]);
      // Extend with booking: null for type compatibility
      setSelectedConversation({ ...conversation, booking: null });
      setShowNewConversation(false);
      setNewConversationData({
        client_name: '',
        client_email: '',
        client_phone: '',
        subject: '',
        initial_message: '',
      });
    } catch (err) {
      console.error('Failed to create conversation:', err);
    } finally {
      setCreatingConversation(false);
    }
  }

  // Insert template content into message
  async function handleInsertTemplate(template: ReplyTemplate) {
    try {
      // Mark template as used (updates use count)
      await useReplyTemplate(template.id);

      // Insert content into message
      setNewMessage((prev) => (prev ? prev + '\n\n' + template.content : template.content));
      setShowTemplates(false);

      // Update local template list to reflect new use count
      setTemplates((prev) =>
        prev.map((t) =>
          t.id === template.id
            ? { ...t, use_count: t.use_count + 1, last_used_at: new Date().toISOString() }
            : t
        )
      );
    } catch (err) {
      console.error('Failed to use template:', err);
    }
  }

  // Save template (create or update)
  async function handleSaveTemplate(e: React.FormEvent) {
    e.preventDefault();
    if (!templateFormData.name.trim() || !templateFormData.content.trim()) return;

    try {
      setSavingTemplate(true);

      if (editingTemplate) {
        // Update existing template
        const updated = await updateReplyTemplate(editingTemplate.id, {
          name: templateFormData.name,
          content: templateFormData.content,
          category: templateFormData.category || null,
        });
        setTemplates((prev) =>
          prev.map((t) => (t.id === updated.id ? updated : t))
        );
      } else {
        // Create new template
        const created = await createReplyTemplate({
          name: templateFormData.name,
          content: templateFormData.content,
          category: templateFormData.category || undefined,
        });
        setTemplates((prev) => [created, ...prev]);
      }

      // Reset form and close modal
      setShowTemplateModal(false);
      setEditingTemplate(null);
      setTemplateFormData({ name: '', content: '', category: '' });
    } catch (err) {
      console.error('Failed to save template:', err);
    } finally {
      setSavingTemplate(false);
    }
  }

  // Delete template
  async function handleDeleteTemplate(template: ReplyTemplate) {
    if (!confirm(`Delete template "${template.name}"?`)) return;

    try {
      await deleteReplyTemplate(template.id);
      setTemplates((prev) => prev.filter((t) => t.id !== template.id));
    } catch (err) {
      console.error('Failed to delete template:', err);
    }
  }

  // Open edit template modal
  function openEditTemplate(template: ReplyTemplate) {
    setEditingTemplate(template);
    setTemplateFormData({
      name: template.name,
      content: template.content,
      category: template.category || '',
    });
    setShowTemplateModal(true);
  }

  // Open new template modal
  function openNewTemplate() {
    setEditingTemplate(null);
    setTemplateFormData({ name: '', content: '', category: '' });
    setShowTemplateModal(true);
  }

  // Format relative time
  function formatTime(dateString: string | null) {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  // Access check
  if (!user || !['owner', 'artist', 'receptionist'].includes(user.role)) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold text-red-400 mb-2">Access Denied</h1>
        <p className="text-ink-400">You do not have permission to view the inbox.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-ink-700">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Inbox</h1>
            <p className="text-ink-400 text-sm">
              {stats
                ? `${stats.total_unread} unread · ${stats.total_conversations} total`
                : 'Loading...'}
            </p>
          </div>
          <button
            onClick={() => setShowNewConversation(true)}
            className="px-4 py-2 bg-accent-500 hover:bg-accent-600 rounded-lg font-medium transition-colors"
          >
            New Conversation
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4">
          <div className="flex gap-1 bg-ink-800 rounded-lg p-1">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  statusFilter === tab.value
                    ? 'bg-ink-700 text-white'
                    : 'text-ink-400 hover:text-white'
                }`}
              >
                {tab.label}
                {tab.value !== 'all' && stats && (
                  <span className="ml-1.5 text-xs text-ink-500">
                    {stats.status_counts[tab.value] || 0}
                  </span>
                )}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 text-sm text-ink-400 cursor-pointer">
            <input
              type="checkbox"
              checked={assignedToMe}
              onChange={(e) => setAssignedToMe(e.target.checked)}
              className="w-4 h-4 rounded border-ink-600 bg-ink-800 text-accent-500 focus:ring-accent-500"
            />
            Assigned to me
          </label>

          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 max-w-xs px-3 py-1.5 bg-ink-800 border border-ink-700 rounded-lg text-sm placeholder-ink-500 focus:outline-none focus:border-accent-500"
          />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Conversation list */}
        <div className="w-80 border-r border-ink-700 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-ink-400">Loading...</div>
          ) : error ? (
            <div className="p-4 text-center text-red-400">{error}</div>
          ) : conversations.length === 0 ? (
            <div className="p-4 text-center text-ink-400">
              No conversations found
            </div>
          ) : (
            <div className="divide-y divide-ink-700/50">
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => loadConversation(conv.id)}
                  className={`w-full p-4 text-left hover:bg-ink-800 transition-colors ${
                    selectedConversation?.id === conv.id ? 'bg-ink-800' : ''
                  }`}
                >
                  <div className="flex items-start justify-between mb-1">
                    <span className="font-medium truncate">{conv.client_name}</span>
                    <span className="text-xs text-ink-500 flex-shrink-0 ml-2">
                      {formatTime(conv.last_message_at)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded ${
                        STATUS_CONFIG[conv.status].bgColor
                      } ${STATUS_CONFIG[conv.status].color}`}
                    >
                      {STATUS_CONFIG[conv.status].label}
                    </span>
                    {conv.unread_count > 0 && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-500 text-white font-medium">
                        {conv.unread_count}
                      </span>
                    )}
                    {conv.assigned_to_name && (
                      <span className="text-xs text-ink-500" title={`Assigned to ${conv.assigned_to_name}`}>
                        → {conv.assigned_to_name.split(' ')[0]}
                      </span>
                    )}
                  </div>
                  {conv.subject && (
                    <p className="text-sm text-ink-300 truncate">{conv.subject}</p>
                  )}
                  {conv.last_message_preview && (
                    <p className="text-sm text-ink-500 truncate">
                      {conv.last_message_preview}
                    </p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Conversation detail */}
        <div className="flex-1 flex flex-col">
          {conversationLoading ? (
            <div className="flex-1 flex items-center justify-center text-ink-400">
              Loading conversation...
            </div>
          ) : selectedConversation ? (
            <>
              {/* Conversation header */}
              <div className="px-6 py-4 border-b border-ink-700 bg-ink-800/50">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">
                      {selectedConversation.client_name}
                    </h2>
                    <div className="flex items-center gap-3 text-sm text-ink-400">
                      {selectedConversation.client_email && (
                        <span>{selectedConversation.client_email}</span>
                      )}
                      {selectedConversation.client_phone && (
                        <span>{selectedConversation.client_phone}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Assignment dropdown */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-ink-500">Assigned to:</span>
                      <select
                        value={selectedConversation.assigned_to_id || ''}
                        onChange={(e) =>
                          handleAssignmentChange(e.target.value || null)
                        }
                        disabled={assigningTo}
                        className="px-3 py-1.5 bg-ink-700 border border-ink-600 rounded-lg text-sm focus:outline-none focus:border-accent-500 disabled:opacity-50"
                      >
                        <option value="">Unassigned</option>
                        {teamMembers.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.full_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Status dropdown */}
                    <select
                      value={selectedConversation.status}
                      onChange={(e) =>
                        handleStatusChange(e.target.value as ConversationStatus)
                      }
                      className="px-3 py-1.5 bg-ink-700 border border-ink-600 rounded-lg text-sm focus:outline-none focus:border-accent-500"
                    >
                      <option value="unread">Unread</option>
                      <option value="pending">Pending</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </div>
                </div>
                {selectedConversation.subject && (
                  <p className="mt-2 text-ink-300">{selectedConversation.subject}</p>
                )}

                {/* Linked booking context */}
                {selectedConversation.booking && (
                  <div className="mt-3 p-3 bg-ink-700/50 rounded-lg border border-ink-600">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-accent-400">
                          Linked Booking
                        </span>
                        <span className="text-xs px-1.5 py-0.5 bg-ink-600 rounded text-ink-300">
                          {selectedConversation.booking.reference_id}
                        </span>
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded ${
                            selectedConversation.booking.status === 'confirmed'
                              ? 'bg-green-400/10 text-green-400'
                              : selectedConversation.booking.status === 'pending'
                              ? 'bg-yellow-400/10 text-yellow-400'
                              : 'bg-ink-600 text-ink-300'
                          }`}
                        >
                          {selectedConversation.booking.status}
                        </span>
                      </div>
                      {selectedConversation.booking.quoted_price && (
                        <span className="text-sm font-medium text-green-400">
                          ${selectedConversation.booking.quoted_price.toFixed(2)}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 text-sm text-ink-300">
                      {selectedConversation.booking.design_idea && (
                        <p className="truncate">
                          <span className="text-ink-500">Design:</span>{' '}
                          {selectedConversation.booking.design_idea}
                        </p>
                      )}
                      <div className="flex gap-4 text-xs text-ink-400 mt-1">
                        {selectedConversation.booking.placement && (
                          <span>Placement: {selectedConversation.booking.placement}</span>
                        )}
                        {selectedConversation.booking.size && (
                          <span>Size: {selectedConversation.booking.size}</span>
                        )}
                        {selectedConversation.booking.scheduled_date && (
                          <span>
                            Scheduled:{' '}
                            {new Date(
                              selectedConversation.booking.scheduled_date
                            ).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <a
                      href={`/bookings?view=${selectedConversation.booking.id}`}
                      className="mt-2 inline-block text-xs text-accent-400 hover:text-accent-300"
                    >
                      View Full Booking →
                    </a>
                  </div>
                )}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {selectedConversation.messages.length === 0 ? (
                  <div className="text-center text-ink-500 py-8">
                    No messages yet. Start the conversation below.
                  </div>
                ) : (
                  selectedConversation.messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${
                        message.direction === 'outbound'
                          ? 'justify-end'
                          : 'justify-start'
                      }`}
                    >
                      <div
                        className={`max-w-[70%] rounded-lg p-3 ${
                          message.direction === 'outbound'
                            ? 'bg-accent-500/20 text-white'
                            : 'bg-ink-700 text-ink-200'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{message.content}</p>
                        <div className="flex items-center justify-between mt-2 text-xs text-ink-500 gap-3">
                          <div className="flex items-center gap-2">
                            <span>
                              {message.sender_name ||
                                (message.direction === 'outbound' ? 'You' : 'Client')}
                            </span>
                            {/* Channel badge */}
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] ${
                                CHANNEL_CONFIG[message.channel].bgColor
                              } ${CHANNEL_CONFIG[message.channel].color}`}
                              title={CHANNEL_CONFIG[message.channel].label}
                            >
                              {CHANNEL_CONFIG[message.channel].icon}{' '}
                              {CHANNEL_CONFIG[message.channel].label}
                            </span>
                            {/* Delivery status for email and SMS */}
                            {(message.channel === 'email' || message.channel === 'sms') && message.direction === 'outbound' && (
                              <span className="text-[10px]">
                                {message.failed_at ? (
                                  <span className="text-red-400" title={message.failure_reason || 'Failed to send'}>
                                    ⚠️ Failed
                                  </span>
                                ) : message.delivered_at ? (
                                  <span className="text-green-400">✓ Sent</span>
                                ) : (
                                  <span className="text-yellow-400">⏳ Sending...</span>
                                )}
                              </span>
                            )}
                          </div>
                          <span>
                            {new Date(message.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Message input */}
              <form onSubmit={handleSendMessage} className="p-4 border-t border-ink-700">
                {/* Channel selector */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs text-ink-400">Send via:</span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setSelectedChannel('internal')}
                      className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                        selectedChannel === 'internal'
                          ? 'bg-ink-600 text-white'
                          : 'bg-ink-800 text-ink-400 hover:text-white'
                      }`}
                    >
                      💬 Internal
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedChannel('email')}
                      disabled={!selectedConversation.client_email}
                      className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                        selectedChannel === 'email'
                          ? 'bg-blue-600 text-white'
                          : selectedConversation.client_email
                          ? 'bg-ink-800 text-ink-400 hover:text-white'
                          : 'bg-ink-800 text-ink-600 cursor-not-allowed'
                      }`}
                      title={selectedConversation.client_email ? 'Send via email' : 'No email address'}
                    >
                      📧 Email
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedChannel('sms')}
                      disabled={!selectedConversation.client_phone}
                      className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                        selectedChannel === 'sms'
                          ? 'bg-green-600 text-white'
                          : selectedConversation.client_phone
                          ? 'bg-ink-800 text-ink-400 hover:text-white'
                          : 'bg-ink-800 text-ink-600 cursor-not-allowed'
                      }`}
                      title={selectedConversation.client_phone ? 'Send via SMS' : 'No phone number'}
                    >
                      📱 SMS
                    </button>
                  </div>
                  {selectedChannel === 'email' && selectedConversation.client_email && (
                    <span className="text-xs text-ink-500">
                      → {selectedConversation.client_email}
                    </span>
                  )}
                  {selectedChannel === 'sms' && selectedConversation.client_phone && (
                    <span className="text-xs text-ink-500">
                      → {selectedConversation.client_phone}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  {/* Templates button */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowTemplates(!showTemplates)}
                      className={`px-3 py-2 rounded-lg font-medium transition-colors ${
                        showTemplates
                          ? 'bg-purple-600 text-white'
                          : 'bg-ink-700 hover:bg-ink-600 text-ink-300'
                      }`}
                      title="Quick Reply Templates"
                    >
                      ⚡
                    </button>

                    {/* Templates dropdown */}
                    {showTemplates && (
                      <div className="absolute bottom-full left-0 mb-2 w-80 bg-ink-800 border border-ink-700 rounded-lg shadow-xl z-10 max-h-96 overflow-hidden flex flex-col">
                        <div className="p-3 border-b border-ink-700">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-sm">Quick Replies</span>
                            <button
                              type="button"
                              onClick={openNewTemplate}
                              className="text-xs px-2 py-1 bg-accent-500 hover:bg-accent-600 rounded transition-colors"
                            >
                              + New
                            </button>
                          </div>
                          <input
                            type="text"
                            placeholder="Search templates..."
                            value={templateSearch}
                            onChange={(e) => setTemplateSearch(e.target.value)}
                            className="w-full px-3 py-1.5 bg-ink-900 border border-ink-700 rounded text-sm focus:outline-none focus:border-accent-500"
                          />
                        </div>
                        <div className="flex-1 overflow-y-auto p-2">
                          {templatesLoading ? (
                            <div className="text-center py-4 text-ink-400 text-sm">
                              Loading...
                            </div>
                          ) : templates.length === 0 ? (
                            <div className="text-center py-4 text-ink-400 text-sm">
                              {templateSearch
                                ? 'No templates found'
                                : 'No templates yet. Create one!'}
                            </div>
                          ) : (
                            <div className="space-y-1">
                              {templates.map((template) => (
                                <div
                                  key={template.id}
                                  className="group p-2 rounded-lg hover:bg-ink-700 cursor-pointer transition-colors"
                                >
                                  <div className="flex items-start justify-between">
                                    <div
                                      className="flex-1"
                                      onClick={() => handleInsertTemplate(template)}
                                    >
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium text-sm">
                                          {template.name}
                                        </span>
                                        {template.category && (
                                          <span className="text-xs px-1.5 py-0.5 bg-ink-600 rounded text-ink-400">
                                            {template.category}
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-xs text-ink-400 mt-1 line-clamp-2">
                                        {template.content}
                                      </p>
                                      <span className="text-[10px] text-ink-500">
                                        Used {template.use_count} times
                                      </span>
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openEditTemplate(template);
                                        }}
                                        className="p-1 hover:bg-ink-600 rounded text-xs"
                                        title="Edit"
                                      >
                                        ✏️
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteTemplate(template);
                                        }}
                                        className="p-1 hover:bg-red-600/20 rounded text-xs"
                                        title="Delete"
                                      >
                                        🗑️
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <input
                    type="text"
                    placeholder={
                      selectedChannel === 'email'
                        ? 'Type your email message...'
                        : selectedChannel === 'sms'
                        ? 'Type your SMS message...'
                        : 'Type a message...'
                    }
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    className="flex-1 px-4 py-2 bg-ink-800 border border-ink-700 rounded-lg focus:outline-none focus:border-accent-500"
                    disabled={sendingMessage}
                  />
                  <button
                    type="submit"
                    disabled={sendingMessage || !newMessage.trim()}
                    className={`px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors ${
                      selectedChannel === 'email'
                        ? 'bg-blue-500 hover:bg-blue-600'
                        : selectedChannel === 'sms'
                        ? 'bg-green-500 hover:bg-green-600'
                        : 'bg-accent-500 hover:bg-accent-600'
                    }`}
                  >
                    {sendingMessage
                      ? 'Sending...'
                      : selectedChannel === 'email'
                      ? 'Send Email'
                      : selectedChannel === 'sms'
                      ? 'Send SMS'
                      : 'Send'}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-ink-400">
              <div className="text-center">
                <svg
                  className="w-16 h-16 mx-auto mb-4 text-ink-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
                <p>Select a conversation to view messages</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New Conversation Modal */}
      {showNewConversation && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-ink-800 rounded-xl shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-ink-700">
              <h2 className="text-xl font-semibold">New Conversation</h2>
            </div>
            <form onSubmit={handleCreateConversation} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink-300 mb-1">
                  Client Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={newConversationData.client_name}
                  onChange={(e) =>
                    setNewConversationData((prev) => ({
                      ...prev,
                      client_name: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 bg-ink-900 border border-ink-700 rounded-lg focus:outline-none focus:border-accent-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={newConversationData.client_email}
                  onChange={(e) =>
                    setNewConversationData((prev) => ({
                      ...prev,
                      client_email: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 bg-ink-900 border border-ink-700 rounded-lg focus:outline-none focus:border-accent-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-300 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  value={newConversationData.client_phone}
                  onChange={(e) =>
                    setNewConversationData((prev) => ({
                      ...prev,
                      client_phone: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 bg-ink-900 border border-ink-700 rounded-lg focus:outline-none focus:border-accent-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-300 mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  value={newConversationData.subject}
                  onChange={(e) =>
                    setNewConversationData((prev) => ({
                      ...prev,
                      subject: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 bg-ink-900 border border-ink-700 rounded-lg focus:outline-none focus:border-accent-500"
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-300 mb-1">
                  Initial Message
                </label>
                <textarea
                  value={newConversationData.initial_message}
                  onChange={(e) =>
                    setNewConversationData((prev) => ({
                      ...prev,
                      initial_message: e.target.value,
                    }))
                  }
                  rows={3}
                  className="w-full px-3 py-2 bg-ink-900 border border-ink-700 rounded-lg focus:outline-none focus:border-accent-500 resize-none"
                  placeholder="Start the conversation..."
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowNewConversation(false)}
                  className="flex-1 px-4 py-2 border border-ink-600 rounded-lg hover:bg-ink-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingConversation || !newConversationData.client_name.trim()}
                  className="flex-1 px-4 py-2 bg-accent-500 hover:bg-accent-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
                >
                  {creatingConversation ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Template Create/Edit Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-ink-800 rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-ink-700">
              <h2 className="text-xl font-semibold">
                {editingTemplate ? 'Edit Template' : 'New Template'}
              </h2>
            </div>
            <form onSubmit={handleSaveTemplate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink-300 mb-1">
                  Template Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={templateFormData.name}
                  onChange={(e) =>
                    setTemplateFormData((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                  placeholder="e.g., Booking Confirmation"
                  className="w-full px-3 py-2 bg-ink-900 border border-ink-700 rounded-lg focus:outline-none focus:border-accent-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-300 mb-1">
                  Category
                </label>
                <input
                  type="text"
                  value={templateFormData.category || ''}
                  onChange={(e) =>
                    setTemplateFormData((prev) => ({
                      ...prev,
                      category: e.target.value,
                    }))
                  }
                  placeholder="e.g., Booking, Aftercare, General"
                  className="w-full px-3 py-2 bg-ink-900 border border-ink-700 rounded-lg focus:outline-none focus:border-accent-500"
                />
                <p className="text-xs text-ink-500 mt-1">
                  Optional. Use categories to organize your templates.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-300 mb-1">
                  Content <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={templateFormData.content}
                  onChange={(e) =>
                    setTemplateFormData((prev) => ({
                      ...prev,
                      content: e.target.value,
                    }))
                  }
                  rows={6}
                  placeholder="Type your template message here..."
                  className="w-full px-3 py-2 bg-ink-900 border border-ink-700 rounded-lg focus:outline-none focus:border-accent-500 resize-none"
                  required
                />
                <p className="text-xs text-ink-500 mt-1">
                  Tip: Use placeholders like [CLIENT_NAME] for customization.
                </p>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowTemplateModal(false);
                    setEditingTemplate(null);
                    setTemplateFormData({ name: '', content: '', category: '' });
                  }}
                  className="flex-1 px-4 py-2 border border-ink-600 rounded-lg hover:bg-ink-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    savingTemplate ||
                    !templateFormData.name.trim() ||
                    !templateFormData.content.trim()
                  }
                  className="flex-1 px-4 py-2 bg-accent-500 hover:bg-accent-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
                >
                  {savingTemplate ? 'Saving...' : editingTemplate ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Inbox;
