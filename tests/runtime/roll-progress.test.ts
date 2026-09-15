import { afterEach, expect, it, vi } from "vitest";
import { rollProgress } from "../../src/runtime/roll-progress";
afterEach(() => vi.useRealTimers());
it("cancellation interrupts a pending die without inventing a result", async () => {
  vi.useFakeTimers();
  const progress = rollProgress();
  const promise = progress.wait(new Promise<number>(() => {}));
  const assertion = expect(promise).rejects.toThrow("Incomplete");
  await vi.advanceTimersByTimeAsync(1);
  progress.cancel();
  await assertion;
  progress.close();
});
it("deadline interrupts a hung dice provider", async () => {
  vi.useFakeTimers();
  const progress = rollProgress(10);
  const promise = progress.wait(new Promise<number>(() => {}));
  const assertion = expect(promise).rejects.toThrow("Incomplete");
  await vi.advanceTimersByTimeAsync(11);
  await assertion;
  progress.close();
});
