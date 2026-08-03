# TaxFlow — Stitch Prompt Sequence

Sixteen screens across six batches, plus refinement patterns.

> ## Do not paste this file into Stitch
>
> This is a playbook, not a prompt. It contains **seven separate messages** — one master
> context block and six batch prompts — that must be sent one at a time, in order, each
> in its own message. Only the text inside the ```text fenced blocks is ever pasted.
>
> Pasting the whole file produces one generic screen that is not in the brief. Pasting
> [STITCH_DESIGN_SYSTEM.md](STITCH_DESIGN_SYSTEM.md) as a chat message instead of
> importing it as the theme has the same effect: Stitch reads it as a request to design
> a style guide, and the tokens never become project-level constraints.

## Before you paste anything

1. Create a new Stitch project, set to **Web / desktop**.
2. Open **Edit Theme** in the canvas toolbar and import
   [STITCH_DESIGN_SYSTEM.md](STITCH_DESIGN_SYSTEM.md) as the project `DESIGN.md`.
   Import the "Identity" through "Anti-patterns" sections only. If the import is
   rejected or the swatches do not change, enter the values by hand using the
   "Manual theme entry" section of that file.
3. Verify the theme took: the swatches should show bone `#FAF9F6`, ink navy `#1C3D5A`,
   and Fraunces as the display face. Fix it here before generating anything — a wrong
   theme at this step contaminates every screen downstream.
4. Paste the **Master context** below as your first message. Do not ask it to generate
   anything yet.
5. Then run batches 1 through 6 in order, one message each.

Use **Standard mode**. It exports to Figma; Experimental mode does not, and you do not
need image input here.

Three rules that matter more than the prompts themselves:

- **Never put a hex code, font name, or radius value in a generation prompt.** Those live
  in the theme. Duplicating them makes the two fight. Hex codes are fine in *edit* prompts
  where you are correcting one specific thing.
- **Run batches in order.** Batch 4 references the header established in batch 2; batch 5
  references batch 4. Out of order, you get drift.
- **Do not exceed the batch groupings.** Asking for all sixteen at once produces sixteen
  mediocre screens.

Budget: roughly 20-25 standard generations including a normal amount of re-rolling,
against a 350/month allowance.

---

## Master context

Paste this once, first, before any batch.

```text
I am designing a web application called TaxFlow. Before we generate any screens, here is
the context you should hold for every screen in this project. Do not generate anything
yet — just acknowledge.

WHAT THE PRODUCT IS
TaxFlow is a secure document vault used by accounting firms and their tax clients. A firm
invites a client, requests specific tax documents from them, the client uploads those
documents, and a preparer at the firm reviews each one and either approves it, asks for a
revision, or waives the requirement. All files are stored in Box behind the scenes, so
document previews appear as embedded viewers.

This is a professional financial tool handling sensitive records. It is used for hours at
a time by preparers during tax season, and a handful of times per year by clients. It is
not a consumer app and must never look like one.

WHO USES IT — THREE ROLES
1. Client — an individual or business who owes documents to their accountant. Sees only
   their own vault. Uploads files, views files the firm has shared with them, and responds
   to revision requests. Low frequency, low technical confidence, often in a hurry.
2. Preparer (employee) — staff at the firm. Manages a book of clients, creates document
   requests, reviews uploads, approves or rejects them, browses client vaults. High
   frequency, high volume, wants density and keyboard speed.
3. Admin (superadmin) — a preparer with additional firm-wide administration rights.

NAVIGATION MODEL
There is no sidebar. Every screen has the same sticky top navigation bar and, on interior
screens, a breadcrumb trail. Staff navigate by drilling down:
Dashboard > Client > Project > Document. Clients have a single screen and never navigate
deeper.

THE DOCUMENT LIFECYCLE — this is the spine of the whole product
Every requested document moves through exactly these six states:
- Not requested — the firm has asked for it; the client has not uploaded yet
- Uploaded — the client has sent a file; nobody has looked at it
- Under review — a preparer has opened it
- Approved — accepted, finished
- Revision requested — rejected with a written note; the client must upload again
- Waived — the firm decided it is not needed after all

State must always be visible as a labelled badge, never by color alone.

VOCABULARY — use these exact words in the UI, never substitutes
- "vault" not "storage" or "drive"
- "document request" not "task" or "todo"
- "preparer" not "agent" or "admin" when referring to firm staff
- "revision" not "rejection"
- "waive" not "skip" or "cancel"
- "tax year" not "period"

THE VAULT FOLDER STRUCTURE
A client's vault contains five folders. A client can see four of them:
- Your uploads (the client can upload here)
- Tax returns (read-only for the client)
- Supporting documents (read-only for the client)
- Signed documents (read-only for the client)
The fifth, Internal notes, is visible only to firm staff and must never appear on any
client-facing screen.

TONE OF THE WRITING
Every piece of copy on every screen should be plain, calm, and specific. Say "Upload your
2025 W-2" not "Get started!". Never exclamation marks, never "Oops", never "Awesome",
never encouragement or celebration. Errors state what happened and what to do about it.
Empty states state what will appear there and who causes it to appear.

VISUAL DIRECTION
The design system is already loaded in this project's theme — do not restate colors,
fonts, or corner radii in any prompt. In one line: it should look like a well-made paper
filing system rendered in software. Archival, precise, unhurried. Content panels sit as
lighter sheets on a warmer page. Hierarchy comes from typography, rules, and generous
whitespace — never from shadows or color.

NEVER PRODUCE
No sidebars. No gradients. No glassmorphism or frosted blur. No card shadows. No pill
buttons or circular avatars. No stat cards with giant numbers and percentage-change
arrows. No illustrations, mascots, stock photography, or emoji. No dark sections. No
marketing hero banners on application screens. No more than one primary button per screen.

Acknowledge and wait for my first screen request.
```

