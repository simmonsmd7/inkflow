/**
 * Booking queue page for artists and owners to manage booking requests.
 */

import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import {
  listBookingRequests,
  getBookingRequest,
  updateBookingRequest,
  sendDepositRequest,
  confirmBooking,
  rescheduleBooking,
  cancelBooking,
  markNoShow,
  issueRefund,
  cancelWithRefund,
} from '../services/bookings';
import type {
  BookingConfirmationResponse,
  BookingRequest,
  BookingRequestStatus,
  BookingRequestSummary,
  BookingRequestUpdate,
  CancelledBy,
  CancelResponse,
  CancelWithRefundResponse,
  NoShowResponse,
  RefundResponse,
  RefundType,
  RescheduleResponse,
  SendDepositRequestResponse,
} from '../types/api';
import { formatCurrency } from '../services/analytics';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Status configuration for badges and labels
const STATUS_CONFIG: Record<
  BookingRequestStatus,
  { label: string; color: string; bgColor: string }
> = {
  pending: { label: 'Pending', color: 'text-yellow-400', bgColor: 'bg-yellow-400/10' },
  reviewing: { label: 'Reviewing', color: 'text-blue-400', bgColor: 'bg-blue-400/10' },
  quoted: { label: 'Quoted', color: 'text-purple-400', bgColor: 'bg-purple-400/10' },
  deposit_requested: {
    label: 'Deposit Requested',
    color: 'text-orange-400',
    bgColor: 'bg-orange-400/10',
  },
  deposit_paid: { label: 'Deposit Paid', color: 'text-teal-400', bgColor: 'bg-teal-400/10' },
  confirmed: { label: 'Confirmed', color: 'text-green-400', bgColor: 'bg-green-400/10' },
  completed: { label: 'Completed', color: 'text-ink-400', bgColor: 'bg-ink-400/10' },
  no_show: { label: 'No-Show', color: 'text-amber-400', bgColor: 'bg-amber-400/10' },
  rejected: { label: 'Rejected', color: 'text-red-400', bgColor: 'bg-red-400/10' },
  cancelled: { label: 'Cancelled', color: 'text-ink-500', bgColor: 'bg-ink-500/10' },
};

// Size labels
const SIZE_LABELS: Record<string, string> = {
  tiny: 'Tiny (<1")',
  small: 'Small (1-3")',
  medium: 'Medium (3-6")',
  large: 'Large (6-10")',
  extra_large: 'Extra Large (10"+)',
  half_sleeve: 'Half Sleeve',
  full_sleeve: 'Full Sleeve',
  back_piece: 'Back Piece',
  full_body: 'Full Body',
};

// Filter tabs for status
const STATUS_TABS: { value: BookingRequestStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'reviewing', label: 'Reviewing' },
  { value: 'quoted', label: 'Quoted' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'completed', label: 'Completed' },
];

