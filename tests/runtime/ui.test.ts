import { expect, it, vi, afterEach } from "vitest";
import { createChat, escapeHtml, localize, prompt, warn } from "../../src/runtime/ui";
afterEach(() => vi.unstubAllGlobals());

it("escapes text that would otherwise be inserted into chat html", () => {
  expect(escapeHtml(`<b class="x">A & B</b> "quoted" 'q'`)).toBe(
    "&lt;b class=&quot;x&quot;&gt;A &amp; B&lt;/b&gt; &quot;quoted&quot; &#39;q&#39;",
  );
});

it("falls back to the key when Foundry i18n is absent", () => {
  expect(localize("Cancel")).toBe("Cancel");
});

it("warns through the localized notification", () => {
  const warnNotification = vi.fn();
  vi.stubGlobal("ui", { notifications: { warn: warnNotification } });
  vi.stubGlobal("game", { i18n: { localize: (key: string) => `loc:${key}` } });
  warn("RestFailed");
  expect(warnNotification).toHaveBeenCalledWith("loc:PIVOT.Survival.RestFailed");
});

it("returns null when the dialog runtime is missing or closed", async () => {
  await expect(prompt("Title", "<p></p>", () => "ok")).resolves.toBeNull();
  vi.stubGlobal("foundry", {
    applications: {
      api: {
        DialogV2: {
          prompt: vi.fn(async () => {
            throw new Error("closed");
          }),
        },
      },
    },
  });
  await expect(
    prompt("Title", "<p></p>", () => "ok", "Confirm", { localizeTitlesAndButtons: false }),
  ).resolves.toBeNull();
});

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
