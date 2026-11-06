# Premier AGENT Windows Companion (preview)

This is an opt-in remote desktop **command queue**, not a remote-access trojan and not an AI that autonomously controls a computer.

## Architecture
- AGENT /assistant/desktop: authenticated organization **admin** pairs/revokes devices, manually queues an allowlisted action, sees history.
- Windows companion: outbound HTTPS polling every five seconds; raw 256-bit device credential stays in RAM while the app is running. Every received command shows a **local confirmation** popup before it executes. Closing the app or pressing Stop disables polling. It never starts automatically with Windows.
- Supabase: two private tables `agent_desktop_devices` and `agent_desktop_jobs`; all client role grants revoked and RLS enabled. AGENT backend accesses them with a server-side service role key. The desktop app never receives any Supabase credentials.

## Before it can work
1. Apply `supabase/migrations/20261106_desktop_companion.sql` to **the AGENT** Supabase project `gldlgdycgneadbqftcrj` using the normal reviewed migration process. **Do not apply to Premier POS.**
2. Set `SUPABASE_SERVICE_ROLE_KEY` in the AGENT Vercel project's **server-only encrypted** environment variables. This secret must never be committed or prefixed with NEXT_PUBLIC_. Restrict access to the deployment team.
3. Deploy the AGENT branch to a trusted environment. The desktop app currently pins `BASE_URL` to `https://premieros-ai-sales-agent.vercel.app`; for a preview test, a developer must explicitly update the trusted host in the source code and rebuild a new EXE. Never point device tokens to untrusted sites.
4. Build a Windows executable with GitHub Actions workflow `Windows Companion EXE` (pull request or manual workflow dispatch), or locally on a Windows machine:
   ```powershell
   py -3.12 -m venv .venv
   .\.venv\Scripts\python -m pip install -r windows-companion\requirements.txt
   .\.venv\Scripts\python -m PyInstaller --noconfirm --onefile --windowed --name PremierAgentCompanion windows-companion\companion.py
   ```
   The EXE will appear at `dist\PremierAgentCompanion.exe`. Do not distribute before reviewing/signing the binary and scanning it with antivirus.
5. Sign in as organization admin at `/assistant/desktop`, create one device, copy its one-time credential, and paste it into the Windows companion. Press **Start receiving**.
6. Queue an action from the website, then approve or reject it on Windows. Do not queue sensitive data in text commands.

## Supported actions
- `open_url`: opens an HTTPS URL in default browser.
- `click`: clicks an absolute coordinate on the active desktop; depends on current display geometry.
- `type_text`: pastes a provided string into the active field (replaces local clipboard).
- `hotkey`: types an allowlisted keyboard shortcut, e.g. `ctrl+l`.

**Not implemented:** reading the screen, live video, autonomous browser understanding/element selection, arbitrary shell commands, hidden execution, file exfiltration, unattended control, installer/signing, or software distribution.

## Limits and security
- Commands require a logged-in AGENT admin AND a second local desktop approval.
- The desktop token is shown once; if lost, revoke the device and create a new one.
- Up to 5 active devices per user and 10 queued jobs per device. Per-device token cannot see other devices/jobs.
- Stop receiving or closing the app stops fetching new commands; move cursor to a corner to trigger PyAutoGUI failsafe.
- Queue entries can remain in `running` if a client crashes. A future implementation should add cancellation/timeouts and job leases before broad rollout.
- Since `type_text` uses clipboard, do not use it for passwords, OTPs, credit cards, or private customer information.
- Local permission prompts may appear over applications. Use an isolated test machine first.

## Tests required before merging
- AGENT TypeScript check/build and existing tests.
- Windows EXE build artifact and manual smoke test: pairing, invalid token, revoke, open URL, reject click, approve click, repeat polling, Stop, restart.
- Verify authorization isolation across at least two organizations.
- Review Supabase Security Advisor, Vercel environment settings, and access logs.
