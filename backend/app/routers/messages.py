"""Messages router for unified inbox system."""

import secrets
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.database import get_db
from app.models.message import (
    Conversation,
    ConversationStatus,
    Message,
    MessageChannel,
    MessageDirection,
)
from app.models.user import User
from app.schemas.message import (
    AssignConversationResponse,
    ConversationCreate,
    ConversationResponse,
    ConversationsListResponse,
    ConversationStatus as ConversationStatusSchema,
    ConversationSummary,
    ConversationUpdate,
    MarkReadResponse,
    MessageCreate,
    MessageResponse,
)
from app.services.auth import get_current_user
from app.services.email import email_service
from app.services.sms import sms_service

settings = get_settings()

router = APIRouter(prefix="/messages", tags=["Messages"])


# ============ Conversations ============


@router.get("/conversations", response_model=ConversationsListResponse)
async def list_conversations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status: ConversationStatusSchema | None = None,
    assigned_to_me: bool = Query(False),
    search: str | None = Query(None, max_length=100),
) -> ConversationsListResponse:
    """
    List conversations with filtering and pagination.

    - Filter by status (unread, pending, resolved)
    - Filter to only assigned conversations
    - Search by client name or email
    """
    # Base query
    query = (
        select(Conversation)
        .options(selectinload(Conversation.assigned_to))
        .where(Conversation.studio_id.isnot(None) | Conversation.studio_id.is_(None))
    )

    # Apply filters
    if status:
        query = query.where(Conversation.status == ConversationStatus(status.value))

    if assigned_to_me:
        query = query.where(Conversation.assigned_to_id == current_user.id)

    if search:
        search_pattern = f"%{search}%"
        query = query.where(
            or_(
                Conversation.client_name.ilike(search_pattern),
                Conversation.client_email.ilike(search_pattern),
                Conversation.subject.ilike(search_pattern),
            )
        )

    # Order by most recent message first
    query = query.order_by(Conversation.last_message_at.desc().nullsfirst())

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Apply pagination
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    conversations = result.scalars().all()

    # Build response with assigned user names
    summaries = []
    for conv in conversations:
        summary = ConversationSummary(
            id=conv.id,
            client_name=conv.client_name,
            client_email=conv.client_email,
            client_phone=conv.client_phone,
            status=ConversationStatusSchema(conv.status.value),
            subject=conv.subject,
            last_message_at=conv.last_message_at,
            last_message_preview=conv.last_message_preview,
            unread_count=conv.unread_count,
            assigned_to_id=conv.assigned_to_id,
            assigned_to_name=conv.assigned_to.full_name if conv.assigned_to else None,
            booking_request_id=conv.booking_request_id,
            created_at=conv.created_at,
            updated_at=conv.updated_at,
        )
        summaries.append(summary)

    return ConversationsListResponse(
        conversations=summaries,
        total=total,
        skip=skip,
        limit=limit,
    )


