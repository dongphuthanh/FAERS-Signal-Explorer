// Fastify server. POST /ask streams the agent's events as SSE; GET / is a
// one-file page that renders them. Pass STUB=1 to run against the scripted
// stub instead of the API (a fixed demo script; for wiring, not answers).
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { runAgent, makeClient } from './agent/loop.mjs';
import { makeStub } from './agent/stub.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const app = Fastify({ logger: { level: 'warn' } });

await app.register(fastifyStatic, { root: path.join(here, 'public'), prefix: '/' });

const DEMO_SCRIPT = [
  { tool: 'query_adverse_events', input: { drug: 'semaglutide', top: 10 } },
  { text: 'Stub answer: the tool result above would be summarised here by the model.' },
];

app.post('/ask', async (request, reply) => {
  const { question, history = [] } = request.body ?? {};
  if (!question || typeof question !== 'string') return reply.code(400).send({ error: 'question is required' });

  reply.raw.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache',
    connection: 'keep-alive',
  });
  const send = (event) => reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);

  const client = process.env.STUB ? makeStub(DEMO_SCRIPT) : makeClient();
  const messages = [...history, { role: 'user', content: question }];
  try {
    await runAgent({ messages, client, onEvent: send });
  } catch (err) {
    send({ type: 'error', message: err.message });
  }
  reply.raw.end();
  return reply;
});

app.get('/health', async () => ({ ok: true, stub: !!process.env.STUB }));

const port = Number(process.env.PORT || 3000);
await app.listen({ port, host: '127.0.0.1' });
console.log(`  FAERS Signal Explorer on http://127.0.0.1:${port}${process.env.STUB ? '  (STUB mode)' : ''}`);
