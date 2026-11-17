'use client';

import {
  Activity,
  ArrowUpRight,
  Database,
  FolderKanban,
  ShieldCheck,
  Trash2,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import {
  apiRows,
  type DataErasure,
  mergeHistograms,
  percentile,
  type Tenant,
  webMetrics,
} from '@/lib/scf/demo';
import type { AuditEntry } from '@/lib/scf/management';
import styles from './scf.module.css';

const fmt = (value: number) => new Intl.NumberFormat('en-US').format(value);

export function ActivityLog({ entries }: { entries: AuditEntry[] }) {
  return (
    <section className={styles.card}>
      <div className={styles.cardTitle}>
        <div>
          <h3>Data activity log</h3>
          <p>Session-only record of confirmed demo actions. Resets on refresh.</p>
        </div>
        <span>{entries.length} actions</span>
      </div>
      {entries.length ? (
        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>Time (UTC)</th>
                <th>Project / actor</th>
                <th>Action</th>
                <th>Data affected</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(entry => (
                <tr key={entry.id}>
                  <td>{entry.at.slice(0, 19).replace('T', ' ')}</td>
                  <td>
                    <strong>{entry.tenantName}</strong>
                    <small className={styles.tableId}>{entry.actor}</small>
                  </td>
                  <td>
                    {entry.action === 'remove'
                      ? 'Project removed'
                      : `${entry.stream === 'both' ? 'Web + API' : entry.stream.toUpperCase()} erased`}
                    <small className={styles.tableId}>
                      {entry.startDate === '0000-01-01'
                        ? 'All history'
                        : `${entry.startDate} → ${entry.endDate}`}
                    </small>
                  </td>
                  <td>
                    {fmt(entry.views)} views · {fmt(entry.requests)} API requests
                  </td>
                  <td className={styles.reasonCell}>{entry.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className={styles.empty}>No data actions in this demo session.</p>
      )}
    </section>
  );
}

export function AdminDashboard({
  tenants,
  dates,
  erasures,
  audit,
  onView,
  onManage,
}: {
  tenants: Tenant[];
  dates: string[];
  erasures: DataErasure[];
  audit: AuditEntry[];
  onView: (id: string) => void;
  onManage: (id: string, remove?: boolean) => void;
}) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('requests');
  const rows = tenants.map(tenant => {
    const web = webMetrics([tenant], dates, erasures);
    const api = apiRows([tenant], dates, erasures);
    const requests = api.reduce((sum, row) => sum + row.requests, 0);
    const errors = api.reduce((sum, row) => sum + row.statuses[2], 0);
    const histogram = mergeHistograms(api.map(row => row.histogram));
    return {
      tenant,
      web,
      requests,
      errors,
      p50: percentile(histogram, 0.5),
      p95: percentile(histogram, 0.95),
    };
  });
  const totalRequests = rows.reduce((sum, row) => sum + row.requests, 0);
  const errors = rows.reduce((sum, row) => sum + row.errors, 0);
  const ranked = [...rows]
    .filter(({ tenant }) =>
      `${tenant.name} ${tenant.domain} ${tenant.category}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    )
    .sort((a, b) =>
      sort === 'name'
        ? a.tenant.name.localeCompare(b.tenant.name)
        : sort === 'errors'
          ? (b.requests ? b.errors / b.requests : 0) - (a.requests ? a.errors / a.requests : 0)
          : sort === 'visitors'
            ? b.web.visitors - a.web.visitors
            : b.requests - a.requests,
    );
  const cards = [
    {
      label: 'Enrolled projects',
      value: fmt(tenants.length),
      detail: '€0 enrollment for every project',
      icon: FolderKanban,
    },
    {
      label: 'Global visitors',
      value: fmt(rows.reduce((sum, row) => sum + row.web.visitors, 0)),
      detail: 'Daily distinct sessions · all projects',
      icon: Users,
    },
    {
      label: 'API server error rate',
      value: `${totalRequests ? ((errors / totalRequests) * 100).toFixed(2) : '0.00'}%`,
      detail: `${fmt(errors)} synthetic 5xx responses`,
      icon: Activity,
    },
    {
      label: 'API requests',
      value: fmt(totalRequests),
      detail: 'All enrolled services',
      icon: Database,
    },
  ];
  return (
    <>
      <div className={styles.adminIntro}>
        <ShieldCheck size={23} />
        <div>
          <h2>SCF operator workspace</h2>
          <p>
            Monitor adoption across projects, compare standardized metrics and manage project data.
          </p>
        </div>
        <span className={styles.freeBadge}>Admin perspective · demo</span>
      </div>
      <div className={styles.metrics}>
        {cards.map(card => (
          <section className={styles.metric} key={card.label}>
            <div>
              <span>{card.label}</span>
              <card.icon size={17} />
            </div>
            <strong>{card.value}</strong>
            <small>{card.detail}</small>
          </section>
        ))}
      </div>
      <section className={styles.card}>
        <div className={styles.cardTitle}>
          <div>
            <h3>Project oversight</h3>
            <p>
              All enrolled projects · {dates[0]} to {dates.at(-1)} UTC
            </p>
          </div>
          <div className={styles.tableTools}>
            <input
              aria-label="Search admin projects"
              placeholder="Search projects or categories…"
              value={search}
              onChange={event => setSearch(event.target.value)}
            />
            <select
              aria-label="Sort admin projects"
              value={sort}
              onChange={event => setSort(event.target.value)}
            >
              <option value="requests">API requests ↓</option>
              <option value="visitors">Visitors ↓</option>
              <option value="errors">Server error rate ↓</option>
              <option value="name">Name A–Z</option>
            </select>
          </div>
        </div>
        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>Project / tenant.id</th>
                <th>Visitors / views</th>
                <th>Bounce / duration</th>
                <th>API requests</th>
                <th>5xx rate</th>
                <th>p50 / p95</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map(row => (
                <tr key={row.tenant.id}>
                  <td>
                    <strong>{row.tenant.name}</strong>
                    <small className={styles.tableId}>
                      {row.tenant.category} · {row.tenant.domain}
                    </small>
                    <code className={styles.tableId}>{row.tenant.id}</code>
                  </td>
                  <td>
                    {fmt(row.web.visitors)} / {fmt(row.web.views)}
                  </td>
                  <td>
                    {row.web.bounceRate.toFixed(1)}% / {Math.round(row.web.duration)}s
                  </td>
                  <td>{fmt(row.requests)}</td>
                  <td>{row.requests ? ((row.errors / row.requests) * 100).toFixed(2) : '0.00'}%</td>
                  <td>
                    {row.p50} / {row.p95} ms
                  </td>
                  <td>
                    <div className={styles.rowActions}>
                      <button
                        type="button"
                        aria-label={`Open dashboard for ${row.tenant.name}`}
                        onClick={() => onView(row.tenant.id)}
                      >
                        <ArrowUpRight size={14} /> Dashboard
                      </button>
                      <button
                        type="button"
                        aria-label={`Manage data for ${row.tenant.name}`}
                        onClick={() => onManage(row.tenant.id)}
                      >
                        <Database size={14} /> Data
                      </button>
                      <button
                        type="button"
                        className={styles.dangerLink}
                        aria-label={`Remove ${row.tenant.name}`}
                        onClick={() => onManage(row.tenant.id, true)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!ranked.length && (
          <p className={styles.empty}>No projects match this view. Add a project to begin.</p>
        )}
      </section>
      <div className={styles.apiSummary}>
        <section className={styles.card}>
          <h3>API usage by project</h3>
          <p className={styles.muted}>Share of synthetic requests in the selected period.</p>
          <div className={styles.ranking}>
            {[...rows]
              .sort((a, b) => b.requests - a.requests)
              .map(row => (
                <div key={row.tenant.id}>
                  <span>{row.tenant.name}</span>
                  <strong>{fmt(row.requests)}</strong>
                  <div>
                    <i
                      style={{
                        width: `${totalRequests ? (row.requests / totalRequests) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
          </div>
        </section>
        <section className={styles.card}>
          <h3>Service commitments</h3>
          <ul className={styles.roadmap}>
            <li>
              <Users size={16} /> Free tenant enrollment · €0 tenant fees
            </li>
            <li>
              <ShieldCheck size={16} /> High availability planned for production
            </li>
            <li>
              <Database size={16} /> Data erasure preview with activity history
            </li>
          </ul>
          <p className={styles.muted}>
            This public POC uses simulated roles. Persistent audit records, administrator
            authorization and deletion from live systems are production work.
          </p>
        </section>
      </div>
      <ActivityLog entries={audit} />
    </>
  );
}