@router.post("/conversations", response_model=ConversationResponse, status_code=status.HTTP_201_CREATED)
async def create_conversation(
    data: ConversationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ConversationResponse:
    """
    Create a new conversation.

    Optionally include an initial message.
    """
    now = datetime.now(timezone.utc)

    # Create the conversation
    conversation = Conversation(
        client_name=data.client_name,
        client_email=data.client_email,
        client_phone=data.client_phone,
        subject=data.subject,
        studio_id=data.studio_id,
        booking_request_id=data.booking_request_id,
        status=ConversationStatus.UNREAD,
        assigned_to_id=current_user.id,  # Auto-assign to creator
    )
    db.add(conversation)
    await db.flush()

    messages = []

    # Add initial message if provided
    if data.initial_message:
        message = Message(
            conversation_id=conversation.id,
            content=data.initial_message,
            channel=MessageChannel.INTERNAL,
            direction=MessageDirection.OUTBOUND,
            sender_id=current_user.id,
            sender_name=current_user.full_name,
            is_read=True,  # Sender has read their own message
            read_at=now,
            read_by_id=current_user.id,
        )
        db.add(message)
        await db.flush()

        # Update conversation with last message info
        conversation.last_message_at = now
        conversation.last_message_preview = data.initial_message[:200] if data.initial_message else None
        conversation.status = ConversationStatus.PENDING  # Move to pending since we sent a message

        messages = [MessageResponse.model_validate(message)]

    await db.refresh(conversation)

    return ConversationResponse(
        id=conversation.id,
        client_name=conversation.client_name,
        client_email=conversation.client_email,
        client_phone=conversation.client_phone,
        status=ConversationStatusSchema(conversation.status.value),
        subject=conversation.subject,
        last_message_at=conversation.last_message_at,
        unread_count=conversation.unread_count,
        assigned_to_id=conversation.assigned_to_id,
        assigned_to_name=current_user.full_name,
        studio_id=conversation.studio_id,
        booking_request_id=conversation.booking_request_id,
        messages=messages,
        created_at=conversation.created_at,
        updated_at=conversation.updated_at,
    )


@router.get("/conversations/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(
    conversation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ConversationResponse:
    """
    Get a conversation with all its messages.
    """
    query = (
        select(Conversation)
        .options(
            selectinload(Conversation.messages),
            selectinload(Conversation.assigned_to),
        )
        .where(Conversation.id == conversation_id)
    )
    result = await db.execute(query)
    conversation = result.scalar_one_or_none()

    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        )

    return ConversationResponse(
        id=conversation.id,
        client_name=conversation.client_name,
        client_email=conversation.client_email,
        client_phone=conversation.client_phone,
        status=ConversationStatusSchema(conversation.status.value),
        subject=conversation.subject,
        last_message_at=conversation.last_message_at,
        unread_count=conversation.unread_count,
        assigned_to_id=conversation.assigned_to_id,
        assigned_to_name=conversation.assigned_to.full_name if conversation.assigned_to else None,
        studio_id=conversation.studio_id,
        booking_request_id=conversation.booking_request_id,
        messages=[MessageResponse.model_validate(m) for m in conversation.messages],
        created_at=conversation.created_at,
        updated_at=conversation.updated_at,
    )


@router.patch("/conversations/{conversation_id}", response_model=ConversationSummary)
async def update_conversation(
    conversation_id: uuid.UUID,
    data: ConversationUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ConversationSummary:
    """
    Update conversation status or assignment.
    """
    query = (
        select(Conversation)
        .options(selectinload(Conversation.assigned_to))
        .where(Conversation.id == conversation_id)
    )
    result = await db.execute(query)
    conversation = result.scalar_one_or_none()

    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        )

    # Apply updates
    if data.status is not None:
        conversation.status = ConversationStatus(data.status.value)

    if data.assigned_to_id is not None:
        conversation.assigned_to_id = data.assigned_to_id

    if data.subject is not None:
        conversation.subject = data.subject

    await db.flush()
    await db.refresh(conversation, ["assigned_to"])

    return ConversationSummary(
        id=conversation.id,
        client_name=conversation.client_name,
        client_email=conversation.client_email,
        client_phone=conversation.client_phone,
        status=ConversationStatusSchema(conversation.status.value),
        subject=conversation.subject,
        last_message_at=conversation.last_message_at,
        last_message_preview=conversation.last_message_preview,
        unread_count=conversation.unread_count,
        assigned_to_id=conversation.assigned_to_id,
        assigned_to_name=conversation.assigned_to.full_name if conversation.assigned_to else None,
        booking_request_id=conversation.booking_request_id,
        created_at=conversation.created_at,
        updated_at=conversation.updated_at,
    )


@router.post("/conversations/{conversation_id}/assign", response_model=AssignConversationResponse)
async def assign_conversation(
    conversation_id: uuid.UUID,
    assignee_id: uuid.UUID | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AssignConversationResponse:
    """
    Assign or unassign a conversation to a team member.

    If assignee_id is None, unassigns the conversation.
    """
    query = select(Conversation).where(Conversation.id == conversation_id)
    result = await db.execute(query)
    conversation = result.scalar_one_or_none()

    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        )

    # If assigning, verify the user exists
    assigned_to_name = None
    if assignee_id:
        user_query = select(User).where(User.id == assignee_id, User.is_active.is_(True))
        user_result = await db.execute(user_query)
        assignee = user_result.scalar_one_or_none()
        if not assignee:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Assignee not found or inactive",
            )
        assigned_to_name = assignee.full_name

    conversation.assigned_to_id = assignee_id
    await db.flush()

    return AssignConversationResponse(
        conversation_id=conversation.id,
        assigned_to_id=assignee_id,
        assigned_to_name=assigned_to_name,
        success=True,
    )


