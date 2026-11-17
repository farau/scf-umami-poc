import 'dotenv/config';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';

const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--turbo'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    SCF_DEMO_MODE: 'true',
    DISABLE_TELEMETRY: '1',
    APP_SECRET: process.env.APP_SECRET || randomBytes(32).toString('hex'),
    DATABASE_URL: process.env.DATABASE_URL || 'postgresql://demo:demo@127.0.0.1:5432/scf_demo',
  },
});
child.on('exit', code => {
  process.exitCode = code ?? 1;
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
