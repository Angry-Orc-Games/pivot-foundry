/**
 * Wait for Dice So Nice animation to complete for a chat message.
 * Returns immediately if DSN is not active.
 * Times out after 10 seconds to prevent stuck animations from blocking initiative.
 */
export async function waitForDiceSoNiceAnimation(messageId: string): Promise<void> {
  const gameGlobal = globalThis as typeof globalThis & {
    game?: {
      modules?: { get?: (id: string) => { active?: boolean } | undefined };
      dice3d?: { waitFor3DAnimationByMessageID?: (id: string) => Promise<void> };
    };
  };

  const dsnModule = gameGlobal.game?.modules?.get?.("dice-so-nice");
  const dice3d = gameGlobal.game?.dice3d;

  // Only wait if DSN module is active and dice3d API is available
  if (!dsnModule?.active || !dice3d?.waitFor3DAnimationByMessageID) {
    return;
  }

  try {
    // Cap wait at 10s to prevent stuck animations from blocking initiative
    const waitPromise = dice3d.waitFor3DAnimationByMessageID(messageId);
    const timeoutPromise = new Promise<void>((resolve) => setTimeout(resolve, 10000));
    await Promise.race([waitPromise, timeoutPromise]);
  } catch {
    // If DSN wait throws, continue anyway
  }
}
