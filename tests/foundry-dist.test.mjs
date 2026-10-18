import { Buffer } from "node:buffer";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ReadableStream } from "node:stream/web";
import { TextEncoder } from "node:util";

import { describe, expect, it } from "vitest";

import { downloadTo } from "../scripts/foundry-dist.mjs";
import { describeUrl } from "../scripts/foundry-env.mjs";

const user = "cache-user";
const pass = "p@ss";
const secretUrl = `https://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@cache.example/foundry.zip`;
const expectedAuthorization = `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;

function authorization(init) {
  return init.headers.authorization ?? null;
}

function webBody(text) {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });
}

function httpResponse({ status = 200, location, body = "zip-bytes" } = {}) {
  const headers = {
    get(name) {
      if (name.toLowerCase() === "location") return location ?? null;
      return null;
    },
  };
  const ok = status >= 200 && status < 300;
  return {
    status,
    ok,
    headers,
    body: ok ? webBody(body) : null,
  };
}

async function captureDownload(fetchImpl) {
  const dir = await mkdtemp(join(tmpdir(), "pivot-foundry-dist-"));
  const dest = join(dir, "foundry.zip");
  await downloadTo(secretUrl, dest, fetchImpl);
  return { dest, bytes: await readFile(dest, "utf8") };
}

describe("foundry release download", () => {
  it("sends basic auth and fetches the URL without userinfo", async () => {
    const calls = [];
    const fetchImpl = async (url, init) => {
      calls.push({ url, init });
      return httpResponse();
    };

    const saved = await captureDownload(fetchImpl);

    expect(calls).toHaveLength(1);
    expect(calls[0].init.redirect).toBe("manual");
    expect(authorization(calls[0].init)).toBe(expectedAuthorization);
    expect(new URL(calls[0].url).username).toBe("");
    expect(new URL(calls[0].url).password).toBe("");
    expect(calls[0].url).not.toContain(user);
    expect(calls[0].url).not.toContain("p%40ss");
    expect(saved.bytes).toBe("zip-bytes");
  });

  it("sends no authorization header when the URL has no credentials", async () => {
    const calls = [];
    const fetchImpl = async (url, init) => {
      calls.push({ url, init });
      return httpResponse();
    };
    const dir = await mkdtemp(join(tmpdir(), "pivot-foundry-dist-"));

    await downloadTo("https://cache.example/foundry.zip", join(dir, "foundry.zip"), fetchImpl);

    expect(authorization(calls[0].init)).toBeNull();
  });

  it("keeps authorization on a same-origin redirect", async () => {
    const calls = [];
    const fetchImpl = async (url, init) => {
      calls.push({ url, init });
      if (calls.length === 1) {
        return httpResponse({ status: 302, location: "https://cache.example/next.zip" });
      }
      return httpResponse();
    };

    await captureDownload(fetchImpl);

    expect(calls).toHaveLength(2);
    expect(authorization(calls[1].init)).toBe(expectedAuthorization);
    expect(calls[1].url).toBe("https://cache.example/next.zip");
  });

  it("drops authorization on a cross-origin redirect", async () => {
    const calls = [];
    const fetchImpl = async (url, init) => {
      calls.push({ url, init });
      if (calls.length === 1) {
        return httpResponse({ status: 302, location: "https://mirror.example/next.zip" });
      }
      return httpResponse();
    };

    await captureDownload(fetchImpl);

    expect(authorization(calls[0].init)).toBe(expectedAuthorization);
    expect(authorization(calls[1].init)).toBeNull();
    expect(calls[1].url).toBe("https://mirror.example/next.zip");
  });

  it("keeps credentials out of download errors", async () => {
    const fetchImpl = async () => {
      throw new Error(`connect failed for ${secretUrl}`);
    };
    const dir = await mkdtemp(join(tmpdir(), "pivot-foundry-dist-"));

    await expect(downloadTo(secretUrl, join(dir, "foundry.zip"), fetchImpl)).rejects.toThrow(
      /Foundry download failed/,
    );

    try {
      await downloadTo(secretUrl, join(dir, "foundry.zip"), fetchImpl);
    } catch (error) {
      expect(error.message).not.toContain(user);
      expect(error.message).not.toContain(pass);
      expect(error.message).not.toContain("p%40ss");
      expect(String(error.cause ?? "")).not.toContain(user);
    }
  });

  it("refuses an https to http redirect", async () => {
    const calls = [];
    const fetchImpl = async (url, init) => {
      calls.push({ url, init });
      return httpResponse({ status: 302, location: "http://cache.example/next.zip" });
    };
    const dir = await mkdtemp(join(tmpdir(), "pivot-foundry-dist-"));

    let message = "";
    try {
      await downloadTo(secretUrl, join(dir, "foundry.zip"), fetchImpl);
    } catch (error) {
      message = error.message;
    }

    expect(message).toMatch(/https to http/);
    expect(message).not.toContain(user);
    expect(message).not.toContain(pass);
    expect(calls).toHaveLength(1);
  });

  it("redacts credentials in describeUrl", () => {
    expect(describeUrl(secretUrl)).toBe("https://cache.example/<redacted>");
    expect(describeUrl(secretUrl)).not.toContain(user);
    expect(describeUrl(secretUrl)).not.toContain(pass);
  });
});
