import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";

import { CREATE_WORLD_PHASE_MS, ensureE2EWorld } from "../e2e/helpers/foundry.ts";

const SNAPSHOT = fileURLToPath(
  new URL("./fixtures/foundry-v14-create-world.snapshot.txt", import.meta.url),
);
const USER_MANAGEMENT_SNAPSHOT = fileURLToPath(
  new URL("./fixtures/foundry-v14-user-management.snapshot.txt", import.meta.url),
);

function hidden() {
  const node = {
    first() {
      return node;
    },
    async count() {
      return 0;
    },
    async isVisible() {
      return false;
    },
    async waitFor() {
      throw new Error("hidden");
    },
    async fill() {},
  };
  return node;
}

function v14CreateWorldPage({
  hangCard = false,
  decoySelect = false,
  stepDelayMs = 0,
  hideOnFilter = false,
  filterText = "",
  missingCard = false,
  afterContinue = "launch",
  record = "unavailable",
  usersOpen = false,
  usersAfterCreate = false,
  usersAfterLaunch = false,
} = {}) {
  const events = [];
  const selectCalls = [];
  let worldReady = false;
  let systemsFilter = filterText;
  let pageUrl = "http://foundry.local/setup";
  let joinVisible = false;
  let launchWaits = 0;
  let launchCalls = 0;
  let usersLive = false;
  let titleValue = "";
  let dataPathValue = "pivot-fantasy-e2e";
  let worldIdAtContinue = "";
  let createdWorldId = "";
  let launchedWorldId = "";
  const pause = () =>
    stepDelayMs === 0
      ? Promise.resolve()
      : new Promise((resolve) => globalThis.setTimeout(resolve, stepDelayMs));
  const title = {
    first() {
      return title;
    },
    async fill(value) {
      await pause();
      titleValue = String(value);
      events.push("title");
    },
  };
  const dataPath = {
    first() {
      return dataPath;
    },
    async inputValue() {
      return dataPathValue;
    },
    async evaluate(_fn, id) {
      if (typeof id === "string") dataPathValue = id;
    },
    async fill(value) {
      dataPathValue = String(value);
    },
  };
  const systemSelect = {
    first() {
      return systemSelect;
    },
    async count() {
      return decoySelect ? 1 : 0;
    },
    async selectOption(option) {
      selectCalls.push(option);
      if (option && "label" in option && typeof option.label !== "string") {
        throw new Error("locator.selectOption: options[0].label: expected string, got object");
      }
      throw new Error("option not found");
    },
  };
  const openForm = {
    first() {
      return openForm;
    },
    last() {
      return openForm;
    },
    async waitFor() {},
    async isVisible() {
      return true;
    },
    async click() {
      await pause();
      events.push("open-form");
    },
  };
  const pivotHeading = { pivotHeading: true };
  const card = {
    first() {
      return card;
    },
    async click() {
      await pause();
      if (hideOnFilter && systemsFilter !== "") {
        throw new Error("locator.click: Timeout 15000ms exceeded");
      }
      if (missingCard) return new Promise(() => {});
      events.push("pick-system");
      if (hangCard) return new Promise(() => {});
    },
  };
  return {
    events,
    selectCalls,
    get filterText() {
      return systemsFilter;
    },
    get launchWaits() {
      return launchWaits;
    },
    get launchCalls() {
      return launchCalls;
    },
    get titleValue() {
      return titleValue;
    },
    get worldIdAtContinue() {
      return worldIdAtContinue;
    },
    get createdWorldId() {
      return createdWorldId;
    },
    get launchedWorldId() {
      return launchedWorldId;
    },
    url() {
      return pageUrl;
    },
    async goto() {},
    async waitForFunction() {},
    async evaluate(fn, arg) {
      if (fn?.name === "silenceCoreTours") return { ready: false, notes: [] };
      if (fn?.name === "ensureWorldRecord") {
        createdWorldId = arg?.id ?? "";
        return record;
      }
      if (fn?.name === "launchInstalledWorld") {
        launchCalls += 1;
        launchedWorldId = String(arg ?? "");
        return true;
      }
      return false;
    },
    locator(selector = "") {
      const text = String(selector);
      if (text.includes("select")) return systemSelect;
      if (text.includes('name="title"')) return title;
      if (text.includes('name="name"')) return dataPath;
      if (text.includes("title")) return title;
      return hidden();
    },
    getByRole(role, options = {}) {
      const name = options.name;
      if (role === "button" && name instanceof RegExp && name.test("Create World")) return openForm;
      if (role === "searchbox" && name instanceof RegExp && name.test("Filter systems")) {
        const field = {
          first() {
            return field;
          },
          async inputValue() {
            await pause();
            return systemsFilter;
          },
          async fill(value) {
            await pause();
            systemsFilter = String(value);
            events.push(`filter:${value}`);
          },
        };
        return field;
      }
      if (role === "heading" && name === "Pivot Fantasy" && options.exact === true) {
        return pivotHeading;
      }
      if (role === "heading" && name === "User Management" && options.exact === true) {
        return {
          async waitFor() {
            if (usersAfterCreate || (usersAfterLaunch && launchCalls > 0)) {
              usersLive = true;
              events.push("user-management");
              return;
            }
            if (afterContinue !== "users") throw new Error("user management hidden");
            events.push("user-management");
          },
          async isVisible() {
            return !joinVisible && (usersOpen || afterContinue === "users" || usersLive);
          },
        };
      }
      if (role === "listitem") {
        return {
          filter(filterOptions = {}) {
            if (!filterOptions.has?.pivotHeading) {
              throw new Error("listitem was not the Pivot Fantasy card");
            }
            return card;
          },
        };
      }
      if (role === "button" && name === "Continue" && options.exact === true) {
        return {
          async click() {
            await pause();
            worldIdAtContinue = dataPathValue;
            events.push("continue");
            worldReady = true;
          },
        };
      }
      if (role === "button" && name instanceof RegExp && name.test("Launch")) {
        const launch = {
          first() {
            return launch;
          },
          async waitFor() {
            launchWaits += 1;
            await pause();
            if (afterContinue !== "launch") {
              throw new Error("locator.waitFor: Timeout 15000ms exceeded");
            }
            if (!worldReady) throw new Error("launch hidden");
            events.push("world-ready");
          },
          async isVisible() {
            return worldReady;
          },
        };
        return launch;
      }
      if (role === "button" && name === "Save and Continue" && options.exact === true) {
        return {
          async click() {
            events.push("save-users");
            pageUrl = "http://foundry.local/join";
            joinVisible = true;
          },
        };
      }
      if (role === "button" && name instanceof RegExp && name.test("Join Game")) {
        const join = {
          first() {
            return join;
          },
          async waitFor() {
            if (!joinVisible) throw new Error("join hidden");
            events.push("join");
          },
          async isVisible() {
            return joinVisible;
          },
        };
        return join;
      }
      if (role === "textbox" && name instanceof RegExp && name.test("password")) {
        return {
          async fill() {
            events.push("gm-password");
          },
        };
      }
      if (role === "checkbox" || role === "heading") return hidden();
      if (role === "button") return hidden();
      throw new Error(`unexpected role ${role}`);
    },
  };
}

