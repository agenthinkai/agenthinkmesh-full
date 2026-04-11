"""
Generate AgenThink Mesh Technical DD PDF using ReportLab.
Clean, professional layout for Tier 1 enterprise audience.
"""
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor, black, white
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak,
    Table, TableStyle, HRFlowable, KeepTogether
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os

OUTPUT = "/home/ubuntu/agenthinkmesh-full/docs/AgenThinkMesh_Technical_DD_v1.0.pdf"

# Colour palette — minimal, professional
C_BLACK   = HexColor("#0A0A0A")
C_DARK    = HexColor("#1A1A2E")
C_ACCENT  = HexColor("#2563EB")   # clean blue
C_RULE    = HexColor("#D1D5DB")
C_LIGHT   = HexColor("#F9FAFB")
C_MUTED   = HexColor("#6B7280")
C_CODE_BG = HexColor("#F3F4F6")

W, H = A4
MARGIN = 2.2 * cm

doc = SimpleDocTemplate(
    OUTPUT,
    pagesize=A4,
    leftMargin=MARGIN,
    rightMargin=MARGIN,
    topMargin=MARGIN,
    bottomMargin=MARGIN,
    title="AgenThink Mesh — Technical Due Diligence",
    author="AgenThink",
    subject="Technical Architecture & System Overview",
)

styles = getSampleStyleSheet()

def style(name, **kw):
    return ParagraphStyle(name, **kw)

# Base styles
BASE = style("base", fontName="Helvetica", fontSize=10, leading=16,
             textColor=C_BLACK, spaceAfter=6)
BODY = style("body", parent=BASE, spaceAfter=8, leading=17)
BULLET = style("bullet", parent=BASE, leftIndent=16, bulletIndent=0,
               spaceAfter=5, leading=16)
CODE = style("code", fontName="Courier", fontSize=8.5, leading=13,
             textColor=HexColor("#1E293B"), backColor=C_CODE_BG,
             leftIndent=12, rightIndent=12, spaceBefore=4, spaceAfter=4,
             borderPadding=(6, 8, 6, 8))
MUTED = style("muted", parent=BASE, textColor=C_MUTED, fontSize=9)
LABEL = style("label", parent=BASE, textColor=C_MUTED, fontSize=9,
              fontName="Helvetica-Oblique")

# Heading styles
H1 = style("h1", fontName="Helvetica-Bold", fontSize=13, leading=18,
           textColor=C_DARK, spaceBefore=18, spaceAfter=6)
H2 = style("h2", fontName="Helvetica-Bold", fontSize=11, leading=15,
           textColor=C_ACCENT, spaceBefore=14, spaceAfter=5)
H3 = style("h3", fontName="Helvetica-Bold", fontSize=10, leading=14,
           textColor=C_BLACK, spaceBefore=8, spaceAfter=4)

# Cover styles
COVER_TITLE = style("cover_title", fontName="Helvetica-Bold", fontSize=28,
                    leading=34, textColor=C_DARK, alignment=TA_CENTER)
COVER_SUB   = style("cover_sub", fontName="Helvetica", fontSize=14,
                    leading=20, textColor=C_MUTED, alignment=TA_CENTER)
COVER_META  = style("cover_meta", fontName="Helvetica", fontSize=10,
                    leading=15, textColor=C_MUTED, alignment=TA_CENTER)
COVER_CONF  = style("cover_conf", fontName="Helvetica-Bold", fontSize=9,
                    leading=13, textColor=C_MUTED, alignment=TA_CENTER)

def rule(color=C_RULE, thickness=0.5, space_before=4, space_after=10):
    return HRFlowable(width="100%", thickness=thickness, color=color,
                      spaceAfter=space_after, spaceBefore=space_before)

def section_heading(num, title):
    return [
        Spacer(1, 0.3*cm),
        Paragraph(f"{num}. {title.upper()}", H1),
        rule(C_ACCENT, thickness=1, space_before=2, space_after=8),
    ]

def bullets(items):
    return [Paragraph(f"• {item}", BULLET) for item in items]

def code_block(lines):
    text = "<br/>".join(lines)
    return Paragraph(text, CODE)

# ── STORY ──────────────────────────────────────────────────────────────────────
story = []

