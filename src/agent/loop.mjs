// The agent loop. Standard shape: send the conversation; if the model
// stops to use a tool, run it, append the result, send again; when it
// stops with text, done.
//
// The client is injected so tests can pass a scripted stub and the server
// can pass the real SDK. Events are emitted as they happen so the server
// can forward them over SSE:
//
//   { type: 'text',        text }                       a streamed delta
//   { type: 'tool_use',    id, name, input }            the model called a tool
//   { type: 'tool_result', id, name, ms, is_error, preview }
//   { type: 'done',        message, usage, turns }
//   { type: 'error',       message }
import Anthropic from '@anthropic-ai/sdk';
import { TOOLS, runTool } from './tools.mjs';
import { SYSTEM_PROMPT } from './prompt.mjs';

export const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-5';
export const MAX_TURNS = 8;

export function makeClient() {
  return new Anthropic();   // reads ANTHROPIC_API_KEY from the environment
}

export async function runAgent({ messages, client, model = MODEL, onEvent = () => {}, maxTurns = MAX_TURNS }) {
  const history = [...messages];
  const usage = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
  let turns = 0;

  while (turns < maxTurns) {
    turns++;
    const stream = client.messages.stream({
      model,
      max_tokens: 8000,
      // stable prefix first, marked for caching: tools, then system
      tools: TOOLS,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: history,
    });
    stream.on('text', text => onEvent({ type: 'text', text }));

    const message = await stream.finalMessage();
    for (const k of Object.keys(usage)) usage[k] += message.usage?.[k] ?? 0;
    history.push({ role: 'assistant', content: message.content });

    if (message.stop_reason === 'refusal') {
      onEvent({ type: 'error', message: `the model declined this request (${message.stop_details?.category ?? 'unspecified'})` });
      return { message, history, usage, turns };
    }
    if (message.stop_reason === 'pause_turn') continue;
    if (message.stop_reason !== 'tool_use') {
      onEvent({ type: 'done', message, usage, turns });
      return { message, history, usage, turns };
    }

    // one or more tool calls in this turn; run them, return all results in one user message
    const calls = message.content.filter(b => b.type === 'tool_use');
    const results = [];
    for (const call of calls) {
      onEvent({ type: 'tool_use', id: call.id, name: call.name, input: call.input });
      const t0 = Date.now();
      const result = await runTool(call);
      results.push(result);
      onEvent({ type: 'tool_result', id: call.id, name: call.name, ms: Date.now() - t0,
                is_error: !!result.is_error, preview: String(result.content).slice(0, 200) });
    }
    history.push({ role: 'user', content: results });
  }

  onEvent({ type: 'error', message: `stopped after ${maxTurns} turns without a final answer` });
  return { message: null, history, usage, turns };
}

// the last text the model produced, for callers that only want the answer
export function finalText(message) {
  return (message?.content ?? []).filter(b => b.type === 'text').map(b => b.text).join('');
}
