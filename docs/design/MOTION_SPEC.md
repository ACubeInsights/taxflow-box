# TaxFlow — Motion Spec

Stitch produces static screens. This is the layer it cannot generate: how the interface
moves. It is written against `framer-motion@^12`, already a dependency of `taxflow-app`,
and against the motion tokens already defined in the `@theme` block of
[taxflow-app/src/index.css](../../taxflow-app/src/index.css).

## Principle

Motion in this product exists to explain **where something came from and where it went**.
It never exists to entertain, and it never delays a person from acting.

Three rules follow from that:

1. **Nothing bounces.** No spring overshoot, no elastic easing, no scale above 1. This is
   a financial records tool; overshoot reads as flippant.
2. **Nothing waits on animation.** Entrances run at 120–240ms. Buttons respond on press,
   not on animation-complete. If an animation would gate an interaction, cut it.
3. **Motion is subtractive by default.** Elements fade and translate by small amounts —
   typically 4 to 12px. If you can see the distance travelled, it is too far.

## Tokens

Already defined in `index.css`. Do not introduce new durations or easings.

| Token | Value | Use |
|---|---|---|
| `--duration-micro` | 120ms | Hover, press, focus, checkbox, chip toggle |
| `--duration-standard` | 240ms | Route changes, panel expand/collapse, toasts, status changes |
| `--duration-emphasis` | 480ms | Drawers, modals, upload completion, the undo countdown |
| `--ease-micro` | `cubic-bezier(0.25, 0.46, 0.45, 0.94)` | Small state changes, both directions |
| `--ease-standard` | `cubic-bezier(0.4, 0, 0.2, 1)` | General entrances and exits |
| `--ease-emphasis` | `cubic-bezier(0.16, 1, 0.3, 1)` | Decelerating entrances of large surfaces |

Framer Motion takes easing as an array. Define these once and import them, rather than
inlining the numbers at every call site:

```js
// taxflow-app/src/constants/motion.js
export const EASE = {
  micro:    [0.25, 0.46, 0.45, 0.94],
  standard: [0.4, 0, 0.2, 1],
  emphasis: [0.16, 1, 0.3, 1],
}

export const DURATION = {
  micro: 0.12,
  standard: 0.24,
  emphasis: 0.48,
}
```

## Reduced motion

Wrap the app once. `MotionConfig` with `reducedMotion="user"` makes Framer Motion honor the
OS setting for every descendant, disabling transform and layout animation while leaving
opacity intact — which is the correct behaviour, since a hard cut between screens is more
disorienting than a fade.

```jsx
// taxflow-app/src/main.jsx
import { MotionConfig } from 'framer-motion'

<MotionConfig reducedMotion="user">
  <App />
</MotionConfig>
```

`index.css` already zeroes CSS transitions and animations under
`@media (prefers-reduced-motion: reduce)`. The two mechanisms cover different surfaces and
both are needed.

One exception: the upload progress bar and the undo countdown must keep moving under
reduced motion. They are not decoration — they are the only indication of a value changing
over time. Read the preference directly where that matters:

```jsx
import { useReducedMotion } from 'framer-motion'

const reduced = useReducedMotion()
// progress fill: always animate width; only the shimmer is suppressed
```

---

## 1. Route transitions

Applies to the staff drill-down: Dashboard → Client → Project → Document, and back.

Forward navigation moves **into** the hierarchy, so content enters from slightly below and
fades up. Backward navigation reverses it. The top navigation bar and breadcrumb never
animate — they are the fixed frame the content moves within.

```jsx
// wraps the routed content inside AppShell, not the whole shell
<AnimatePresence mode="wait" initial={false}>
  <motion.main
    key={location.pathname}
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -4 }}
    transition={{ duration: DURATION.standard, ease: EASE.standard }}
  >
    <Outlet />
  </motion.main>
</AnimatePresence>
```

`mode="wait"` matters: overlapping route content produces a visible double-scrollbar flash
on long pages. The exit distance is deliberately smaller than the entrance distance so the
outgoing screen dissolves rather than slides away.

**Breadcrumb.** When a segment is appended, it fades in over `--duration-micro` with no
translation. Segments never animate on removal.

---

## 2. Modals

