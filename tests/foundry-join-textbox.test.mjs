import { describe, expect, it } from "vitest";

import { joinAs } from "../e2e/helpers/foundry.ts";

// Foundry 14.367 shows the user as a text field named "Select User" instead of a <select>.
function textboxJoinPage({ initial }) {
  const events = [];
  let value = initial;
  const userText = {
    first() {
      return userText;
    },
    async count() {
      return 1;
    },
    or() {
      return userText;
    },
    async waitFor() {},
    async inputValue() {
      return value;
    },
    async fill(next) {
      events.push(`fill:${next}`);
      value = next;
    },
  };
  const joinButton = {
    async click() {
      events.push("click-join-session");
    },
  };
  const none = {
    first() {
      return none;
    },
    async count() {
      return 0;
    },
    or() {
      return none;
    },
    async waitFor() {},
    async isVisible() {
      return false;
    },
    async click() {},
  };
  const section = {
    filter() {
      return section;
    },
    first() {
      return section;
    },
    locator() {
      return {
        ...none,
        async evaluateAll() {
          return ["<input>"];
        },
      };
    },
    getByRole(role, options = {}) {
      if (role === "textbox" && options.name === "Select User") return userText;
      if (role === "button" && options.name === "Join Game Session") return joinButton;
      return none;
    },
  };
  return {
    events,
    url: () => "http://foundry.local/join",
    locator: () => section,
    getByRole: () => none,
    getByText: () => none,
    async waitForFunction() {
      return true;
    },
    async evaluate() {
      return { ready: true };
    },
    async goto() {},
  };
}

describe("joinAs on a Foundry 14.367 text-field join screen", () => {
  it("joins without filling when the field already shows the user", async () => {
    const page = textboxJoinPage({ initial: "Gamemaster" });
    await joinAs(page, { name: "Gamemaster" }).catch(() => {});
    expect(page.events).toContain("click-join-session");
    expect(page.events.some((event) => event.startsWith("fill:"))).toBe(false);
  });

  it("refuses with a clear message when the field shows someone else", async () => {
    const page = textboxJoinPage({ initial: "Somebody Else" });
    await expect(joinAs(page, { name: "Gamemaster" })).rejects.toThrow(
      /shows "Somebody Else" but the test expected "Gamemaster"/,
    );
    expect(page.events).not.toContain("click-join-session");
  });
});
