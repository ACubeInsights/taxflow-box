# TaxFlow — Design System ("Paper & Ink")

> **How to use this file.** In Stitch, open the project, click **Edit Theme** in the canvas
> toolbar, and import this file as the project `DESIGN.md`. Everything from
> "Identity" through "Anti-patterns" is the import payload.
>
> The two sections after that are not. "Manual theme entry" is what you use *instead*, by
> hand, if the import does not work — importing it as well would duplicate every token.
> "Repo migration notes" is for our engineers. Neither belongs in Stitch.
>
> Once imported, screen-generation prompts must never restate colors, fonts, or radii.
> The theme is applied at project level; repeating tokens in a generation prompt causes
> the two to fight and produces visual drift.

---

## Identity

TaxFlow is a document vault where accounting firms and their clients exchange tax
paperwork. The product handles W-2s, 1099s, K-1s, signed returns, and the review
correspondence between a preparer and a client.

The interface should feel like **a well-made paper filing system rendered in software**:
the restraint of a private bank statement, the typographic care of a printed annual
report, the precision of a legal document. Confident and quiet. It is a place where
sensitive financial records are handled carefully, not a consumer app.

Three adjectives govern every decision: **archival, precise, unhurried.**

Explicitly *not*: playful, techy, startup-y, dashboard-y, gradient-heavy, or
"AI-generated-looking".

**Platform:** Responsive web, desktop-first (1440px reference), with a defined mobile
breakpoint at 390px for client-facing screens.

---

## Color

Light theme only. There is no dark mode in this system.

### Surfaces

| Role | Value | Use |
|---|---|---|
| `page` | `#FAF9F6` | Bone. The application background. Never pure white. |
| `card` | `#FFFFFF` | Raised content panels, list rows, modals. |
| `well` | `#F1EFEA` | Recessed areas: document preview wells, code/metadata blocks, disabled fields. |
| `wash` | `#F5F3EE` | Table header rows, hovered list rows, section bands. |

The page is warmer and darker than the card. That inversion — content lighter than its
background — is what makes panels read as sheets of paper laid on a desk.

### Rules and borders

| Role | Value | Use |
|---|---|---|
| `rule-hairline` | `#E3E0D8` | Dividers between list items, table rows, section separators. |
| `rule-control` | `#B8B3A6` | Borders on inputs, selects, textareas, secondary buttons. |
| `rule-strong` | `#8A867C` | Borders that must carry state or emphasis. |

Hierarchy is carried by **rules and spacing, not shadows**. Cards do not have drop
shadows. See "Elevation" below.

### Ink (text)

| Role | Value | Contrast on page | Use |
|---|---|---|---|
| `ink-primary` | `#16150F` | 17.4:1 | Headings, body copy, values. |
| `ink-secondary` | `#5C594F` | 6.6:1 | Supporting copy, descriptions, metadata. |
| `ink-muted` | `#8A867C` | 3.4:1 | Placeholders, disabled text, decorative icons. Never body copy. |

Near-black `#16150F` rather than pure `#000000`. Pure black on warm paper reads as a
printing error.

### Accent

| Role | Value | Contrast on page | Use |
|---|---|---|---|
| `accent` | `#1C3D5A` | 10.7:1 | Ink navy. Primary buttons, links, active nav, focus rings, progress fills. |
| `accent-hover` | `#14304A` | — | Primary button hover. |
| `accent-on` | `#FFFFFF` | 11.3:1 on accent | Text and icons on the accent fill. |
| `accent-wash` | `#EBEFF3` | — | Selected row backgrounds, active tab underlays. |

**One accent.** There is no secondary brand color. If a screen appears to need one, the
answer is hierarchy through type and spacing instead.

### Status ink

Document workflow states. Each is a text/border color; the matching `-wash` is its fill.

| State | Color | Wash | On page | On own wash |
|---|---|---|---|---|
| Not requested | `#5C594F` graphite | `#F1EFEA` | 6.7:1 | 6.1:1 |
| Uploaded | `#2F5D7C` wash blue | `#EDF1F4` | 6.7:1 | 6.2:1 |
| Under review | `#7A5C15` aged gold | `#F5F0E2` | 5.9:1 | 5.5:1 |
| Revision requested | `#8C2F26` seal red | `#F7EBE9` | 7.8:1 | 7.1:1 |
| Approved | `#2E5E4E` pine | `#E9F0ED` | 7.1:1 | 6.4:1 |
| Waived | `#6E6A5F` stone | `#F1EFEA` | 5.1:1 | 4.7:1 |

Every status ink clears AA against both the page and its own wash fill, which matters
because badge labels are set in the status ink on the status wash.

"Not requested" and "Waived" are deliberately close but not identical. They are both
"nothing is owed from the client right now", and the difference between them — outstanding
versus dismissed — is carried by the label and by stone being the lighter of the two.

