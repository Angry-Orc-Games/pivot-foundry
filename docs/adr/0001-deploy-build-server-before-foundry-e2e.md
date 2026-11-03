# Deploy to the build server before real-Foundry E2E

Merges to `main` deploy the CI-built package to the build server immediately, gated only on CI and a non-destructive smoke test. Real-Foundry E2E runs nightly against `main`, and production promotion requires a green nightly check on the packaged commit.

We chose this because the Foundry license allows one player-accessible instance, so E2E may only start in a quiet window (02:00–05:30 ET). Gating the deploy on E2E meant a daytime merge could not reach the build server, and the old deploy workflow failed on every run and was disabled.

Considered: keep E2E in the deploy path (rejected: blocks the build server on a nightly window), or run E2E on a separate runner (rejected: needs a second license).

Consequence: the build server may briefly hold a commit the nightly E2E has not yet passed. Production never does.
