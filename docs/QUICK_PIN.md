# AGENT — optional four-digit quick unlock

This is an **opt-in local screen privacy lock** for users who **already have**
a valid Supabase AGENT session. It is NOT a passwordless sign-in, recovery
credential, authentication factor, server authorization rule or MFA solution.

## How it works

1. Log in through the existing AGENT email link or email/password flow.
2. In the AGENT workspace header, choose **تفعيل رمز ٤ أرقام**.
3. Set and confirm a four-digit code. The browser stores a per-user salted
   PBKDF2-SHA256 verifier, *not* the actual PIN or a Supabase credential.
4. Refresh/open the same browser while the Supabase session is still valid.
   The local interface asks for the PIN to uncover the workspace.
5. After five failed attempts the interface blocks PIN verification for
   fifteen minutes on that browser. A full sign-in remains available.
6. Use **قفل سريع** to lock the workspace at any time, or **إلغاء PIN** to
   disable the local lock for that user on this browser.

The underlying Supabase session (including expiry/revocation) and existing
server-side membership/RLS controls remain fully in force. The PIN cannot
refresh, recover, or create a session. An expired or revoked session must be
renewed by an approved Supabase sign-in method.

## Critical security limitations

A four-digit secret has only 10,000 combinations. This is **not** strong
authentication. Browser-local attempt limits and local storage can be
tampered with by anyone controlling that browser, and a verifier stored in
the browser could be attacked offline. Therefore, the implementation must
not be used as the sole defense for customer data or privileged operations.

The lock is meant to prevent *casual visibility* during brief device handoffs,
not to defend against a malicious user with access to browser developer tools
or a stolen session. The backend continues to require authenticated JWTs
and organization membership on each API call.

For a genuinely secure passwordless alternative for users with expired
sessions, implement **WebAuthn/passkeys** backed by a suitable auth provider.
The platform can then require device user verification (the OS may permit a
numeric device PIN), but an arbitrary four-digit web PIN alone must never
create a server session.

No database schema, production user records, existing support projects,
website widget credentials, or Meta integrations change in this PR.

## Testing

Run `npm run test:research`, `npm run build` and `npm run typecheck`.
Smoke-test setup, wrong PIN, lockout, page reload, sign-out, expired session,
same browser with another account, /crm login and both current website widgets.
