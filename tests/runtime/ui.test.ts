import { expect, it, vi, afterEach } from "vitest";
import { createChat } from "../../src/runtime/ui";
afterEach(() => vi.unstubAllGlobals());
it("applies current core roll visibility before creating custom chat", async () => {
  const create = vi.fn(async (data: Record<string, unknown>) => data);
  const applyRollMode = vi.fn((data: Record<string, unknown>, mode: string) => {
    expect(mode).toBe("roll");
    data.whisper = ["gm"];
  });
  vi.stubGlobal("ChatMessage", { create, applyRollMode });
  await createChat({ content: "damage" });
  expect(create).toHaveBeenCalledWith({ content: "damage", whisper: ["gm"] });
});
