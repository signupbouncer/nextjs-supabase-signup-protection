// Sends a small wave of signups to your local Supabase, the way a signup script does: five burner addresses, then
// one fresh Gmail address that stands in for a real person. It prints what Supabase Auth answered for each one.
//
//   npm run bot-wave
//
// It reads NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY from .env.local, and refuses any
// Supabase URL that is not on your own machine, so it can't be pointed at someone else's project.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
const host = URL.canParse(url) ? new URL(url).hostname : "";
if (!["localhost", "127.0.0.1", "[::1]"].includes(host)) {
  console.error(`bot-wave: refusing "${url}". It only sends signups to a Supabase on localhost or 127.0.0.1.`);
  process.exit(1);
}

// #region bot-wave
const tag = Math.random().toString(36).slice(2, 8);
const burners = ["mailinator.com", "sharklasers.com", "yopmail.com", "guerrillamail.com", "maildrop.cc"];
const signups = [...burners.map((domain, i) => `wave${i + 1}-${tag}@${domain}`), `real.person.${tag}@gmail.com`];

const supabase = createClient(url, key, { auth: { persistSession: false } });
for (const email of signups) {
  const { data, error } = await supabase.auth.signUp({ email, password: `wave password ${tag}` });
  if (error) {
    console.log(`${email.padEnd(34)} failed: ${error.message} (HTTP ${error.status})`);
  } else {
    const emailed = data.user?.confirmation_sent_at ? ", confirmation email sent" : "";
    console.log(`${email.padEnd(34)} account created${emailed}`);
  }
}
// #endregion
