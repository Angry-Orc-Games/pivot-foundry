import { createSession } from "./book.js";

// pivot-chargen packages/rules/src/index.ts at c39605e17648a316cf8d00b34e80a7ee66fcfecf.
// api.derive returns createSession(choices, false).derive(), the raw generator state.
export function derive(choices: unknown): unknown {
  return createSession(choices, false).derive();
}
