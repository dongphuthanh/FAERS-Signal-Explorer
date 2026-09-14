// Start the server and a Cloudflare tunnel to it, and print the public URL.
//
//   npm run serve:public
//
// Refuses to run without DEMO_PASSWORD in .env: a public URL to an
// unprotected server is an open line to your API key. Also set a monthly
// spend limit in the Anthropic console — the daily question cap here is a
// second line, not the first.
//
// Needs cloudflared:   winget install Cloudflare.cloudflared
import { spawn } from 'node:child_process';

if (!process.env.DEMO_PASSWORD) {
  console.error('\n  DEMO_PASSWORD is not set in .env. Refusing to open a public URL without one.\n');
  process.exit(1);
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('\n  ANTHROPIC_API_KEY is not set; the public server would answer nothing.\n');
  process.exit(1);
}

const port = process.env.PORT || 3000;
await import('../src/server.mjs');   // starts listening on 127.0.0.1:port

const tunnel = spawn('cloudflared', ['tunnel', '--url', `http://127.0.0.1:${port}`], { stdio: ['ignore', 'pipe', 'pipe'] });
tunnel.on('error', (err) => {
  console.error(err.code === 'ENOENT'
    ? '\n  cloudflared is not installed. Install it with:  winget install Cloudflare.cloudflared\n  The server is still running locally.\n'
    : `\n  cloudflared failed: ${err.message}\n`);
});
let announced = false;
const watch = (chunk) => {
  const m = String(chunk).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
  if (m && !announced) {
    announced = true;
    console.log(`\n  PUBLIC URL:  ${m[0]}\n  password:    the DEMO_PASSWORD from .env (any username)\n  cap:         ${process.env.DEMO_DAILY_CAP || 60} questions per day\n  Ctrl+C closes the tunnel and the server together.\n`);
  }
};
tunnel.stdout.on('data', watch);
tunnel.stderr.on('data', watch);

const stop = () => { tunnel.kill(); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