---

## Batch 1 — Authentication (3 screens)

```text
Generate 3 desktop web screens for the TaxFlow authentication flow. Keep them visually
identical to each other in structure — same split proportions, same logo placement, same
card width and padding.

SHARED ANATOMY for all three
Full-viewport two-column split, 45% left / 55% right, no gap, no rounded outer container.
LEFT PANEL — an editorial column, not a marketing hero:
  - Wordmark "TaxFlow" at top-left in the display serif, small, with a fine rule beneath it
  - Vertically centered: a large display-serif statement, two lines maximum
  - Below it, three short lines of supporting text, each preceded by a small outline icon
    and separated by hairline rules — set as a list, not as cards
  - Bottom-left: a single line of small monospace text reading
    "SOC 2 Type II · 256-bit encryption · Box-backed storage"
  - The panel background is the page surface. Absolutely no gradient, no image, no pattern.
RIGHT PANEL — centered form card, 420px maximum width, generous vertical padding.
  - Labels sit above their fields in the small uppercase label style
  - One primary button, full width of the card
  - Small print sits below the button, separated by 24px

SCREEN 1 — Sign in
Heading "Sign in to your vault", one line of subtext "Enter the email your firm has on
file." Fields: Email address, Password (with a show/hide affordance at the right edge of
the field). A "Forgot password" quiet link right-aligned directly beneath the password
field. Primary button "Sign in". Below the button, small text: "New client? Use the
invitation link your preparer emailed you." Left panel statement: "Your tax documents,
filed and finished." Left panel three lines: "Every document tracked from request to
approval." / "Encrypted storage, retained to your firm's policy." / "One place for the
whole tax year."

SCREEN 2 — Accept invitation
This is how every client account is created; there is no open sign-up. Above the form, a
recessed summary block showing the invitation being accepted: the firm name "Whitlock &
Reyes CPA", the invited email "j.okafor@northline.co", and a small monospace line
"Invitation expires in 3 days". Heading "Create your account". Fields: Full name, Email
address (pre-filled and disabled, with a small lock icon), Password, Confirm password.
Beneath the password field, a three-item requirements checklist in small text with outline
check icons: "At least 12 characters", "Contains a letter", "Contains a number" — the
first two shown satisfied, the third not yet. Primary button "Create account and open
vault". Left panel statement: "Whitlock & Reyes has opened a vault for you."

SCREEN 3 — Set a new password
The narrowest of the three — no left-panel statement change needed, reuse screen 1's.
Heading "Set a new password", subtext "This link is valid for 30 minutes." Fields: New
password, Confirm password, with the same requirements checklist. Primary button "Save
password and sign in". Below it a quiet link "Back to sign in".

VIBE
Restrained, editorial, institutional. The quiet confidence of a private bank's client
portal. Typographic interest only — no decoration.
```

