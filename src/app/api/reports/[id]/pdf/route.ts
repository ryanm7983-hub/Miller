import { NextResponse } from 'next/server';
import PDFDocument from 'pdfkit';

import { prisma } from '@/lib/db';
import { getTenant } from '@/lib/tenant';
import { recordAudit } from '@/lib/audit-log';
import { parseJson } from '@/lib/json';
import type { ReportPayload } from '@/lib/reports';
import {
  ACTION_STATUS_META,
  AUDIT_TYPE_LABELS,
  REQUIREMENT_STATUS_META,
  RISK_LEVEL_META,
  SEVERITY_META,
  type ActionStatus,
  type AuditType,
  type RequirementStatus,
  type RiskLevel,
  type Severity,
} from '@/lib/enums';

export const runtime = 'nodejs';

/** Palette matched to the on-screen report. */
const INK = '#151B26';
const MUTED = '#6B7788';
const RULE = '#E2E6EC';
const KELP = '#0A6659';

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: '#B42318',
  HIGH: '#D92D20',
  MEDIUM: '#DC6803',
  LOW: '#1570EF',
};

function scoreColor(score: number): string {
  if (score >= 80) return '#039855';
  if (score >= 55) return '#DC6803';
  return '#D92D20';
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Server-rendered PDF export.
 *
 * Built with pdfkit rather than headless-browser printing so exports work in
 * any deployment target (including serverless) with no extra binaries.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const tenant = await getTenant();
  if (!tenant) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const { id } = await context.params;
  const report = await prisma.auditReport.findFirst({
    where: { id, orgId: tenant.orgId },
    include: { generatedBy: { select: { name: true } } },
  });
  if (!report) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  const data = parseJson<ReportPayload | null>(report.data, null);
  if (!data) return NextResponse.json({ error: 'This report could not be read.' }, { status: 500 });

  await recordAudit({
    orgId: tenant.orgId,
    userId: tenant.user.id,
    action: 'report.exported',
    entityType: 'AuditReport',
    entityId: report.id,
    metadata: { format: 'pdf' },
  });

  const buffer = await renderPdf(report.title, report.generatedBy.name, data);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${slug(report.title)}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'audit-report';
}

