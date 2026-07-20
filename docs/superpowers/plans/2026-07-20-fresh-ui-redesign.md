# Akeso Fresh UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Akeso's template-like health UI with a distinctive cream, ink, and spring-green editorial interface while preserving all existing routes, state, and fixture-backed behavior.

**Architecture:** Keep `AppStateProvider`, domain contracts, services, and Expo Router unchanged. Build a small presentation layer around shared tokens, generated mascot assets, reusable motion wrappers, and a limited set of regular/freeform containers; screens compose those pieces without owning shared interaction behavior.

**Tech Stack:** Expo SDK 57, React Native 0.86, Expo Router 57, expo-image 57, React Native Reanimated 4.5, react-native-svg 15.15, TypeScript 6.

## Global Constraints

- Preserve all existing app state, service calls, route names, form fields, and domain types.
- Use generated bitmap assets from `apps/app/assets/images/akeso/`; do not redraw the mascot in SVG.
- Each screen gets one dominant visual focus; regular data containers alternate with freeform editorial focus areas.
- Animations complete within 450ms and must not block interaction.
- Support iOS, Android, and Web layouts from 320–560pt content width.
- Do not add new runtime dependencies.

---

### Task 1: Brand assets and design foundation

**Files:**
- Create: `apps/app/src/components/mascot.tsx`
- Create: `apps/app/src/components/ui/reveal.tsx`
- Modify: `apps/app/src/theme/tokens.ts`
- Modify: `apps/app/src/components/ui/card.tsx`
- Modify: `apps/app/src/components/ui/buttons.tsx`
- Modify: `apps/app/src/components/ui/chips.tsx`
- Modify: `apps/app/src/components/ui/screen.tsx`

**Interfaces:**
- Produces: `Mascot({ state, size }: { state: 'high' | 'steady' | 'low' | 'celebrate'; size?: number })`
- Produces: `Reveal({ children, delay?, distance? }: RevealProps)`
- Produces: `Card` tones `surface | ink | green | blue | yellow | coral | quiet`

- [ ] **Step 1: Verify generated assets**

Run:
```bash
file apps/app/assets/images/akeso/*.png
```
Expected: four RGBA PNG images named `mascot-high`, `mascot-steady`, `mascot-low`, and `mascot-celebrate`.

- [ ] **Step 2: Implement shared mascot and motion interfaces**

Use static `require()` sources so Metro bundles every asset:
```tsx
const sources = {
  high: require('../../assets/images/akeso/mascot-high.png'),
  steady: require('../../assets/images/akeso/mascot-steady.png'),
  low: require('../../assets/images/akeso/mascot-low.png'),
  celebrate: require('../../assets/images/akeso/mascot-celebrate.png'),
} as const
```

`Reveal` uses `FadeInUp.duration(360).delay(delay).springify().damping(18)` from Reanimated and renders an `Animated.View`.

- [ ] **Step 3: Replace tokens and shared primitives**

Use this palette as the single source of truth:
```ts
const palette = {
  cream: '#F6F5E8', ink: '#1F211D', green: '#55AE61',
  greenDark: '#2E6F43', lime: '#C9F227', blue: '#B7DDF4',
  yellow: '#F4E784', coral: '#F6A58C', white: '#FFFDF4',
}
```
Cards use 1.5px ink/soft borders and short shadows; primary buttons use ink with lime/green active treatment; chips use filled selected states instead of blue outlines.

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: exit code 0.

### Task 2: Navigation and Today dashboard

**Files:**
- Modify: `apps/app/src/app/(tabs)/_layout.tsx`
- Modify: `apps/app/src/app/(tabs)/index.tsx`
- Modify: `apps/app/src/components/energy/energy-ring.tsx`
- Modify: `apps/app/src/components/energy/energy-curve.tsx`
- Modify: `apps/app/src/components/energy/factor-row.tsx`
- Modify: `apps/app/src/components/coach-card.tsx`
- Modify: `apps/app/src/components/home/checkin-prompt.tsx`
- Modify: `apps/app/src/components/home/nutrition-snapshot.tsx`

**Interfaces:**
- Consumes: `Mascot`, `Reveal`, expanded `Card` tones, unchanged `useAppState()`.
- Produces: magazine-style Today screen preserving refresh and check-in navigation.

