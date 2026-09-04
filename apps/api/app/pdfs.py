from __future__ import annotations

from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas


def build_post_completion_report_pdf(*, firm_name: str, matter_ref: str, matter_type: str, status: str, summary_lines: list[str]) -> bytes:
    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    width, height = A4

    y = height - 60
    c.setFont("Helvetica-Bold", 16)
    c.drawString(40, y, "Post-Completion Report")
    y -= 24

    c.setFont("Helvetica", 11)
    c.drawString(40, y, f"Firm: {firm_name}")
    y -= 16
    c.drawString(40, y, f"Matter Ref: {matter_ref}")
    y -= 16
    c.drawString(40, y, f"Matter Type: {matter_type}")
    y -= 16
    c.drawString(40, y, f"Status: {status}")
    y -= 26

    c.setFont("Helvetica-Bold", 12)
    c.drawString(40, y, "Checklist / Notes")
    y -= 18

    c.setFont("Helvetica", 10)
    for line in summary_lines[:45]:
        if y < 60:
            c.showPage()
            y = height - 60
            c.setFont("Helvetica", 10)
        c.drawString(50, y, f"- {line}")
        y -= 14

    c.showPage()
    c.save()
    return buf.getvalue()
