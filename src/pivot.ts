type FoundryHooks = {
  once(event: "init", callback: () => void): void;
};

type FoundryTypeDataModelConstructor = new (...args: never[]) => {
  readonly parent?: unknown;
};

type FoundryRuntime = {
  abstract: {
    TypeDataModel: FoundryTypeDataModelConstructor;
  };
};

type FoundryConfig = {
  Actor: {
    dataModels: Record<string, FoundryTypeDataModelConstructor>;
  };
};

declare const Hooks: FoundryHooks;
declare const CONFIG: FoundryConfig;
declare const foundry: FoundryRuntime;

class PivotCharacterData extends foundry.abstract.TypeDataModel {
  static defineSchema(): Record<string, never> {
    return {};
  }
}

Hooks.once("init", () => {
  CONFIG.Actor.dataModels.character = PivotCharacterData;
  console.log("Pivot Fantasy | Initializing system");
});
