import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { ensureE2EWorld } from "../e2e/helpers/foundry.ts";

const INTERCEPTS = '<div class="tour-overlay"></div> intercepts pointer events';

function tourPage({ attached = true } = {}) {
  const events = [];
  let covered = attached;
  let evaluations = 0;
  const overlay = {
    first() {
      return overlay;
    },
    async waitFor(options = {}) {
      if (options.state === "detached") {
        if (covered) throw new Error("tour overlay still attached");
        return;
      }
      if (!covered) throw new Error("tour overlay hidden");
    },
  };
  const hidden = {
    first() {
      return hidden;
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
  const title = {
    first() {
      return title;
    },
    async fill() {
      events.push("title");
    },
  };
  const exitTour = {
    first() {
      return exitTour;
    },
    async click() {
      covered = false;
      events.push("tour-exit");
    },
  };
  const createWorld = {
    first() {
      return createWorld;
    },
    last() {
      return createWorld;
    },
    async waitFor() {},
    async isVisible() {
      return true;
    },
    async click() {
      if (covered) throw new Error(INTERCEPTS);
      events.push("create-world");
    },
  };
  return {
    events,
    async goto() {},
    async waitForFunction() {},
    async evaluate() {
      evaluations += 1;
      if (evaluations === 1) return false;
      if (evaluations === 2) return "unavailable";
      return true;
    },
    locator(selector = "") {
      const text = String(selector);
      if (text.includes("tour-overlay")) return overlay;
      if (text.includes("title") || text.includes('name="name"')) return title;
      return hidden;
    },
    getByRole(role, options = {}) {
      const name = options.name;
      const label = name instanceof RegExp ? name.source : String(name ?? "");
      if (role === "button" && name instanceof RegExp && name.test("Exit Tour")) {
        return exitTour;
      }
      if (role === "button" && name instanceof RegExp && name.test("Create World")) {
        return createWorld;
      }
      if (role === "checkbox" || role === "heading") return hidden;
      throw new Error(`unexpected role ${role} ${label}`);
    },
    keyboard: {
      async press(key) {
        if (key === "Escape") {
          covered = false;
          events.push("tour-exit");
        }
      },
    },
  };
}

describe("Foundry setup tour", () => {
  it("closes the tour overlay before Create World", async () => {
    const page = tourPage();
    await ensureE2EWorld(page, "admin-key-secret");

    expect(page.events[0]).toBe("tour-exit");
    expect(page.events).toContain("create-world");
    expect(page.events.indexOf("create-world")).toBeGreaterThan(page.events.indexOf("tour-exit"));
  });

  it("records tour close and create world without the administrator key", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pivot-auth-steps-"));
    const marker = join(dir, "setup-failure.txt");
    const previous = process.env.PIVOT_E2E_SETUP_FAILURE;
    process.env.PIVOT_E2E_SETUP_FAILURE = marker;
    const page = tourPage();
    try {
      await ensureE2EWorld(page, "admin-key-secret");
    } finally {
      if (previous === undefined) delete process.env.PIVOT_E2E_SETUP_FAILURE;
      else process.env.PIVOT_E2E_SETUP_FAILURE = previous;
    }
    const log = await readFile(join(dir, "auth-steps.log"), "utf8").catch(() => "");
    await rm(dir, { recursive: true, force: true });

    expect(log).toBe("license\nadmin\neula\nadmin\ntour close\ncreate world\nlaunch\n");
    expect(log).not.toContain("admin-key-secret");
  });

  it("clicks Create World when no tour is showing", async () => {
    const page = tourPage({ attached: false });
    await ensureE2EWorld(page, "admin-key-secret");

    expect(page.events[0]).toBe("create-world");
    expect(page.events).not.toContain("tour-exit");
  });
});

describe("setup phase deadlines", () => {
  it("ends an active core tour before Create World when the overlay shows up late", async () => {
    const page = lateTourPage();
    await ensureE2EWorld(page, "admin-key-secret");

    expect(page.ended).toBe(true);
    expect(page.events).toContain("create-world");
  });

  it("names tour close when core tour completion never returns", async () => {
    vi.useFakeTimers();
    const page = lateTourPage({ hangComplete: true });
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
      await vi.advanceTimersByTimeAsync(30_000);
      await Promise.race([pending, Promise.resolve()]);
    } finally {
      vi.useRealTimers();
    }

    expect(outcome).toBeInstanceOf(Error);
    expect(outcome.message).toMatch(/stalled during tour close/);
  });

  it("names create world when World.create never returns", async () => {
    vi.useFakeTimers();
    const page = tourPage();
    let evaluations = 0;
    page.evaluate = async () => {
      evaluations += 1;
      if (evaluations === 1) return false;
      if (evaluations === 2) return new Promise(() => {});
      return true;
    };
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
      await vi.advanceTimersByTimeAsync(30_000);
      await Promise.race([pending, Promise.resolve()]);
    } finally {
      vi.useRealTimers();
    }

    expect(outcome).toBeInstanceOf(Error);
    expect(outcome.message).toMatch(/stalled during create world/);
  });

  it("names launch when world.launch never returns", async () => {
    vi.useFakeTimers();
    const page = tourPage();
    let evaluations = 0;
    page.evaluate = async () => {
      evaluations += 1;
      if (evaluations === 1) return false;
      if (evaluations === 2) return "created";
      return new Promise(() => {});
    };
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
      await vi.advanceTimersByTimeAsync(30_000);
      await Promise.race([pending, Promise.resolve()]);
    } finally {
      vi.useRealTimers();
    }

    expect(outcome).toBeInstanceOf(Error);
    expect(outcome.message).toMatch(/stalled during launch/);
  });
});

