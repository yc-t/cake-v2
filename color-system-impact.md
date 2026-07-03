# color-system-impact.md — Impact Analysis (Finalized)

Based on: color-system-spec.md Section 6
Codebase read: 2026-07-02
Decisions confirmed: 2026-07-02
Status: awaiting user confirmation before any code changes

## Confirmed Decisions
- `baseColor` type: hex string (e.g. `"#F4A6A0"`)
- Cake default color: `#fafaf8`
- Screen 1 gradient preview: small circles, count = actual flowers per type (rose ×6, hydrangea ×8, peony ×4, fivepetal ×4), each circle shows that flower's computed gradient color
- `colorFamilies.ts` renamed to `gradient.ts`

---

## List A — Dependency Scan

All locations that read or write: `primaryColorFamily`, `secondaryColorFamily`, `PRIMARY_TYPES`, `SECONDARY_TYPES`, `applyFamilyToTrayFlowers`, `handlePrimaryFamily`, `handleSecondaryFamily`, `PRESET_COLORS`.

### `primaryColorFamily`

| File | Location | What it does |
|------|----------|--------------|
| `src/types.ts:31` | `AppState` type | Declares field as `ColorFamily \| null` |
| `src/data/initialState.ts:78` | `initialState` object | Sets initial value to `null` |
| `src/App.tsx:126–128` | `handlePrimaryFamily()` | Writes via `setState` |
| `src/App.tsx:220` | JSX | Passes `state.primaryColorFamily` as `primary` prop to `<ColorFamilyPicker>` |
| `src/components/ColorFamilyPicker.tsx:5` | `Props` interface | Declares `primary: ColorFamily \| null` |
| `src/components/ColorFamilyPicker.tsx:81` | `<FamilyRow>` render | Reads as `selected` to control active ring state |

### `secondaryColorFamily`

| File | Location | What it does |
|------|----------|--------------|
| `src/types.ts:32` | `AppState` type | Declares field as `ColorFamily \| null` |
| `src/data/initialState.ts:79` | `initialState` object | Sets initial value to `null` |
| `src/App.tsx:133–136` | `handleSecondaryFamily()` | Writes via `setState` |
| `src/App.tsx:221` | JSX | Passes `state.secondaryColorFamily` as `secondary` prop to `<ColorFamilyPicker>` |
| `src/components/ColorFamilyPicker.tsx:6` | `Props` interface | Declares `secondary: ColorFamily \| null` |
| `src/components/ColorFamilyPicker.tsx:83` | `<FamilyRow>` render | Reads as `selected` to control active ring state |

### `PRIMARY_TYPES`

| File | Location | What it does |
|------|----------|--------------|
| `src/App.tsx:81` | Module-level constant | Defined as `['rose', 'peony']` |
| `src/App.tsx:127` | `handlePrimaryFamily()` | Passed to `applyFamilyToTrayFlowers` as the `types` argument |

### `SECONDARY_TYPES`

| File | Location | What it does |
|------|----------|--------------|
| `src/App.tsx:82` | Module-level constant | Defined as `['hydrangea', 'fivepetal']` |
| `src/App.tsx:134` | `handleSecondaryFamily()` | Passed to `applyFamilyToTrayFlowers` as the `types` argument |

### `applyFamilyToTrayFlowers`

| File | Location | What it does |
|------|----------|--------------|
| `src/App.tsx:85–102` | Function definition | Takes `flowers / types / family`, calls `computeGradient`, returns updated flowers array (tray-only flowers only) |
| `src/App.tsx:127` | `handlePrimaryFamily()` | Called with `PRIMARY_TYPES` |
| `src/App.tsx:134` | `handleSecondaryFamily()` | Called with `SECONDARY_TYPES` |

### `handlePrimaryFamily`

| File | Location | What it does |
|------|----------|--------------|
| `src/App.tsx:123–129` | Function definition | Receives a `ColorFamily`, writes `primaryColorFamily`, calls `applyFamilyToTrayFlowers` |
| `src/App.tsx:223` | JSX | Passed as `onPrimaryChange` prop to `<ColorFamilyPicker>` |

### `handleSecondaryFamily`

| File | Location | What it does |
|------|----------|--------------|
| `src/App.tsx:131–137` | Function definition | Receives a `ColorFamily`, writes `secondaryColorFamily`, calls `applyFamilyToTrayFlowers` |
| `src/App.tsx:224` | JSX | Passed as `onSecondaryChange` prop to `<ColorFamilyPicker>` |

### `PRESET_COLORS`

