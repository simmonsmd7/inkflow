"""Calendar invite generation service (iCalendar format)."""

import uuid
from datetime import datetime, timedelta
from typing import Optional


class CalendarService:
    """Service for generating iCalendar (.ics) files for appointments."""

    def generate_ics(
        self,
        *,
        event_id: str,
        title: str,
        description: str,
        start_time: datetime,
        duration_hours: float,
        location: Optional[str] = None,
        organizer_name: Optional[str] = None,
        organizer_email: Optional[str] = None,
        attendee_name: Optional[str] = None,
        attendee_email: Optional[str] = None,
    ) -> str:
        """
        Generate an iCalendar (.ics) file content.

        Args:
            event_id: Unique identifier for the event
            title: Event title/summary
            description: Event description
            start_time: Event start datetime (should be timezone-aware)
            duration_hours: Duration of the event in hours
            location: Physical address of the event
            organizer_name: Name of the organizer (studio/artist)
            organizer_email: Email of the organizer
            attendee_name: Name of the attendee (client)
            attendee_email: Email of the attendee

        Returns:
            iCalendar formatted string
        """
        # Calculate end time
        end_time = start_time + timedelta(hours=duration_hours)

        # Format datetimes in iCalendar format (UTC)
        # Convert to UTC if timezone-aware, otherwise assume UTC
        if start_time.tzinfo is not None:
            start_utc = start_time.utctimetuple()
            end_utc = end_time.utctimetuple()
        else:
            start_utc = start_time.timetuple()
            end_utc = end_time.timetuple()

        start_str = datetime(*start_utc[:6]).strftime("%Y%m%dT%H%M%SZ")
        end_str = datetime(*end_utc[:6]).strftime("%Y%m%dT%H%M%SZ")

        # Generate timestamp for DTSTAMP
        dtstamp = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")

        # Generate unique UID
        uid = f"{event_id}@inkflow.io"

        # Escape special characters in text fields
        def escape_ics_text(text: str) -> str:
            """Escape special characters for iCalendar text fields."""
            return (
                text.replace("\\", "\\\\")
                .replace(";", "\\;")
                .replace(",", "\\,")
                .replace("\n", "\\n")
            )

        # Fold long lines (iCalendar spec: max 75 octets per line)
        def fold_line(line: str) -> str:
            """Fold long lines according to iCalendar spec."""
            if len(line.encode('utf-8')) <= 75:
                return line

            result = []
            current_line = ""

            for char in line:
                test_line = current_line + char
                if len(test_line.encode('utf-8')) > 74:  # Leave room for continuation
                    result.append(current_line)
                    current_line = " " + char  # Continuation lines start with space
                else:
                    current_line = test_line

            if current_line:
                result.append(current_line)

            return "\r\n".join(result)

        # Build the iCalendar content
        lines = [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//InkFlow//Booking System//EN",
            "CALSCALE:GREGORIAN",
            "METHOD:PUBLISH",
            "BEGIN:VEVENT",
            f"UID:{uid}",
            f"DTSTAMP:{dtstamp}",
            f"DTSTART:{start_str}",
            f"DTEND:{end_str}",
            fold_line(f"SUMMARY:{escape_ics_text(title)}"),
            fold_line(f"DESCRIPTION:{escape_ics_text(description)}"),
        ]

        # Add location if provided
        if location:
            lines.append(fold_line(f"LOCATION:{escape_ics_text(location)}"))

        # Add organizer if provided
        if organizer_email:
            organizer_line = f"ORGANIZER"
            if organizer_name:
                organizer_line += f";CN={escape_ics_text(organizer_name)}"
            organizer_line += f":mailto:{organizer_email}"
            lines.append(fold_line(organizer_line))

        # Add attendee if provided
        if attendee_email:
            attendee_line = "ATTENDEE;RSVP=TRUE;PARTSTAT=NEEDS-ACTION"
            if attendee_name:
                attendee_line += f";CN={escape_ics_text(attendee_name)}"
            attendee_line += f":mailto:{attendee_email}"
            lines.append(fold_line(attendee_line))

        # Add reminder (1 day before)
        lines.extend([
            "BEGIN:VALARM",
            "ACTION:DISPLAY",
            "DESCRIPTION:Reminder: Tattoo appointment tomorrow",
            "TRIGGER:-P1D",
            "END:VALARM",
        ])

        # Add reminder (2 hours before)
        lines.extend([
            "BEGIN:VALARM",
            "ACTION:DISPLAY",
            "DESCRIPTION:Reminder: Tattoo appointment in 2 hours",
            "TRIGGER:-PT2H",
            "END:VALARM",
        ])

        lines.extend([
            "END:VEVENT",
            "END:VCALENDAR",
        ])

        # Join with CRLF (iCalendar standard)
        return "\r\n".join(lines)

    def generate_tattoo_appointment_ics(
        self,
        *,
        booking_id: str,
        client_name: str,
        client_email: str,
        studio_name: str,
        studio_address: Optional[str] = None,
        studio_email: Optional[str] = None,
        artist_name: Optional[str] = None,
        design_summary: str,
        placement: str,
        scheduled_date: datetime,
        duration_hours: float,
    ) -> str:
        """
        Generate an iCalendar file for a tattoo appointment.

        This is a convenience method that formats the title and description
        appropriately for a tattoo appointment.
        """
        # Build title
        title = f"Tattoo Appointment - {studio_name}"
        if artist_name:
            title = f"Tattoo Appointment with {artist_name} - {studio_name}"

        # Build description
        description_parts = [
            f"Your tattoo appointment at {studio_name}",
            "",
            f"Design: {design_summary[:200]}",
            f"Placement: {placement}",
            f"Estimated Duration: {duration_hours:.1f} hours",
            "",
            "IMPORTANT REMINDERS:",
            "- Get a good night's sleep before your appointment",
            "- Eat a meal before arriving",
            "- Stay hydrated",
            "- Avoid alcohol and blood thinners 24 hours before",
            "- Wear comfortable, loose clothing",
            "- Bring a valid ID",
            "",
            f"Questions? Contact {studio_name}",
        ]

        if studio_email:
            description_parts.append(f"Email: {studio_email}")

        description = "\n".join(description_parts)

        return self.generate_ics(
            event_id=booking_id,
            title=title,
            description=description,
            start_time=scheduled_date,
            duration_hours=duration_hours,
            location=studio_address,
            organizer_name=studio_name,
            organizer_email=studio_email,
            attendee_name=client_name,
            attendee_email=client_email,
        )


# Singleton instance
calendar_service = CalendarService()
