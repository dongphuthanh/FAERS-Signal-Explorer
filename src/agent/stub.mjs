// A scripted stand-in for the Anthropic client. Same surface the loop uses
// — messages.stream(params) -> { on(), finalMessage() } — but every turn
// is a canned response. Lets the loop, tool dispatch, result formatting and
// SSE be tested with no key, no network, no cost.
//
// A script is an array of turns. Each turn is either
//   { tool: 'query_adverse_events', input: {...} }   -> a tool_use stop
//   { text: '...' }                                   -> an end_turn stop
// Text turns are streamed in a few deltas so text events fire.
export function makeStub(script) {
  const turns = [...script];
  const seen = [];   // every params object the loop sent, for assertions
  let n = 0;

  return {
    seen,
    messages: {
      stream(params) {
        seen.push(params);
        const turn = turns.shift();
        if (!turn) throw new Error('stub script exhausted');
        const handlers = {};
        const id = `toolu_stub_${++n}`;
        const message = turn.tool
          ? { id: `msg_${n}`, role: 'assistant', stop_reason: 'tool_use',
              content: [{ type: 'tool_use', id, name: turn.tool, input: turn.input ?? {} }],
              usage: { input_tokens: 100, output_tokens: 20 } }
          : { id: `msg_${n}`, role: 'assistant', stop_reason: turn.stop_reason ?? 'end_turn',
              content: [{ type: 'text', text: turn.text }],
              usage: { input_tokens: 100, output_tokens: 50 } };
        return {
          on(event, cb) { handlers[event] = cb; return this; },
          async finalMessage() {
            if (turn.text && handlers.text) {
              for (const piece of turn.text.match(/.{1,24}/gs) ?? []) handlers.text(piece);
            }
            return message;
          },
        };
      },
    },
  };
}
