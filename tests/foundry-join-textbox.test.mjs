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

// Just enough DOM for describeFormControls' page.evaluate callback, which runs for real here, so the
// redaction in e2e/helpers/foundry.ts is exercised (QA on PR #211: a canned evaluate result skipped it).
class FakeElement {
  constructor(tagName, attributes) {
    this.tagName = tagName;
    this.attributes = new Map(Object.entries(attributes));
  }
  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }
  removeAttribute(name) {
    this.attributes.delete(name);
  }
  cloneNode() {
    return new FakeElement(this.tagName, Object.fromEntries(this.attributes));
  }
  get outerHTML() {
    const attributes = [...this.attributes].map(([name, value]) => ` ${name}="${value}"`).join("");
    return `<${this.tagName}${attributes}>`;
  }
}

function fakeDocument(elements) {
  return {
    querySelectorAll(selector) {
      const tags = selector.split(",").map((tag) => tag.trim());
      return elements.filter((element) => tags.includes(element.tagName));
    },
  };
}

// Runs the callback the way Playwright would in the page, with `document` bound to the fake DOM.
function evaluateIn(dom) {
  return async (callback, argument) => {
    const previous = globalThis.document;
    globalThis.document = dom;
    try {
      return await callback(argument);
    } finally {
      if (previous === undefined) delete globalThis.document;
      else globalThis.document = previous;
    }
  };
}

describe("joinAs failure report", () => {
  it("adds the form controls to the error and omits password values", async () => {
    const secret = "hunter2-not-a-real-password";
    const page = textboxJoinPage({ initial: "" });
    page.evaluate = evaluateIn(
      fakeDocument([
        new FakeElement("input", {
          type: "text",
          name: "username",
          id: "join-username",
          value: "Gamemaster",
        }),
        new FakeElement("input", { type: "password", name: "password", value: secret }),
        new FakeElement("button", { type: "submit", name: "join" }),
      ]),
    );
    const section = page.locator();
    const userText = section.getByRole("textbox", { name: "Select User" });
    userText.waitFor = async () => {
      throw new Error("timed out");
    };
    const error = await joinAs(page, { name: "Gamemaster" }).catch((e) => e);
    expect(error.message).toContain(
      'Join screen controls: <input type="text" name="username" id="join-username" value="Gamemaster">',
    );
    // The password input is still reported, without its value.
    expect(error.message).toContain('<input type="password" name="password">');
    expect(error.message).toContain('<button type="submit" name="join">');
    expect(error.message).not.toContain(secret);
  });
});
