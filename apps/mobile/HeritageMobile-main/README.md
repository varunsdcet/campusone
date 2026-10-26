# HeritageMobile — Heritage Community College (Student + Instructor)

Bare React Native 0.87.1 (TypeScript, React Native Community CLI 20.2.0) frontend for Heritage Community College, built from the supplied Student (43) and Instructor (38) reference images. One codebase, one app, two experiences (Student and Instructor), running end-to-end against a **persistent local mock repository** — no backend, no API keys, no paid services. Everything is synthetic demo data.

- Docs: `docs/SCREEN_COVERAGE.md` (all 81 references), `docs/NAVIGATION_MAP.md`, `docs/DESIGN_DECISIONS.md`, `docs/API_HANDOFF.md`, `docs/QA_REPORT.md`.
- Target: iPhone 17 Pro Max (simulator verified); code is cross-platform but only iOS was built and tested.

## Demo credentials

| Role | Login | Password |
|---|---|---|
| Student (Marcus Vance, ST-2024-001) | `ST-2024-001` | `Heritage2026!` |
| Student (Priya Sandhu) | `ST-2024-014` | `Heritage2026!` |
| Instructor (Monica Dahiya, extended registry demo flags on) | `monica.dahiya@heritage.edu` | `Heritage2026!` |

The role switch on the login screen and the **Developer gallery** (Login screen → "Developer gallery", Profile/More → "Developer gallery & scenarios") are demo/developer controls, not production authorization. The gallery also provides deterministic service scenarios (slow, error, permission denied, empty), the demo clock (+1/+7 days, learning jumps) and the confirmed **Reset Demo Data** action.

## Environment used

| Tool | Version |
|---|---|
| macOS / Xcode | 26.2 / Xcode 26.5 (17F42), iOS 26.5 simulators |
| Node | v25.3.0 (`engines: node >= 22.11`); Node 20 also works for scripts |
| npm | 11.7.0 |
| Ruby / Bundler / CocoaPods | 4.0.6 / 4.0.16 / 1.17.0 (via `bundle exec`) |
| React Native / React | 0.87.1 / 19.2.3 (new architecture, Hermes) |
| Watchman | not installed (Metro works without it) |

Key dependencies (pinned in `package.json` + `package-lock.json`; native pods in `ios/Podfile.lock`): `@react-navigation/native@7.5`, `native-stack@7.20`, `bottom-tabs@7.20`, `react-native-screens@4.28`, `react-native-safe-area-context@5.5`, `@tanstack/react-query@5.104`, `zustand@5.0`, `@react-native-async-storage/async-storage@3.1`, `react-hook-form@7.89`, `zod@4.6`, `@hookform/resolvers@5.9`, `@react-native-documents/picker@12` + `viewer@4`, `@dr.pogodin/react-native-fs@2.40`, `@react-native-community/datetimepicker@9.2`, `react-native-svg@15.15`, `lucide-react-native@1.53`. Dev: Jest 29 + `@testing-library/react-native@14.1`, Maestro 2.11 for e2e.

## Setup and run (verified commands)

```bash
# 1. JS dependencies
npm install

# 2. Ruby gems (CocoaPods) — one time
bundle install

# 3. iOS pods
cd ios && bundle exec pod install && cd ..

# 4. Metro (Debug builds load JS from Metro)
npm start

# 5. Build + run on the iPhone 17 Pro Max simulator (another terminal)
npm run ios -- --simulator="iPhone 17 Pro Max"
# or by UDID (recommended when names are ambiguous):
npx react-native run-ios --udid 384B0841-A9EA-4273-9388-FAB511EF8B3B
```

Discover simulators with `xcrun simctl list devices available`. If "iPhone 17 Pro Max" is missing, install the iOS runtime from Xcode → Settings → Components and create the device in Xcode → Window → Devices and Simulators.

Alternative without the CLI (what the QA run used):

```bash
cd ios && xcodebuild -workspace HeritageMobile.xcworkspace -scheme HeritageMobile -configuration Debug \
  -sdk iphonesimulator -destination 'id=384B0841-A9EA-4273-9388-FAB511EF8B3B' -derivedDataPath build build
xcrun simctl install 384B0841-A9EA-4273-9388-FAB511EF8B3B ios/build/Build/Products/Debug-iphonesimulator/HeritageMobile.app
xcrun simctl launch 384B0841-A9EA-4273-9388-FAB511EF8B3B org.reactjs.native.example.HeritageMobile
```

Release (self-contained, bundled `main.jsbundle`, no Metro) for the simulator — verified:

