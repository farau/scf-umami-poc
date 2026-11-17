'use client';

import { Database, ShieldCheck, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { AnalyticsStream, DataErasure, Tenant } from '@/lib/scf/demo';
import { type AuditEntry, type DeletionRequest, deletionImpact } from '@/lib/scf/management';
import { ActivityLog } from './AdminDashboard';
import styles from './scf.module.css';

const fmt = (value: number) => new Intl.NumberFormat('en-US').format(value);
const streamName = (stream: AnalyticsStream) =>
  stream === 'both' ? 'Web + API' : stream === 'web' ? 'Web analytics' : 'API analytics';

function DeletionConfirmation({
  tenant,
  request,
  dates,
  erasures,
  onClose,
  onConfirm,
}: {
  tenant: Tenant;
  request: Omit<DeletionRequest, 'confirmation'>;
  dates: string[];
  erasures: DataErasure[];
  onClose: () => void;
  onConfirm: (request: DeletionRequest) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [confirmation, setConfirmation] = useState('');
  const remove = request.action === 'remove';
  const impact = deletionImpact(tenant, dates, erasures, request.stream);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className={`${styles.modal} ${styles.confirmDialog}`}
      onCancel={onClose}
      onClose={onClose}
      aria-labelledby="deletion-title"
    >
      <button
        type="button"
        className={styles.close}
        aria-label="Close deletion confirmation"
        onClick={onClose}
      >
        <X size={20} />
      </button>
      <span className={styles.dangerBadge}>Demo data action</span>
      <h2 id="deletion-title">{remove ? 'Remove this project?' : 'Erase selected analytics?'}</h2>
      <p>
        {remove
          ? 'The project and its web/API data will disappear from every view in this demo session.'
          : 'Only the selected data will be removed. The project and its integration identifiers will stay available.'}
      </p>
      <dl className={styles.deletionSummary}>
        <div>
          <dt>Project</dt>
          <dd>{tenant.name}</dd>
        </div>
        <div>
          <dt>Data</dt>
          <dd>{streamName(request.stream)}</dd>
        </div>
        <div>
          <dt>Period (UTC)</dt>
          <dd>
            {request.startDate === '0000-01-01'
              ? 'All available history'
              : `${request.startDate} → ${request.endDate}`}
          </dd>
        </div>
        <div>
          <dt>Impact</dt>
          <dd>
            {fmt(impact.visitors)} visitors · {fmt(impact.views)} views
            <br />
            {fmt(impact.requests)} API requests
          </dd>
        </div>
        <div>
          <dt>Reason</dt>
          <dd>{request.reason}</dd>
        </div>
      </dl>
      <p className={styles.deleteNotice}>
        This affects synthetic data in your browser only. It does not delete native Umami database
        records. Refreshing restores the original fixtures.
      </p>
      <form
        onSubmit={event => {
          event.preventDefault();
          if (confirmation === tenant.name) onConfirm({ ...request, confirmation });
        }}
      >
        <label>
          <span>
            Type <strong>{tenant.name}</strong> to confirm
          </span>
          <input
            aria-label="Confirm project name"
            value={confirmation}
            onChange={event => setConfirmation(event.target.value)}
            autoComplete="off"
            autoFocus
            required
          />
        </label>
        <div className={styles.confirmActions}>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className={styles.dangerButton}
            disabled={confirmation !== tenant.name}
          >
            <Trash2 size={15} />
            {remove ? 'Confirm project removal' : 'Confirm data erasure'}
          </button>
        </div>
      </form>
    </dialog>
  );
}

export function DataManagement({
  tenants,
  initialTenantId,
  initialAction,
  dates,
  allDates,
  erasures,
  audit,
  isAdmin,
  onDelete,
}: {
  tenants: Tenant[];
  initialTenantId: string;
  initialAction: 'erase' | 'remove';
  dates: string[];
  allDates: string[];
  erasures: DataErasure[];
  audit: AuditEntry[];
  isAdmin: boolean;
  onDelete: (request: DeletionRequest) => void;
}) {
  const [tenantId, setTenantId] = useState(initialTenantId);
  const [action, setAction] = useState<'erase' | 'remove'>(initialAction);
  const [stream, setStream] = useState<AnalyticsStream>('both');
  const [period, setPeriod] = useState('range');
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState<Omit<DeletionRequest, 'confirmation'> | null>(null);
  const tenant = tenants.find(t => t.id === tenantId) || tenants[0];
  const remove = action === 'remove';
  const selectedStream = remove ? 'both' : stream;
  const selectedDates = remove || period === 'all' ? allDates : dates;
  const impact = tenant
    ? deletionImpact(tenant, selectedDates, erasures, selectedStream)
    : { visitors: 0, views: 0, requests: 0 };
  const available = impact.views > 0 || impact.requests > 0;
  return (
    <>
      <div className={styles.adminIntro}>
        <ShieldCheck size={23} />
        <div>
          <h2>Control your project data</h2>
          <p>
            {isAdmin
              ? 'Manage erasure requests for any enrolled project, or remove projects outside the ecosystem.'
              : 'Export your analytics, erase selected data, or delete your project and its data.'}
          </p>
        </div>
        <span className={styles.freeBadge}>Synthetic data only</span>
      </div>
      {tenant ? (
        <>
          <section className={styles.card}>
            <div className={styles.cardTitle}>
              <div>
                <h3>Project data controls</h3>
                <p>Changes apply to dashboards, comparisons and future exports in this session.</p>
              </div>
              <label className={styles.projectSelect}>
                Project
                <select
                  aria-label="Data management project"
                  value={tenant.id}
                  disabled={!isAdmin}
                  onChange={event => {
                    setTenantId(event.target.value);
                    setReason('');
                  }}
                >
                  {tenants.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <code className={styles.tableId}>tenant.id: {tenant.id}</code>
            <form
              className={styles.dataForm}
              onSubmit={event => {
                event.preventDefault();
                setPending({
                  tenantId: tenant.id,
                  action,
                  stream: selectedStream,
                  startDate: remove || period === 'all' ? '0000-01-01' : dates[0],
                  endDate: selectedDates[selectedDates.length - 1],
                  reason: reason.trim(),
                });
              }}
            >
              <div className={styles.actionChoices}>
                <button
                  type="button"
                  aria-pressed={!remove}
                  className={!remove ? styles.actionSelected : ''}
                  onClick={() => setAction('erase')}
                >
                  <Database size={20} />
                  <span>
                    <strong>Erase analytics</strong>
                    <small>Keep the project and integration IDs.</small>
                  </span>
                </button>
                <button
                  type="button"
                  aria-pressed={remove}
                  className={remove ? styles.actionSelected : ''}
                  onClick={() => setAction('remove')}
                >
                  <Trash2 size={20} />
                  <span>
                    <strong>Delete project and all data</strong>
                    <small>Remove enrollment and both data streams.</small>
                  </span>
                </button>
              </div>
              {!remove && (
                <div className={styles.dataFields}>
                  <label>
                    Data to erase
                    <select
                      aria-label="Data to erase"
                      value={stream}
                      onChange={event => setStream(event.target.value as AnalyticsStream)}
                    >
                      <option value="both">Web + API analytics</option>
                      <option value="web">Web analytics only</option>
                      <option value="api">API analytics only</option>
                    </select>
                  </label>
                  <label>
                    Period
                    <select
                      aria-label="Erasure period"
                      value={period}
                      onChange={event => setPeriod(event.target.value)}
                    >
                      <option value="range">Selected dashboard period ({dates.length} days)</option>
                      <option value="all">All available history (90-day demo)</option>
                    </select>
                  </label>
                </div>
              )}
              <div className={styles.impactGrid}>
                <div>
                  <span>Visitors affected</span>
                  <strong>{fmt(impact.visitors)}</strong>
                </div>
                <div>
                  <span>Page views affected</span>
                  <strong>{fmt(impact.views)}</strong>
                </div>
                <div>
                  <span>API requests affected</span>
                  <strong>{fmt(impact.requests)}</strong>
                </div>
              </div>
              <label>
                Reason for this action
                <textarea
                  aria-label="Deletion reason"
                  required
                  maxLength={500}
                  value={reason}
                  onChange={event => setReason(event.target.value)}
                  placeholder={
                    remove && isAdmin
                      ? 'For example: project is no longer part of the Stellar ecosystem.'
                      : 'For example: tenant-requested erasure or demo data reset.'
                  }
                  rows={3}
                />
              </label>
              <p className={styles.deleteNotice}>
                {remove
                  ? 'Removes this project from enrollment, dashboards, comparisons and exports. The session activity log keeps the project label and reason.'
                  : 'Erases only the selected stream and UTC period. Other tenants and data outside that period stay available.'}{' '}
                The original fixtures return on refresh; this is not a completed production erasure
                request.
              </p>
              <div className={styles.dataFormFooter}>
                <span>
                  {!remove && !available
                    ? 'No matching data remains in this selection.'
                    : 'An exact project-name confirmation is required next.'}
                </span>
                <button
                  type="submit"
                  className={styles.dangerButton}
                  disabled={!reason.trim() || (!remove && !available)}
                >
                  <Trash2 size={15} />
                  {remove ? 'Review project removal' : 'Review data erasure'}
                </button>
              </div>
            </form>
          </section>
          <section className={styles.card}>
            <h3>What gets erased?</h3>
            <div className={styles.erasureExplanation}>
              <div>
                <strong>Web analytics</strong>
                <p>
                  Visitor/session counts, page views, duration, bounce rate and audience breakdowns
                  for the selected period.
                </p>
              </div>
              <div>
                <strong>API analytics</strong>
                <p>
                  Request counts, status distributions and latency histograms for every service and
                  route in the selected period.
                </p>
              </div>
              <div>
                <strong>Project deletion</strong>
                <p>
                  Enrollment and all web/API data disappear from this demo. This single-property POC
                  does not revoke production credentials or touch backups.
                </p>
              </div>
            </div>
          </section>
        </>
      ) : (
        <section className={styles.card}>
          <h3>No enrolled projects</h3>
          <p className={styles.empty}>
            All projects have been removed in this demo session. Use Add project to enroll a new
            one, or refresh to restore the original fixtures.
          </p>
        </section>
      )}
      <ActivityLog entries={audit} />
      {pending && tenant && (
        <DeletionConfirmation
          tenant={tenant}
          request={pending}
          dates={selectedDates}
          erasures={erasures}
          onClose={() => setPending(null)}
          onConfirm={request => {
            onDelete(request);
            setPending(null);
            setReason('');
          }}
        />
      )}
    </>
  );
}
