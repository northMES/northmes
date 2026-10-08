# Canonical list and form page

This is the approval record of the canonical list and form page, issue [northMES/northmes#222](https://github.com/northMES/northmes/issues/222), for story E04-S07 ([northMES/northmes#45](https://github.com/northMES/northmes/issues/45)). The design page is [ui/ui-222-list-form.dc.html](https://claude.ai/design/p/dba068e0-37df-46e5-adcf-4439b6c4c0ad?file=ui%2Fui-222-list-form.dc.html) in the Claude Design project. It follows the direction chosen in the variations round ([ui-222-list-form-variations.md](ui-222-list-form-variations.md)) and builds on the tokens and components of D1 ([ui-189-tokens.md](ui-189-tokens.md)) and the shell of D2 ([shell-190-navigation.md](../shell/shell-190-navigation.md)).

The page draws the list, the detail, the create and edit forms and the settings page that every master data screen of release 1 builds on, on the articles of Acme AB inside the approved D2 shell. Every screen mounts the shell through `ui/Shell.dc.html`, and five shared parts draw the content of `main`: the toolbar, the table, the form, the detail and the dialog. Every name, number and time on the page is invented.

## Approval

Krister Johansson approved the page on 2026-10-08. The header frame F0 records the approval:

- The status line reads "approved by Krister Johansson on 2026-10-08".
- The acceptance line AC3, "Krister approved the page and the design project's README row holds the etag", is ticked: its tag uses the success colors and a checked box comes before its text. AC1, AC2, AC4 and AC5 are unticked.
- The note under the acceptance list starts "AC3 is met, and the other four are open."

The archived article in LI31, LI32, DE27, DE28 and the build notes NA24 is AX-20417. That number was set in the review of pull request #314, after the approval, in the list, detail and form, narrow and keyboard, table and dialog parts; no layout depends on it. The keyboard model in NA24 cites 3.2.2 for a filter toggle, also set in that review.

The F0 and NA24 PNGs show the files at the etags below. The other PNGs were captured from the page before the approval, and their frames are the same at these etags. The design project's README rows of the page and its parts read "approved 2026-10-08" and hold the etags below.

## Approved files

| File | Etag |
|---|---|
| `ui/ui-222-list-form.dc.html` | `1791415700827963` |
| `ui/ui-222-list-form-header.dc.html` | `1791438838493408` |
| `ui/ui-222-list-form-list.dc.html` | `1791444878028770` |
| `ui/ui-222-list-form-states.dc.html` | `1791416339257068` |
| `ui/ui-222-list-form-detail-form.dc.html` | `1791445039229805` |
| `ui/ui-222-list-form-narrow-keyboard.dc.html` | `1791447166931699` |
| `ui/ui-222-list-form-toolbar.dc.html` | `1791415700827963` |
| `ui/ui-222-list-form-table.dc.html` | `1791445548170251` |
| `ui/ui-222-list-form-form.dc.html` | `1791416034946200` |
| `ui/ui-222-list-form-detail.dc.html` | `1791416157693281` |
| `ui/ui-222-list-form-dialog.dc.html` | `1791444719312254` |
| `ui/ui-222-list-form.css` | `1791415579516118` |

The design project returned these etags for `ui/` on 2026-10-08: the header's with the approval status, and those of the list, detail and form, narrow and keyboard, table and dialog parts with the article number AX-20417, the narrow and keyboard part's also with the 3.2.2 citation in NA24. The page file and the toolbar part carry the same etag.

The page also loads files outside this set. `ui/Shell.dc.html` (etag `1791399351371271`) is a byte copy of D2's approved `shell/Shell.dc.html` (etag `1791305527647556`), because dc-import loads a frame from the page's own folder. The folder's `ui/support.js` has etag `1791221437462448`. D1's `ui/tokens.css` and `ui/ui-189-tokens-page.css` keep the etags of the D1 record, and D2's `shell/shell-190-navigation.css` keeps the etag of the D2 record. The variations files `ui/ui-222-list-form-variations*` belong to the variations round and are not part of this approval.

## Page facts

| Fact | Value |
|---|---|
| Issue | [northMES/northmes#222](https://github.com/northMES/northmes/issues/222), plan task E04-S07-T01 |
| Owning story | E04-S07 ([northMES/northmes#45](https://github.com/northMES/northmes/issues/45)), PageFrame and forms |
| Waiting tasks | E04-S07 (PageFrame and forms), E06-S03 (DataTable with URL state) and every list and form screen built on them: the core master data registers, users and roles, settings pages, the History tab and audit list, the production order list and detail, and the connector's settings and reports |
| Area | `ui`, which maps to `packages/ui` |
| Routes | `/$plant/core/articles` (list), `/$plant/core/articles/$articleId` (detail, with `?tab=history`), `/$plant/core/articles/new` (create), `/$plant/core/articles/$articleId/edit` (edit) and `/$plant/core/settings`; for production orders `/$plant/planning/orders` (list), `/$plant/planning/orders/new` (create) and `/$plant/planning/orders/$orderId` (detail) |
| Personas | Plant admin Jonas Holm for master data and settings, in most frames. Planner Alex Lund on the production orders, the order form, the Release order review step and the read-only articles list. Maria Nyberg, a second plant admin, in the version conflict. Anna Berg, an operator with no role that reads articles, in the forbidden states. Hannelore Wiesenthal-Brückner in the German long-strings frames |
| Direction | Graphite: IBM Plex Sans and Mono, 6 px radius, 36 px controls, light by default and dark per user. The D1 tokens and components (approved 2026-10-05) inside the D2 shell (approved 2026-10-06), with the release 1 top bar, which has no bell |
| Content | The articles of Acme AB seen from Plant A and Plant B, the production orders 1001 to 1037 with the details of 1001 and 1002, the tools register and the audit log |

## Direction and decisions

Krister Johansson chose option A, pages, on 2026-10-07 ([ui-222-list-form-variations.md](ui-222-list-form-variations.md)). The list, the detail and the create and edit forms are their own routes (`screenRoute` for articles, `masterDataRoutes` for a register), the table keeps the full width of `main`, and the change reason is a field on the form. The page keeps option B's filter counts, which show in the filter menus and the chips, and option C's review step only for the commands plan 06 lists under WCAG 3.3.4 (saving a draft, breaking a lock, releasing an order). The page draws the review step for Release order.

The header lists what option A costs:

- Reading an article leaves the list. Comparing two articles takes Back or a second tab; Back returns to the same rows, because the URL keeps the filters.
- The chips show the counts of the picked values only; the other counts are one click away in each filter menu.
- A one-field fix is a page change: row menu, Edit, Save, then Back to the list.
- Each row adds a Tab stop for its menu; arrow keys inside the table (D1 question 11) would remove them.

The implementer takes layout, region order, states and transitions, the copy, the keyboard model and the slot placements, never markup, class names, inline styles or demo numbers. A value that is not a D1 token is a question. States the shell owns (module unavailable, the route error panel, the reload dialog, the route loading skeleton) are drawn in D2 and not again here.

## Rows

The page has a header frame, then one row per part file. The chips above the screens carry the frame ids.

| Row | Part file | Frames | What it shows |
|---|---|---|---|
| F0 Header | `ui/ui-222-list-form-header.dc.html` | F0 | Issue, direction of 2026-10-07, acceptance, rows, the issue's frames, assumptions, open questions and known gaps |
| 1 Lists | `ui/ui-222-list-form-list.dc.html` | LI1 to LI42 | The articles list at 1440 in light and dark: the default view, a filter menu with counts and its chip, sort by article number, search, the next page, column choice, selection with the bulk bar and the row menu, and Plant B's presentation; 1280 with the wrapped toolbar and the Columns menu, and 1920 with the zone label; then an ignored link setting, Group by, archived rows with Restore, the read-only list, production orders at Plant A and Plant B, the tools register and the audit log |
| 2 Page states and the settings page | `ui/ui-222-list-form-states.dc.html` | ST1 to ST26 | Each light frame beside its dark twin: the articles list populated, loading, first-run empty, failed, filtered empty, forbidden and out of date; the article detail loading, not found, failed and forbidden; the settings page at `/plant-a/core/settings`, also after Save |
| 3 Detail, forms, dialogs and the review step | `ui/ui-222-list-form-detail-form.dc.html` | DE1 to DE44 | Light frames left, dark frames right: the article detail with its General and History tabs, the create and edit forms, the production order form with its unit, date and time fields, field errors with the summary focused, a server error that keeps the typed values, a version conflict, the review step for Release order, ConfirmDialog for Archive, Archive 3 articles and Restore, a code taken, an archived article, a measured limit, a required reason, the tools create form, the imported article and order, and an open Select |
| 4 Reflow at 320, long strings, keyboard and focus | `ui/ui-222-list-form-narrow-keyboard.dc.html` | NA1 to NA27 | The list, the Filters sheet, the detail, History and the edit form with errors at 320 by 640; German labels, and German and Finnish data at full length, on the list and the edit form; Tab order, focus after each action, focus not obscured by the Save bar or the sticky column, and the D1 focus ring on the stops of this page. NA24 holds the build notes of the whole page |

The rows mount these shared parts:

| Part | What it draws |
|---|---|
| `ui/ui-222-list-form-toolbar.dc.html` | The list toolbar with filter menus and counts, chips, the bulk bar and the 320 Filters sheet |
| `ui/ui-222-list-form-table.dc.html` | The DataTable with its states, selection, row menu and grouping |
| `ui/ui-222-list-form-form.dc.html` | The form with field groups, the error summary, the reason field and the settings form |
| `ui/ui-222-list-form-detail.dc.html` | The detail with the General and History tabs |
| `ui/ui-222-list-form-dialog.dc.html` | ConfirmDialog and the review step for Release order |
| `ui/ui-222-list-form.css` | The shared styles of the frames and parts |

Where each frame of the issue's Frames list is drawn, as the header gives it:

| Issue frame | Frames |
|---|---|
| A master data list in one DataTable: search, filters, sorting and paging kept in the URL, column choice, row selection and row actions, units and numbers per the plant's presentation settings, master data text with its lang attribute | LI1 to LI18 and LI27 to LI34; the same DataTable on production orders (LI35 to LI38), tools (LI39, LI40) and the audit log (LI41, LI42); at 320 NA1 to NA4; keyboard NA17 to NA19 and NA22 |
| PageFrame states: loading as a skeleton of the populated layout, empty with the action that creates the first item, error with a way out, and populated | List: ST1 (dark LI2), loading ST2 and ST12, first run ST3 and ST10, error ST4 and ST11, filtered empty ST17 and ST18, forbidden ST19 and ST20, page out of date ST21 and ST22. Detail: ST5 (dark DE2), loading ST6 and ST13, not found ST7 and ST14, error ST8 and ST15, forbidden ST23 and ST24. The table refetch after a search in LI7 and LI8 |
| The detail page and the create and edit form: field groups, required fields, units, a date and time field, the change reason, the History tab | DE1 to DE10, the imported article and order DE39 to DE42, the open Select DE43 and DE44; at 320 NA5 to NA8 |
| Form errors: inline field errors, the error summary that takes focus, a server error that keeps the typed values, a version conflict | DE11 to DE20; code taken DE29, DE30, DE37 and DE38; archived meanwhile DE31 and DE32; a measured limit DE33 and DE34; a required reason DE35 and DE36; at 320 NA9 and NA10; focus NA14 and NA15 |
| Confirmations and the review step (WCAG 3.3.4) | Release order DE21 and DE22; ConfirmDialog for Archive DE23 and DE24, Archive 3 articles with a required reason DE25 and DE26, Restore DE27 and DE28 |
| A settings page in the same pattern | ST9 and ST16; saved ST25 and ST26 |
| Widths 1280, 1440 and 1920, and a 320 reflow frame where the table scrolls on its own | 1280: LI19, LI20, LI23 and LI24; 1920: LI21, LI22, LI25 and LI26; 320: NA1 to NA10, NA21 and NA22; every other screen is 1440 |
| Light and dark | Every frame above in both themes, each dark frame beside its light one. The keyboard frames NA12 to NA22 alternate between the themes; NA23 draws every focus ring in both |
| One frame with long German or Finnish labels and data | The list NA11 and NA25, the edit form with errors NA26 and NA27 |
| Keyboard and focus frames | NA12 to NA23 |
| Build notes | NA24 |

## Frames

Each chip gives the frame id, the state, the theme and the size, a short note and the URL. A screen frame is the screen plus a 36 px line above it with the document title of its route, which is an annotation. The PNGs were captured from the page's files at device scale 1 and show each frame with its chip. A frame marked "Not exported" has no PNG in this folder; [Frames without a PNG](#frames-without-a-png) lists them.

### Header

| Frame | State | Theme, size | What it shows | PNG |
|---|---|---|---|---|
| F0 | Header | Light, 1440 by 3915 | Issue, direction of 2026-10-07, acceptance with AC3 ticked, rows, the issue's frames, assumptions, open questions and known gaps | [ui-222-list-form-f0-header.png](ui-222-list-form-f0-header.png) |

### Row 1, lists

Part file `ui/ui-222-list-form-list.dc.html`.

| Frame | State | Theme, size | What it shows | PNG |
|---|---|---|---|---|
| LI1 | Articles list | Light, 1440 by 900 | Default view: Last changed, newest first, Rows 1 to 25 of 248 (`/plant-a/core/articles`) | [ui-222-list-form-li1-articles-list-light-1440.png](ui-222-list-form-li1-articles-list-light-1440.png) |
| LI2 | Articles list | Dark, 1440 by 900 | As LI1 | [ui-222-list-form-li2-articles-list-dark-1440.png](ui-222-list-form-li2-articles-list-dark-1440.png) |
| LI3 | Filter menu and chips | Light, 1440 by 900 | Article group menu with every count, keyboard focus on Shafts; chips with the picked counts (`/plant-a/core/articles?articleGroup=Hoses,Shafts`) | [ui-222-list-form-li3-filter-menu-and-chips-light-1440.png](ui-222-list-form-li3-filter-menu-and-chips-light-1440.png) |
| LI4 | Filter menu and chips | Dark, 1440 by 900 | As LI3 | Not exported |
| LI5 | Sorted by article number | Light, 1440 by 900 | Ascending, focus stays on the header; the filter stays, the cursor and page drop (`/plant-a/core/articles?articleGroup=Hoses,Shafts&sort=code`) | Not exported |
| LI6 | Sorted by article number | Dark, 1440 by 900 | As LI5 | Not exported |
| LI7 | Search | Light, 1440 by 900 | Focus stays in the field; the table keeps its header while the matching rows load (`/plant-a/core/articles?q=fläns`) | Not exported |
| LI8 | Search | Dark, 1440 by 900 | As LI7 | Not exported |
| LI9 | Next page | Light, 1440 by 900 | Sorted by name; Previous is disabled and skipped by Tab, focus on Next, which adds page and after (`/plant-a/core/articles?sort=name`) | Not exported |
| LI10 | Next page | Dark, 1440 by 900 | As LI9 | Not exported |
| LI11 | Column choice | Light, 1440 by 900 | Columns menu: a checkbox per column, Article number always shown, keyboard focus on Name (`/plant-a/core/articles`) | Not exported |
| LI12 | Column choice | Dark, 1440 by 900 | As LI11 | Not exported |
| LI13 | Column hidden | Light, 1440 by 900 | Source unchecked in Columns, so the table drops it and Name takes the width (`/plant-a/core/articles`) | Not exported |
| LI14 | Column hidden | Dark, 1440 by 900 | As LI13 | Not exported |
| LI15 | Selection and row menu | Light, 1440 by 900 | Three rows selected, the bulk bar replaces the toolbar; the menu of AX-20411 open (`/plant-a/core/articles`) | [ui-222-list-form-li15-selection-and-row-menu-light-1440.png](ui-222-list-form-li15-selection-and-row-menu-light-1440.png) |
| LI16 | Selection and row menu | Dark, 1440 by 900 | As LI15 | Not exported |
| LI17 | Plant B presentation | Light, 1440 by 900 | Day first with dots and the 12-hour clock; Stock unit menu with each unit and its count (`/plant-b/core/articles`) | Not exported |
| LI18 | Plant B presentation | Dark, 1440 by 900 | As LI17 | Not exported |
| LI19 | Articles list | Light, 1280 by 800 | As LI1; Show archived and Columns wrap to a second row, right-aligned (`/plant-a/core/articles`) | Not exported |
| LI20 | Filters and Columns menu | Light, 1280 by 800 | The chips under the wrapped toolbar; the Columns menu opens inside main (`/plant-a/core/articles?articleGroup=Hoses,Shafts`) | Not exported |
| LI21 | Articles list | Light, 1920 by 1080 | As LI1; Name takes the extra width (`/plant-a/core/articles`) | Not exported |
| LI22 | Zone label | Light, 1920 by 1080 | This browser runs in another time zone, so Last changed carries CEST, the zone of Plant A (`/plant-a/core/articles`) | Not exported |
| LI23 | Articles list | Dark, 1280 by 800 | As LI19 | Not exported |
| LI24 | Filters and Columns menu | Dark, 1280 by 800 | As LI20 | Not exported |
| LI25 | Articles list | Dark, 1920 by 1080 | As LI21 | Not exported |
| LI26 | Zone label | Dark, 1920 by 1080 | As LI22 | Not exported |
| LI27 | Ignored link setting | Light, 1440 by 900 | The link had sort=weight, which no longer applies: the list fell back to its default sort with a replace navigation, and the PageFrame status line says so once (`/plant-a/core/articles`) | Not exported |
| LI28 | Ignored link setting | Dark, 1440 by 900 | As LI27 | Not exported |
| LI29 | Grouped by article group | Light, 1440 by 900 | Group by menu open with focus on Article group; group rows with their counts, Consumables open; 6 groups, 248 articles (`/plant-a/core/articles?group=articleGroup`) | [ui-222-list-form-li29-grouped-by-article-group-light-1440.png](ui-222-list-form-li29-grouped-by-article-group-light-1440.png) |
| LI30 | Grouped by article group | Dark, 1440 by 900 | As LI29 | Not exported |
| LI31 | Archived rows shown | Light, 1440 by 900 | Show archived checked: AX-20417 carries the Archived StatusBadge, and its row menu offers Restore (`/plant-a/core/articles?archived=1`) | Not exported |
| LI32 | Archived rows shown | Dark, 1440 by 900 | As LI31 | Not exported |
| LI33 | Read-only list | Light, 1440 by 900 | Alex Lund, a planner, reads articles but cannot change them: no New article, no selection column, no row menu (`/plant-a/core/articles`) | [ui-222-list-form-li33-read-only-list-light-1440.png](ui-222-list-form-li33-read-only-list-light-1440.png) |
| LI34 | Read-only list | Dark, 1440 by 900 | As LI33 | Not exported |
| LI35 | Production orders | Light, 1440 by 900 | Quantities in each article's stock unit, statuses with Late by 2 days, and a cell state for the article of order 1011, which the reader cannot see (`/plant-a/planning/orders`) | [ui-222-list-form-li35-production-orders-light-1440.png](ui-222-list-form-li35-production-orders-light-1440.png) |
| LI36 | Production orders | Dark, 1440 by 900 | As LI35 | Not exported |
| LI37 | Production orders at Plant B | Light, 1440 by 900 | Plant B's number format, 1,200 pcs and 12.5 kg, with day first dates and the 12-hour clock (`/plant-b/planning/orders`) | Not exported |
| LI38 | Production orders at Plant B | Dark, 1440 by 900 | As LI37 | Not exported |
| LI39 | Tools register | Light, 1440 by 900 | The master-data kit's register: Scope reads Company or Plant; the row menu of T-100 offers Move to company (`/plant-a/core/tools`) | Not exported |
| LI40 | Tools register | Dark, 1440 by 900 | As LI39 | Not exported |
| LI41 | Audit log | Light, 1440 by 900 | Other principals and surfaces: the planning assistant for Alex Lund, Anna Berg at Press 4, a pseudonymized user, a redacted key; no totalCount, so Newest first with Previous and Next (`/plant-a/audit/log`) | Not exported |
| LI42 | Audit log | Dark, 1440 by 900 | As LI41 | Not exported |

### Row 2, page states and the settings page

Part file `ui/ui-222-list-form-states.dc.html`.

| Frame | State | Theme, size | What it shows | PNG |
|---|---|---|---|---|
| ST1 | List populated | Light, 1440 by 900 | Articles, rows 1 to 25 of 248, newest change first. Dark: LI2 (`/plant-a/core/articles`) | Not exported |
| ST2 | List loading | Light, 1440 by 900 | Toolbar and table header drawn, skeleton rows, main busy, focus on the h1 (`/plant-a/core/articles`) | [ui-222-list-form-st2-list-loading-light-1440.png](ui-222-list-form-st2-list-loading-light-1440.png) |
| ST3 | List empty | Light, 1440 by 900 | First run: No articles yet, with New article (`/plant-a/core/articles`) | [ui-222-list-form-st3-list-empty-light-1440.png](ui-222-list-form-st3-list-empty-light-1440.png) |
| ST4 | List error | Light, 1440 by 900 | Could not load articles, with the correlation id and Try again (`/plant-a/core/articles`) | [ui-222-list-form-st4-list-error-light-1440.png](ui-222-list-form-st4-list-error-light-1440.png) |
| ST5 | Detail populated | Light, 1440 by 900 | Article AX-20410, General tab. Dark: DE2 (`/plant-a/core/articles/$articleId`) | Not exported |
| ST6 | Detail loading | Light, 1440 by 900 | The h1 shows the route title until the article loads; tabs and skeleton Cards (`/plant-a/core/articles/$articleId`) | Not exported |
| ST7 | Detail not found | Light, 1440 by 900 | EmptyState with Back to Articles (`/plant-a/core/articles/$articleId`) | [ui-222-list-form-st7-detail-not-found-light-1440.png](ui-222-list-form-st7-detail-not-found-light-1440.png) |
| ST8 | Detail error | Light, 1440 by 900 | Could not load the article, with the correlation id and Try again (`/plant-a/core/articles/$articleId`) | Not exported |
| ST9 | Settings page | Light, 1440 by 900 | Plant A presentation settings with their sources, the reason and Save settings (`/plant-a/core/settings`) | [ui-222-list-form-st9-settings-page-light-1440.png](ui-222-list-form-st9-settings-page-light-1440.png) |
| ST10 | List empty | Dark, 1440 by 900 | As ST3 | Not exported |
| ST11 | List error | Dark, 1440 by 900 | As ST4 | Not exported |
| ST12 | List loading | Dark, 1440 by 900 | As ST2 | Not exported |
| ST13 | Detail loading | Dark, 1440 by 900 | As ST6 | Not exported |
| ST14 | Detail not found | Dark, 1440 by 900 | As ST7 | Not exported |
| ST15 | Detail error | Dark, 1440 by 900 | As ST8 | Not exported |
| ST16 | Settings page | Dark, 1440 by 900 | As ST9 | Not exported |
| ST17 | List filtered empty | Light, 1440 by 900 | Article group Housings and Source NorthMES match no article: each chip counts 0, and the EmptyState offers Clear filters (`/plant-a/core/articles?articleGroup=Housings&source=NorthMES`) | [ui-222-list-form-st17-list-filtered-empty-light-1440.png](ui-222-list-form-st17-list-filtered-empty-light-1440.png) |
| ST18 | List filtered empty | Dark, 1440 by 900 | As ST17 | Not exported |
| ST19 | List forbidden | Light, 1440 by 900 | Anna Berg holds no role that reads articles: the page names the missing permission and shows no toolbar and no data (`/plant-a/core/articles`) | [ui-222-list-form-st19-list-forbidden-light-1440.png](ui-222-list-form-st19-list-forbidden-light-1440.png) |
| ST20 | List forbidden | Dark, 1440 by 900 | As ST19 | Not exported |
| ST21 | List page out of date | Light, 1440 by 900 | The cursor of page 3 no longer exists: Go to the first page keeps the sort and drops page and after (`/plant-a/core/articles?sort=name&page=3&after=$cursor`) | Not exported |
| ST22 | List page out of date | Dark, 1440 by 900 | As ST21 | Not exported |
| ST23 | Detail forbidden | Light, 1440 by 900 | Anna Berg follows a link to an article without a role that reads articles: no tabs and no data (`/plant-a/core/articles/$articleId`) | Not exported |
| ST24 | Detail forbidden | Dark, 1440 by 900 | As ST23 | Not exported |
| ST25 | Settings saved | Light, 1440 by 900 | After Save settings: the saved note in a status region, the formats change after the next page load, focus stays on Save settings (`/plant-a/core/settings`) | Not exported |
| ST26 | Settings saved | Dark, 1440 by 900 | As ST25 | Not exported |

### Row 3, detail, forms, dialogs and the review step

Part file `ui/ui-222-list-form-detail-form.dc.html`.

| Frame | State | Theme, size | What it shows | PNG |
|---|---|---|---|---|
| DE1 | Article detail, General tab | Light, 1440 by 900 | Sections as Cards with DefinitionLists; Edit and Archive in the top bar (`/plant-a/core/articles/$articleId`) | [ui-222-list-form-de1-article-detail-general-tab-light-1440.png](ui-222-list-form-de1-article-detail-general-tab-light-1440.png) |
| DE2 | Article detail, General tab | Dark, 1440 by 900 | As DE1 | Not exported |
| DE3 | Article detail, History tab | Light, 1440 by 900 | Two entries open with Field, Before and After; focus on the History tab (`/plant-a/core/articles/$articleId?tab=history`) | [ui-222-list-form-de3-article-detail-history-tab-light-1440.png](ui-222-list-form-de3-article-detail-history-tab-light-1440.png) |
| DE4 | Article detail, History tab | Dark, 1440 by 900 | As DE3 | Not exported |
| DE5 | New article, create form | Light, 1440 by 900 | Empty fields, only optional fields marked; focus on the h1 after arrival (`/plant-a/core/articles/new`) | Not exported |
| DE6 | New article, create form | Dark, 1440 by 900 | As DE5 | Not exported |
| DE7 | Edit article, edit form | Light, 1440 by 900 | Scrolled to Reason for change above the sticky footer; focus in Reason (`/plant-a/core/articles/$articleId/edit`) | [ui-222-list-form-de7-edit-article-edit-form-light-1440.png](ui-222-list-form-de7-edit-article-edit-form-light-1440.png) |
| DE8 | Edit article, edit form | Dark, 1440 by 900 | As DE7 | Not exported |
| DE9 | New production order, create form | Light, 1440 by 900 | Quantity (pcs), deadline date and time in plant time; focus in Deadline date (`/plant-a/planning/orders/new`) | Not exported |
| DE10 | New production order, create form | Dark, 1440 by 900 | As DE9 | Not exported |
| DE11 | Edit article, field errors | Light, 1440 by 900 | After Save: inline errors on two fields; the error summary has focus (`/plant-a/core/articles/$articleId/edit`) | [ui-222-list-form-de11-edit-article-field-errors-light-1440.png](ui-222-list-form-de11-edit-article-field-errors-light-1440.png) |
| DE12 | Edit article, field errors | Dark, 1440 by 900 | As DE11 | [ui-222-list-form-de12-edit-article-field-errors-dark-1440.png](ui-222-list-form-de12-edit-article-field-errors-dark-1440.png) |
| DE13 | New production order, field errors | Light, 1440 by 900 | After Save: a number and a date that do not parse; the summary has focus (`/plant-a/planning/orders/new`) | Not exported |
| DE14 | New production order, field errors | Dark, 1440 by 900 | As DE13 | Not exported |
| DE15 | Edit article, server error | Light, 1440 by 900 | Could not save, with the correlation id; the summary has focus (`/plant-a/core/articles/$articleId/edit`) | Not exported |
| DE16 | Edit article, server error | Dark, 1440 by 900 | As DE15 | Not exported |
| DE17 | Edit article, server error, values kept | Light, 1440 by 900 | Scrolled down after the server error: the typed note and reason are kept (`/plant-a/core/articles/$articleId/edit`) | Not exported |
| DE18 | Edit article, server error, values kept | Dark, 1440 by 900 | As DE17 | Not exported |
| DE19 | Edit article, version conflict | Light, 1440 by 900 | Jonas Holm saved at 14:05 after Maria Nyberg opened it; the summary has focus (`/plant-a/core/articles/$articleId/edit`) | [ui-222-list-form-de19-edit-article-version-conflict-light-1440.png](ui-222-list-form-de19-edit-article-version-conflict-light-1440.png) |
| DE20 | Edit article, version conflict | Dark, 1440 by 900 | As DE19 | Not exported |
| DE21 | Release order, review step | Light, 1440 by 900 | Alert Dialog over order 1001 with the values and Reason; focus in Reason (`/plant-a/planning/orders/$orderId`) | [ui-222-list-form-de21-release-order-review-step-light-1440.png](ui-222-list-form-de21-release-order-review-step-light-1440.png) |
| DE22 | Release order, review step | Dark, 1440 by 900 | As DE21 | [ui-222-list-form-de22-release-order-review-step-dark-1440.png](ui-222-list-form-de22-release-order-review-step-dark-1440.png) |
| DE23 | Archive article, confirm dialog | Light, 1440 by 900 | Alert Dialog over the list after Archive in the row menu of AX-20410; optional reason; focus in Reason (`/plant-a/core/articles`) | [ui-222-list-form-de23-archive-article-confirm-dialog-light-1440.png](ui-222-list-form-de23-archive-article-confirm-dialog-light-1440.png) |
| DE24 | Archive article, confirm dialog | Dark, 1440 by 900 | As DE23 | Not exported |
| DE25 | Archive 3 articles, reason required | Light, 1440 by 900 | If a contract requires the reason (open question 8): 2 characters typed, the message states the range; focus in Reason (`/plant-a/core/articles`) | Not exported |
| DE26 | Archive 3 articles, reason required | Dark, 1440 by 900 | As DE25 | Not exported |
| DE27 | Restore article, confirm dialog | Light, 1440 by 900 | Restore in the row menu of AX-20417 with Show archived on; optional reason; focus in Reason (`/plant-a/core/articles?archived=1`) | Not exported |
| DE28 | Restore article, confirm dialog | Dark, 1440 by 900 | As DE27 | Not exported |
| DE29 | New article, number taken | Light, 1440 by 900 | After Save: core.code_taken lands on Article number and names no other plant; the summary has focus (`/plant-a/core/articles/new`) | Not exported |
| DE30 | New article, number taken | Dark, 1440 by 900 | As DE29 | Not exported |
| DE31 | Edit article, archived meanwhile | Light, 1440 by 900 | Save returned core.archived: the typed values stay, with Restore article; the summary has focus (`/plant-a/core/articles/$articleId/edit`) | Not exported |
| DE32 | Edit article, archived meanwhile | Dark, 1440 by 900 | As DE31 | Not exported |
| DE33 | Edit operation, limit | Light, 1440 by 900 | After Save: the server states the limit in the unit typed; the summary has focus (`/plant-a/core/routings/$routingId/operations/$operationId/edit`) | Not exported |
| DE34 | Edit operation, limit | Dark, 1440 by 900 | As DE33 | Not exported |
| DE35 | Edit article, reason required | Light, 1440 by 900 | A required reason: (optional) drops, the message states the range; focus came from the summary link (`/plant-a/core/articles/$articleId/edit`) | Not exported |
| DE36 | Edit article, reason required | Dark, 1440 by 900 | As DE35 | Not exported |
| DE37 | New tool, code taken | Light, 1440 by 900 | The master-data kit's create form: Code T-100 is in use, so the message asks for another code; the summary has focus (`/plant-a/core/tools/new`) | Not exported |
| DE38 | New tool, code taken | Dark, 1440 by 900 | As DE37 | Not exported |
| DE39 | Imported article | Light, 1440 by 900 | AX-31007 from the Pyramid import: Source Pyramid with its external reference and no external data (`/plant-a/core/articles/$articleId`) | Not exported |
| DE40 | Imported article | Dark, 1440 by 900 | As DE39 | Not exported |
| DE41 | Imported order | Light, 1440 by 900 | Order 1002 from Pyramid: External data as sent, operations with statuses, the order panels slot beside the details (`/plant-a/planning/orders/$orderId`) | Not exported |
| DE42 | Imported order | Dark, 1440 by 900 | As DE41 | Not exported |
| DE43 | Edit article, Stock unit open | Light, 1440 by 900 | The Select opens as a listbox with the current option checked and focused (`/plant-a/core/articles/$articleId/edit`) | Not exported |
| DE44 | Edit article, Stock unit open | Dark, 1440 by 900 | As DE43 | Not exported |

### Row 4, reflow at 320, long strings, keyboard and focus

Part file `ui/ui-222-list-form-narrow-keyboard.dc.html`.

| Frame | State | Theme, size | What it shows | PNG |
|---|---|---|---|---|
| NA1 | Articles list | Light, 320 by 640 | First view: the selection, the sticky Article number and Name; the table scrolls in its own region (`/plant-a/core/articles?articleGroup=Hoses,Shafts`) | [ui-222-list-form-na1-articles-list-light-320.png](ui-222-list-form-na1-articles-list-light-320.png) |
| NA2 | Articles list | Dark, 320 by 640 | As NA1 | Not exported |
| NA3 | Filters sheet | Light, 320 by 640 | Focus on Close; Tab stays in the sheet (`/plant-a/core/articles?articleGroup=Hoses,Shafts`) | Not exported |
| NA4 | Filters sheet | Dark, 320 by 640 | As NA3 | Not exported |
| NA5 | Article detail | Light, 320 by 640 | General in one column; Archive and Edit in Page actions (`/plant-a/core/articles/$articleId`) | Not exported |
| NA6 | Article detail | Dark, 320 by 640 | As NA5 | Not exported |
| NA7 | Article history | Light, 320 by 640 | The History table scrolls in its own region (`/plant-a/core/articles/$articleId?tab=history`) | Not exported |
| NA8 | Article history | Dark, 320 by 640 | As NA7 | Not exported |
| NA9 | Edit article with errors | Light, 320 by 640 | Summary focused; one column; Save bar in view (`/plant-a/core/articles/$articleId/edit`) | Not exported |
| NA10 | Edit article with errors | Dark, 320 by 640 | As NA9 | Not exported |
| NA11 | Long strings, German and Finnish | Light, 1440 by 900 | German chrome and labels, German and Finnish names at full length, the long group in its chip (`/$plant/core/articles?articleGroup=$group`) | [ui-222-list-form-na11-long-strings-german-and-finnish-light-1440.png](ui-222-list-form-na11-long-strings-german-and-finnish-light-1440.png) |
| NA12 | Tab order on the list | Light, 1440 by 900 | Numbers are the Tab sequence; the skip link has focus (`/plant-a/core/articles?articleGroup=Hoses,Shafts`) | [ui-222-list-form-na12-tab-order-on-the-list-light-1440.png](ui-222-list-form-na12-tab-order-on-the-list-light-1440.png) |
| NA13 | Tab order on the edit form | Dark, 1440 by 900 | Numbers start in main; the shell stops come first as in NA12 (`/plant-a/core/articles/$articleId/edit`) | Not exported |
| NA14 | Focus after an error | Light, 1440 by 900 | Save article found 2 errors; the summary has focus (`/plant-a/core/articles/$articleId/edit`) | Not exported |
| NA15 | Summary link followed | Dark, 1440 by 900 | Enter on the first summary link; focus on Article number (`/plant-a/core/articles/$articleId/edit`) | Not exported |
| NA16 | Focus after Save | Light, 1440 by 900 | The detail route; its h1 has focus; the polite region speaks (`/plant-a/core/articles/$articleId`) | Not exported |
| NA17 | Focus after Back | Dark, 1440 by 900 | Back from AX-31008: the same rows, focus on the h1 (`/plant-a/core/articles?articleGroup=Hoses,Shafts`) | Not exported |
| NA18 | Row menu open | Light, 1440 by 900 | Actions for AX-20411 open; keyboard focus on Edit (`/plant-a/core/articles`) | Not exported |
| NA19 | Bulk bar with focus | Dark, 1440 by 900 | Three rows selected; focus on Archive 3 articles (`/plant-a/core/articles`) | Not exported |
| NA20 | Focus not obscured by the Save bar | Light, 1440 by 900 | Reason has focus and ends above the sticky Save bar (`/plant-a/core/articles/$articleId/edit`) | Not exported |
| NA21 | Focus not obscured by the Save bar | Dark, 320 by 640 | Note above the Save bar (`/plant-a/core/articles/$articleId/edit`) | Not exported |
| NA22 | Sticky column and the row menu | Light, 320 by 640 | Region scrolled to its end; focus on Actions for AX-20410 (`/plant-a/core/articles`) | Not exported |
| NA23 | D1 focus ring on the stops of this page | Light and dark, 2736 by 1830 | The stops of this page, each part on its own | Not exported |
| NA24 | Build notes | Light, 3920 by 4000 | Not part of the UI. Components, tokens, keyboard, ARIA, announcements, URL keys, slots, copy and WCAG 2.2 | [ui-222-list-form-na24-build-notes-light.png](ui-222-list-form-na24-build-notes-light.png) |
| NA25 | Long strings, German and Finnish | Dark, 1440 by 900 | As NA11 | Not exported |
| NA26 | Long strings, German edit form with errors | Light, 1440 by 900 | German labels, the summary and the range error at full length; Änderungsgrund (optional) further down (`/$plant/core/articles/$articleId/edit`) | Not exported |
| NA27 | Long strings, German edit form with errors | Dark, 1440 by 900 | As NA26 | Not exported |

### Frames without a PNG

This record has 28 PNGs in the folder: the header, the main states in light, the dark frames LI2, DE12 and DE22, the list at 320, the long strings, the Tab order on the list and the build notes.

- Dark twins of an exported light frame, with the same layout in the D1 dark tokens: LI4, LI16, LI30, LI34, LI36; ST10, ST11, ST12, ST14, ST16, ST18, ST20; DE2, DE4, DE8, DE20, DE24; NA2, NA25.
- ST1 and ST5 draw the populated list and detail. Their chips name LI2 and DE2 as their dark frames.
- The other frames are on the design page only. Row 1: LI5 to LI14, LI17 to LI28, LI31, LI32 and LI37 to LI42. Row 2: ST6, ST8, ST13, ST15 and ST21 to ST26. Row 3: DE5, DE6, DE9, DE10, DE13 to DE18 and DE25 to DE44. Row 4: NA3 to NA10, NA13 to NA23, NA26 and NA27.

## Build notes

NA24 holds the build notes of the whole page, marked on the page as not part of the UI. This section carries them over in short. The notes are for E04-S07 (PageFrame and forms), E06-S03 (DataTable with URL state) and every list and form screen built on them. When the page and the accessibility rules disagree, the rules win. A line marked proposed needs Krister Johansson's yes.

### Components

The shadcn components by name, with where the page uses them and the frames that draw their states:

| Component | Used for | Frames |
|---|---|---|
| DataTable | TanStack Table v9 with manual sorting, paging, filtering and grouping, all on the server. One Card per list, a sticky header row, the identifier column as IdentifierLink (the row link), a select column and a row menu column. States: sorted and sortable headers, hover, selected, loading (skeleton rows, `aria-busy`), group rows, archived rows, read-only (no select or menu column), a hidden-row cell state, and at 320 fixed column widths in a region that scrolls both ways with the identifier sticky | LI1, LI5, LI15, LI29, LI31, LI33, LI35, ST2, NA1, NA22 |
| DropdownMenu | Filter menus (checkbox items, a hint label, the count at the end), Group by (radio group, No grouping first), Columns (checkbox items, the identifier disabled) and the row menu (Edit, Archive; Restore on an archived row; Move to company on a plant tool; Release order on a planned order). Keyboard focus on an item draws a 2 px inset outline on `--accent` | LI3, LI11, LI15, LI29, LI31, LI39, NA18 |
| Badge | StatusBadge (icon plus text) for order status, Late by 2 days with Clock and Archived with the Archive icon; the count badge on a filter button (`aria-hidden`, the count read from visually hidden text); the Surface badge in History and the audit log | LI3, LI31, LI35, LI41, DE3, DE41 |
| Tabs | General and History on EntityDetailPage, plus slot tabs; the open tab lives in `tab` | DE1, DE3, NA5, NA7, NA23 |
| Tooltip | On every IconButton, with the button's accessible name as its text. Opens at once on keyboard focus and after a short delay on hover, stays open while hovered, closes on Escape without moving focus and holds nothing interactive (1.4.13) | NA23 |
| Form | EntityForm and the command forms: useZodForm (react-hook-form 7 on `contract.fields`), a Field per input with label, description, message, `aria-invalid` and `aria-describedby`. Field groups as Cards, at most 760 px wide; the Save bar sticks to the bottom of the form scroller | DE7, DE11, DE13, DE15, DE19, DE29, DE31, DE33, DE35, ST25 |
| Input | Search articles, Article number, Name with its data language tag, translation text, numbers (NumberField drawn as Input with a format hint), the deadline date with its picker button. Invalid draws a `--destructive` border plus a 1 px inset. A value longer than the field ends in an ellipsis while the field is not focused and scrolls inside it when focused (proposed) | DE9, DE11, NA9, NA15 |
| Select | Article group, Stock unit, a translation's language, Scope, a measured value's unit, each setting: placeholder, open listbox with the current option checked and focused, a long value that ends in an ellipsis | DE5, DE43, NA26 |
| Textarea | Note and Reason, with the placeholder "Why you made this change"; required with the range error | DE7, DE35, NA20 |
| Dialog | Alert Dialog for ConfirmDialog (Archive, Restore, Archive 3 articles) and the review step for Release order, each with the reason field | DE21, DE23, DE25, DE27 |
| Alert | The error summary, the server error with the correlation id, the version conflict with Reload article and the archived notice with Restore article (destructive); the PageFrame status line for an ignored link setting (info); the saved note on settings (success) | DE11, DE15, DE19, DE31, LI27, ST25 |
| Button | Default for the one main action of a region (New article, Save article, the dialog confirm, Show 61 articles); outline for the rest; ghost for Clear selection; link for Clear filters and Clear plant value. IconButton (36 px, a required name) for the row menu, Copy correlation id and the picker; 24 px for Clear search and a chip's remove button | all |
| Checkbox | Row selection and Select all rows on this page (mixed when some rows are selected), Show archived, the values in the Filters sheet; a 16 px box in a 24 px hit area | LI15, LI31, NA12, NA19 |
| Pagination | Previous and Next only, on keyset cursors, never page numbers. "Rows 1 to 25 of 248" beside them where totalCount exists, "Newest first" where it does not. At 320 the icon buttons Previous page and Next page. Previous is disabled on the first page and skipped by Tab | LI1, LI9, LI41, NA1 |
| Sheet | The Filters sheet at 320: from the right, full width, a fieldset per filter field with counts, Group by and Show archived; the footer holds Show 61 articles and Clear filters; it opens with focus on Close | NA3, NA4 |
| Card, Skeleton, Popover | Card around the table, each detail section and each field group; Skeleton for LoadingState in the populated layout (the table keeps its header, the detail draws four skeleton Cards); Popover for Lookup (Browse articles), drawn closed | ST2, ST6, DE9 |

The `@northmes/ui` patterns are PageFrame, EntityListPage, EntityDetailPage, EntityForm, SettingsForm, HistoryTab, StatusBadge, EmptyState, LoadingState, ErrorState, ConfirmDialog, DateTimeText, MeasureText, QuantityInput, Lookup, DefinitionList and IdentifierLink. Tools are the example of the master data kit (`masterDataRoutes`); articles use the lower-level pieces with `screenRoute`.

### Tokens and layout values

Every color is a D1 token, and disabled is opacity 0.5.

| Token | Use |
|---|---|
| `--background`, `--foreground` | The page, the Save bar, dialogs and the sheet |
| `--card`, `--card-foreground` | The table Card, detail sections, field groups |
| `--muted`, `--muted-foreground` | Table header row, the tabs list, the Archived badge; secondary text, the (optional) marker, descriptions, counts |
| `--accent`, `--accent-foreground` | Row hover, the keyboard focus fill of a menu item |
| `--info-subtle`, `--info` | Selected rows, the bulk bar, the PageFrame status line; the status line icon, a setting set for the plant |
| `--primary`, `--primary-foreground`, `--primary-hover` | Default buttons and the filter count badge |
| `--secondary`, `--secondary-foreground` | Filter chips |
| `--border`, `--input` | Card, row and section lines; field and outline button borders |
| `--destructive`, `--destructive-subtle` | Invalid field border plus a 1 px inset, error text and icon, the summary border; the summary and ErrorState icon fill |
| `--success`, `--success-subtle` | The settings saved note |
| `--link` | Row links (IdentifierLink) and summary links |
| `--focus-outline`, `--focus-ring` | The two-tone focus ring: a 2 px outline at 2 px offset plus a 2 px band |
| `--status-*` and `--status-*-foreground` | StatusBadge: registered, planned, active, paused, finished, delivered, cancelled |
| `--late`, `--late-foreground` | Late by 2 days |
| `--radius` (0.375rem, 6 px) | Controls; the sm, md and xl steps for chips, menu items and Cards |
| `--nm-control-height` (36 px) | Inputs, Selects, buttons, IconButtons |
| `--nm-target-min` (24 px) | Chip remove, Clear search, checkbox hit areas, sort header buttons, links |
| `--font-sans`, `--font-mono` | IBM Plex Sans; IBM Plex Mono for identifiers, dates, times, numbers and counts |

These layout values are not tokens, so each is a question for Krister Johansson (proposed):

- Table: the full width of `main` at every width; at 320 fixed tracks, with the sticky identifier at most 40 percent of the region.
- Form: at most 760 px wide; one column at 320.
- Save bar: sticky at the bottom of the form scroller, whose `scroll-padding-bottom` is the bar's height plus 8 px (63 px).
- Table scroller: `scroll-padding-top` is the header row plus 8 px (46 px; 52 px at 320, where the header row is 44 px); at 320 `scroll-padding-left` is the sticky column's width.
- Dialog: 520 px wide; at 320 the full width less 16 px on each side.

### Keyboard model

Composite keys follow the WAI-ARIA Authoring Practices and the Base UI defaults until D1 question 11 is settled. A route change focuses the new h1, else `main`; a filter, sort or search change never moves focus.

| Control | Keys | Result and where focus goes | Frames |
|---|---|---|---|
| Skip link | Tab reaches it first; Enter | Focus moves to `main`; the next Tab reaches Search articles | NA12 |
| Search articles | Type; Escape or Clear search empties it | Rows follow after the input pause; `q` changes with a replace navigation; focus stays | NA12 |
| Filter button | Enter, Space or Down opens; Up, Down, Home, End move; Space or Enter toggles a value; Escape closes | Opens with focus on the last picked value, else the first. A toggle keeps the menu open (proposed); the rows change and focus stays (3.2.2). Escape returns focus to the button | LI3 |
| Group by | As a filter button; Enter picks | Picks one grouping, closes, focus back on the button | LI29 |
| Show archived | Space | Toggles `archived=1`; focus stays | LI31 |
| Columns | As a filter button | Article number is disabled and skipped by the arrows; focus stays in the menu | LI11 |
| Chip remove | Enter or Space | Removes that field's filter; focus moves to the next chip's remove button, else the field's filter button (proposed) | NA12 |
| Clear filters | Enter or Space | Removes every filter; focus moves to Search articles (proposed). The same from the filtered EmptyState | NA12, ST17 |
| Sortable header | Enter or Space | Sorts ascending, then descending; `aria-sort` changes; focus stays on the header | NA12 |
| Select all rows on this page | Space | Checks every row on the page, or clears them when all are checked | NA19 |
| Row checkbox | Space | Toggles the row; focus stays; the bulk bar replaces the toolbar | NA19 |
| Row link | Enter | Opens the detail route; focus moves to its h1 | NA12 |
| Row menu | Enter, Space or Down opens; Up, Down, Home, End move; Enter activates; Escape closes; Tab closes and moves on | Opens with focus on the first item; Escape returns focus to the button | LI15, NA18 |
| Archive 3 articles | Enter or Space | Opens ConfirmDialog; Cancel returns focus to it | NA19, DE25 |
| Clear selection | Enter or Space | Clears the selection; the toolbar returns; focus moves to Search articles (proposed) | NA19 |
| Group row | Enter or Space on its expand button | Opens or closes the group; `aria-expanded` changes; focus stays | LI29 |
| Next, Previous | Enter or Space | Loads that page; focus stays. When the button becomes disabled, focus moves to the other one (proposed) | NA12 |
| Table region (320) | Tab onto it; arrow keys | Scrolls the region; its stops follow it in the Tab order | NA22, NA23 |
| Filters (320) | Enter or Space | Opens the Sheet with focus on Close; Tab stays inside; values apply as they change; Escape, Close or Show 61 articles closes it and returns focus to Filters | NA3 |
| Detail tabs | Left and Right move; Enter or Space selects | Manual activation, so an arrow press does not push a history entry (proposed); selecting pushes `tab` | NA5, NA7 |
| History expand button | Enter or Space | Opens or closes the entry's Field, Before and After rows; focus stays | NA7 |
| Edit, Archive (top bar) | Enter or Space | Edit opens the edit route with focus on its h1; Archive opens ConfirmDialog | NA16 |
| Select field | Enter, Space or Down opens; Up, Down, Home, End move; Enter picks; Escape closes | Opens with the current option focused; focus returns to the field | DE43 |
| Add translation | Enter or Space | Adds a row; focus moves to its language Select (proposed) | NA13 |
| Remove a translation | Enter or Space | Removes the row; focus moves to the next row's language Select, else Add translation (proposed) | NA13 |
| Save article | Enter or Space; Enter in a single-line field (proposed) | Errors: focus moves to the summary. Success: the detail route with a replace navigation (proposed), focus on its h1, "Article AX-20410 saved" in the polite region | NA14, NA16 |
| Summary link | Enter | Moves focus to its field, clear of the Save bar | NA15 |
| Reload article, Restore article | Enter or Space | Reloads the saved values, or restores the article, then focus returns to the summary heading (proposed) | DE19, DE31 |
| Cancel (form) | Enter or Space | The detail route (the list for create), focus on its h1, no message; unsaved edits are open question 9 | NA16 |
| ConfirmDialog, review step | Tab cycles Reason, Cancel and the confirm button; Escape cancels | Opens with focus in Reason (proposed). Cancel and Escape return focus to the trigger. After a confirmed archive from the list, focus moves to the next row's link | DE21, DE23, DE25, DE27 |
| Release order, confirmed | Enter or Space on Release order in the review step | Release order leaves the top bar, so focus moves to the h1 Order 1001, and the polite region says "Order 1001 released" (proposed) | DE21 |
| Archive article, confirmed from the detail | Enter or Space on Archive article | Focus moves to the h1 Article AX-20410, the top bar offers Restore, and the polite region says "Article AX-20410 archived" (proposed) | none |
| Restore article, confirmed | Enter or Space on Restore article | The row stays in the list with Show archived on; focus returns to its Actions button, and the polite region says "Article AX-20417 restored" (proposed) | DE27 |
| Try again | Enter or Space | The region returns to its skeleton with `aria-busy`, and focus moves to the h1 (proposed) | ST4, ST8 |
| Go to the first page | Enter or Space | A replace navigation to the first page with the same sort and filters; focus moves to the h1 (proposed) | ST21 |
| Copy correlation id | Enter or Space | Copies the id; focus stays on the button, and the polite region says "Correlation id copied" (proposed) | ST4, DE15 |
| Save settings | Enter or Space | The saved note appears in its status region; focus stays on Save settings (proposed) | ST25 |

Focus order per page:

- List: the skip link, the switcher, the sidebar, the user button, Collapse sidebar, the crumb links, New article, Assistant and Help; then Search articles, Article group, Stock unit, Source, Group by, Show archived, Columns, each chip's remove button, Clear filters, Select all rows on this page, the sort buttons Article number, Name and Last changed, then per row Select, the article number link and Actions, then Next (NA12).
- Bulk: Archive 3 articles and Clear selection take the toolbar's place before Select all rows on this page (NA19).
- Detail: the shell, Archive and Edit in the top bar, Assistant, Help; the selected tab (one stop); in the panel, on History, each entry's expand button; Previous and Next when enabled (NA5, NA7).
- Form: the shell (no page actions); Article number, Name, per translation row its language, text and Remove, Add translation, Article group, Stock unit, Note, Reason, Save article, Cancel. With errors the summary links come first (NA13 to NA15).
- 320: Page actions replaces the top bar buttons; then Search articles, Filters, Columns, each chip's remove button, Clear filters, the table region and its stops, Previous page and Next page (NA1, NA22).

### Roles and accessible names

| Element | Role and attributes | Accessible name |
|---|---|---|
| Page heading | h1, `tabindex -1`, focused on arrival | Articles; Article AX-20410; New article; Edit article AX-20410 |
| Search | input type search | Search articles |
| Filter button | button, `aria-haspopup` menu, `aria-expanded`, `aria-controls` the menu; the count badge `aria-hidden` | Article group, 2 selected (the visible label first, 2.5.3) |
| Filter menu | menu with menuitemcheckbox items, `aria-checked`; the hint is presentation | Article group; items read as Hoses 21 |
| Group by menu | menu with menuitemradio items | Group by; Group by: Article group when set |
| Show archived | checkbox | Show archived |
| Columns menu | menu with menuitemcheckbox items; Article number `aria-disabled` | Columns; Article number, Always shown |
| Chip | text with a button | Remove the article group filter |
| Status line | status (polite) | This link had 1 setting that no longer applies, so it was ignored. |
| Bulk bar | group, two Tab stops (assumption A17) | Selected articles |
| Table | table with columnheader cells; `aria-sort` ascending, descending or none on sortable headers; `aria-busy` while loading | Articles |
| Select all | checkbox, `aria-checked` mixed when some rows are selected | Select all rows on this page |
| Row checkbox | checkbox | Select AX-20410; for orders, Select order 1001 |
| Row link | link (IdentifierLink) | AX-20410 |
| Row menu button and menu | button with `aria-haspopup` menu, `aria-expanded`, `aria-controls`; menu with menuitem items | Actions for AX-20410 |
| Tooltip | tooltip; the IconButton keeps its `aria-label`, so the Tooltip adds no `aria-describedby` | The button's name |
| Cell state | text after an EyeOff icon (`aria-hidden`) | Article not available to you |
| Group row | row with a button, `aria-expanded` | Consumables, 12 articles |
| Table region (320) | region, `tabindex 0` | Articles table, scrolls sideways |
| Pager | buttons; a disabled one has the `disabled` attribute, so Tab skips it | Previous, Next; at 320 Previous page, Next page |
| EmptyState | h2 heading and text; the action button | No articles yet |
| ErrorState | alert, with the correlation id and Copy correlation id | Could not load articles |
| Detail tabs | tablist; tab with `aria-selected` and `aria-controls`, roving tabindex; tabpanel `aria-labelledby` its tab | Article AX-20410; General, History |
| Detail section | section `aria-labelledby` its h2; dl, dt, dd | Identity, Classification, Note, Origin |
| History | table; expand button `aria-expanded`; the open entry's table | History; Changes on 2026-10-05 14:05 |
| History region (320) | region, `tabindex 0` | History, scrolls sideways |
| Field group | section `aria-labelledby` its h2 | Identity, Classification, Reason for change |
| Field | label for the input; `aria-describedby` the description and the message; `aria-invalid` when invalid | Article number; Name; Note |
| Field with a unit | label for the input: the symbol `aria-hidden`, the unit's full name in a visually hidden span | Quantity (pieces), shown as Quantity (pcs) (2.5.3) |
| Column with a unit | columnheader with the same hidden unit name | Cycle time (seconds), shown as Cycle time (s) |
| Select field | combobox, `aria-expanded`, `aria-controls` its listbox; option with `aria-selected` | Stock unit |
| Master data value | `lang` on the value: sv for Acme AB names, each translation its own | Fläns DN50 rostfri (sv) |
| Error summary | group, `tabindex -1`, `aria-labelledby` its h2; links to the fields | Fix 2 fields to save the article |
| Version conflict, server error | the same group, with Reload article or the correlation id | This article changed while you edited it |
| ConfirmDialog, review step | alertdialog, `aria-modal`, `aria-labelledby` the title, `aria-describedby` the text | Archive article AX-20410?; Release order 1001? |
| Filters sheet | dialog, `aria-modal`, `aria-labelledby` its h2; a fieldset with legend per field | Filters |
| Settings saved note | status | Settings saved. Dates, clock times and numbers change after the next page load or plant switch. |

### Announcements

`announce()` goes to the shell's polite region outside `#root` and is read once; `notify()` goes to Sonner only and never holds the only copy.

| When | How | Text |
|---|---|---|
| Article saved | Polite region, once (useCommandForm) | Article AX-20410 saved |
| Article created | Polite region, once | Article AX-20410 created |
| Article archived | Polite region, once | Article AX-20410 archived |
| Articles archived (bulk) | Polite region, once | 3 articles archived |
| Article restored | Polite region, once | Article AX-20417 restored |
| Order released | Polite region, once | Order 1001 released |
| Filter or search change | Polite region after the rows load (open question 17) | 61 articles match |
| Selection change | Polite region (question N6) | 3 selected |
| Ignored link setting | PageFrame status line, once | This link had 1 setting that no longer applies, so it was ignored. |
| Correlation id copied | Polite region, once | Correlation id copied |
| Settings saved | The saved note on the page, a status region, once | Settings saved. Dates, clock times and numbers change after the next page load or plant switch. |
| Save with errors | No live message: focus moves to the summary | |
| Route change, Back | No live message: the focused h1 is read and the title changes | |
| Loading | `aria-busy` on `main` (route) or on the table (rows); no message | |

### URL state keys

| Key | Route | Values and rules |
|---|---|---|
| `q` | List | Search text, trimmed, at most 100 characters; empty is the default and stays out of the URL |
| `articleGroup`, `stockUnit`, `source` | List | One key per filter field, named after its GraphQL filter field; a comma list of values (`articleGroup=Hoses,Shafts`) |
| `sort` | List | `code`, `name` or `changed`, a leading minus for descending, at most three keys (`sort=code`). The default, `changed` descending, stays out (proposed) |
| `group` | List | One GroupBy value, such as `group=articleGroup` |
| `size` | List | Page size 1 to 100, default 25; fixed at 25 in these frames (open question 15) |
| `page` with `after` or `before` | List | The keyset cursor and the page number; any change to filters, sort, search or size drops them |
| `archived` | List | `archived=1` shows archived rows; off is the default |
| `view` | Reserved | Saved views wait; a nav entry may carry a preset search |
| `tab` | Detail | `general` (default, stripped), `history` or a slot tab's contribution id; an unknown id falls back to `general`; switching pushes a history entry |
| Not in the URL | Any | Open menus, dialogs and the Filters sheet, hover, focus, the selection, open History entries, collapsed groups, form values |

Filter, sort, search and size changes replace the history entry; list, detail, new and edit are routes and push. A bad key falls back to its default alone and is dropped with a replace navigation. Example URLs: `/plant-a/core/articles?articleGroup=Hoses,Shafts`, `/plant-a/core/articles?q=fläns&articleGroup=Flanges&sort=code`, `/plant-a/core/articles/$articleId?tab=history`, `/plant-a/core/articles/new`, `/plant-a/core/articles/$articleId/edit`.

### Slots

- TopBarActions: page actions in the top bar. New article on the list; Archive and Edit on the detail; none on the forms, whose Save article and Cancel sit in the Save bar. At 320 they fold into Page actions.
- `planning/order/panels/v1`: on the production order detail, a column beside the details, stacked below them at 320 (ADR 0068). Each contribution sits in its own frame; production-start contributes in release 1 (DE21, DE41).
- Detail slot tabs: a slot tab joins General and History, and its contribution id is the value of `tab`.

### WCAG 2.2 criteria

| Criterion | How the page meets it | Frames |
|---|---|---|
| 1.3.1 | Table semantics with column headers and `aria-sort`; group rows; labelled field groups and labels; dl in details; menus, tablist and dialogs with their roles | NA12, NA13, LI29 |
| 1.3.2 | DOM order is the visual order: toolbar, chips, table, pager; field groups, then the Save bar | NA12, NA13 |
| 1.4.1 | Selection shows a checked box, status an icon and text, an invalid field an icon and text, an optional field the word optional | NA14, NA19, LI31, LI35 |
| 1.4.3 | Text on D1 tokens reaches 4.5:1 in both themes (D1 contrast) | all |
| 1.4.10 | At 320 by 640 only the tables and History scroll in two dimensions, each in its own region; the toolbar folds into Filters and Columns; forms go to one column | NA1 to NA10 |
| 1.4.11 | Field borders and each half of the focus ring reach 3:1 (D1) | NA23 |
| 1.4.12 | No fixed heights on text containers; long names wrap | NA11 |
| 1.4.13 | Menus open on Enter or a click, never on hover; no control appears only on hover; a Tooltip opens on focus too, stays while hovered and closes on Escape | NA18, NA23 |
| 2.1.1 | Every control works by keyboard; the 320 regions take focus | NA12, NA22 |
| 2.1.2 | Menus close on Escape and Tab; the sheet and dialogs hold focus by design and close on Escape | NA3, NA18 |
| 2.4.2 | One title per route: list, detail, new, edit | NA16, NA17 |
| 2.4.3 | DOM order; a route change focuses the h1; dialogs and the sheet return focus to their trigger | NA12 to NA19 |
| 2.4.6 | One h1 per route, an h2 per section and field group; labels carry units | NA13 |
| 2.4.7 | The D1 two-tone ring on every stop; the inset outline on menu and listbox items | NA23 |
| 2.4.11 | The Save bar's `scroll-padding-bottom`, the table header's `scroll-padding-top` and the sticky column's `scroll-padding-left` keep focus clear | NA20 to NA22 |
| 2.5.3 | Accessible names start with the visible label: Article group, 2 selected | NA12 |
| 2.5.8 | Every target at least 24 by 24 px: chip remove, Clear search, checkbox hit areas, links; controls 36 px | NA23 |
| 3.1.1 | `html lang` en | all |
| 3.1.2 | Master data text carries its lang: sv names and notes, de and fi in the long-strings frames, each translation its own | DE1, NA11, NA25, NA26 |
| 3.2.1 | Focus never opens a menu or changes the route | NA12 |
| 3.2.2 | A filter, sort or search change updates the rows and the URL but never moves focus or changes the route | NA11 |
| 3.3.1 | Inline messages with an icon, `aria-invalid` and the error summary | DE11, DE13, NA14 |
| 3.3.2 | Labels, (optional), descriptions with the expected format | NA13 |
| 3.3.3 | Messages state the rule and the fix, with the allowed range | DE25, DE29, DE33, DE35, NA14, NA15 |
| 3.3.4 | The review step for Release order; ConfirmDialog for archive, bulk archive and restore; saving a draft and breaking a lock elsewhere | DE21 to DE28 |
| 3.3.7 | A server error, a version conflict or an archived article keeps the typed values | DE15 to DE20, DE31, DE32 |
| 4.1.2 | Names, roles and states as listed under roles and accessible names | all |
| 4.1.3 | Announcements through the shell's polite region, the PageFrame status line, the saved note, ErrorState as an alert | NA16, LI27, ST4, ST25 |

## Copy

### Error messages

A message states the rule and the fix; where a limit exists it names the range and the typed value.

| Message | Rule and allowed range |
|---|---|
| "Fix 2 fields to save the article" | Summary heading: Fix {n} field or fields to save the {thing} |
| "Enter an article number." | Required; 1 to 32 characters after trimming |
| "Article number can be 1 to 32 characters. It has 34." | 1 to 32 characters, with the typed length |
| "Article number AX-20410 is already in use in Acme AB. Choose another number." | Unique per scope, compared without case; never names another plant's row |
| "Enter a name." | Required |
| "Choose a stock unit." | Required, one of Pieces, Metres, Kilograms, Litres |
| "Enter a reason of 3 to 500 characters. You entered 2." | Required reason, 3 to 500 characters, with the typed length |
| "Enter a quantity greater than 0." | Quantity above 0 |
| "Enter a number such as 1 234,5." | The plant's number format; at Plant B "Enter a number such as 1,234.5." |
| "2026-02-31 is not a date. Enter a date as 2026-10-25." | A real date in the plant's format; ISO dates always work |
| "Code T-100 is already in use. Choose another code." | Unique per scope |
| "Cycle time can be at most 3 600 pcs/h." | Server limit, stated in the unit typed |
| "OEE target can be 0 to 100 %. You entered 120." | 0 to 100 (not drawn) |
| "Could not save the article" | Server error, with the text "Your entries are kept. Try again; if it fails again, give your plant admin the correlation id." |
| "This article changed while you edited it" | `core.version_conflict`, with the text "Jonas Holm saved this article at 14:05 after you opened it. Your entries are kept. Reload the article to see the saved values, then make your change again." and the button Reload article |
| "This article is archived" | `core.archived`, with the text "Archived articles cannot be changed until they are restored. Your entries are kept." and the button Restore article |
| "Unexpected error." (doc) | Any unknown error, with the correlation id |

### Final English copy

Strings marked doc are verbatim from the docs; every other string is proposed and needs Krister Johansson's yes. The long-strings frames NA11 and NA25 to NA27 show German, which does not ship.

| Group | Copy |
|---|---|
| Route titles | "Articles · Plant A · NorthMES"; "Article AX-20410 · Plant A · NorthMES"; "New article · Plant A · NorthMES"; "Edit article AX-20410 · Plant A · NorthMES"; "Production orders · Plant A · NorthMES"; "Order 1001 · Plant A · NorthMES"; "New order · Plant A · NorthMES"; "Tools · Plant A · NorthMES"; "New tool · Plant A · NorthMES"; "Edit operation 20 · Plant A · NorthMES"; "Settings · Plant A · NorthMES"; "Audit log · Plant A · NorthMES" |
| Page actions and crumbs | "New article"; "Edit"; "Archive"; "New order"; "Release order"; "New tool"; "Core"; "Master data"; "Articles"; "Article AX-20410"; "Production orders" |
| Toolbar | "Search articles"; "Clear search"; "Article group"; "Stock unit"; "Source"; ", 2 selected"; "Show articles in these groups"; "Show articles counted in"; "Show articles from"; "Group by"; "No grouping"; "Group by: Article group"; "Show archived"; "Columns"; "Show these columns"; "Always shown"; "Clear filters" (doc); "Remove the article group filter"; "Remove the stock unit filter"; "Remove the source filter"; "Filters"; "Show 61 articles"; "Close"; "This link had 1 setting that no longer applies, so it was ignored." (doc) |
| Filter values | "Consumables"; "Flanges"; "Hoses"; "Housings"; "Shafts"; "No article group"; "Pieces (pcs)"; "Metres (m)"; "Kilograms (kg)"; "Litres (l)"; "NorthMES"; "Pyramid" |
| Other lists | "Search production orders"; "Status"; "Article"; "Show orders with this status"; "Show orders for"; "Remove the status filter"; "Remove the article filter"; "Search tools"; "Scope"; "Show tools of"; "Remove the scope filter"; "Order"; "Quantity"; "Deadline"; "Priority"; "Code"; "Company"; "Plant"; "Article not available to you"; "Late by 2 days"; "Registered"; "Planned"; "Active"; "Paused"; "Finished"; "Delivered"; "Cancelled" |
| Selection and row menu | "Select all rows on this page"; "Select AX-20410"; "Select order 1001"; "3 selected"; "Selected articles"; "Archive 3 articles"; "Clear selection"; "Actions for AX-20410"; "Actions for order 1001"; "Edit"; "Archive"; "Restore"; "Move to company"; "Release order" |
| Table | "Articles"; "Article number"; "Name"; "Last changed"; "Actions"; "Archived"; "Rows 1 to 25 of 248" (doc); "Previous"; "Next"; "Previous page"; "Next page"; "Newest first"; "6 groups, 248 articles"; "Consumables, 12 articles"; "Articles table, scrolls sideways"; "CEST" |
| List states | "No articles yet"; "Articles come from Pyramid or are created here. Create the first one, or wait for the next import."; "No articles match these filters"; "Change or clear the filters to see articles again."; "Could not load articles"; "Check the connection, then try again. If it fails again, give your plant admin the correlation id."; "Correlation id"; "Copy correlation id"; "Try again"; "This page of results is out of date"; "The rows changed since this link was made, so this page can no longer be found."; "Go to the first page"; "You need the permission to read articles in Acme AB"; "Ask your plant admin for a role that can read articles." |
| Detail | "General"; "History"; "Identity"; "Classification"; "Note"; "Origin"; "English"; "German"; "Company article, Acme AB"; "Company article, used by every plant of Acme AB"; "Created"; "By Jonas Holm"; "External reference"; "Created by the Pyramid import. Later imports do not change this article."; "Output warehouse"; "Operations"; "Operations are copied from the routing of AX-20410 when the order is released. Each operation gets one job order."; "External data"; "As Pyramid sent it, in its order. Shown only, never changed here."; "Operation"; "This article does not exist or you cannot see it"; "The link may be out of date, or the article belongs to a company you have no role in."; "The link may be out of date, or the production order belongs to a plant you have no role in."; "Back to Articles" (doc); "Could not load the article" |
| History | "When"; "Changed by"; "Surface"; "Reason"; "Changes"; "Details"; "Changes on 2026-10-05 14:05"; "Field"; "Before"; "After"; "Empty"; "No reason given"; "Previous entries"; "Next entries"; "1 field"; "Created, 3 fields"; "Proposal committed, 1 field"; "Released, 3 operations"; "History, scrolls sideways"; "For Alex Lund"; "At Press 4"; "System"; "Planning assistant"; "Pyramid connector"; "Former user 7F3A"; "AI provider key: redacted"; "Entity" |
| Article form | "Identity"; "Article number"; "Name"; "In Swedish, the data language of Acme AB."; "Translations"; "(optional)"; "Add translation"; "Remove the English translation"; "Classification"; "Choose a group"; "Choose a unit"; "Quantities of this article are counted in this unit."; "Note"; "Reason for change"; "Reason"; "Why you made this change"; "Shown in the article's history. Do not enter personal data. Up to 500 characters."; "Save article"; "Cancel"; "Import" |
| Order, tool and operation forms | "Search by article number or name."; "Browse articles"; "Quantity (pcs)"; "In the article's stock unit, pieces."; "Lower numbers go first."; "Browse warehouses"; "Plant time. Weeks start on Monday."; "Deadline date, Europe/Stockholm"; "Choose the deadline date"; "Format YYYY-MM-DD, such as 2026-10-25."; "Deadline time, Europe/Stockholm"; "24-hour, such as 14:05."; "Save order"; "1 to 32 characters, unique in Plant A and Acme AB."; "A Plant A tool is used at Plant A only. Move to company in the row menu shares it with every plant."; "Notes"; "Save tool"; "Operation number"; "Times"; "Cycle time"; "Enter it in the unit you count in, time per piece or pieces per time."; "Pieces per hour (pcs/h)"; "Retool time"; "Minutes (min)"; "OEE target (%)"; "0 to 100."; "Save operation" |
| Settings | "Presentation"; "How dates, clock times and numbers look for everyone at Plant A. Saved changes show after the next page load or plant switch."; "Date format"; "Clock"; "Number format"; "Default"; "From Acme AB"; "Set for Plant A"; "Clear plant value"; "2026-10-25, year first (ISO)"; "25.10.2026, day first with dots"; "25/10/2026, day first with slashes"; "10/25/2026, month first with slashes"; "24-hour, 14:05"; "12-hour, 2:05 pm"; "1 234,5, space and comma"; "1,234.5, comma and point"; "1.234,5, point and comma"; "How dates are written in lists, forms and on the board."; "How clock times are written."; "How numbers are written and typed. A point also works as the decimal sign. Clearing uses the Acme AB value, 1,234.5."; "Save settings"; "Settings saved. Dates, clock times and numbers change after the next page load or plant switch." |
| Dialogs | "Archive article AX-20410?"; "Archived articles are hidden from lists and cannot be changed until restored. Orders that use it keep it."; "Archive article"; "Restore article AX-20417?"; "The article shows in lists again and can be changed again."; "Restore article"; "Archive 3 articles?"; "Archived articles are hidden from lists and cannot be changed until restored. Orders that use them keep them."; "Saved in the history of each of the 3 articles. Do not enter personal data. Up to 500 characters."; "Release order 1001?"; "Check the order, then release it. Releasing copies the routing of AX-20410 into the order and creates one job order per operation. The job orders start unplaced, ready for planning."; "Routing"; "AX-20410, version 3, 4 operations"; "Shown in the order's history. Do not enter personal data. Up to 500 characters." |
| Announcements | "Article AX-20410 saved"; "Article AX-20410 created"; "Article AX-20410 archived"; "3 articles archived"; "Article AX-20417 restored"; "Order 1001 released"; "61 articles match"; "3 selected"; "Correlation id copied" |

## Assumptions

Choices the frames draw that the docs do not settle. Each needs Krister Johansson's yes; a number in brackets is the open question it answers for now.

- A1: Jonas Holm holds a company-scope role at Acme AB, so he edits the company-level articles from `/plant-a/core/articles`. A person who may read but not change articles, such as the planner Alex Lund or a plant-only admin, sees the same list read-only (LI33, LI34) (1).
- A2: Article group is a fixed list, shown as a Select (3).
- A3: Bulk archive is one action for the selected rows (4).
- A4: The company data language of Acme AB is Swedish, so names carry `lang="sv"` and each translation its own lang (22).
- A5: The list sorts by Last changed, newest first, by default. A default never shows in the URL, so option A's sort by article number appears as `?sort=code` in LI5.
- A6: The Article group counts add up to 125 of 248 articles, so the menu ends with No article group 123.
- A7: Presentation settings are per plant. Plant A shows ISO dates (Default), the 24-hour clock (From Acme AB) and space and comma (Set for Plant A); Plant B sets day first with dots and the 12-hour clock and takes comma and point from Acme AB.
- A8: Pyramid creates articles with number and description only, so the imported article AX-31007 carries no external data (DE39); external data shows on the imported order 1002 (DE41).
- A9: Order 1001 is planned and has no operations yet, so Release order on its detail leads to the review step. Order 1002 is released and active.
- A10: A grouped list shows "6 groups, 248 articles" in place of the row pager (LI29).
- A11: A detail page has no first-run state, so not found (ST7) is its empty state.
- A12: While a detail loads, is not found or fails, the h1, the last crumb and the title read Article and no page actions show, because PageFrame renders the h1 from the route title before the data arrives (ST6 to ST8).
- A13: Maria Nyberg, a second plant admin, is signed in for the version conflict, because the conflict names Jonas Holm as the person who saved at 14:05 (DE19 and DE20).
- A14: The Release order review step opens with focus in its reason field, its first tabbable element, so Enter cannot release the order by accident (DE21 and DE22).
- A15: The production order form carries the date and time fields, because the article form has none; Quantity (pcs) puts the unit in the label (DE9).
- A16: German stands in for any long language in NA11, NA25, NA26 and NA27, although the UI ships in English only (21).
- A17: The bulk bar is a group with two Tab stops, not a toolbar with one stop and arrow keys as option A's notes named it: for two buttons a roving toolbar adds keys and gains nothing.
- A18: The forbidden list shows no toolbar and no page actions, because search and the filter counts read the data the person may not see (ST19).
- A19: Each filter count is taken with the other fields' filters applied, so a filtered-empty list shows 0 on each picked value (ST17).
- A20: An input value longer than its field ends in an ellipsis while the field is not focused, and scrolls inside it when focused, so the field keeps the D1 control height (NA9, NA26).

## Open questions

Numbers 1 to 25 follow the variations spec, so the frames and the build notes can cite them; the choice of 2026-10-07 settled 6, 7 and 23. N1 to N8 are new with this page and come from the keyboard frames (NA24). The last column gives the answer the frames draw, where they draw one.

| Id | Question | What the frames draw |
|---|---|---|
| 1 | Who edits company-level articles from `/$plant/core/articles`: only holders of a company-scope role, with a read-only list for a plant-only admin, or only under `/admin`? | Jonas Holm, with a company-scope role, edits them from `/plant-a/core/articles`; Alex Lund sees the list read-only (A1; LI33, LI34) |
| 2 | Which register is the kit example: tools (company or plant, with Move to company) or equipment groups (with color)? | Tools: the register with Scope and Move to company, and its create form (LI39, LI40, DE37, DE38) |
| 3 | Is `article_group` free text, a fixed list or a register with its own Lookup? | A fixed list, shown as a Select (A2) |
| 4 | Which bulk actions exist in release 1: one command per row or a batch command, one reason for all rows, how a partial failure shows, and what Select all means under keyset paging? | Archive 3 articles as one action with one reason for the three (A3; LI15, DE25, DE26) and Select all rows on this page; no partial failure is drawn |
| 5 | Column choice: kept in the URL, per browser like the theme, or not kept? Is it in release 1? | The Columns menu (LI11 to LI14); LI13 hides Source, and its URL holds no column key |
| 8 | Change reason for master data: its label, its maximum length (500 as for breaking a lock?), and whether archive and restore require one. | The field group Reason for change with the field Reason, up to 500 characters; optional on archive and restore (DE23, DE27); a required reason of 3 to 500 characters in DE25, DE26, DE35 and DE36 |
| 9 | Does leaving a form with unsaved edits ask first? | Not drawn |
| 10 | Version conflict: only Reload article, or also the saved values next to the typed ones? | Only Reload article (DE19, DE20) |
| 11 | Does the History tab list the creating command and import commands, how does it name a pseudonymized user and a system principal, and does it show totalCount? | DE3 lists the creating command (Created, 3 fields) and reads Newest first, with no total; the audit log names a pseudonymized user Former user 7F3A and also reads Newest first (LI41) |
| 12 | Page actions order (D2 question 13): New article in the top bar before the filters, or after them as in D1 F8? | New article in the top bar, before `main` (NA12) |
| 13 | Toast placement, and does a successful save show a toast or only the announcement (D2 question 25)? | The polite region carries the message; a toast may echo it but never holds the only copy (NA16) |
| 14 | Can a stock unit change after orders or stock exist for the article? | Stock unit is an editable Select on the edit form (DE43, DE44) |
| 15 | Page size: fixed at 25, or a selector with 25, 50 and 100? | Fixed at 25 |
| 16 | Group by keys for articles: Article group and Stock unit only? | Group by offers Article group, Stock unit and Source after No grouping (LI29) |
| 17 | Does a filter change announce the result count? | Proposed: "61 articles match" after the rows load |
| 18 | Settings: where are company-scope values edited, does the page save per form or per field, and what does it show between a save and the next page load? | One Save settings per form; each setting shows its source (Default, From Acme AB, Set for Plant A) with Clear plant value; after Save the note says the formats change after the next page load or plant switch (ST9, ST25) |
| 19 | Detail page actions: Edit and Archive in the top bar, as drawn, or inside the page? | Edit and Archive in the top bar (DE1) |
| 20 | Does the row link cover the whole row, or only the identifier cell, as drawn? | Only the identifier cell |
| 21 | Long strings: German UI labels, although the UI ships in English only (D2 drew it the same way)? | German labels (A16; NA11, NA25 to NA27) |
| 22 | Is Swedish the company data language of Acme AB? | Swedish (A4) |
| 24 | Doc drift: ADR 0019 still shows `/api/web/modules`, and ADR 0061 and one bullet of ADR 0062 write the same path, while plan 06 uses `/api/v1/web/modules`. | The page follows plan 06 |
| 25 | The review step for Release order: does it list the routing version and the operations it copies, and does a validator veto (`core.command_rejected`) show inside the dialog? | The dialog names the routing, AX-20410, version 3, 4 operations (DE21, DE22); no veto is drawn |
| N1 | Focus after Back: the h1, as drawn in NA17, or the row link that opened the article? | The h1 (NA17) |
| N2 | Save leads to the detail with a replace navigation, so Back skips the saved form (NA16)? | A replace navigation (NA16) |
| N3 | When the focused control disappears with what it acts on (Clear selection, Clear filters), focus moves to Search articles? | Search articles (keyboard model) |
| N4 | Detail tabs with manual activation, so arrow keys do not push history entries? | Manual activation (keyboard model) |
| N5 | ConfirmDialog opens with focus in Reason, or on Cancel as the Alert Dialog default? | Focus in Reason (DE21, DE23, DE25, DE27) |
| N6 | Does a selection change announce 3 selected? | Listed in the announcements as a question |
| N7 | Enter in a single-line field submits the form? | Proposed: it submits, as Save article does |
| N8 | A filter menu stays open while values are toggled? | Proposed: it stays open (LI3) |

## Known gaps in the drawn frames

The header lists what the frames do not show yet, because the shared parts cannot draw it or a frame is missing. The numbers G1, G5, G6, G7 and G9 belong to gaps the frames now close and are not reused.

- G2: LI7 and LI8 draw the table loading after the search, not the rows that match fläns (AX-20405, AX-20410, AX-20411 and AX-20415): the table part has no search prop.
- G3: LI9 and LI10 show focus on Next on page 1 and name the URL keys Next adds (`page` and `after`): the table part draws page 1 only.
- G4: The Columns menu always shows every column checked, so LI11 and LI12 show it before the change, and LI13 and LI14 show the table after Source was hidden, with the menu closed.
- G8: ST3 and ST10 show two default buttons named New article, one in the top bar and one in the empty state. Which one stays is open.
- G10: LI41 and LI42 draw the audit log without its filters for entity, principal, surface and time, because the toolbar part has no audit preset.
