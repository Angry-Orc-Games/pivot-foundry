import { waitForDiceSoNiceAnimation } from "./dice-so-nice";
import type { TypeDataModelConstructor } from "../foundry-runtime";

interface CombatantLike {
  id?: string;
  _id?: string;
  actor?: {
    id?: string;
    name?: string;
  };
  token?: unknown;
  hidden?: boolean;
  getInitiativeRoll?: (formula: string) => Promise<{
    toMessage?: (
      data: Record<string, unknown>,
      options?: { rollMode?: string; create?: boolean },
    ) => Promise<Record<string, unknown>>;
    total?: number;
    _evaluated?: boolean;
    evaluate?: () => Promise<unknown>;
  }>;
  _getInitiativeFormula?: () => string;
}

interface TurnLike {
  id?: string;
}

export function createPivotCombatClass(
  BaseCombat: TypeDataModelConstructor,
): TypeDataModelConstructor {
  class PivotCombat extends BaseCombat {
    /**
     * Roll initiative for one or more combatants.
     * Override to create chat messages with proper roll mode and wait for Dice So Nice animations.
     * Follows Foundry v14 Combat.rollInitiative semantics.
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
      const combatants = (this as { combatants?: Iterable<CombatantLike> }).combatants;
      if (!combatants) return this;

      const combatantList = Array.from(combatants);

      // Get roll mode from settings
      const game = globalThis as typeof globalThis & {
        game?: {
          settings?: { get?: (scope: string, key: string) => unknown };
          i18n?: { format?: (key: string, data: Record<string, unknown>) => string };
        };
      };
      const rawMode = game.game?.settings?.get?.("core", "rollMode");
      const rollMode = typeof rawMode === "string" ? rawMode : "roll";

      // Get ChatMessage constructor
      const ChatMessage = (
        globalThis as typeof globalThis & {
          ChatMessage?: {
            implementation?: {
              create?: (data: Record<string, unknown>) => Promise<unknown>;
              createDocuments?: (data: unknown[]) => Promise<unknown>;
            };
            create?: (data: Record<string, unknown>) => Promise<unknown>;
            createDocuments?: (data: unknown[]) => Promise<unknown>;
            getSpeaker?: (options: {
              actor?: unknown;
              token?: unknown;
              alias?: string;
            }) => Record<string, unknown>;
          };
        }
      ).ChatMessage;

      // Remember current combatant for turn preservation
      const currentCombatantId = (this as { combatant?: { id?: string } }).combatant?.id;

      // Roll initiative for each combatant
      const updates: Array<{ _id: string; initiative: number }> = [];

      for (const combatantId of combatantIds) {
        const combatant = combatantList.find((c) => (c.id ?? c._id) === combatantId);
        // Skip if combatant missing, no actor, or no getInitiativeRoll method
        if (!combatant?.actor || !combatant.getInitiativeRoll) continue;

        // Resolve formula per combatant
        const formula = options.formula ?? combatant._getInitiativeFormula?.() ?? "1d20";

        // Evaluate the roll using combatant method
        const roll = await combatant.getInitiativeRoll(formula);
        // v14 returns an unevaluated Roll; evaluate before reading total.
        if (!roll._evaluated) await roll.evaluate?.();
        const total = roll.total ?? 0;

        // Get speaker with actor, token, and alias
        const speaker = ChatMessage?.getSpeaker?.({
          actor: combatant.actor,
          token: combatant.token,
          alias: combatant.actor.name,
        }) ?? { alias: combatant.actor.name ?? "Unknown" };

        // Format flavor using i18n
        const flavor =
          game.game?.i18n?.format?.("COMBAT.RollsInitiative", {
            name: combatant.actor.name ?? "Unknown",
          }) ?? `${combatant.actor.name ?? "Unknown"} rolls for Initiative!`;

        // Compute effective roll mode: hidden combatant with 'roll' mode becomes 'gmroll'
        // Honor messageOptions.rollMode if provided
        const messageOptionsRollMode =
          options.messageOptions && "rollMode" in options.messageOptions
            ? options.messageOptions.rollMode
            : undefined;
        const baseRollMode =
          typeof messageOptionsRollMode === "string" ? messageOptionsRollMode : rollMode;
        const effectiveRollMode =
          combatant.hidden && baseRollMode === "roll" ? "gmroll" : baseRollMode;

        // Extract messageOptions without rollMode (will be passed separately to toMessage)
        const messageOptionsWithoutRollMode = options.messageOptions
          ? Object.fromEntries(
              Object.entries(options.messageOptions).filter(([key]) => key !== "rollMode"),
            )
          : {};

        // Build message data using roll.toMessage with core.initiativeRoll flag
        // toMessage applies the roll mode itself
        let chatData: Record<string, unknown> = {};
        if (roll.toMessage) {
          chatData = await roll.toMessage(
            {
              speaker,
              flavor,
              flags: { "core.initiativeRoll": true },
              ...messageOptionsWithoutRollMode,
            },
            { rollMode: effectiveRollMode, create: false },
          );
        }

        // Create message using ChatMessage.implementation.create for single message
        const Cls = ChatMessage?.implementation ?? ChatMessage;
        let created: unknown;
        if (Cls?.create) {
          created = await Cls.create(chatData);
        } else if (Cls?.createDocuments) {
          const createdList = await Cls.createDocuments([chatData]);
          created = Array.isArray(createdList) ? createdList[0] : undefined;
        }

        // Wait for Dice So Nice animation
        const message = created as { id?: string } | undefined;
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

      // Preserve current turn if requested (matching core behavior)
      if (options.updateTurn !== false && currentCombatantId) {
        const turns = (this as { turns?: TurnLike[] }).turns;
        if (turns) {
          const turnIndex = turns.findIndex((t) => t.id === currentCombatantId);
          if (turnIndex !== -1) {
            await (
              this as { update?: (data: Record<string, unknown>) => Promise<unknown> }
            ).update?.({
              turn: turnIndex,
            });
          }
        }
      }

      return this;
    }
  }

  return PivotCombat;
}