Applies to the Box preview overlay, change password, share file, onboard client, add
employee, and the document editor.

The scrim and the panel animate as one gesture. The panel scales from 0.98, never from
below 0.95 — anything more reads as a zoom.

```jsx
const scrim = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
}

const panel = {
  initial: { opacity: 0, y: 12, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 8, scale: 0.99 },
}

<AnimatePresence>
  {open && (
    <motion.div
      {...scrim}
      transition={{ duration: DURATION.standard, ease: EASE.standard }}
      className="fixed inset-0 bg-[rgba(22,21,15,0.32)]"
      onClick={onClose}
    >
      <motion.div
        {...panel}
        transition={{ duration: DURATION.emphasis, ease: EASE.emphasis }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>
```

Exit runs at `--duration-standard`, not `--duration-emphasis`. Dismissal should feel faster
than arrival — a person closing a modal has already moved on.

**Focus.** Move focus to the modal's first interactive element on open and return it to the
trigger on close. This is not motion, but it is the part of an overlay transition that is
most often dropped and most noticed by keyboard users.

---

## 3. Drawers

Applies to the new document request drawer and the permission manager panel.

Drawers translate on the X axis only. No scale, no fade on the panel itself — a drawer that
fades has no physical relationship to the edge it came from.

```jsx
const drawer = {
  initial: { x: '100%' },
  animate: { x: 0 },
  exit: { x: '100%' },
}

<motion.aside
  {...drawer}
  transition={{ duration: DURATION.emphasis, ease: EASE.emphasis }}
  className="fixed right-0 top-0 h-full w-[520px]"
>
```

The scrim behind it fades on the same timing as the modal scrim. `ease-emphasis` is
strongly decelerating, which is what makes a 520px translation feel weightless rather than
sluggish.

---

## 4. Panel expand and collapse

Applies to the client vault folder sections and the expandable document request rows.

Animate `height` from `0` to `auto` — Framer Motion measures this correctly. Fade the
content slightly behind the height so text does not appear stretched mid-transition.

```jsx
<AnimatePresence initial={false}>
  {open && (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{
        height: { duration: DURATION.standard, ease: EASE.standard },
        opacity: { duration: DURATION.micro, ease: EASE.micro, delay: 0.06 },
      }}
      style={{ overflow: 'hidden' }}
    >
```

The disclosure chevron rotates 90° over `--duration-micro` with `ease-micro`, driven by the
same open state.

**Staggering.** When a folder expands to reveal file rows, stagger them by 24ms with a cap
at 8 rows — beyond that the last row arrives late enough to feel broken.

```jsx
const list = { animate: { transition: { staggerChildren: 0.024 } } }
const row = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0, transition: { duration: DURATION.micro, ease: EASE.micro } },
}
```

---

## 5. Upload

The most important motion in the client experience, because it is the only place where a
person is waiting on the system and needs to trust it.

**Drag over the dropzone.** Border color and background fill cross-fade over
`--duration-micro`. The dropzone does not scale, lift, or pulse.

**Upload begins.** The dropzone's idle content cross-fades out and the progress row fades
in, both over `--duration-micro`, no height change.

**Progress.** The fill animates its width to each new percentage over `--duration-standard`
with `ease-standard`. Because progress arrives in irregular chunks from the XHR progress
event, the eased transition is what turns a jumpy signal into a smooth one. Never animate
the numeric percentage label — a tweened number is unreadable. Update it directly.

```jsx
<motion.div
  animate={{ width: `${percent}%` }}
  transition={{ duration: DURATION.standard, ease: EASE.standard }}
/>
```

**Completion.** The bar fills to 100%, holds for 400ms, then the whole row cross-fades into
the completed file row over `--duration-emphasis`. That deliberate hold is what makes an
upload feel finished rather than merely gone. Skipping it is the single most common reason
uploads feel unreliable.

**Failure.** The row does not shake. The bar's fill cross-fades to the revision-requested
color over `--duration-standard`, and the error message and Retry button fade in beneath
it. Shake animations on error are a consumer pattern and read as panic here.

---

## 6. Status changes

When a document moves between lifecycle states, three things update: the status badge, the
leading spine on its row, and — where present — the progress bar.

