# D1 tokens, contrast and component states

This is the approval record of design task D1, issue [northMES/northmes#189](https://github.com/northMES/northmes/issues/189), for story E04-S01 ([northMES/northmes#39](https://github.com/northMES/northmes/issues/39)). The design page is [ui/ui-189-tokens.dc.html](https://claude.ai/design/p/dba068e0-37df-46e5-adcf-4439b6c4c0ad?file=ui/ui-189-tokens.dc.html) in the Claude Design project. Approved by Krister Johansson on 2026-10-05. The design project has no bound design system: the Broadsheet binding was removed on 2026-10-05. The approved page is frozen: a later change copies it under a new issue number.

D1 draws no screen and has no route. The page assumes that this file, not the canvas, is the source of the values E04-S01 implements (Q3).

## Approved files

| File | Etag |
|---|---|
| `ui/ui-189-tokens.dc.html` | `1791221434821682` |
| `ui/ui-189-tokens-header.dc.html` | `1791221434937191` |
| `ui/ui-189-tokens-base.dc.html` | `1791221435049269` |
| `ui/ui-189-tokens-contrast.dc.html` | `1791221435177831` |
| `ui/ui-189-tokens-palette.dc.html` | `1791221435294945` |
| `ui/ui-189-tokens-markers.dc.html` | `1791221435407617` |
| `ui/ui-189-tokens-type.dc.html` | `1791221435534908` |
| `ui/ui-189-tokens-components.dc.html` | `1791221435657129` |
| `ui/ui-189-tokens-themes.dc.html` | `1791221435766855` |
| `ui/ui-189-tokens-keyboard.dc.html` | `1791221435870445` |
| `ui/ui-189-tokens-notes.dc.html` | `1791221435964236` |
| `ui/ui-189-tokens-page.css` | `1791221436079789` |
| `ui/tokens.css` | `1791221436225089` |

The 13 files moved from the project root to `ui/` on 2026-10-05, when the design project was organized in area folders; their content is byte for byte unchanged, so the approval stands, and the earlier root etags are in this table as of commit [401e204](https://github.com/northMES/northmes/blob/401e204/docs/design/ui/ui-189-tokens.md#approved-files).

## Frames

Every frame is 1280 px wide and exists in light and dark. The build notes frame is 2656 px wide and lists the light and dark values side by side.

| Frame | Content | Page file | Light | Dark |
|---|---|---|---|---|
| F0 | Header | `ui/ui-189-tokens-header.dc.html` | [ui-189-tokens-f0-header-light.png](ui-189-tokens-f0-header-light.png) | [ui-189-tokens-f0-header-dark.png](ui-189-tokens-f0-header-dark.png) |
| F1 | Token base | `ui/ui-189-tokens-base.dc.html` | [ui-189-tokens-f1-token-base-light.png](ui-189-tokens-f1-token-base-light.png) | [ui-189-tokens-f1-token-base-dark.png](ui-189-tokens-f1-token-base-dark.png) |
| F2 | Contrast table | `ui/ui-189-tokens-contrast.dc.html` | [ui-189-tokens-f2-contrast-light.png](ui-189-tokens-f2-contrast-light.png) | [ui-189-tokens-f2-contrast-dark.png](ui-189-tokens-f2-contrast-dark.png) |
| F3 | Order palette, group colors and the block text rule | `ui/ui-189-tokens-palette.dc.html` | [ui-189-tokens-f3-palette-light.png](ui-189-tokens-f3-palette-light.png) | [ui-189-tokens-f3-palette-dark.png](ui-189-tokens-f3-palette-dark.png) |
| F4 | State markers and the two-tone focus ring | `ui/ui-189-tokens-markers.dc.html` | [ui-189-tokens-f4-markers-focus-light.png](ui-189-tokens-f4-markers-focus-light.png) | [ui-189-tokens-f4-markers-focus-dark.png](ui-189-tokens-f4-markers-focus-dark.png) |
| F5 | Fonts and icons | `ui/ui-189-tokens-type.dc.html` | [ui-189-tokens-f5-fonts-icons-light.png](ui-189-tokens-f5-fonts-icons-light.png) | [ui-189-tokens-f5-fonts-icons-dark.png](ui-189-tokens-f5-fonts-icons-dark.png) |
| F6 | shadcn components in every state | `ui/ui-189-tokens-components.dc.html` | [ui-189-tokens-f6-components-light.png](ui-189-tokens-f6-components-light.png) | [ui-189-tokens-f6-components-dark.png](ui-189-tokens-f6-components-dark.png) |
| F7 | Themes | `ui/ui-189-tokens-themes.dc.html` | [ui-189-tokens-f7-themes-light.png](ui-189-tokens-f7-themes-light.png) | [ui-189-tokens-f7-themes-dark.png](ui-189-tokens-f7-themes-dark.png) |
| F8 | Keyboard and focus | `ui/ui-189-tokens-keyboard.dc.html` | [ui-189-tokens-f8-keyboard-focus-light.png](ui-189-tokens-f8-keyboard-focus-light.png) | [ui-189-tokens-f8-keyboard-focus-dark.png](ui-189-tokens-f8-keyboard-focus-dark.png) |
| B | Build notes, not part of the UI | `ui/ui-189-tokens-notes.dc.html` | [ui-189-tokens-notes.png](ui-189-tokens-notes.png) | In ui-189-tokens-notes.png |

## Tokens

`ui/tokens.css` in the design project holds 84 color tokens in `:root` (light) and `.dark`, plus 6 shared values in `:root`. The oklch value is the source and the hex is its sRGB rendering; every value lies inside sRGB. A role that ends in "(= `--name`)" holds the same value as that token in both themes. The values are not in a repository commit yet.

The D1 fixes to the shadcn neutral defaults (06 Design tokens):

- `--input` (1.4.11): L 0.6 in both themes, within the limits of 0.669 or lower in light and 0.478 or higher in dark. It measures 3.76:1 on background in light and 4.54:1 in dark, lowest 3.44:1 on muted. shadcn neutral measured 1.26:1 in light.
- Focus ring (1.4.11, 2.4.7): two tones, `--focus-outline` (the foreground value) and `--focus-ring` (the background value), 16.56:1 apart in light and 15.94:1 in dark, at least 3.99:1 over any sRGB color. shadcn's `ring/50` measured 1.54:1 in light and 1.87:1 in dark.
- `--muted-foreground` (1.4.3): L 0.47 in light, within the limit of 0.547. It measures 5.98:1 on muted in light and 6.55:1 in dark. shadcn neutral measured 4.34:1 in light.
- `--accent` and `--link` (1.4.3): accent text measures 15.16:1 in light and 12.98:1 in dark. Links measure at least 6.26:1 in light and 7.03:1 in dark on every surface they sit on.

### shadcn base (18)

| Token | Light oklch | Light hex | Dark oklch | Dark hex | Role |
|---|---|---|---|---|---|
| `--background` | `oklch(0.985 0.002 250)` | #f9fafb | `oklch(0.205 0.005 250)` | #151719 | Page background |
| `--foreground` | `oklch(0.22 0.01 250)` | #171b1f | `oklch(0.96 0.003 250)` | #f0f2f4 | Body text |
| `--card` | `oklch(1 0 0)` | #ffffff | `oklch(0.24 0.006 250)` | #1d2022 | Card and panel surface |
| `--card-foreground` | `oklch(0.22 0.01 250)` | #171b1f | `oklch(0.96 0.003 250)` | #f0f2f4 | Text on cards (= `--foreground`) |
| `--popover` | `oklch(1 0 0)` | #ffffff | `oklch(0.24 0.006 250)` | #1d2022 | Popover, menu and dialog surface (= `--card`) |
| `--popover-foreground` | `oklch(0.22 0.01 250)` | #171b1f | `oklch(0.96 0.003 250)` | #f0f2f4 | Text on popovers (= `--foreground`) |
| `--primary` | `oklch(0.27 0.012 250)` | #22272c | `oklch(0.94 0.004 250)` | #e9ebee | Primary button, checked checkbox |
| `--primary-foreground` | `oklch(0.99 0 0)` | #fcfcfc | `oklch(0.2 0.01 250)` | #13161a | Label on primary |
| `--secondary` | `oklch(0.955 0.004 250)` | #eef0f3 | `oklch(0.28 0.007 250)` | #26292c | Secondary button fill (= `--muted`) |
| `--secondary-foreground` | `oklch(0.22 0.01 250)` | #171b1f | `oklch(0.96 0.003 250)` | #f0f2f4 | Label on secondary (= `--foreground`) |
| `--muted` | `oklch(0.955 0.004 250)` | #eef0f3 | `oklch(0.28 0.007 250)` | #26292c | Table header, group row, disabled field |
| `--muted-foreground` | `oklch(0.47 0.01 250)` | #575b60 | `oklch(0.75 0.008 250)` | #aaaeb3 | Secondary text, hints, placeholders |
| `--accent` | `oklch(0.955 0.004 250)` | #eef0f3 | `oklch(0.28 0.007 250)` | #26292c | Hover surface (ghost, outline, menu item) (= `--muted`) |
| `--accent-foreground` | `oklch(0.22 0.01 250)` | #171b1f | `oklch(0.96 0.003 250)` | #f0f2f4 | Text on the hover surface (= `--foreground`) |
| `--destructive` | `oklch(0.5 0.17 27)` | #b02b27 | `oklch(0.74 0.14 25)` | #f7857d | Destructive action, field error |
| `--border` | `oklch(0.9 0.005 250)` | #dbdee1 | `oklch(0.36 0.008 250)` | #3a3d41 | Decorative divider and card border |
| `--input` | `oklch(0.6 0.01 250)` | #7c8186 | `oklch(0.6 0.01 250)` | #7c8186 | Form control border |
| `--ring` | `oklch(0.22 0.01 250)` | #171b1f | `oklch(0.96 0.003 250)` | #f0f2f4 | Focus ring outline half, no /50 (= `--focus-outline`) |

### shadcn sidebar (8)

| Token | Light oklch | Light hex | Dark oklch | Dark hex | Role |
|---|---|---|---|---|---|
| `--sidebar` | `oklch(1 0 0)` | #ffffff | `oklch(0.24 0.006 250)` | #1d2022 | Sidebar surface (= `--card`) |
| `--sidebar-foreground` | `oklch(0.22 0.01 250)` | #171b1f | `oklch(0.96 0.003 250)` | #f0f2f4 | Sidebar text (= `--foreground`) |
| `--sidebar-primary` | `oklch(0.27 0.012 250)` | #22272c | `oklch(0.94 0.004 250)` | #e9ebee | Sidebar current item (= `--primary`) |
| `--sidebar-primary-foreground` | `oklch(0.99 0 0)` | #fcfcfc | `oklch(0.2 0.01 250)` | #13161a | Text on sidebar current item (= `--primary-foreground`) |
| `--sidebar-accent` | `oklch(0.955 0.004 250)` | #eef0f3 | `oklch(0.28 0.007 250)` | #26292c | Sidebar hover (= `--accent`) |
| `--sidebar-accent-foreground` | `oklch(0.22 0.01 250)` | #171b1f | `oklch(0.96 0.003 250)` | #f0f2f4 | Text on sidebar hover (= `--accent-foreground`) |
| `--sidebar-border` | `oklch(0.9 0.005 250)` | #dbdee1 | `oklch(0.36 0.008 250)` | #3a3d41 | Sidebar divider (= `--border`) |
| `--sidebar-ring` | `oklch(0.22 0.01 250)` | #171b1f | `oklch(0.96 0.003 250)` | #f0f2f4 | Sidebar focus outline half (= `--ring`) |

### NorthMES additions (12)

| Token | Light oklch | Light hex | Dark oklch | Dark hex | Role |
|---|---|---|---|---|---|
| `--primary-hover` | `oklch(0.36 0.012 250)` | #383e43 | `oklch(0.86 0.004 250)` | #cfd1d3 | Primary button hover |
| `--destructive-foreground` | `oklch(0.985 0.002 250)` | #f9fafb | `oklch(0.205 0.005 250)` | #151719 | Text on a destructive fill (= `--background`) |
| `--destructive-subtle` | `oklch(0.955 0.022 27)` | #ffebe8 | `oklch(0.29 0.07 25)` | #481b19 | Destructive tint, outline hover |
| `--link` | `oklch(0.46 0.13 255)` | #1b589e | `oklch(0.78 0.1 250)` | #85bcf5 | Link text |
| `--focus-outline` | `oklch(0.22 0.01 250)` | #171b1f | `oklch(0.96 0.003 250)` | #f0f2f4 | Two-tone ring, outer 2 px (= `--foreground`) |
| `--focus-ring` | `oklch(0.985 0.002 250)` | #f9fafb | `oklch(0.205 0.005 250)` | #151719 | Two-tone ring, inner 2 px (= `--background`) |
| `--success` | `oklch(0.48 0.11 150)` | #246e3a | `oklch(0.78 0.13 150)` | #76cf8a | Success text, icon, progress |
| `--success-subtle` | `oklch(0.95 0.03 150)` | #e1f5e4 | `oklch(0.28 0.05 150)` | #15301b | Success tint |
| `--warning` | `oklch(0.5 0.11 65)` | #8d5406 | `oklch(0.83 0.12 80)` | #f0be67 | Warning text and icon |
| `--warning-subtle` | `oklch(0.955 0.04 85)` | #fdefd2 | `oklch(0.29 0.05 80)` | #38280a | Warning tint |
| `--info` | `oklch(0.48 0.12 250)` | #1a609e | `oklch(0.78 0.1 250)` | #85bcf5 | Info text and icon |
| `--info-subtle` | `oklch(0.955 0.02 250)` | #e6f2fe | `oklch(0.29 0.05 250)` | #172d43 | Info tint, selected table row |

### Board (6)

| Token | Light oklch | Light hex | Dark oklch | Dark hex | Role |
|---|---|---|---|---|---|
| `--lane` | `oklch(1 0 0)` | #ffffff | `oklch(0.225 0.005 250)` | #1a1c1e | Board lane |
| `--lane-alt` | `oklch(0.978 0.003 250)` | #f6f8fa | `oklch(0.245 0.006 250)` | #1e2123 | Alternate board lane |
| `--off-time` | `oklch(0.94 0.004 250)` | #e9ebee | `oklch(0.185 0.005 250)` | #111315 | Non-working shading (hatch) |
| `--block-border` | `oklch(0.22 0.01 250)` | #171b1f | `oklch(0.82 0.005 250)` | #c2c4c7 | 1 px block edge on the board |
| `--now` | `oklch(0.5 0.17 27)` | #b02b27 | `oklch(0.74 0.14 25)` | #f7857d | Now line and label fill (= `--destructive`) |
| `--now-foreground` | `oklch(0.985 0.002 250)` | #f9fafb | `oklch(0.205 0.005 250)` | #151719 | Now label text (= `--background`) |

### Order status, late and lock owner (18)

| Token | Light oklch | Light hex | Dark oklch | Dark hex | Role |
|---|---|---|---|---|---|
| `--status-registered` | `oklch(0.955 0.004 250)` | #eef0f3 | `oklch(0.28 0.007 250)` | #26292c | Status registered: badge surface (= `--muted`) |
| `--status-registered-foreground` | `oklch(0.22 0.01 250)` | #171b1f | `oklch(0.96 0.003 250)` | #f0f2f4 | Status registered: badge text and icon (= `--foreground`) |
| `--status-planned` | `oklch(0.955 0.02 250)` | #e6f2fe | `oklch(0.29 0.05 250)` | #172d43 | Status planned: badge surface (= `--info-subtle`) |
| `--status-planned-foreground` | `oklch(0.48 0.12 250)` | #1a609e | `oklch(0.78 0.1 250)` | #85bcf5 | Status planned: badge text and icon (= `--info`) |
| `--status-active` | `oklch(0.95 0.03 150)` | #e1f5e4 | `oklch(0.28 0.05 150)` | #15301b | Status active: badge surface (= `--success-subtle`) |
| `--status-active-foreground` | `oklch(0.48 0.11 150)` | #246e3a | `oklch(0.78 0.13 150)` | #76cf8a | Status active: badge text and icon (= `--success`) |
| `--status-paused` | `oklch(0.955 0.04 85)` | #fdefd2 | `oklch(0.29 0.05 80)` | #38280a | Status paused: badge surface (= `--warning-subtle`) |
| `--status-paused-foreground` | `oklch(0.5 0.11 65)` | #8d5406 | `oklch(0.83 0.12 80)` | #f0be67 | Status paused: badge text and icon (= `--warning`) |
| `--status-finished` | `oklch(0.95 0.03 150)` | #e1f5e4 | `oklch(0.28 0.05 150)` | #15301b | Status finished: badge surface (= `--success-subtle`) |
| `--status-finished-foreground` | `oklch(0.48 0.11 150)` | #246e3a | `oklch(0.78 0.13 150)` | #76cf8a | Status finished: badge text and icon (= `--success`) |
| `--status-delivered` | `oklch(0.955 0.004 250)` | #eef0f3 | `oklch(0.28 0.007 250)` | #26292c | Status delivered: badge surface (= `--muted`) |
| `--status-delivered-foreground` | `oklch(0.22 0.01 250)` | #171b1f | `oklch(0.96 0.003 250)` | #f0f2f4 | Status delivered: badge text and icon (= `--foreground`) |
| `--status-cancelled` | `oklch(0.955 0.004 250)` | #eef0f3 | `oklch(0.28 0.007 250)` | #26292c | Status cancelled: badge surface (= `--muted`) |
| `--status-cancelled-foreground` | `oklch(0.47 0.01 250)` | #575b60 | `oklch(0.75 0.008 250)` | #aaaeb3 | Status cancelled: badge text and icon (= `--muted-foreground`) |
| `--late` | `oklch(0.955 0.022 27)` | #ffebe8 | `oklch(0.29 0.07 25)` | #481b19 | Late badge surface (= `--destructive-subtle`) |
| `--late-foreground` | `oklch(0.5 0.17 27)` | #b02b27 | `oklch(0.74 0.14 25)` | #f7857d | Late badge text and icon (= `--destructive`) |
| `--lock-owner` | `oklch(0.955 0.004 250)` | #eef0f3 | `oklch(0.28 0.007 250)` | #26292c | Lock owner badge surface (= `--muted`) |
| `--lock-owner-foreground` | `oklch(0.22 0.01 250)` | #171b1f | `oklch(0.96 0.003 250)` | #f0f2f4 | Lock owner badge text (= `--foreground`) |

### Order palette (20)

Three tiers. `--palette-1` to `--palette-8` keep Graphite's values (light L 0.78, C 0.09, hues 30 to 345 in 45 degree steps). D1 adds a pale tier, `--palette-9` to `--palette-14` (light L 0.86, C 0.07, hues 0, 60, 120, 180, 240, 300), and a deep tier, `--palette-15` to `--palette-20` (light L 0.70, C 0.10, hues 24, 84, 144, 204, 264, 324). Each dark value is the light lightness minus 0.08.

- Color groups orders and never carries state; on the board the fill is the order color in every state.
- Block text is pure black or pure white from `textColorFor(fill)` in `@northmes/contracts`, whichever contrasts more. It reaches at least 4.58:1 on every sRGB color, so an ERP ColorCode or a color a planner picks also works. All 20 palette colors and both group colors take black text in both themes.
- Board block colors are a CSS variable, not a class per color; dynamic class names are banned. Palette classes go through `@source inline()` for the swatch components.
- Only the color swatch components use `forced-color-adjust: none`; a CI grep fails any other use.
- ColorSwatchPicker offers the 20 palette colors plus any color, with text from `textColorFor`. The value type is `paletteColor` in `@northmes/contracts`.
- The ERP sends one hex for both themes. One imported hex is drawn the same in both themes until Q9 settles a dark rule.

| Token | Light oklch | Light hex | Dark oklch | Dark hex | Role |
|---|---|---|---|---|---|
| `--palette-1` | `oklch(0.78 0.09 30)` | #eba295 | `oklch(0.7 0.09 30)` | #d0897d | Order color, mid tier, hue 30 |
| `--palette-2` | `oklch(0.78 0.09 75)` | #d9af75 | `oklch(0.7 0.09 75)` | #bf965d | Order color, mid tier, hue 75 |
| `--palette-3` | `oklch(0.78 0.09 120)` | #b0c07e | `oklch(0.7 0.09 120)` | #97a766 | Order color, mid tier, hue 120 |
| `--palette-4` | `oklch(0.78 0.09 165)` | #7ecaa9 | `oklch(0.7 0.09 165)` | #65b090 | Order color, mid tier, hue 165 |
| `--palette-5` | `oklch(0.78 0.09 210)` | #6cc7d7 | `oklch(0.7 0.09 210)` | #51aebd | Order color, mid tier, hue 210 |
| `--palette-6` | `oklch(0.78 0.09 255)` | #90baf1 | `oklch(0.7 0.09 255)` | #78a1d6 | Order color, mid tier, hue 255 |
| `--palette-7` | `oklch(0.78 0.09 300)` | #c0abe9 | `oklch(0.7 0.09 300)` | #a792ce | Order color, mid tier, hue 300 |
| `--palette-8` | `oklch(0.78 0.09 345)` | #e2a0c5 | `oklch(0.7 0.09 345)` | #c788ab | Order color, mid tier, hue 345 |
| `--palette-9` | `oklch(0.86 0.07 0)` | #f9becf | `oklch(0.78 0.07 0)` | #dea5b5 | Order color, pale tier, hue 0 |
| `--palette-10` | `oklch(0.86 0.07 60)` | #f4c7a3 | `oklch(0.78 0.07 60)` | #d9ad8a | Order color, pale tier, hue 60 |
| `--palette-11` | `oklch(0.86 0.07 120)` | #cbd8a5 | `oklch(0.78 0.07 120)` | #b1bf8c | Order color, pale tier, hue 120 |
| `--palette-12` | `oklch(0.86 0.07 180)` | #9ee1d3 | `oklch(0.78 0.07 180)` | #85c7b9 | Order color, pale tier, hue 180 |
| `--palette-13` | `oklch(0.86 0.07 240)` | #a8d8fb | `oklch(0.78 0.07 240)` | #8fbee0 | Order color, pale tier, hue 240 |
| `--palette-14` | `oklch(0.86 0.07 300)` | #d8c7f9 | `oklch(0.78 0.07 300)` | #beaede | Order color, pale tier, hue 300 |
| `--palette-15` | `oklch(0.7 0.1 24)` | #d68580 | `oklch(0.62 0.1 24)` | #bb6d68 | Order color, deep tier, hue 24 |
| `--palette-16` | `oklch(0.7 0.1 84)` | #bc9951 | `oklch(0.62 0.1 84)` | #a38137 | Order color, deep tier, hue 84 |
| `--palette-17` | `oklch(0.7 0.1 144)` | #77af76 | `oklch(0.62 0.1 144)` | #5f965f | Order color, deep tier, hue 144 |
| `--palette-18` | `oklch(0.7 0.1 204)` | #41b0bb | `oklch(0.62 0.1 204)` | #1d97a2 | Order color, deep tier, hue 204 |
| `--palette-19` | `oklch(0.7 0.1 264)` | #7f9edd | `oklch(0.62 0.1 264)` | #6785c3 | Order color, deep tier, hue 264 |
| `--palette-20` | `oklch(0.7 0.1 324)` | #bd89c2 | `oklch(0.62 0.1 324)` | #a471a8 | Order color, deep tier, hue 324 |

### Equipment group colors (2)

A group row shows the group color as a dot and each machine row header as a 6 px stripe, and the group name is always written. On import a group keeps its color, else takes the import color, else gets one of the 20 palette colors (Q10).

| Token | Light oklch | Light hex | Dark oklch | Dark hex | Role |
|---|---|---|---|---|---|
| `--group-1` | `oklch(0.62 0.1 195)` | #1d9999 | `oklch(0.68 0.1 195)` | #39abab | Equipment group color (sample Milling) |
| `--group-2` | `oklch(0.62 0.1 300)` | #8f78ba | `oklch(0.68 0.1 300)` | #a28acd | Equipment group color (sample Turning) |

### Shared values (6)

| Token | Value | Role |
|---|---|---|
| `--radius` | `0.375rem` (6 px) | Corner radius. `theme.css` derives sm 3.6, md 4.8, lg 6 and xl 8.4 px (Q21) |
| `--font-sans` | `"IBM Plex Sans", system-ui, sans-serif` | Interface text, self-hosted |
| `--font-mono` | `"IBM Plex Mono", ui-monospace, monospace` | Numbers, with tabular figures, self-hosted |
| `--nm-control-height` | `2.25rem` (36 px) | Buttons, inputs, selects, IconButton |
| `--nm-target-min` | `24px` | 2.5.8 minimum target. In px, so a smaller root font size cannot shrink it |
| `--nm-target-min-station` | `44px` | The station layout sets `--nm-target-min` to this value until a glove test sets the final one |

## Components

The first column is the shadcn name, not a Base UI or Radix API. The states are the ones F6 draws. Every focusable part also takes `--focus-outline` and `--focus-ring`, the two-tone ring.

| shadcn | `@northmes/ui` | States | Tokens used | Notes |
|---|---|---|---|---|
| Button, variant default | Button | Default, hover, focus-visible, active, disabled, loading (Q8) | `--primary`, `--primary-foreground`; hover and active `--primary-hover` | Loading (Q8) sets aria-busy and aria-disabled |
| Button, variant secondary | Button | As default | `--secondary`, `--secondary-foreground`; hover `--secondary` at 80 percent (P2) | |
| Button, variant outline | Button | As default | `--card`, `--foreground`, border `--input`; hover `--accent` and `--accent-foreground` with border `--foreground` | |
| Button, variant ghost | Button | As default | No fill or border; hover `--accent` and `--accent-foreground` | |
| Button, variant destructive | Button | As default | `--card`, `--destructive` text, border `--destructive`; hover `--destructive-subtle` | Graphite's outlined look |
| Button, variant link | Button | As default | `--primary` text; underline on hover | |
| Button, size icon | IconButton | Default, hover, focus-visible, active, disabled, in ghost and outline | As the variant it uses (ghost or outline) | Required label prop, 36 px |
| Field, Label | Field | With each Input state | Label `--foreground`; description `--muted-foreground`; error text and icon `--destructive` | Label, description and error wired; aria-invalid, aria-describedby |
| Input | Input | Default, hover, focus-visible, disabled, invalid | `--card`, `--foreground`, border `--input`; placeholder `--muted-foreground`; hover and focus border `--foreground`; disabled `--muted` at 50 percent; invalid border `--destructive` plus a 1 px `--destructive` inset | |
| None (Q12) | NumberField | As Input | As Input; the value in `--font-mono` | Drawn as Input with a format hint |
| Select | Select | Default, hover, focus-visible, disabled, invalid; open list with selected, keyboard focus, hover and disabled options | Trigger as Input, end icon `--muted-foreground`. List: `--popover`, `--popover-foreground`, `--border`; item hover `--accent`; keyboard focus `--accent` plus a 2 px inset `--focus-outline` | |
| Combobox | Combobox | Default, hover, focus-visible, disabled, invalid; open with results; loading | Trigger and list as Select; search icon `--muted-foreground` | aria-activedescendant, results in a live region |
| Checkbox | Checkbox | Default, hover, focus-visible, disabled, invalid, checked, indeterminate | `--card`, border `--input`; checked and indeterminate `--primary` with `--primary-foreground`; hover border `--foreground`; invalid border `--destructive` plus a 1 px inset | 16 px box in a `var(--nm-target-min)` hit area |
| Dialog | Dialog | Open, focus inside | `--background` surface, `--border`; overlay black at 50 percent (question) | Returns focus to the trigger |
| Alert Dialog | ConfirmDialog | Open, focus inside, reason field invalid | As Dialog | Optional or required reason (break lock: 3 to 500 characters) |
| Sheet | Sheet | Open, focus on Close | As Dialog | |
| Dropdown Menu | Menu | Open; items default, pointer hover, keyboard focus, disabled | `--popover`, `--popover-foreground`, `--border`; item hover `--accent`; keyboard focus `--accent` plus a 2 px inset `--focus-outline` | Focused item: accent plus 2 px inset outline (P4) |
| Tabs | Tabs | Selected, hover, focus-visible, default, disabled | List `--muted`; tab `--muted-foreground`; hover `--foreground`; selected `--card` with a 2 px `--foreground` underline | Selected tab: 2 px foreground underline |
| Table | Table, DataTable | Sorted and sortable headers, default row, hover row, focused link, selected row, loading row | `--card`, `--border`; header `--muted` and `--muted-foreground`; row hover `--accent`; selected row `--info-subtle`; links in `--link` | aria-sort on sortable columns; keyset paging |
| Tooltip | Tooltip | Open on focus | `--primary`, `--primary-foreground` | Opens after a delay on hover and at once on focus |
| Hover Card | HoverCard | Open | `--popover`, `--popover-foreground`, `--border` | No interactive content |
| Sonner | Toaster | Success, error with its action focused, info | `--popover`, `--popover-foreground`, `--border`; icons in `--success`, `--destructive` and `--info` | Echoes only; errors stay inline |
| Card | Card | Populated | `--card`, `--card-foreground`, `--border` | The panel surface |
| Badge | StatusBadge | Registered, planned, active, paused, finished, delivered, cancelled, late, lock owner | `--status-*` and `--status-*-foreground`; `--late` and `--late-foreground`; `--lock-owner` and `--lock-owner-foreground` | Icon plus text |
| Skeleton | LoadingState | In a Card and a Table row | `--accent` | main sets aria-busy |
| Popover | Lookup, HoverCard | Not drawn on its own | `--popover`, `--popover-foreground`, `--border` | Popover surface |
| None (Q12) | SkipLink, VisuallyHidden | SkipLink focused (F8) | SkipLink: `--primary`, `--primary-foreground` | SkipLink drawn in F8 |
| None (Q12) | ColorSwatchPicker, QuantityInput | Not drawn | None listed | Swatches alone use `forced-color-adjust: none` |

CSS rules from the build notes:

- `theme.css` derives `radius-sm`, `radius-md`, `radius-lg` and `radius-xl` as 0.6, 0.8, 1 and 1.4 times `--radius` (3.6, 4.8, 6 and 8.4 px; Q21).
- Controls are `var(--nm-control-height)`, 36 px. Every interactive primitive has at least `var(--nm-target-min)`.
- Invalid fields: border `--destructive` plus `inset 0 0 0 1px` in `--destructive`.
- Disabled: opacity 0.5, the shadcn default (Q8).
- Text on a destructive fill uses `--destructive-foreground`, never white.
- Values on the page that are not tokens are questions: the secondary hover at 80 percent (P2), the dialog overlay black at 50 percent, the popover `shadow-md` (P3) and the 1 px press on active.

## Contrast

Minimums:

- 4.5:1 for every text pair in light and dark. The docs never use the 3:1 large-text allowance.
- 3:1 for input borders, control boundaries, each focus ring half, the block border and the now line.
- 9:1 between the two focus ring halves (WCAG technique C40), so one half reaches 3:1 on any fill.
- 4.58:1 for black or white block text and the state markers on any fill.

The page checks 275 required pairs and 14 rule checks, and all of them pass. Each theme has 138 pairs; the block text row over any sRGB color is the same in both themes and counts once. Ratios use WCAG 2 relative luminance. Each ratio is the lower of the hex result and the unrounded oklch result (the culori method of the repository test: `toGamut("rgb", "oklch")`, then `wcagContrast`), rounded down to two decimals. They are pre-test values until `packages/ui/test/tokens.contrast.test.ts` exists (Q4).

| Group | Pairs per theme | Minimum | Lowest light | Lowest dark |
|---|---|---|---|---|
| Text | 50 | 4.5:1 | 5.41 | 5.92 |
| Non-text | 15 | 3:1 | 3.44 | 3.69 |
| Focus ring | 41 | 3:1 | 3.76 | 4.54 |
| Block text and markers | 30 | 4.58:1 | 5.56 | 5.49 |

### Text pairs, minimum 4.5:1

Spec pairs P1 to P11. Status badge icons use the badge text color, so the badge rows also cover P18.

| Spec | Pair | Tokens | Light colors | Light | Dark colors | Dark | Min |
|---|---|---|---|---|---|---|---|
| P1 | Body text | `--foreground` on `--background` | #171b1f on #f9fafb | 16.56 | #f0f2f4 on #151719 | 15.94 | 4.5 |
| P2 | Card text | `--card-foreground` on `--card` | #171b1f on #ffffff | 17.30 | #f0f2f4 on #1d2022 | 14.59 | 4.5 |
| P2 | Popover text | `--popover-foreground` on `--popover` | #171b1f on #ffffff | 17.30 | #f0f2f4 on #1d2022 | 14.59 | 4.5 |
| P1 | Text on group rows and table headers | `--foreground` on `--muted` | #171b1f on #eef0f3 | 15.16 | #f0f2f4 on #26292c | 12.98 | 4.5 |
| P1 | Text in a selected table row | `--foreground` on `--info-subtle` | #171b1f on #e6f2fe | 15.20 | #f0f2f4 on #172d43 | 12.53 | 4.5 |
| P3 | Muted text on muted | `--muted-foreground` on `--muted` | #575b60 on #eef0f3 | 5.98 | #aaaeb3 on #26292c | 6.55 | 4.5 |
| P4 | Muted text on background | `--muted-foreground` on `--background` | #575b60 on #f9fafb | 6.53 | #aaaeb3 on #151719 | 8.05 | 4.5 |
| P4 | Muted text on card | `--muted-foreground` on `--card` | #575b60 on #ffffff | 6.81 | #aaaeb3 on #1d2022 | 7.34 | 4.5 |
| P4 | Muted text on popover | `--muted-foreground` on `--popover` | #575b60 on #ffffff | 6.81 | #aaaeb3 on #1d2022 | 7.34 | 4.5 |
| P4 | Muted text on a hovered item | `--muted-foreground` on `--accent` | #575b60 on #eef0f3 | 5.98 | #aaaeb3 on #26292c | 6.55 | 4.5 |
| P4 | Muted text in a selected row | `--muted-foreground` on `--info-subtle` | #575b60 on #e6f2fe | 5.99 | #aaaeb3 on #172d43 | 6.30 | 4.5 |
| P4 | Muted text in the sidebar | `--muted-foreground` on `--sidebar` | #575b60 on #ffffff | 6.81 | #aaaeb3 on #1d2022 | 7.34 | 4.5 |
| P5 | Primary button label | `--primary-foreground` on `--primary` | #fcfcfc on #22272c | 14.62 | #13161a on #e9ebee | 15.17 | 4.5 |
| P5 | Primary button label on hover | `--primary-foreground` on `--primary-hover` | #fcfcfc on #383e43 | 10.54 | #13161a on #cfd1d3 | 11.82 | 4.5 |
| P5 | Primary as text (shadcn link button variant) | `--primary` on `--background` | #22272c on #f9fafb | 14.40 | #e9ebee on #151719 | 15.02 | 4.5 |
| P5 | Primary as text on card | `--primary` on `--card` | #22272c on #ffffff | 15.05 | #e9ebee on #1d2022 | 13.71 | 4.5 |
| P6 | Secondary button label | `--secondary-foreground` on `--secondary` | #171b1f on #eef0f3 | 15.16 | #f0f2f4 on #26292c | 12.98 | 4.5 |
| P7 | Accent text on accent (hover surface) | `--accent-foreground` on `--accent` | #171b1f on #eef0f3 | 15.16 | #f0f2f4 on #26292c | 12.98 | 4.5 |
| P8 | Link on background | `--link` on `--background` | #1b589e on #f9fafb | 6.84 | #85bcf5 on #151719 | 8.99 | 4.5 |
| P8 | Link on card | `--link` on `--card` | #1b589e on #ffffff | 7.15 | #85bcf5 on #1d2022 | 8.19 | 4.5 |
| P8 | Link on popover | `--link` on `--popover` | #1b589e on #ffffff | 7.15 | #85bcf5 on #1d2022 | 8.19 | 4.5 |
| P8 | Link on muted | `--link` on `--muted` | #1b589e on #eef0f3 | 6.26 | #85bcf5 on #26292c | 7.31 | 4.5 |
| P8 | Link in a selected row | `--link` on `--info-subtle` | #1b589e on #e6f2fe | 6.29 | #85bcf5 on #172d43 | 7.03 | 4.5 |
| P9 | Field error text on background | `--destructive` on `--background` | #b02b27 on #f9fafb | 6.23 | #f7857d on #151719 | 7.31 | 4.5 |
| P9 | Field error text on card | `--destructive` on `--card` | #b02b27 on #ffffff | 6.51 | #f7857d on #1d2022 | 6.71 | 4.5 |
| P9 | Field error text on popover | `--destructive` on `--popover` | #b02b27 on #ffffff | 6.51 | #f7857d on #1d2022 | 6.71 | 4.5 |
| P9 | Destructive text on destructive tint (outline button hover) | `--destructive` on `--destructive-subtle` | #b02b27 on #ffebe8 | 5.68 | #f7857d on #481b19 | 5.92 | 4.5 |
| P9 | Text on a destructive fill | `--destructive-foreground` on `--destructive` | #f9fafb on #b02b27 | 6.23 | #151719 on #f7857d | 7.31 | 4.5 |
| P10 | Sidebar text | `--sidebar-foreground` on `--sidebar` | #171b1f on #ffffff | 17.30 | #f0f2f4 on #1d2022 | 14.59 | 4.5 |
| P10 | Sidebar hovered item | `--sidebar-accent-foreground` on `--sidebar-accent` | #171b1f on #eef0f3 | 15.16 | #f0f2f4 on #26292c | 12.98 | 4.5 |
| P10 | Sidebar primary item | `--sidebar-primary-foreground` on `--sidebar-primary` | #fcfcfc on #22272c | 14.62 | #13161a on #e9ebee | 15.17 | 4.5 |
| P11 | Status badge registered | `--status-registered-foreground` on `--status-registered` | #171b1f on #eef0f3 | 15.16 | #f0f2f4 on #26292c | 12.98 | 4.5 |
| P11 | Status badge planned | `--status-planned-foreground` on `--status-planned` | #1a609e on #e6f2fe | 5.73 | #85bcf5 on #172d43 | 7.03 | 4.5 |
| P11 | Status badge active | `--status-active-foreground` on `--status-active` | #246e3a on #e1f5e4 | 5.42 | #76cf8a on #15301b | 7.52 | 4.5 |
| P11 | Status badge paused | `--status-paused-foreground` on `--status-paused` | #8d5406 on #fdefd2 | 5.41 | #f0be67 on #38280a | 8.31 | 4.5 |
| P11 | Status badge finished | `--status-finished-foreground` on `--status-finished` | #246e3a on #e1f5e4 | 5.42 | #76cf8a on #15301b | 7.52 | 4.5 |
| P11 | Status badge delivered | `--status-delivered-foreground` on `--status-delivered` | #171b1f on #eef0f3 | 15.16 | #f0f2f4 on #26292c | 12.98 | 4.5 |
| P11 | Status badge cancelled | `--status-cancelled-foreground` on `--status-cancelled` | #575b60 on #eef0f3 | 5.98 | #aaaeb3 on #26292c | 6.55 | 4.5 |
| P11 | Late badge | `--late-foreground` on `--late` | #b02b27 on #ffebe8 | 5.68 | #f7857d on #481b19 | 5.92 | 4.5 |
| P11 | Lock owner badge | `--lock-owner-foreground` on `--lock-owner` | #171b1f on #eef0f3 | 15.16 | #f0f2f4 on #26292c | 12.98 | 4.5 |
| P11 | Success text on background | `--success` on `--background` | #246e3a on #f9fafb | 5.94 | #76cf8a on #151719 | 9.40 | 4.5 |
| P11 | Success text on card | `--success` on `--card` | #246e3a on #ffffff | 6.20 | #76cf8a on #1d2022 | 8.62 | 4.5 |
| P11 | Success text on success-subtle | `--success` on `--success-subtle` | #246e3a on #e1f5e4 | 5.42 | #76cf8a on #15301b | 7.52 | 4.5 |
| P11 | Warning text on background | `--warning` on `--background` | #8d5406 on #f9fafb | 5.90 | #f0be67 on #151719 | 10.49 | 4.5 |
| P11 | Warning text on card | `--warning` on `--card` | #8d5406 on #ffffff | 6.17 | #f0be67 on #1d2022 | 9.56 | 4.5 |
| P11 | Warning text on warning-subtle | `--warning` on `--warning-subtle` | #8d5406 on #fdefd2 | 5.41 | #f0be67 on #38280a | 8.31 | 4.5 |
| P11 | Info text on background | `--info` on `--background` | #1a609e on #f9fafb | 6.25 | #85bcf5 on #151719 | 8.99 | 4.5 |
| P11 | Info text on card | `--info` on `--card` | #1a609e on #ffffff | 6.53 | #85bcf5 on #1d2022 | 8.19 | 4.5 |
| P11 | Info text on info-subtle | `--info` on `--info-subtle` | #1a609e on #e6f2fe | 5.73 | #85bcf5 on #172d43 | 7.03 | 4.5 |
| P1 | Now label on the now fill | `--now-foreground` on `--now` | #f9fafb on #b02b27 | 6.23 | #151719 on #f7857d | 7.31 | 4.5 |

### Non-text pairs, minimum 3:1

Spec pairs P13, P15 and P16, plus the invalid field border and the now line.

| Spec | Pair | Tokens | Light colors | Light | Dark colors | Dark | Min |
|---|---|---|---|---|---|---|---|
| P13 | Input border on background | `--input` on `--background` | #7c8186 on #f9fafb | 3.76 | #7c8186 on #151719 | 4.54 | 3 |
| P13 | Input border on card | `--input` on `--card` | #7c8186 on #ffffff | 3.93 | #7c8186 on #1d2022 | 4.16 | 3 |
| P13 | Input border on popover | `--input` on `--popover` | #7c8186 on #ffffff | 3.93 | #7c8186 on #1d2022 | 4.16 | 3 |
| P13 | Input border on muted | `--input` on `--muted` | #7c8186 on #eef0f3 | 3.44 | #7c8186 on #26292c | 3.69 | 3 |
| P13 | Input border in the sidebar | `--input` on `--sidebar` | #7c8186 on #ffffff | 3.93 | #7c8186 on #1d2022 | 4.16 | 3 |
| P16 | Checked checkbox or radio (primary fill) on background | `--primary` on `--background` | #22272c on #f9fafb | 14.40 | #e9ebee on #151719 | 15.02 | 3 |
| P16 | Checked checkbox or radio (primary fill) on card | `--primary` on `--card` | #22272c on #ffffff | 15.05 | #e9ebee on #1d2022 | 13.71 | 3 |
| P13 | Invalid field border on background | `--destructive` on `--background` | #b02b27 on #f9fafb | 6.23 | #f7857d on #151719 | 7.31 | 3 |
| P13 | Invalid field border on card | `--destructive` on `--card` | #b02b27 on #ffffff | 6.51 | #f7857d on #1d2022 | 6.71 | 3 |
| P15 | Block border on lane | `--block-border` on `--lane` | #171b1f on #ffffff | 17.30 | #c2c4c7 on #1a1c1e | 9.77 | 3 |
| P15 | Block border on alternate lane | `--block-border` on `--lane-alt` | #171b1f on #f6f8fa | 16.24 | #c2c4c7 on #1e2123 | 9.26 | 3 |
| P15 | Block border on non-working shading | `--block-border` on `--off-time` | #171b1f on #e9ebee | 14.49 | #c2c4c7 on #111315 | 10.65 | 3 |
| P15 | Now line on lane | `--now` on `--lane` | #b02b27 on #ffffff | 6.51 | #f7857d on #1a1c1e | 6.98 | 3 |
| P15 | Now line on alternate lane | `--now` on `--lane-alt` | #b02b27 on #f6f8fa | 6.12 | #f7857d on #1e2123 | 6.62 | 3 |
| P15 | Now line on non-working shading | `--now` on `--off-time` | #b02b27 on #e9ebee | 5.45 | #f7857d on #111315 | 7.61 | 3 |

### Focus ring halves, minimum 3:1

Spec pair P14. The inner band in `--focus-ring` touches the control edge; the outer band in `--focus-outline` touches the surface around it.

| Spec | Pair | Tokens | Light colors | Light | Dark colors | Dark | Min |
|---|---|---|---|---|---|---|---|
| P14 | Ring halves against each other | `--focus-outline` on `--focus-ring` | #171b1f on #f9fafb | 16.56 | #f0f2f4 on #151719 | 15.94 | 3 |
| P14 | Ring halves 9:1 apart, so one half reaches 3:1 on any fill (WCAG technique C40) | `--focus-outline` on `--focus-ring` | #171b1f on #f9fafb | 16.56 | #f0f2f4 on #151719 | 15.94 | 9 |
| P14 | Outer half on background | `--focus-outline` on `--background` | #171b1f on #f9fafb | 16.56 | #f0f2f4 on #151719 | 15.94 | 3 |
| P14 | Outer half on card | `--focus-outline` on `--card` | #171b1f on #ffffff | 17.30 | #f0f2f4 on #1d2022 | 14.59 | 3 |
| P14 | Outer half on popover | `--focus-outline` on `--popover` | #171b1f on #ffffff | 17.30 | #f0f2f4 on #1d2022 | 14.59 | 3 |
| P14 | Outer half on muted | `--focus-outline` on `--muted` | #171b1f on #eef0f3 | 15.16 | #f0f2f4 on #26292c | 12.98 | 3 |
| P14 | Outer half on secondary | `--focus-outline` on `--secondary` | #171b1f on #eef0f3 | 15.16 | #f0f2f4 on #26292c | 12.98 | 3 |
| P14 | Outer half on accent | `--focus-outline` on `--accent` | #171b1f on #eef0f3 | 15.16 | #f0f2f4 on #26292c | 12.98 | 3 |
| P14 | Outer half on sidebar | `--focus-outline` on `--sidebar` | #171b1f on #ffffff | 17.30 | #f0f2f4 on #1d2022 | 14.59 | 3 |
| P14 | Outer half on sidebar-accent | `--focus-outline` on `--sidebar-accent` | #171b1f on #eef0f3 | 15.16 | #f0f2f4 on #26292c | 12.98 | 3 |
| P14 | Outer half on info-subtle | `--focus-outline` on `--info-subtle` | #171b1f on #e6f2fe | 15.20 | #f0f2f4 on #172d43 | 12.53 | 3 |
| P14 | Outer half on lane | `--focus-outline` on `--lane` | #171b1f on #ffffff | 17.30 | #f0f2f4 on #1a1c1e | 15.22 | 3 |
| P14 | Outer half on lane-alt | `--focus-outline` on `--lane-alt` | #171b1f on #f6f8fa | 16.24 | #f0f2f4 on #1e2123 | 14.42 | 3 |
| P14 | Outer half on off-time | `--focus-outline` on `--off-time` | #171b1f on #e9ebee | 14.49 | #f0f2f4 on #111315 | 16.59 | 3 |
| P14 | Inner half against primary button and checked checkbox | `--focus-ring` on `--primary` | #f9fafb on #22272c | 14.40 | #151719 on #e9ebee | 15.02 | 3 |
| P14 | Inner half against primary button on hover | `--focus-ring` on `--primary-hover` | #f9fafb on #383e43 | 10.36 | #151719 on #cfd1d3 | 11.70 | 3 |
| P14 | Inner half against destructive button and invalid field border | `--focus-ring` on `--destructive` | #f9fafb on #b02b27 | 6.23 | #151719 on #f7857d | 7.31 | 3 |
| P14 | Inner half against the input border (outline button, unchecked checkbox) | `--focus-ring` on `--input` | #f9fafb on #7c8186 | 3.76 | #151719 on #7c8186 | 4.54 | 3 |
| P14 | Inner half against focused board block | `--focus-ring` on `--block-border` | #f9fafb on #171b1f | 16.56 | #151719 on #c2c4c7 | 10.26 | 3 |

### Focus ring over order and group fills, minimum 3:1

A focused block's ring overlaps its neighbors. Each row shows the half with the higher ratio: `--focus-outline` in light, `--focus-ring` in dark.

| Spec | Pair | Tokens | Light colors | Light | Dark colors | Dark | Min |
|---|---|---|---|---|---|---|---|
| P14 | Ring over palette-1 | better half on `--palette-1` | #171b1f on #eba295 | 8.35 | #151719 on #d0897d | 6.46 | 3 |
| P14 | Ring over palette-2 | better half on `--palette-2` | #171b1f on #d9af75 | 8.52 | #151719 on #bf965d | 6.62 | 3 |
| P14 | Ring over palette-3 | better half on `--palette-3` | #171b1f on #b0c07e | 8.81 | #151719 on #97a766 | 6.84 | 3 |
| P14 | Ring over palette-4 | better half on `--palette-4` | #171b1f on #7ecaa9 | 8.98 | #151719 on #65b090 | 6.98 | 3 |
| P14 | Ring over palette-5 | better half on `--palette-5` | #171b1f on #6cc7d7 | 8.89 | #151719 on #51aebd | 6.92 | 3 |
| P14 | Ring over palette-6 | better half on `--palette-6` | #171b1f on #90baf1 | 8.63 | #151719 on #78a1d6 | 6.71 | 3 |
| P14 | Ring over palette-7 | better half on `--palette-7` | #171b1f on #c0abe9 | 8.41 | #151719 on #a792ce | 6.50 | 3 |
| P14 | Ring over palette-8 | better half on `--palette-8` | #171b1f on #e2a0c5 | 8.30 | #151719 on #c788ab | 6.41 | 3 |
| P14 | Ring over palette-9 | better half on `--palette-9` | #171b1f on #f9becf | 10.95 | #151719 on #dea5b5 | 8.67 | 3 |
| P14 | Ring over palette-10 | better half on `--palette-10` | #171b1f on #f4c7a3 | 11.15 | #151719 on #d9ad8a | 8.81 | 3 |
| P14 | Ring over palette-11 | better half on `--palette-11` | #171b1f on #cbd8a5 | 11.46 | #151719 on #b1bf8c | 9.09 | 3 |
| P14 | Ring over palette-12 | better half on `--palette-12` | #171b1f on #9ee1d3 | 11.63 | #151719 on #85c7b9 | 9.22 | 3 |
| P14 | Ring over palette-13 | better half on `--palette-13` | #171b1f on #a8d8fb | 11.41 | #151719 on #8fbee0 | 9.04 | 3 |
| P14 | Ring over palette-14 | better half on `--palette-14` | #171b1f on #d8c7f9 | 11.09 | #151719 on #beaede | 8.76 | 3 |
| P14 | Ring over palette-15 | better half on `--palette-15` | #171b1f on #d68580 | 6.20 | #151719 on #bb6d68 | 4.69 | 3 |
| P14 | Ring over palette-16 | better half on `--palette-16` | #171b1f on #bc9951 | 6.43 | #151719 on #a38137 | 4.88 | 3 |
| P14 | Ring over palette-17 | better half on `--palette-17` | #171b1f on #77af76 | 6.73 | #151719 on #5f965f | 5.12 | 3 |
| P14 | Ring over palette-18 | better half on `--palette-18` | #171b1f on #41b0bb | 6.72 | #151719 on #1d97a2 | 5.12 | 3 |
| P14 | Ring over palette-19 | better half on `--palette-19` | #171b1f on #7f9edd | 6.43 | #151719 on #6785c3 | 4.87 | 3 |
| P14 | Ring over palette-20 | better half on `--palette-20` | #171b1f on #bd89c2 | 6.19 | #151719 on #a471a8 | 4.68 | 3 |
| P14 | Ring over group-1 | better half on `--group-1` | #171b1f on #1d9999 | 4.97 | #151719 on #39abab | 6.49 | 3 |
| P14 | Ring over group-2 | better half on `--group-2` | #171b1f on #8f78ba | 4.58 | #151719 on #a28acd | 6.00 | 3 |

### Block text on the palette and group fills, minimum 4.58:1

Spec pair P12. `textColorFor` picks pure black or pure white, whichever ratio is higher; every palette and group fill takes black in both themes.

| Spec | Pair | Tokens | Light colors | Light | Dark colors | Dark | Min |
|---|---|---|---|---|---|---|---|
| P12 | Block text on palette-1 | black on `--palette-1` | #000000 on #eba295 | 10.13 | #000000 on #d0897d | 7.55 | 4.58 |
| P12 | Block text on palette-2 | black on `--palette-2` | #000000 on #d9af75 | 10.33 | #000000 on #bf965d | 7.73 | 4.58 |
| P12 | Block text on palette-3 | black on `--palette-3` | #000000 on #b0c07e | 10.68 | #000000 on #97a766 | 8.03 | 4.58 |
| P12 | Block text on palette-4 | black on `--palette-4` | #000000 on #7ecaa9 | 10.90 | #000000 on #65b090 | 8.16 | 4.58 |
| P12 | Block text on palette-5 | black on `--palette-5` | #000000 on #6cc7d7 | 10.78 | #000000 on #51aebd | 8.12 | 4.58 |
| P12 | Block text on palette-6 | black on `--palette-6` | #000000 on #90baf1 | 10.47 | #000000 on #78a1d6 | 7.86 | 4.58 |
| P12 | Block text on palette-7 | black on `--palette-7` | #000000 on #c0abe9 | 10.21 | #000000 on #a792ce | 7.63 | 4.58 |
| P12 | Block text on palette-8 | black on `--palette-8` | #000000 on #e2a0c5 | 10.06 | #000000 on #c788ab | 7.52 | 4.58 |
| P12 | Block text on palette-9 | black on `--palette-9` | #000000 on #f9becf | 13.29 | #000000 on #dea5b5 | 10.15 | 4.58 |
| P12 | Block text on palette-10 | black on `--palette-10` | #000000 on #f4c7a3 | 13.53 | #000000 on #d9ad8a | 10.29 | 4.58 |
| P12 | Block text on palette-11 | black on `--palette-11` | #000000 on #cbd8a5 | 13.90 | #000000 on #b1bf8c | 10.66 | 4.58 |
| P12 | Block text on palette-12 | black on `--palette-12` | #000000 on #9ee1d3 | 14.11 | #000000 on #85c7b9 | 10.81 | 4.58 |
| P12 | Block text on palette-13 | black on `--palette-13` | #000000 on #a8d8fb | 13.86 | #000000 on #8fbee0 | 10.60 | 4.58 |
| P12 | Block text on palette-14 | black on `--palette-14` | #000000 on #d8c7f9 | 13.45 | #000000 on #beaede | 10.28 | 4.58 |
| P12 | Block text on palette-15 | black on `--palette-15` | #000000 on #d68580 | 7.52 | #000000 on #bb6d68 | 5.50 | 4.58 |
| P12 | Block text on palette-16 | black on `--palette-16` | #000000 on #bc9951 | 7.81 | #000000 on #a38137 | 5.72 | 4.58 |
| P12 | Block text on palette-17 | black on `--palette-17` | #000000 on #77af76 | 8.17 | #000000 on #5f965f | 6.00 | 4.58 |
| P12 | Block text on palette-18 | black on `--palette-18` | #000000 on #41b0bb | 8.15 | #000000 on #1d97a2 | 6.00 | 4.58 |
| P12 | Block text on palette-19 | black on `--palette-19` | #000000 on #7f9edd | 7.80 | #000000 on #6785c3 | 5.71 | 4.58 |
| P12 | Block text on palette-20 | black on `--palette-20` | #000000 on #bd89c2 | 7.52 | #000000 on #a471a8 | 5.49 | 4.58 |
| P12 | Block text on group-1 | black on `--group-1` | #000000 on #1d9999 | 6.04 | #000000 on #39abab | 7.58 | 4.58 |
| P12 | Block text on group-2 | black on `--group-2` | #000000 on #8f78ba | 5.56 | #000000 on #a28acd | 7.04 | 4.58 |

### State markers, minimum 4.58:1

Spec pair P17. Every marker is drawn in the block text color, so each is checked on `--palette-20`, the palette fill where black block text contrasts least.

| Spec | Pair | Tokens | Light colors | Light | Dark colors | Dark | Min |
|---|---|---|---|---|---|---|---|
| P17 | Mine in draft: pencil icon, double border | black on `--palette-20` | #000000 on #bd89c2 | 7.52 | #000000 on #a471a8 | 5.49 | 4.58 |
| P17 | Held by another planner: initials badge, dashed border | black on `--palette-20` | #000000 on #bd89c2 | 7.52 | #000000 on #a471a8 | 5.49 | 4.58 |
| P17 | Hard-locked: padlock icon, solid 2 px inner border | black on `--palette-20` | #000000 on #bd89c2 | 7.52 | #000000 on #a471a8 | 5.49 | 4.58 |
| P17 | Started: play icon, progress bar along the bottom | black on `--palette-20` | #000000 on #bd89c2 | 7.52 | #000000 on #a471a8 | 5.49 | 4.58 |
| P17 | Proposed by the assistant: spark icon, dotted border | black on `--palette-20` | #000000 on #bd89c2 | 7.52 | #000000 on #a471a8 | 5.49 | 4.58 |
| P17 | Conflict: striped edge | black on `--palette-20` | #000000 on #bd89c2 | 7.52 | #000000 on #a471a8 | 5.49 | 4.58 |
| P17 | Late: clock icon | black on `--palette-20` | #000000 on #bd89c2 | 7.52 | #000000 on #a471a8 | 5.49 | 4.58 |
| P17 | Material warning: warning triangle | black on `--palette-20` | #000000 on #bd89c2 | 7.52 | #000000 on #a471a8 | 5.49 | 4.58 |

### Any sRGB fill, minimum 3 or 4.58:1

Order colors can be any sRGB color (the ERP ColorCode or a user edit). These rows scan all 16,777,216 sRGB colors and report the worst one.

| Spec | Pair | Tokens | Light colors | Light | Dark colors | Dark | Min |
|---|---|---|---|---|---|---|---|
| P14 | Two-tone ring over the worst of all 16,777,216 sRGB colors (better half) | `--focus-outline` or `--focus-ring` on any sRGB color | #171b1f/#f9fafb on #b86350 | 4.06 | #f0f2f4/#151719 on #7b6ac2 | 3.99 | 3 |
| P12 | Block text (textColorFor) on the worst of all 16,777,216 sRGB colors, so any ERP or user color | black or white on any sRGB color | #000000/#ffffff on #cf0dcc | 4.58 | #000000/#ffffff on #cf0dcc | 4.58 | 4.58 |

### Rule checks (14)

| Check | Value | Rule |
|---|---|---|
| `--input` lightness, light | 0.6 | 0.669 or lower (06 Design tokens) |
| `--muted-foreground` lightness, light | 0.47 | 0.547 or lower (06 Design tokens) |
| Order palette size and distinct values, light | 20 colors, 20 distinct | 20 distinct colors (06 Design tokens; A20) |
| Every token inside sRGB, light | 84 of 84 | No gamut mapping needed |
| Hex equals the sRGB rendering of oklch, light | 84 of 84 | Hex is derived, oklch is the source |
| Tokens marked with "=" hold the same value, light | 0 mismatches | Aliases agree |
| `--input` lightness, dark | 0.6 | 0.478 or higher (06 Design tokens) |
| Order palette size and distinct values, dark | 20 colors, 20 distinct | 20 distinct colors (06 Design tokens; A20) |
| Every token inside sRGB, dark | 84 of 84 | No gamut mapping needed |
| Hex equals the sRGB rendering of oklch, dark | 84 of 84 | Hex is derived, oklch is the source |
| Tokens marked with "=" hold the same value, dark | 0 mismatches | Aliases agree |
| `--block-border` in light equals `--foreground` | `oklch(0.22 0.01 250)` | 06 Color and contrast; 07 Block states |
| `--block-border` in dark is its own light token, not `--background` | `oklch(0.82 0.005 250)` | 06 Color and contrast; 07 Block states |
| Focus ring halves are the foreground and background values, both themes | `--focus-outline` = `--foreground`, `--focus-ring` = `--background` | 06 Color and contrast |

### Not required, for reference

| Pair | Tokens | Light colors | Light | Dark colors | Dark |
|---|---|---|---|---|---|
| Decorative divider (exempt) | `--border` on `--background` | #dbdee1 on #f9fafb | 1.29 | #3a3d41 on #151719 | 1.64 |
| Decorative card border (exempt) | `--border` on `--card` | #dbdee1 on #ffffff | 1.34 | #3a3d41 on #1d2022 | 1.50 |
| Machine row stripe in group-1 on card (groups also have text rows) | `--group-1` on `--card` | #1d9999 on #ffffff | 3.46 | #39abab on #1d2022 | 5.91 |
| Machine row stripe in group-2 on card (groups also have text rows) | `--group-2` on `--card` | #8f78ba on #ffffff | 3.77 | #a28acd on #1d2022 | 5.50 |
| Background token on lane (the old dark block border rule) | `--background` on `--lane` | #f9fafb on #ffffff | 1.04 | #151719 on #1a1c1e | 1.04 |
| Primary against body text (Graphite open question) | `--primary` on `--foreground` | #22272c on #171b1f | 1.14 | #e9ebee on #f0f2f4 | 1.06 |
| Inner half against a secondary button or tab edge (the outer half carries 3:1, C40) | `--focus-ring` on `--secondary` | #f9fafb on #eef0f3 | 1.09 | #151719 on #26292c | 1.22 |
| Inner half against a ghost or link button on background (the outer half carries 3:1, C40) | `--focus-ring` on `--background` | #f9fafb on #f9fafb | 1.00 | #151719 on #151719 | 1.00 |

The closest two of the 20 order colors are `--palette-1` and `--palette-8`, 0.0689 apart in OKLab in both themes, the same spacing as Graphite's own 8 colors. The docs set no distinctness measure (Q9).

## Focus ring

```css
:focus-visible {
  outline: 2px solid var(--focus-outline);
  outline-offset: 2px;
  box-shadow: 0 0 0 2px var(--focus-ring);
}
```

- The inner 2 px band in `--focus-ring` (the background value) touches the control edge. The outer 2 px band in `--focus-outline` (the foreground value) touches the surface around it.
- The outer half is an outline, so forced-colors mode keeps it.
- The ring replaces shadcn's `outline-ring/50` in the base layer. `--ring` and `--sidebar-ring` hold the `--focus-outline` value for components that read them, without the /50.
- The halves are 16.56:1 apart in light and 15.94:1 in dark. Over all 16,777,216 sRGB colors the better half reaches at least 4.06:1 in light (fill #b86350) and 3.99:1 in dark (fill #7b6ac2).
- A secondary button, a tab, a ghost button and a link have no edge of their own, so the inner half sits on their fill or surface (1.00 to 1.22:1) and the outer half carries 3:1 (C40).
- Menu and listbox items draw a 2 px inset outline in `--focus-outline` on the `--accent` highlight instead of the ring (P4).
- A selected tab with focus uses `box-shadow: 0 0 0 2px var(--focus-ring), inset 0 -2px 0 var(--foreground)`, so the inner band and the underline both stay.
- An invalid field with focus uses `box-shadow: 0 0 0 2px var(--focus-ring), inset 0 0 0 1px var(--destructive)`.
- Focus only shows the ring and scrolls the element into view. Selection is separate (`aria-selected`).

## State markers

Each state has an icon or line style drawn in the block's text color, text in the accessible name, and a line in the hover card. No state maps to a hue, so the fill stays the order color in every state. In forced-colors mode the borders, icons and line styles keep each state readable.

| State | Cue | Accessible name adds |
|---|---|---|
| Committed | No marker | "5006.10, Housing P, 120 pcs, Tue 06:00 to Tue 14:00, Mill 1" |
| Mine in draft | Pencil icon (Pencil) and a double border | "changed in your draft, not saved" |
| Held by another planner | That planner's initials badge and a dashed border | "being edited by Planner B" |
| Hard-locked | Padlock icon (Lock) and a solid 2 px inner border | "locked" |
| Started | Play icon (Play) and a progress bar along the bottom | "started, 40 of 120 pcs" |
| Proposed by the assistant | Spark icon (Sparkles) in the text color and a dotted border | "proposed by assistant, not reviewed" |
| Conflict | Striped edge | "overlaps 5008.10" |
| Late | Clock icon (Clock) | "late by 2 days" |
| Material warning | Warning triangle (TriangleAlert) | "material short" |
| Overdue | Set in the board design task D3 under the same rule (Q14) | "overdue" |
| Finish pending | Set in the board design task D3 under the same rule (Q14) | "finish pending" |

- Every marker is checked on `--palette-20`, where black block text contrasts least: 7.52:1 in light and 5.49:1 in dark.
- Board blocks have a 1 px `--block-border` and a 1 px gap, take their fill from a CSS variable, and draw text and markers in `textColorFor(fill)` through `currentColor`.
- State markers never use outline or box-shadow, which belong to the focus ring. The border styles sit on `::before`, the conflict stripe on `::after`, and the Started progress bar is a child element. A hard-locked block keeps its solid inner border while it has focus.
- At bar density the icons do not fit. The state then lives in the accessible name, the cluster popover rows and the hover card, for example "4 jobs, 07:00 to 09:10, 2 late, 1 being edited by Planner B".

## Fonts and icons

- IBM Plex Sans (`--font-sans`) sets interface text: 400 for body text and inputs, 500 for buttons and tabs, 600 for titles, labels and badges, 700 for the first line of a board block. It covers Latin, Greek and Cyrillic.
- IBM Plex Mono (`--font-mono`) sets numbers, always with tabular figures. It covers Latin and Cyrillic, not Greek, and stays for numbers, which use digits and Latin letters only.
- Both fonts are under the SIL Open Font License and are self-hosted and bundled; the product makes no CDN calls. `theme.css` maps the families to font-sans and font-mono. Only the design page loads them from Google Fonts.
- Sizes are in rem, so 200 percent text zoom grows rows and text containers. Only board blocks keep a fixed height.
- Icons come from lucide-react through `@northmes/ui` and are named by their lucide-react component names. The implementer takes no icon from the canvas. Icons are decorative next to text; an icon-only control gets its accessible name from IconButton's required label prop.
- Icon sizes: 12 px with stroke 3 for the checkbox, 14 px for badges, blocks and errors, 16 px with stroke 2 as the default, 24 px for large icons.

Type scale (Graphite, proposed for Q18):

| Role | Size / line height | Weight, family |
|---|---|---|
| Page title | 1.75rem / 2.125rem (28 / 34) | 600 Sans |
| Section | 1.25rem / 1.75rem (20 / 28) | 600 Sans |
| Body | 0.875rem / 1.25rem (14 / 20) | 400 Sans |
| Label | 0.75rem / 1rem (12 / 16) | 600 Sans |
| Small | 0.75rem / 1rem (12 / 16) | 400 Sans |
| Data | 0.8125rem / 1.125rem (13 / 18) | 500 Mono |
| Block | 0.75rem / 1rem (12 / 16) | 700 Mono, 400 Sans |
| Station number | 2rem / 2.5rem (32 / 40) | 600 Mono, 400 Sans |

Icons and their uses:

| Icon | Use |
|---|---|
| Pencil | Marker: mine in draft |
| Lock | Marker: hard-locked; lock owner badge |
| Play | Marker: started; status active |
| Sparkles | Marker: proposed by the assistant |
| Clock | Marker and badge: late |
| TriangleAlert | Marker: material warning; warning toast |
| CircleDashed | Status registered (proposal) |
| Info | Status planned; info toast |
| Pause | Status paused |
| CircleCheck | Status finished; success toast |
| Truck | Status delivered (proposal) |
| Ban | Status cancelled (proposal) |
| Check | Checkbox; selected option |
| Minus | Indeterminate checkbox |
| Plus | New |
| ChevronDown | Select and Combobox trigger |
| ChevronLeft | Previous page |
| ChevronRight | Next page |
| ArrowUp | Sorted ascending |
| ArrowDown | Sorted descending |
| ArrowUpDown | Sortable, not sorted |
| Search | Search input; Lookup |
| X | Clear; close Dialog and Sheet |
| CircleAlert | Field error; error summary |
| CircleX | Error toast |
| Ellipsis | Row and block menu trigger |
| LoaderCircle | Button loading; Combobox searching |
| Eye | Show password (Q13) |

The build notes also list User, Sun and Moon.

## Keyboard and focus

- Keys for the standard composites follow the WAI-ARIA Authoring Practices and the Base UI defaults until Q11 is settled.
- Every focus stop draws the two-tone ring, except menu and listbox items (P4).
- Tab order on a list page: Skip to main content first, then the navigation links, the account button, search, the status filter, Clear filters, New order, the sortable column headers, the row links and Next. A disabled Previous is skipped.
- Skip to main content moves focus into main (2.4.1). After a route change focus goes to the h1 (tabindex -1), else to main; search parameter changes do not move focus (2.4.3).
- Focus not obscured (2.4.11): the page scroller sets `scroll-padding-top` to the top bar height, the board scroller sets `scroll-padding` for its sticky time header and machine column, virtualized lists set `scrollPaddingStart`, the detail panel docks beside the content, and toasts sit away from board and form areas.
- Keyboard-only end-to-end flows run without `page.mouse`.

| Component | Keys | Focus after |
|---|---|---|
| Button, IconButton | Enter or Space activates | Stays on the button, unless the action opens or closes a layer |
| Input, NumberField | Type; Up and Down step a NumberField (Base UI default, Q11); Enter at a station never submits, only Send does | Stays in the field. On a submit with errors, focus moves to the error summary |
| Checkbox | Space toggles | Stays on the checkbox |
| Tabs | Left and Right move; Home and End go to the first and last; Tab goes into the panel | Arrow keys move between tabs; whether selection follows focus is the Base UI default (Q11) |
| Select | Enter, Space or Down opens; Up and Down move; Enter chooses; Esc closes | Back on the trigger after choosing or closing |
| Combobox | Type to filter; Down opens and moves; Enter chooses; Esc closes | Stays in the input; the active option is aria-activedescendant |
| Dropdown Menu | Enter, Space or Down opens; Up and Down move; Enter activates; Esc closes | Back on the trigger. On a board block the menu also opens with the context-menu key and Shift+F10 |
| Dialog, Alert Dialog, Sheet | Tab and Shift+Tab stay inside; Esc closes | Opening moves focus inside; closing returns it to the trigger |
| Tooltip, Hover Card | Open at once on focus; Esc closes | Focus does not move |
| Table | Tab reaches header buttons and cell links; Enter or Space sorts | Stays on the header button; aria-sort updates |
| Toast | Tab reaches the action | The toast never holds the only copy of an action |
| SkipLink | Tab: first stop; Enter goes | Moves into main |
| Board cell | Letter commands | Work only while a board cell has focus (2.1.4); board keys are set in D3 |

| Action | Where focus goes |
|---|---|
| Activate Break lock on a block or row | To the reason field; on close it returns to the trigger |
| Activate Save with two invalid fields | To the error summary at the top; each entry links to its field |
| Follow a link to another page | To the h1, else to main |
| Press Escape in a menu or choose an item | Back to the menu trigger |
| Tab onto a board block or an order link | The hover card opens at once; Escape closes it and focus stays |
| Tab or arrow onto any element | It scrolls into view and nothing else happens; panels open on Enter or click |

## WCAG 2.2 criteria

The issue names 1.4.3, 1.4.11, 2.4.7, 2.4.11 and 2.5.8. The other criteria come from the D1 spec.

| Criterion | Name | Where D1 applies it |
|---|---|---|
| 1.4.3 | Contrast (Minimum) | Every text pair at 4.5:1, no large-text allowance (F1, F2) |
| 1.4.11 | Non-text Contrast | Input border, focus ring halves, block border, checkbox (F1, F2, F4); the selected tab underline in F6, `--foreground` on `--card` 17.30:1 light, 14.59:1 dark |
| 2.4.7 | Focus Visible | Two-tone ring on every focus stop, except menu and listbox items, which draw a 2 px inset outline in `--focus-outline` (P4; F4, F6, F8) |
| 2.4.11 | Focus Not Obscured (Minimum) | scroll-padding-top, board scroll-padding, scrollPaddingStart, toasts placed away (F8) |
| 2.5.8 | Target Size (Minimum) | 24 px `--nm-target-min`, the checkbox hit area, 44 px at stations (F1, F6) |
| 1.4.1 | Use of Color | State markers, StatusBadge icon plus text, selected row checkbox (F4, F6) |
| 1.4.4 | Resize Text | rem sizes (F5) |
| 1.4.10 | Reflow | No fixed text heights except board blocks (F5) |
| 1.4.12 | Text Spacing | Text containers grow (F5) |
| 1.4.13 | Content on Hover or Focus | Tooltip, Hover Card (F6, F8) |
| 2.1.1 | Keyboard | Keys per component (F8) |
| 2.1.4 | Character Key Shortcuts | Letter commands only while a board cell has focus (F8) |
| 2.4.1 | Bypass Blocks | SkipLink (F8) |
| 2.4.3 | Focus Order | Tab order, focus on route change (F8) |
| 2.5.2, 2.5.7 | Pointer Cancellation, Dragging Movements | Board moves, set in D3 |
| 3.2.1 | On Focus | Focus only scrolls into view (F8) |
| 3.3.1, 3.3.3 | Error Identification, Error Suggestion | Field errors state the rule and the fix (F6) |
| 3.3.7 | Redundant Entry | A server error keeps entered values (F6 error toast) |
| 3.3.8 | Accessible Authentication (Minimum) | Password field with show toggle, not drawn (Q13) |
| 4.1.3 | Status Messages | Toasts, Combobox result count (F6) |
| EN 301 549 V4.1.1 clause 9.7 | Forced colors | Outline ring, markers, `forced-color-adjust: none` only on swatches |

## What the implementer takes

The implementer of E04-S01 takes from this page the layout, region order, states and their transitions (one test per state), copy text verbatim, the keyboard model and slot placements. It does not take markup, class names, inline styles, canvas icons, demo numbers or any token value that is not in `ui/tokens.css` as listed above. A value on the page that is not a token is a question, not a new color. The full rule is in [plan 06, Approval and what the implementer takes](../../plan/06-web-and-ux.md#approval-and-what-the-implementer-takes).

## Open questions and proposals

Q1 to Q21 come from the D1 spec. P1 to P5 come from building the page.

| Id | Question or proposal |
|---|---|
| Q1 | Does D1 draw the widths (1280, 1440, 1920, 320), a long-strings frame and the page states, or only the issue's frames? |
| Q2 | Focus ring geometry: inner and outer half, offset, outline or box-shadow, and the list of surfaces that make up every surface. |
| Q3 | Are the build notes, not the canvas, the source of the token values E04-S01 implements? |
| Q4 | May the contrast table show pre-test ratios until tokens.contrast.test.ts exists? |
| Q5 | Does choosing Graphite confirm the token base in ADR 0020, including the blue-tinted grays? |
| Q6 | Success, warning and info tokens and destructive-foreground. Proposed here: the -subtle pairs and destructive-foreground in the background value, because white on the dark destructive measures 2.44:1. |
| Q7 | Dark rule for muted-foreground on muted, and how the test treats alpha tokens. This page uses opaque values only. |
| Q8 | Disabled appearance, the button loading state and the indeterminate checkbox. Drawn here as proposals. |
| Q9 | Palette: distinctness measure (closest pair 0.0689 in OKLab), color-vision checks, the order of the 20, the default color, and how the board draws one ERP hex in dark. |
| Q10 | Equipment group colors: the 20 palette colors or a separate set, and how the board draws them (likely D3). |
| Q11 | Keys for the standard composites: WAI-ARIA Authoring Practices and Base UI defaults, or set in D1? |
| Q12 | How the build notes name NumberField, SkipLink, VisuallyHidden, ColorSwatchPicker, QuantityInput and Lookup. |
| Q13 | Do Radio Group, Textarea, the date picker, the password toggle and the error summary belong in D1, or in D2, D4 and the list and form page? |
| Q14 | Overdue and finish pending markers: proposed in D1 or set in D3? |
| Q15 | Precedence when several block borders combine, and a selection outline that differs from focus and the state borders. |
| Q16 | Which board tokens belong to D1 and which to D3 (lane, block-border, shading, sticky header, selection)? |
| Q17 | Does D1 show the 44 px station variants of the components, or do D2 and D4 cover them? |
| Q18 | Plex weights, the type scale, line heights and tabular figures. Graphite's scale is drawn in F5. |
| Q19 | chart-1 to chart-5 are not defined. The sidebar tokens reuse the card, primary and accent values. |
| Q20 | Does D1 need a forced-colors frame for markers, the focus ring and swatches? |
| Q21 | shadcn derives radius steps from 6 px as 3.6, 4.8 and 8.4 px, not Graphite's 3, 4 and 10 px. Keep the derived steps? |
| P1 | Status badge colors are a proposal. Registered, delivered and cancelled have no Graphite badge. |
| P2 | Secondary buttons hover with shadcn's 80 percent opacity, which is not a token. Keep it or add a hover token? The destructive button keeps Graphite's outline and hovers with destructive-subtle. |
| P3 | Popovers and menus use shadcn's shadow-md. Graphite draws no shadows. |
| P4 | A focused menu item needs a 2 px inset outline, because the accent highlight alone measures about 1.1:1 against the popover. |
| P5 | Not defined yet: chart colors, the board selection outline and a disabled color. |

Secondary buttons and tabs have no border, so the inner focus ring half measures 1.09:1 in light and 1.22:1 in dark against their edge. Whether they get an input border is open.
