type FoundryHooks = {
  once(event: "init", callback: () => void): void;
};

declare const Hooks: FoundryHooks;

Hooks.once("init", () => {
  console.log("Pivot Fantasy | Initializing system");
});
