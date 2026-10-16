// What the starter's sign-up form shows when Supabase Auth refuses a signup. The real supabase-js signUp() runs
// against a mocked fetch that answers exactly as local Supabase Auth (v2.197.0, CLI 2.121.0) did on 16 Oct 2026:
// a 400 when the signupbouncer hook refused a mailinator.com address, and a 429 once the hour's emails ran out.
// The form (components/sign-up-form.tsx) throws the error and shows `error instanceof Error ? error.message : ...`.
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

const MESSAGE = "Please sign up with a permanent email address.";

function clientAnswering(status: number, body: unknown) {
  const calls: string[] = [];
  const fetch = async (input: RequestInfo | URL) => {
    calls.push(String(input));
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  };
  const supabase = createClient("http://127.0.0.1:54321", "sb_publishable_test", {
    global: { fetch },
    auth: { persistSession: false },
  });
  return { supabase, calls };
}

// The same expression the starter's form uses in its catch block.
const shown = (error: unknown) => (error instanceof Error ? error.message : "An error occurred");

describe("sign-up answers the starter's form shows", () => {
  it("a hook refusal reaches the form as the hook's own message", async () => {
    const { supabase, calls } = clientAnswering(400, { code: 400, error_code: "unknown", msg: MESSAGE });
    const { data, error } = await supabase.auth.signUp({ email: "x@mailinator.com", password: "a long password" });
    expect(calls[0]).toBe("http://127.0.0.1:54321/auth/v1/signup");
    expect(error?.status).toBe(400);
    expect(shown(error)).toBe(MESSAGE);
    expect(data.user).toBeNull();
  });

  it("an hour with no emails left reaches the form as Supabase's rate-limit message", async () => {
    const { supabase } = clientAnswering(429, {
      code: 429,
      error_code: "over_email_send_rate_limit",
      msg: "email rate limit exceeded",
    });
    const { data, error } = await supabase.auth.signUp({ email: "jane@gmail.com", password: "a long password" });
    expect(error?.status).toBe(429);
    expect(shown(error)).toBe("email rate limit exceeded");
    expect(data.user).toBeNull();
  });

  it("a hook that refuses with a 400 status loses its message (supabase/auth#2235)", async () => {
    // What Auth v2.197.0 answered when a stand-in hook replied with HTTP 400 and an error object.
    const { supabase } = clientAnswering(500, {
      code: 500,
      error_code: "unexpected_failure",
      msg: "Invalid payload sent to hook",
    });
    const { data, error } = await supabase.auth.signUp({ email: "x@mailinator.com", password: "a long password" });
    expect(error?.status).toBe(500);
    expect(shown(error)).not.toBe(MESSAGE);
    expect(data.user).toBeNull();
  });
});
