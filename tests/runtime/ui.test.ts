import { afterEach, expect, it, vi } from "vitest";
import { createChat } from "../../src/runtime/ui";

afterEach(() => vi.unstubAllGlobals());

const CLIENT_MESSAGE_MODES = ["public", "gm", "blind", "self"] as const;

function visibilityFor(mode: string): { whisper: string[]; blind: boolean } {
  if (mode === "self") return { whisper: ["user-1"], blind: false };
  if (mode === "gm") return { whisper: ["gm-1"], blind: false };
  if (mode === "blind") return { whisper: ["gm-1"], blind: true };
  return { whisper: [], blind: false };
}

it.each(CLIENT_MESSAGE_MODES)(
  "posts custom chat as public when the client message mode is %s",
  async (messageMode) => {
    const create = vi.fn(async (data: Record<string, unknown>) => data);
    const applyRollMode = vi.fn();
    const applyMode = vi.fn((data: Record<string, unknown>, mode: string) => ({
      ...data,
      ...visibilityFor(mode),
    }));
    vi.stubGlobal("game", {
      settings: {
        get: (scope: string, key: string) =>
          scope === "core" && key === "messageMode" ? messageMode : undefined,
      },
    });
    vi.stubGlobal("ChatMessage", { create, applyMode, applyRollMode });

    await createChat({ content: "damage" });

    expect(applyRollMode).not.toHaveBeenCalled();
    expect(applyMode).toHaveBeenCalledWith({ content: "damage" }, "public");
    expect(create).toHaveBeenCalledWith({ content: "damage", whisper: [], blind: false });
  },
);
