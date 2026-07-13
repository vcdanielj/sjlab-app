// ============================================
// SJ Lab — PDF Statement Generator (Edge-Compatible)
// ============================================
// Generates account statement PDFs using jsPDF in memory.
// Returns a Uint8Array suitable for streaming as a Response.

import { jsPDF } from 'jspdf';

// ---------- Types ----------

interface StatementClient {
  name: string;
  clinicName: string | null;
  email: string;
  phone: string | null;
  taxId: string | null;
}

interface StatementMovement {
  date: number; // Unix timestamp
  concept: string;
  charge: number; // Cargo (facturado)
  credit: number; // Abono (pagado)
}

interface StatementData {
  client: StatementClient;
  movements: StatementMovement[];
  netBalance: number;
  generatedAt: number;
}

// ---------- Constants ----------

const MARGIN_LEFT = 20;
const MARGIN_RIGHT = 20;
const MARGIN_TOP = 20;
const MARGIN_BOTTOM = 25;
const PAGE_WIDTH = 210; // A4 mm
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
const MAX_ROWS_PER_PAGE = 50;

// Column widths (mm)
const COL_NUM = 10;
const COL_DATE = 28;
const COL_CONCEPT = 62;
const COL_CHARGE = 28;
const COL_CREDIT = 28;
const COL_BALANCE = 28;

const ROW_HEIGHT = 6;
const HEADER_ROW_HEIGHT = 7;

// ---------- Helpers ----------

