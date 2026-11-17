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

import { applyDeletion, type DeletionRequest, initialManagementState } from './management';

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

describe('SCF administration and data erasure', () => {
  const context = {
    perspective: 'all',
    dates: daysInRange(90, new Date('2026-11-17T12:00:00Z')),
    at: '2026-11-17T12:00:00Z',
    id: 'audit-1',
  };
  const tenant = DEMO_TENANTS[0];
  const request: DeletionRequest = {
    tenantId: tenant.id,
    action: 'erase',
    stream: 'web',
    startDate: dates[0],
    endDate: dates.at(-1) || '',
    reason: 'Tenant requested erasure',
    confirmation: tenant.name,
  };

  it('erases web data for one tenant without changing API or other projects', () => {
    const state = initialManagementState();
    const next = applyDeletion(state, request, context);
    expect(webMetrics([tenant], dates, next.erasures).views).toBe(0);
    expect(webMetrics([DEMO_TENANTS[1]], dates, next.erasures)).toEqual(
      webMetrics([DEMO_TENANTS[1]], dates),
    );
    expect(apiRows([tenant], dates, next.erasures)).toEqual(apiRows([tenant], dates));
    expect(next.tenants).toEqual(state.tenants);
    expect(next.audit[0]).toMatchObject({
      actor: 'SCF operator (demo)',
      views: webMetrics([tenant], dates).views,
      requests: 0,
    });
    expect(state.audit).toHaveLength(0);
  });
  it('uses inclusive UTC dates and keeps data outside the erased period', () => {
    const next = applyDeletion(
      initialManagementState(),
      { ...request, startDate: dates[10], endDate: dates[12], stream: 'both' },
      context,
    );
    const remainder = dates.filter(date => date < dates[10] || date > dates[12]);
    expect(webMetrics([tenant], dates, next.erasures).views).toBe(
      webMetrics([tenant], remainder).views,
    );
    expect(apiRows([tenant], dates, next.erasures).map(row => row.requests)).toEqual(
      apiRows([tenant], remainder).map(row => row.requests),
    );
    expect(
      webMetrics([tenant], dates, next.erasures)
        .series.slice(10, 13)
        .every(day => day.views === 0),
    ).toBe(true);
  });
  it('supports API-only erasure and recalculates histogram populations', () => {
    const next = applyDeletion(initialManagementState(), { ...request, stream: 'api' }, context);
    expect(webMetrics([tenant], dates, next.erasures)).toEqual(webMetrics([tenant], dates));
    expect(
      apiRows([tenant], dates, next.erasures).every(
        row =>
          row.requests === 0 &&
          row.statuses.every(value => value === 0) &&
          row.histogram.every(value => value === 0),
      ),
    ).toBe(true);
  });
  it('clears all available history while preserving integration identifiers', () => {
    const next = applyDeletion(
      initialManagementState(),
      { ...request, startDate: '0000-01-01', stream: 'both' },
      context,
    );
    expect(webMetrics([tenant], context.dates, next.erasures).views).toBe(0);
    expect(apiRows([tenant], context.dates, next.erasures).every(row => row.requests === 0)).toBe(
      true,
    );
    expect(next.tenants[0].websiteId).toBe(tenant.websiteId);
  });
  it('does not restore data or double count impact when erasures overlap', () => {
    const first = applyDeletion(initialManagementState(), request, context);
    const second = applyDeletion(first, request, { ...context, id: 'audit-2' });
    expect(webMetrics([tenant], dates, first.erasures)).toEqual(
      webMetrics([tenant], dates, second.erasures),
    );
    expect(second.audit[0].views).toBe(0);
  });
  it('requires exact confirmation, a reason and a valid range', () => {
    for (const changes of [
      { confirmation: 'wrong project' },
      { reason: ' ' },
      { startDate: dates[29], endDate: dates[0] },
    ]) {
      expect(() =>
        applyDeletion(initialManagementState(), { ...request, ...changes }, context),
      ).toThrow();
    }
  });
  it('restricts tenant-perspective actions to the selected project', () => {
    expect(() =>
      applyDeletion(initialManagementState(), request, {
        ...context,
        perspective: DEMO_TENANTS[1].id,
      }),
    ).toThrow();
    const next = applyDeletion(initialManagementState(), request, {
      ...context,
      perspective: tenant.id,
    });
    expect(next.audit[0].actor).toBe(`${tenant.name} owner (demo)`);
  });
  it('removes a project from totals but preserves its audit entry', () => {
    const next = applyDeletion(initialManagementState(), { ...request, action: 'remove' }, context);
    expect(next.tenants.some(project => project.id === tenant.id)).toBe(false);
    expect(webMetrics(next.tenants, dates).views).toBe(
      webMetrics(DEMO_TENANTS.slice(1), dates).views,
    );
    expect(next.audit[0]).toMatchObject({
      action: 'remove',
      tenantName: tenant.name,
      stream: 'both',
    });
  });
  it('supports an empty ecosystem after removing the last project', () => {
    const next = DEMO_TENANTS.reduce(
      (state, project) =>
        applyDeletion(
          state,
          { ...request, tenantId: project.id, confirmation: project.name, action: 'remove' },
          context,
        ),
      initialManagementState(),
    );
    expect(webMetrics(next.tenants, dates).views).toBe(0);
    expect(apiRows(next.tenants, dates)).toEqual([]);
    expect(next.audit).toHaveLength(3);
  });
});
