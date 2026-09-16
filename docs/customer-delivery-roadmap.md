# Pivot Fantasy — Customer Delivery Checklist

Prepared 9 September 2026. Follow these steps in order and check each off only after its completion check passes.

**Starting point:** The current repository documents an early playable character sheet, basic rolls, Pool controls, initiative updates, item effects, migration support, and release tooling. The content pipeline currently contains an example fixture, not the published catalog. This roadmap is based on local source and documentation inspection; it does not certify current CI or live deployment health.

**Original 9 September planning estimate (not re-estimated after step 2): 230–370 working hours remaining, including roughly 25% contingency.** Allow about **6–10 weeks at 40 hours/week**, or **12–19 weeks at 20 hours/week**, plus customer response time.

These are preliminary estimates for one developer using AI for implementation, tests, documentation, and fixes. Hours include developer oversight and practical testing; they are not AI generation time alone. Assume the existing Foundry v14 architecture and hosting approach, available rules/content rights, and a fixed release scope. Confirm the estimate after step 1, especially catalog size and GM tooling.

- [ ] **1. Agree exactly what “finished” includes — 8–12 hours.** Confirm the rules version, every required content category and entry count, outstanding combat/magic/advancement rules, customer hosting destination, Foundry version/license, and who accepts delivery. Explicitly decide the treatment of crafting, magic items, runes, and thaumaturgy. **Done when:** the customer agrees to one feature/content checklist, including any manual workflows or exclusions.

- [x] **2. Finish attacks, damage, and survival — 16–24 hours.** Add exploding damage, damage/healing application, temporary HP, and death saves using confirmed rules. **Done when:** a character can attack, take damage, heal, fall unconscious, and resolve death saves correctly in Foundry. References: UC-004 through UC-006. Completed 15 September 2026 for the approved manual/automated scope; see [acceptance record](milestone-2-acceptance.md).

- [ ] **3. Finish combat and rests — 16–24 hours.** Implement the agreed actions, movement, cover, conditions, and rest recovery. Confirm the GM can set up combat and players can roll initiative into it. **Done when:** a complete combat and rest cycle works without editing raw character data. Reference: UC-007.

- [ ] **4. Ship the character-option library — 24–40 hours.** Build installable Foundry compendium packs for the agreed species, backgrounds, feats, flaws, and body modifications; apply their verified effects. **Done when:** the full agreed catalog is reconciled against the source, imports correctly, and adding/removing choices updates character totals correctly. Reference: UC-009.

- [ ] **5. Finish character creation and advancement — 16–24 hours.** Automate build points, valid choices, XP, levels, and advancement costs. **Done when:** a player can create and advance representative characters with correct costs, clear validation, and choices preserved after reload. Reference: UC-010.

- [ ] **6. Finish magic and its content — 24–40 hours.** Add the agreed streams and abilities, eligibility checks, progression costs, MP spending/recovery, and Control Magic. Implement agreed rune/thaumaturgy workflows as separate slices. **Done when:** a caster can learn, use, and recover abilities correctly, including insufficient resources and cancelled actions. Reference: UC-011.

- [ ] **7. Finish equipment and inventory content — 16–24 hours.** Ship the agreed weapons, armour, gear, and special items; apply requirements, penalties, weight, and armour/rest interactions. Add any crafting workflow agreed in step 1. **Done when:** the catalog is complete and equipping, using, and removing items gives the expected results. Reference: UC-012.

- [ ] **8. Build the agreed GM tools and bestiary — 24–40 hours.** Define and implement NPC/creature sheets, bosses, tiers/overlays, encounters, bestiary entries, and rewards in small slices. **Done when:** the GM can prepare and run a representative encounter, then award its rewards. This is the least-defined scope and needs re-estimation after discovery. Reference: UC-013.

- [ ] **9. Prove the whole product and fix defects — 24–40 hours.** Test as both GM and player, including permissions, simultaneous resource actions, save/reload, drag/drop, readable layouts, and large agreed content sets. Review input/import security. Test a fresh package install, an existing-world upgrade, and backup restoration. **Done when:** repository checks, CI, packaging, and Foundry v14 acceptance pass separately, with no unresolved delivery-blocking defects.

- [ ] **10. Get customer acceptance on the test server — 8–12 hours.** Deploy the release candidate to the agreed test environment and run a customer session covering creation, combat, magic, rests, advancement, and GM preparation. Fix acceptance defects and retest. **Done when:** the customer accepts the agreed checklist and approves the exact release for production.

- [ ] **11. Release, deploy, and hand over — 8–12 hours.** Publish the approved version and verify installation from its manifest. Back up the target system and world, deploy to the confirmed customer destination, verify the running version and key play flows, and check logs. Supply a short GM/player guide, install/update/restore instructions, access details through an appropriate private channel, and a named support contact. **Done when:** the customer can log in and play, the backup/rollback path is recorded, and an agreed first-session follow-up has closed any launch blockers.

**Base total: 184–292 hours.** With approximately 25% contingency: 230–365 hours, rounded to a planning range of 230–370 hours. Larger catalogs, extensive special-case automation, custom artwork/adventures, new hosting infrastructure, or a Foundry version change require re-estimation.

**For every development step:** have AI implement one small slice, add meaningful tests, run `npm run verify`, build/package when affected, and demonstrate the changed workflow in Foundry v14 before marking it complete. Feature estimates include these routine checks; step 9 covers integrated release testing.

**Start here:** ask AI to extract the unresolved decisions from UC-004 through UC-013, propose source-backed answers, and produce the step 1 checklist for customer review. Do not invent missing rules.

Detailed references: [remaining-work specifications](sdd/README.md), [requirements](sdd/requirements.md), [release checklist](release.md), and [deployment runbook](deployment.md). Production deployment remains a separate approved action.
