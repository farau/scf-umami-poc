import { describe, expect, it } from 'vitest';
import {
  apiRows,
  DEMO_TENANTS,
  daysInRange,
  mergeHistograms,
  normalizePath,
  percentile,
  visitsForDay,
  webMetrics,
} from './demo';

const dates = daysInRange(30, new Date('2026-11-17T12:00:00Z'));
describe('SCF synthetic analytics contract', () => {
  it('normalizes sensitive path segments and removes queries', () => {
    for (const [input, result] of [
      ['/v1/payments/123/?secret=test', '/v1/payments/:id'],
      [`/accounts/G${'A'.repeat(55)}`, '/accounts/:address'],
      [`/contracts/C${'A'.repeat(55)}`, '/contracts/:address'],
      [`/muxed/M${'A'.repeat(68)}`, '/muxed/:address'],
      [`/tx/0x${'a'.repeat(64)}`, '/tx/:hash'],
      ['/items/abc123ab-1234-4321-8888-123456789012', '/items/:uuid'],
      ['/', '/'],
    ])
      expect(normalizePath(input)).toBe(result);
  });
  it('makes the global view equal the sum of its tenants', () => {
    const global = webMetrics(DEMO_TENANTS, dates);
    const projects = DEMO_TENANTS.map(t => webMetrics([t], dates));
    expect(global.views).toBe(projects.reduce((sum, w) => sum + w.views, 0));
    expect(global.visitors).toBe(projects.reduce((sum, w) => sum + w.visitors, 0));
    expect(global.series.reduce((sum, d) => sum + d.views, 0)).toBe(global.views);
    expect(Object.values(global.pages).reduce((a, b) => a + b, 0)).toBe(global.views);
    expect(Object.values(global.countries).reduce((a, b) => a + b, 0)).toBe(global.visitors);
    expect(webMetrics([DEMO_TENANTS[0]], dates).views).toBe(
      dates.flatMap(d => visitsForDay(DEMO_TENANTS[0], d)).reduce((sum, v) => sum + v.pageviews, 0),
    );
  });
  it('keeps API totals, histograms and status counts consistent with tenant attribution', () => {
    const rows = apiRows([DEMO_TENANTS[0]], dates);
    for (const row of rows) {
      expect(row.tenantId).toBe(DEMO_TENANTS[0].id);
      expect(row.statuses.reduce((a, b) => a + b, 0)).toBe(row.requests);
      expect(row.histogram.reduce((a, b) => a + b, 0)).toBe(row.requests);
      expect(percentile(row.histogram, 0.5)).toBeLessThanOrEqual(percentile(row.histogram, 0.95));
    }
  });
  it('merges populations before estimating percentiles', () => {
    expect(
      percentile(
        mergeHistograms([
          [1000, 0, 0, 0, 0, 0, 0],
          [0, 0, 0, 0, 0, 0, 1],
        ]),
        0.95,
      ),
    ).toBe(25);
  });
  it('uses UTC date boundaries and includes shorter periods in longer periods', () => {
    expect(dates).toHaveLength(30);
    expect(dates[0]).toBe('2026-10-19');
    expect(dates[29]).toBe('2026-11-17');
    expect(webMetrics(DEMO_TENANTS, dates.slice(-7)).views).toBeLessThan(
      webMetrics(DEMO_TENANTS, dates).views,
    );
  });
  it('leaves newly enrolled projects empty until connected', () => {
    const tenant = { ...DEMO_TENANTS[0], seed: 0 };
    expect(webMetrics([tenant], dates).views).toBe(0);
    expect(apiRows([tenant], dates).every(row => row.requests === 0)).toBe(true);
    expect(percentile([0, 0, 0, 0, 0, 0, 0], 0.95)).toBe(0);
  });
});
