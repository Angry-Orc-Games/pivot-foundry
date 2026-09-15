import { localize } from "./ui";
/** Operational deadline, not an explosion cap: cancellation always yields an incomplete roll. */
export function rollProgress(deadlineMs = 60000): {
  wait<T>(work: Promise<T>): Promise<T>;
  close(): void;
  cancel(): void;
} {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deadlineMs);
  let dialog: HTMLDialogElement | undefined;
  if (typeof document !== "undefined") {
    dialog = document.createElement("dialog");
    const text = document.createElement("p");
    text.textContent = localize("RollingHelp");
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = localize("Cancel");
    cancel.addEventListener("click", () => controller.abort());
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      controller.abort();
    });
    dialog.append(text, cancel);
    document.body.append(dialog);
    dialog.showModal();
  }
  return {
    cancel: () => controller.abort(),
    close: () => {
      clearTimeout(timer);
      dialog?.close();
      dialog?.remove();
    },
    wait: async <T>(work: Promise<T>) => {
      void work.catch(() => {});
      // Yield so the user can cancel even when the dice provider resolves synchronously.
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (controller.signal.aborted) throw Error("Incomplete");
      return new Promise<T>((resolve, reject) => {
        const abort = () => reject(Error("Incomplete"));
        controller.signal.addEventListener("abort", abort, { once: true });
        work
          .then(resolve, reject)
          .finally(() => controller.signal.removeEventListener("abort", abort));
      });
    },
  };
}
