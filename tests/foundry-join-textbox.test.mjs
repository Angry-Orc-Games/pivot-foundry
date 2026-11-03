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
    async evaluate(write, next) {
      const input = { value, dispatchEvent() {} };
      write(input, next);
      events.push(`set:${input.value}`);
      value = input.value;
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
      return none;
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
    expect(page.events.some((event) => event.startsWith("set:"))).toBe(false);
  });

  it("types the user name when the field is empty (a fresh browser with several users)", async () => {
    const page = textboxJoinPage({ initial: "" });
    await joinAs(page, { name: "Gamemaster" }).catch(() => {});
    expect(page.events).toContain("set:Gamemaster");
    expect(page.events.indexOf("set:Gamemaster")).toBeLessThan(
      page.events.indexOf("click-join-session"),
    );
  });
});
