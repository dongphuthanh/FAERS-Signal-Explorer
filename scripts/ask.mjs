// Ask from the command line.
//
//   npm run ask -- "What's being reported for semaglutide that isn't in the label?"
//   npm run ask -- --stub "anything"      (scripted stub: exercises the wiring, no API)
//
// Prints tool calls as they happen, streams the answer, and ends with the
// token usage — so the cost of a real question is visible every time.
import { pool } from '../src/db.mjs';
import { runAgent, makeClient, finalText, MODEL } from '../src/agent/loop.mjs';
import { makeStub } from '../src/agent/stub.mjs';

const args = process.argv.slice(2);
const stub = args.includes('--stub');
const question = args.filter(a => a !== '--stub').join(' ').trim();
if (!question) { console.error('usage: ask.mjs [--stub] <question>'); process.exit(1); }

const client = stub
  ? makeStub([{ tool: 'query_adverse_events', input: { drug: 'semaglutide', top: 8 } },
              { text: 'STUB: a real model would summarise the tool result above.' }])
  : makeClient();

console.log(`\n  ${stub ? 'stub' : MODEL}  ·  ${question}\n`);
let streaming = false;
const { message, usage, turns } = await runAgent({
  messages: [{ role: 'user', content: question }],
  client,
  onEvent: (e) => {
    if (e.type === 'text') { if (!streaming) { process.stdout.write('\n'); streaming = true; } process.stdout.write(e.text); }
    else if (e.type === 'tool_use') { streaming = false; console.log(`  → ${e.name} ${JSON.stringify(e.input)}`); }
    else if (e.type === 'tool_result') console.log(`  ← ${e.name}${e.is_error ? ' ERROR' : ''} ${e.ms} ms`);
    else if (e.type === 'error') console.error(`\n  ✗ ${e.message}`);
  },
});

console.log(`\n\n  ${turns} turn(s) · ${usage.input_tokens} in / ${usage.output_tokens} out · cache read ${usage.cache_read_input_tokens} · cache write ${usage.cache_creation_input_tokens}`);
if (!message) process.exitCode = 1;
await pool.end();