- [ ] **Step 1: Rebuild the Today hero**

The hero must contain score, band label, headline, mascot mapped from `energy.band`, and the update action. Use a lime freeform focus panel with an ink inset for the score; no centered ring-card layout.

- [ ] **Step 2: Restyle rhythm, factors, nutrition, and coach sections**

Keep all existing data rendering. Curve receives an animated path reveal, factors become a compact rule-separated list, nutrition becomes a blue editorial strip, and coach uses ink/cream contrast.

- [ ] **Step 3: Replace default tab bar styling**

Use a floating cream tab bar with rounded top corners, ink active pill, and concise labels; keep route names and Ionicons.

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: exit code 0.

### Task 3: Welcome and Check-in flow

**Files:**
- Modify: `apps/app/src/app/welcome.tsx`
- Modify: `apps/app/src/app/checkin.tsx`

**Interfaces:**
- Consumes: `Mascot`, `Reveal`, existing Button/ChipRow, unchanged state actions.
- Produces: poster-style onboarding and grouped check-in with animated progress.

- [ ] **Step 1: Rebuild Welcome**

Use a dark poster hero with the celebrate mascot partially overlapping a green organic panel. Preserve `step`, `name`, `goal`, `wake`, `sleep`, `diet`, `finish`, and navigation behavior exactly.

- [ ] **Step 2: Rebuild Check-in presentation**

Keep all questions on one scrollable route but visually group them into numbered editorial sections. Add a progress meter computed from the six required values and show the steady/celebrate mascot near the header/footer.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: exit code 0.

### Task 4: Plan timeline

**Files:**
- Modify: `apps/app/src/app/(tabs)/plan.tsx`
- Modify: `apps/app/src/components/plan/plan-block-card.tsx`
- Modify: `apps/app/src/components/plan/task-row.tsx`

**Interfaces:**
- Consumes: existing `DayPlan`, `Task`, `Button`, `CoachCard`.
- Produces: one continuous vertical energy rail with differentiated focus/recovery/meal blocks.

- [ ] **Step 1: Convert repeated cards to an energy rail**

Use time in a fixed left column, a colored rail/dot in the center, and content on the right. Focus blocks use ink or green fill; meals/recovery use yellow/blue/coral accents.

- [ ] **Step 2: Restyle regenerate and tasks**

Place regenerate in an editorial callout immediately after the rail. Keep scheduled and unscheduled filtering and every task row.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: exit code 0.

### Task 5: Nutrition editorial collage

**Files:**
- Modify: `apps/app/src/app/(tabs)/nutrition.tsx`
- Modify: `apps/app/src/components/nutrition/meal-card.tsx`
- Modify: `apps/app/src/components/nutrition/nutrient-bar.tsx`

**Interfaces:**
- Consumes: unchanged `NutritionPlan`, `Mode`, and local segment state.
- Produces: collage-like food view with accurate values and retained mode switching.

- [ ] **Step 1: Rebuild nutrition header and segment control**

Use an asymmetrical green/cream hero and ink segment control. Preserve `fridge` and `needs` mode behavior.

- [ ] **Step 2: Restyle needs and meals**

Needs stay regular and scan-friendly; meal recommendations alternate background color and alignment. Preserve all titles, descriptions, tags, prep time, and fridge-derived data.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: exit code 0.

### Task 6: End-to-end verification and visual QA

**Files:**
- Modify only files with verified defects found during this task.

**Interfaces:**
- Consumes: all redesigned screens.
- Produces: verified build with no overflow or state regressions.

- [ ] **Step 1: Run static verification**

Run:
```bash
npm run typecheck
npm run lint --workspace=apps/app
```
Expected: both commands exit 0.

- [ ] **Step 2: Start Expo web and capture key routes**

Run: `npm run app:web`
Expected: Expo reports a local web URL and compiles without runtime errors.

- [ ] **Step 3: Inspect core states**

Verify Welcome, Check-in, Today, Plan, and Nutrition at mobile width. Confirm tab bar does not cover content, generated PNG edges are clean on cream/ink/colored backgrounds, and all actions remain reachable.

- [ ] **Step 4: Review diff**

Run:
```bash
git diff --check
git status --short
```
Expected: no whitespace errors; only intentional redesign files and pre-existing user changes are listed.
