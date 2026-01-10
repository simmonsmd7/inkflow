"""Export service for generating CSV and PDF reports."""

import csv
import io
from datetime import datetime
from typing import Any

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate,
    Table,
    TableStyle,
    Paragraph,
    Spacer,
)


def format_cents_to_dollars(cents: int) -> str:
    """Convert cents to dollar string."""
    return f"${cents / 100:,.2f}"


def format_datetime(dt: datetime | None) -> str:
    """Format datetime for display."""
    if dt is None:
        return "-"
    return dt.strftime("%Y-%m-%d %H:%M")


def format_date(dt: datetime | None) -> str:
    """Format date for display."""
    if dt is None:
        return "-"
    return dt.strftime("%Y-%m-%d")


# ============ CSV Exports ============


def generate_commissions_csv(commissions: list[dict[str, Any]]) -> str:
    """Generate CSV for earned commissions."""
    output = io.StringIO()
    writer = csv.writer(output)

    # Header row
    writer.writerow([
        "Date",
        "Client Name",
        "Artist Name",
        "Design",
        "Service Total",
        "Studio Commission",
        "Artist Payout",
        "Tips",
        "Commission Rule",
        "Status",
    ])

    # Data rows
    for comm in commissions:
        status = "Paid" if comm.get("paid_at") else "Unpaid"
        writer.writerow([
            format_datetime(comm.get("completed_at")),
            comm.get("client_name", "Unknown"),
            comm.get("artist_name", "-"),
            (comm.get("design_idea", "") or "")[:50],
            format_cents_to_dollars(comm.get("service_total", 0)),
            format_cents_to_dollars(comm.get("studio_commission", 0)),
            format_cents_to_dollars(comm.get("artist_payout", 0)),
            format_cents_to_dollars(comm.get("tips_amount", 0)),
            comm.get("commission_rule_name", "-"),
            status,
        ])

    return output.getvalue()


def generate_pay_periods_csv(pay_periods: list[dict[str, Any]]) -> str:
    """Generate CSV for pay periods."""
    output = io.StringIO()
    writer = csv.writer(output)

    # Header row
    writer.writerow([
        "Start Date",
        "End Date",
        "Status",
        "Total Service",
        "Studio Commission",
        "Artist Payout",
        "Tips (Card)",
        "Tips (Cash)",
        "Total Tips",
        "Bookings",
        "Paid At",
        "Payout Reference",
    ])

    # Data rows
    for pp in pay_periods:
        writer.writerow([
            format_date(pp.get("start_date")),
            format_date(pp.get("end_date")),
            pp.get("status", "").upper(),
            format_cents_to_dollars(pp.get("total_service", 0)),
            format_cents_to_dollars(pp.get("total_studio_commission", 0)),
            format_cents_to_dollars(pp.get("total_artist_payout", 0)),
            format_cents_to_dollars(pp.get("total_tips_card", 0)),
            format_cents_to_dollars(pp.get("total_tips_cash", 0)),
            format_cents_to_dollars(pp.get("total_tips", 0)),
            pp.get("commission_count", 0),
            format_datetime(pp.get("paid_at")),
            pp.get("payout_reference", "-") or "-",
        ])

    return output.getvalue()


def generate_artist_payouts_csv(artists: list[dict[str, Any]]) -> str:
    """Generate CSV for artist payouts."""
    output = io.StringIO()
    writer = csv.writer(output)

    # Header row
    writer.writerow([
        "Artist Name",
        "Email",
        "Total Service",
        "Studio Commission",
        "Artist Payout",
        "Tips",
        "Bookings",
        "Pay Periods",
    ])

    # Data rows
    for artist in artists:
        writer.writerow([
            artist.get("artist_name", "Unknown"),
            artist.get("email", "-"),
            format_cents_to_dollars(artist.get("total_service", 0)),
            format_cents_to_dollars(artist.get("total_studio_commission", 0)),
            format_cents_to_dollars(artist.get("total_artist_payout", 0)),
            format_cents_to_dollars(artist.get("total_tips", 0)),
            artist.get("booking_count", 0),
            artist.get("pay_period_count", 0),
        ])

    return output.getvalue()


