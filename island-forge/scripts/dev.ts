// Runs the API (port 5174) and the Vite dev server (port 5173, proxies /api) together.
import { spawn } from 'node:child_process';

const procs = [
  spawn(process.execPath, ['server/server.ts'], { stdio: 'inherit', env: { ...process.env, PORT: '5174' } }),
  spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', '--config', 'web/vite.config.ts'], { stdio: 'inherit', shell: process.platform === 'win32' }),
];
const stop = () => procs.forEach((p) => p.kill());
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
procs.forEach((p) => p.on('exit', (code) => { if (code) { stop(); process.exit(code); } }));
