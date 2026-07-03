# color-system-spec.md — 配色系統替換 Implementation Brief

## 1. Purpose

This document is the **implementation brief for this round only**. It defines exactly what to remove, what to build, and how the new color system should behave. It is not a long-term canonical product spec. Once the work described here is completed and verified, this document becomes a historical design reference.

## 2. Authority and References

### Source-of-truth rules for this round:

**Codebase** determines current-state facts. What exists in code is what exists — regardless of what any document says.

**This file (color-system-spec.md)** determines target behavior for this round. If this file contradicts the codebase, it means the codebase needs to change to match this file.

**v2-spec.md** is partially valid as background reference:
- VALID for reference: The section titled "V1 開發過程中的實際決定" — these are global technical decisions (GLB texture map = null, NoToneMapping, OrbitControls conflict handling, bounding box stem offset, etc.) that remain in effect.
- INVALID as instruction source: Everything related to the old color system — primaryColorFamily, secondaryColorFamily, PRIMARY_TYPES, SECONDARY_TYPES, Steps 1–3 descriptions, and the ColorFamily type definition in the data model section. Do not follow these.

**Chat conversation** serves as supplementary decisions for edge cases not covered here. It does not override this file or the codebase.

## 3. Goal

**This round:** Replace the existing primary/secondary color family system with a two-screen color assignment flow. Screen 1 lets users drag colors onto flower type groups. Screen 2 is the existing arrangement view, with flowers pre-colored from Screen 1.

**This round does NOT address:** flower size adjustment (Step 6), flower facing rotation (Step 7), onboarding animation, AI color suggestions, gradient direction control, "return to Screen 1 while preserving arrangement" functionality.

## 4. Scope

### In scope:
- Remove the entire old color system (primary/secondary family picker, related state, related logic)
- Build Screen 1: color assignment page displaying flowers with the same 3D models as Screen 2, grouped by type, fixed camera angle, no rotation or drag-to-cake interaction
- Modify Screen 2: flowers enter with colors assigned in Screen 1
- Rewrite single-flower color picker to two-row layout
- Unify all color swatches to one shared 7-color palette
- Update data model to per-flower-type baseColor map
- Update reset behavior to return to Screen 1
- Add static hint text on Screen 1

### Out of scope:
- Flower model loading logic (do not touch)
- Snap/attach and drag mechanics (do not touch)
- Pan, rotate, zoom controls (do not touch)
- Screenshot functionality (do not touch)
- Cake color change (preserve existing behavior, but update to use the unified 7-color palette + default near-white)
- Step 6: flower size adjustment
- Step 7: flower facing rotation
- Onboarding animation
- "Return to Screen 1 while preserving placed flowers"
- Color harmony suggestions or area ratio feedback
- Leaf color assignment

## 5. Current-State Constraints

### Files involved in old color system:
- `src/data/colorFamilies.ts` — defines 7 color families, HSL params, computeGradient()
- `src/data/colors.ts` — defines PRESET_COLORS (6 colors) and CAKE_DEFAULT_COLOR
- `src/components/ColorFamilyPicker.tsx` — top-of-screen primary/secondary picker UI
- `src/components/ColorPicker.tsx` — bottom-of-screen per-flower color swatches
- `src/App.tsx` — applyFamilyToTrayFlowers(), handlePrimaryFamily(), handleSecondaryFamily(), PRIMARY_TYPES, SECONDARY_TYPES constants
- `src/types.ts` — ColorFamily type, primaryColorFamily and secondaryColorFamily in AppState

### Flower types and counts:
| Type | Code name | Count | Model type |
|------|-----------|-------|------------|
| 玫瑰 | rose | 6 | GLB |
| 繡球花 | hydrangea | 8 | GLB |
| 芍藥 | peony | 4 | GLB |
| 五瓣花 | fivepetal | 4 | Procedural |

Total: 22 flowers.

### Critical technical constraint:
GLB models require `material.map = null` before programmatic color assignment. Procedural geometry (fivepetal) does not. Any unified color-setting function must handle both cases.

## 6. Required Impact Analysis Before Coding

**Do not write or modify any code until this analysis is complete and confirmed by the user.**

Produce the following three lists:

**List A — Dependency scan:** Every file and function that reads or writes `primaryColorFamily`, `secondaryColorFamily`, `PRIMARY_TYPES`, `SECONDARY_TYPES`, `applyFamilyToTrayFlowers`, `handlePrimaryFamily`, `handleSecondaryFamily`, `PRESET_COLORS`. Include the file path, function/component name, and what it does with the value.

**List B — Removal plan:** Every file, component, function, constant, and type that must be deleted or emptied. Mark each as "delete entire file" or "delete specific code within file."

**List C — Creation/modification plan:** Every new file to create and every existing file that needs modification (excluding deletions). For each, state what it will contain or what changes are needed.

After producing Lists A, B, C: stop and wait for user confirmation before proceeding.

## 7. Target Behavior

### Screen 1 — Color Assignment