def generate_tips_report_csv(artists: list[dict[str, Any]]) -> str:
    """Generate CSV for tips report."""
    output = io.StringIO()
    writer = csv.writer(output)

    # Header row
    writer.writerow([
        "Artist Name",
        "Email",
        "Total Tips",
        "Card Tips",
        "Cash Tips",
        "Artist Share",
        "Studio Share",
        "Bookings with Tips",
    ])

    # Data rows
    for artist in artists:
        writer.writerow([
            artist.get("artist_name", "Unknown"),
            artist.get("email", "-"),
            format_cents_to_dollars(artist.get("total_tips", 0)),
            format_cents_to_dollars(artist.get("total_tips_card", 0)),
            format_cents_to_dollars(artist.get("total_tips_cash", 0)),
            format_cents_to_dollars(artist.get("tip_artist_share", 0)),
            format_cents_to_dollars(artist.get("tip_studio_share", 0)),
            artist.get("booking_count", 0),
        ])

    return output.getvalue()


# ============ PDF Exports ============


def _create_pdf_header(
    story: list,
    title: str,
    subtitle: str | None = None,
    date_range: str | None = None,
) -> None:
    """Add header elements to PDF story."""
    styles = getSampleStyleSheet()

    # Title style
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=18,
        spaceAfter=6,
        textColor=colors.HexColor('#1a1a1a'),
    )

    # Subtitle style
    subtitle_style = ParagraphStyle(
        'CustomSubtitle',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.HexColor('#666666'),
    )

    story.append(Paragraph(title, title_style))

    if subtitle:
        story.append(Paragraph(subtitle, subtitle_style))

    if date_range:
        story.append(Paragraph(f"Period: {date_range}", subtitle_style))

    story.append(Spacer(1, 0.3 * inch))


def _create_summary_table(summary: dict[str, Any]) -> Table:
    """Create a summary table for PDF."""
    data = []
    for key, value in summary.items():
        label = key.replace("_", " ").title()
        if "total" in key.lower() and isinstance(value, int):
            formatted_value = format_cents_to_dollars(value)
        else:
            formatted_value = str(value)
        data.append([label, formatted_value])

    table = Table(data, colWidths=[2.5 * inch, 2 * inch])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f5f5f5')),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#1a1a1a')),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e0e0e0')),
    ]))

    return table