# ── COVER PAGE ─────────────────────────────────────────────────────────────────
story.append(Spacer(1, 3.5*cm))
story.append(Paragraph("AgenThink Mesh", COVER_TITLE))
story.append(Spacer(1, 0.5*cm))
story.append(rule(C_ACCENT, thickness=2, space_before=0, space_after=12))
story.append(Paragraph("Technical Due Diligence", COVER_SUB))
story.append(Spacer(1, 0.3*cm))
story.append(Paragraph("Technical Architecture &amp; System Overview", COVER_META))
story.append(Spacer(1, 3.5*cm))

# Logo placeholder
logo_box = Table(
    [["[Space reserved for company logo]"]],
    colWidths=[8*cm], rowHeights=[2.5*cm]
)
logo_box.setStyle(TableStyle([
    ("ALIGN", (0,0), (-1,-1), "CENTER"),
    ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
    ("TEXTCOLOR", (0,0), (-1,-1), C_MUTED),
    ("FONTNAME", (0,0), (-1,-1), "Helvetica-Oblique"),
    ("FONTSIZE", (0,0), (-1,-1), 9),
    ("BOX", (0,0), (-1,-1), 0.5, C_RULE),
    ("BACKGROUND", (0,0), (-1,-1), C_LIGHT),
]))
story.append(Table([[logo_box]], colWidths=[W - 2*MARGIN]))
story.append(Spacer(1, 3.5*cm))

story.append(rule(C_RULE))
story.append(Spacer(1, 0.3*cm))
story.append(Paragraph("Version: v1.0 — April 2026", COVER_META))
story.append(Spacer(1, 0.6*cm))
story.append(Paragraph(
    "<b>CONFIDENTIAL</b><br/>"
    "Provided for technical evaluation purposes only.<br/>"
    "Not for redistribution.",
    COVER_CONF
))

story.append(PageBreak())

# ── DOCUMENT HEADER (page 2+) ──────────────────────────────────────────────────
story.append(Paragraph("AgenThink Mesh — Technical Due Diligence", H2))
meta_data = [
    ["Document Type:", "Internal preparation — technical DD base"],
    ["Audience:", "Product Lead / Tech Lead, Tier 1 enterprise evaluation"],
    ["Date:", "April 2026"],
    ["Status:", "v1.0 — Approved for external technical review"],
]
meta_table = Table(meta_data, colWidths=[4*cm, W - 2*MARGIN - 4*cm])
meta_table.setStyle(TableStyle([
    ("FONTNAME", (0,0), (0,-1), "Helvetica-Bold"),
    ("FONTNAME", (1,0), (1,-1), "Helvetica"),
    ("FONTSIZE", (0,0), (-1,-1), 9),
    ("TEXTCOLOR", (0,0), (0,-1), C_MUTED),
    ("TEXTCOLOR", (1,0), (1,-1), C_BLACK),
    ("TOPPADDING", (0,0), (-1,-1), 3),
    ("BOTTOMPADDING", (0,0), (-1,-1), 3),
    ("VALIGN", (0,0), (-1,-1), "TOP"),
]))
story.append(meta_table)
story.append(rule())

# ── 1. SYSTEM ARCHITECTURE ─────────────────────────────────────────────────────
story.extend(section_heading("1", "System Architecture"))
story.append(Paragraph(
    "AgenThink Mesh is structured as a modular, server-side evaluation pipeline. "
    "Data enters as user-provided text or files, is processed and structured by the API layer, "
    "evaluated by the councilEngine, aggregated via consensus logic, persisted to a relational "
    "database, and returned as a structured report or UI output.",
    BODY
))
story.append(Paragraph("Data Flow", H3))
story.append(code_block([
    "Client Browser",
    "  → Input (text / uploaded files)",
    "  → tRPC API Layer (typed procedures, server-side)",
    "  → Parsing + Structuring (schema normalization)",
    "  → councilEngine.ts (parallel evaluation orchestration)",
    "  → LLM API Layer (model calls)",
    "  → Consensus Logic (server-side aggregation)",
    "  → MySQL Database (session + deal storage)",
    "  → Report Generation + Output",
]))
story.append(Spacer(1, 0.2*cm))
story.append(Paragraph(
    "LLM calls occur exclusively within the councilEngine orchestration layer. "
    "The model layer is abstracted from core business logic.",
    BODY
))
story.append(Paragraph(
    "The system is modular. Components can be modified or replaced without affecting the overall workflow.",
    BODY
))

