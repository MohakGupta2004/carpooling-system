import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';

import type { MyReport, OrgAnalytics } from './reports.service.js';

/**
 * Fonts: GoogleSans when the .ttf files are bundled, otherwise pdfkit's
 * built-in Helvetica. The brand fonts are not redistributable, so a deployment
 * without them must still be able to render a report rather than 500.
 */
const FONT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../assets/fonts'
);
const FONTS = {
  GS: { file: path.join(FONT_DIR, 'GoogleSans-Regular.ttf'), fallback: 'Helvetica' },
  'GS-Medium': { file: path.join(FONT_DIR, 'GoogleSans-Medium.ttf'), fallback: 'Helvetica' },
  'GS-Semi': { file: path.join(FONT_DIR, 'GoogleSans-SemiBold.ttf'), fallback: 'Helvetica-Bold' },
  'GS-Bold': { file: path.join(FONT_DIR, 'GoogleSans-Bold.ttf'), fallback: 'Helvetica-Bold' },
} as const;

// ── Layout constants (A4 portrait) ──────────────────────────────────────────
const MARGIN = 40;
const LEFT = MARGIN;
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const CW = PAGE_W - MARGIN * 2; // content width
const PAGE_BOTTOM = PAGE_H - MARGIN - 16;

// ── Palette (Workway teal + chart hues) ───────────────────────────────────
const P = {
  teal: '#0d9488',
  tealDark: '#0f766e',
  blue: '#2563eb',
  amber: '#f59e0b',
  violet: '#7c3aed',
  rose: '#e11d48',
  ink: '#0f172a',
  dark: '#1e293b',
  gray: '#64748b',
  muted: '#94a3b8',
  slate: '#f1f5f9',
  border: '#e2e8f0',
  white: '#ffffff',
};
const CHART = [P.teal, P.blue, P.amber, P.violet, P.rose];
const inr = (paise: number) => `Rs ${Math.round(paise / 100).toLocaleString('en-IN')}`;

// hugeicons Leaf01 (the sidebar brand mark) — 2 stroked paths on a 24×24 grid.
const LEAF_PATHS = [
  'M7.64584 15.7108C7.23279 14.8966 7 13.9755 7 13C7 9.78484 9.5 7.5 13 7C17.0817 6.4169 18.8333 4.16667 20 3C23.5 16 17 19 13 19C11.9071 19 10.8825 18.7078 10 18.1973',
  'M3 21C3.5 18 5.45791 16.1355 10 15C13.2167 14.1958 15.4634 12.1791 17 10.0549',
];

export interface ReportMeta {
  companyName: string;
  companyLogo: Buffer | null;
  rangeLabel: string;
  generatedBy: string;
}

// ── Primitives ──────────────────────────────────────────────────────────────
function newDoc() {
  const doc = new PDFDocument({
    size: 'A4',
    layout: 'portrait',
    margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
    bufferPages: true,
    info: { Title: 'Workway Analytics Report', Author: 'Workway' },
  });
  for (const [name, { file, fallback }] of Object.entries(FONTS)) {
    doc.registerFont(name, fs.existsSync(file) ? file : fallback);
  }
  return doc;
}