---

## Batch 2 — Client vault (3 screens)

```text
Generate 3 desktop web screens showing the client's vault in three different states. All
three share the same layout; only the content state changes. Establish the top navigation
bar here — every later screen in this project will reuse it exactly.

SHARED ANATOMY
Sticky top navigation bar, 56px tall, spanning full width, sitting on a hairline bottom
rule with no shadow:
  - Left: "TaxFlow" wordmark in the display serif
  - Right: a bell icon with a small numeric indicator, then a square monogram avatar
    reading "JO" beside the name "Jordan Okafor" and, beneath it in small text, "Client"
Below the bar, content is centered in a 1240px column with 32px gutters.

PAGE HEADER
Display-serif title "Welcome, Jordan". Beneath it, one line of secondary text: "Your 2025
tax-year documents." Right-aligned on the same line, a small monospace tax-year selector
reading "TAX YEAR 2025".

SECTION 1 — Requested documents
Small uppercase label "Requested documents", with a right-aligned monospace counter
"3 of 7 complete" and, directly beneath the label row, a thin full-width progress bar at
roughly 43%.
Then a list of request rows. Each row is a discrete card with a leading 3px vertical
status bar, and contains: the document name in medium weight, a one-line description in
secondary text beneath it, and on the right a due date in monospace with a small calendar
icon, then a status badge. Rows the client must act on also show a primary "Upload" button.
Rows are:
  1. "2025 W-2 — Northline Logistics" / "Wage and tax statement from your employer" /
     due "Mar 14, 2026" / status "Not requested" / has an Upload button
  2. "Form 1099-INT — Meridian Savings" / "Interest income statement" /
     due "Mar 14, 2026" / status "Uploaded"
  3. "Schedule K-1 — Okafor Family Trust" / "Partnership and trust income" /
     due "Mar 21, 2026" / status "Under review"
  4. "Prior-year return (2024)" / "Needed to carry forward deductions" /
     due "Mar 07, 2026" / status "Approved"
  5. "Form 1098 — mortgage interest" / "Not required for your filing this year" /
     due "—" / status "Waived"

SECTION 2 — Your vault
Small uppercase label "Your vault". Then four collapsible folder rows, each with a
disclosure chevron, a square folder icon tile, the folder name, and a small monospace
count chip on the right. The folders, in this order: "Your uploads" (4), "Tax returns"
(2), "Supporting documents" (6), "Signed documents" (1). The "Your uploads" row also
carries a secondary "Upload file" button.
The first folder, "Your uploads", is expanded, revealing four indented file rows. Each
file row has a leading vertical bar, a square file-type icon tile, the filename in medium
weight, a monospace second line giving size and date, and right-aligned quiet buttons
"View" and "Download". Files: "W2_Northline_2025.pdf · 248 KB · Feb 09",
"1099INT_Meridian.pdf · 96 KB · Feb 09", "K1_OkaforTrust_2025.pdf · 412 KB · Feb 02",
"receipts_q4_2025.zip · 8.2 MB · Jan 28".

SCREEN 1 — Default state
As described above.

SCREEN 2 — Upload in progress
Identical to screen 1, except the first request row ("2025 W-2") is expanded to reveal an
inline upload area directly beneath it. That area shows a file actively uploading: the
filename "W2_Northline_2025.pdf", a determinate horizontal progress bar at about 68%, a
monospace "68% · 1.4 MB of 2.1 MB" line, and a quiet "Cancel" button. Beneath the active
file, a dashed-border drop area reading "Drop files here or browse" with a smaller second
line "PDF, JPG, PNG, or ZIP · up to 5 GB per file".

SCREEN 3 — Revision requested
Identical to screen 1, except the third request row ("Schedule K-1") now has status
"Revision requested" and is expanded. The expanded area contains, in order: a recessed
note block with a small uppercase label "Note from your preparer", the message "The K-1
you sent is the 2024 form. Please upload the 2025 version — it should show a fiscal year
ending December 2025.", and beneath it a monospace attribution "Dana Whitlock · Feb 11,
2026". Below that note, a dashed-border drop area reading "Upload the corrected document".
Also add, directly beneath the page header, a single full-width inline banner using the
revision-requested status colors, reading "1 document needs your attention" with a quiet
right-aligned "Jump to it" link.

VIBE
Calm, orderly, and completely unintimidating. A client opening this during tax season
should immediately know the one thing they have to do. Density is low, whitespace is
generous, and nothing competes with the request list.
```