Seal red `#8C2F26` doubles as the destructive-action color. It is the only red in the
system — there is no separate "error red".

Priority chips reuse the same ink: Urgent = seal red, High = aged gold, Medium = wash
blue, Low = stone.

---

## Typography

Three families. All available on Google Fonts.

| Role | Family | Weights | Use |
|---|---|---|---|
| Display | **Fraunces** | 400, 600 | Page titles, panel headings, empty-state headlines, auth hero. Set `SOFT` axis to 0 and `WONK` axis to 0 — serious, not whimsical. Optical size follows the rendered size. |
| Body | **IBM Plex Sans** | 400, 500, 600 | All UI text, labels, buttons, form fields, table cells. |
| Numeric | **IBM Plex Mono** | 400, 500 | Dates, file sizes, version numbers, IDs, countdowns, percentages, currency. Always tabular. |

The mono/sans split is functional, not decorative: anything a person scans down a column
to compare is set in mono so the digits align.

### Scale

Major third, 16px base.

- `display-lg` — 40px / 1.15 / -0.02em / Fraunces 600
- `display` — 30px / 1.2 / -0.02em / Fraunces 600
- `title` — 22px / 1.3 / -0.01em / Fraunces 600
- `body-lg` — 17px / 1.55 / 0 / Plex Sans 400
- `body` — 15px / 1.55 / 0 / Plex Sans 400
- `body-sm` — 13px / 1.5 / 0 / Plex Sans 400
- `label` — 12px / 1.4 / +0.06em / Plex Sans 500 / **uppercase** — the signature small label used above every field group and panel section
- `mono` — 13px / 1.4 / +0.01em / Plex Mono 400 / tabular figures
- `mono-sm` — 11px / 1.4 / +0.02em / Plex Mono 500

Body copy is measured to a maximum of **68 characters** per line. Descriptions and
help text never run the full width of a wide panel.

---

## Spacing and layout

4px base unit. Permitted steps: 4, 8, 12, 16, 24, 32, 40, 48, 64, 96. No values in
between.

- Content column max width: **1240px**, centered, with 32px gutters at desktop and 16px at mobile.
- Top navigation bar: **56px** tall, sticky, `card` background, 1px `rule-hairline` bottom border. No shadow.
- Two-column workspace split: fluid main column + fixed **380px** right rail, 24px gap. Collapses to stacked below 1024px.
- List row height: **56px** standard, **48px** compact.
- Panel internal padding: 24px desktop, 16px mobile.
- Vertical rhythm between major page sections: 40px.

Generous whitespace is the primary luxury signal. When in doubt, add space rather than
a border or a background tint.

---

## Radius, elevation, borders

**Radius** — small and strict. Nothing in this system is pill-shaped or heavily rounded.

- `chip` — 2px (status badges, tags, priority chips)
- `control` — 4px (buttons, inputs, selects)
- `panel` — 6px (cards, modals, drawers)

**Elevation** — cards and panels are flat, defined by a 1px `rule-hairline` border.
Shadows exist only on floating layers that sit above the page:

- Overlay shadow: `0 1px 2px rgba(22,21,15,0.04), 0 24px 48px -24px rgba(22,21,15,0.18)`

Applied to: modals, drawers, dropdown menus, toasts, popovers. Nothing else.

**Focus** — 2px `accent` outline at 2px offset on every interactive element. Never
removed, never replaced with a background-color-only state.

---

## Components

### Buttons

Minimum 40px tall, 16px horizontal padding, 8px gap between icon and label, `control`
radius, `body-sm` at weight 500. Label is sentence case, never all-caps.

- **Primary** — `accent` fill, `accent-on` text, no border. Exactly one per screen.
- **Secondary** — transparent fill, 1px `rule-control` border, `ink-primary` text. Hover fills `wash`.
- **Quiet** — no fill, no border, `ink-secondary` text. For tertiary actions inside rows and panels.
- **Destructive** — transparent fill, 1px seal-red border, seal-red text. Hover fills the seal-red wash.
- **Disabled** — 40% opacity, no hover.

### Inputs

44px tall, 12px/14px padding, `control` radius, 1px `rule-control` border, `card`
background, `body-sm` text, `ink-muted` placeholder. Focus swaps the border to `accent`
and adds the focus ring.

Labels sit **above** the field in `label` style — uppercase, letterspaced,
`ink-secondary`. No floating or placeholder-as-label patterns.

Validation errors appear below the field in `body-sm` seal red with a small inline icon.
The field border turns seal red. Character counters sit bottom-right in `mono-sm`.

### Panels

`card` background, 1px `rule-hairline` border, `panel` radius, 24px padding. An optional
header row: a `label`-style title on the left, actions on the right, with 16px of space
below before the content begins.

### The Spine