function bufferDoc(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

/** Workway brand: the sidebar leaf (hugeicons Leaf01) in a teal rounded square. */
function drawLeafMark(doc: PDFKit.PDFDocument, x: number, y: number, s: number) {
  doc.save();
  doc.roundedRect(x, y, s, s, s * 0.26).fill(P.teal);
  // Center the 24×24 icon at ~60% of the box and stroke it white, like the sidebar.
  const icon = s * 0.6;
  const pad = (s - icon) / 2;
  const scale = icon / 24;
  doc.translate(x + pad, y + pad).scale(scale);
  doc.strokeColor(P.white).lineWidth(2).lineCap('round').lineJoin('round');
  for (const d of LEAF_PATHS) doc.path(d).stroke();
  doc.restore();
}

function drawHeader(doc: PDFKit.PDFDocument, meta: ReportMeta): number {
  const y = MARGIN;
  doc.save();

  // Left: Workway leaf brand
  drawLeafMark(doc, LEFT, y, 34);
  doc.font('GS-Bold').fontSize(17).fillColor(P.ink);
  doc.text('Workway', LEFT + 44, y + 4, { lineBreak: false });
  doc.font('GS').fontSize(8).fillColor(P.gray);
  doc.text('Enterprise Carpooling', LEFT + 44, y + 22, { lineBreak: false });

  // Right: company logo (if any) + company name
  const rightW = 200;
  const rightX = LEFT + CW - rightW;
  let logoW = 0;
  if (meta.companyLogo) {
    try {
      doc.image(meta.companyLogo, rightX + rightW - 34, y, {
        fit: [34, 34],
        align: 'right',
        valign: 'center',
      });
      logoW = 40;
    } catch {
      /* ignore bad image */
    }
  }
  doc.font('GS-Bold').fontSize(11).fillColor(P.ink);
  doc.text(meta.companyName, rightX, y + 3, {
    width: rightW - logoW,
    align: 'right',
    lineBreak: false,
    ellipsis: true,
  });
  doc.font('GS').fontSize(8).fillColor(P.gray);
  doc.text('Organization Analytics Report', rightX, y + 20, {
    width: rightW - logoW,
    align: 'right',
    lineBreak: false,
  });

  // Separator
  doc
    .strokeColor(P.border)
    .lineWidth(0.6)
    .moveTo(LEFT, y + 44)
    .lineTo(LEFT + CW, y + 44)
    .stroke();

  // Metadata bar
  const barY = y + 54;
  doc.roundedRect(LEFT, barY, CW, 24, 4).fill(P.slate);
  doc.font('GS-Bold').fontSize(8).fillColor(P.tealDark);
  doc.text('PERIOD', LEFT + 10, barY + 5, { lineBreak: false });
  doc.font('GS').fontSize(8).fillColor(P.dark);
  doc.text(meta.rangeLabel, LEFT + 48, barY + 5, { lineBreak: false });
  doc.font('GS').fontSize(7.5).fillColor(P.gray);
  doc.text(
    `Generated ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}  ·  by ${meta.generatedBy}`,
    LEFT + CW - 260,
    barY + 6,
    { width: 250, align: 'right', lineBreak: false }
  );

  doc.restore();
  return barY + 38;
}

function ensureSpace(doc: PDFKit.PDFDocument, y: number, needed: number): number {
  if (y + needed > PAGE_BOTTOM) {
    doc.addPage();
    return MARGIN;
  }
  return y;
}

function drawSectionTitle(doc: PDFKit.PDFDocument, y: number, title: string): number {
  y = ensureSpace(doc, y, 40);
  doc.save();
  doc.roundedRect(LEFT, y, CW, 22, 5).fill(P.ink);
  doc.rect(LEFT, y + 5, 3, 12).fill(P.teal);
  doc.font('GS-Bold').fontSize(9).fillColor(P.white);
  doc.text(title.toUpperCase(), LEFT + 12, y + 6, { width: CW - 20, lineBreak: false });
  doc.restore();
  return y + 32;
}

function drawMetricCards(
  doc: PDFKit.PDFDocument,
  y: number,
  metrics: { label: string; value: string; color: string }[]
): number {
  const cols = 4;
  const gap = 8;
  const boxW = (CW - (cols - 1) * gap) / cols;
  const boxH = 54;
  const rows = Math.ceil(metrics.length / cols);
  y = ensureSpace(doc, y, rows * (boxH + gap));

  metrics.forEach((m, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = LEFT + col * (boxW + gap);
    const boxY = y + row * (boxH + gap);
    doc.save();
    doc.roundedRect(x, boxY, boxW, boxH, 6).fill(P.slate);
    doc.rect(x, boxY + 9, 3, boxH - 18).fill(m.color);
    doc.font('GS').fontSize(7).fillColor(P.gray);
    doc.text(m.label.toUpperCase(), x + 11, boxY + 11, { width: boxW - 18, lineBreak: false });
    doc.font('GS-Bold').fontSize(16).fillColor(P.ink);
    doc.text(m.value, x + 11, boxY + 25, { width: boxW - 18, lineBreak: false });
    doc.restore();
  });
  return y + rows * (boxH + gap) + 6;
}

function drawBarChart(
  doc: PDFKit.PDFDocument,
  y: number,
  title: string,
  items: { label: string; value: number; display?: string; color?: string }[]
): number {
  y = ensureSpace(doc, y, 22 + items.length * 19);
  doc.font('GS-Bold').fontSize(8.5).fillColor(P.dark);
  doc.text(title, LEFT, y);
  y += 16;

  const maxVal = Math.max(...items.map((i) => i.value), 1);
  const labelW = 116;
  const barMaxW = CW - labelW - 46;
  const BAR_H = 13;
  const GAP = 6;

  items.forEach((item, idx) => {
    const barW = Math.max((item.value / maxVal) * barMaxW, item.value > 0 ? 2 : 0);
    doc.font('GS').fontSize(7.5).fillColor(P.dark);
    doc.text(item.label, LEFT, y + 2.5, { width: labelW - 6, lineBreak: false, ellipsis: true });
    doc.save();
    doc.roundedRect(LEFT + labelW, y, barMaxW, BAR_H, 3).fill(P.border);
    if (barW > 0)
      doc
        .roundedRect(LEFT + labelW, y, barW, BAR_H, 3)
        .fill(item.color ?? CHART[idx % CHART.length]);
    doc.restore();
    doc.font('GS-Bold').fontSize(7.5).fillColor(P.dark);
    doc.text(item.display ?? String(item.value), LEFT + labelW + barMaxW + 6, y + 2.5, {
      width: 40,
      lineBreak: false,
    });
    y += BAR_H + GAP;
  });
  return y + 8;
}

interface TableCol {
  header: string;
  width: number;
  align?: 'left' | 'right';
}

function drawTable(
  doc: PDFKit.PDFDocument,
  y: number,
  title: string,
  columns: TableCol[],
  rows: string[][]
): number {
  if (title) {
    y = ensureSpace(doc, y, 40);
    doc.font('GS-Bold').fontSize(8.5).fillColor(P.dark);
    doc.text(title, LEFT, y);
    y += 14;
  }
  const HDR_H = 20;
  const ROW_H = 19;
  const FS = 7.5;
  const PAD = 7;
  const totalW = columns.reduce((s, c) => s + c.width, 0);

  const drawHdr = () => {
    doc.save();
    doc.roundedRect(LEFT, y, totalW, HDR_H, 4).fill(P.teal);
    let x = LEFT;
    doc.font('GS-Bold').fontSize(FS).fillColor(P.white);
    for (const c of columns) {
      doc.text(c.header, x + PAD, y + 6, {
        width: c.width - PAD * 2,
        align: c.align ?? 'left',
        lineBreak: false,
        ellipsis: true,
      });
      x += c.width;
    }
    doc.restore();
    y += HDR_H + 2;
  };

  y = ensureSpace(doc, y, HDR_H + ROW_H * 2);
  drawHdr();
  rows.forEach((r, i) => {
    if (y + ROW_H > PAGE_BOTTOM) {
      doc.addPage();
      y = MARGIN;
      drawHdr();
    }
    doc.save();
    doc.roundedRect(LEFT, y, totalW, ROW_H, 3).fill(i % 2 === 0 ? '#f7fafc' : P.white);
    doc.restore();
    let x = LEFT;
    columns.forEach((c, j) => {
      doc.font('GS').fontSize(FS).fillColor(P.dark);
      doc.text(r[j] ?? '', x + PAD, y + 5.5, {
        width: c.width - PAD * 2,
        align: c.align ?? 'left',
        lineBreak: false,
        ellipsis: true,
      });
      x += c.width;
    });
    y += ROW_H + 1.5;
  });
  return y + 8;
}

function drawFooter(doc: PDFKit.PDFDocument, company: string) {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);
    const oldBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.save();
    doc.font('GS').fontSize(6.5).fillColor(P.muted);
    doc.text(
      `Workway Analytics  ·  ${company}  ·  Page ${i + 1} of ${range.count}  ·  Confidential`,
      LEFT,
      PAGE_H - MARGIN + 6,
      { width: CW, align: 'center', lineBreak: false }
    );
    doc.restore();
    doc.page.margins.bottom = oldBottom;
  }
}