---

## Batch 3 — Client overlays and mobile (2 screens)

```text
Generate 2 more screens for TaxFlow. Reuse the exact top navigation bar, page header, and
list-row construction established in the client vault screens.

SCREEN 1 — Document preview overlay (desktop)
The client vault screen from the previous batch, dimmed behind a modal overlay. The modal
is 1080px wide, 85% of viewport height, centered, with a soft floating shadow — the only
shadow anywhere in this project.
Modal header row, 64px tall, on a hairline bottom rule: on the left a square file-type
icon tile, then the filename "K1_OkaforTrust_2025.pdf" in medium weight with a monospace
second line "412 KB · PDF · Uploaded Feb 02, 2026"; on the right, a secondary "Download"
button and a quiet close icon button.
Modal body: a recessed well containing an embedded document viewer showing the first page
of a tax form rendered as a realistic scanned document — visible form gridlines, boxed
fields, a form number in the top-left corner. Centered in the well with even margins on
all sides.
Modal footer, 56px tall, on a hairline top rule: on the left, monospace text "Page 1 of 3";
centered, a compact pager with previous and next chevrons and a page number field; on the
right, quiet zoom-out, zoom-percentage, and zoom-in controls.

SCREEN 2 — Client vault on mobile, 390px wide
The same content as the default client vault screen, restructured for a narrow viewport.
- Top bar collapses to 56px: wordmark on the left, bell icon and monogram avatar on the
  right. No name text.
- Page header stacks: title, then subtext, then the tax-year selector on its own line.
- The progress bar and "3 of 7 complete" counter sit full width beneath the
  "Requested documents" label.
- Request rows become full-width stacked cards. Inside each: status badge on its own first
  line, then the document name, then the description, then a row containing the due date on
  the left and the action button on the right. The action button is full width when it is
  the row's only action.
- Folder rows stay single-line with the chevron, name, and count chip; file rows inside
  them stack the filename above the monospace metadata line, with View and Download as
  two equal-width quiet buttons on a third line.
- A persistent bottom action bar, 72px tall, sitting on a hairline top rule with the card
  surface behind it, containing one full-width primary button "Upload a document".
- Show only the first three request rows and the expanded "Your uploads" folder with two
  files — the screen should end mid-scroll, not compress everything to fit.

VIBE
Same restraint as desktop. Larger touch targets, more vertical rhythm, nothing shrunken.
```

---

## Batch 4 — Preparer workspace (3 screens)