| File | Location | What it does |
|------|----------|--------------|
| `src/data/colors.ts:12–19` | Constant definition | Array of 6 preset colors (粉紅/白/奶油黃/淺紫/珊瑚橘/莫蘭迪綠) |
| `src/App.tsx:7` | Import statement | Imports from `colors.ts` |
| `src/App.tsx:16` | `CAKE_COLORS` constant | `[CAKE_DEFAULT_COLOR, ...PRESET_COLORS]` — used for cake picker |
| `src/App.tsx:256` | JSX | Passed as `colors` prop to flower `<ColorPicker>` |
| `src/App.tsx:269` | JSX | Passed as `colors` prop to cake `<ColorPicker>` (via `CAKE_COLORS`) |

---

## List B — Removal Plan

### Delete entire files

| File | Reason |
|------|--------|
| `src/components/ColorFamilyPicker.tsx` | Entire component is the old primary/secondary picker UI — fully replaced by Screen 1 |
| `src/components/ColorPicker.tsx` | Single-row swatch UI needs complete rewrite as two-row layout; old structure not reusable |
| `src/data/colors.ts` | After removing `PRESET_COLORS` and `CAKE_DEFAULT_COLOR`, file is empty; palette responsibility moves to new `palette.ts` |
| `src/data/colorFamilies.ts` | Renamed to `gradient.ts` (delete old file, create new one) |

### Delete specific code within files

**`src/types.ts`**
- Remove `ColorFamily` type (line 3)
- Remove `primaryColorFamily: ColorFamily | null` from `AppState` (line 31)
- Remove `secondaryColorFamily: ColorFamily | null` from `AppState` (line 32)

**`src/data/initialState.ts`**
- Remove `primaryColorFamily: null` (line 78)
- Remove `secondaryColorFamily: null` (line 79)

**`src/App.tsx`**
- Remove imports: `PRESET_COLORS`, `CAKE_DEFAULT_COLOR` (line 7)
- Remove import: `computeGradient` (line 8)
- Remove import: `ColorFamily` type (line 9)
- Remove import: `ColorFamilyPicker` (line 12)
- Remove `CAKE_COLORS` constant (line 16)
- Remove `PRIMARY_TYPES` constant (line 81)
- Remove `SECONDARY_TYPES` constant (line 82)
- Remove `applyFamilyToTrayFlowers()` function (lines 85–102)
- Remove `handlePrimaryFamily()` function (lines 123–129)
- Remove `handleSecondaryFamily()` function (lines 131–137)
- Remove `<ColorFamilyPicker ... />` JSX (lines 220–225)
- Remove flower `<ColorPicker colors={PRESET_COLORS} ... />` (lines 254–265) — replaced by `<FlowerColorPicker>`
- Remove cake `<ColorPicker colors={CAKE_COLORS} ... />` (lines 267–278) — replaced by updated version using `PALETTE`

---

## List C — Creation / Modification Plan

### New files to create

**`src/data/palette.ts`**
- Export `PALETTE`: array of 7 objects `{ name: string, hex: string, rgb: [number, number, number] }`
- Export `CAKE_NEAR_WHITE`: `{ name: '近白', hex: '#fafaf8', rgb: [0.980, 0.996, 0.973] }` — 8th option in cake picker only
- Colors:
  | Name | Hex |
  |------|-----|
  | 桃粉 | #F4A6A0 |
  | 珊瑚桃 | #F5B993 |
  | 奶油黃 | #F3D98B |
  | 薰衣草紫 | #C3A6DD |
  | 花園藍 | #8FB8D9 |
  | 酒紅 | #A64D5F |
  | 暖白 | #F4EFE9 |

**`src/data/gradient.ts`** (replaces `colorFamilies.ts`)
- Keep internal helpers `hue2rgb`, `hslToRgb`
- Add `hexToHsl(hex: string): [number, number, number]`
- Rewrite `computeGradient(baseHex: string, count: number): [number, number, number][]`
  - Convert hex → HSL
  - Fix H and S from base color
  - Distribute L from baseL to baseL + (count − 1) × 5%, clamped to [0, 100]
  - Return RGB tuples from darkest to lightest
- No more `ColorFamily`, `COLOR_FAMILIES`, `FAMILY_ORDER`