const hourLabel = (h: number) => `${String(h).padStart(2, '0')}:00`;
const monthLabel = (m: string) => {
  const [y, mo] = m.split('-');
  return `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+mo! - 1]} ${y}`;
};

// ── Report assembly ─────────────────────────────────────────────────────────
export async function generateAnalyticsPdf(data: OrgAnalytics, meta: ReportMeta): Promise<Buffer> {
  const doc = newDoc();
  const k = data.kpis;
  let y = drawHeader(doc, meta);

  // Executive summary — KPI cards
  y = drawSectionTitle(doc, y, 'Executive Summary');
  y = drawMetricCards(doc, y, [
    { label: 'Completed trips', value: String(k.totalTrips), color: P.teal },
    { label: 'Total revenue', value: inr(k.revenue * 100), color: P.blue },
    { label: 'Adoption rate', value: `${k.adoptionRate}%`, color: P.amber },
    { label: 'Avg occupancy', value: String(k.avgOccupancy), color: P.violet },
    { label: 'Distance shared', value: `${k.totalDistanceKm} km`, color: P.blue },
    { label: 'CO2 saved', value: `${k.co2SavedKg} kg`, color: P.teal },
    { label: 'Fuel saved', value: `${k.fuelSavedL} L`, color: P.amber },
    { label: 'Active employees', value: String(k.activeEmployees), color: P.rose },
  ]);

  // Operations
  y = drawSectionTitle(doc, y, 'Operations');
  if (data.tripsByStatus.length) {
    y = drawBarChart(
      doc,
      y,
      'Trips by status',
      data.tripsByStatus.map((s) => ({ label: s.status.replace(/_/g, ' '), value: s.count }))
    );
  }
  const busyHours = [...data.peakHours]
    .sort((a, b) => b.count - a.count)
    .filter((h) => h.count > 0)
    .slice(0, 8)
    .sort((a, b) => a.hour - b.hour);
  if (busyHours.length) {
    y = drawBarChart(
      doc,
      y,
      'Peak departure hours',
      busyHours.map((h) => ({ label: hourLabel(h.hour), value: h.count, color: P.blue }))
    );
  }
  if (data.popularRoutes.length) {
    y = drawTable(
      doc,
      y,
      'Popular routes',
      [
        { header: 'Route', width: CW - 80 },
        { header: 'Rides', width: 80, align: 'right' },
      ],
      data.popularRoutes.map((r) => [r.route, String(r.count)])
    );
  }

  // Revenue & payments
  y = drawSectionTitle(doc, y, 'Revenue & Payments');
  if (data.paymentMethods.length) {
    y = drawTable(
      doc,
      y,
      'Payment methods',
      [
        { header: 'Method', width: CW - 200 },
        { header: 'Payments', width: 100, align: 'right' },
        { header: 'Amount', width: 100, align: 'right' },
      ],
      data.paymentMethods.map((m) => [m.method, String(m.count), inr(m.amount)])
    );
  }
  if (data.monthlyTrend.length) {
    y = drawTable(
      doc,
      y,
      'Monthly revenue & CO2',
      [
        { header: 'Month', width: CW - 200 },
        { header: 'Revenue', width: 100, align: 'right' },
        { header: 'CO2 saved', width: 100, align: 'right' },
      ],
      data.monthlyTrend.map((m) => [monthLabel(m.month), inr(m.revenue * 100), `${m.co2Kg} kg`])
    );
  }

  // Sustainability
  y = drawSectionTitle(doc, y, 'Sustainability Impact');
  y = drawMetricCards(doc, y, [
    { label: 'CO2 saved', value: `${k.co2SavedKg} kg`, color: P.teal },
    { label: 'Fuel saved', value: `${k.fuelSavedL} L`, color: P.amber },
    { label: 'Trees equivalent', value: String(k.treesEquivalent), color: P.teal },
    { label: 'Eco points', value: String(k.ecoPoints), color: P.violet },
  ]);

  // People & fleet
  y = drawSectionTitle(doc, y, 'People & Fleet');
  if (data.topDrivers.length) {
    y = drawTable(
      doc,
      y,
      'Top drivers',
      [
        { header: '#', width: 30 },
        { header: 'Driver', width: CW - 210 },
        { header: 'Trips', width: 90, align: 'right' },
        { header: 'Distance', width: 90, align: 'right' },
      ],
      data.topDrivers.map((d, i) => [String(i + 1), d.name, String(d.trips), `${d.distanceKm} km`])
    );
  }
  if (data.departmentAdoption.length) {
    y = drawTable(
      doc,
      y,
      'Department adoption',
      [
        { header: 'Department', width: CW - 200 },
        { header: 'Trips', width: 100, align: 'right' },
        { header: 'Employees', width: 100, align: 'right' },
      ],
      data.departmentAdoption.map((d) => [d.department, String(d.trips), String(d.employees)])
    );
  }
  if (data.vehicleTypes.length) {
    y = drawBarChart(
      doc,
      y,
      'Fleet mix',
      data.vehicleTypes.map((v) => ({ label: v.type, value: v.count }))
    );
  }

  drawFooter(doc, meta.companyName);
  return bufferDoc(doc);
}