```bash
cd ios && xcodebuild -workspace HeritageMobile.xcworkspace -scheme HeritageMobile -configuration Release \
  -sdk iphonesimulator -destination 'id=384B0841-A9EA-4273-9388-FAB511EF8B3B' -derivedDataPath build build
```

## Scripts

| Script | What it does |
|---|---|
| `npm start` | Metro bundler |
| `npm run ios` | Build + run Debug on a simulator |
| `npm test` | Jest unit + component tests (`tests/`) |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Type check |
| `bash e2e/run-all.sh [udid]` | Maestro e2e suite (9 flows) against the app installed on a simulator — run it on a **fresh install** (`xcrun simctl uninstall` first); needs Java 17+ and Maestro on PATH; see `e2e/helpers.sh` |
| `bash e2e/open.sh <name> <steps.yaml>` | Runs an ad-hoc Maestro step file and saves `docs/qa/screenshots/<name>.png` (used for the screenshot pass) |

## Physical iPhone 17 Pro Max (not performed — needs your Apple account)

Requirements: Xcode 26.x with an iOS runtime matching the phone (the phone reports iOS 26.6 — Xcode 26.5 may need the iOS 26.6 device-support files; update Xcode if the device shows "unsupported OS version"), a free or paid Apple Developer team, and a USB cable (or same Wi‑Fi for wireless debugging).

1. Connect the phone, unlock it, tap **Trust This Computer**.
2. On the phone enable **Settings → Privacy & Security → Developer Mode** (reboot when asked).
3. Open `ios/HeritageMobile.xcworkspace` in Xcode → target **HeritageMobile** → **Signing & Capabilities**: tick *Automatically manage signing*, pick **your Team**, and change the bundle identifier from the template value `org.reactjs.native.example.HeritageMobile` to something unique (e.g. `com.yourname.heritagemobile`).
4. Select your iPhone in the device picker and press **Run** (Debug), or in a terminal: `npx react-native run-ios --device "Akshat’s iPhone"`.
5. First launch: on the phone go to **Settings → General → VPN & Device Management** and trust your developer certificate.

Debug vs Release on the device:
- **Debug** loads the JavaScript bundle from Metro on your Mac. The phone must reach the Mac over the network: do **not** use `localhost`. Either run `npx react-native run-ios --device` (the CLI sets the Mac's LAN IP via the dev menu settings) or shake the device → *Dev Settings → Debug server host & port* and enter `<your-Mac-LAN-IP>:8081`. Both devices must be on the same Wi‑Fi (or use USB with `xcrun` port forwarding not required for iOS; Wi‑Fi is simplest).
- **Release** (scheme → Edit Scheme → Run → Build Configuration *Release*, or `npx react-native run-ios --device --mode Release`) embeds `main.jsbundle` and the sample files, so the app runs fully offline. Local-only demo mode needs no network at all; airplane mode does not disable anything.

I could not request your Apple ID/password and did not attempt signing or provisioning; the project still carries the template bundle id and no team.

## Android

An `android/` project exists from the template (not built or tested here). Fonts and sample files are linked for Android too (`react-native.config.js`), but no Android verification was performed.

## Project layout

```
src/
  app/            App.tsx, providers, query client, query keys
  config/         appConfig.ts (validated, mock|api), progressionPolicy.ts
  theme/          tokens, typography
  components/     shared native UI kit (Button, Card, Pill, Input, Select, BottomSheet, ...)
  navigation/     routes.ts, types.ts, permissions.ts, menus.ts, navigators, TabBar
  domain/         types.ts (all domain records)
  services/       contracts/ (typed interfaces), mock/ (persistent adapters), http/ (NOT_CONFIGURED skeleton + DTO mappers), errors.ts
  fixtures/       synthetic seed data (seed.ts assembles the DemoDb)
  storage/        Repository (AsyncStorage JSON document, schema version, migrations), key-value adapters
  state/          zustand session + UI stores
  features/       auth/, shared/, student/*, instructor/* (screens + feature hooks)
  dev/            Developer gallery & scenarios
assets/fonts, assets/samples   bundled fonts (OFL) and generated sample PDFs/PNG
tests/            Jest unit + component tests (mocks in tests/__mocks__)
e2e/              Maestro flows + run-all.sh
docs/             coverage, navigation, design decisions, API handoff, QA report, screenshots
```

## Mock vs API mode

`src/config/appConfig.ts` is the single configuration boundary. In `mock` mode every service is backed by `src/services/mock` on top of the persistent repository (`heritage.demo.db` in AsyncStorage, schema v1). In `api` mode `src/services/http` is used; every unimplemented method rejects with a typed `NOT_CONFIGURED` error. See `docs/API_HANDOFF.md` for the proposed contracts and how to wire endpoints without touching screens.