```text
Generate 3 desktop web screens for the preparer (firm staff) side of TaxFlow. Reuse the
exact top navigation bar from the client vault screens, with two changes: the role text
beneath the user name reads "Preparer", and the monogram and name become "DW" /
"Dana Whitlock".

SCREEN 1 — Preparer dashboard
Page header: display-serif title "Your book", secondary line "14 active clients · 9
documents waiting on you."
Directly beneath the header, an action row of four buttons, left-aligned, with the first
as the only primary: "New document request" (primary), then secondary buttons "Share a
file", "Invite a client", "Manage access".
Below that, a two-column layout, 60/40 split with a 24px gap.

LEFT COLUMN — panel titled "Waiting on you" with a right-aligned monospace count "9".
A list of document rows sorted by urgency. Each row: leading vertical status bar, then a
square document icon tile, then a two-line text block (document name in medium weight;
second line in secondary text giving client and project, e.g. "Northline Logistics ·
2025 Tax Return"), then a right-aligned priority chip and status badge, then a quiet
"Review" button. Rows:
  1. "Schedule K-1 — Okafor Family Trust" / "Jordan Okafor · 2025 Tax Return" /
     priority "Urgent" / "Uploaded"
  2. "Form 1120-S" / "Cedarline Holdings LLC · 2025 Tax Return" /
     priority "High" / "Uploaded"
  3. "Form 1099-NEC batch" / "Halvorsen Design Co · 2025 Tax Return" /
     priority "High" / "Under review"
  4. "Depreciation schedule" / "Northline Logistics · 2025 Tax Return" /
     priority "Medium" / "Uploaded"
  5. "Prior-year return (2024)" / "Marisol Vance · 2025 Tax Return" /
     priority "Low" / "Under review"
Above the list, a compact row of filter chips: "All 9", "Uploaded 6", "Under review 3".
The first is selected.

RIGHT COLUMN — panel titled "Clients" with a right-aligned quiet "View all" link.
At the top of the panel, a search input with a leading magnifier icon and the placeholder
"Search clients". Beneath it, client rows: leading vertical bar colored by engagement
status, square monogram avatar, then a two-line block (client name in medium weight;
second line in small text giving entity type and last activity, e.g. "S-Corp · active
2 days ago"), then a right-aligned monospace fraction showing document completion.
Rows: "Northline Logistics · LLC · active today · 4/7", "Cedarline Holdings LLC · S-Corp ·
active 2 days ago · 6/9", "Jordan Okafor · Individual · active 4 days ago · 3/7",
"Halvorsen Design Co · Partnership · active 9 days ago · 2/5", "Marisol Vance ·
Individual · active 26 days ago · 0/6". The last row carries a small "Inactive" chip.

SCREEN 2 — Client detail, Projects tab
Breadcrumb: "Dashboard / Northline Logistics".
Client header block: a 48px square monogram avatar reading "NL", then the client name
"Northline Logistics" as a display-serif title, with a row beneath it containing three
small chips — "Active", "LLC", and a monospace "ID NL-2291". Right-aligned in the header,
two secondary buttons: "New document request" and "Client settings".
Underline tabs beneath the header: "Projects" (active), "Vault", "Team".
Tab content: a small uppercase label "Projects", then project cards in a two-column grid.
Each card contains: the project name in medium weight, a status chip, a monospace line
"11 of 14 documents", a thin progress bar, and a bottom row with a monospace due date and
a quiet chevron. Cards: "2025 Tax Return" (Active, 11 of 14, 79%, "Due Apr 15, 2026"),
"2024 Tax Return" (Complete, 14 of 14, 100%, "Filed Apr 09, 2025"), "Q4 2025 Estimated
Payments" (Active, 2 of 3, 67%, "Due Jan 15, 2026").

SCREEN 3 — Client detail, Vault tab
Same breadcrumb, client header, and tabs, with "Vault" active.
Tab content begins with a folder breadcrumb in monospace: "Northline Logistics / 2025 /
Projects", followed by an action row: a quiet "Back" button on the left, then right-aligned
secondary buttons "New folder", "Upload", and a quiet refresh icon button.
Then a folder and file listing as rows. Folder rows first, each with a square folder icon
tile, the folder name, a monospace item count, and a trailing chevron: "Tax" (7 items),
"Uploads" (12 items), "SupportingDocs" (9 items), "SignedDocuments" (3 items),
"InternalNotes" (4 items) — this last one carries a small "Staff only" chip.
Then file rows beneath a hairline divider, each with a square file-type icon tile, the
filename in medium weight, a monospace line giving size, modified date, and modifier, and
right-aligned quiet buttons "Preview", "Edit", "Download". Files:
"1120S_Northline_2025_draft.pdf · 1.2 MB · Feb 12 · Dana Whitlock",
"depreciation_schedule.xlsx · 340 KB · Feb 11 · Jordan Okafor",
"engagement_letter_signed.pdf · 210 KB · Jan 04 · Dana Whitlock".

VIBE
Denser and more utilitarian than the client screens, but the same paper-filing restraint.
This is a professional's working surface — a preparer should be able to see everything
demanding their attention without scrolling. Information density comes from tighter rows
and smaller type, never from removing whitespace between sections.
```

---

## Batch 5 — Document review workspace (3 screens)

This is the flagship. If any batch is worth spending re-rolls on, it is this one.

