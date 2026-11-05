# Glossary Map

## Contexts

- [Pivot Fantasy](./GLOSSARY.md): game-system language — Survival and the play actions that change a Character
- [Delivery](./docs/delivery/GLOSSARY.md): how a system package moves from a commit to Angry Orc Games hosts

## Relationships

- **Pivot Fantasy → Delivery**: Delivery ships the Foundry system that implements Pivot Fantasy; it does not rename Survival terms
- **Delivery ↛ Pivot Fantasy**: Delivery terms (staging, trusted-gate, E2E overlay, nightly, promote) stay out of the game glossary
- **Shared collision**: bare “overlay” is an NPC/token concept in the game system and an rsync step in Delivery — Delivery always says **E2E overlay**