def generate_commissions_pdf(
    commissions: list[dict[str, Any]],
    summary: dict[str, Any],
    studio_name: str = "InkFlow Studio",
    date_range: str | None = None,
) -> bytes:
    """Generate PDF for earned commissions."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=landscape(letter),
        rightMargin=0.5 * inch,
        leftMargin=0.5 * inch,
        topMargin=0.5 * inch,
        bottomMargin=0.5 * inch,
    )

    story = []

    # Header
    _create_pdf_header(
        story,
        "Commissions Report",
        studio_name,
        date_range,
    )

    # Summary
    summary_data = {
        "Total Revenue": summary.get("total_service", 0),
        "Studio Commission": summary.get("total_studio_commission", 0),
        "Artist Payouts": summary.get("total_artist_payout", 0),
        "Total Tips": summary.get("total_tips", 0),
        "Total Bookings": summary.get("total", 0),
    }
    story.append(_create_summary_table(summary_data))
    story.append(Spacer(1, 0.3 * inch))

    # Data table
    headers = ["Date", "Client", "Artist", "Service", "Commission", "Payout", "Tips", "Status"]
    data = [headers]

    for comm in commissions:
        status = "Paid" if comm.get("paid_at") else "Unpaid"
        row = [
            format_date(comm.get("completed_at")),
            (comm.get("client_name", "Unknown") or "Unknown")[:20],
            (comm.get("artist_name", "-") or "-")[:15],
            format_cents_to_dollars(comm.get("service_total", 0)),
            format_cents_to_dollars(comm.get("studio_commission", 0)),
            format_cents_to_dollars(comm.get("artist_payout", 0)),
            format_cents_to_dollars(comm.get("tips_amount", 0)),
            status,
        ]
        data.append(row)

    table = Table(data, repeatRows=1)
    table.setStyle(TableStyle([
        # Header
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1a1a1a')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
        ('TOPPADDING', (0, 0), (-1, 0), 10),
        # Data rows
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
        ('TOPPADDING', (0, 1), (-1, -1), 6),
        ('ALIGN', (3, 0), (-1, -1), 'RIGHT'),
        ('TEXTCOLOR', (0, 1), (-1, -1), colors.HexColor('#1a1a1a')),
        # Alternating row colors
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f9f9f9')]),
        # Grid
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e0e0e0')),
    ]))

    story.append(table)

    # Footer
    story.append(Spacer(1, 0.3 * inch))
    styles = getSampleStyleSheet()
    footer_style = ParagraphStyle(
        'Footer',
        parent=styles['Normal'],
        fontSize=8,
        textColor=colors.HexColor('#999999'),
    )
    story.append(Paragraph(
        f"Generated on {datetime.now().strftime('%Y-%m-%d %H:%M')} by InkFlow",
        footer_style,
    ))

    doc.build(story)
    return buffer.getvalue()


def generate_pay_periods_pdf(
    pay_periods: list[dict[str, Any]],
    summary: dict[str, Any],
    studio_name: str = "InkFlow Studio",
) -> bytes:
    """Generate PDF for pay periods."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=landscape(letter),
        rightMargin=0.5 * inch,
        leftMargin=0.5 * inch,
        topMargin=0.5 * inch,
        bottomMargin=0.5 * inch,
    )

    story = []

    # Header
    _create_pdf_header(
        story,
        "Pay Periods Report",
        studio_name,
    )

    # Summary
    summary_table_data = {
        "Total Service Revenue": summary.get("total_service", 0),
        "Total Studio Commission": summary.get("total_studio_commission", 0),
        "Total Artist Payouts": summary.get("total_artist_payout", 0),
        "Total Tips": summary.get("total_tips", 0),
        "Pay Periods": summary.get("count", len(pay_periods)),
    }
    story.append(_create_summary_table(summary_table_data))
    story.append(Spacer(1, 0.3 * inch))

    # Data table
    headers = ["Period", "Status", "Service", "Commission", "Payout", "Tips", "Bookings", "Paid At"]
    data = [headers]

    for pp in pay_periods:
        period = f"{format_date(pp.get('start_date'))} - {format_date(pp.get('end_date'))}"
        row = [
            period,
            (pp.get("status", "") or "").upper(),
            format_cents_to_dollars(pp.get("total_service", 0)),
            format_cents_to_dollars(pp.get("total_studio_commission", 0)),
            format_cents_to_dollars(pp.get("total_artist_payout", 0)),
            format_cents_to_dollars(pp.get("total_tips", 0)),
            str(pp.get("commission_count", 0)),
            format_date(pp.get("paid_at")),
        ]
        data.append(row)

    table = Table(data, repeatRows=1)
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1a1a1a')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
        ('TOPPADDING', (0, 0), (-1, 0), 10),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
        ('TOPPADDING', (0, 1), (-1, -1), 6),
        ('ALIGN', (2, 0), (-2, -1), 'RIGHT'),
        ('TEXTCOLOR', (0, 1), (-1, -1), colors.HexColor('#1a1a1a')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f9f9f9')]),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e0e0e0')),
    ]))

    story.append(table)

    # Footer
    story.append(Spacer(1, 0.3 * inch))
    styles = getSampleStyleSheet()
    footer_style = ParagraphStyle(
        'Footer',
        parent=styles['Normal'],
        fontSize=8,
        textColor=colors.HexColor('#999999'),
    )
    story.append(Paragraph(
        f"Generated on {datetime.now().strftime('%Y-%m-%d %H:%M')} by InkFlow",
        footer_style,
    ))

    doc.build(story)
    return buffer.getvalue()


