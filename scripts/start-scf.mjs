import { randomBytes } from 'node:crypto';

// An ephemeral secret is sufficient for the public fixture demo. Set a stable
// APP_SECRET when using native Umami accounts so sessions survive restarts.
process.env.APP_SECRET ||= randomBytes(32).toString('hex');
await import('../server.js');