// ── Personal travel report ──────────────────────────────────────────────────
function drawPersonalHeader(
  doc: PDFKit.PDFDocument,
  userName: string,
  companyName: string,
  companyLogo: Buffer | null
): number {
  const y = MARGIN;
  doc.save();
  drawLeafMark(doc, LEFT, y, 34);
  doc.font('GS-Bold').fontSize(17).fillColor(P.ink);
  doc.text('Workway', LEFT + 44, y + 4, { lineBreak: false });
  doc.font('GS').fontSize(8).fillColor(P.gray);
  doc.text('Personal Travel Report', LEFT + 44, y + 22, { lineBreak: false });

  const rightW = 220;
  const rightX = LEFT + CW - rightW;
  let logoW = 0;
  if (companyLogo) {
    try {
      doc.image(companyLogo, rightX + rightW - 34, y, {
        fit: [34, 34],
        align: 'right',
        valign: 'center',
      });
      logoW = 42;
    } catch {
      /* ignore bad image */
    }
  }
  doc.font('GS-Bold').fontSize(12).fillColor(P.ink);
  doc.text(userName, rightX, y + 3, {
    width: rightW - logoW,
    align: 'right',
    lineBreak: false,
    ellipsis: true,
  });
  doc.font('GS').fontSize(8).fillColor(P.gray);
  doc.text(companyName, rightX, y + 20, {
    width: rightW - logoW,
    align: 'right',
    lineBreak: false,
    ellipsis: true,
  });

  doc
    .strokeColor(P.border)
    .lineWidth(0.6)
    .moveTo(LEFT, y + 44)
    .lineTo(LEFT + CW, y + 44)
    .stroke();

  const barY = y + 54;
  doc.roundedRect(LEFT, barY, CW, 24, 4).fill(P.slate);
  doc.font('GS').fontSize(7.5).fillColor(P.gray);
  doc.text(
    `Generated ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`,
    LEFT + 10,
    barY + 6,
    { lineBreak: false }
  );
  doc.restore();
  return barY + 38;
}