function renderPdf(title: string, generatedBy: string, data: ReportPayload): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 56, bottom: 64, left: 56, right: 56 },
      info: { Title: title, Author: 'AuditReady', Subject: 'Audit preparation report' },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = doc.page.margins.left;
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    const rule = (gap = 10) => {
      doc.moveDown(gap / 12);
      doc.strokeColor(RULE).lineWidth(0.8).moveTo(left, doc.y).lineTo(left + width, doc.y).stroke();
      doc.moveDown(0.7);
    };

    const heading = (text: string) => {
      ensureSpace(doc, 70);
      doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(9).text(text.toUpperCase(), { characterSpacing: 0.8 });
      doc.moveDown(0.45);
      doc.fillColor(INK).font('Helvetica').fontSize(10);
    };

    // ---------------------------------------------------------------- header
    doc.fillColor(KELP).font('Helvetica-Bold').fontSize(8.5).text('AUDIT PREPARATION REPORT', { characterSpacing: 1.1 });
    doc.moveDown(0.35);
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(20).text(data.organization.name);
    doc.moveDown(0.15);
    doc
      .fillColor(MUTED)
      .font('Helvetica')
      .fontSize(10.5)
      .text(`${data.project.name} · ${data.project.framework} v${data.project.frameworkVersion}`);
    doc.moveDown(0.15);
    doc
      .fontSize(9)
      .text(
        `Generated ${formatDate(data.generatedAt)} by ${generatedBy}` +
          (data.project.auditDate ? `  ·  Audit date ${formatDate(data.project.auditDate)}` : '') +
          (data.project.daysUntilAudit !== null
            ? `  ·  ${data.project.daysUntilAudit >= 0 ? `${data.project.daysUntilAudit} days remaining` : `${Math.abs(data.project.daysUntilAudit)} days past`}`
            : '')
      );
    rule(14);

    // -------------------------------------------------------------- headline
    const headlineY = doc.y;
    doc.fillColor(scoreColor(data.readiness.score)).font('Helvetica-Bold').fontSize(46).text(`${data.readiness.score}%`, left, headlineY, { width: 150 });
    doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(8.5).text('AUDIT READINESS', left, doc.y - 4, { width: 150, characterSpacing: 0.8 });

    const summaryX = left + 170;
    let summaryY = headlineY + 2;
    const summaryRows: Array<[string, string]> = [
      ['Audit type', AUDIT_TYPE_LABELS[data.project.auditType as AuditType] ?? data.project.auditType],
      ['Internal audit risk', `${RISK_LEVEL_META[data.readiness.riskLevel as RiskLevel].label} (${data.readiness.riskScore}/100)`],
      ['Requirements in scope', `${data.readiness.total} (${data.readiness.assessed} assessed)`],
      ['Evidence items', `${data.evidence.total} (${data.evidence.accepted} accepted, ${data.evidence.expired} expired)`],
      ['Open actions', `${data.actions.open} (${data.actions.overdue} overdue)`],
    ];
    for (const [label, value] of summaryRows) {
      doc.fillColor(MUTED).font('Helvetica').fontSize(8.5).text(label, summaryX, summaryY, { width: 130 });
      doc.fillColor(INK).font('Helvetica-Bold').fontSize(9.5).text(value, summaryX + 135, summaryY, { width: width - 305 });
      summaryY += 17;
    }
    doc.y = Math.max(doc.y, summaryY) + 6;
    rule(12);

    // ------------------------------------------------------ requirement mix
    heading('Requirement status');
    for (const status of Object.keys(data.readiness.counts) as RequirementStatus[]) {
      const meta = REQUIREMENT_STATUS_META[status];
      if (!meta) continue;
      const count = data.readiness.counts[status] ?? 0;
      doc.fillColor(INK).font('Helvetica').fontSize(10).text(meta.label, left + 4, doc.y, { continued: true, width: width - 60 });
      doc.font('Helvetica-Bold').text(String(count), { align: 'right' });
      doc.moveDown(0.18);
    }
    doc.moveDown(0.4);
    doc
      .fillColor(MUTED)
      .fontSize(8.5)
      .text(
        'Readiness is weighted by requirement importance and counts only evidence a person has approved.' +
          (data.links.pending > 0
            ? ` ${data.links.pending} suggested match(es) were awaiting human review and are excluded from the score.`
            : '')
      );
    rule(12);

    // ------------------------------------------------------------- the gaps
    heading(`Major gaps and high-risk items (${data.majorGaps.length})`);
    if (data.majorGaps.length === 0) {
      doc.fillColor(INK).fontSize(10).text('No open gaps were recorded when this report was generated.');
    } else {
      for (const gap of data.majorGaps.slice(0, 30)) {
        ensureSpace(doc, 68);
        const severityLabel = SEVERITY_META[gap.severity as Severity]?.label ?? gap.severity;
        doc
          .fillColor(SEVERITY_COLORS[gap.severity] ?? MUTED)
          .font('Helvetica-Bold')
          .fontSize(8)
          .text(severityLabel.toUpperCase(), left, doc.y, { width: 60, continued: true, characterSpacing: 0.6 });
        doc.fillColor(INK).font('Helvetica-Bold').fontSize(10).text(`  ${gap.title}`, { width: width - 60 });
        doc.fillColor(MUTED).font('Helvetica').fontSize(9).text(gap.description, left + 4, doc.y + 1, { width: width - 8 });
        const meta = [gap.typeLabel, gap.requirement, gap.owner ? `owner ${gap.owner}` : null, gap.dueDate ? `due ${formatDate(gap.dueDate)}` : null]
          .filter(Boolean)
          .join('  ·  ');
        if (meta) doc.fillColor('#98A3B3').fontSize(8).text(meta, left + 4, doc.y + 1, { width: width - 8 });
        doc.moveDown(0.6);
      }
      if (data.majorGaps.length > 30) {
        doc.fillColor(MUTED).fontSize(8.5).text(`${data.majorGaps.length - 30} further gap(s) omitted.`);
      }
    }
    rule(12);

    // ---------------------------------------------------------- open actions
    heading(`Open actions (${data.openActions.length})`);
    if (data.openActions.length === 0) {
      doc.fillColor(INK).fontSize(10).text('No open actions were recorded when this report was generated.');
    } else {
      const cols = [58, width - 268, 90, 60, 60];
      ensureSpace(doc, 40);
      doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(8);
      let x = left;
      for (const [i, label] of ['REF', 'ACTION', 'OWNER', 'DUE', 'STATUS'].entries()) {
        doc.text(label, x, doc.y, { width: cols[i], continued: i < 4 });
        x += cols[i];
      }
      doc.text('');
      doc.moveDown(0.3);

      for (const action of data.openActions.slice(0, 40)) {
        ensureSpace(doc, 26);
        const rowY = doc.y;
        doc.font('Helvetica').fontSize(8.5).fillColor(MUTED).text(action.reference, left, rowY, { width: cols[0] });
        doc.fillColor(INK).text(action.title, left + cols[0], rowY, { width: cols[1] });
        doc.fillColor(MUTED).text(action.owner ?? '—', left + cols[0] + cols[1], rowY, { width: cols[2] });
        doc
          .fillColor(action.overdue ? SEVERITY_COLORS.HIGH : MUTED)
          .text(action.dueDate ? formatDate(action.dueDate) : '—', left + cols[0] + cols[1] + cols[2], rowY, { width: cols[3] });
        doc
          .fillColor(MUTED)
          .text(
            ACTION_STATUS_META[action.status as ActionStatus]?.label ?? action.status,
            left + cols[0] + cols[1] + cols[2] + cols[3],
            rowY,
            { width: cols[4] }
          );
        doc.moveDown(0.35);
      }
      if (data.openActions.length > 40) {
        doc.fillColor(MUTED).fontSize(8.5).text(`${data.openActions.length - 40} further action(s) omitted.`);
      }
    }
    rule(12);

    // ------------------------------------------- requirements needing review
    heading(`Requirements needing attention (${data.requirementsNeedingReview.length})`);
    if (data.requirementsNeedingReview.length === 0) {
      doc.fillColor(INK).fontSize(10).text('Every requirement in scope was satisfied or marked not applicable.');
    } else {
      for (const requirement of data.requirementsNeedingReview.slice(0, 60)) {
        ensureSpace(doc, 20);
        const rowY = doc.y;
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(MUTED).text(requirement.identifier, left, rowY, { width: 70 });
        doc.font('Helvetica').fillColor(INK).text(requirement.title, left + 74, rowY, { width: width - 220 });
        doc
          .fillColor(MUTED)
          .text(
            REQUIREMENT_STATUS_META[requirement.status as RequirementStatus]?.label ?? requirement.status,
            left + width - 140,
            rowY,
            { width: 140, align: 'right' }
          );
        doc.moveDown(0.3);
      }
      if (data.requirementsNeedingReview.length > 60) {
        doc.fillColor(MUTED).fontSize(8.5).text(`${data.requirementsNeedingReview.length - 60} further requirement(s) omitted.`);
      }
    }
    rule(12);

    // ------------------------------------------------------- recommendations
    heading('Recommendations');
    for (const [index, recommendation] of data.recommendations.entries()) {
      ensureSpace(doc, 46);
      doc.fillColor(KELP).font('Helvetica-Bold').fontSize(9.5).text(`${index + 1}.`, left, doc.y, { width: 18, continued: true });
      doc.fillColor(INK).font('Helvetica').fontSize(9.5).text(` ${recommendation}`, { width: width - 18 });
      doc.moveDown(0.45);
    }
    rule(12);

    // ------------------------------------------------------------ disclaimer
    ensureSpace(doc, 110);
    doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(8.5).text('IMPORTANT', { characterSpacing: 0.8 });
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(8.5).text(data.disclaimer, { width, lineGap: 1.5 });
    doc.moveDown(0.6);
    doc
      .fillColor('#98A3B3')
      .fontSize(7.5)
      .text(
        `Analysis engine: ${data.aiProvider.name} (${data.aiProvider.model}). ` +
          (data.aiProvider.live
            ? 'AI-assisted assessments were produced by a live model; only conclusions explicitly approved by a person are counted as verified.'
            : 'AI-assisted assessments were produced by the deterministic built-in engine.')
      );

    // Page numbers across the whole document.
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc
        .fillColor('#98A3B3')
        .font('Helvetica')
        .fontSize(7.5)
        .text(
          `AuditReady · ${data.organization.name} · ${data.project.name}`,
          left,
          doc.page.height - 44,
          { width: width - 60, lineBreak: false }
        );
      doc.text(`${i - range.start + 1} / ${range.count}`, left + width - 60, doc.page.height - 44, {
        width: 60,
        align: 'right',
        lineBreak: false,
      });
    }

    doc.end();
  });
}

/** Adds a page break when the remaining space is too small for the next block. */
function ensureSpace(doc: PDFKit.PDFDocument, needed: number) {
  if (doc.y + needed > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
  }
}
