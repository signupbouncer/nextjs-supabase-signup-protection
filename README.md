# Next.js and Supabase starter with signup protection

The official Next.js and Supabase starter
([vercel/next.js `examples/with-supabase`](https://github.com/vercel/next.js/tree/canary/examples/with-supabase)),
with signupbouncer's Before User Created hook in its local Supabase config. The hook refuses burner addresses and
repeat signups before Supabase creates the user or sends a confirmation email.

The walkthrough is
[Keep burner signups from using up your Supabase email limit](https://signupbouncer.com/guides/supabase-bot-signups).

## What it adds to the starter

| File | Change |
| --- | --- |
| `supabase/config.toml` | Local Supabase config (from `supabase init`, CLI 2.121.0) with the `[auth.hook.before_user_created]` block, email confirmation on, Auth email sent to Mailpit over SMTP so the hourly email limit applies, and the starter's confirmation and password reset email templates. |
| `supabase/.env.example` | The two hook values: your signupbouncer hook URL and hook secret. |
| `supabase/templates/` | Email templates that link to the starter's `/auth/confirm` route (from the Supabase UI library docs). |
| `scripts/bot-wave.mts` | `npm run bot-wave`: five burner signups and one fresh Gmail signup against your local Supabase. It refuses any other Supabase URL. |
| `components/sign-up-form.tsx` | Region comments only. The form already shows `error.message`, which is the hook's message when a signup is refused. |
| `package.json` | Exact versions instead of `latest` and `^` ranges, plus the scripts and test packages. |
| `test/` | Offline tests (`npm test`) and a live run against a running stack (`npm run test:live`). |

## Run it

You need Node 22.18 or later, Docker and the Supabase CLI.

```sh
git clone https://github.com/signupbouncer/nextjs-supabase-signup-protection
cd nextjs-supabase-signup-protection
npm install
cp supabase/.env.example supabase/.env
```

[Sign up for signupbouncer](https://signupbouncer.com/signup) (the Free plan needs no card), copy the Hook URL and Hook
secret from your app's Integration tab into `supabase/.env`, then:

```sh
supabase start
cp .env.example .env.local
```

Put the Project URL and the Publishable key from `supabase status` into `.env.local`, then `npm run dev` and open
http://localhost:3000. Confirmation emails land in Mailpit at http://localhost:54324.

New signupbouncer apps start in shadow mode, which logs every check and refuses nothing. Choose Enforce under Mode on
your app's Rules tab to refuse signups. `npm run bot-wave` shows the difference.

## Tests

```sh
npm test            # offline
npm run test:live   # needs local Supabase with the hook in Enforce mode, and a fresh hour of email
```

`test:live` reads `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `DATABASE_URL`, `MAILPIT_URL`
and, to follow the confirmation link through the app, `APP_URL`.

`next build` fetches the Geist font from Google Fonts, as the upstream starter does, so it needs internet access.

## Credits and license

Built from `vercel/next.js` `examples/with-supabase` at
[`b249055`](https://github.com/vercel/next.js/tree/b24905530cf93abd11067aa3fccfe4f10d89f083/examples/with-supabase).
The upstream README is kept as `README.upstream.md`. MIT license: see `LICENSE` (Vercel, Inc. and SignupBouncer).