export async function generateMyReportPdf(
  data: MyReport,
  meta: { userName: string; companyName: string; companyLogo: Buffer | null }
): Promise<Buffer> {
  const doc = newDoc();
  const k = data.kpis;
  let y = drawPersonalHeader(doc, meta.userName, meta.companyName, meta.companyLogo);

  y = drawSectionTitle(doc, y, 'My Activity');
  y = drawMetricCards(doc, y, [
    { label: 'Total trips', value: String(k.totalTrips), color: P.teal },
    { label: 'As driver', value: String(k.tripsAsDriver), color: P.blue },
    { label: 'As passenger', value: String(k.tripsAsPassenger), color: P.violet },
    { label: 'Distance driven', value: `${k.distanceKm} km`, color: P.amber },
    { label: 'CO2 saved', value: `${k.co2SavedKg} kg`, color: P.teal },
    { label: 'Fuel saved', value: `${k.fuelSavedL} L`, color: P.amber },
    { label: 'Spent as rider', value: inr(k.spent * 100), color: P.rose },
    { label: 'Earned as driver', value: inr(k.earned * 100), color: P.blue },
  ]);

  y = drawSectionTitle(doc, y, 'Monthly Activity');
  if (data.monthly.length) {
    y = drawBarChart(
      doc,
      y,
      'Trips per month',
      data.monthly.map((m) => ({ label: monthLabel(m.month), value: m.trips, color: P.teal }))
    );
  } else {
    doc.font('GS').fontSize(8).fillColor(P.muted).text('No trips yet.', LEFT, y);
    y += 20;
  }

  y = drawSectionTitle(doc, y, 'Recent Trips');
  if (data.recentTrips.length) {
    y = drawTable(
      doc,
      y,
      '',
      [
        { header: 'Date', width: 90 },
        { header: 'Route', width: CW - 260 },
        { header: 'Role', width: 80 },
        { header: 'Fare', width: 90, align: 'right' },
      ],
      data.recentTrips.map((t) => [
        new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        t.route,
        t.role,
        t.role === 'Passenger' ? inr(t.amount * 100) : '-',
      ])
    );
  } else {
    doc.font('GS').fontSize(8).fillColor(P.muted).text('No trips recorded.', LEFT, y);
    y += 20;
  }

  if (data.vehicleWise.length) {
    y = drawSectionTitle(doc, y, 'Vehicles');
    y = drawTable(
      doc,
      y,
      '',
      [
        { header: 'Vehicle', width: CW - 200 },
        { header: 'Trips', width: 100, align: 'right' },
        { header: 'Distance', width: 100, align: 'right' },
      ],
      data.vehicleWise.map((v) => [v.name, String(v.trips), `${v.distanceKm} km`])
    );
  }

  drawFooter(doc, meta.companyName);
  return bufferDoc(doc);
}