```text
Generate 3 desktop web screens for the TaxFlow document review workspace — the screen
where a preparer examines a client's uploaded document and decides its fate. All three are
the same screen in three different states. Reuse the exact top navigation bar and
breadcrumb style from the preparer screens.

SHARED ANATOMY
Breadcrumb: "Dashboard / Jordan Okafor / 2025 Tax Return / Schedule K-1".
Page title in display serif: "Schedule K-1 — Okafor Family Trust". On the same line,
right-aligned, quiet previous and next chevron buttons with a monospace "3 of 7" between
them, so the preparer can move through the queue without going back.
Below the title, a two-column split: a fluid left column and a fixed 380px right rail,
24px gap, both starting at the same vertical position.

LEFT COLUMN — the document
A panel whose header row carries a small uppercase label "Document preview" on the left
and, on the right, quiet buttons "Open in Box" and "Edit". Beneath the header, a deeply
recessed well filling the remaining height, containing an embedded viewer showing a
realistic scanned tax form — visible form gridlines, boxed and numbered fields, a form
number in the top-left corner, and light handwriting in two fields. The document sits
centered in the well with even margins, at a size where it reads as a page rather than
filling edge to edge. A compact toolbar overlays the bottom center of the well: page
pager, zoom controls, and a fit-width toggle, on the card surface with a floating shadow.

RIGHT RAIL — stacked panels with 16px between them
Panel A, "Details" — a definition list, each item being a small uppercase label above its
value:
  Status (a status badge), Document type ("Schedule K-1"), Priority (a chip reading
  "Urgent"), Due ("Mar 21, 2026" in monospace with a calendar icon), Requested by
  ("Dana Whitlock"), Uploaded ("Feb 02, 2026 · 11:04" in monospace), File ("K1_
  OkaforTrust_2025.pdf · 412 KB" in monospace), Version ("2" in monospace).
Panel B, "Review" — the decision panel. Contents vary by screen, see below.
Panel C, "Discussion" — a comment thread. Each comment: a square monogram avatar, the
author name in medium weight, a monospace timestamp, then the comment body. A small chip
on internal comments reading "Internal". Comments:
  1. "DW / Dana Whitlock / Feb 02, 11:40" — "Pulled the trust return to cross-check the
     beneficiary allocation." with an "Internal" chip
  2. "JO / Jordan Okafor / Feb 03, 09:12" — "Let me know if you need the trust's operating
     agreement as well."
At the bottom of the panel, a composer: a textarea with the placeholder "Write a comment.
Type @ to mention a colleague.", and beneath it a row with a small toggle switch labelled
"Internal only" on the left and a primary "Post" button on the right.

SCREEN 1 — Under review, awaiting a decision
Status badge reads "Under review". Panel B "Review" contains three stacked full-width
buttons with 12px between them, in this order: a primary "Approve document" with a check
icon, a destructive-styled "Request revision" with a rotate icon, and a secondary "Waive
requirement" with a shield icon. Beneath them, a single line of small secondary text:
"Approving notifies Jordan Okafor by email."

SCREEN 2 — Composing a revision request
Identical to screen 1, except panel B has expanded into the revision form. The three
buttons are replaced by: a small uppercase label "Revision note", with a required marker;
a textarea about 5 rows tall containing the typed message "The K-1 you sent is the 2024
form. Please upload the 2025 version — it should show a fiscal year ending December 2025.";
beneath the textarea a row with a monospace character counter "142 / 1000" on the left and
small secondary text "Minimum 10 characters" on the right; then two side-by-side buttons,
a destructive-styled "Send revision request" and a secondary "Cancel". Beneath them, a
single line of small secondary text: "Jordan Okafor receives this note by email with a
link valid for 7 days." The whole revision panel is outlined in the revision-requested
status color with a matching wash fill, so it reads as a distinct mode.

SCREEN 3 — Just approved, undo window open
Status badge reads "Approved" and the left column's status bar is the approved color.
Panel B is replaced by a panel titled "Approved" containing: a line of medium-weight text
"Approved by you just now", a monospace second line "Feb 12, 2026 · 14:22", then a
horizontal rule, then a row with the text "You can still undo this" on the left and a
secondary "Undo approval" button with a rotate-back icon on the right. Beneath that row, a
thin horizontal countdown bar about 82% depleted, with a monospace label "8:14 remaining"
beneath it. Also add, to panel C, a third comment at the top of the thread from the system:
a square icon tile instead of a monogram, the author "TaxFlow", a monospace timestamp
"Feb 12, 14:22", and the body "Status changed from Under review to Approved by Dana
Whitlock." set in secondary text.

VIBE
This is the most-used screen in the product and it should feel like the most considered
one. The document is the subject; everything else is apparatus arranged around it. The
right rail is quiet and reads top to bottom as a procedure: what this is, what you decide,
what was said. The decision buttons are the only place on the screen with any visual
weight.
```

