// The bot-wave script only ever sends signups to a Supabase on this machine. These runs fail before any request.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const script = fileURLToPath(new URL("../../scripts/bot-wave.mts", import.meta.url));

function run(url: string) {
  return spawnSync(process.execPath, [script], {
    // Only these variables, so nothing else from the caller's environment reaches the script.
    env: {
      NODE_ENV: "test",
      PATH: process.env.PATH,
      NEXT_PUBLIC_SUPABASE_URL: url,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x",
    },
    encoding: "utf8",
    timeout: 20_000,
  });
}

describe("bot-wave refuses anything but local Supabase", () => {
  for (const url of [
    "https://abcdefghijklmnop.supabase.co",
    "http://127.0.0.1.example.com:54321",
    "http://localhost@example.com",
    "not a url",
    "",
  ]) {
    it(`refuses ${JSON.stringify(url)}`, () => {
      const r = run(url);
      expect(r.status).toBe(1);
      expect(r.stderr).toContain("bot-wave: refusing");
      expect(r.stdout).toBe("");
    });
  }
});