def generate_artist_payouts_pdf(
    artists: list[dict[str, Any]],
    summary: dict[str, Any],
    studio_name: str = "InkFlow Studio",
    date_range: str | None = None,
) -> bytes:
    """Generate PDF for artist payouts report."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=0.5 * inch,
        leftMargin=0.5 * inch,
        topMargin=0.5 * inch,
        bottomMargin=0.5 * inch,
    )

    story = []

    # Header
    _create_pdf_header(
        story,
        "Artist Payouts Report",
        studio_name,
        date_range,
    )

    # Summary
    summary_table_data = {
        "Total Revenue": summary.get("total_service", 0),
        "Studio Commission": summary.get("total_studio_commission", 0),
        "Artist Payouts": summary.get("total_artist_payout", 0),
        "Tips": summary.get("total_tips", 0),
        "Bookings": summary.get("total_bookings", 0),
        "Artists Paid": summary.get("artists_paid", len(artists)),
    }
    story.append(_create_summary_table(summary_table_data))
    story.append(Spacer(1, 0.3 * inch))

    # Data table
    headers = ["Artist", "Service", "Commission", "Payout", "Tips", "Bookings"]
    data = [headers]

    for artist in artists:
        row = [
            (artist.get("artist_name", "Unknown") or "Unknown")[:25],
            format_cents_to_dollars(artist.get("total_service", 0)),
            format_cents_to_dollars(artist.get("total_studio_commission", 0)),
            format_cents_to_dollars(artist.get("total_artist_payout", 0)),
            format_cents_to_dollars(artist.get("total_tips", 0)),
            str(artist.get("booking_count", 0)),
        ]
        data.append(row)

    table = Table(data, repeatRows=1, colWidths=[2.5 * inch, 1.1 * inch, 1.1 * inch, 1.1 * inch, 0.9 * inch, 0.8 * inch])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1a1a1a')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
        ('TOPPADDING', (0, 0), (-1, 0), 10),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
        ('TOPPADDING', (0, 1), (-1, -1), 8),
        ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
        ('TEXTCOLOR', (0, 1), (-1, -1), colors.HexColor('#1a1a1a')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f9f9f9')]),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e0e0e0')),
    ]))

    story.append(table)

    # Footer
    story.append(Spacer(1, 0.3 * inch))
    styles = getSampleStyleSheet()
    footer_style = ParagraphStyle(
        'Footer',
        parent=styles['Normal'],
        fontSize=8,
        textColor=colors.HexColor('#999999'),
    )
    story.append(Paragraph(
        f"Generated on {datetime.now().strftime('%Y-%m-%d %H:%M')} by InkFlow",
        footer_style,
    ))

    doc.build(story)
    return buffer.getvalue()


def generate_tips_report_pdf(
    artists: list[dict[str, Any]],
    summary: dict[str, Any],
    studio_name: str = "InkFlow Studio",
    date_range: str | None = None,
) -> bytes:
    """Generate PDF for tips report."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=0.5 * inch,
        leftMargin=0.5 * inch,
        topMargin=0.5 * inch,
        bottomMargin=0.5 * inch,
    )

    story = []

    # Header
    _create_pdf_header(
        story,
        "Tips Distribution Report",
        studio_name,
        date_range,
    )

    # Summary
    summary_table_data = {
        "Total Tips": summary.get("total_tips", 0),
        "Card Tips": summary.get("total_tips_card", 0),
        "Cash Tips": summary.get("total_tips_cash", 0),
        "Artist Share": summary.get("total_artist_share", 0),
        "Studio Share": summary.get("total_studio_share", 0),
        "Bookings with Tips": summary.get("total_bookings_with_tips", 0),
    }
    story.append(_create_summary_table(summary_table_data))
    story.append(Spacer(1, 0.3 * inch))

    # Data table
    headers = ["Artist", "Total Tips", "Card", "Cash", "Artist Share", "Studio Share"]
    data = [headers]

    for artist in artists:
        row = [
            (artist.get("artist_name", "Unknown") or "Unknown")[:25],
            format_cents_to_dollars(artist.get("total_tips", 0)),
            format_cents_to_dollars(artist.get("total_tips_card", 0)),
            format_cents_to_dollars(artist.get("total_tips_cash", 0)),
            format_cents_to_dollars(artist.get("tip_artist_share", 0)),
            format_cents_to_dollars(artist.get("tip_studio_share", 0)),
        ]
        data.append(row)

    table = Table(data, repeatRows=1, colWidths=[2.2 * inch, 1.1 * inch, 1 * inch, 1 * inch, 1.1 * inch, 1.1 * inch])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1a1a1a')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
        ('TOPPADDING', (0, 0), (-1, 0), 10),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
        ('TOPPADDING', (0, 1), (-1, -1), 8),
        ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
        ('TEXTCOLOR', (0, 1), (-1, -1), colors.HexColor('#1a1a1a')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f9f9f9')]),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e0e0e0')),
    ]))

    story.append(table)

    # Footer
    story.append(Spacer(1, 0.3 * inch))
    styles = getSampleStyleSheet()
    footer_style = ParagraphStyle(
        'Footer',
        parent=styles['Normal'],
        fontSize=8,
        textColor=colors.HexColor('#999999'),
    )
    story.append(Paragraph(
        f"Generated on {datetime.now().strftime('%Y-%m-%d %H:%M')} by InkFlow",
        footer_style,
    ))

    doc.build(story)
    return buffer.getvalue()