---

## Batch 6 — Project detail and request creation (2 screens)

```text
Generate 2 final desktop web screens for TaxFlow. Reuse the top navigation bar, breadcrumb
style, and list-row construction from the preparer screens exactly.

SCREEN 1 — Project detail
Breadcrumb: "Dashboard / Jordan Okafor / 2025 Tax Return".
Page header: display-serif title "2025 Tax Return", with a row beneath it containing a
status chip "Active", a monospace "11 of 14 documents", and a monospace "Due Apr 15,
2026". Right-aligned in the header, a primary "New document request" button.
Directly beneath the header, a full-width thin progress bar at 79%.
Below that, a row of status filter chips, left-aligned, each showing a label and a
monospace count: "All 14", "Not requested 3", "Uploaded 4", "Under review 2", "Revision
requested 1", "Approved 3", "Waived 1". "All 14" is selected.
Beneath the chips and above the list, a selection bar spanning full width on a recessed
fill: a checkbox on the left showing an indeterminate state, then monospace text
"4 selected", then right-aligned a primary "Mark 4 as under review" button and a quiet
"Clear selection" link.
Then the document list. Each row: a checkbox, a leading vertical status bar, a square
document icon tile, a two-line text block (document name in medium weight; one-line
description in secondary text), then right-aligned a priority chip, a monospace due date,
and a status badge. Rows:
  1. "Schedule K-1 — Okafor Family Trust" / "Partnership and trust income" / Urgent /
     "Mar 21" / "Under review" — checked
  2. "Form 1099-INT — Meridian Savings" / "Interest income statement" / Medium /
     "Mar 14" / "Uploaded" — checked
  3. "Form 1099-DIV — Meridian Brokerage" / "Dividend income statement" / Medium /
     "Mar 14" / "Uploaded" — checked
  4. "Charitable contribution receipts" / "Any single gift over $250" / Low / "Mar 28" /
     "Uploaded" — checked
  5. "2025 W-2 — Northline Logistics" / "Wage and tax statement" / High / "Mar 14" /
     "Approved"
  6. "Prior-year return (2024)" / "Needed to carry forward deductions" / Medium /
     "Mar 07" / "Approved"
  7. "Form 1098 — mortgage interest" / "Not required for your filing this year" / Low /
     "—" / "Waived"
  8. "Schedule C — Okafor Consulting" / "Self-employment income and expenses" / High /
     "Mar 28" / "Revision requested"
  9. "Vehicle mileage log" / "Business miles driven in 2025" / Low / "Apr 01" /
     "Not requested"

SCREEN 2 — New document request drawer
The project detail screen dimmed behind a right-side drawer that slides in from the right
edge, 520px wide, full viewport height, flush to the right edge with no gap or outer
radius, with a floating shadow on its left edge only.
Drawer header, 64px tall, on a hairline bottom rule: a display-serif title "New document
request" on the left, a quiet close icon button on the right. Beneath the title, small
secondary text "Jordan Okafor · 2025 Tax Return".
Drawer body, scrollable, 24px padding, fields stacked with 20px between them, each with
its label above it in the small uppercase style:
  - "Document type" — a select showing "Schedule K-1", with small helper text beneath it
    reading "Sets the client-facing instructions automatically."
  - "Name" — a text input filled with "Schedule K-1 — Okafor Family Trust"
  - "Description" — a 3-row textarea filled with "Partnership and trust income. Upload the
    2025 form issued by the trust." with a monospace character counter beneath it
  - "Due date" — a date input showing "Mar 21, 2026" with a calendar icon
  - "Priority" — a segmented control of four options, "Low", "Medium", "High", "Urgent",
    with "Urgent" selected
  - "Upload destination" — a select showing "Uploads", with small helper text "Where the
    client's file will be stored in their vault."
  - A horizontal rule, then a row with a toggle switch on the left labelled "Save as draft"
    (off) and, beneath it, small secondary text "Drafts are not visible to the client and
    send no email."
Directly above the footer, a recessed notice block using the under-review status colors,
with a small warning icon, reading "A request named 'Schedule K-1' already exists in this
project." and a quiet "View it" link.
Drawer footer, 72px tall, pinned to the bottom on a hairline top rule: a secondary
"Cancel" button and a primary "Create and notify client" button, right-aligned.

VIBE
Dense, efficient, form-forward. This is a screen a preparer fills in forty times in a
week — every field should be reachable without hunting, and the drawer should feel like a
drawer, not a modal.
```

