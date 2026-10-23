import { describe, expect, it } from "vitest";

import { joinAs } from "../e2e/helpers/foundry.ts";

function v14JoinPage() {
  const events = [];
  const selectCalls = [];
  const selectors = [];
  let selected = "";
  const option = {
    async click() {
      events.push("click-option");
    },
  };
  const password = {
    async count() {
      return 1;
    },
    first() {
      return password;
    },
    nth() {
      return password;
    },
    async fill() {},
    async evaluate(_fn, value) {
      if (value) {
        events.push("fill-password");
        selected = "";
      }
    },
  };
  const user = {
    first() {
      return user;
    },
    async selectOption(optionArg) {
      selectCalls.push(optionArg);
      events.push("select");
      selected = typeof optionArg?.label === "string" ? optionArg.label : "";
    },
    async evaluate(read) {
      return read({ selectedOptions: [{ label: selected }] });
    },
  };
  const joinButton = {
    async click() {
      events.push("click-join-session");
    },
  };
  const section = {
    filter() {
      return section;
    },
    first() {
      return section;
    },
    locator(selector = "") {
      if (String(selector).includes("password")) return password;
      return {
        async count() {
          return 0;
        },
      };
    },
    getByRole(role, options = {}) {
      if (role === "combobox") return user;
      if (role === "button" && options.name === "Join Game Session" && options.exact === true) {
        return joinButton;
      }
      return {
        first() {
          return this;
        },
        async isVisible() {
          return false;
        },
        async click() {
          events.push("click-other");
        },
      };
    },
  };
  const decoy = {
    filter() {
      return decoy;
    },
    first() {
      return decoy;
    },
    locator() {
      return {
        async count() {
          return 0;
        },
      };
    },
    getByRole(role) {
      if (role === "combobox") {
        return {
          first() {
            return this;
          },
          async selectOption() {},
          async evaluate(read) {
            return read({ selectedOptions: [{ label: "" }] });
          },
        };
      }
      return {
        first() {
          return this;
        },
        async isVisible() {
          return false;
        },
        async click() {
          events.push("click-other");
        },
      };
    },
  };
  return {
    events,
    selectCalls,
    selectors,
    url() {
      return "http://foundry.local/join";
    },
    getByText() {
      return {
        first() {
          return option;
        },
      };
    },
    locator(selector = "") {
      const text = String(selector);
      selectors.push(text);
      if (text.includes("#join-game")) return section;
      if (text.includes("password")) return password;
      if (text.includes("section")) return decoy;
      return {
        async count() {
          return 0;
        },
      };
    },
    getByRole(role, options = {}) {
      const name = options.name;
      if (role === "heading" && name === "Join Game Session")
        return {
          async isVisible() {
            return true;
          },
        };
      if (role === "button" && name === "Join Game Session" && options.exact === true)
        return joinButton;
      if (role === "button" && name instanceof RegExp && name.test("Join Game Session")) {
        return {
          first() {
            return {
              async isVisible() {
                return true;
              },
              async click() {
                events.push("click-regex-join");
              },
            };
          },
        };
      }
      return {
        first() {
          return this;
        },
        async isVisible() {
          return false;
        },
        async click() {
          events.push("click-other");
        },
      };
    },
    async waitForFunction() {},
    async evaluate() {
      return {
        ready: true,
        systemId: "pivot-fantasy",
        systemVersion: "0.1.0",
        worldId: "pivot-e2e",
        worldTitle: "Pivot Fantasy E2E",
        version: "14.361",
      };
    },
  };
}

describe("v14 join", () => {
  it("selects the user with a string label", async () => {
    const page = v14JoinPage();
    await joinAs(page, { name: "Gamemaster" });

    expect(page.selectCalls.length).toBeGreaterThan(0);
    expect(page.selectCalls.every((call) => typeof call?.label === "string")).toBe(true);
    expect(page.selectCalls[0].label).toBe("Gamemaster");
  });

  it("re-asserts the user after the password fill", async () => {
    const page = v14JoinPage();
    await joinAs(page, { name: "Gamemaster", password: "player-secret" });

    const filledAt = page.events.indexOf("fill-password");
    const selectedAt = page.events.lastIndexOf("select");
    expect(filledAt).toBeGreaterThan(-1);
    expect(selectedAt).toBeGreaterThan(filledAt);
    expect(page.selectCalls.at(-1)).toEqual({ label: "Gamemaster" });
  });

  it("clicks the Join Game Session button", async () => {
    const page = v14JoinPage();
    await joinAs(page, { name: "Gamemaster" });

    expect(page.events).toContain("click-join-session");
    expect(page.events).not.toContain("click-regex-join");
  });

  it("does not click an option element", async () => {
    const page = v14JoinPage();
    await joinAs(page, { name: "Gamemaster", password: "player-secret" });

    expect(page.events).not.toContain("click-option");
  });

  it("scopes the join form to #join-game", async () => {
    const page = v14JoinPage();
    const outcome = await joinAs(page, { name: "Gamemaster" }).then(
      () => "done",
      (error) => error,
    );

    expect(page.selectors.some((selector) => selector.includes("#join-game"))).toBe(true);
    expect(outcome).toBe("done");
  });
});