**The spine is the anchor.** Its color transitions over `--duration-emphasis` with
`ease-emphasis`, noticeably slower than everything else on screen. This is already the
behaviour encoded in `.folio-spine` in `index.css` and it is worth preserving: the slow
color bleed down the edge of a row is the product's one moment of deliberate theatre, and
it is legible in peripheral vision, which is exactly what a preparer working down a queue
needs.

**The badge** cross-fades its label and colors over `--duration-standard`. It does not
resize abruptly — give it a `layout` prop so a width change from "Uploaded" to "Revision
requested" animates rather than snapping.

```jsx
<motion.span layout transition={{ duration: DURATION.standard, ease: EASE.standard }}>
```

**The progress bar** animates its width over `--duration-standard`, matching the upload
progress treatment.

**Row removal on filter change.** When status filter chips change the visible set, exiting
rows fade and collapse their height over `--duration-standard`; remaining rows reflow via
`layout`. Do not animate rows out to the side.

---

## 7. Undo countdown

The ten-minute window after an approval. Two elements move.

**The bar** depletes linearly from 100% to 0% over the full remaining window. Linear is
correct here and is the one place in the system where easing would be wrong — an eased
countdown misrepresents elapsed time.

```jsx
<motion.div
  initial={{ width: `${initialPercent}%` }}
  animate={{ width: '0%' }}
  transition={{ duration: msRemaining / 1000, ease: 'linear' }}
/>
```

**The label** updates its `M:SS` text once per second with no animation. This must keep
running under reduced motion.

When the window expires, the whole undo panel collapses its height and fades over
`--duration-standard`. It does not flash or change color first.

---

## 8. Toasts

Enter from the bottom-right, translating up 12px while fading in, over
`--duration-standard` with `ease-emphasis`. Exit by fading and translating right 12px over
`--duration-micro`.

Stacked toasts use `layout` so that when one dismisses, the others slide into place rather
than jumping. The auto-dismiss progress hairline along the bottom edge depletes linearly
over the toast's lifetime, matching the undo countdown treatment.

```jsx
<AnimatePresence mode="popLayout">
  {toasts.map((t) => (
    <motion.div
      key={t.id}
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 12 }}
      transition={{ duration: DURATION.standard, ease: EASE.emphasis }}
    >
```

`mode="popLayout"` is what prevents the remaining toasts from jumping during a dismissal.

---

## 9. Skeletons

A single shared shimmer: a low-contrast highlight sweeping left to right across the
placeholder block over 1.6s, on an infinite loop with a 0.4s gap between passes.

Two rules. The shimmer is suppressed entirely under reduced motion — the static block
remains. And skeletons never cross-fade into content; they are replaced on the same frame
the data arrives, and the content itself fades in over `--duration-micro`. Animating the
skeleton out makes loading feel slower than it was.

`.skeleton` is currently referenced by `Skeleton.jsx` but never defined in `index.css`.
Define it there rather than as a Framer Motion animation — a CSS keyframe is cheaper for
something that may be running on forty elements at once.

---

## 10. Micro-interactions

All at `--duration-micro` with `ease-micro`, all colour or opacity only.

- **Buttons** — background and border cross-fade on hover. On press, opacity to 0.9. No
  translate, no scale, no shadow change.
- **List rows** — background cross-fades to the wash surface on hover. The row does not
  lift, scale, or gain a border.
- **Inputs** — border color cross-fades to the accent on focus; the focus ring appears
  instantly with no animation. A ring that fades in is a ring a keyboard user cannot track.
- **Checkboxes** — the check mark draws via `pathLength` from 0 to 1 over
  `--duration-micro`; the box fill cross-fades on the same timing.
- **Tabs** — the active underline slides between tabs using a shared `layoutId`, over
  `--duration-standard` with `ease-standard`.

```jsx
{isActive && (
  <motion.span
    layoutId="tab-underline"
    transition={{ duration: DURATION.standard, ease: EASE.standard }}
  />
)}
```

- **Chips and toggles** — colour cross-fade only.

---

## What must never animate

- The top navigation bar, in any way, at any time
- Numeric values, other than by direct text replacement
- Page titles and headings
- Table and list column widths during data updates
- Anything that would delay a click, a keypress, or a form submission
- Error messages appearing (fade only — no shake, no bounce, no colour pulse)