---

## Refinement patterns

Generation gets you to roughly 80%. These are the prompts that close the gap. Always edit
one thing at a time — bundled corrections get partially applied.

### Harmonizing across screens

Stitch drifts between batches: headers gain a pixel, padding loosens, a nav item moves.
Fix it in one pass at the end rather than per screen. Shift-click every generated screen
on the canvas, then:

```text
Make these consistent across all selected screens without changing their content:
the top navigation bar height, contents, and spacing; the outer content column width and
gutters; the vertical gap between the page header and the first section; the panel padding;
and the list row height. Use the client vault screen as the reference for all of them.
```

### Referencing a screen you are happy with

Once one screen is right, anchor everything else to it by name rather than re-describing:

```text
Create a Team tab for the client detail screen. Copy the exact breadcrumb, client header
block, tab bar, and content column width from the "Client detail, Projects tab" screen.
Replace only the tab content with a list of assigned staff, each row showing a square
monogram avatar, name, role, and a quiet "Remove" button, plus a secondary "Add team
member" button above the list.
```

### Correcting a specific element

Be precise about location and target. Hex codes are acceptable here — this is an edit, not
a generation.

```text
On the preparer dashboard, the "Waiting on you" panel rows are too tall. Reduce the row
height to 56px, reduce the vertical padding inside each row to 12px, and keep the gap
between rows at 12px. Do not change anything else on the screen.
```

### Pulling it back from generic

The most common failure mode is the model reverting to its defaults. This prompt reliably
recovers it:

```text
This screen has drifted toward a generic SaaS dashboard. Remove all card drop shadows and
replace them with 1px hairline borders. Remove any gradient fills. Reduce every corner
radius to a maximum of 6px. Replace any circular avatars with squares at 2px radius.
Ensure there is exactly one primary-filled button on the screen and make every other
button either outlined or quiet. Keep the layout and content exactly as they are.
```

### Generating state variants cheaply

Rather than a fresh generation per state, duplicate the screen on the canvas and edit:

```text
Duplicate this screen and change only the following: the status badge reads "Revision
requested" and uses the revision status colors, the leading status bar on the row matches,
and the review panel is replaced by the revision note form. Everything else is identical.
```

### Loading and error states

Worth one extra generation per major screen, and usually forgotten until implementation:

```text
Create a loading version of the preparer dashboard. Replace every piece of content with a
recessed placeholder block matching the exact dimensions of the content it stands in for —
panel titles, row text blocks, badges, and buttons all become blocks. Keep the top
navigation bar fully rendered. No spinners anywhere.
```

---

## What Stitch will not give you

Two things this sequence cannot produce, both of which need to be built by hand
afterwards:

**Motion.** Stitch outputs static screens. Every transition, entrance, and micro-interaction
is specified in [MOTION_SPEC.md](MOTION_SPEC.md) and implemented in Framer Motion, which
the app already depends on.

**Production code.** The Tailwind and React exports are structurally useful and worth
reading, but they will not match the existing component architecture in
`taxflow-app/src/components/`. Treat the export as a specification to implement against,
not as code to merge. The design tokens are the exception — those transfer directly into
the `@theme` block in `taxflow-app/src/index.css`.
