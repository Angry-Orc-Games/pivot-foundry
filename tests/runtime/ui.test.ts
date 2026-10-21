import { expect, it, vi, afterEach } from "vitest";
import { createChat } from "../../src/runtime/ui";

afterEach(() => vi.unstubAllGlobals());

it("applies current core roll visibility via applyMode before creating custom chat", async () => {
  const create = vi.fn(async (data: Record<string, unknown>) => data);
  const applyMode = vi.fn((data: Record<string, unknown>, mode: string) => {
    expect(mode).toBe("public");
    data.whisper = ["gm"];
  });
  const applyRollMode = vi.fn();
  vi.stubGlobal("ChatMessage", { create, applyMode, applyRollMode });
  await createChat({ content: "damage" });
  expect(applyMode).toHaveBeenCalled();
  expect(applyRollMode).not.toHaveBeenCalled();
  expect(create).toHaveBeenCalledWith({ content: "damage", whisper: ["gm"] });
});

it("falls back to applyRollMode when applyMode is absent", async () => {
  const create = vi.fn(async (data: Record<string, unknown>) => data);
  const applyRollMode = vi.fn((data: Record<string, unknown>, mode: string) => {
    expect(mode).toBe("roll");
    data.whisper = ["gm"];
  });
  vi.stubGlobal("ChatMessage", { create, applyRollMode });
  await createChat({ content: "damage" });
  expect(applyRollMode).toHaveBeenCalled();
  expect(create).toHaveBeenCalledWith({ content: "damage", whisper: ["gm"] });
});