# ── 2. MODEL SELECTION & WORKFLOW ──────────────────────────────────────────────
story.extend(section_heading("2", "Model Selection & Workflow"))
story.append(Paragraph(
    'Evaluation is structured as a multi-perspective analysis across ten defined analytical roles ("Council of 10"). '
    "Each role represents a distinct analytical lens — for example: financial risk, market positioning, "
    "regulatory exposure, operational feasibility.",
    BODY
))
story.extend(bullets([
    "Roles are defined in prompt architecture, not hardcoded to any model",
    "Each perspective executes independently and in parallel",
    "Outputs are constrained to structured formats",
    "Free-form generation is not used",
]))
story.append(Spacer(1, 0.2*cm))
story.append(Paragraph(
    "Final decisions are derived via server-side consensus logic, not a single model output.",
    BODY
))
story.append(Paragraph(
    "The council architecture and consensus methodology are model-agnostic and not dependent on any single LLM provider. "
    "The system can operate with alternative models, including locally hosted or region-compliant LLMs.",
    BODY
))
story.append(Paragraph(
    "The system is designed to structure decisions, not predict outcomes.",
    BODY
))

# ── 3. DATA HANDLING & VALIDATION ─────────────────────────────────────────────
story.extend(section_heading("3", "Data Handling & Validation"))
story.extend(bullets([
    "All inputs are user-provided",
    "No external proprietary datasets are used unless explicitly integrated",
    "Outputs are grounded strictly in provided inputs",
    "No financial or market data is fabricated",
]))
story.append(Paragraph(
    "Where data is missing, the system explicitly flags gaps rather than making assumptions.",
    BODY
))
story.extend(bullets([
    "No client data is used for model training",
    "Each session is isolated",
    "No cross-client data reuse occurs",
]))

# ── 4. RELIABILITY & CONSISTENCY ──────────────────────────────────────────────
story.extend(section_heading("4", "Reliability & Consistency"))
story.append(Paragraph("The evaluation structure is fixed across all use cases.", BODY))
story.extend(bullets([
    "Each perspective follows a constrained output format",
    "Aggregation occurs across multiple independent outputs",
    "Dependence on a single model output is reduced",
]))
story.append(Paragraph(
    "LLM variance is acknowledged. The architecture mitigates this through structured prompting, "
    "multi-perspective evaluation, and deterministic aggregation logic.",
    BODY
))
story.append(Paragraph(
    "The system is designed to enforce structured reasoning and reduce variability.",
    BODY
))

# ── 5. DATA SECURITY & COMPLIANCE ─────────────────────────────────────────────
story.extend(section_heading("5", "Data Security & Compliance"))
story.extend(bullets([
    "Data is used only within the session in which it is submitted",
    "No data is shared across clients",
    "No data is used for model training or fine-tuning",
    "No third-party analytics or tracking is applied",
]))
story.append(Paragraph("The system can be deployed in controlled environments:", BODY))
story.extend(bullets([
    "Private cloud",
    "Enterprise VPC",
    "Locally hosted infrastructure",
]))
story.append(Spacer(1, 0.2*cm))
story.append(Paragraph(
    "<b>Certifications:</b> No SOC 2, ISO 27001, or equivalent certifications are currently in place.",
    BODY
))

# ── 6. LIMITATIONS ────────────────────────────────────────────────────────────
story.extend(section_heading("6", "Limitations"))
story.extend(bullets([
    "Output quality depends on input quality",
    "The system does not guarantee correctness",
    "The system does not predict outcomes",
    "The system supports decision-making; it does not replace it",
]))
story.append(Paragraph(
    "LLM inference introduces non-determinism. Identical inputs may produce outputs within a controlled variance range.",
    BODY
))

# ── 7. CORE INTELLECTUAL PROPERTY ─────────────────────────────────────────────
story.extend(section_heading("7", "Core Intellectual Property"))
story.append(Paragraph("Core IP includes:", BODY))
story.extend(bullets([
    "Multi-perspective evaluation framework (Council of 10)",
    "Prompt architecture and orchestration logic",
    "Consensus and aggregation methodology",
    "End-to-end evaluation workflow",
]))
story.append(Paragraph(
    "These components are independent of hosting infrastructure.",
    BODY
))
story.append(Paragraph(
    "The codebase is version-controlled in a private repository under the control of the founding entity.",
    BODY
))

