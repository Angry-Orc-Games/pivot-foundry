const DICE3D_TIMEOUT_MS = 10000;

export async function waitForDice3D(message: unknown): Promise<void> {
  const messageId =
    message && typeof message === "object" && "id" in message && typeof message.id === "string"
      ? message.id
      : null;
  if (!messageId) return;

  const globals = globalThis as typeof globalThis & {
    game?: {
      dice3d?: {
        waitFor3DAnimationByMessageID?: (id: string) => Promise<void>;
      };
    };
  };

  if (!globals.game?.dice3d?.waitFor3DAnimationByMessageID) return;

  try {
    await Promise.race([
      globals.game.dice3d.waitFor3DAnimationByMessageID(messageId),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Dice3D timeout")), DICE3D_TIMEOUT_MS),
      ),
    ]);
  } catch {
    // Dice So Nice! animation failed or timed out; continue without waiting
  }
}