# ============ Messages ============


def _generate_email_message_id(conversation_id: uuid.UUID, message_id: uuid.UUID) -> str:
    """Generate RFC 5322 compliant Message-ID for email threading."""
    return f"<{message_id}@{settings.inbound_email_domain}>"


def _generate_thread_token() -> str:
    """Generate a unique token for email thread routing."""
    return secrets.token_urlsafe(32)


@router.post("/conversations/{conversation_id}/messages", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def send_message(
    conversation_id: uuid.UUID,
    data: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """
    Send a message in a conversation.

    If channel is 'email', the message will be sent via email to the client.
    Requires the conversation to have a client_email set.
    """
    # Get the conversation with studio relationship for studio name
    query = (
        select(Conversation)
        .options(selectinload(Conversation.studio))
        .where(Conversation.id == conversation_id)
    )
    result = await db.execute(query)
    conversation = result.scalar_one_or_none()

    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        )

    now = datetime.now(timezone.utc)
    channel = MessageChannel(data.channel.value)

    # Validate email channel requirements
    if channel == MessageChannel.EMAIL:
        if not conversation.client_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot send email: conversation has no client email address",
            )

    # Validate SMS channel requirements
    if channel == MessageChannel.SMS:
        if not conversation.client_phone:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot send SMS: conversation has no client phone number",
            )

    # Ensure conversation has a thread token for email routing
    if not conversation.email_thread_token:
        conversation.email_thread_token = _generate_thread_token()

    # Create the message
    message = Message(
        conversation_id=conversation_id,
        content=data.content,
        channel=channel,
        direction=MessageDirection.OUTBOUND,  # Staff sending
        sender_id=current_user.id,
        sender_name=current_user.full_name,
        is_read=True,  # Sender has read their own message
        read_at=now,
        read_by_id=current_user.id,
    )
    db.add(message)
    await db.flush()  # Get message ID

    # If sending via email, actually send the email
    if channel == MessageChannel.EMAIL:
        # Generate email message ID
        email_msg_id = _generate_email_message_id(conversation_id, message.id)
        message.email_message_id = email_msg_id

        # Determine subject line
        subject = conversation.subject or "Message from InkFlow"
        if not subject.lower().startswith("re:"):
            # Only add Re: if there are previous messages in the thread
            prev_messages_query = (
                select(func.count())
                .select_from(Message)
                .where(
                    Message.conversation_id == conversation_id,
                    Message.channel == MessageChannel.EMAIL,
                    Message.id != message.id,
                )
            )
            prev_count_result = await db.execute(prev_messages_query)
            prev_count = prev_count_result.scalar() or 0
            if prev_count > 0:
                subject = f"Re: {subject}"

        message.email_subject = subject

        # Find the last email in the thread for In-Reply-To
        last_email_query = (
            select(Message)
            .where(
                Message.conversation_id == conversation_id,
                Message.channel == MessageChannel.EMAIL,
                Message.email_message_id.isnot(None),
                Message.id != message.id,
            )
            .order_by(Message.created_at.desc())
            .limit(1)
        )
        last_email_result = await db.execute(last_email_query)
        last_email = last_email_result.scalar_one_or_none()

        in_reply_to = last_email.email_message_id if last_email else None
        message.email_in_reply_to = in_reply_to

        # Send the email
        studio_name = conversation.studio.name if conversation.studio else None

        success, _ = await email_service.send_conversation_message(
            to_email=conversation.client_email,
            client_name=conversation.client_name,
            sender_name=current_user.full_name,
            studio_name=studio_name,
            subject=subject,
            content=data.content,
            thread_token=conversation.email_thread_token,
            message_id=email_msg_id,
            in_reply_to=in_reply_to,
        )

        if success:
            message.delivered_at = datetime.now(timezone.utc)
        else:
            message.failed_at = datetime.now(timezone.utc)
            message.failure_reason = "Failed to send email"

    # If sending via SMS, actually send the SMS
    if channel == MessageChannel.SMS:
        studio_name = conversation.studio.name if conversation.studio else None

        success, message_sid = await sms_service.send_conversation_message(
            to_phone=conversation.client_phone,
            client_name=conversation.client_name,
            sender_name=current_user.full_name,
            studio_name=studio_name,
            content=data.content,
        )

        if success:
            message.delivered_at = datetime.now(timezone.utc)
            message.external_id = message_sid  # Store Twilio message SID
        else:
            message.failed_at = datetime.now(timezone.utc)
            message.failure_reason = "Failed to send SMS"

    # Update conversation
    conversation.last_message_at = now
    conversation.last_message_preview = data.content[:200] if data.content else None

    # Auto-update status from unread to pending if we're responding
    if conversation.status == ConversationStatus.UNREAD:
        conversation.status = ConversationStatus.PENDING

    await db.flush()
    await db.refresh(message)

    return MessageResponse.model_validate(message)


