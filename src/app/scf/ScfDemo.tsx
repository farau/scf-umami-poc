'use client';

import {
  Activity,
  ArrowDownToLine,
  ArrowUpRight,
  BarChart3,
  Check,
  ChevronRight,
  Code2,
  Database,
  Globe2,
  Layers3,
  LayoutDashboard,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { PageviewsChart } from '@/components/metrics/PageviewsChart';
import {
  apiRows,
  DEMO_TENANTS,
  dateKey,
  daysInRange,
  mergeHistograms,
  normalizePath,
  percentile,
  type Tenant,
  webMetrics,
} from '@/lib/scf/demo';
import { applyDeletion, type DeletionRequest, initialManagementState } from '@/lib/scf/management';
import { AdminDashboard } from './AdminDashboard';
import { DataManagement } from './DataManagement';
import styles from './scf.module.css';

const fmt = (n: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n);
const tabs = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'admin', label: 'SCF administration', icon: ShieldCheck },
  { id: 'web', label: 'Web analytics', icon: Globe2 },
  { id: 'api', label: 'API analytics', icon: Activity },
  { id: 'tenants', label: 'Projects', icon: Layers3 },
  { id: 'integration', label: 'Integration', icon: Code2 },
  { id: 'data', label: 'Data & privacy', icon: Database },
];

function Breakdown({
  title,
  values,
  suffix = 'visitors',
}: {
  title: string;
  values: Record<string, number>;
  suffix?: string;
}) {
  const rows = Object.entries(values).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...Object.values(values));
  return (
    <section className={styles.card}>
      <div className={styles.cardTitle}>
        <h3>{title}</h3>
        <span>{suffix}</span>
      </div>
      {rows.length ? (
        rows.map(([label, value]) => (
          <div className={styles.breakdown} key={label}>
            <div style={{ width: `${(value / max) * 100}%` }} />
            <span>{label}</span>
            <strong>{fmt(value)}</strong>
          </div>
        ))
      ) : (
        <p className={styles.empty}>No activity yet. Your project is ready to connect.</p>
      )}
    </section>
  );
}

