import { describe, it, expect } from "vitest";

/**
 * Utility to check if a nested property exists in an object.
 * Mimics foundry.utils.hasProperty for nested path checking.
 * Extracted from src/pivot.ts for testing.
 */
function hasNestedProperty(obj: unknown, path: string): boolean {
  if (typeof obj !== "object" || obj === null) return false;
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (typeof current !== "object" || current === null || !(part in current)) {
      return false;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return true;
}

describe("hasNestedProperty (updateActor hook compatibility)", () => {
  it("detects nested HP value change (Foundry's actual updateActor format)", () => {
    const changes = {
      system: {
        attributes: {
          hp: {
            value: 5,
          },
        },
      },
    };

    expect(hasNestedProperty(changes, "system.attributes.hp.value")).toBe(true);
  });

  it("detects nested death status change (Foundry's actual updateActor format)", () => {
    const changes = {
      system: {
        attributes: {
          deathSaves: {
            status: "dying",
          },
        },
      },
    };

    expect(hasNestedProperty(changes, "system.attributes.deathSaves.status")).toBe(true);
  });

  it("returns false for flattened dotted keys (common mistake)", () => {
    const changes = {
      "system.attributes.hp.value": 5,
    };

    // This should be false because Foundry sends nested objects, not dotted keys
    expect(hasNestedProperty(changes, "system.attributes.hp.value")).toBe(false);
  });

  it("returns false when path does not exist", () => {
    const changes = {
      system: {
        attributes: {
          hp: {
            max: 10, // value is not present
          },
        },
      },
    };

    expect(hasNestedProperty(changes, "system.attributes.hp.value")).toBe(false);
  });

  it("returns false when intermediate path is missing", () => {
    const changes = {
      system: {
        resources: {
          // attributes path is missing
          pool: { value: 3 },
        },
      },
    };

    expect(hasNestedProperty(changes, "system.attributes.hp.value")).toBe(false);
  });

  it("handles partial path correctly", () => {
    const changes = {
      system: {
        attributes: {
          hp: {
            value: 5,
          },
        },
      },
    };

    expect(hasNestedProperty(changes, "system.attributes")).toBe(true);
    expect(hasNestedProperty(changes, "system.attributes.hp")).toBe(true);
  });

  it("returns false for null or non-object values", () => {
    expect(hasNestedProperty(null, "system.attributes.hp.value")).toBe(false);
    expect(hasNestedProperty(undefined, "system.attributes.hp.value")).toBe(false);
    expect(hasNestedProperty("string", "system.attributes.hp.value")).toBe(false);
    expect(hasNestedProperty(123, "system.attributes.hp.value")).toBe(false);
  });
});
