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

describe("joinAs failure report", () => {
  it("adds the form controls to the error and omits password values", async () => {
    const page = textboxJoinPage({ initial: "" });
    page.evaluate = async () => [
      '<input type="text" name="username" id="join-username" value="">',
      '<input type="password" name="password">',
    ];
    const section = page.locator();
    const userText = section.getByRole("textbox", { name: "Select User" });
    userText.waitFor = async () => {
      throw new Error("timed out");
    };
    const error = await joinAs(page, { name: "Gamemaster" }).catch((e) => e);
    expect(error.message).toContain('Join screen controls: <input type="text" name="username"');
    expect(error.message).not.toContain("secret");
  });
});