The signature element, carried over from the existing product and worth keeping. Every
list row and every status badge carries a **3px vertical bar** on its leading edge,
colored by the row's status ink. It is what makes a dense list scannable at a glance and
gives the system a recognizable fingerprint.

- On rows: full row height, flush to the left edge, inheriting the row's left radius.
- On status badges: 10px tall, 3px wide, inside the badge, before the label.

### Status badge

`chip` radius, 4px/8px padding, `label` typography. Status wash as fill, 1px border of
the status ink at 35% opacity, status ink as text, with the spine at full opacity.

### List rows

`card` background, 1px `rule-hairline` border, `panel` radius, 12px gap between rows
(rows are discrete cards, not a continuous table). Leading spine, then a 40px square
icon tile with `well` fill and `rule-hairline` border, then a two-line text block
(primary in `body` weight 500, secondary in `mono-sm` `ink-secondary`), then right-aligned
actions. Hover fills `wash` and does not move or scale the row.

### Upload dropzone

2px **dashed** `rule-control` border, `panel` radius, `well` background, 48px vertical
padding, centered content: an outline upload icon, a `body` instruction line, and a
`body-sm` `ink-secondary` line giving accepted formats and the size limit. On drag-over,
the border becomes solid `accent` and the fill becomes `accent-wash`. During upload it
becomes a determinate progress bar with the filename and a `mono-sm` percentage.

### Tabs

Underline tabs. `body-sm` weight 500, 12px/16px padding, 2px bottom border. Inactive is
`ink-secondary` with a transparent border; active is `ink-primary` with an `accent`
border. No pills, no boxed tabs.

### Breadcrumbs

`body-sm` `ink-secondary`, separated by a thin chevron, with the final (current) segment
in `ink-primary` weight 500 and unlinked.

### Empty states

Centered in the panel, 64px vertical padding. A 40px outline icon in `ink-muted`, a
`title`-size Fraunces headline, one line of `body-sm` `ink-secondary` explanation capped
at 44 characters wide, and at most one button. Never an illustration, never a mascot.

### Toasts

Bottom-right stack, `card` background, overlay shadow, `panel` radius, 4px leading spine
in the status ink, 16px padding, max 400px wide. Auto-dismissing with a visible progress
hairline along the bottom edge.

### Skeletons

`well`-filled blocks at `chip` radius that match the exact dimensions of the content they
replace. A slow, low-contrast shimmer. Never spinners for full-page loads; spinners are
only for in-button and inline action states.

---

## Iconography and imagery

- **Icons:** Lucide, outline only, 1.5px stroke, 16px in rows and buttons, 20px in
  navigation, 40px in empty states. Icons inherit the surrounding text color.
- **Avatars:** square with `chip` radius — not circles. Monogram initials in `label`
  style on a `well` fill with a `rule-hairline` border.
- **Photography:** none. This product contains no stock imagery, no illustrations, no
  3D renders, no abstract gradient meshes.
- **Charts:** if a progress indicator is needed, it is a 6px horizontal bar with a
  `well` track and an `accent` fill at `chip` radius. No donuts, no rings, no sparklines.

---

## Accessibility

- All text meets WCAG AA (4.5:1) except `ink-muted`, which is reserved for placeholders,
  disabled states, and decorative icons.
- Every interactive element has a visible 2px `accent` focus ring at 2px offset.
- Status is never communicated by color alone: every status badge carries a text label,
  and the spine is a redundant cue, not the only one.
- Minimum touch target 44×44px on mobile.
- `prefers-reduced-motion` is honored — see `MOTION_SPEC.md`.

**One documented trade-off.** WCAG 1.4.11 asks for 3:1 contrast on the boundaries of
interactive components. `rule-control` `#B8B3A6` measures 2.0:1 against the page, which
is chosen for the intended restraint. Inputs remain identifiable through their label,
fill, and focus ring rather than their resting border alone. If strict 1.4.11
conformance becomes a requirement, promote control borders to `rule-strong` `#8A867C`
(3.4:1); nothing else in the system needs to change.

---

## Anti-patterns

Do not produce any of the following. This list exists because these are the default
habits of generated UI and they are precisely what makes an interface look generic.

- Inter, Roboto, Poppins, Montserrat, or any geometric sans as the body face
- Purple-to-blue, blue-to-teal, or any multi-stop gradient — anywhere
- Glassmorphism, frosted blur, translucent panels
- Border radius above 8px; pill-shaped buttons; circular avatars
- Drop shadows on cards, rows, or buttons
- Neon, saturated, or fluorescent accents; glowing borders; colored shadows
- Emoji as icons; filled/duotone icon sets; multi-colored icons
- Dark mode, dark hero sections, or dark navigation bars
- Full-width hero banners with centered marketing copy on application screens
- Stat cards with oversized numbers and percentage-change arrows
- More than one primary button on a screen
- Decorative dot grids, noise textures, mesh backgrounds, or floating blurred orbs
- Sidebar navigation (this product navigates by top bar and breadcrumb)

