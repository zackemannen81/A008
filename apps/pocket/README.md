# A008 Pocket — experimental native Android client

A separate Expo/React Native shell for the existing A008 V2 SDK, not a forked engine or a webview. Nothing in this app modifies the A008 host, provider keys, memory store or main GUI.

## Current working scope

- Native dark A008-style Chat, Projects, Tools and Connection screens.
- V2 discovery, device credential stored in Android SecureStore, scoped project selection and authenticated WebSocket sessions through the existing `@a008/client` SDK.
- Streaming answer, explicit tool approval/denial, cancel, manual reconnect/resume and a visible uncertainty warning. **No automatic replay of unknown mutations.**
- Tools cards for ZeroCostRadar (already in A008), Mahguyver-Tools, Remote Gateway and Zero-Loss. The latter three are integration placeholders until independently authenticated APIs and capability checks exist; cards never pretend that an unavailable backend works.

## Important limitations

This is an experimental Stage-6 client, not a completed Stage-6 real-device proof. V2 sessions are not durable across host restarts. Mobile chat currently holds only the active session's visible transcript, not full V1 project conversation history. Do not expose A008 directly to the public internet: use an authenticated private tunnel or other reviewed HTTPS/WSS gateway with valid certificates. Device credentials are not provider keys; grant and revoke them locally on the A008 host. Never commit credentials.

## Build

From repository root: `npm ci && npm run build:client`. Then `cd apps/pocket && npm install && npm run typecheck && npx expo prebuild --platform android --non-interactive && cd android && ./gradlew assembleDebug` (Windows: `gradlew.bat assembleDebug`). For a standalone installable test APK, build `assembleRelease` instead of `assembleDebug`. The generated Expo release build embeds the JavaScript bundle and currently uses the generated Android debug signing key **only for testing**. The standalone APK appears at `apps/pocket/android/app/build/outputs/apk/release/app-release.apk`. A regular `assembleDebug` APK expects a running Metro development server and will show a red “Unable to load script” screen when installed by itself. Requires Android SDK and Java 17. Alternatively, the isolated GitHub Actions workflow builds a debug APK artifact on this experimental branch.

## Pairing

On the A008 host, use `npm run build && npm run device -- grant --name A008-Pocket --project PROJECT_ID --capability session`. Enter the host HTTPS origin, registered project ID and **device credential** in the app. Never paste an OpenAI/NVIDIA/provider API key. On an Android emulator the host's loopback address is different; use a reachable private HTTPS origin.
