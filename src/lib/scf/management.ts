import {
  type AnalyticsStream,
  apiRows,
  type DataErasure,
  DEMO_TENANTS,
  type Tenant,
  webMetrics,
} from './demo';

export type AuditEntry = {
  id: string;
  tenantId: string;
  tenantName: string;
  actor: string;
  action: 'erase' | 'remove';
  stream: AnalyticsStream;
  startDate: string;
  endDate: string;
  reason: string;
  at: string;
  views: number;
  visitors: number;
  requests: number;
};
export type ManagementState = { tenants: Tenant[]; erasures: DataErasure[]; audit: AuditEntry[] };
export type DeletionRequest = {
  tenantId: string;
  action: 'erase' | 'remove';
  stream: AnalyticsStream;
  startDate: string;
  endDate: string;
  reason: string;
  confirmation: string;
};

export function initialManagementState(): ManagementState {
  return { tenants: [...DEMO_TENANTS], erasures: [], audit: [] };
}

export function deletionImpact(
  tenant: Tenant,
  dates: string[],
  erasures: DataErasure[],
  stream: AnalyticsStream,
) {
  const web = webMetrics([tenant], dates, erasures);
  return {
    views: stream === 'api' ? 0 : web.views,
    visitors: stream === 'api' ? 0 : web.visitors,
    requests:
      stream === 'web'
        ? 0
        : apiRows([tenant], dates, erasures).reduce((sum, row) => sum + row.requests, 0),
  };
}

/** Client-side demo guard only. This is not production authentication. */
export function applyDeletion(
  state: ManagementState,
  request: DeletionRequest,
  context: { perspective: string; dates: string[]; at: string; id: string },
): ManagementState {
  const tenant = state.tenants.find(t => t.id === request.tenantId);
  if (!tenant || (context.perspective !== 'all' && context.perspective !== tenant.id))
    throw new Error('This project is not available in the selected perspective.');
  if (request.confirmation !== tenant.name)
    throw new Error('Type the exact project name to confirm.');
  if (!request.reason.trim()) throw new Error('A reason is required for the activity log.');
  if (
    !['erase', 'remove'].includes(request.action) ||
    !['web', 'api', 'both'].includes(request.stream)
  )
    throw new Error('Invalid deletion action.');
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(request.startDate) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(request.endDate) ||
    request.startDate > request.endDate
  )
    throw new Error('Select a valid date range.');
  const remove = request.action === 'remove';
  const stream = remove ? 'both' : request.stream;
  const dates = remove
    ? context.dates
    : context.dates.filter(date => date >= request.startDate && date <= request.endDate);
  const impact = deletionImpact(tenant, dates, state.erasures, stream);
  const entry: AuditEntry = {
    id: context.id,
    tenantId: tenant.id,
    tenantName: tenant.name,
    actor: context.perspective === 'all' ? 'SCF operator (demo)' : `${tenant.name} owner (demo)`,
    action: request.action,
    stream,
    startDate: remove ? '0000-01-01' : request.startDate,
    endDate: remove ? context.at.slice(0, 10) : request.endDate,
    reason: request.reason.trim(),
    at: context.at,
    ...impact,
  };
  return {
    tenants: remove ? state.tenants.filter(t => t.id !== tenant.id) : state.tenants,
    erasures: remove
      ? state.erasures.filter(rule => rule.tenantId !== tenant.id)
      : [
          ...state.erasures,
          { tenantId: tenant.id, stream, startDate: request.startDate, endDate: request.endDate },
        ],
    audit: [entry, ...state.audit],
  };
}