describe("v14 create world", () => {
  it("clicks the Pivot Fantasy card and Continue without a RegExp selectOption", async () => {
    const snapshot = await readFile(SNAPSHOT, "utf8");
    expect(snapshot).toContain('searchbox "Filter systems"');
    expect(snapshot).toContain('heading "Pivot Fantasy"');
    expect(snapshot).toContain('button "Continue"');
    expect(snapshot).not.toMatch(/combobox "System"|select "System"/);

    const page = v14CreateWorldPage({ decoySelect: true });
    await ensureE2EWorld(page, "admin-key-secret");

    expect(page.events).toEqual(["open-form", "title", "pick-system", "continue", "world-ready"]);
    expect(page.selectCalls.some((call) => call?.label instanceof RegExp)).toBe(false);
  });

  it("writes the expected world id into the data path before Continue", async () => {
    const snapshot = await readFile(SNAPSHOT, "utf8");
    expect(snapshot).toContain('textbox [disabled] "Data/worlds/"');
    expect(snapshot).toContain('textbox "pivot-fantasy-e2e"');

    const previous = process.env.PIVOT_E2E_WORLD_ID;
    delete process.env.PIVOT_E2E_WORLD_ID;
    try {
      const page = v14CreateWorldPage();
      await ensureE2EWorld(page, "admin-key-secret");

      expect(page.titleValue).toBe("Pivot Fantasy E2E");
      expect(page.createdWorldId).toBe("pivot-e2e");
      expect(page.launchedWorldId).toBe("pivot-e2e");
      expect(page.worldIdAtContinue).toBe("pivot-e2e");
    } finally {
      if (previous === undefined) delete process.env.PIVOT_E2E_WORLD_ID;
      else process.env.PIVOT_E2E_WORLD_ID = previous;
    }
  });

  it("writes PIVOT_E2E_WORLD_ID into the data path before Continue", async () => {
    const previous = process.env.PIVOT_E2E_WORLD_ID;
    process.env.PIVOT_E2E_WORLD_ID = "session-world";
    try {
      const page = v14CreateWorldPage();
      await ensureE2EWorld(page, "admin-key-secret");

      expect(page.titleValue).toBe("Pivot Fantasy E2E");
      expect(page.createdWorldId).toBe("session-world");
      expect(page.launchedWorldId).toBe("session-world");
      expect(page.worldIdAtContinue).toBe("session-world");
    } finally {
      if (previous === undefined) delete process.env.PIVOT_E2E_WORLD_ID;
      else process.env.PIVOT_E2E_WORLD_ID = previous;
    }
  });

  it("clicks the Pivot Fantasy card without typing a system filter", async () => {
    const page = v14CreateWorldPage({ hideOnFilter: true });
    await ensureE2EWorld(page, "admin-key-secret");

    expect(page.filterText).toBe("");
    expect(page.events).toContain("pick-system");
    expect(page.events).toContain("continue");
    expect(page.events).toContain("world-ready");
    expect(page.events.some((event) => /^filter:.+/.test(event))).toBe(false);
  });

  it("clears system filter text before clicking the Pivot Fantasy card", async () => {
    const page = v14CreateWorldPage({ hideOnFilter: true, filterText: "core" });
    await ensureE2EWorld(page, "admin-key-secret");

    expect(page.filterText).toBe("");
    expect(page.events).toContain("filter:");
    expect(page.events).toContain("pick-system");
    expect(page.events).toContain("world-ready");
    expect(page.events.some((event) => /^filter:.+/.test(event))).toBe(false);
  });

  it("stalls create world when the Pivot Fantasy card is missing", async () => {
    vi.useFakeTimers();
    const page = v14CreateWorldPage({ hideOnFilter: true, missingCard: true });
    let outcome = "hung";
    const pending = ensureE2EWorld(page, "admin-key-secret").then(
      () => {
        outcome = "done";
      },
      (error) => {
        outcome = error;
      },
    );
    try {
      await vi.advanceTimersByTimeAsync(CREATE_WORLD_PHASE_MS);
      await Promise.race([pending, Promise.resolve()]);
    } finally {
      vi.useRealTimers();
    }

    expect(outcome).toBeInstanceOf(Error);
    expect(outcome.message).toMatch(/stalled during create world/);
    expect(page.events).not.toContain("pick-system");
    expect(page.events).not.toContain("continue");
  });

  it("finishes a create-world form that takes longer than 20s", async () => {
    vi.useFakeTimers();
    const page = v14CreateWorldPage({ stepDelayMs: 4_000 });
    let outcome = "hung";
    const pending = ensureE2EWorld(page, "admin-key-secret").then(
      () => {
        outcome = "done";
      },
      (error) => {
        outcome = error;
      },
    );
    try {
      await vi.advanceTimersByTimeAsync(24_000);
      await Promise.race([pending, Promise.resolve()]);
    } finally {
      vi.useRealTimers();
    }

    expect(outcome).toBe("done");
    expect(page.events).toContain("world-ready");
  });

  it("stalls create world when the system card click never returns", async () => {
    vi.useFakeTimers();
    const page = v14CreateWorldPage({ hangCard: true });
    let outcome = "hung";
    const pending = ensureE2EWorld(page, "admin-key-secret").then(
      () => {
        outcome = "done";
      },
      (error) => {
        outcome = error;
      },
    );
    try {
      await vi.advanceTimersByTimeAsync(CREATE_WORLD_PHASE_MS);
      await Promise.race([pending, Promise.resolve()]);
    } finally {
      vi.useRealTimers();
    }

    expect(outcome).toBeInstanceOf(Error);
    expect(outcome.message).toMatch(/stalled during create world/);
    expect(page.events).toContain("pick-system");
    expect(page.events).not.toContain("continue");
  });

  it("reaches join from User Management without waiting on Launch", async () => {
    const snapshot = await readFile(USER_MANAGEMENT_SNAPSHOT, "utf8");
    expect(snapshot).toContain('heading "User Management"');
    expect(snapshot).toContain('button "Save and Continue"');
    expect(snapshot).toContain("textbox (password, empty)");

    const page = v14CreateWorldPage({ afterContinue: "users" });
    await ensureE2EWorld(page, "admin-key-secret");

    expect(page.events).toContain("user-management");
    expect(page.events).toContain("save-users");
    expect(page.events).toContain("join");
    expect(page.events).not.toContain("world-ready");
    expect(page.events).not.toContain("gm-password");
    expect(page.url()).toContain("/join");
  });

  it("launches when Continue shows a Launch button", async () => {
    const page = v14CreateWorldPage({ afterContinue: "launch" });
    await ensureE2EWorld(page, "admin-key-secret");

    expect(page.events).toContain("world-ready");
    expect(page.launchWaits).toBeGreaterThan(0);
    expect(page.events).not.toContain("save-users");
  });

  it("stalls create world when Continue shows neither Launch nor User Management", async () => {
    const page = v14CreateWorldPage({ afterContinue: "neither" });
    const outcome = await ensureE2EWorld(page, "admin-key-secret").then(
      () => "done",
      (error) => error,
    );

    expect(outcome).toBeInstanceOf(Error);
    expect(outcome.message).toMatch(/stalled during create world/);
    expect(page.events).not.toContain("save-users");
    expect(page.events).not.toContain("join");
  });

  it("saves users when launch starts on User Management", async () => {
    const page = v14CreateWorldPage({ record: "exists", usersOpen: true });
    await ensureE2EWorld(page, "admin-key-secret");

    expect(page.events).toContain("save-users");
    expect(page.events).toContain("join");
    expect(page.events).not.toContain("gm-password");
    expect(page.launchCalls).toBe(0);
    expect(page.url()).toContain("/join");
  });

  it("saves users after World.create opens User Management", async () => {
    const page = v14CreateWorldPage({ record: "created", usersOpen: true });
    await ensureE2EWorld(page, "admin-key-secret");

    expect(page.events).toContain("save-users");
    expect(page.events).toContain("join");
    expect(page.events).not.toContain("gm-password");
    expect(page.launchCalls).toBe(0);
    expect(page.url()).toContain("/join");
  });

  it("saves User Management only once when setup reaches it twice", async () => {
    const page = v14CreateWorldPage({ record: "created", usersOpen: true });
    await ensureE2EWorld(page, "admin-key-secret");

    expect(page.events.filter((event) => event === "save-users")).toHaveLength(1);
    expect(page.events.filter((event) => event === "join")).toHaveLength(1);
    expect(page.url()).toContain("/join");
  });

  it("saves users when User Management appears after World.create", async () => {
    const page = v14CreateWorldPage({ record: "created", usersAfterCreate: true });
    await ensureE2EWorld(page, "admin-key-secret");

    expect(page.events).toContain("save-users");
    expect(page.events).toContain("join");
    expect(page.events).not.toContain("gm-password");
    expect(page.launchCalls).toBe(0);
    expect(page.url()).toContain("/join");
  });

  it("saves users when launch opens User Management", async () => {
    const page = v14CreateWorldPage({ record: "created", usersAfterLaunch: true });
    await ensureE2EWorld(page, "admin-key-secret");

    expect(page.events).toContain("save-users");
    expect(page.events).toContain("join");
    expect(page.launchCalls).toBeGreaterThan(0);
    expect(page.url()).toContain("/join");
  });
});