export function BookingQueue() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<BookingRequestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<BookingRequestStatus | 'all'>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modal state
  const [selectedRequest, setSelectedRequest] = useState<BookingRequest | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Quote form state
  const [quoteData, setQuoteData] = useState({
    quoted_price: '',
    estimated_hours: '',
    deposit_amount: '',
    quote_notes: '',
    internal_notes: '',
  });
  const [saving, setSaving] = useState(false);

  // Deposit request state
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositData, setDepositData] = useState({
    deposit_amount: '',
    expires_in_days: '7',
    message: '',
  });
  const [sendingDeposit, setSendingDeposit] = useState(false);
  const [depositSuccess, setDepositSuccess] = useState<SendDepositRequestResponse | null>(null);

  // Confirm booking state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmData, setConfirmData] = useState({
    scheduled_date: '',
    scheduled_time: '',
    scheduled_duration_hours: '',
    send_confirmation_email: true,
  });
  const [confirming, setConfirming] = useState(false);
  const [confirmSuccess, setConfirmSuccess] = useState<BookingConfirmationResponse | null>(null);

  // Reschedule state
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleData, setRescheduleData] = useState({
    new_date: '',
    new_time: '',
    new_duration_hours: '',
    reason: '',
    notify_client: true,
  });
  const [rescheduling, setRescheduling] = useState(false);
  const [rescheduleSuccess, setRescheduleSuccess] = useState<RescheduleResponse | null>(null);

  // Cancel booking state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelData, setCancelData] = useState({
    reason: '',
    cancelled_by: 'studio' as CancelledBy,
    forfeit_deposit: false,
    notify_client: true,
  });
  const [cancelling, setCancelling] = useState(false);
  const [cancelSuccess, setCancelSuccess] = useState<CancelResponse | null>(null);

  // No-show state
  const [showNoShowModal, setShowNoShowModal] = useState(false);
  const [noShowData, setNoShowData] = useState({
    notes: '',
    forfeit_deposit: true,
    notify_client: true,
  });
  const [markingNoShow, setMarkingNoShow] = useState(false);
  const [noShowSuccess, setNoShowSuccess] = useState<NoShowResponse | null>(null);

  // Refund state
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundData, setRefundData] = useState({
    refund_type: 'full' as RefundType,
    refund_amount: '',
    reason: '',
    notify_client: true,
  });
  const [issuingRefund, setIssuingRefund] = useState(false);
  const [refundSuccess, setRefundSuccess] = useState<RefundResponse | null>(null);

  // Cancel with refund state
  const [showCancelRefundModal, setShowCancelRefundModal] = useState(false);
  const [cancelRefundData, setCancelRefundData] = useState({
    reason: '',
    cancelled_by: 'studio' as CancelledBy,
    refund_type: 'full' as RefundType,
    refund_amount: '',
    notify_client: true,
  });
  const [cancellingWithRefund, setCancellingWithRefund] = useState(false);
  const [cancelRefundSuccess, setCancelRefundSuccess] = useState<CancelWithRefundResponse | null>(null);

  // Check if user has access
  const hasAccess = user && (user.role === 'artist' || user.role === 'owner');

  // Fetch requests - must be called before any conditional returns (React Rules of Hooks)
  useEffect(() => {
    if (hasAccess) {
      loadRequests();
    }
  }, [statusFilter, page, hasAccess]);

  // Auto-refresh polling for real-time status updates (e.g., when customer pays deposit)
  // Polls every 30 seconds to detect backend changes from webhooks
  useEffect(() => {
    if (!hasAccess) return;

    const pollInterval = setInterval(() => {
      // Only auto-refresh if not in a modal and there are pending deposit requests
      if (!selectedRequest) {
        loadRequests();
      }
    }, 30000); // 30 seconds

    return () => clearInterval(pollInterval);
  }, [hasAccess, selectedRequest]);

  // RBAC check - must be after all hooks
  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-ink-200 mb-2">Access Denied</h2>
          <p className="text-ink-400">Only artists and owners can view booking requests.</p>
        </div>
      </div>
    );
  }

  async function loadRequests() {
    setLoading(true);
    setError(null);
    try {
      const params: { page: number; per_page: number; status?: BookingRequestStatus } = {
        page,
        per_page: 20,
      };
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      const data = await listBookingRequests(params);
      setRequests(data.requests);
      setTotalPages(data.pages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load requests');
    } finally {
      setLoading(false);
    }
  }

  async function openRequestDetail(requestId: string) {
    setModalLoading(true);
    setModalError(null);
    try {
      const request = await getBookingRequest(requestId);
      setSelectedRequest(request);
      // Pre-fill quote form with existing values (convert cents to dollars for display)
      setQuoteData({
        quoted_price: request.quoted_price ? (request.quoted_price / 100).toFixed(2) : '',
        estimated_hours: request.estimated_hours?.toString() || '',
        deposit_amount: request.deposit_amount ? (request.deposit_amount / 100).toFixed(2) : '',
        quote_notes: request.quote_notes || '',
        internal_notes: request.internal_notes || '',
      });
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Failed to load request');
    } finally {
      setModalLoading(false);
    }
  }

  function closeModal() {
    setSelectedRequest(null);
    setModalError(null);
    setQuoteData({
      quoted_price: '',
      estimated_hours: '',
      deposit_amount: '',
      quote_notes: '',
      internal_notes: '',
    });
    setShowDepositModal(false);
    setDepositData({
      deposit_amount: '',
      expires_in_days: '7',
      message: '',
    });
    setDepositSuccess(null);
    setShowConfirmModal(false);
    setConfirmData({
      scheduled_date: '',
      scheduled_time: '',
      scheduled_duration_hours: '',
      send_confirmation_email: true,
    });
    setConfirmSuccess(null);
    setShowRescheduleModal(false);
    setRescheduleData({
      new_date: '',
      new_time: '',
      new_duration_hours: '',
      reason: '',
      notify_client: true,
    });
    setRescheduleSuccess(null);
    setShowCancelModal(false);
    setCancelData({
      reason: '',
      cancelled_by: 'studio',
      forfeit_deposit: false,
      notify_client: true,
    });
    setCancelSuccess(null);
    setShowNoShowModal(false);
    setNoShowData({
      notes: '',
      forfeit_deposit: true,
      notify_client: true,
    });
    setNoShowSuccess(null);
  }

  function openDepositModal() {
    if (!selectedRequest) return;
    // Pre-fill with deposit amount from quote form or existing amount
    const amount = quoteData.deposit_amount || selectedRequest.deposit_amount?.toString() || '';
    setDepositData({
      deposit_amount: amount,
      expires_in_days: '7',
      message: quoteData.quote_notes || '',
    });
    setShowDepositModal(true);
    setDepositSuccess(null);
  }

  async function handleSendDepositRequest() {
    if (!selectedRequest || !depositData.deposit_amount) return;
    setSendingDeposit(true);
    setModalError(null);
    try {
      // Convert dollars to cents
      const amountInCents = Math.round(parseFloat(depositData.deposit_amount) * 100);
      const response = await sendDepositRequest(selectedRequest.id, {
        deposit_amount: amountInCents,
        expires_in_days: parseInt(depositData.expires_in_days, 10),
        message: depositData.message || null,
      });
      setDepositSuccess(response);
      // Refresh the selected request
      const updated = await getBookingRequest(selectedRequest.id);
      setSelectedRequest(updated);
      loadRequests();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Failed to send deposit request');
    } finally {
      setSendingDeposit(false);
    }
  }

  function openConfirmModal() {
    if (!selectedRequest) return;
    // Pre-fill with estimated hours if available
    const hours = quoteData.estimated_hours || selectedRequest.estimated_hours?.toString() || '2';
    // Default to tomorrow at 10 AM
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];
    setConfirmData({
      scheduled_date: dateStr,
      scheduled_time: '10:00',
      scheduled_duration_hours: hours,
      send_confirmation_email: true,
    });
    setShowConfirmModal(true);
    setConfirmSuccess(null);
  }

  async function handleConfirmBooking() {
    if (!selectedRequest || !confirmData.scheduled_date || !confirmData.scheduled_time) return;
    setConfirming(true);
    setModalError(null);
    try {
      // Combine date and time into ISO string
      const scheduledDateTime = new Date(
        `${confirmData.scheduled_date}T${confirmData.scheduled_time}:00`
      ).toISOString();

      const response = await confirmBooking(selectedRequest.id, {
        scheduled_date: scheduledDateTime,
        scheduled_duration_hours: parseFloat(confirmData.scheduled_duration_hours),
        send_confirmation_email: confirmData.send_confirmation_email,
      });
      setConfirmSuccess(response);
      // Refresh the selected request
      const updated = await getBookingRequest(selectedRequest.id);
      setSelectedRequest(updated);
      loadRequests();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Failed to confirm booking');
    } finally {
      setConfirming(false);
    }
  }

  function openRescheduleModal() {
    if (!selectedRequest || !selectedRequest.scheduled_date) return;
    // Pre-fill with existing scheduled date/time
    const existingDate = new Date(selectedRequest.scheduled_date);
    const dateStr = existingDate.toISOString().split('T')[0];
    const timeStr = existingDate.toTimeString().slice(0, 5);
    const hours = selectedRequest.scheduled_duration_hours?.toString() || '2';
    setRescheduleData({
      new_date: dateStr,
      new_time: timeStr,
      new_duration_hours: hours,
      reason: '',
      notify_client: true,
    });
    setShowRescheduleModal(true);
    setRescheduleSuccess(null);
  }

  async function handleReschedule() {
    if (!selectedRequest || !rescheduleData.new_date || !rescheduleData.new_time) return;
    setRescheduling(true);
    setModalError(null);
    try {
      // Combine date and time into ISO string
      const newDateTime = new Date(
        `${rescheduleData.new_date}T${rescheduleData.new_time}:00`
      ).toISOString();

      const response = await rescheduleBooking(selectedRequest.id, {
        new_date: newDateTime,
        new_duration_hours: rescheduleData.new_duration_hours
          ? parseFloat(rescheduleData.new_duration_hours)
          : undefined,
        reason: rescheduleData.reason || undefined,
        notify_client: rescheduleData.notify_client,
      });
      setRescheduleSuccess(response);
      // Refresh the selected request
      const updated = await getBookingRequest(selectedRequest.id);
      setSelectedRequest(updated);
      loadRequests();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Failed to reschedule booking');
    } finally {
      setRescheduling(false);
    }
  }

  function openCancelModal() {
    if (!selectedRequest) return;
    setCancelData({
      reason: '',
      cancelled_by: 'studio',
      forfeit_deposit: false,
      notify_client: true,
    });
    setShowCancelModal(true);
    setCancelSuccess(null);
  }

  async function handleCancelBooking() {
    if (!selectedRequest) return;
    setCancelling(true);
    setModalError(null);
    try {
      const response = await cancelBooking(selectedRequest.id, {
        reason: cancelData.reason || undefined,
        cancelled_by: cancelData.cancelled_by,
        forfeit_deposit: cancelData.forfeit_deposit,
        notify_client: cancelData.notify_client,
      });
      setCancelSuccess(response);
      // Refresh the selected request
      const updated = await getBookingRequest(selectedRequest.id);
      setSelectedRequest(updated);
      loadRequests();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Failed to cancel booking');
    } finally {
      setCancelling(false);
    }
  }

  function openNoShowModal() {
    if (!selectedRequest) return;
    setNoShowData({
      notes: '',
      forfeit_deposit: true,
      notify_client: true,
    });
    setShowNoShowModal(true);
    setNoShowSuccess(null);
  }

  async function handleMarkNoShow() {
    if (!selectedRequest) return;
    setMarkingNoShow(true);
    setModalError(null);
    try {
      const response = await markNoShow(selectedRequest.id, {
        notes: noShowData.notes || undefined,
        forfeit_deposit: noShowData.forfeit_deposit,
        notify_client: noShowData.notify_client,
      });
      setNoShowSuccess(response);
      // Refresh the selected request
      const updated = await getBookingRequest(selectedRequest.id);
      setSelectedRequest(updated);
      loadRequests();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Failed to mark as no-show');
    } finally {
      setMarkingNoShow(false);
    }
  }

  // Refund modal handlers
  function openRefundModal() {
    if (!selectedRequest) return;
    setRefundData({
      refund_type: 'full',
      refund_amount: selectedRequest.deposit_amount
        ? (selectedRequest.deposit_amount / 100).toFixed(2)
        : '',
      reason: '',
      notify_client: true,
    });
    setShowRefundModal(true);
    setRefundSuccess(null);
  }

  async function handleIssueRefund() {
    if (!selectedRequest) return;
    setIssuingRefund(true);
    setModalError(null);
    try {
      const response = await issueRefund(selectedRequest.id, {
        refund_type: refundData.refund_type,
        refund_amount_cents:
          refundData.refund_type === 'partial' && refundData.refund_amount
            ? Math.round(parseFloat(refundData.refund_amount) * 100)
            : undefined,
        reason: refundData.reason || undefined,
        notify_client: refundData.notify_client,
      });
      setRefundSuccess(response);
      // Refresh the selected request
      const updated = await getBookingRequest(selectedRequest.id);
      setSelectedRequest(updated);
      loadRequests();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Failed to issue refund');
    } finally {
      setIssuingRefund(false);
    }
  }

  // Cancel with refund modal handlers
  function openCancelRefundModal() {
    if (!selectedRequest) return;
    setCancelRefundData({
      reason: '',
      cancelled_by: 'studio',
      refund_type: 'full',
      refund_amount: selectedRequest.deposit_amount
        ? (selectedRequest.deposit_amount / 100).toFixed(2)
        : '',
      notify_client: true,
    });
    setShowCancelRefundModal(true);
    setCancelRefundSuccess(null);
  }

  async function handleCancelWithRefund() {
    if (!selectedRequest) return;
    setCancellingWithRefund(true);
    setModalError(null);
    try {
      const response = await cancelWithRefund(selectedRequest.id, {
        reason: cancelRefundData.reason || undefined,
        cancelled_by: cancelRefundData.cancelled_by,
        refund_type: cancelRefundData.refund_type,
        refund_amount_cents:
          cancelRefundData.refund_type === 'partial' && cancelRefundData.refund_amount
            ? Math.round(parseFloat(cancelRefundData.refund_amount) * 100)
            : undefined,
        notify_client: cancelRefundData.notify_client,
      });
      setCancelRefundSuccess(response);
      // Refresh the selected request
      const updated = await getBookingRequest(selectedRequest.id);
      setSelectedRequest(updated);
      loadRequests();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Failed to cancel and refund');
    } finally {
      setCancellingWithRefund(false);
    }
  }

  // Helper to check if refund is possible
  function canIssueRefund(): boolean {
    if (!selectedRequest) return false;
    // Can only refund if:
    // - Status is cancelled or no_show
    // - Deposit was paid (has payment intent)
    // - No refund has been issued yet
    return (
      (selectedRequest.status === 'cancelled' || selectedRequest.status === 'no_show') &&
      !!selectedRequest.deposit_stripe_payment_intent_id &&
      !selectedRequest.refunded_at
    );
  }

  // Helper to check if cancel with refund is possible
  function canCancelWithRefund(): boolean {
    if (!selectedRequest) return false;
    // Can only cancel with refund if:
    // - Status is deposit_paid or confirmed
    // - Deposit was paid (has payment intent)
    return (
      (selectedRequest.status === 'deposit_paid' || selectedRequest.status === 'confirmed') &&
      !!selectedRequest.deposit_stripe_payment_intent_id
    );
  }

  async function handleStatusChange(newStatus: BookingRequestStatus) {
    if (!selectedRequest) return;
    setSaving(true);
    try {
      const updated = await updateBookingRequest(selectedRequest.id, { status: newStatus });
      setSelectedRequest(updated);
      loadRequests(); // Refresh list
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveQuote() {
    if (!selectedRequest) return;
    setSaving(true);
    try {
      const update: BookingRequestUpdate = {};
      if (quoteData.quoted_price) {
        // Convert dollars to cents for backend
        update.quoted_price = Math.round(parseFloat(quoteData.quoted_price) * 100);
      }
      if (quoteData.estimated_hours) {
        update.estimated_hours = parseFloat(quoteData.estimated_hours);
      }
      if (quoteData.deposit_amount) {
        // Convert dollars to cents for backend
        update.deposit_amount = Math.round(parseFloat(quoteData.deposit_amount) * 100);
      }
      update.quote_notes = quoteData.quote_notes || null;
      update.internal_notes = quoteData.internal_notes || null;

      // If we're adding a quote, change status to quoted
      if (update.quoted_price && selectedRequest.status === 'pending') {
        update.status = 'quoted';
      }

      const updated = await updateBookingRequest(selectedRequest.id, update);
      setSelectedRequest(updated);
      loadRequests();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Failed to save quote');
    } finally {
      setSaving(false);
    }
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink-100">Booking Requests</h1>
        <p className="text-ink-400 mt-1">Review and manage incoming booking requests</p>
      </div>

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => {
              setStatusFilter(tab.value);
              setPage(1);
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === tab.value
                ? 'bg-accent text-white'
                : 'bg-ink-800 text-ink-300 hover:bg-ink-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Error display */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-12 bg-ink-800 rounded-lg">
          <p className="text-ink-400">No booking requests found</p>
        </div>
      ) : (
        <>
          {/* Request cards */}
          <div className="grid gap-4">
            {requests.map((request) => {
              const statusConfig = STATUS_CONFIG[request.status];
              return (
                <div
                  key={request.id}
                  onClick={() => openRequestDetail(request.id)}
                  className="bg-ink-800 rounded-lg p-4 cursor-pointer hover:bg-ink-700 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-ink-100">{request.client_name}</h3>
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${statusConfig.color} ${statusConfig.bgColor}`}
                        >
                          {statusConfig.label}
                        </span>
                      </div>
                      <p className="text-ink-300 text-sm mb-2 line-clamp-2">
                        {request.design_idea}
                      </p>
                      <div className="flex flex-wrap gap-4 text-sm text-ink-400">
                        <span>{request.placement}</span>
                        <span>{SIZE_LABELS[request.size] || request.size}</span>
                        {request.reference_image_count > 0 && (
                          <span>{request.reference_image_count} reference image(s)</span>
                        )}
                        {request.quoted_price && (
                          <span className="text-green-400">{formatCurrency(request.quoted_price)}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right text-sm text-ink-500">
                      {formatDate(request.created_at)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 bg-ink-800 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-ink-700"
              >
                Previous
              </button>
              <span className="text-ink-400">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 bg-ink-800 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-ink-700"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {/* Request Detail Modal */}
      {(selectedRequest || modalLoading) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-ink-900 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            {modalLoading ? (
              <div className="p-8 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              </div>
            ) : selectedRequest ? (
              <>
                {/* Modal Header */}
                <div className="sticky top-0 bg-ink-900 border-b border-ink-700 p-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-ink-100">
                      {selectedRequest.client_name}
                    </h2>
                    <p className="text-ink-400 text-sm">{selectedRequest.client_email}</p>
                  </div>
                  <button
                    onClick={closeModal}
                    className="p-2 hover:bg-ink-800 rounded-lg transition-colors"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>

                {/* Modal Error */}
                {modalError && (
                  <div className="mx-4 mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                    {modalError}
                  </div>
                )}

                {/* Modal Body */}
                <div className="p-4 grid md:grid-cols-2 gap-6">
                  {/* Left Column - Request Details */}
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-sm font-medium text-ink-400 mb-2">Status</h3>
                      <div className="flex flex-wrap gap-2">
                        {(
                          [
                            'pending',
                            'reviewing',
                            'quoted',
                            'deposit_requested',
                            'deposit_paid',
                            'confirmed',
                            'completed',
                            'no_show',
                            'rejected',
                            'cancelled',
                          ] as BookingRequestStatus[]
                        ).map((status) => {
                          const config = STATUS_CONFIG[status];
                          return (
                            <button
                              key={status}
                              onClick={() => handleStatusChange(status)}
                              disabled={saving}
                              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                                selectedRequest.status === status
                                  ? `${config.color} ${config.bgColor} ring-1 ring-current`
                                  : 'bg-ink-800 text-ink-400 hover:bg-ink-700'
                              }`}
                            >
                              {config.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-medium text-ink-400 mb-2">Contact</h3>
                      <div className="space-y-1 text-ink-200">
                        <p>{selectedRequest.client_name}</p>
                        <p>{selectedRequest.client_email}</p>
                        {selectedRequest.client_phone && <p>{selectedRequest.client_phone}</p>}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-medium text-ink-400 mb-2">Design Idea</h3>
                      <p className="text-ink-200 whitespace-pre-wrap">
                        {selectedRequest.design_idea}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h3 className="text-sm font-medium text-ink-400 mb-1">Placement</h3>
                        <p className="text-ink-200">{selectedRequest.placement}</p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-ink-400 mb-1">Size</h3>
                        <p className="text-ink-200">
                          {SIZE_LABELS[selectedRequest.size] || selectedRequest.size}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h3 className="text-sm font-medium text-ink-400 mb-1">Cover-up?</h3>
                        <p className="text-ink-200">
                          {selectedRequest.is_cover_up ? 'Yes' : 'No'}
                        </p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-ink-400 mb-1">First Tattoo?</h3>
                        <p className="text-ink-200">
                          {selectedRequest.is_first_tattoo ? 'Yes' : 'No'}
                        </p>
                      </div>
                    </div>

                    {selectedRequest.color_preference && (
                      <div>
                        <h3 className="text-sm font-medium text-ink-400 mb-1">Color Preference</h3>
                        <p className="text-ink-200">{selectedRequest.color_preference}</p>
                      </div>
                    )}

                    {selectedRequest.budget_range && (
                      <div>
                        <h3 className="text-sm font-medium text-ink-400 mb-1">Budget Range</h3>
                        <p className="text-ink-200">{selectedRequest.budget_range}</p>
                      </div>
                    )}

                    {selectedRequest.preferred_dates && (
                      <div>
                        <h3 className="text-sm font-medium text-ink-400 mb-1">Preferred Dates</h3>
                        <p className="text-ink-200">{selectedRequest.preferred_dates}</p>
                      </div>
                    )}

                    {selectedRequest.additional_notes && (
                      <div>
                        <h3 className="text-sm font-medium text-ink-400 mb-1">Additional Notes</h3>
                        <p className="text-ink-200 whitespace-pre-wrap">
                          {selectedRequest.additional_notes}
                        </p>
                      </div>
                    )}

                    {/* Reference Images */}
                    {selectedRequest.reference_images.length > 0 && (
                      <div>
                        <h3 className="text-sm font-medium text-ink-400 mb-2">Reference Images</h3>
                        <div className="grid grid-cols-3 gap-2">
                          {selectedRequest.reference_images.map((img) => (
                            <a
                              key={img.id}
                              href={`${API_URL}${img.image_url}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block aspect-square bg-ink-800 rounded-lg overflow-hidden hover:opacity-80 transition-opacity"
                            >
                              <img
                                src={`${API_URL}${img.image_url}`}
                                alt={img.original_filename || 'Reference'}
                                className="w-full h-full object-cover"
                              />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Column - Quote Form */}
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-medium text-ink-100 mb-4">Quote Details</h3>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-ink-300 mb-1">
                            Quoted Price ($)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={quoteData.quoted_price}
                            onChange={(e) =>
                              setQuoteData((d) => ({ ...d, quoted_price: e.target.value }))
                            }
                            className="w-full px-3 py-2 bg-ink-800 border border-ink-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                            placeholder="250.00"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-ink-300 mb-1">
                            Estimated Hours
                          </label>
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            value={quoteData.estimated_hours}
                            onChange={(e) =>
                              setQuoteData((d) => ({ ...d, estimated_hours: e.target.value }))
                            }
                            className="w-full px-3 py-2 bg-ink-800 border border-ink-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                            placeholder="2.5"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-ink-300 mb-1">
                            Deposit Amount ($)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={quoteData.deposit_amount}
                            onChange={(e) =>
                              setQuoteData((d) => ({ ...d, deposit_amount: e.target.value }))
                            }
                            className="w-full px-3 py-2 bg-ink-800 border border-ink-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                            placeholder="50.00"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-ink-300 mb-1">
                            Quote Notes (visible to client)
                          </label>
                          <textarea
                            value={quoteData.quote_notes}
                            onChange={(e) =>
                              setQuoteData((d) => ({ ...d, quote_notes: e.target.value }))
                            }
                            rows={3}
                            className="w-full px-3 py-2 bg-ink-800 border border-ink-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                            placeholder="Add notes about the quote..."
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-ink-300 mb-1">
                            Internal Notes (private)
                          </label>
                          <textarea
                            value={quoteData.internal_notes}
                            onChange={(e) =>
                              setQuoteData((d) => ({ ...d, internal_notes: e.target.value }))
                            }
                            rows={3}
                            className="w-full px-3 py-2 bg-ink-800 border border-ink-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                            placeholder="Private notes about this request..."
                          />
                        </div>

                        <button
                          onClick={handleSaveQuote}
                          disabled={saving}
                          className="w-full py-2 bg-accent hover:bg-accent-dark text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {saving ? 'Saving...' : 'Save Quote'}
                        </button>

                        {/* STATE MACHINE BUTTON VISIBILITY:
                            - PENDING: Start Review (status change)
                            - REVIEWING: Send Quote or Reject
                            - QUOTED: Request Deposit or Cancel
                            - DEPOSIT_REQUESTED: Cancel (waiting for payment)
                            - DEPOSIT_PAID: Confirm Appointment or Cancel & Refund
                            - CONFIRMED: Mark Complete, Mark No-Show, Reschedule, or Cancel & Refund
                            - COMPLETED: No buttons (final state)
                            - NO_SHOW: Issue Refund (if deposit was paid)
                            - CANCELLED: Issue Refund (if deposit was paid)
                            - REJECTED: No buttons (final state)
                        */}

                        {/* PENDING: Start Review button */}
                        {selectedRequest.status === 'pending' && (
                          <button
                            onClick={() => handleStatusChange('reviewing')}
                            disabled={saving}
                            className="w-full py-2 mt-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                          >
                            {saving ? 'Starting...' : 'Start Review'}
                          </button>
                        )}

                        {/* REVIEWING: Send Deposit Request (only if quote exists) */}
                        {selectedRequest.status === 'reviewing' && selectedRequest.quoted_price && (
                          <button
                            onClick={openDepositModal}
                            className="w-full py-2 mt-2 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition-colors"
                          >
                            Send Deposit Request
                          </button>
                        )}

                        {/* QUOTED: Send Deposit Request */}
                        {selectedRequest.status === 'quoted' && (
                          <button
                            onClick={openDepositModal}
                            className="w-full py-2 mt-2 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition-colors"
                          >
                            Send Deposit Request
                          </button>
                        )}

                        {/* DEPOSIT_PAID: Confirm Appointment */}
                        {selectedRequest.status === 'deposit_paid' && (
                          <button
                            onClick={openConfirmModal}
                            className="w-full py-2 mt-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
                          >
                            Confirm Appointment
                          </button>
                        )}

                        {/* CONFIRMED: Reschedule, Mark No-Show, Mark Complete */}
                        {selectedRequest.status === 'confirmed' && (
                          <>
                            {selectedRequest.scheduled_date && (
                              <button
                                onClick={openRescheduleModal}
                                className="w-full py-2 mt-2 bg-sky-600 hover:bg-sky-700 text-white font-medium rounded-lg transition-colors"
                              >
                                Reschedule Appointment
                              </button>
                            )}
                            <button
                              onClick={openNoShowModal}
                              className="w-full py-2 mt-2 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg transition-colors"
                            >
                              Mark No-Show
                            </button>
                            <button
                              onClick={() => handleStatusChange('completed')}
                              disabled={saving}
                              className="w-full py-2 mt-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                            >
                              {saving ? 'Completing...' : 'Mark Complete'}
                            </button>
                          </>
                        )}

                        {/* Cancel & Refund button - for DEPOSIT_PAID or CONFIRMED with deposit */}
                        {canCancelWithRefund() && (
                          <button
                            onClick={openCancelRefundModal}
                            className="w-full py-2 mt-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
                          >
                            Cancel & Refund
                          </button>
                        )}

                        {/* Regular Cancel button - for statuses without deposit paid */}
                        {(selectedRequest.status === 'pending' ||
                          selectedRequest.status === 'reviewing' ||
                          selectedRequest.status === 'quoted' ||
                          selectedRequest.status === 'deposit_requested' ||
                          selectedRequest.status === 'rejected') &&
                          selectedRequest.status !== 'cancelled' && (
                            <button
                              onClick={openCancelModal}
                              className="w-full py-2 mt-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
                            >
                              Cancel Booking
                            </button>
                          )}

                        {/* Issue Refund button - for NO_SHOW or CANCELLED with deposit paid */}
                        {canIssueRefund() && (
                          <button
                            onClick={openRefundModal}
                            className="w-full py-2 mt-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
                          >
                            Issue Refund
                          </button>
                        )}

                        {/* Reject button - for REVIEWING status */}
                        {selectedRequest.status === 'reviewing' && (
                          <button
                            onClick={() => handleStatusChange('rejected')}
                            disabled={saving}
                            className="w-full py-2 mt-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                          >
                            {saving ? 'Rejecting...' : 'Reject Request'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Deposit Status */}
                    {selectedRequest.deposit_requested_at && (
                      <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                        <h4 className="text-sm font-medium text-orange-400 mb-2">
                          Deposit Requested
                        </h4>
                        <p className="text-ink-300 text-sm">
                          Sent on {formatDate(selectedRequest.deposit_requested_at)}
                        </p>
                        {selectedRequest.deposit_amount && (
                          <p className="text-orange-400 text-lg font-semibold mt-1">
                            ${(selectedRequest.deposit_amount / 100).toFixed(2)}
                          </p>
                        )}
                        {selectedRequest.deposit_request_expires_at && (
                          <p className="text-ink-400 text-sm mt-1">
                            Expires: {formatDate(selectedRequest.deposit_request_expires_at)}
                          </p>
                        )}
                        {selectedRequest.deposit_paid_at && (
                          <p className="text-green-400 text-sm mt-1">
                            ✓ Paid on {formatDate(selectedRequest.deposit_paid_at)}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Existing quote info */}
                    {selectedRequest.quoted_at && (
                      <div className="p-4 bg-ink-800 rounded-lg">
                        <h4 className="text-sm font-medium text-ink-400 mb-2">Quote History</h4>
                        <p className="text-ink-300 text-sm">
                          Quoted on {formatDate(selectedRequest.quoted_at)}
                        </p>
                        {selectedRequest.quoted_price && (
                          <p className="text-green-400 text-lg font-semibold mt-1">
                            {formatCurrency(selectedRequest.quoted_price)}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Timestamps */}
                    <div className="text-sm text-ink-500 space-y-1">
                      <p>Created: {formatDate(selectedRequest.created_at)}</p>
                      <p>Updated: {formatDate(selectedRequest.updated_at)}</p>
                    </div>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* Deposit Request Modal */}
      {showDepositModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-ink-900 rounded-lg w-full max-w-md">
            <div className="border-b border-ink-700 p-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-ink-100">Send Deposit Request</h2>
              <button
                onClick={() => setShowDepositModal(false)}
                className="p-2 hover:bg-ink-800 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="p-4">
              {depositSuccess ? (
                <div className="text-center">
                  <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg
                      className="w-8 h-8 text-green-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-ink-100 mb-2">
                    Deposit Request Sent!
                  </h3>
                  <p className="text-ink-400 mb-4">
                    An email has been sent to {selectedRequest.client_email} with a payment link.
                  </p>
                  <div className="bg-ink-800 rounded-lg p-3 text-left">
                    <p className="text-sm text-ink-400">Amount:</p>
                    <p className="text-lg font-semibold text-orange-400">
                      ${(depositSuccess.deposit_amount / 100).toFixed(2)}
                    </p>
                    <p className="text-sm text-ink-400 mt-2">Expires:</p>
                    <p className="text-ink-200">{formatDate(depositSuccess.expires_at)}</p>
                  </div>
                  <button
                    onClick={() => setShowDepositModal(false)}
                    className="mt-4 w-full py-2 bg-ink-700 hover:bg-ink-600 text-ink-200 font-medium rounded-lg transition-colors"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-ink-400 text-sm">
                    Send a deposit request email to{' '}
                    <span className="text-ink-200">{selectedRequest.client_name}</span> at{' '}
                    <span className="text-ink-200">{selectedRequest.client_email}</span>.
                  </p>

                  <div>
                    <label className="block text-sm font-medium text-ink-300 mb-1">
                      Deposit Amount ($) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      value={depositData.deposit_amount}
                      onChange={(e) =>
                        setDepositData((d) => ({ ...d, deposit_amount: e.target.value }))
                      }
                      className="w-full px-3 py-2 bg-ink-800 border border-ink-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                      placeholder="50.00"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-ink-300 mb-1">
                      Expires In (days)
                    </label>
                    <select
                      value={depositData.expires_in_days}
                      onChange={(e) =>
                        setDepositData((d) => ({ ...d, expires_in_days: e.target.value }))
                      }
                      className="w-full px-3 py-2 bg-ink-800 border border-ink-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                    >
                      <option value="3">3 days</option>
                      <option value="7">7 days</option>
                      <option value="14">14 days</option>
                      <option value="30">30 days</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-ink-300 mb-1">
                      Message to Client (optional)
                    </label>
                    <textarea
                      value={depositData.message}
                      onChange={(e) =>
                        setDepositData((d) => ({ ...d, message: e.target.value }))
                      }
                      rows={3}
                      className="w-full px-3 py-2 bg-ink-800 border border-ink-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                      placeholder="Add a personal message to the client..."
                    />
                  </div>

                  {selectedRequest.quoted_price && (
                    <div className="bg-ink-800 rounded-lg p-3">
                      <p className="text-sm text-ink-400">
                        Quoted Price:{' '}
                        <span className="text-green-400 font-medium">
                          {formatCurrency(selectedRequest.quoted_price)}
                        </span>
                      </p>
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setShowDepositModal(false)}
                      className="flex-1 py-2 bg-ink-700 hover:bg-ink-600 text-ink-200 font-medium rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSendDepositRequest}
                      disabled={sendingDeposit || !depositData.deposit_amount}
                      className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {sendingDeposit ? 'Sending...' : 'Send Request'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirm Booking Modal */}
      {showConfirmModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-ink-900 rounded-lg w-full max-w-md">
            <div className="border-b border-ink-700 p-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-ink-100">Confirm Appointment</h2>
              <button
                onClick={() => setShowConfirmModal(false)}
                className="p-2 hover:bg-ink-800 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="p-4">
              {confirmSuccess ? (
                <div className="text-center">
                  <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg
                      className="w-8 h-8 text-green-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-ink-100 mb-2">
                    Appointment Confirmed!
                  </h3>
                  <p className="text-ink-400 mb-4">
                    {confirmSuccess.confirmation_email_sent
                      ? `A confirmation email with a calendar invite has been sent to ${selectedRequest.client_email}.`
                      : 'The appointment has been confirmed.'}
                  </p>
                  <div className="bg-ink-800 rounded-lg p-3 text-left">
                    <p className="text-sm text-ink-400">Scheduled:</p>
                    <p className="text-lg font-semibold text-green-400">
                      {formatDate(confirmSuccess.scheduled_date)}
                    </p>
                    <p className="text-sm text-ink-400 mt-2">Duration:</p>
                    <p className="text-ink-200">
                      {confirmSuccess.scheduled_duration_hours} hour
                      {confirmSuccess.scheduled_duration_hours !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowConfirmModal(false)}
                    className="mt-4 w-full py-2 bg-ink-700 hover:bg-ink-600 text-ink-200 font-medium rounded-lg transition-colors"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-ink-400 text-sm">
                    Schedule and confirm the appointment for{' '}
                    <span className="text-ink-200">{selectedRequest.client_name}</span>. A
                    confirmation email with a calendar invite will be sent.
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-ink-300 mb-1">
                        Date *
                      </label>
                      <input
                        type="date"
                        value={confirmData.scheduled_date}
                        onChange={(e) =>
                          setConfirmData((d) => ({ ...d, scheduled_date: e.target.value }))
                        }
                        className="w-full px-3 py-2 bg-ink-800 border border-ink-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-ink-300 mb-1">
                        Time *
                      </label>
                      <input
                        type="time"
                        value={confirmData.scheduled_time}
                        onChange={(e) =>
                          setConfirmData((d) => ({ ...d, scheduled_time: e.target.value }))
                        }
                        className="w-full px-3 py-2 bg-ink-800 border border-ink-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-ink-300 mb-1">
                      Duration (hours) *
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      max="24"
                      value={confirmData.scheduled_duration_hours}
                      onChange={(e) =>
                        setConfirmData((d) => ({ ...d, scheduled_duration_hours: e.target.value }))
                      }
                      className="w-full px-3 py-2 bg-ink-800 border border-ink-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                      placeholder="2.0"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="send_confirmation_email"
                      checked={confirmData.send_confirmation_email}
                      onChange={(e) =>
                        setConfirmData((d) => ({
                          ...d,
                          send_confirmation_email: e.target.checked,
                        }))
                      }
                      className="w-4 h-4 rounded border-ink-700 bg-ink-800 text-accent focus:ring-accent"
                    />
                    <label
                      htmlFor="send_confirmation_email"
                      className="text-sm text-ink-300 cursor-pointer"
                    >
                      Send confirmation email with calendar invite
                    </label>
                  </div>

                  {selectedRequest.quoted_price && (
                    <div className="bg-ink-800 rounded-lg p-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-ink-400">Quoted Price:</span>
                        <span className="text-green-400 font-medium">
                          {formatCurrency(selectedRequest.quoted_price)}
                        </span>
                      </div>
                      {selectedRequest.deposit_amount && (
                        <div className="flex justify-between text-sm mt-1">
                          <span className="text-ink-400">Deposit Paid:</span>
                          <span className="text-teal-400 font-medium">
                            {formatCurrency(selectedRequest.deposit_amount)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setShowConfirmModal(false)}
                      className="flex-1 py-2 bg-ink-700 hover:bg-ink-600 text-ink-200 font-medium rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirmBooking}
                      disabled={
                        confirming ||
                        !confirmData.scheduled_date ||
                        !confirmData.scheduled_time ||
                        !confirmData.scheduled_duration_hours
                      }
                      className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {confirming ? 'Confirming...' : 'Confirm Appointment'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {showRescheduleModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-ink-900 rounded-lg w-full max-w-md">
            <div className="border-b border-ink-700 p-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-ink-100">Reschedule Appointment</h2>
              <button
                onClick={() => setShowRescheduleModal(false)}
                className="p-2 hover:bg-ink-800 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="p-4">
              {rescheduleSuccess ? (
                <div className="text-center">
                  <div className="w-16 h-16 bg-sky-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg
                      className="w-8 h-8 text-sky-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-ink-100 mb-2">
                    Appointment Rescheduled!
                  </h3>
                  <p className="text-ink-400 mb-4">
                    {rescheduleSuccess.notification_sent
                      ? `A notification email with an updated calendar invite has been sent to ${selectedRequest.client_email}.`
                      : 'The appointment has been rescheduled.'}
                  </p>
                  <div className="bg-ink-800 rounded-lg p-3 text-left">
                    <p className="text-sm text-ink-400">New Date:</p>
                    <p className="text-lg font-semibold text-sky-400">
                      {formatDate(rescheduleSuccess.new_date)}
                    </p>
                    <p className="text-sm text-ink-400 mt-2">Times Rescheduled:</p>
                    <p className="text-ink-200">{rescheduleSuccess.reschedule_count}</p>
                  </div>
                  <button
                    onClick={() => setShowRescheduleModal(false)}
                    className="mt-4 w-full py-2 bg-ink-700 hover:bg-ink-600 text-ink-200 font-medium rounded-lg transition-colors"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-ink-400 text-sm">
                    Reschedule the appointment for{' '}
                    <span className="text-ink-200">{selectedRequest.client_name}</span>. A
                    notification email with an updated calendar invite can be sent.
                  </p>

                  {selectedRequest.scheduled_date && (
                    <div className="bg-ink-800 rounded-lg p-3">
                      <p className="text-sm text-ink-400">Current Schedule:</p>
                      <p className="text-ink-200">{formatDate(selectedRequest.scheduled_date)}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-ink-300 mb-1">
                        New Date *
                      </label>
                      <input
                        type="date"
                        value={rescheduleData.new_date}
                        onChange={(e) =>
                          setRescheduleData((d) => ({ ...d, new_date: e.target.value }))
                        }
                        className="w-full px-3 py-2 bg-ink-800 border border-ink-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-ink-300 mb-1">
                        New Time *
                      </label>
                      <input
                        type="time"
                        value={rescheduleData.new_time}
                        onChange={(e) =>
                          setRescheduleData((d) => ({ ...d, new_time: e.target.value }))
                        }
                        className="w-full px-3 py-2 bg-ink-800 border border-ink-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-ink-300 mb-1">
                      Duration (hours)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      max="24"
                      value={rescheduleData.new_duration_hours}
                      onChange={(e) =>
                        setRescheduleData((d) => ({ ...d, new_duration_hours: e.target.value }))
                      }
                      className="w-full px-3 py-2 bg-ink-800 border border-ink-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                      placeholder="2.0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-ink-300 mb-1">
                      Reason for Reschedule (optional)
                    </label>
                    <textarea
                      value={rescheduleData.reason}
                      onChange={(e) =>
                        setRescheduleData((d) => ({ ...d, reason: e.target.value }))
                      }
                      rows={2}
                      className="w-full px-3 py-2 bg-ink-800 border border-ink-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                      placeholder="Reason for rescheduling..."
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="reschedule_notify_client"
                      checked={rescheduleData.notify_client}
                      onChange={(e) =>
                        setRescheduleData((d) => ({
                          ...d,
                          notify_client: e.target.checked,
                        }))
                      }
                      className="w-4 h-4 rounded border-ink-700 bg-ink-800 text-accent focus:ring-accent"
                    />
                    <label
                      htmlFor="reschedule_notify_client"
                      className="text-sm text-ink-300 cursor-pointer"
                    >
                      Send notification email with updated calendar invite
                    </label>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setShowRescheduleModal(false)}
                      className="flex-1 py-2 bg-ink-700 hover:bg-ink-600 text-ink-200 font-medium rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleReschedule}
                      disabled={
                        rescheduling || !rescheduleData.new_date || !rescheduleData.new_time
                      }
                      className="flex-1 py-2 bg-sky-600 hover:bg-sky-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {rescheduling ? 'Rescheduling...' : 'Reschedule'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cancel Booking Modal */}
      {showCancelModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-ink-900 rounded-lg w-full max-w-md">
            <div className="border-b border-ink-700 p-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-ink-100">Cancel Booking</h2>
              <button
                onClick={() => setShowCancelModal(false)}
                className="p-2 hover:bg-ink-800 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="p-4">
              {cancelSuccess ? (
                <div className="text-center">
                  <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg
                      className="w-8 h-8 text-red-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-ink-100 mb-2">Booking Cancelled</h3>
                  <p className="text-ink-400 mb-4">
                    {cancelSuccess.notification_sent
                      ? `A cancellation notification has been sent to ${selectedRequest.client_email}.`
                      : 'The booking has been cancelled.'}
                  </p>
                  {cancelSuccess.deposit_amount && cancelSuccess.deposit_amount > 0 && (
                    <div className="bg-ink-800 rounded-lg p-3 text-left">
                      <p className="text-sm text-ink-400">Deposit:</p>
                      <p
                        className={`text-lg font-semibold ${cancelSuccess.deposit_forfeited ? 'text-red-400' : 'text-green-400'}`}
                      >
                        ${(cancelSuccess.deposit_amount / 100).toFixed(2)}
                        {cancelSuccess.deposit_forfeited ? ' (Forfeited)' : ' (To be refunded)'}
                      </p>
                    </div>
                  )}
                  <button
                    onClick={() => {
                      setShowCancelModal(false);
                      closeModal();
                    }}
                    className="mt-4 w-full py-2 bg-ink-700 hover:bg-ink-600 text-ink-200 font-medium rounded-lg transition-colors"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                    <p className="text-red-400 text-sm">
                      Are you sure you want to cancel this booking? This action cannot be undone.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-ink-300 mb-1">
                      Cancelled By
                    </label>
                    <select
                      value={cancelData.cancelled_by}
                      onChange={(e) =>
                        setCancelData((d) => ({
                          ...d,
                          cancelled_by: e.target.value as CancelledBy,
                        }))
                      }
                      className="w-full px-3 py-2 bg-ink-800 border border-ink-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                    >
                      <option value="studio">Studio</option>
                      <option value="artist">Artist</option>
                      <option value="client">Client</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-ink-300 mb-1">
                      Reason (optional)
                    </label>
                    <textarea
                      value={cancelData.reason}
                      onChange={(e) => setCancelData((d) => ({ ...d, reason: e.target.value }))}
                      rows={2}
                      className="w-full px-3 py-2 bg-ink-800 border border-ink-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                      placeholder="Reason for cancellation..."
                    />
                  </div>

                  {selectedRequest.deposit_amount && selectedRequest.deposit_amount > 0 && (
                    <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3">
                      <p className="text-orange-400 text-sm mb-2">
                        This booking has a deposit of{' '}
                        <strong>${(selectedRequest.deposit_amount / 100).toFixed(2)}</strong>
                      </p>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="forfeit_deposit"
                          checked={cancelData.forfeit_deposit}
                          onChange={(e) =>
                            setCancelData((d) => ({
                              ...d,
                              forfeit_deposit: e.target.checked,
                            }))
                          }
                          className="w-4 h-4 rounded border-ink-700 bg-ink-800 text-red-500 focus:ring-red-500"
                        />
                        <label
                          htmlFor="forfeit_deposit"
                          className="text-sm text-orange-300 cursor-pointer"
                        >
                          Forfeit deposit (client will not receive refund)
                        </label>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="cancel_notify_client"
                      checked={cancelData.notify_client}
                      onChange={(e) =>
                        setCancelData((d) => ({
                          ...d,
                          notify_client: e.target.checked,
                        }))
                      }
                      className="w-4 h-4 rounded border-ink-700 bg-ink-800 text-accent focus:ring-accent"
                    />
                    <label
                      htmlFor="cancel_notify_client"
                      className="text-sm text-ink-300 cursor-pointer"
                    >
                      Send cancellation notification email
                    </label>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setShowCancelModal(false)}
                      className="flex-1 py-2 bg-ink-700 hover:bg-ink-600 text-ink-200 font-medium rounded-lg transition-colors"
                    >
                      Keep Booking
                    </button>
                    <button
                      onClick={handleCancelBooking}
                      disabled={cancelling}
                      className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {cancelling ? 'Cancelling...' : 'Cancel Booking'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* No-Show Modal */}
      {showNoShowModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-ink-900 rounded-lg w-full max-w-md">
            <div className="border-b border-ink-700 p-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-ink-100">Mark as No-Show</h2>
              <button
                onClick={() => setShowNoShowModal(false)}
                className="p-2 hover:bg-ink-800 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="p-4">
              {noShowSuccess ? (
                <div className="text-center">
                  <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg
                      className="w-8 h-8 text-amber-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-ink-100 mb-2">Marked as No-Show</h3>
                  <p className="text-ink-400 mb-4">
                    {noShowSuccess.notification_sent
                      ? `A no-show notification has been sent to ${selectedRequest.client_email}.`
                      : 'The booking has been marked as a no-show.'}
                  </p>
                  {noShowSuccess.deposit_amount && noShowSuccess.deposit_amount > 0 && (
                    <div className="bg-ink-800 rounded-lg p-3 text-left">
                      <p className="text-sm text-ink-400">Deposit:</p>
                      <p
                        className={`text-lg font-semibold ${noShowSuccess.deposit_forfeited ? 'text-amber-400' : 'text-green-400'}`}
                      >
                        ${(noShowSuccess.deposit_amount / 100).toFixed(2)}
                        {noShowSuccess.deposit_forfeited ? ' (Forfeited)' : ' (To be refunded)'}
                      </p>
                    </div>
                  )}
                  <button
                    onClick={() => {
                      setShowNoShowModal(false);
                      closeModal();
                    }}
                    className="mt-4 w-full py-2 bg-ink-700 hover:bg-ink-600 text-ink-200 font-medium rounded-lg transition-colors"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                    <p className="text-amber-400 text-sm">
                      Mark this booking as a no-show? The client did not arrive for their scheduled
                      appointment.
                    </p>
                  </div>

                  {selectedRequest.scheduled_date && (
                    <div className="bg-ink-800 rounded-lg p-3">
                      <p className="text-sm text-ink-400">Scheduled Date:</p>
                      <p className="text-ink-200">{formatDate(selectedRequest.scheduled_date)}</p>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-ink-300 mb-1">
                      Notes (optional)
                    </label>
                    <textarea
                      value={noShowData.notes}
                      onChange={(e) => setNoShowData((d) => ({ ...d, notes: e.target.value }))}
                      rows={2}
                      className="w-full px-3 py-2 bg-ink-800 border border-ink-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                      placeholder="Any additional notes about the no-show..."
                    />
                  </div>

                  {selectedRequest.deposit_amount && selectedRequest.deposit_amount > 0 && (
                    <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3">
                      <p className="text-orange-400 text-sm mb-2">
                        This booking has a deposit of{' '}
                        <strong>${(selectedRequest.deposit_amount / 100).toFixed(2)}</strong>
                      </p>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="noshow_forfeit_deposit"
                          checked={noShowData.forfeit_deposit}
                          onChange={(e) =>
                            setNoShowData((d) => ({
                              ...d,
                              forfeit_deposit: e.target.checked,
                            }))
                          }
                          className="w-4 h-4 rounded border-ink-700 bg-ink-800 text-amber-500 focus:ring-amber-500"
                        />
                        <label
                          htmlFor="noshow_forfeit_deposit"
                          className="text-sm text-orange-300 cursor-pointer"
                        >
                          Forfeit deposit (client will not receive refund)
                        </label>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="noshow_notify_client"
                      checked={noShowData.notify_client}
                      onChange={(e) =>
                        setNoShowData((d) => ({
                          ...d,
                          notify_client: e.target.checked,
                        }))
                      }
                      className="w-4 h-4 rounded border-ink-700 bg-ink-800 text-accent focus:ring-accent"
                    />
                    <label
                      htmlFor="noshow_notify_client"
                      className="text-sm text-ink-300 cursor-pointer"
                    >
                      Send no-show notification email
                    </label>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setShowNoShowModal(false)}
                      className="flex-1 py-2 bg-ink-700 hover:bg-ink-600 text-ink-200 font-medium rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleMarkNoShow}
                      disabled={markingNoShow}
                      className="flex-1 py-2 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {markingNoShow ? 'Marking...' : 'Mark No-Show'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Refund Modal */}
      {showRefundModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-ink-900 rounded-lg w-full max-w-md">
            <div className="border-b border-ink-700 p-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-ink-100">Issue Refund</h2>
              <button
                onClick={() => setShowRefundModal(false)}
                className="p-2 hover:bg-ink-800 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="p-4">
              {refundSuccess ? (
                <div className="text-center">
                  <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg
                      className="w-8 h-8 text-green-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-ink-100 mb-2">Refund Issued</h3>
                  <p className="text-ink-400 mb-4">
                    {refundSuccess.notification_sent
                      ? `A refund confirmation has been sent to ${selectedRequest.client_email}.`
                      : 'The refund has been processed.'}
                  </p>
                  <div className="bg-ink-800 rounded-lg p-3 text-left mb-4">
                    <p className="text-sm text-ink-400">Refund Amount:</p>
                    <p className="text-lg font-semibold text-green-400">
                      ${(refundSuccess.refund_amount / 100).toFixed(2)}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowRefundModal(false);
                      closeModal();
                    }}
                    className="w-full py-2 bg-ink-700 hover:bg-ink-600 text-ink-200 font-medium rounded-lg transition-colors"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                    <p className="text-green-400 text-sm">
                      Issue a refund for this {selectedRequest.status === 'no_show' ? 'no-show' : 'cancelled'} booking.
                    </p>
                  </div>

                  {selectedRequest.deposit_amount && selectedRequest.deposit_amount > 0 && (
                    <div className="bg-ink-800 rounded-lg p-3">
                      <p className="text-sm text-ink-400">Original Deposit:</p>
                      <p className="text-ink-200 font-semibold">
                        ${(selectedRequest.deposit_amount / 100).toFixed(2)}
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-ink-300 mb-2">
                      Refund Type
                    </label>
                    <div className="flex gap-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="refund_type"
                          value="full"
                          checked={refundData.refund_type === 'full'}
                          onChange={() => setRefundData((d) => ({ ...d, refund_type: 'full' }))}
                          className="w-4 h-4 text-accent focus:ring-accent bg-ink-800 border-ink-700"
                        />
                        <span className="text-ink-200">Full Refund</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="refund_type"
                          value="partial"
                          checked={refundData.refund_type === 'partial'}
                          onChange={() => setRefundData((d) => ({ ...d, refund_type: 'partial' }))}
                          className="w-4 h-4 text-accent focus:ring-accent bg-ink-800 border-ink-700"
                        />
                        <span className="text-ink-200">Partial Refund</span>
                      </label>
                    </div>
                  </div>

                  {refundData.refund_type === 'partial' && (
                    <div>
                      <label className="block text-sm font-medium text-ink-300 mb-1">
                        Refund Amount ($)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        max={selectedRequest.deposit_amount ? selectedRequest.deposit_amount / 100 : undefined}
                        value={refundData.refund_amount}
                        onChange={(e) => setRefundData((d) => ({ ...d, refund_amount: e.target.value }))}
                        className="w-full px-3 py-2 bg-ink-800 border border-ink-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                        placeholder="Enter refund amount"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-ink-300 mb-1">
                      Reason (optional)
                    </label>
                    <textarea
                      value={refundData.reason}
                      onChange={(e) => setRefundData((d) => ({ ...d, reason: e.target.value }))}
                      rows={2}
                      className="w-full px-3 py-2 bg-ink-800 border border-ink-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                      placeholder="Reason for refund..."
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="refund_notify_client"
                      checked={refundData.notify_client}
                      onChange={(e) =>
                        setRefundData((d) => ({
                          ...d,
                          notify_client: e.target.checked,
                        }))
                      }
                      className="w-4 h-4 rounded border-ink-700 bg-ink-800 text-accent focus:ring-accent"
                    />
                    <label
                      htmlFor="refund_notify_client"
                      className="text-sm text-ink-300 cursor-pointer"
                    >
                      Send refund confirmation email
                    </label>
                  </div>

                  {modalError && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                      <p className="text-red-400 text-sm">{modalError}</p>
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setShowRefundModal(false)}
                      className="flex-1 py-2 bg-ink-700 hover:bg-ink-600 text-ink-200 font-medium rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleIssueRefund}
                      disabled={issuingRefund || (refundData.refund_type === 'partial' && !refundData.refund_amount)}
                      className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {issuingRefund ? 'Processing...' : 'Issue Refund'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cancel With Refund Modal */}
      {showCancelRefundModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-ink-900 rounded-lg w-full max-w-md">
            <div className="border-b border-ink-700 p-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-ink-100">Cancel & Refund</h2>
              <button
                onClick={() => setShowCancelRefundModal(false)}
                className="p-2 hover:bg-ink-800 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="p-4">
              {cancelRefundSuccess ? (
                <div className="text-center">
                  <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg
                      className="w-8 h-8 text-green-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-ink-100 mb-2">Booking Cancelled & Refunded</h3>
                  <p className="text-ink-400 mb-4">
                    {cancelRefundSuccess.notification_sent
                      ? `A cancellation and refund confirmation has been sent to ${selectedRequest.client_email}.`
                      : 'The booking has been cancelled and refunded.'}
                  </p>
                  <div className="bg-ink-800 rounded-lg p-3 text-left mb-4">
                    <p className="text-sm text-ink-400">Refund Amount:</p>
                    <p className="text-lg font-semibold text-green-400">
                      ${(cancelRefundSuccess.refund_amount / 100).toFixed(2)}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowCancelRefundModal(false);
                      closeModal();
                    }}
                    className="w-full py-2 bg-ink-700 hover:bg-ink-600 text-ink-200 font-medium rounded-lg transition-colors"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                    <p className="text-red-400 text-sm">
                      Cancel this booking and issue a refund for the deposit.
                    </p>
                  </div>

                  {selectedRequest.deposit_amount && selectedRequest.deposit_amount > 0 && (
                    <div className="bg-ink-800 rounded-lg p-3">
                      <p className="text-sm text-ink-400">Deposit Paid:</p>
                      <p className="text-ink-200 font-semibold">
                        ${(selectedRequest.deposit_amount / 100).toFixed(2)}
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-ink-300 mb-2">
                      Cancelled By
                    </label>
                    <div className="flex gap-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="cancelled_by"
                          value="studio"
                          checked={cancelRefundData.cancelled_by === 'studio'}
                          onChange={() => setCancelRefundData((d) => ({ ...d, cancelled_by: 'studio' }))}
                          className="w-4 h-4 text-accent focus:ring-accent bg-ink-800 border-ink-700"
                        />
                        <span className="text-ink-200">Studio</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="cancelled_by"
                          value="client"
                          checked={cancelRefundData.cancelled_by === 'client'}
                          onChange={() => setCancelRefundData((d) => ({ ...d, cancelled_by: 'client' }))}
                          className="w-4 h-4 text-accent focus:ring-accent bg-ink-800 border-ink-700"
                        />
                        <span className="text-ink-200">Client</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-ink-300 mb-2">
                      Refund Type
                    </label>
                    <div className="flex gap-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="cancel_refund_type"
                          value="full"
                          checked={cancelRefundData.refund_type === 'full'}
                          onChange={() => setCancelRefundData((d) => ({ ...d, refund_type: 'full' }))}
                          className="w-4 h-4 text-accent focus:ring-accent bg-ink-800 border-ink-700"
                        />
                        <span className="text-ink-200">Full Refund</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="cancel_refund_type"
                          value="partial"
                          checked={cancelRefundData.refund_type === 'partial'}
                          onChange={() => setCancelRefundData((d) => ({ ...d, refund_type: 'partial' }))}
                          className="w-4 h-4 text-accent focus:ring-accent bg-ink-800 border-ink-700"
                        />
                        <span className="text-ink-200">Partial Refund</span>
                      </label>
                    </div>
                  </div>

                  {cancelRefundData.refund_type === 'partial' && (
                    <div>
                      <label className="block text-sm font-medium text-ink-300 mb-1">
                        Refund Amount ($)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        max={selectedRequest.deposit_amount ? selectedRequest.deposit_amount / 100 : undefined}
                        value={cancelRefundData.refund_amount}
                        onChange={(e) => setCancelRefundData((d) => ({ ...d, refund_amount: e.target.value }))}
                        className="w-full px-3 py-2 bg-ink-800 border border-ink-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                        placeholder="Enter refund amount"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-ink-300 mb-1">
                      Cancellation Reason (optional)
                    </label>
                    <textarea
                      value={cancelRefundData.reason}
                      onChange={(e) => setCancelRefundData((d) => ({ ...d, reason: e.target.value }))}
                      rows={2}
                      className="w-full px-3 py-2 bg-ink-800 border border-ink-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                      placeholder="Reason for cancellation..."
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="cancel_refund_notify_client"
                      checked={cancelRefundData.notify_client}
                      onChange={(e) =>
                        setCancelRefundData((d) => ({
                          ...d,
                          notify_client: e.target.checked,
                        }))
                      }
                      className="w-4 h-4 rounded border-ink-700 bg-ink-800 text-accent focus:ring-accent"
                    />
                    <label
                      htmlFor="cancel_refund_notify_client"
                      className="text-sm text-ink-300 cursor-pointer"
                    >
                      Send cancellation & refund confirmation email
                    </label>
                  </div>

                  {modalError && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                      <p className="text-red-400 text-sm">{modalError}</p>
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setShowCancelRefundModal(false)}
                      className="flex-1 py-2 bg-ink-700 hover:bg-ink-600 text-ink-200 font-medium rounded-lg transition-colors"
                    >
                      Go Back
                    </button>
                    <button
                      onClick={handleCancelWithRefund}
                      disabled={cancellingWithRefund || (cancelRefundData.refund_type === 'partial' && !cancelRefundData.refund_amount)}
                      className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {cancellingWithRefund ? 'Processing...' : 'Cancel & Refund'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
