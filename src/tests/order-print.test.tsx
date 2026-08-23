import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
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
    notes: 'Reducir oclusal en 16. Verificar contacto proximal.',
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
    {
      productName: 'Corona de Zirconio',
      categoryName: 'Prótesis Fija',
      notes: 'Pieza 16',
      patientName: 'María González',
      isPatientException: false,
      exceptionReason: null,
    },
    {
      productName: 'Inlay de Resina',
      categoryName: 'Prótesis Fija',
      notes: null,
      patientName: 'Otro Paciente',
      isPatientException: true,
      exceptionReason: 'Pieza distinta',
    },
  ],
  workflowSteps: [
    { id: 'step-1', name: 'Yesos', isActive: true },
    { id: 'step-2', name: 'Diseño CAD', isActive: true },
    { id: 'step-3', name: 'Fresado', isActive: true },
    { id: 'step-4', name: 'Control de Calidad', isActive: true },
    { id: 'step-5', name: 'Paso oculto', isActive: false },
  ],
};

describe('OrderPrintDocument — Hoja Carta 50/50', () => {
  const data = toOrderPrintData(mockDetail, 36.5);
  const html = renderToStaticMarkup(
    <OrderPrintDocument data={data} origin="https://sjlabdental.com" />
  );

  it('mapea los datos del detalle correctamente', () => {
    expect(data.orderNumber).toBe(1042);
    expect(data.jobs).toHaveLength(2);
    // Solo pasos activos
    expect(data.workflowSteps.map((s) => s.name)).not.toContain('Paso oculto');
    expect(data.workflowSteps).toHaveLength(4);
  });

  it('renderiza ambas mitades y la línea de corte', () => {
    expect(html).toContain('Copia Laboratorio');
    expect(html).toContain('Copia Cliente');
    expect(html).toContain('Línea de corte');
  });

  it('incluye identificación clínica y color destacado', () => {
    expect(html).toContain('#1042');
    expect(html).toContain('María González');
    expect(html).toContain('Dr. Pedro Ramírez');
    expect(html).toContain('Clínica Dental Sonrisas');
    expect(html).toContain('A2');
    expect(html).toContain('Reducir oclusal');
  });

  it('genera QR de laboratorio y de cliente con URLs dinámicas', () => {
    // react-qr-code renderiza SVG; las URLs se codifican en los paths del QR.
    // Verificamos que ambos SVG estén presentes y los textos guía.
    const svgCount = (html.match(/<svg/g) || []).length;
    expect(svgCount).toBeGreaterThanOrEqual(3); // 2 QR + ícono de tijera
    expect(html).toContain('QR Laboratorio');
    expect(html).toContain('QR Cliente');
  });

  it('muestra el estado de cuenta con saldo pendiente y conversión a Bs', () => {
    expect(html).toContain('$150.00');
    expect(html).toContain('$50.00');
    expect(html).toContain('Saldo pendiente');
    expect(html).toContain('$100.00');
    expect(html).toContain('Bs.');
  });

  it('marca el checklist de producción con el paso actual', () => {
    expect(html).toContain('Yesos');
    expect(html).toContain('Diseño CAD');
    expect(html).toContain('Control de Calidad');
    // El paso previo al actual aparece marcado como completado
    expect(html).toContain('✓');
  });
});
