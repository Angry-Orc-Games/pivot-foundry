import { describe, expect, it } from "vitest";

import { startedAnnouncement, waitForListening } from "../scripts/foundry-compose.mjs";

const SHA = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const LICENSE = "FOUNDRY_LICENSE_KEY=ABCD-EFGH-IJKL-MNOP-QRST-UVWX";

describe("Foundry listening signal", () => {
  it("announces the server only after the container log says it is listening", () => {
    const quiet = startedAnnouncement(`Installing\n${LICENSE}\n`, SHA);
    const listening = startedAnnouncement(
      `${LICENSE}\nServer started and listening on port 30000\n`,
      SHA,
    );

    expect(quiet).toEqual([]);
    expect(listening).toEqual([
      "Server started and listening",
      `Foundry started for E2E commit ${SHA}.`,
    ]);
    expect(listening.join("\n")).not.toContain("ABCD-EFGH");
  });

  it("waits until the log contains the listening line", async () => {
    let reads = 0;
    const logs = await waitForListening(() => {
      reads += 1;
      return reads < 3 ? "booting" : "Server started and listening on port 30000";
    }, 2_000);

    expect(logs).toContain("Server started and listening");
    expect(reads).toBeGreaterThanOrEqual(3);
    expect(startedAnnouncement(logs, SHA)).toEqual([
      "Server started and listening",
      `Foundry started for E2E commit ${SHA}.`,
    ]);
  });

  it("stops the listening wait when startup has already failed", async () => {
    const started = Date.now();
    let error;
    try {
      await waitForListening(() => "booting", 5_000, {
        inspect: () => "Foundry container aborted",
      });
    } catch (caught) {
      error = caught;
    }

    expect(error?.code).toBe("STARTUP_FAILED");
    expect(error?.message).toBe("Foundry container aborted");
    expect(Date.now() - started).toBeLessThan(800);
  });

  it("times out without announcing a start when the line never appears", async () => {
    let error;
    try {
      await waitForListening(() => "still booting", 300);
    } catch (caught) {
      error = caught;
    }

    expect(error?.code).toBe("TIMEOUT");
    expect(error?.message).toContain("Server started and listening");
    expect(startedAnnouncement("still booting", SHA)).toEqual([]);
  });
});