export default function ScfDemo({ nativeEnabled }: { nativeEnabled: boolean }) {
  const [data, setData] = useState(initialManagementState);
  const { tenants, erasures, audit } = data;
  const [manageTenantId, setManageTenantId] = useState(DEMO_TENANTS[0].id);
  const [manageAction, setManageAction] = useState<'erase' | 'remove'>('erase');
  const [scope, setScope] = useState('all');
  const [tab, setTab] = useState('overview');
  const [days, setDays] = useState(30);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('requests');
  const [compare, setCompare] = useState<string[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [notice, setNotice] = useState('');
  const [path, setPath] = useState('/v1/payments/12845?asset=USDC');
  const [now] = useState(() => new Date());
  const dates = useMemo(() => daysInRange(days, now), [days, now]);
  const allDates = useMemo(() => daysInRange(90, now), [now]);
  const active = tenants.find(t => t.id === scope);
  const selected = active ? [active] : tenants;
  const web = useMemo(
    () => webMetrics(selected, dates, erasures),
    [tenants, scope, dates, erasures],
  );
  const api = useMemo(() => apiRows(selected, dates, erasures), [tenants, scope, dates, erasures]);
  const requests = api.reduce((sum, r) => sum + r.requests, 0);
  const statuses = [0, 1, 2].map(i => api.reduce((sum, r) => sum + r.statuses[i], 0));
  const histogram = mergeHistograms(api.map(r => r.histogram));
  const projectRows = selected
    .filter(t => `${t.name} ${t.domain}`.toLowerCase().includes(search.toLowerCase()))
    .map(tenant => {
      const w = webMetrics([tenant], dates, erasures);
      const a = apiRows([tenant], dates, erasures);
      const total = a.reduce((s, r) => s + r.requests, 0);
      return {
        tenant,
        web: w,
        requests: total,
        p95: percentile(mergeHistograms(a.map(r => r.histogram)), 0.95),
      };
    })
    .sort((a, b) =>
      sort === 'name'
        ? a.tenant.name.localeCompare(b.tenant.name)
        : sort === 'visitors'
          ? b.web.visitors - a.web.visitors
          : b.requests - a.requests,
    );
  const chartData = useMemo(
    () => ({
      pageviews: web.series.map(d => ({ x: `${d.date}T00:00:00Z`, y: d.views })),
      sessions: web.series.map(d => ({ x: `${d.date}T00:00:00Z`, y: d.visitors })),
    }),
    [web],
  );

  function exportData() {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            synthetic: true,
            scope,
            dates,
            tenants: selected,
            web,
            api,
            audit: active ? audit.filter(entry => entry.tenantId === active.id) : audit,
          },
          null,
          2,
        ),
      ],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `scf-demo-${dateKey(now)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice('Synthetic data exported for the selected period.');
  }

  function addTenant(form: FormData) {
    const name = String(form.get('name') || '').trim();
    const domain = String(form.get('domain') || '')
      .trim()
      .toLowerCase();
    if (!name || !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(domain)) {
      setNotice('Enter a project name and a valid domain, without https://.');
      return;
    }
    if (tenants.some(t => t.domain === domain)) {
      setNotice('This domain is already enrolled.');
      return;
    }
    const tenant: Tenant = {
      id: crypto.randomUUID(),
      websiteId: crypto.randomUUID(),
      name,
      domain,
      service: `${domain.split('.')[0]}-api`,
      category: String(form.get('category')),
      seed: 0,
    };
    setData({ ...data, tenants: [...tenants, tenant] });
    setShowAdd(false);
    setManageAction('erase');
    setScope(tenant.id);
    setTab('integration');
    setNotice(`${name} added for free. Demo changes last until the page is refreshed.`);
  }

  function deleteData(request: DeletionRequest) {
    try {
      const next = applyDeletion(data, request, {
        perspective: scope,
        dates: allDates,
        at: new Date().toISOString(),
        id: crypto.randomUUID(),
      });
      setData(next);
      setCompare(ids => ids.filter(id => next.tenants.some(tenant => tenant.id === id)));
      if (!next.tenants.some(tenant => tenant.id === scope) && scope !== 'all') {
        setScope('all');
        setTab('data');
      }
      setNotice(
        request.action === 'remove'
          ? 'Project and synthetic data removed from this demo session. Refresh restores the original dataset.'
          : 'Selected synthetic data erased. Dashboards, comparisons and exports have been updated. Refresh restores the original dataset.',
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to apply this demo action.');
    }
  }

  function manageData(id: string, remove = false) {
    setManageTenantId(id);
    setManageAction(remove ? 'remove' : 'erase');
    setTab('data');
  }

  const summaryCards = [
    {
      label: 'Unique visitors',
      value: fmt(web.visitors),
      detail: 'Daily distinct sessions',
      icon: Users,
    },
    { label: 'Page views', value: fmt(web.views), detail: 'Frontend activity', icon: Globe2 },
    {
      label: 'API requests',
      value: fmt(requests),
      detail: 'Across normalized routes',
      icon: Activity,
    },
    {
      label: 'API latency · p95',
      value: `${percentile(histogram, 0.95)} ms`,
      detail: 'Merged histogram estimate',
      icon: BarChart3,
    },
  ];

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <a className={styles.brand} href="/scf">
          <span className={styles.brandIcon}>✳</span>
          <span>
            stellar<span className={styles.brandSub}>ecosystem analytics</span>
          </span>
        </a>
        <div className={styles.workspaceLabel}>WORKSPACE</div>
        <label className={styles.scope}>
          <span className={styles.workspaceIcon}>S</span>
          <select
            aria-label="Demo perspective"
            value={scope}
            onChange={e => {
              setScope(e.target.value);
              setManageAction('erase');
              setCompare([]);
              if (tab === 'admin' || tab === 'tenants') setTab('overview');
            }}
          >
            {<option value="all">SCF · All projects</option>}
            {tenants.map(t => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <span className={styles.perspective}>
          {active ? 'Tenant perspective · simulated' : 'SCF operator · simulated'}
        </span>
        <nav aria-label="Analytics navigation">
          {tabs
            .filter(t => !active || (t.id !== 'tenants' && t.id !== 'admin'))
            .map(item => (
              <button
                type="button"
                key={item.id}
                className={tab === item.id ? styles.navActive : styles.navItem}
                onClick={() => setTab(item.id)}
              >
                <item.icon size={18} />
                {item.label}
                {item.id === 'tenants' && <span className={styles.count}>{tenants.length}</span>}
              </button>
            ))}
        </nav>
        <div className={styles.sidebarBottom}>
          <div className={styles.freeCard}>
            <Sparkles size={20} />
            <strong>Built for the ecosystem.</strong>
            <p>
              Free analytics. Free enrollment.
              <br />
              Every Stellar project belongs.
            </p>
            <button type="button" onClick={() => setShowAdd(true)}>
              Add a project <Plus size={15} />
            </button>
          </div>
          <a
            href="https://github.com/umami-software/umami"
            target="_blank"
            rel="noreferrer"
            className={styles.powered}
          >
            <span className={styles.umamiMark}>◕</span> Powered by Umami <ArrowUpRight size={13} />
          </a>
          <div className={styles.profile}>
            <span>SC</span>
            <div>
              <strong>SCF Demo</strong>
              <small>Public demonstration</small>
            </div>
          </div>
        </div>
      </aside>
      <div className={styles.main}>
        <header className={styles.topbar}>
          <span>
            Workspace <ChevronRight size={13} />
            <strong>{active?.name || 'Stellar Community Fund'}</strong>
          </span>
          <span className={styles.demoBadge}>
            <span /> Demo · synthetic data
          </span>
        </header>
        <main className={styles.content}>
          <div className={styles.heading}>
            <div>
              <div className={styles.eyebrow}>STELLAR COMMUNITY FUND</div>
              <h1>
                {tab === 'overview'
                  ? active
                    ? active.name
                    : 'Ecosystem overview'
                  : tabs.find(t => t.id === tab)?.label}
              </h1>
              <p>
                {active
                  ? `Web and API usage for ${active.domain}.`
                  : 'A shared view of the projects moving Stellar forward.'}
              </p>
            </div>
            <div className={styles.actions}>
              <button type="button" onClick={exportData}>
                <ArrowDownToLine size={15} /> Export
              </button>
              <button type="button" className={styles.primary} onClick={() => setShowAdd(true)}>
                <Plus size={16} /> Add project <span>Free</span>
              </button>
            </div>
          </div>
          <div className={styles.demoNote}>
            <ShieldCheck size={17} />
            <span>
              <strong>Proof of concept.</strong> All projects and activity are fictional.
              Perspective switching previews the experience; authentication and production isolation
              are outside this demo.
            </span>
          </div>
          {notice && (
            <div role="status" className={styles.notice}>
              {notice}
              <button type="button" aria-label="Dismiss notification" onClick={() => setNotice('')}>
                <X size={15} />
              </button>
            </div>
          )}
          <div className={styles.toolbar}>
            <div className={styles.pills}>
              {['overview', 'web', 'api'].map(id => (
                <button
                  type="button"
                  key={id}
                  className={tab === id ? styles.pillActive : ''}
                  onClick={() => setTab(id)}
                >
                  {id === 'overview' ? 'Overview' : id === 'web' ? 'Web' : 'API'}
                </button>
              ))}
            </div>
            <div className={styles.dateRange}>
              <span>
                {dates[0]} — {dates[dates.length - 1]} <small>UTC</small>
              </span>
              <select
                aria-label="Time range"
                value={days}
                onChange={e => setDays(Number(e.target.value))}
              >
                <option value={7}>Last 7 days</option>
                <option value={30}>Last 30 days</option>
                <option value={90}>Last 90 days</option>
              </select>
            </div>
          </div>

          {tab === 'admin' && !active && (
            <AdminDashboard
              tenants={tenants}
              dates={dates}
              erasures={erasures}
              audit={audit}
              onView={id => {
                setScope(id);
                setTab('overview');
                setCompare([]);
              }}
              onManage={manageData}
            />
          )}
          {tab === 'data' && (
            <DataManagement
              key={`${active?.id || 'all'}-${manageTenantId}-${manageAction}`}
              tenants={selected}
              initialTenantId={active?.id || manageTenantId}
              initialAction={manageAction}
              dates={dates}
              allDates={allDates}
              erasures={erasures}
              audit={active ? audit.filter(entry => entry.tenantId === active.id) : audit}
              isAdmin={!active}
              onDelete={deleteData}
            />
          )}

          {(tab === 'overview' || tab === 'web' || tab === 'api') && (
            <>
              <div className={styles.metrics}>
                {(tab === 'web'
                  ? [
                      summaryCards[0],
                      summaryCards[1],
                      {
                        label: 'Bounce rate',
                        value: `${web.bounceRate.toFixed(1)}%`,
                        detail: 'Single-page visits / visits',
                        icon: ArrowUpRight,
                      },
                      {
                        label: 'Session duration',
                        value: `${Math.round(web.duration)}s`,
                        detail: 'Average across visits',
                        icon: Activity,
                      },
                    ]
                  : tab === 'api'
                    ? [
                        summaryCards[2],
                        {
                          label: 'Server error rate',
                          value: `${requests ? ((statuses[2] / requests) * 100).toFixed(2) : '0.00'}%`,
                          detail: '5xx responses / requests',
                          icon: ShieldCheck,
                        },
                        {
                          label: 'API latency · p50',
                          value: `${percentile(histogram, 0.5)} ms`,
                          detail: 'Histogram bucket estimate',
                          icon: BarChart3,
                        },
                        summaryCards[3],
                      ]
                    : summaryCards
                ).map(card => (
                  <section key={card.label} className={styles.metric}>
                    <div>
                      <span>{card.label}</span>
                      <card.icon size={17} />
                    </div>
                    <strong>{card.value}</strong>
                    <small>{card.detail}</small>
                  </section>
                ))}
              </div>
              {(tab === 'overview' || tab === 'web') && (
                <section className={`${styles.card} ${styles.chartCard}`}>
                  <div className={styles.cardTitle}>
                    <div>
                      <h3>Web activity</h3>
                      <p>
                        Daily page views and unique visitors{active ? '' : ' across all projects'}
                      </p>
                    </div>
                    <span className={styles.liveTag}>Synthetic dataset</span>
                  </div>
                  <PageviewsChart
                    key={`${scope}-${days}`}
                    data={chartData}
                    unit="day"
                    minDate={new Date(`${dates[0]}T00:00:00Z`)}
                    maxDate={new Date(`${dates[dates.length - 1]}T23:59:59Z`)}
                  />
                </section>
              )}
              {tab === 'web' && (
                <div className={styles.breakdownGrid}>
                  <Breakdown title="Top pages" values={web.pages} suffix="views" />
                  <Breakdown title="Referrers" values={web.referrers} />
                  <Breakdown title="Countries" values={web.countries} />
                  <Breakdown title="Browsers" values={web.browsers} />
                  <Breakdown title="Devices" values={web.devices} />
                  <section className={styles.card}>
                    <ShieldCheck size={24} />
                    <h3>Privacy by design</h3>
                    <p className={styles.muted}>
                      This demo collects no visitor telemetry. Country, device and browser
                      breakdowns are generated fixtures. Production privacy controls remain to be
                      implemented.
                    </p>
                  </section>
                </div>
              )}
              {tab === 'api' && (
                <>
                  <div className={styles.apiSummary}>
                    <Breakdown
                      title="HTTP status distribution"
                      values={{
                        '2xx · Successful': statuses[0],
                        '4xx · Client error': statuses[1],
                        '5xx · Server error': statuses[2],
                      }}
                      suffix="requests"
                    />
                    <section className={styles.card}>
                      <h3>Standard OpenTelemetry attributes</h3>
                      <p className={styles.muted}>
                        Metrics-only preview. No traces, spans or logs are collected.
                      </p>
                      <div className={styles.attributeList}>
                        {[
                          'tenant.id',
                          'service.name',
                          'http.route',
                          'http.response.status_code',
                          'http.server.request.duration',
                        ].map(a => (
                          <code key={a}>{a}</code>
                        ))}
                      </div>
                    </section>
                  </div>
                  <section className={styles.card}>
                    <div className={styles.cardTitle}>
                      <h3>Normalized endpoints</h3>
                      <span>{api.length} routes · p50 / p95 estimates</span>
                    </div>
                    <div className={styles.tableWrap}>
                      <table>
                        <thead>
                          <tr>
                            <th>Service / tenant.id</th>
                            <th>http.route</th>
                            <th>Requests</th>
                            <th>2xx / 4xx / 5xx</th>
                            <th>p50</th>
                            <th>p95</th>
                          </tr>
                        </thead>
                        <tbody>
                          {api.map(row => (
                            <tr key={`${row.tenantId}-${row.route}`}>
                              <td>
                                <strong>{row.service}</strong>
                                <code className={styles.tableId}>{row.tenantId}</code>
                              </td>
                              <td>
                                <code>{row.route}</code>
                              </td>
                              <td>{fmt(row.requests)}</td>
                              <td>{row.statuses.map(fmt).join(' / ')}</td>
                              <td>{percentile(row.histogram, 0.5)} ms</td>
                              <td>{percentile(row.histogram, 0.95)} ms</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                  <section className={styles.normalizer}>
                    <div>
                      <h3>Try path normalization</h3>
                      <p>Fixed rules for IDs, UUIDs, hashes and Stellar addresses.</p>
                    </div>
                    <label>
                      Request path
                      <input
                        aria-label="Request path"
                        value={path}
                        onChange={e => setPath(e.target.value)}
                        maxLength={500}
                      />
                    </label>
                    <ChevronRight size={20} />
                    <code>{normalizePath(path)}</code>
                  </section>
                </>
              )}
            </>
          )}

          {(tab === 'overview' || tab === 'tenants') && (
            <section className={styles.card}>
              <div className={styles.cardTitle}>
                <div>
                  <h3>
                    {active ? 'Your project' : 'Ecosystem projects'}{' '}
                    <span className={styles.count}>{selected.length}</span>
                  </h3>
                  <p>
                    {active
                      ? 'Metrics for the selected tenant.'
                      : 'Compare adoption with the same metrics, over the same period.'}
                  </p>
                </div>
                <div className={styles.tableTools}>
                  <label>
                    <Search size={15} />
                    <input
                      aria-label="Search projects"
                      placeholder="Search projects…"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                    />
                  </label>
                  <select
                    aria-label="Sort projects"
                    value={sort}
                    onChange={e => setSort(e.target.value)}
                  >
                    <option value="requests">API requests ↓</option>
                    <option value="visitors">Visitors ↓</option>
                    <option value="name">Name A–Z</option>
                  </select>
                </div>
              </div>
              <div className={styles.tableWrap}>
                <table>
                  <thead>
                    <tr>
                      {!active && <th>Compare</th>}
                      <th>Project</th>
                      <th>Visitors</th>
                      <th>Page views</th>
                      <th>API requests</th>
                      <th>p95 latency</th>
                      <th>Enrollment</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {projectRows.map(({ tenant, web: w, requests: total, p95 }) => (
                      <tr key={tenant.id}>
                        {!active && (
                          <td>
                            <input
                              type="checkbox"
                              aria-label={`Compare ${tenant.name}`}
                              checked={compare.includes(tenant.id)}
                              onChange={e =>
                                setCompare(
                                  e.target.checked
                                    ? [...compare, tenant.id]
                                    : compare.filter(id => id !== tenant.id),
                                )
                              }
                            />
                          </td>
                        )}
                        <td>
                          <div className={styles.projectCell}>
                            <span
                              style={{
                                background:
                                  tenant.seed === 3
                                    ? '#373151'
                                    : tenant.seed === 7
                                      ? '#274535'
                                      : '#4c3b26',
                              }}
                            >
                              {tenant.name.slice(0, 1)}
                            </span>
                            <div>
                              <strong>{tenant.name}</strong>
                              <small>{tenant.domain}</small>
                            </div>
                          </div>
                        </td>
                        <td>{fmt(w.visitors)}</td>
                        <td>{fmt(w.views)}</td>
                        <td>{fmt(total)}</td>
                        <td>{p95} ms</td>
                        <td>
                          <span className={styles.freeBadge}>Free</span>
                        </td>
                        <td>
                          <button
                            type="button"
                            aria-label={`View ${tenant.name}`}
                            className={styles.iconButton}
                            onClick={() => {
                              setScope(tenant.id);
                              setTab('overview');
                              setCompare([]);
                            }}
                          >
                            <ArrowUpRight size={17} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!projectRows.length && (
                  <p className={styles.empty}>No projects match your search.</p>
                )}
              </div>
              {compare.length > 0 && !active && (
                <div className={styles.comparison}>
                  <h3>Side-by-side comparison · {days} days</h3>
                  <div>
                    {tenants
                      .filter(t => compare.includes(t.id))
                      .map(t => {
                        const w = webMetrics([t], dates, erasures);
                        const rows = apiRows([t], dates, erasures);
                        return (
                          <section key={t.id}>
                            <strong>{t.name}</strong>
                            <p>
                              {fmt(w.visitors)} visitors · {fmt(w.views)} views
                            </p>
                            <p>
                              {w.bounceRate.toFixed(1)}% bounce · {Math.round(w.duration)}s session
                            </p>
                            <p>{fmt(rows.reduce((s, r) => s + r.requests, 0))} API requests</p>
                            <p>
                              p50 {percentile(mergeHistograms(rows.map(r => r.histogram)), 0.5)} ms
                              · p95 {percentile(mergeHistograms(rows.map(r => r.histogram)), 0.95)}{' '}
                              ms
                            </p>
                          </section>
                        );
                      })}
                  </div>
                </div>
              )}
            </section>
          )}

          {tab === 'integration' && tenants.length > 0 && (
            <div className={styles.integrationGrid}>
              <section className={styles.card}>
                <div className={styles.step}>01 · PROJECT IDENTITY</div>
                <h2>One tenant. Web + API.</h2>
                <p className={styles.muted}>
                  Each project maps to one Umami team. Its websites belong to that team; API metrics
                  carry the same tenant.id.
                </p>
                <label>
                  Project
                  <select
                    aria-label="Integration project"
                    value={active?.id || tenants[0].id}
                    onChange={e => setScope(e.target.value)}
                  >
                    {tenants.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </label>
                <dl>
                  {Object.entries({
                    'tenant.id / Umami team.id': (active || tenants[0]).id,
                    'website.id': (active || tenants[0]).websiteId,
                    'service.name': (active || tenants[0]).service,
                  }).map(([k, v]) => (
                    <div key={k}>
                      <dt>{k}</dt>
                      <dd>
                        <code>{v}</code>
                      </dd>
                    </div>
                  ))}
                </dl>
                <span className={styles.freeBadge}>
                  <Check size={13} /> Enrollment: €0 · no tenant fee
                </span>
              </section>
              <section className={styles.card}>
                <div className={styles.step}>02 · WEB ANALYTICS</div>
                <h2>Your Umami integration</h2>
                <p className={styles.muted}>
                  Native Umami snippet, available after configuring the database and building the
                  tracker. This demo does not collect events. An immutable, versioned tracker with
                  SRI is part of the production scope.
                </p>
                <pre>{`<script defer\n  src="https://YOUR-RAILWAY-DOMAIN/script.js"\n  data-website-id="${(active || tenants[0]).websiteId}">\n</script>`}</pre>
                {nativeEnabled && (
                  <a
                    className={styles.textLink}
                    href={`/websites/${(active || tenants[0]).websiteId}`}
                  >
                    Open native Umami dashboard <ArrowUpRight size={15} />
                  </a>
                )}
              </section>
              <section className={styles.card}>
                <div className={styles.step}>03 · API ANALYTICS</div>
                <h2>Keep your APM. Add one export.</h2>
                <p className={styles.muted}>
                  Production will accept dual-exported OpenTelemetry metrics. Collector ingestion is
                  outside this POC; the following attributes describe the expected contract.
                </p>
                <pre>
                  {JSON.stringify(
                    {
                      resource: {
                        'tenant.id': (active || tenants[0]).id,
                        'service.name': (active || tenants[0]).service,
                      },
                      attributes: {
                        'http.route': '/v1/payments/:id',
                        'http.response.status_code': 200,
                      },
                      metric: 'http.server.request.duration',
                      unit: 's',
                    },
                    null,
                    2,
                  )}
                </pre>
              </section>
              <section className={styles.card}>
                <div className={styles.step}>04 · PRODUCTION ROADMAP</div>
                <h2>Free to join. Built to be shared.</h2>
                <ul className={styles.roadmap}>
                  <li>
                    <Check size={16} /> €0 to add a tenant
                  </li>
                  <li>
                    <ShieldCheck size={16} /> High availability planned for production
                  </li>
                  <li>
                    <Layers3 size={16} /> Tenant authorization + PostgreSQL isolation
                  </li>
                  <li>
                    <Activity size={16} /> Metrics collector + 24-month aggregates
                  </li>
                </ul>
                <p className={styles.muted}>
                  The Railway POC runs as a single application. No HA, failover, uptime guarantee or
                  production isolation is demonstrated.
                </p>
              </section>
            </div>
          )}

          {tab === 'integration' && tenants.length === 0 && (
            <section className={styles.card}>
              <h3>No project to integrate</h3>
              <p className={styles.empty}>
                Add a project for free to get its tenant and website identifiers.
              </p>
              <button type="button" className={styles.primary} onClick={() => setShowAdd(true)}>
                Add a project
              </button>
            </section>
          )}

          <div className={styles.commitment}>
            <div>
              <ShieldCheck size={20} />
              <span>
                <strong>High availability</strong>
                <small>Planned for production · outside this POC</small>
              </span>
            </div>
            <div>
              <Users size={20} />
              <span>
                <strong>Free for every tenant</strong>
                <small>€0 enrollment · €0 tenant fees</small>
              </span>
            </div>
            <div>
              <Layers3 size={20} />
              <span>
                <strong>Built on open source</strong>
                <small>Umami · MIT license · Railway POC</small>
              </span>
            </div>
          </div>
          <footer className={styles.footer}>
            <span>
              Stellar ecosystem analytics <span> / </span> SCF proof of concept
            </span>
            <span>Fictional projects. Synthetic metrics. Shared possibilities.</span>
          </footer>
        </main>
      </div>
      {showAdd && (
        <div className={styles.overlay}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="enroll-title"
            className={styles.modal}
          >
            <button
              className={styles.close}
              type="button"
              aria-label="Close enrollment"
              onClick={() => setShowAdd(false)}
            >
              <X size={20} />
            </button>
            <span className={styles.freeBadge}>Free enrollment</span>
            <h2 id="enroll-title">Your project belongs here.</h2>
            <p>Add a Stellar project for €0. This enrollment is simulated and resets on refresh.</p>
            <form action={addTenant}>
              <label>
                Project name
                <input
                  name="name"
                  required
                  maxLength={50}
                  placeholder="My Stellar project"
                  autoFocus
                />
              </label>
              <label>
                Website domain
                <input name="domain" required maxLength={200} placeholder="project.example" />
              </label>
              <label>
                Category
                <select name="category">
                  <option>Wallet</option>
                  <option>Payments</option>
                  <option>DeFi</option>
                  <option>Developer tools</option>
                  <option>Other</option>
                </select>
              </label>
              <label>
                Stellar ecosystem proof
                <input
                  name="proof"
                  required
                  maxLength={300}
                  placeholder="SCF project URL, contract ID or stellar.toml URL"
                />
              </label>
              <small>
                Proof is collected for this UX preview only; it is not verified or stored.
              </small>
              <button type="submit" className={styles.primary}>
                Add project for free <ArrowUpRight size={16} />
              </button>
            </form>
            <p className={styles.formNotice} role="status">
              {notice}
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