**`src/components/Screen1.tsx`**
- Has its own `<Canvas>` with fixed camera (no OrbitControls, no user rotation/pan/zoom)
- Renders actual 3D flower models (Rose, Hydrangea, Peony, FivePetal components) grouped by type — NOT abstract shapes or icons
- No cake, no board in the scene
- 4 flower groups arranged by type, each visually distinct and labeled
- Flowers within each group arranged in their natural grid layout (same positions as in tray, camera adjusted to frame them)
- DOM overlay: transparent div drop targets positioned over each group area in screen space
- 7 draggable color swatches rendered as DOM elements (not in canvas)
- Drag-to-assign: HTML drag-and-drop — swatch dragstart, group div ondrop → `onColorAssign(type, hex)` → `computeGradient` → flowers update color in real time
- Same color can be assigned to multiple groups; reassigning replaces previous assignment
- Unassigned groups: flowers remain #F4EFE9 (暖白)
- Hint text "把顏色拖到花上" fades out after first successful drag
- "開始" button (always enabled, DOM element) → calls `onStart()`
- Props: `typeColorMap`, `flowers`, `onColorAssign`, `onStart`

**`src/components/FlowerColorPicker.tsx`**
- Screen 2 per-flower color picker, two-row pill layout (bottom center, same position as old `ColorPicker`)
- Row 1 (conditional, only if `flower.baseColor !== null`): 5 gradient swatches derived from `flower.baseColor` via `computeGradient`
- Row 2: 7 `PALETTE` color circles (always shown)
- Selecting Row 1 → updates only this flower's `color` (specific shade), `baseColor` unchanged
- Selecting Row 2 → updates this flower's `baseColor` to new hex and `color` to the mid-point shade of the new family; applies to this flower only (not the whole group)
- Props: `flower`, `onShadeChange`, `onFamilyChange`

### Existing files to modify

**`src/types.ts`**
- Remove: `ColorFamily` type, `primaryColorFamily`, `secondaryColorFamily` from `AppState`
- Add to `Flower`: `baseColor: string | null` — hex of assigned palette color, null if unassigned
- Add to `AppState`:
  - `typeColorMap: Record<FlowerType, string | null>` — per-type base color from Screen 1 assignment
  - `currentScreen: 'screen1' | 'screen2'`

**`src/data/initialState.ts`**
- Remove: `primaryColorFamily: null`, `secondaryColorFamily: null`
- Add to `initialState`: `typeColorMap: { rose: null, hydrangea: null, peony: null, fivepetal: null }`
- Add to `initialState`: `currentScreen: 'screen1'`
- Add to each `Flower` initial object: `baseColor: null`
- Update default flower colors: all flowers start as `color: [0.957, 0.937, 0.914]` (= #F4EFE9, 暖白 default)
- Update cake default color to `#fafaf8` = `[0.980, 0.996, 0.973]`

**`src/App.tsx`**
- Remove all old color system code (see List B)
- Add screen routing: render `<Screen1 .../>` when `state.currentScreen === 'screen1'`; render 3D canvas + controls when `state.currentScreen === 'screen2'`
- Add `handleColorAssign(type: FlowerType, hex: string)`:
  - Updates `typeColorMap[type]`
  - Runs `computeGradient(hex, count)` for all flowers of that type
  - Updates each flower's `color` and `baseColor`
  - Only affects tray flowers (not flowers already placed on cake — consistent with old behavior)
- Add `handleStart()`: sets `currentScreen: 'screen2'`
- Update `handleReset()`: resets to `initialState` (which now has `currentScreen: 'screen1'`) — returns to Screen 1 automatically
- Replace flower `<ColorPicker>` with `<FlowerColorPicker flower={selectedFlower} .../>`
- Update cake color picker: use `[...PALETTE, CAKE_NEAR_WHITE]` instead of `CAKE_COLORS`
- Update import paths: `gradient.ts` instead of `colorFamilies.ts`

---

## Assumptions

1. **`Flower.color` field preserved** — all render code reads `flower.color` for material color. `baseColor` (hex string) is metadata for UI logic; `color` (RGB tuple) continues to drive rendering. Both coexist.

2. **`currentScreen` in `AppState`** — reset needs to return to Screen 1 inside `handleReset()` via `setState`. Keeping it in `AppState` means `handleReset()` can set it back to `'screen1'` by spreading `initialState`, which already has `currentScreen: 'screen1'`.

3. **Screen 1 unmounts the 3D canvas entirely** — `<Canvas>` is not rendered when `currentScreen === 'screen1'`. This avoids any Three.js initialization cost on load.

4. **`handleColorAssign` does not recolor flowers already on cake** — consistent with the old `applyFamilyToTrayFlowers` behavior (`!f.onCake` filter). Spec Section 7 says "flowers arrive pre-colored from Screen 1" which implies tray flowers only.

5. **`computeGradient` L increment: +5% per step** — spec uses this as the example value; treated as the implementation value until adjusted.

6. **Mid-point shade for Row 2 selection in Screen 2** — when a user picks a new family from Row 2, the flower's `color` is set to `computeGradient(hex, 5)[2]` (the middle of a 5-step gradient). This is a reasonable default; spec does not specify.
