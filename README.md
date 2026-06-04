# StreakWar — React Native (Expo) app

A full React Native port of the StreakWar redesign. Real components, real
navigation, real Saira typography — open it in VS Code, run it, and keep
building. **Engar jpeg myndir** — allt er teiknað í kóða (SVG ikon, litir, leturgerðir).

---

## 🇮🇸 Íslenska

### Hvað er þetta?
Þetta er **alvöru React Native verkefni** (Expo) — ekki bara myndir. Allir 16
skjáirnir úr hönnuninni eru hér sem React Native íhlutir (`<View>`, `<Text>`,
`<TouchableOpacity>` …) með réttu útliti: dökkblár + appelsínugulur, Saira
leturgerðin, og öll ikonin teiknuð með `react-native-svg`.

### Keyra appið
Þú þarft [Node.js](https://nodejs.org) (18+) uppsett.

```bash
cd streakwar-app
npm install
npx expo start
```

Svo:
- Ýttu á **i** fyrir iOS hermi (þarf Xcode á Mac), **a** fyrir Android, eða **w** fyrir vafra.
- Eða skannaðu QR kóðann með **Expo Go** appinu í símanum þínum (fljótlegast).

Ef `npm install` kvartar yfir útgáfum, keyrðu:
```bash
npx expo install --fix
```
Það stillir alla pakka að réttri Expo útgáfu sjálfkrafa.

### Hvar á að breyta hlutum
- **Litir / leturgerð:** `src/theme.js` (allir litir í `C`, leturhjálpin `f()`).
- **Ikon:** `src/components/Icon.js`.
- **Sameiginlegir íhlutir (takkar, spjöld, reitir):** `src/components/ui.js`.
- **Hver skjár:** `src/screens/` (t.d. `Home.js`, `Challenges.js`, `Profile.js`).
- **Prufugögn:** `src/data.js` — skiptu þessu út fyrir alvöru API þegar þú ert tilbúin/n.

---

## 🇬🇧 English

### What this is
A complete **React Native (Expo)** project — not screenshots. All 16 screens of
the redesign are real RN components with the exact look: deep-navy + orange
theme, the Saira typeface, and every icon drawn with `react-native-svg`.

### Run it
You need [Node.js](https://nodejs.org) (18+).

```bash
cd streakwar-app
npm install
npx expo start
```

Then press **i** (iOS simulator, needs Xcode on macOS), **a** (Android emulator),
or **w** (web). Or scan the QR code with the **Expo Go** app on your phone — the
fastest way to see it live.

If `npm install` complains about versions:
```bash
npx expo install --fix
```
This pins every package to the version that matches your Expo SDK.

### Project structure
```
streakwar-app/
├─ App.js                     # entry — loads Saira fonts, mounts the app
├─ app.json                   # Expo config (name, dark theme)
├─ src/
│  ├─ theme.js                # colors (C), alpha helper a(), font helper f()
│  ├─ data.js                 # mock data (DB) — swap for your real API
│  ├─ components/
│  │  ├─ Icon.js              # full icon set (react-native-svg)
│  │  ├─ ui.js                # Btn, Card, Avatar, Tag, Field, Sheet, Modal …
│  │  ├─ ChallengeRow.js      # shared challenge list row
│  │  ├─ PostCard.js          # shared feed post + reactions
│  │  └─ Celebration.js       # confetti overlay after logging a workout
│  ├─ screens/                # one file per area (Auth, Home, Challenges, …)
│  └─ navigation/
│     └─ AppNavigator.js      # custom stack + bottom tab bar
```

### Where to customize
- **Colors / type:** `src/theme.js` — every color lives in `C`, fonts via `f('ui'|'disp', weight, size)`.
- **Icons:** `src/components/Icon.js`.
- **Shared UI:** `src/components/ui.js`.
- **Each screen:** `src/screens/`.
- **Data:** `src/data.js` is mock data; replace it with your backend calls.

### Notes on the port
- The original web prototype used CSS that React Native handles differently. These
  were translated faithfully:
  - `linear-gradient` → `expo-linear-gradient` (via the `Grad` helper in `ui.js`).
  - `box-shadow` / glows → RN `shadow*` + `elevation`.
  - CSS `font:` shorthand → the `f()` helper in `theme.js`.
  - SVG icons → `react-native-svg`.
- A couple of decorative effects (CSS blur glows, repeating-stripe photo
  placeholders) are approximated, since RN has no cheap blur. The look is intact;
  tune them in `ui.js` (`PhotoSlot`) and the gradient helpers if you want.
- Screen transitions use a light fade. Drop in `@react-navigation/native` later
  if you want native stack gestures — the screen components are already isolated.
```
