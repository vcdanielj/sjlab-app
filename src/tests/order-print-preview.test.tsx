// Generates a standalone HTML preview of the OrderPrintDocument
// (real component markup + real CSS) for visual/print inspection.
import { it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { writeFileSync, readFileSync } from 'node:fs';
import {
  OrderPrintDocument,
  toOrderPrintData,
  OrderDetailResponse,
} from '../components/orders/OrderPrintDocument';

const mockDetail: OrderDetailResponse = {
  order: {
    id: 'order-123',
    orderNumber: 1042,
    status: 'active',
    patientName: 'María González',
    color: 'vita-classical:A2',
    notes: 'Reducir oclusal en pieza 16. Verificar contacto proximal y puntos de contacto antes de glasear.',
    createdAt: 1787500000,
    completedAt: null,
    deliveredAt: null,
    finalPriceUsd: 150,
    amountPaidUsd: 50,
    clientName: 'Dr. Pedro Ramírez',
    clientClinic: 'Clínica Dental Sonrisas',
    clientPhone: '0414-1234567',
    productName: 'Corona de Zirconio',
    currentStepId: 'step-2',
  },
  prosthesisJobs: [
    { productName: 'Corona de Zirconio', categoryName: 'Prótesis Fija', notes: 'Pieza 16', patientName: 'María González', isPatientException: false, exceptionReason: null },
    { productName: 'Inlay de Resina', categoryName: 'Prótesis Fija', notes: null, patientName: 'María González', isPatientException: false, exceptionReason: null },
  ],
  workflowSteps: [
    { id: 'step-1', name: 'Yesos', isActive: true },
    { id: 'step-2', name: 'Diseño CAD', isActive: true },
    { id: 'step-3', name: 'Fresado / Impresión 3D', isActive: true },
    { id: 'step-4', name: 'Cerámica', isActive: true },
    { id: 'step-5', name: 'Control de Calidad', isActive: true },
  ],
};

/** Compile the CSS module source into plain CSS using vitest's stable hash. */
function compileCssModule(): string {
  let css = readFileSync('src/components/orders/order-print.module.css', 'utf8');
  // Unwrap :global(...) selectors
  css = css.replace(/:global\(([^)]+)\)/g, '$1');
  return css;
}

/** Rename local classes in the compiled CSS to vitest's stable hashed names. */
function applyHash(css: string, markup: string): string {
  // Learn the hash suffix from the rendered markup (e.g. _sheet_e9d3d9 → e9d3d9)
  const match = markup.match(/class="(_[A-Za-z][\w-]*_([0-9a-f]{6}))/);
  if (!match) return css;
  const hash = match[2];
  // Global classes that must NOT be renamed
  const globals = new Set(['order-print-root']);
  return css.replace(/\.([A-Za-z][\w-]*)/g, (full, name: string) => {
    if (globals.has(name)) return full;
    return `._${name}_${hash}`;
  });
}

it('genera order-print-preview.html', () => {
  const data = toOrderPrintData(mockDetail, 36.5);
  const markup = renderToStaticMarkup(
    <OrderPrintDocument data={data} origin="https://sjlabdental.com" />
  );
  const css = applyHash(compileCssModule(), markup);
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>Vista previa — Pedido #1042</title>
<style>
  body { background: #e2e8f0; margin: 0; padding: 24px 0; font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; }
  @media print { body { background: #fff; padding: 0; } }
${css}
  /* Preview override: keep the print copy visible on screen */
  .order-print-root { display: block; }
</style>
</head>
<body class="order-printing">
<div class="order-print-root">
${markup}
</div>
</body>
</html>`;
  writeFileSync('order-print-preview.html', html);
});