describe("setup context tours", () => {
  it("does not fail the phase when a setup tour complete throws", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pivot-tour-notes-"));
    const marker = join(dir, "setup-failure.txt");
    const previous = process.env.PIVOT_E2E_SETUP_FAILURE;
    process.env.PIVOT_E2E_SETUP_FAILURE = marker;
    const page = classToursPage({ setupThrows: true });
    let error;
    try {
      await ensureE2EWorld(page, "admin-key-secret");
    } catch (caught) {
      error = caught;
    } finally {
      if (previous === undefined) delete process.env.PIVOT_E2E_SETUP_FAILURE;
      else process.env.PIVOT_E2E_SETUP_FAILURE = previous;
    }
    const notes = await readFile(join(dir, "tour-notes.log"), "utf8").catch(() => "");
    await rm(dir, { recursive: true, force: true });

    expect(error).toBeUndefined();
    expect(notes).toContain("core.ui-overview");
    expect(notes).toContain("reading 'isGM'");
    expect(notes).not.toContain("admin-key-secret");
  });

  it("completes setup tours and leaves user tours alone", async () => {
    const page = classToursPage({ includeSidebar: true });
    let error;
    try {
      await ensureE2EWorld(page, "admin-key-secret");
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeUndefined();
    expect(page.completed).toEqual(["ui-overview"]);
  });

  it("dismisses a suggested next tour dialog during tour close", async () => {
    const page = classToursPage({ dialog: true });
    await ensureE2EWorld(page, "admin-key-secret");

    expect(page.events).toContain("suggested-open");
    expect(page.events).toContain("dismiss-next-tour");
    expect(page.events.indexOf("dismiss-next-tour")).toBeLessThan(
      page.events.indexOf("create-world"),
    );
  });

  it("completes a core backups class while SetupTour is on the page", async () => {
    const page = classToursPage({ backupsClass: true });
    let error;
    try {
      await ensureE2EWorld(page, "admin-key-secret");
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeUndefined();
    expect(page.completed).toEqual(["ui-overview", "backups-overview"]);
  });

  it("declines the suggested tour dialog instead of closing the setup window", async () => {
    const page = classToursPage({ dialog: true, parentShell: true });
    await ensureE2EWorld(page, "admin-key-secret");

    expect(page.events).toContain("dismiss-next-tour");
    expect(page.events).not.toContain("close-setup");
  });

  it("finishes tour close while complete waits and dismisses No", async () => {
    vi.useFakeTimers();
    const page = classToursPage({ hangComplete: true, dialog: true });
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
      await vi.advanceTimersByTimeAsync(1_000);
      await Promise.race([pending, Promise.resolve()]);
    } finally {
      vi.useRealTimers();
    }

    expect(outcome).toBe("done");
    expect(page.events).toContain("dismiss-no");
    expect(page.events.indexOf("dismiss-no")).toBeLessThan(page.events.indexOf("create-world"));
  });

  it("closes a suggested next tour dialog that only offers Close Window", async () => {
    const page = classToursPage({ closeWindowOnly: true });
    await ensureE2EWorld(page, "admin-key-secret");

    expect(page.events).toContain("close-window");
    expect(page.events).not.toContain("dismiss-no");
    expect(page.events.indexOf("close-window")).toBeLessThan(page.events.indexOf("create-world"));
  });

  it("writes tour notes when tour close stalls", async () => {
    vi.useFakeTimers();
    const dir = await mkdtemp(join(tmpdir(), "pivot-tour-stall-"));
    const marker = join(dir, "setup-failure.txt");
    const previousFailure = process.env.PIVOT_E2E_SETUP_FAILURE;
    const previousKey = process.env.FOUNDRY_ADMIN_KEY;
    process.env.PIVOT_E2E_SETUP_FAILURE = marker;
    process.env.FOUNDRY_ADMIN_KEY = "admin-key-secret";
    const page = classToursPage({ hangEvaluate: true });
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
      await vi.advanceTimersByTimeAsync(20_000);
      await Promise.race([pending, Promise.resolve()]);
    } finally {
      vi.useRealTimers();
      if (previousFailure === undefined) delete process.env.PIVOT_E2E_SETUP_FAILURE;
      else process.env.PIVOT_E2E_SETUP_FAILURE = previousFailure;
      if (previousKey === undefined) delete process.env.FOUNDRY_ADMIN_KEY;
      else process.env.FOUNDRY_ADMIN_KEY = previousKey;
    }
    const notes = await readFile(join(dir, "tour-notes.log"), "utf8").catch(() => "");
    await rm(dir, { recursive: true, force: true });

    expect(outcome).toBeInstanceOf(Error);
    expect(outcome.message).toMatch(/stalled during tour close/);
    expect(notes).toContain("tour close");
    expect(notes).not.toContain("admin-key-secret");
  });
});