---

## Manual theme entry (fallback)

Use this if Stitch's **Edit Theme** panel will not accept this file as an import, or if you
imported it and the swatches did not change. Match by **role**, not by field label — the
panel's labels vary between Stitch releases, and only the roles are stable.

### Colors

```text
Background / page      #FAF9F6
Surface / card         #FFFFFF
Primary                #1C3D5A
On primary             #FFFFFF
Secondary / accent     #2F5D7C
Text primary           #16150F
Text secondary         #5C594F
Border / outline       #B8B3A6
Success                #2E5E4E
Warning                #7A5C15
Error / destructive    #8C2F26
```

If the panel offers only one accent slot, use `#1C3D5A` and leave the rest to defaults —
the accent matters more than any other single value. If it demands a secondary accent you
cannot skip, `#2F5D7C` is the safest choice because it is the same hue family and will not
introduce a second brand color.

### Fonts

```text
Display / heading      Fraunces
Body / UI              IBM Plex Sans
Monospace              IBM Plex Mono
```

If only two slots exist, set Fraunces as heading and IBM Plex Sans as body; the mono face
is worth losing before either of the other two.

### Shape

```text
Corner radius          4px
```

If the control is a named scale rather than a value, choose the sharpest option available
short of fully square.

### Design rules field

If the panel has a free-text notes, rules, or instructions field, paste this. It is the
full system compressed to the parts that most affect generation.

```text
Look and feel: a well-made paper filing system rendered in software. Archival, precise,
unhurried — the restraint of a private bank statement. Professional financial software for
accountants, never a consumer app.

Surfaces: content panels are white and sit on a warmer bone page, so panels read as sheets
of paper on a desk. Recessed wells are a shade darker than the page.

Hierarchy comes from typography, hairline rules, and generous whitespace. Never from
shadows and never from color. Cards and panels have a 1px hairline border and no shadow.
Shadows appear only on floating layers: modals, drawers, dropdowns, toasts.

Every list row and status badge carries a 3px vertical bar on its leading edge, colored by
that item's status. This is the signature element and must appear on every list.

Field labels sit above their inputs in small uppercase letterspaced type. Dates, file
sizes, counts, versions, IDs, and percentages are always monospace. Headings are always the
display serif. Exactly one filled primary button per screen; all others are outlined or
quiet.

Never produce: sidebars, gradients, glassmorphism or blur, card shadows, pill buttons,
circular avatars, radii above 8px, dark sections or dark cards, stat cards with giant
numbers and percentage arrows, illustrations, stock photography, mascots, emoji, or
marketing hero banners on application screens.

Copy is plain, calm, and specific. No exclamation marks, no celebration, no encouragement.
```

### Verify before generating

The theme is applied correctly when a test generation shows all four of these. Check them
before spending generations on the batches.

1. The page background is warm off-white and the panels on it are **lighter**, not darker.
2. Headings render in a serif; body text and buttons render in a grotesque sans.
3. No panel or card has a drop shadow.
4. Dates and file sizes render in monospace.

If any of the four is wrong, fix the theme rather than correcting it per screen — a theme
fault reappears on every subsequent generation.

---

## Repo migration notes

**Not part of the Stitch import.** For the engineer applying the generated design to the
codebase.

Tokens live in the `@theme` block of
[taxflow-app/src/index.css](../../taxflow-app/src/index.css). The legacy alias block at
the bottom of that file already maps the old Material-style names onto Folio Desk names,
so unmigrated components will follow the new values automatically once the base tokens
are swapped. Four things break on a straight light inversion and must be changed by hand:

1. **`:root { color-scheme: dark }`** (line ~113) — must become `light`, otherwise the
   browser renders native scrollbars, date pickers, and form controls dark against the
   new bone surfaces.
2. **`.auth-hero`** (line ~372) — the two radial gradients plus the dark linear gradient
   are the strongest surviving artifact of the dark theme. Replace with a flat `page`
   fill; the auth hero's interest should come from typography, not light effects.
3. **`.folio-select { color-scheme: dark }`** (line ~365) — same problem as (1), scoped
   to the native select dropdown panel.
4. **Autofill `-webkit-box-shadow` inset** (line ~185) — the `1000px` inset uses
   `--color-ledger`. On the light theme this must become the `card` value or Chrome will
   paint autofilled fields with the old dark surface.

Two additional cleanups worth doing in the same pass: `.skeleton`, `.shadow-floating`,
and `.custom-scrollbar` are referenced by components but never defined in `index.css`;
and `VaultTab`, `TeamTab`, and `PermissionManagerPanel` still use the legacy
`--color-surface-*` aliases directly rather than the current token names.
