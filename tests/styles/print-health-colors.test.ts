import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

const foundryForm = readFileSync("scripts/foundry-v14-form-fixture.css", "utf8");
const tokens = readFileSync("styles/pf-tokens.css", "utf8");
const sheet = readFileSync("styles/pivot-fantasy.css", "utf8");

const alive = { background: "rgb(220, 235, 220)", color: "rgb(47, 107, 58)" };
const dying = { background: "rgb(245, 217, 213)", color: "rgb(161, 40, 30)" };
const stable = { background: "rgb(246, 234, 208)", color: "rgb(154, 106, 0)" };
const dead = { background: "rgb(236, 227, 207)", color: "rgb(85, 85, 85)" };

function render(theme: "theme-light" | "theme-dark") {
  const dom = new JSDOM(
    `<!DOCTYPE html>
    <html>
      <head>
        <style>
          ${foundryForm}
          ${tokens}
          ${sheet}
          .pivot-fantasy { --font-primary: Signika, system-ui, sans-serif; }
        </style>
      </head>
      <body class="${theme}">
        <form class="application pivot-fantasy pf-sheet sheet actor character${theme === "theme-dark" ? " theme-dark" : ""}">
          <section class="window-content">
            <div class="pf-print">
              <div class="pf-meter"><div class="pf-meter-fill hp"></div></div>
              <div class="pf-meter"><div class="pf-meter-fill pool"></div></div>
              <span class="pf-status alive"></span>
              <span class="pf-status dying"></span>
              <span class="pf-status stable"></span>
              <span class="pf-status dead"></span>
              <table class="pf-attacks">
                <thead><tr><th>Weapon</th></tr></thead>
              </table>
            </div>
          </section>
        </form>
      </body>
    </html>`,
    { pretendToBeVisual: true },
  );
  const view = dom.window;
  const paint = (selector: string) => {
    const el = view.document.querySelector(selector);
    if (!el) throw new Error(`missing ${selector}`);
    const style = view.getComputedStyle(el);
    const resolveVars = (value: string) => {
      let current = value;
      for (let step = 0; step < 4 && current.includes("var("); step += 1) {
        current = current.replace(/var\(\s*(--[\w-]+)\s*(?:,[^)]*)?\)/g, (_match, name) => {
          return style.getPropertyValue(name).trim();
        });
      }
      return current;
    };
    return {
      background: style.backgroundColor,
      color: style.color,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      fontFamily: resolveVars(style.fontFamily),
      textAlign: style.textAlign,
      textTransform: style.textTransform,
      letterSpacing: style.letterSpacing,
      borderTopWidth: style.borderTopWidth,
      borderRightWidth: style.borderRightWidth,
      borderBottomWidth: style.borderBottomWidth,
      borderBottomStyle: style.borderBottomStyle,
      borderBottomColor: style.borderBottomColor,
      borderLeftWidth: style.borderLeftWidth,
    };
  };
  return {
    alive: paint(".pf-status.alive"),
    dying: paint(".pf-status.dying"),
    stable: paint(".pf-status.stable"),
    dead: paint(".pf-status.dead"),
    hp: paint(".pf-meter-fill.hp"),
    pool: paint(".pf-meter-fill.pool"),
    attacks: paint("table.pf-attacks thead th"),
  };
}

describe("print sheet health and attacks header", () => {
  for (const theme of ["theme-light", "theme-dark"] as const) {
    it(`keeps alive, dying, stable, and dead chips distinct in ${theme}`, () => {
      const painted = render(theme);
      expect(painted.alive).toMatchObject(alive);
      expect(painted.dying).toMatchObject(dying);
      expect(painted.stable).toMatchObject(stable);
      expect(painted.dead).toMatchObject(dead);
      const backgrounds = [alive, dying, stable, dead].map((entry) => entry.background);
      expect(new Set(backgrounds).size).toBe(4);
    });

    it(`keeps the HP bar red and the Pool bar rust in ${theme}`, () => {
      const painted = render(theme);
      expect(painted.hp.background).toBe("rgb(161, 40, 30)");
      expect(painted.pool.background).toBe("rgb(138, 59, 18)");
    });
  }

  it("keeps the attacks header in plain ink", () => {
    for (const theme of ["theme-light", "theme-dark"] as const) {
      const header = render(theme).attacks;
      expect(header).toMatchObject({
        color: "rgb(28, 26, 22)",
        fontSize: "11.5px",
        fontWeight: "700",
        textAlign: "left",
        textTransform: "none",
        borderTopWidth: "0px",
        borderRightWidth: "0px",
        borderLeftWidth: "0px",
        borderBottomWidth: "1px",
        borderBottomStyle: "solid",
        borderBottomColor: "rgb(221, 221, 221)",
      });
      expect(header.fontFamily).toContain("Signika");
      expect(header.fontFamily).not.toMatch(/Georgia/i);
      expect(header.letterSpacing === "normal" || header.letterSpacing === "0px").toBe(true);
    }
  });
});
