export type OrderProsthesisJobStatus = 'pending' | 'completed';

export interface SubmittedOrderProsthesisJob {
  productId?: string;
  notes?: string;
}

export interface NormalizedOrderProsthesisJob {
  productId: string;
  patientName: string;
  isPatientException: boolean;
  exceptionReason: string | null;
  notes: string | null;
  sortOrder: number;
}

export interface OrderProsthesisJobLike {
  id: string;
  patientName: string;
  status: OrderProsthesisJobStatus;
  productName?: string | null;
  categoryName?: string | null;
}

export function normalizeOrderProsthesisJobs(
  items: SubmittedOrderProsthesisJob[] | undefined,
  defaultPatientName: string
): { jobs: NormalizedOrderProsthesisJob[]; error?: string } {
  const fallbackPatient = defaultPatientName.trim();
  const sourceItems = items && items.length > 0 ? items : [];

  if (sourceItems.length === 0) {
    return { jobs: [], error: 'Debe agregar al menos un trabajo de prótesis' };
  }

  const jobs: NormalizedOrderProsthesisJob[] = [];

  for (const [index, item] of sourceItems.entries()) {
    const productId = item.productId?.trim();
    if (!productId) {
      return { jobs: [], error: `El trabajo #${index + 1} no tiene prótesis seleccionada` };
    }

    const patientName = fallbackPatient;

    jobs.push({
      productId,
      patientName,
      isPatientException: false,
      exceptionReason: null,
      notes: item.notes?.trim() || null,
      sortOrder: index,
    });
  }

  return { jobs };
}

export function getIncompleteOrderProsthesisJobs<T extends OrderProsthesisJobLike>(jobs: T[]): T[] {
  return jobs.filter((job) => job.status !== 'completed');
}

export function formatIncompleteOrderProsthesisJobs(jobs: OrderProsthesisJobLike[]): string[] {
  return jobs.map((job, index) => {
    const product = job.productName || `Trabajo ${index + 1}`;
    const category = job.categoryName ? ` (${job.categoryName})` : '';
    const patient = job.patientName ? ` - ${job.patientName}` : '';
    return `${product}${category}${patient}`;
  });
}

export function canMarkOrderAsCompleted(jobs: OrderProsthesisJobLike[]): boolean {
  return jobs.length > 0 && getIncompleteOrderProsthesisJobs(jobs).length === 0;
}

export function buildOrderProgressSummary<T extends OrderProsthesisJobLike>(jobs: T[]) {
  const total = jobs.length;
  const completed = jobs.filter((job) => job.status === 'completed').length;
  const pending = total - completed;

  return {
    total,
    completed,
    pending,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
    ready: total > 0 && pending === 0,
  };
}
