# A008-0209 — Electron first-run setup and Windows installer

Task ID: A008-0209
Status: Complete
Owner: Rickard (operator); A008 (implementation)

## Result

The existing Electron client now has Windows x64 installer configuration through Electron Forge/Squirrel and a post-install first-run setup overlay. The installer is configured as `A008-Setup.exe`; the command is:

```text
npm --prefix clients/electron run make:win32:x64
```

The unpacked package command remains:

```text
npm --prefix clients/electron run package:win32:x64
```

Setup covers:

- Neutral, Deep Space, Oldscool and Cyberpunk themes;
- host-owned write-only NVIDIA, OpenAI, kie.ai, OpenRouter, Groq, Gemini and OpenCode credentials;
- default chat and semantic models;
- user name and persistent custom instructions;
- parallel-session/worktree root;
- explicit `Use defaults` continuation;
- reopening from Edit → First-run setup.

No credentials are embedded in the installer, source, command arguments or logs. Existing Electron renderer security and host/session ownership remain unchanged.

## Verification

- Electron focused suite: **7/7 PASS**.
- Root typecheck/build and GUI typecheck/build: **PASS**.
- Focused onboarding tests: **2/2 PASS**.
- Full GUI suite: **234/235 PASS**; one pre-existing unrelated memory-map assertion expects the old `1 nodes` wording.
- `git diff --check`: **PASS**.
- Forge packaging completed the Windows x64 unpacked package at `clients/electron/out/A008-win32-x64` and resolved the Squirrel target. The final Squirrel artifact was not generated in this non-Windows environment because `electron-winstaller` requires Wine and Mono; run `npm --prefix clients/electron run make:win32:x64` on Windows to produce `A008-Setup.exe`.
- No provider calls or credentials; 0 SEK.

## Remaining separate work

Signing, publishing, auto-update and integration with provider account creation are intentionally out of scope.
