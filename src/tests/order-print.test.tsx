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
  });

  it('renderiza la copia laboratorio duplicada (dos cuartos) y la copia cliente', () => {
    const labCopies = (html.match(/Copia Laboratorio/g) || []).length;
    expect(labCopies).toBe(2); // dos cuartos de hoja idénticos
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

  it('da protagonismo a los códigos QR (laboratorio y cliente)', () => {
    // react-qr-code renderiza SVG; las URLs se codifican en los paths del QR.
    const svgCount = (html.match(/<svg/g) || []).length;
    expect(svgCount).toBeGreaterThanOrEqual(5); // 2 QR lab + 1 QR cliente + 2 íconos de tijera
    const labQrCount = (html.match(/QR Laboratorio/g) || []).length;
    expect(labQrCount).toBe(2); // un QR por cada cuarto de hoja
    expect(html).toContain('QR Cliente');
    // Sin listado de procesos del workflow en la hoja impresa
    expect(html).not.toContain('Control de producción');
    expect(html).not.toContain('Diseño CAD');
  });

  it('muestra el estado de cuenta con saldo pendiente y conversión a Bs', () => {
    expect(html).toContain('$150.00');
    expect(html).toContain('$50.00');
    expect(html).toContain('Saldo pendiente');
    expect(html).toContain('$100.00');
    expect(html).toContain('Bs.');
  });
});