function lateTourPage({ hangComplete = false } = {}) {
  const events = [];
  let ended = false;
  const tour = {
    namespace: "core",
    id: "backups-overview",
    status: "in-progress",
    exit() {
      if (hangComplete) return;
      ended = true;
      this.status = "completed";
    },
    complete() {
      if (hangComplete) return new Promise(() => {});
      ended = true;
      this.status = "completed";
      return Promise.resolve();
    },
  };
  let evaluations = 0;
  const hidden = {
    first() {
      return hidden;
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
  const title = {
    first() {
      return title;
    },
    async fill() {
      events.push("title");
    },
  };
  const createWorld = {
    first() {
      return createWorld;
    },
    last() {
      return createWorld;
    },
    async waitFor() {},
    async isVisible() {
      return true;
    },
    async click() {
      if (!ended) throw new Error(INTERCEPTS);
      events.push("create-world");
    },
  };
  return {
    events,
    get ended() {
      return ended;
    },
    async goto() {},
    async waitForFunction() {},
    async evaluate(fn) {
      if (typeof fn === "function" && fn.toString().includes("activeTour")) {
        globalThis.foundry = { nue: { Tour: { activeTour: tour } } };
        globalThis.game = { ready: false, tours: [tour] };
        try {
          return await fn();
        } finally {
          delete globalThis.foundry;
          delete globalThis.game;
        }
      }
      evaluations += 1;
      if (evaluations === 1) return "unavailable";
      return true;
    },
    locator(selector = "") {
      const text = String(selector);
      if (text.includes("tour-overlay")) return hidden;
      if (text.includes("title") || text.includes('name="name"')) return title;
      return hidden;
    },
    getByRole(role, options = {}) {
      const name = options.name;
      if (role === "button" && name instanceof RegExp && name.test("Create World"))
        return createWorld;
      if (role === "checkbox" || role === "heading") return hidden;
      if (role === "button") return hidden;
      throw new Error(`unexpected role ${role}`);
    },
    keyboard: { async press() {} },
  };
}

function classToursPage({
  setupThrows = false,
  includeSidebar = false,
  dialog = false,
  backupsClass = false,
  parentShell = false,
  hangComplete = false,
  closeWindowOnly = false,
  hangEvaluate = false,
} = {}) {
  const completed = [];
  const events = [];
  function SetupTour() {
    this.kind = "setup";
  }
  function SidebarTour() {
    this.kind = "sidebar";
  }
  let dialogVisible = false;
  const setup = Object.assign(new SetupTour(), {
    namespace: "core",
    id: "ui-overview",
    status: "unstarted",
    complete() {
      completed.push(this.id);
      if (setupThrows) {
        throw new TypeError("Cannot read properties of null (reading 'isGM')");
      }
      if (dialog || hangComplete || closeWindowOnly) {
        dialogVisible = true;
        events.push("suggested-open");
      }
      if (hangComplete) return new Promise(() => {});
    },
  });
  const tours = [setup];
  if (includeSidebar) {
    const sidebar = Object.assign(new SidebarTour(), {
      namespace: "core",
      id: "sidebar",
      status: "unstarted",
      complete() {
        completed.push(this.id);
        throw new TypeError("Cannot read properties of null (reading 'isGM')");
      },
    });
    Object.defineProperty(sidebar, "steps", {
      get() {
        throw new TypeError("Cannot read properties of null (reading 'isGM')");
      },
    });
    tours.push(sidebar);
  }
  if (backupsClass) {
    function BackupsTour() {
      this.kind = "backups";
    }
    tours.push(
      Object.assign(new BackupsTour(), {
        namespace: "core",
        id: "backups-overview",
        status: "unstarted",
        complete() {
          completed.push(this.id);
        },
      }),
    );
  }
  const hidden = {
    first() {
      return hidden;
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
  const title = {
    first() {
      return title;
    },
    async fill() {
      events.push("title");
    },
  };
  const createWorld = {
    first() {
      return createWorld;
    },
    last() {
      return createWorld;
    },
    async waitFor() {},
    async isVisible() {
      return true;
    },
    async click() {
      events.push("create-world");
    },
  };
  const dialogRoot = {
    filter() {
      return dialogRoot;
    },
    first() {
      return dialogRoot;
    },
    last() {
      return dialogRoot;
    },
    async waitFor() {
      if (!dialogVisible) throw new Error("suggested next tour hidden");
    },
    getByRole(role, options = {}) {
      const name = options.name;
      if (role === "button" && name instanceof RegExp && name.test("No Thanks")) {
        return {
          first() {
            return this;
          },
          async click() {
            events.push("dismiss-next-tour");
            dialogVisible = false;
          },
        };
      }
      if (role === "button" && name instanceof RegExp && !closeWindowOnly && name.test("No")) {
        return {
          first() {
            return this;
          },
          async click() {
            events.push("dismiss-no");
            dialogVisible = false;
          },
        };
      }
      if (role === "button" && name instanceof RegExp && name.test("Close Window")) {
        return {
          first() {
            return this;
          },
          async click() {
            events.push("close-window");
            dialogVisible = false;
          },
        };
      }
      return {
        first() {
          return this;
        },
        async click() {
          throw new Error("hidden");
        },
      };
    },
  };
  let evaluations = 0;
  return {
    completed,
    events,
    async goto() {},
    async waitForFunction() {},
    async evaluate(fn) {
      if (hangEvaluate && fn?.name === "silenceCoreTours") return new Promise(() => {});
      if (typeof fn === "function" && fn.toString().includes("activeTour")) {
        globalThis.foundry = {
          nue: {
            tours: { SetupTour, SidebarTour },
            Tour: { activeTour: null },
          },
        };
        globalThis.game = { ready: false, user: null, tours };
        try {
          return await fn();
        } finally {
          delete globalThis.foundry;
          delete globalThis.game;
        }
      }
      evaluations += 1;
      if (evaluations === 1) return "unavailable";
      return true;
    },
    locator(selector = "") {
      const text = String(selector);
      if (parentShell && text.includes(".application")) {
        const shell = {
          filter() {
            return shell;
          },
          first() {
            return shell;
          },
          last() {
            return dialogRoot;
          },
          async waitFor() {
            if (!dialogVisible) throw new Error("suggested next tour hidden");
          },
          getByRole(role, options = {}) {
            const name = options.name;
            if (role === "button" && name instanceof RegExp && name.test("Close")) {
              return {
                first() {
                  return this;
                },
                async click() {
                  events.push("close-setup");
                },
              };
            }
            throw new Error(`unexpected shell role ${role}`);
          },
        };
        return shell;
      }
      if (text.includes("dialog") || text.includes("window-app")) return dialogRoot;
      if (text.includes("title") || text.includes('name="name"')) return title;
      return hidden;
    },
    getByRole(role, options = {}) {
      const name = options.name;
      if (role === "button" && name instanceof RegExp && name.test("Create World"))
        return createWorld;
      if (role === "checkbox" || role === "heading") return hidden;
      if (role === "button") return hidden;
      throw new Error(`unexpected role ${role}`);
    },
    keyboard: { async press() {} },
  };
}
