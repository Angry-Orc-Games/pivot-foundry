import { waitForDiceSoNiceAnimation } from "./dice-so-nice";
import type { TypeDataModelConstructor } from "../foundry-runtime";

export function createPivotCombatClass(
  BaseCombat: TypeDataModelConstructor,
): TypeDataModelConstructor {
  class PivotCombat extends BaseCombat {
    /**
     * Roll initiative for one or more combatants.
     * Override to create chat messages with proper roll mode and wait for Dice So Nice animations.
     */
    async rollInitiative(
      ids: string | string[],
      options: {
        formula?: string;
        updateTurn?: boolean;
        messageOptions?: Record<string, unknown>;
      } = {},
    ): Promise<unknown> {
      // Normalize IDs to array
      const combatantIds = typeof ids === "string" ? [ids] : ids;
      if (combatantIds.length === 0) return this;

      // Get combatants collection
      const combatants = (this as { combatants?: unknown }).combatants as
        | Iterable<{
            id?: string;
            actor?: {
              id?: string;
              name?: string;
              getInitiativeRoll?: (formula: string) => Promise<{
                evaluate: (options?: Record<string, unknown>) => Promise<unknown>;
                total?: number;
              }>;
            };
            _id?: string;
          }>
        | undefined;

      if (!combatants) return this;

      const combatantList = Array.from(combatants);

      // Get roll mode from settings
      const game = globalThis as typeof globalThis & {
        game?: { settings?: { get?: (scope: string, key: string) => unknown } };
      };
      const rawMode = game.game?.settings?.get?.("core", "rollMode");
      const rollMode = typeof rawMode === "string" ? rawMode : "roll";

      // Get ChatMessage constructor
      const ChatMessage = (
        globalThis as typeof globalThis & {
          ChatMessage?: {
            implementation?: { createDocuments?: (data: unknown[]) => Promise<unknown> };
            createDocuments?: (data: unknown[]) => Promise<unknown>;
            applyRollMode?: (data: Record<string, unknown>, mode: string) => void;
            getSpeaker?: (options: { actor: unknown }) => Record<string, unknown>;
          };
        }
      ).ChatMessage;

      // Roll initiative for each combatant
      const updates: Array<{ _id: string; initiative: number }> = [];
      const formula =
        options.formula ??
        (
          this as { _getInitiativeFormula?: (combatant: unknown) => string }
        )._getInitiativeFormula?.(combatantList[0]) ??
        "1d20";

      for (const combatantId of combatantIds) {
        const combatant = combatantList.find((c) => (c.id ?? c._id) === combatantId);
        if (!combatant?.actor?.getInitiativeRoll) continue;

        // Evaluate the roll
        const roll = await combatant.actor.getInitiativeRoll(formula);
        await roll.evaluate({ async: true });

        const total = roll.total ?? 0;

        // Create chat message data
        const speaker = ChatMessage?.getSpeaker?.({ actor: combatant.actor }) ?? {
          alias: combatant.actor.name ?? "Unknown",
        };

        const chatData = {
          speaker,
          flavor: `${combatant.actor.name ?? "Unknown"} rolls for Initiative!`,
          type: 5, // CHAT_MESSAGE_TYPES.ROLL
          roll,
          ...options.messageOptions,
        };

        // Apply roll mode
        if (ChatMessage?.applyRollMode) {
          ChatMessage.applyRollMode(chatData, rollMode);
        }

        // Create message
        const Cls = ChatMessage?.implementation ?? ChatMessage;
        let created: unknown = [];
        if (Cls?.createDocuments) {
          created = await Cls.createDocuments([chatData]);
        }

        // Wait for Dice So Nice animation
        const createdList = Array.isArray(created) ? created : [];
        const message = createdList[0] as { id?: string } | undefined;
        if (message?.id) {
          await waitForDiceSoNiceAnimation(message.id);
        }

        // Queue initiative update
        updates.push({
          _id: combatant.id ?? combatant._id ?? "",
          initiative: total,
        });
      }

      // Update all combatant initiatives
      if (updates.length > 0) {
        await (
          this as {
            updateEmbeddedDocuments?: (type: string, updates: unknown[]) => Promise<unknown>;
          }
        ).updateEmbeddedDocuments?.("Combatant", updates);
      }

      // Update turn order if requested
      if (options.updateTurn !== false) {
        await (this as { update?: (data: Record<string, unknown>) => Promise<unknown> }).update?.({
          turn: 0,
        });
      }

      return this;
    }
  }

  return PivotCombat;
}