- This is the first screen the user sees when opening the tool.
- Display all flowers grouped by type: rose group (6), hydrangea group (8), peony group (4), fivepetal group (4). Each group is visually distinct and labeled.
- **Flowers must be rendered using the same 3D models as Screen 2** (GLB models for rose/hydrangea/peony, procedural geometry for fivepetal). They should look identical to how they appear in the flower tray on Screen 2. Do NOT replace flowers with abstract circles, color blocks, icons, or any other placeholder. The camera angle is fixed (no user rotation, no pan, no zoom). The only difference from Screen 2 is the interaction model: users cannot drag flowers onto a cake; they can only drag colors onto flower groups.
- Display the 7-color palette as draggable color swatches (see Section 9 for exact colors).
- User drags a color onto a flower type group → all flowers in that group automatically receive that color family with an HSL lightness gradient applied:
  - Fix H (hue) and S (saturation) from the base color.
  - Distribute L (lightness) evenly across flowers in the group, from darker to lighter.
  - Example: 4 flowers → L offsets of baseL, baseL+5%, baseL+10%, baseL+15%. Exact values can be hardcoded initially and adjusted later.
- Dragging a new color onto the same group replaces the previous color.
- The same color can be dragged onto multiple groups.
- Groups that have not been assigned a color remain white (default: #F4EFE9).
- Static hint text displayed on first visit: "把顏色拖到花上" — fades out after user performs one successful drag.
- A "開始" (Start) button transitions to Screen 2. The button is always available regardless of how many groups have been colored.

### Screen 2 — Arrangement (existing 3D canvas)

- Identical to current arrangement view.
- Flowers in the tray arrive pre-colored with the colors and gradients assigned in Screen 1.
- All existing interactions are preserved: drag to cake, snap, rotate view, zoom, screenshot.

### Single-flower color change in Screen 2

- Tap/click a flower (on cake or in tray) to select it.
- If the flower has an assigned color family (was colored in Screen 1 or subsequently changed):
  - Row 1: gradient swatches of the flower's current color family (same HSL gradient logic, showing 5 steps from dark to light).
  - Row 2: the 7-color palette.
- If the flower has no assigned color family (still default white):
  - Row 1: does not appear.
  - Row 2: the 7-color palette.
- Selecting from Row 1 changes only that flower's shade within its current family.
- Selecting from Row 2 changes that flower's color to the new family. The default shade is the middle value (3rd of 5 gradient steps). Row 1 then updates to show the new family's gradient. This change applies to only the selected flower, not the entire group.

### Cake body color change

- Tap/click cake → show the same 7-color palette + default near-white (#fafaf8).
- Behavior unchanged from current implementation, except the 7 colors must be the same unified palette used everywhere else.

### Reset behavior

- Reset button clears everything: all flowers return to tray in default white, cake returns to default color (#fafaf8), camera returns to default angle, and the app returns to Screen 1.

## 8. Data Model Changes

### Remove:
- `primaryColorFamily: ColorFamily | null` from AppState
- `secondaryColorFamily: ColorFamily | null` from AppState
- `ColorFamily` type (or repurpose if structurally useful)

### Add:
- A per-flower-type color assignment map. Conceptual structure:
  - Key: flower type string (rose, hydrangea, peony, fivepetal)
  - Value: base color as hex string, or null if unassigned
- Each Flower object needs:
  - `baseColor`: the hex string of the color family assigned to its type (inherited from the map), or null
  - `colorVariant`: the specific computed color for this flower (base color + lightness offset), stored as RGB tuple
- A screen state indicator: which screen is currently active (Screen 1 or Screen 2)

### Preserve:
- `flowers[]` array structure
- `cake.layers[]` structure
- `board` structure
- Per-flower fields: id, type, position, rotation, scale, elevation, slotPosition, onCake

## 9. Implementation Requirements

### Unified 7-color palette (used everywhere — Screen 1, Screen 2 Row 2, cake color):

| Name | Hex |
|------|-----|
| 桃粉 | #F4A6A0 |
| 珊瑚桃 | #F5B993 |
| 奶油黃 | #F3D98B |
| 薰衣草紫 | #C3A6DD |
| 花園藍 | #8FB8D9 |
| 酒紅 | #A64D5F |
| 暖白 | #F4EFE9 |

Cake color picker also includes the default near-white #fafaf8 as an 8th option.

### Must remove:
- `ColorFamilyPicker.tsx` — delete entire file
- `ColorPicker.tsx` — delete or completely rewrite
- `colors.ts` — delete or replace PRESET_COLORS with unified 7-color palette
- `colorFamilies.ts` — retain computeGradient() logic if reusable, remove old family definitions, update to work with the 7 hex colors above. Rename file to `gradient.ts`.
- In `App.tsx`: remove primaryColorFamily, secondaryColorFamily, handlePrimaryFamily(), handleSecondaryFamily(), PRIMARY_TYPES, SECONDARY_TYPES, applyFamilyToTrayFlowers()
- In `types.ts`: remove primaryColorFamily and secondaryColorFamily from AppState

### Must preserve:
- All flower model loading (GLB useGLTF + procedural fivepetal)
- Snap-to-surface logic (raycaster, face normal rotation, stem offset)
- OrbitControls configuration
- Screenshot and reset button UI (reset behavior changes to return to Screen 1)
- Cake color change mechanism (update palette only)
- The `material.map = null` pattern for GLB models

### Must build new:
- Screen 1 component: flower type groups rendered with the same 3D models as Screen 2 (fixed camera, no user rotation), draggable color swatches, gradient preview on flowers, start button, hint text
- Screen 2 updated color picker: two-row layout with conditional Row 1
- Screen routing state (Screen 1 vs Screen 2)
- Per-flower-type color assignment state
- HSL gradient computation for assigned colors (in new `gradient.ts`)
- Updated reset flow (return to Screen 1 + clear all)

### Must avoid:
- Do not replace flower visuals on Screen 1 with abstract shapes, circles, icons, or placeholders. Use the actual 3D flower models.
- Do not change flower model files or re-process GLB assets.
- Do not implement flower size adjustment or facing rotation.
- Do not implement "return to Screen 1 while preserving placed flowers."
- Do not add color harmony analysis or area ratio feedback.
- Do not add animation transitions between screens.

## 10. Acceptance Criteria

1. **Old system fully removed:** `grep -r "primaryColorFamily\|secondaryColorFamily\|PRIMARY_TYPES\|SECONDARY_TYPES\|handlePrimaryFamily\|handleSecondaryFamily\|applyFamilyToTrayFlowers" src/` returns zero results.

2. **Screen 1 renders correctly:** Opening the app shows a page with 4 flower type groups (rose ×6, hydrangea ×8, peony ×4, fivepetal ×4) rendered using the same 3D flower models as Screen 2, and 7 draggable color swatches. Flowers look like real flowers, not abstract circles or placeholders.

3. **Drag-to-assign works:** Dragging a color onto a flower type group causes all flowers in that group to visually update with a gradient (darkest to lightest) of that color family. Dragging a different color onto the same group replaces the previous assignment.

4. **Default/unassigned state:** Flower groups that have not been assigned a color remain white (#F4EFE9). Pressing "開始" with unassigned groups is allowed; those flowers enter Screen 2 as white.

5. **Screen transition:** Pressing "開始" transitions to Screen 2. The 3D canvas appears with cake, tray, and flowers. Flowers in the tray display the colors assigned in Screen 1, including gradient variation within each group.

6. **Single-flower color change — with family:** Clicking a flower that has an assigned color shows two rows: Row 1 = gradient of current family (5 shades), Row 2 = 7 unified colors. Selecting from Row 1 changes only that flower's shade. Selecting from Row 2 changes that flower to the new family with the middle gradient value as default.

7. **Single-flower color change — without family:** Clicking a white (unassigned) flower shows only Row 2 (7 colors). Selecting a color assigns it with the middle gradient value. Clicking the flower again now shows both rows.

8. **Cake color non-regression:** Clicking the cake shows 7 colors + default near-white (#fafaf8). Selecting a color changes the cake body. This behavior is unchanged from before.

9. **Gradient consistency:** Within a flower type group, the gradient goes from darker to lighter in a visually smooth progression. No flower in the group has the exact same color as another (unless the group has only 1 flower).

10. **Procedural vs GLB compatibility:** Both fivepetal (procedural) and GLB flowers (rose, hydrangea, peony) correctly display assigned colors. GLB flowers have their texture maps set to null before color assignment.

11. **Reset returns to Screen 1:** Pressing reset clears all flower colors to default white, returns all flowers to tray, resets cake color to #fafaf8, resets camera, and navigates back to Screen 1.

12. **Non-goal guard:** No flower size slider, no facing rotation slider, no onboarding animation, no "return to Screen 1 while preserving arrangement" button exists anywhere in the UI after this round.

## 11. Verification Checklist

After implementation, report the following:

- [ ] Output of `grep -r "primaryColorFamily\|secondaryColorFamily\|PRIMARY_TYPES\|SECONDARY_TYPES" src/` (expected: no results)
- [ ] List of deleted files
- [ ] List of new files created
- [ ] List of modified files with summary of changes
- [ ] Confirmation that Screen 1 renders without errors in browser
- [ ] Confirmation that flowers on Screen 1 use actual 3D models, not placeholders
- [ ] Confirmation that drag-to-assign produces visible gradient on flower groups
- [ ] Confirmation that "開始" transitions to Screen 2 with pre-colored flowers
- [ ] Confirmation that single-flower color picker shows correct row layout
- [ ] Confirmation that cake color change still works
- [ ] Confirmation that reset returns to Screen 1

## 12. Non-Goals

Explicitly not part of this round:
- Flower size adjustment (Step 6)
- Flower facing rotation (Step 7)
- Onboarding animation or tutorial
- AI-powered color suggestions
- Color harmony or area ratio analysis
- Leaf type or leaf coloring
- Multi-layer cake
- "Return to Screen 1 while preserving arrangement"
- Gradient direction control (manual or automatic)
- Mobile/touch optimization for Screen 1 drag interaction
- New flower model acquisition or processing
- Replacing flower visuals with abstract shapes or icons on any screen