# ── 8. PORTABILITY ────────────────────────────────────────────────────────────
story.extend(section_heading("8", "Portability"))
story.append(Paragraph(
    "Current deployment uses managed infrastructure (hosting, database, domain). "
    "This is an operational dependency, not an architectural constraint.",
    BODY
))
story.append(Paragraph("Stack:", H3))
stack_data = [
    ["Layer", "Technology"],
    ["Backend", "Node.js (Express + tRPC)"],
    ["Frontend", "React 19 + Vite"],
    ["Database", "MySQL-compatible (TiDB)"],
    ["LLM Layer", "Abstracted API integration"],
]
stack_table = Table(stack_data, colWidths=[4*cm, W - 2*MARGIN - 4*cm])
stack_table.setStyle(TableStyle([
    ("BACKGROUND", (0,0), (-1,0), C_DARK),
    ("TEXTCOLOR", (0,0), (-1,0), white),
    ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"),
    ("FONTSIZE", (0,0), (-1,-1), 9),
    ("FONTNAME", (0,1), (0,-1), "Helvetica-Bold"),
    ("FONTNAME", (1,1), (1,-1), "Helvetica"),
    ("TEXTCOLOR", (0,1), (-1,-1), C_BLACK),
    ("ROWBACKGROUNDS", (0,1), (-1,-1), [white, C_LIGHT]),
    ("TOPPADDING", (0,0), (-1,-1), 6),
    ("BOTTOMPADDING", (0,0), (-1,-1), 6),
    ("LEFTPADDING", (0,0), (-1,-1), 10),
    ("RIGHTPADDING", (0,0), (-1,-1), 10),
    ("GRID", (0,0), (-1,-1), 0.4, C_RULE),
    ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
]))
story.append(stack_table)
story.append(Spacer(1, 0.3*cm))
story.append(Paragraph(
    "No platform-specific lock-in exists. Migration to AWS, Azure, GCP, or Alibaba Cloud "
    "requires standard DevOps work only.",
    BODY
))

# ── 9. ARCHITECTURE DIAGRAM ───────────────────────────────────────────────────
story.extend(section_heading("9", "Architecture Diagram"))
story.append(code_block([
    "Client (React frontend)",
    "        ↓",
    "tRPC API Layer (server-side)",
    "        ↓",
    "Parsing + Structuring",
    "        ↓",
    "councilEngine (10 parallel evaluations)",
    "        ↓",
    "LLM API Layer (abstracted)",
    "        ↓",
    "Consensus Logic (server-side aggregation)",
    "        ↓",
    "Database (MySQL-compatible)",
    "        ↓",
    "Report Generation / UI Output",
]))
story.append(Spacer(1, 0.2*cm))
story.append(Paragraph(
    "All evaluation logic executes server-side. No decision logic is executed on the client.",
    BODY
))

# ── POSITIONING NOTE ──────────────────────────────────────────────────────────
story.append(Spacer(1, 0.6*cm))
story.append(rule(C_ACCENT, thickness=1))
note_box = Table(
    [[
        Paragraph(
            "<b>Positioning Note</b><br/><br/>"
            "AgenThink Mesh is not a model. It is a structured decision layer that operates on top of LLM systems.<br/><br/>"
            "The architecture is designed to integrate with multiple model providers, including enterprise "
            "or region-specific LLM stacks.",
            style("note", parent=BODY, fontSize=10, leading=16, textColor=C_DARK)
        )
    ]],
    colWidths=[W - 2*MARGIN]
)
note_box.setStyle(TableStyle([
    ("BACKGROUND", (0,0), (-1,-1), C_LIGHT),
    ("TOPPADDING", (0,0), (-1,-1), 14),
    ("BOTTOMPADDING", (0,0), (-1,-1), 14),
    ("LEFTPADDING", (0,0), (-1,-1), 16),
    ("RIGHTPADDING", (0,0), (-1,-1), 16),
    ("BOX", (0,0), (-1,-1), 1, C_ACCENT),
]))
story.append(note_box)

# ── FOOTER NOTE ───────────────────────────────────────────────────────────────
story.append(Spacer(1, 1.2*cm))
story.append(rule())
story.append(Paragraph(
    "This document reflects the current implemented state of the system. "
    "Features not yet implemented are not described.",
    MUTED
))

# ── BUILD ─────────────────────────────────────────────────────────────────────
doc.build(story)
print(f"PDF generated: {OUTPUT}")
