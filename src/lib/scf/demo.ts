/** Synthetic fixtures only. tenant.id is the existing Umami Team.id. */
export type Tenant = {
  id: string;
  websiteId: string;
  name: string;
  domain: string;
  service: string;
  category: string;
  seed: number;
};
export const DEMO_TENANTS: Tenant[] = [
  {
    id: 'a1000000-0000-4000-8000-000000000001',
    websiteId: 'b1000000-0000-4000-8000-000000000001',
    name: 'Nova Wallet',
    domain: 'nova.example',
    service: 'nova-api',
    category: 'Wallet',
    seed: 3,
  },
  {
    id: 'a1000000-0000-4000-8000-000000000002',
    websiteId: 'b1000000-0000-4000-8000-000000000002',
    name: 'Orbit Payments',
    domain: 'orbit.example',
    service: 'orbit-api',
    category: 'Payments',
    seed: 7,
  },
  {
    id: 'a1000000-0000-4000-8000-000000000003',
    websiteId: 'b1000000-0000-4000-8000-000000000003',
    name: 'Lumen Bridge',
    domain: 'bridge.example',
    service: 'bridge-api',
    category: 'DeFi',
    seed: 11,
  },
];

export const COUNTRIES = ['FR', 'US', 'DE', 'BR', 'NG'];
export const BROWSERS = ['chrome', 'safari', 'firefox', 'edge'];
export const DEVICES = ['desktop', 'mobile', 'tablet'];
export const REFERRERS = ['Direct', 'stellar.org', 'google.com', 'github.com'];
export const PAGES = ['/', '/app', '/docs', '/ecosystem', '/connect'];
export const ROUTES = ['/v1/accounts/:address', '/v1/payments/:id', '/v1/quotes', '/health'];
export const LATENCY_BOUNDS = [25, 50, 100, 250, 500, 1000, 2500];

export function normalizePath(path: string): string {
  const pathname = path.split(/[?#]/)[0];
  return `/${pathname
    .split('/')
    .filter(Boolean)
    .map(segment => {
      if (/^[GCM][A-Z2-7]{55,68}$/.test(segment)) return ':address';
      if (/^\d+$/.test(segment)) return ':id';
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment))
        return ':uuid';
      if (/^(?:0x)?[0-9a-f]{16,}$/i.test(segment)) return ':hash';
      return segment;
    })
    .join('/')}`;
}

export function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}
export function daysInRange(days: number, now = new Date()): string[] {
  const end = new Date(`${dateKey(now)}T00:00:00Z`);
  return Array.from({ length: days }, (_, i) =>
    dateKey(new Date(+end - (days - 1 - i) * 86400000)),
  );
}
function daySeed(tenant: Tenant, date: string) {
  return [...date].reduce((sum, c) => sum * 31 + c.charCodeAt(0), tenant.seed) >>> 0;
}

/** One visit per synthetic session; shared with the native Umami seed. */
export function visitsForDay(tenant: Tenant, date: string) {
  if (!tenant.seed) return [];
  const seed = daySeed(tenant, date);
  return Array.from({ length: 24 + (seed % 52) }, (_, i) => {
    const pageviews = i % 4 === 0 ? 1 : 2 + ((seed + i) % 4);
    return {
      pageviews,
      duration: (pageviews - 1) * (24 + (i % 6) * 12),
      country: COUNTRIES[i % 5],
      browser: BROWSERS[i % 4],
      device: DEVICES[i % 3],
      referrer: REFERRERS[i % 4],
    };
  });
}

export type ApiRow = {
  tenantId: string;
  service: string;
  route: string;
  requests: number;
  statuses: number[];
  histogram: number[];
};
/** Histograms are merged before quantiles; percentiles are never averaged. */
export function percentile(histogram: number[], fraction: number): number {
  const total = histogram.reduce((a, b) => a + b, 0);
  if (!total) return 0;
  let count = 0;
  for (let i = 0; i < histogram.length; i++) {
    count += histogram[i];
    if (count >= Math.ceil(total * fraction)) return LATENCY_BOUNDS[i];
  }
  return LATENCY_BOUNDS[LATENCY_BOUNDS.length - 1];
}
export function mergeHistograms(histograms: number[][]) {
  return LATENCY_BOUNDS.map((_, i) => histograms.reduce((sum, h) => sum + h[i], 0));
}
export function apiRows(tenants: Tenant[], dates: string[]): ApiRow[] {
  return tenants.flatMap(tenant =>
    ROUTES.map((route, index) => {
      const requests = tenant.seed
        ? dates.reduce((sum, date) => sum + 700 + (daySeed(tenant, date) % 900) + index * 139, 0)
        : 0;
      const errors = Math.floor(requests * (0.006 + index * 0.003));
      const clientErrors = Math.floor(requests * 0.021);
      const histogram = [0.12, 0.3, 0.32, 0.19, 0.05, 0.015].map(x => Math.floor(requests * x));
      histogram.push(requests - histogram.reduce((a, b) => a + b, 0));
      return {
        tenantId: tenant.id,
        service: tenant.service,
        route,
        requests,
        statuses: [requests - errors - clientErrors, clientErrors, errors],
        histogram,
      };
    }),
  );
}
export function webMetrics(tenants: Tenant[], dates: string[]) {
  const countries: Record<string, number> = {},
    browsers: Record<string, number> = {},
    devices: Record<string, number> = {},
    referrers: Record<string, number> = {},
    pages: Record<string, number> = {};
  let visitors = 0,
    views = 0,
    bounces = 0,
    duration = 0;
  const series = dates.map(date => {
    let dayViews = 0,
      dayVisitors = 0;
    for (const tenant of tenants) {
      visitsForDay(tenant, date).forEach((visit, i) => {
        dayVisitors++;
        dayViews += visit.pageviews;
        if (visit.pageviews === 1) bounces++;
        duration += visit.duration;
        for (const [record, key] of [
          [countries, visit.country],
          [browsers, visit.browser],
          [devices, visit.device],
          [referrers, visit.referrer],
        ] as const)
          record[key] = (record[key] || 0) + 1;
        for (let p = 0; p < visit.pageviews; p++) {
          const path = PAGES[(i + p) % PAGES.length];
          pages[path] = (pages[path] || 0) + 1;
        }
      });
    }
    views += dayViews;
    visitors += dayVisitors;
    return { date, views: dayViews, visitors: dayVisitors };
  });
  return {
    visitors,
    views,
    bounceRate: visitors ? (bounces / visitors) * 100 : 0,
    duration: visitors ? duration / visitors : 0,
    countries,
    browsers,
    devices,
    referrers,
    pages,
    series,
  };
}
