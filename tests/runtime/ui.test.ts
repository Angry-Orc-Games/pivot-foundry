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
  "posts custom chat with the client message mode %s",
  async (messageMode) => {
    const create = vi.fn(async (data: Record<string, unknown>) => data);
    const applyRollMode = vi.fn();
    const applyMode = vi.fn((data: Record<string, unknown>, mode?: string) => {
      const game = globalThis as {
        game?: { settings?: { get?: (scope: string, key: string) => unknown } };
      };
      const fromSettings = game.game?.settings?.get?.("core", "messageMode");
      const selected = mode ?? (typeof fromSettings === "string" ? fromSettings : "public");
      return { ...data, ...visibilityFor(selected) };
    });
    vi.stubGlobal("game", {
      user: { id: "user-1" },
      settings: {
        get: (scope: string, key: string) =>
          scope === "core" && key === "messageMode" ? messageMode : undefined,
      },
    });
    vi.stubGlobal("ChatMessage", { create, applyMode, applyRollMode });

    await createChat({ content: "damage" });

    expect(applyRollMode).not.toHaveBeenCalled();
    expect(applyMode).toHaveBeenCalledWith({ content: "damage" });
    expect(create).toHaveBeenCalledWith({ content: "damage", ...visibilityFor(messageMode) });
  },
);