@router.post("/conversations/{conversation_id}/mark-read", response_model=MarkReadResponse)
async def mark_messages_read(
    conversation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MarkReadResponse:
    """
    Mark all unread messages in a conversation as read.
    """
    # Get the conversation
    query = select(Conversation).where(Conversation.id == conversation_id)
    result = await db.execute(query)
    conversation = result.scalar_one_or_none()

    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        )

    now = datetime.now(timezone.utc)

    # Get unread messages (inbound messages that haven't been read)
    messages_query = select(Message).where(
        Message.conversation_id == conversation_id,
        Message.is_read.is_(False),
        Message.direction == MessageDirection.INBOUND,
    )
    messages_result = await db.execute(messages_query)
    unread_messages = messages_result.scalars().all()

    # Mark them as read
    for msg in unread_messages:
        msg.is_read = True
        msg.read_at = now
        msg.read_by_id = current_user.id

    # Update conversation unread count
    conversation.unread_count = 0

    await db.flush()

    return MarkReadResponse(
        conversation_id=conversation_id,
        messages_marked_read=len(unread_messages),
        success=True,
    )


# ============ Stats ============


@router.get("/stats")
async def get_inbox_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Get inbox statistics.
    """
    # Count by status
    status_counts = {}
    for conv_status in ConversationStatus:
        count_query = select(func.count()).select_from(Conversation).where(
            Conversation.status == conv_status
        )
        result = await db.execute(count_query)
        status_counts[conv_status.value] = result.scalar() or 0

    # Count assigned to current user
    assigned_query = select(func.count()).select_from(Conversation).where(
        Conversation.assigned_to_id == current_user.id
    )
    assigned_result = await db.execute(assigned_query)
    assigned_to_me = assigned_result.scalar() or 0

    # Total unread messages
    unread_query = select(func.sum(Conversation.unread_count)).select_from(Conversation)
    unread_result = await db.execute(unread_query)
    total_unread = unread_result.scalar() or 0

    return {
        "status_counts": status_counts,
        "assigned_to_me": assigned_to_me,
        "total_unread": total_unread,
        "total_conversations": sum(status_counts.values()),
    }
