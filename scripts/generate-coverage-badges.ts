import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BADGE_DIR = resolve(ROOT, 'coverage', 'badges');

interface CoverageSummaryEntry {
  total: number;
  covered: number;
  skipped: number;
  pct: number;
}

interface CoverageSummary {
  total: {
    lines: CoverageSummaryEntry;
    statements: CoverageSummaryEntry;
    functions: CoverageSummaryEntry;
    branches: CoverageSummaryEntry;
  };
}

interface ShieldsBadge {
  schemaVersion: 1;
  label: string;
  message: string;
  color: string;
}

const colorForPct = (pct: number): string => {
  if (pct >= 90) return 'brightgreen';
  if (pct >= 80) return 'green';
  if (pct >= 70) return 'yellowgreen';
  if (pct >= 60) return 'yellow';
  if (pct >= 50) return 'orange';
  return 'red';
};

const writeBadge = (name: string, badge: ShieldsBadge): void => {
  mkdirSync(BADGE_DIR, { recursive: true });
  const path = resolve(BADGE_DIR, `${name}.json`);
  writeFileSync(path, JSON.stringify(badge, null, 2));
  console.log(`Badge written: ${path} → ${badge.message}`);
};

const generateFromSummary = (name: string, label: string, summaryPath: string): void => {
  if (!existsSync(summaryPath)) {
    console.warn(`No coverage summary at ${summaryPath}, skipping ${name}`);
    return;
  }

  const summary: CoverageSummary = JSON.parse(readFileSync(summaryPath, 'utf-8'));
  const pct = Math.round(summary.total.lines.pct * 100) / 100;

  writeBadge(name, {
    schemaVersion: 1,
    label,
    message: `${pct}%`,
    color: colorForPct(pct),
  });
};

const generateE2EBadge = (): void => {
  const resultsPath = resolve(ROOT, 'playwright-report', 'results.json');
  if (!existsSync(resultsPath)) {
    console.warn(`No Playwright results at ${resultsPath}, skipping e2e`);
    return;
  }

  const report = JSON.parse(readFileSync(resultsPath, 'utf-8'));
  const { expected, unexpected, skipped, flaky } = report.stats;
  const total = expected + unexpected + skipped + flaky;
  const passed = expected + flaky;
  const pct = total > 0 ? Math.round((passed / total) * 10000) / 100 : 0;

  writeBadge('e2e', {
    schemaVersion: 1,
    label: 'E2E pass rate',
    message: `${passed}/${total} — ${pct}%`,
    color: colorForPct(pct),
  });
};

const target = process.argv[2];

if (!target || target === 'vitest') {
  generateFromSummary(
    'vitest',
    'Vitest coverage',
    resolve(ROOT, 'coverage', 'vitest', 'coverage-summary.json'),
  );
}

if (!target || target === 'wtr') {
  generateFromSummary(
    'wtr',
    'WTR coverage',
    resolve(ROOT, 'coverage', 'wtr', 'coverage-summary.json'),
  );
}

if (!target || target === 'e2e') {
  generateE2EBadge();
}
