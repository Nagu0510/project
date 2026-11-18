"""The student's career report as a PDF (reportlab). Everything in it is read from this student's own records; a student with no data
gets a valid report that says so instead of invented numbers. `gather` reads the data, `build_pdf` is a pure function of it.
"""
import io
from datetime import datetime
from typing import Any, Dict, List
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

FOREST = colors.HexColor("#12372A")
EMERALD = colors.HexColor("#1F6B50")
MUTED = colors.HexColor("#5E655F")
LINE = colors.HexColor("#D9D6CC")
SOFT = colors.HexColor("#F4F0E7")


def _t(value: Any) -> str:
    """Text safe for a Paragraph: markup escaped, and characters the built-in PDF font cannot draw replaced."""
    text = "" if value is None else str(value)
    return escape(text.encode("latin-1", "replace").decode("latin-1"))


async def gather(user) -> Dict[str, Any]:
    """This student's own records, shaped for the report."""
    from app.repositories import resumes, users
    from app.services import readiness_service
    from app.services.recommendation_service import build_for_user

    doc = await users.get(user.id) or {}
    raw = (await readiness_service.load_raw([{**doc, "id": user.id}]))[user.id]
    result = readiness_service.compute(raw)
    assessments = sorted(raw["assessment_attempts"], key=lambda a: a.get("submitted_at") or datetime.min)
    latest = assessments[-1] if assessments else None
    resume = await resumes.latest(user.id)
    recs = await build_for_user(user)
    return {
        "name": doc.get("name") or user.name,
        "career_path": raw["career_path"],
        "generated_on": datetime.utcnow().strftime("%d %B %Y"),
        "readiness": result,
        "strengths": (latest or {}).get("strengths", []),
        "gaps": (latest or {}).get("skill_gaps", []),
        "latest_assessment": {"title": latest.get("assessment_title") or "Assessment", "score": int(latest.get("overall_score") or 0)} if latest else None,
        "resume": {
            "score": int(resume["overall_score"]), "date": resume["created_at"].strftime("%d %B %Y") if isinstance(resume.get("created_at"), datetime) else "",
            "fixes": resume.get("top_fixes") or [], "role": resume.get("career_path", ""),
        } if resume else None,
        "courses": recs.get("courses", []),
    }


def build_pdf(data: Dict[str, Any]) -> bytes:
    styles = getSampleStyleSheet()
    body = ParagraphStyle("body", parent=styles["BodyText"], fontName="Helvetica", fontSize=9.5, leading=13, textColor=colors.HexColor("#171A18"))
    small = ParagraphStyle("small", parent=body, fontSize=8, leading=10.5, textColor=MUTED)
    h1 = ParagraphStyle("h1", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=22, leading=26, textColor=FOREST, alignment=0, spaceAfter=2)
    h2 = ParagraphStyle("h2", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=13, leading=16, textColor=FOREST, spaceBefore=14, spaceAfter=6)
    big = ParagraphStyle("big", parent=body, fontName="Helvetica-Bold", fontSize=34, leading=38, textColor=EMERALD)

    def table(rows: List[List[Any]], widths, header=True) -> Table:
        t = Table(rows, colWidths=widths, repeatRows=1 if header else 0)
        style = [
            ("FONT", (0, 0), (-1, -1), "Helvetica", 8.5), ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#171A18")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LINEBELOW", (0, 0), (-1, -1), 0.4, LINE),
            ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]
        if header:
            style += [("FONT", (0, 0), (-1, 0), "Helvetica-Bold", 8.5), ("BACKGROUND", (0, 0), (-1, 0), SOFT), ("TEXTCOLOR", (0, 0), (-1, 0), FOREST)]
        t.setStyle(TableStyle(style))
        return t

    def cell(text, style=body):
        return Paragraph(_t(text), style)

    r = data["readiness"]
    story: List[Any] = [
        Paragraph("SkillSense AI career report", h1),
        Paragraph(f"{_t(data['name'])} &nbsp;|&nbsp; Career path: {_t(data['career_path'] or 'not chosen yet')} &nbsp;|&nbsp; {_t(data['generated_on'])}", small),
        Spacer(1, 8),
        Paragraph("Career readiness", h2),
        Paragraph(f"{int(r['overall'])}%", big),
        Paragraph("Computed from your own records: 40% assessments, 20% coding accuracy, 15% roadmap and courses, 15% resume (ATS-style score), 10% consistency. "
                  "A part with no data counts as 0." + ("" if r["has_data"] else " Nothing has been recorded yet, so every part is 0."), small),
        Spacer(1, 6),
    ]
    rows = [["Part", "Weight", "Value", "Points", "Based on"]] + [
        [cell(p["label"]), f"{p['weight']}%", f"{p['value']}%", f"{p['points']}", cell(p["detail"], small)] for p in r["parts"]
    ]
    story.append(table(rows, [42 * mm, 17 * mm, 17 * mm, 17 * mm, 80 * mm]))
    story.append(Spacer(1, 4))
    story.append(Paragraph(f"Current streak: {r['streak_days']} day(s). Active days in the last 14: {r['active_days_14']}. "
                           f"Problems solved: {r['problems_solved']} of {r['problems_attempted']} attempted. Assessments taken: {r['assessments_taken']}.", small))

    story.append(Paragraph("Strengths and gaps", h2))
    if data["latest_assessment"]:
        story.append(Paragraph(f"From your latest assessment: {_t(data['latest_assessment']['title'])} ({data['latest_assessment']['score']}%).", small))
        story.append(Spacer(1, 3))
        story.append(table([[cell("Strengths"), cell("Gaps")],
                            [cell(", ".join(data["strengths"]) or "None found in this assessment"), cell(", ".join(data["gaps"]) or "No gaps in this assessment")]],
                           [87 * mm, 87 * mm]))
    else:
        story.append(Paragraph("No assessment has been taken yet, so there are no strengths or gaps to show.", body))

    story.append(Paragraph("Latest resume (ATS-style score, an estimate)", h2))
    if data["resume"]:
        res = data["resume"]
        story.append(Paragraph(f"ATS-style score: <b>{res['score']}/100</b> for {_t(res['role'] or 'your target role')}"
                               + (f" (analysed {_t(res['date'])})" if res["date"] else "") + ". This is a rule-based estimate, not a real ATS result.", body))
        if res["fixes"]:
            story.append(Spacer(1, 4))
            story.append(table([["Top fixes", "Expected gain"]] + [[cell(f["title"]), f"+{f['points']} pts"] for f in res["fixes"]], [142 * mm, 32 * mm]))
        else:
            story.append(Paragraph("Analyse your resume again to see the ranked fixes here.", small))
    else:
        story.append(Paragraph("No resume has been analysed yet.", body))

    story.append(Paragraph("Recommended courses", h2))
    if data["courses"]:
        story.append(table([["Course", "Level", "Hours", "Why"]] + [
            [cell(c["title"]), c.get("level", ""), f"{c.get('estimated_hours', '')}", cell(c.get("reason", ""), small)] for c in data["courses"]
        ], [56 * mm, 22 * mm, 14 * mm, 82 * mm]))
    else:
        story.append(Paragraph("No courses are available yet.", body))

    story += [Spacer(1, 14), Paragraph("Generated by SkillSense AI from the student's own records. The ATS-style score is an estimate; readiness is a guide, not a hiring decision.", small)]

    buf = io.BytesIO()
    SimpleDocTemplate(buf, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=16 * mm, bottomMargin=16 * mm,
                      title="SkillSense AI career report", author="SkillSense AI").build(story)
    return buf.getvalue()