function fmtDate(ts: number): string {
  const d = new Date(ts * 1000);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function fmtCurrency(n: number): string {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function truncText(doc: jsPDF, text: string, maxWidth: number): string {
  if (doc.getTextWidth(text) <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && doc.getTextWidth(t + '…') > maxWidth) {
    t = t.slice(0, -1);
  }
  return t + '…';
}

// ---------- Main Generator ----------

export function generateStatementPdf(data: StatementData): ArrayBuffer {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  let pageNumber = 1;
  let y = MARGIN_TOP;

  // ---- Render Page Header ----
  function renderPageHeader() {
    // Company Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(59, 130, 246); // Primary blue
    doc.text('SJ Lab', MARGIN_LEFT, y);

    // Subtitle
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.setFont('helvetica', 'normal');
    doc.text('Laboratorio Dental', MARGIN_LEFT, y + 6);

    // Statement Title (right-aligned)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(17, 17, 17);
    doc.text('Estado de Cuenta', PAGE_WIDTH - MARGIN_RIGHT, y, { align: 'right' });

    // Date (right-aligned)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text(`Generado: ${fmtDate(data.generatedAt)}`, PAGE_WIDTH - MARGIN_RIGHT, y + 6, { align: 'right' });

    y += 14;

    // Separator line
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.5);
    doc.line(MARGIN_LEFT, y, PAGE_WIDTH - MARGIN_RIGHT, y);
    y += 6;

    // Client Information
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(17, 17, 17);
    doc.text('Cliente:', MARGIN_LEFT, y);
    doc.setFont('helvetica', 'normal');
    doc.text(data.client.name, MARGIN_LEFT + 18, y);

    if (data.client.clinicName) {
      y += 5;
      doc.setFont('helvetica', 'bold');
      doc.text('Clínica:', MARGIN_LEFT, y);
      doc.setFont('helvetica', 'normal');
      doc.text(data.client.clinicName, MARGIN_LEFT + 18, y);
    }

    if (data.client.taxId) {
      y += 5;
      doc.setFont('helvetica', 'bold');
      doc.text('RIF/CI:', MARGIN_LEFT, y);
      doc.setFont('helvetica', 'normal');
      doc.text(data.client.taxId, MARGIN_LEFT + 18, y);
    }

    if (data.client.email) {
      y += 5;
      doc.setFont('helvetica', 'bold');
      doc.text('Email:', MARGIN_LEFT, y);
      doc.setFont('helvetica', 'normal');
      doc.text(data.client.email, MARGIN_LEFT + 18, y);
    }

    if (data.client.phone) {
      y += 5;
      doc.setFont('helvetica', 'bold');
      doc.text('Teléfono:', MARGIN_LEFT, y);
      doc.setFont('helvetica', 'normal');
      doc.text(data.client.phone, MARGIN_LEFT + 22, y);
    }

    y += 10;
  }

  // ---- Render Table Header ----
  function renderTableHeader() {
    // Header background
    doc.setFillColor(249, 249, 249);
    doc.rect(MARGIN_LEFT, y - 1, CONTENT_WIDTH, HEADER_ROW_HEIGHT + 1, 'F');

    // Header border
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.3);
    doc.line(MARGIN_LEFT, y + HEADER_ROW_HEIGHT, PAGE_WIDTH - MARGIN_RIGHT, y + HEADER_ROW_HEIGHT);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(107, 114, 128);

    let x = MARGIN_LEFT + 2;
    doc.text('#', x, y + 4);
    x += COL_NUM;
    doc.text('FECHA', x, y + 4);
    x += COL_DATE;
    doc.text('CONCEPTO', x, y + 4);
    x += COL_CONCEPT;
    doc.text('CARGO (USD)', x, y + 4);
    x += COL_CHARGE;
    doc.text('ABONO (USD)', x, y + 4);
    x += COL_CREDIT;
    doc.text('SALDO (USD)', x, y + 4);

    y += HEADER_ROW_HEIGHT + 2;
  }

  // ---- Render Footer ----
  function renderFooter() {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(156, 163, 175);
    doc.text(
      `Página ${pageNumber} — SJ Lab — Estado de Cuenta de ${data.client.name}`,
      PAGE_WIDTH / 2,
      297 - 10,
      { align: 'center' }
    );
  }

  // ---- Start Building ----
  renderPageHeader();
  renderTableHeader();

  let runningBalance = 0;
  let rowsOnPage = 0;

  for (let i = 0; i < data.movements.length; i++) {
    const mov = data.movements[i];
    runningBalance += mov.credit - mov.charge;

    // Check if we need a new page
    if (rowsOnPage >= MAX_ROWS_PER_PAGE || y + ROW_HEIGHT > 297 - MARGIN_BOTTOM) {
      renderFooter();
      doc.addPage();
      pageNumber++;
      y = MARGIN_TOP;
      rowsOnPage = 0;

      // Light header on continuation pages
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(17, 17, 17);
      doc.text(`Estado de Cuenta — ${data.client.name} (continuación)`, MARGIN_LEFT, y);
      y += 8;

      renderTableHeader();
    }

    // Zebra striping
    if (i % 2 === 1) {
      doc.setFillColor(249, 250, 251);
      doc.rect(MARGIN_LEFT, y - 1.5, CONTENT_WIDTH, ROW_HEIGHT, 'F');
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(17, 17, 17);

    let x = MARGIN_LEFT + 2;

    // Row number
    doc.setTextColor(156, 163, 175);
    doc.text(String(i + 1), x, y + 2.5);
    x += COL_NUM;

    // Date
    doc.setTextColor(17, 17, 17);
    doc.text(fmtDate(mov.date), x, y + 2.5);
    x += COL_DATE;

    // Concept (truncated)
    const conceptText = truncText(doc, mov.concept, COL_CONCEPT - 4);
    doc.text(conceptText, x, y + 2.5);
    x += COL_CONCEPT;

    // Charge
    if (mov.charge > 0) {
      doc.setTextColor(239, 68, 68); // Danger red
      doc.text(fmtCurrency(mov.charge), x + COL_CHARGE - 4, y + 2.5, { align: 'right' });
    }
    x += COL_CHARGE;

    // Credit
    if (mov.credit > 0) {
      doc.setTextColor(16, 185, 129); // Success green
      doc.text(fmtCurrency(mov.credit), x + COL_CREDIT - 4, y + 2.5, { align: 'right' });
    }
    x += COL_CREDIT;

    // Running balance
    if (runningBalance >= 0) {
      doc.setTextColor(16, 185, 129);
    } else {
      doc.setTextColor(239, 68, 68);
    }
    doc.text(fmtCurrency(Math.abs(runningBalance)), x + COL_BALANCE - 4, y + 2.5, { align: 'right' });

    // Row divider
    doc.setDrawColor(243, 244, 246);
    doc.setLineWidth(0.15);
    doc.line(MARGIN_LEFT, y + ROW_HEIGHT - 1, PAGE_WIDTH - MARGIN_RIGHT, y + ROW_HEIGHT - 1);

    y += ROW_HEIGHT;
    rowsOnPage++;
  }

  // ---- Summary Footer ----
  y += 4;

  // Separator
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.5);
  doc.line(MARGIN_LEFT, y, PAGE_WIDTH - MARGIN_RIGHT, y);
  y += 8;

  // Net Balance Box
  const balanceBoxWidth = 80;
  const balanceBoxX = PAGE_WIDTH - MARGIN_RIGHT - balanceBoxWidth;
  const balanceColor = data.netBalance >= 0 ? [16, 185, 129] : [239, 68, 68];

  doc.setFillColor(balanceColor[0], balanceColor[1], balanceColor[2]);
  doc.roundedRect(balanceBoxX, y - 3, balanceBoxWidth, 16, 3, 3, 'F');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text(
    data.netBalance >= 0 ? 'SALDO A FAVOR DEL CLIENTE' : 'SALDO PENDIENTE POR COBRAR',
    balanceBoxX + balanceBoxWidth / 2,
    y + 2,
    { align: 'center' }
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(
    fmtCurrency(Math.abs(data.netBalance)),
    balanceBoxX + balanceBoxWidth / 2,
    y + 10,
    { align: 'center' }
  );

  // Footer
  renderFooter();

  // Return the PDF as binary array
  return doc.output('arraybuffer') as ArrayBuffer;
}
