// End-to-end run against a running stack: local Supabase (this repo's supabase/ folder) with the signupbouncer hook
// in Enforce mode and a local signupbouncer API. Checks the article's end state:
//   1. a mailinator.com signup is refused with the hook's message, leaves no user and sends no email;
//   2. a fresh gmail.com signup creates an unconfirmed user and one confirmation email that links to /auth/confirm
//      (and, with APP_URL set, the link signs the user in and sends them on to /protected);
//   3. `npm run bot-wave` gets all five burner signups refused, creates no user for them and sends them no email.
// Uses two of the hour's emails (supabase/config.toml, email_sent = 2): start it on a fresh hour.
// Run: node test/live.mts (Node 22.18+ runs TypeScript directly). Env: NEXT_PUBLIC_SUPABASE_URL,
// NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, DATABASE_URL, MAILPIT_URL (default http://127.0.0.1:54324), APP_URL (optional).
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";
const APP = process.env.APP_URL;
const MESSAGE = process.env.EXPECTED_MESSAGE ?? "Please sign up with a permanent email address.";
const sql = postgres(process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres", {
  onnotice: () => {},
});

let failed = 0;
function check(label: string, ok: boolean, detail: unknown) {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"} ${label}: ${typeof detail === "string" ? detail : JSON.stringify(detail)}`);
}

const supabase = createClient(SUPABASE_URL, KEY, { auth: { persistSession: false } });
const users = async (emails: string[]) => {
  const rows = await sql`select email, email_confirmed_at is not null as confirmed from auth.users where email in ${sql(emails)}`;
  return rows as unknown as { email: string; confirmed: boolean }[];
};
type Message = { ID: string; To: { Address: string }[] };
const mails = async (emails: string[]) => {
  const res = await fetch(`${MAILPIT}/api/v1/messages?limit=500`);
  const { messages } = (await res.json()) as { messages: Message[] };
  return messages.filter((m) => m.To.some((t) => emails.includes(t.Address)));
};
const rand = Math.random().toString(36).slice(2, 8);

// 1. Burner address: refused by the hook, no user, no email.
const burner = `follow-${rand}@mailinator.com`;
{
  const { data, error } = await supabase.auth.signUp({ email: burner, password: "a long password 1" });
  check("1 burner refused with the hook's message", error?.message === MESSAGE && error?.status === 400 && !data.user, {
    email: burner,
    status: error?.status,
    message: error?.message,
  });
  check("1 burner left no user", (await users([burner])).length === 0, await users([burner]));
  check("1 burner got no email", (await mails([burner])).length === 0, { emails: (await mails([burner])).length });
}

// 2. Fresh gmail address: an unconfirmed user and one confirmation email linking to the starter's /auth/confirm.
const real = `follow.${rand}@gmail.com`;
{
  const { data, error } = await supabase.auth.signUp({
    email: real,
    password: "a long password 1",
    options: { emailRedirectTo: `${APP ?? "http://localhost:3000"}/protected` },
  });
  check("2 gmail signup created a user", !error && !!data.user, error?.message ?? { email: real });
  const u = await users([real]);
  check("2 the user waits for confirmation", u.length === 1 && !u[0].confirmed, u);
  const m = await mails([real]);
  check("2 one confirmation email", m.length === 1, { emails: m.length });
  if (m.length === 1) {
    const msg = await (await fetch(`${MAILPIT}/api/v1/message/${m[0].ID}`)).json();
    const link = String(msg.HTML ?? "").match(/href="([^"]*\/auth\/confirm\?[^"]*)"/)?.[1]?.replaceAll("&amp;", "&");
    check("2 the email links to /auth/confirm with a token_hash", !!link && link.includes("token_hash="), link ?? "no link");
    if (APP && link) {
      const url = new URL(link);
      const res = await fetch(new URL(url.pathname + url.search, APP), { redirect: "manual" });
      const cookies = res.headers.getSetCookie().filter((c) => c.startsWith("sb-"));
      check("2 the link signs the user in and goes on to /protected",
        res.status >= 300 && res.status < 400 && (res.headers.get("location") ?? "").endsWith("/protected") && cookies.length > 0,
        { status: res.status, location: res.headers.get("location"), cookies: cookies.length });
      check("2 the user is confirmed", (await users([real]))[0]?.confirmed === true, await users([real]));
    }
  }
}

// 3. The bot wave: five burners refused, none stored or emailed.
{
  const script = fileURLToPath(new URL("../scripts/bot-wave.mts", import.meta.url));
  const r = spawnSync(process.execPath, [script], {
    env: { PATH: process.env.PATH, NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: KEY },
    encoding: "utf8",
    timeout: 60_000,
  });
  const lines = r.stdout.trim().split("\n");
  const waveEmails = lines.map((l) => l.split(" ")[0]).filter((e) => e.startsWith("wave"));
  const refused = lines.filter((l) => l.startsWith("wave") && l.includes(`failed: ${MESSAGE} (HTTP 400)`));
  check("3 bot wave: five burner signups refused", r.status === 0 && waveEmails.length === 5 && refused.length === 5,
    r.stdout.trim() || r.stderr.trim());
  check("3 bot wave: no burner users", (await users(waveEmails)).length === 0, await users(waveEmails));
  check("3 bot wave: no burner emails", (await mails(waveEmails)).length === 0, { emails: (await mails(waveEmails)).length });
}

await sql.end();
console.log(failed ? `${failed} check(s) failed` : "all checks passed");
process.exit(failed ? 1 : 0);
