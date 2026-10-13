// Runs the AI off the UI thread. Messages in: {id, s, p, opts}. Out: {id, a}.
import { smartBot } from "./bots.js";
const bots = {};
self.onmessage = (e) => {
  const { id, s, p, opts } = e.data;
  const key = p + JSON.stringify(opts);
  bots[key] ||= smartBot(opts);
  self.postMessage({ id, a: bots[key](s, p) });
};
