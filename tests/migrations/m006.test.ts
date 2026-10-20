import { describe, expect, it } from "vitest";

import en from "../../lang/en.json";
import { createPivotItemDataModels } from "../../src/data/item-data";
import { runWorldMigrations, type MigratableDocument } from "../../src/migrations/world-migrations";
import { CURRENT_SCHEMA_VERSION } from "../../src/rules/schema-version";

const CORE_REVIEW_NOTICE =
  "These magic abilities were stored as echelon 1. The old sheet could not save Core, so switch any Core abilities to Core by hand.";

type PersistedItem = MigratableDocument & {
  updates: Record<string, unknown>[];
  stored: { echelon: unknown };
};

function persistedItem(name: string, type: string, echelon: unknown): PersistedItem {
  const stored = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    effects: [] as unknown[],
    echelon,
  };
  const updates: Record<string, unknown>[] = [];
  return {
    name,
    type,
    updates,
    stored,
    toObject: () => ({ system: { ...stored } }),
    update: async (data) => {
      updates.push(data);
      if ("system.echelon" in data) stored.echelon = data["system.echelon"];
    },
  };
}

describe("M006 magic echelon migration", () => {
  it("uses the English notice text from the language file", () => {
    expect(en["PIVOT.Migration.M006CoreReview"]).toBe(CORE_REVIEW_NOTICE);
  });

  it("keeps stored 1 as Echelon 1, maps every other legacy value, and notices the GM once", async () => {
    const spark = persistedItem("Spark", "magicAbility", 1);
    const already = persistedItem("Already", "magicAbility", "1");
    const zero = persistedItem("Zero", "magicAbility", 0);
    const high = persistedItem("High", "magicAbility", 5);
    const outOfRange = persistedItem("Out", "magicAbility", 6);
    const negative = persistedItem("Negative", "magicAbility", -1);
    const fraction = persistedItem("Fraction", "magicAbility", 1.5);
    const foo = persistedItem("Foo", "magicAbility", "foo");
    const titled = persistedItem("Titled", "magicAbility", "Core");
    const stream = persistedItem("Flame Stream", "magicStream", 1);
    const mend = persistedItem("Mend", "magicAbility", 1);
    const blast = persistedItem("Blast", "magicAbility", 2);
    const actor: MigratableDocument = {
      name: "Grawl",
      type: "character",
      items: [mend, blast],
      toObject: () => ({
        system: { schemaVersion: CURRENT_SCHEMA_VERSION, survivalVersion: 1 },
      }),
      update: async () => undefined,
    };
    const worldItems = [
      spark,
      already,
      zero,
      high,
      outOfRange,
      negative,
      fraction,
      foo,
      titled,
      stream,
    ];
    const notices: string[] = [];
    const logs: string[] = [];
    const notify = (_level: "info" | "warn" | "error", message: string) => {
      notices.push(message);
    };
    const log = (message: string) => {
      logs.push(message);
    };

    await runWorldMigrations({
      game: { user: { isGM: false }, items: worldItems, actors: [actor] },
      notify,
      log,
    });
    expect(notices).toEqual([]);
    expect(logs).toEqual([]);
    expect(spark.stored.echelon).toBe(1);

    await runWorldMigrations({
      game: { user: { isGM: true }, items: worldItems, actors: [actor] },
      notify,
      log,
    });

    expect(spark.stored.echelon).toBe("1");
    expect(mend.stored.echelon).toBe("1");
    expect(blast.stored.echelon).toBe("2");
    expect(high.stored.echelon).toBe("5");
    expect(stream.stored.echelon).toBe("1");
    expect(already.stored.echelon).toBe("1");
    expect(already.updates).toEqual([]);
    expect(titled.stored.echelon).toBe("core");
    expect(zero.stored.echelon).toBe("core");
    expect(outOfRange.stored.echelon).toBe("core");
    expect(negative.stored.echelon).toBe("core");
    expect(fraction.stored.echelon).toBe("core");
    expect(foo.stored.echelon).toBe("core");

    const reviews = notices.filter((message) => message.includes(CORE_REVIEW_NOTICE));
    expect(reviews).toHaveLength(1);
    const review = reviews[0] ?? "";
    expect(review.split("\n")).toEqual([CORE_REVIEW_NOTICE, "Spark", "Grawl: Mend"]);
    expect(review).not.toContain("Flame Stream");
    expect(review).not.toContain("Blast");
    expect(review).not.toContain("Zero");
    expect(logs).toContain(review);

    const updatesAfterFirstRun = spark.updates.length;
    await runWorldMigrations({
      game: { user: { isGM: true }, items: worldItems, actors: [actor] },
      notify,
      log,
    });

    expect(notices.filter((message) => message.includes(CORE_REVIEW_NOTICE))).toHaveLength(1);
    expect(logs.filter((message) => message.includes(CORE_REVIEW_NOTICE))).toHaveLength(1);
    expect(spark.updates).toHaveLength(updatesAfterFirstRun);
    expect(spark.stored.echelon).toBe("1");
  });

  it("notices numeric echelon 1 after model cleanup and ignores an echelon already stored as a string", async () => {
    const numeric = cleanedMagicItem("Spark", "magicAbility", 1);
    const textual = cleanedMagicItem("Already", "magicAbility", "1");
    const notices: string[] = [];
    const logs: string[] = [];
    const notify = (_level: "info" | "warn" | "error", message: string) => {
      notices.push(message);
    };
    const log = (message: string) => {
      logs.push(message);
    };

    await runWorldMigrations({
      game: { user: { isGM: true }, items: [numeric, textual], actors: [] },
      notify,
      log,
    });

    const reviews = notices.filter((message) => message.includes(CORE_REVIEW_NOTICE));
    expect(reviews).toHaveLength(1);
    expect(reviews[0]?.split("\n")).toEqual([CORE_REVIEW_NOTICE, "Spark"]);
    expect(reviews[0]).not.toContain("Already");
    expect(logs).toContain(reviews[0]);
    expect(numeric.updates).toEqual([{ "system.echelon": "1" }]);
    expect(numeric.updateOptions).toEqual([{ diff: false }]);
    expect(textual.updates).toEqual([]);

    await runWorldMigrations({
      game: { user: { isGM: true }, items: [numeric, textual], actors: [] },
      notify,
      log,
    });
    expect(notices.filter((message) => message.includes(CORE_REVIEW_NOTICE))).toHaveLength(1);
    expect(textual.updates).toEqual([]);
  });
});

