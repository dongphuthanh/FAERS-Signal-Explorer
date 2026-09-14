// Fastify server. POST /ask streams the agent's events as SSE; GET / is a
// one-file page that renders them. Pass STUB=1 to run against the scripted
// stub instead of the API (a fixed demo script; for wiring, not answers).
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { runAgent, makeClient } from './agent/loop.mjs';
import { makeStub } from './agent/stub.mjs';
import { checkBasicAuth, DailyCap } from './guard.mjs';
import { appendFile, mkdir } from 'node:fs/promises';
import { finalText, MODEL } from './agent/loop.mjs';

// Every question and answer is appended to evals/sessions.jsonl. The people
// asking are the reviewers; their questions are the eval set and their
// objections are the disagreement log, so nothing they type is lost.
const SESSIONS = 'evals/sessions.jsonl';
await mkdir('evals', { recursive: true });
const whoFrom = (auth) => { try { return Buffer.from(auth.slice(6), 'base64').toString('utf8').split(':')[0] || 'anonymous'; } catch { return 'anonymous'; } };

const here = path.dirname(fileURLToPath(import.meta.url));
const app = Fastify({ logger: { level: 'warn' } });

// ---- guards, for when the server is reachable from outside this machine ----
const PASSWORD = process.env.DEMO_PASSWORD || '';
const cap = new DailyCap(Number(process.env.DEMO_DAILY_CAP || 60));

app.addHook('onRequest', async (request, reply) => {
  if (request.url === '/health') return;
  if (!checkBasicAuth(request.headers.authorization, PASSWORD)) {
    reply.header('www-authenticate', 'Basic realm="FAERS Signal Explorer"').code(401).send('password required');
  }
});

await app.register(fastifyStatic, { root: path.join(here, 'public'), prefix: '/' });

const DEMO_SCRIPT = [
  { tool: 'query_adverse_events', input: { drug: 'semaglutide', top: 10 } },
  { text: 'Stub answer: the tool result above would be summarised here by the model.' },
];

app.post('/ask', async (request, reply) => {
  const { question, history = [] } = request.body ?? {};
  if (!question || typeof question !== 'string') return reply.code(400).send({ error: 'question is required' });
  if (!cap.take()) return reply.code(429).send({ error: `daily limit of ${cap.limit} questions reached; open again tomorrow (UTC)` });

  reply.raw.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache',
    connection: 'keep-alive',
  });
  const record = { ts: new Date().toISOString(), who: PASSWORD ? whoFrom(request.headers.authorization ?? '') : 'local',
                   model: process.env.STUB ? 'stub' : MODEL, question, tool_calls: [], answer: '', error: null };
  const send = (event) => {
    reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    if (event.type === 'tool_use') record.tool_calls.push({ name: event.name, input: event.input });
    if (event.type === 'tool_result') Object.assign(record.tool_calls.at(-1) ?? {}, { ms: event.ms, is_error: event.is_error });
    if (event.type === 'error') record.error = event.message;
  };

  const client = process.env.STUB ? makeStub(DEMO_SCRIPT) : makeClient();
  const messages = [...history, { role: 'user', content: question }];
  const t0 = Date.now();
  try {
    const r = await runAgent({ messages, client, onEvent: send });
    Object.assign(record, { answer: finalText(r.message), turns: r.turns, usage: r.usage });
  } catch (err) {
    record.error = err.message;
    send({ type: 'error', message: err.message });
  }
  record.ms = Date.now() - t0;
  reply.raw.end();
  appendFile(SESSIONS, JSON.stringify(record) + '\n').catch(e => app.log.warn(`could not write ${SESSIONS}: ${e.message}`));
  return reply;
});

app.get('/health', async () => ({ ok: true, stub: !!process.env.STUB, password: !!PASSWORD, questions_left_today: cap.remaining() }));

const port = Number(process.env.PORT || 3000);
await app.listen({ port, host: '127.0.0.1' });
console.log(`  FAERS Signal Explorer on http://127.0.0.1:${port}${process.env.STUB ? '  (STUB mode)' : ''}${PASSWORD ? '  · password on' : '  · NO PASSWORD — localhost only'}  · ${cap.limit} questions/day`);