class MigrationTypeDataModel {
  readonly parent?: unknown;
}

function migrationFoundry() {
  class NumberField {
    readonly kind = "number";
    constructor(readonly options?: unknown) {}
  }
  class StringField {
    readonly kind = "string";
    constructor(readonly options?: unknown) {}
  }
  class BooleanField {
    readonly kind = "boolean";
    constructor(readonly options?: unknown) {}
  }
  class SchemaField {
    readonly kind = "schema";
    constructor(readonly fields: Record<string, object>) {}
  }
  class ArrayField {
    readonly kind = "array";
    constructor(readonly inner: object) {}
  }
  return {
    abstract: { TypeDataModel: MigrationTypeDataModel },
    data: { fields: { NumberField, StringField, BooleanField, SchemaField, ArrayField } },
    applications: {
      api: { HandlebarsApplicationMixin: (base: typeof MigrationTypeDataModel) => base },
      apps: { DocumentSheetConfig: { registerSheet: () => undefined } },
      sheets: {
        ActorSheetV2: class {
          readonly mockSheet = "actor";
        },
        ItemSheetV2: class {
          readonly mockSheet = "item";
        },
      },
    },
  };
}

function cleanedMagicItem(
  name: string,
  type: "magicAbility" | "magicStream",
  rawEchelon: unknown,
): MigratableDocument & {
  updates: Record<string, unknown>[];
  updateOptions: Array<{ diff?: boolean } | undefined>;
} {
  const models = createPivotItemDataModels(migrationFoundry());
  const migrateData = (
    models[type] as unknown as {
      migrateData: (source: Record<string, unknown>) => Record<string, unknown>;
    }
  ).migrateData;
  const system = migrateData({
    schemaVersion: CURRENT_SCHEMA_VERSION,
    effects: [],
    echelon: rawEchelon,
  });
  if (typeof system.echelon === "number") system.echelon = String(system.echelon);
  const updates: Record<string, unknown>[] = [];
  const updateOptions: Array<{ diff?: boolean } | undefined> = [];
  return {
    name,
    type,
    updates,
    updateOptions,
    _source: { system },
    toObject: () => ({ system: { ...system } }),
    update: async (data, options) => {
      updates.push(data);
      updateOptions.push(options);
      if ("system.echelon" in data) system.echelon = data["system.echelon"];
    },
  };
}
