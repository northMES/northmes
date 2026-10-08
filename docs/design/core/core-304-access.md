# Access management and the no-access states

This is the approval record of the access management page, issue [northMES/northmes#304](https://github.com/northMES/northmes/issues/304), for story E05-S06 ([northMES/northmes#54](https://github.com/northMES/northmes/issues/54)). The design page is [core/core-304-access.dc.html](https://claude.ai/design/p/dba068e0-37df-46e5-adcf-4439b6c4c0ad?file=core%2Fcore-304-access.dc.html) in the Claude Design project. It builds on the direction chosen in the variations round, whose record `core-304-access-variations.md` is in pull request #312, on the tokens and components of D1 ([ui-189-tokens.md](../ui/ui-189-tokens.md)), on the shell of D2 ([shell-190-navigation.md](../shell/shell-190-navigation.md)) and on the list and form patterns of the canonical list and form page (#222), whose record `ui-222-list-form.md` is in pull request #314.

The page draws roles, assignments, a user's access, the users list and form, and the no-access states of core inside the D2 shell at Plant A, for the plant admin and the company admin. Every frame mounts the D2 shell, four rows hold the frames, and four shared parts draw the permission checklist, the role picker, a user's Access tab and the effective permissions table. Every name, number and time on the page is fictional.

## Approval

Krister Johansson approved the page on 2026-10-08. With the approval he accepted two proposals of the builders, listed under [Decisions at approval](#decisions-at-approval).

The page files were not edited after the approval, so the header frame F0 shows the page as it was in review:

- The first line reads "Design task for #304, spec page, in review. Every name, number and time on this page is fictional."
- The acceptance line "Krister approved the page and the design project's README row holds the etag." reads Not met. The line for the frames in light and dark reads Met, the line for comment threads reads At approval, and the lines for the design pull request and for the Design section of the waiting UI tasks read Not met.

This record and the design project's README hold the approval. The README row of the page reads "approved 2026-10-08 by Krister Johansson" and holds the etag of the page file; the rows of the part files keep their descriptions. The PNGs were captured after the last change to the page's files, so they show the files at the etags below.

## Approved files

| File | Etag |
|---|---|
| `core/core-304-access.dc.html` | `1791450587311652` |
| `core/core-304-access-roles.dc.html` | `1791449538895960` |
| `core/core-304-access-assign.dc.html` | `1791449299448404` |
| `core/core-304-access-users.dc.html` | `1791449117804471` |
| `core/core-304-access-noaccess-keyboard.dc.html` | `1791450112123876` |
| `core/core-304-access-notes.dc.html` | `1791450355866176` |
| `core/core-304-access-checklist.dc.html` | `1791448718577273` |
| `core/core-304-access-picker.dc.html` | `1791448788404219` |
| `core/core-304-access-tab.dc.html` | `1791448986287693` |
| `core/core-304-access-effective.dc.html` | `1791448867068045` |
| `core/core-304-access.css` | `1791448506890609` |
| `core/core-304-access-data.js` | `1791448630377659` |

The design project returned these etags for `core/` on 2026-10-08.

The page also loads files outside this set. `core/Shell.dc.html` (etag `1791413260071000`) has the same bytes as D2's approved `shell/Shell.dc.html` (etag `1791305527647556`); the copy exists because dc-import loads a frame from the page's own folder. The folder's `core/support.js` has etag `1791413257323444`. The page and its parts link D1's `ui/tokens.css` (`1791221436225089`) and `ui/ui-189-tokens-page.css` (`1791221436079789`) and D2's `shell/shell-190-navigation.css` (`1791305250083620`), the etags of the D1 and D2 records, and `ui/ui-222-list-form.css` (`1791415579516118`), the stylesheet of the canonical list and form page, at the etag of its approval. The variations files `core/core-304-access-variations*` belong to the variations round and are not part of this approval.

## Page facts

| Fact | Value |
|---|---|
| Issue | [northMES/northmes#304](https://github.com/northMES/northmes/issues/304), plan task E05-S06-T01 |
| Owning story | E05-S06 ([northMES/northmes#54](https://github.com/northMES/northmes/issues/54)), grant roles per plant and check permissions at the row's scope |
| Waiting tasks | The role and assignment screens of E05-S06 (#54), the user pages of E05-S08 (#56), and the forbidden and access-lost states the shell and screenRoute show (E04-S02 #40, E04-S07 #45) |
| Area | `core`, which maps to `modules/core/web` |
| Routes | `/$plant/core/roles`, `/$plant/core/roles/new` with `?from=$roleId` for Start from, `/$plant/core/roles/$roleId` with `?tab=holders`, `/$plant/core/roles/$roleId/edit`, `/$plant/core/users`, `/$plant/core/users/new`, `/$plant/core/users/$userId?tab=access` and `/$plant/core/users/$userId/roles/new`. The paths come from core's link manifest and are proposed |
| Personas | Plant admin Jonas Holm, who holds the custom role Plant admin at Plant A. Karin Dahl, a plant admin who also holds core's Company admin role at Acme AB. Planner Alex Lund for the no-access states. Oskar Wik, who holds the custom role IT at Acme AB (NO19). Assumed for single frames: Petra Sund holds IT at Plant A only (RO39, RO40), Ida Wall reads users without core.role:read (NO5, NO6), and the planner of the access-lost frames keeps Plant A and Plant C of Nordic Tools AB (NO9, NO10, NO25) |
| Direction | Graphite: the D1 tokens and components (approved 2026-10-05) inside the D2 shell (approved 2026-10-06), with the list and form patterns of the canonical page (#222, option A, pages). Option A of the variations round with parts of options B and C |
| Content | Acme AB with Plant A and Plant B. 11 roles at Acme AB, 6 default roles from modules and 5 custom roles, over 36 installed permissions in core, planning, production start, the Pyramid connector, AI and the Acme tooling plugin, plus Kanban, which is not installed. Sara Nyberg holds Shift lead at Plant A and Viewer at Acme AB; Anna Berg holds Operator at Plant A |

## Direction and decisions

Krister Johansson chose option A of the variations round, by person, on 2026-10-08; the variations record in pull request #312 holds the choice. Roles are added to and removed from the user on the Access tab, and the role editor lists the permissions grouped by module, each in plain words with its id. From option C the page takes Start from on New role, a read-only Holders tab on a role and the dialog after access is lost mid-session (close code 4403), which settles Q22 of the D2 record. From option B it takes the page title "No access to Roles" and the "No access" cells in the effective permissions view.

On 2026-10-08 Krister Johansson also decided that administration moves into one Settings area with a secondary sidebar (#313). The frames keep D2's Administration section until #313 has a direction; the content of the pages does not change.

### Decisions at approval

Krister Johansson accepted these proposals of the builders with the approval:

- "No access" in the effective permissions view means a permission that no role of the person grants, the first reading of question 29, as AS9 and AS10 draw it. The case of a reader who may not read roles, which NO5 and NO6 draw, gets its own wording, so "No access" keeps one meaning on the page (WCAG 3.2.4). NO5 and NO6 still read No access; the wording for that case is not on the page.
- The Holders tab on a role is read only: it lists who holds the role at Acme AB and at Plant A, with no Assign or Remove, and roles are given and taken on the user's Access tab (RO21 to RO26).

The other proposals on the page, which F0 marks as needing his yes, were not decided with the approval, and the open questions in F0 stay open, question 29 apart.

The implementer takes layout, region order, states and their transitions, the copy verbatim, the keyboard model and the slot placements, never markup, class names, inline styles, token values or demo numbers. A value that is not a D1 token is a question. States the shell owns stay D2's: NO7 and NO8 redraw D2's ST29 and ST30 unchanged for a plant without a role.

## Rows

The page has a header frame, then one row per part file. The chips above the frames carry the frame ids, and the chip of each screen frame names its route.

| Row | Part file | Frames | What it shows |
|---|---|---|---|
| F0 Header | `core/core-304-access.dc.html` | F0 | Issue, chosen direction, rows, acceptance criteria, the frames per item of the issue, assumptions, proposals, known limits and open questions |
| 1 Roles | `core/core-304-access-roles.dc.html` | RO1 to RO42 | The roles list with custom and default roles at 1440, 1280 and 1920 in light and dark, the row menu of a custom and of a default role, loading, no custom roles yet and failed; New role with Start from open, from Planner and from no role; editing Shift lead with the reason filled in at 1440, 1280 and 1920, the Save refused for Petra Sund, who holds core.role:manage at Plant A only, and the role detail after Save; the read-only Holders tab and its empty state on a default role; and Jonas Holm, a plant admin without core.role:manage, on the list, on a role and on the edit route. Karin Dahl, company admin, is the user in the other frames |
| 2 Assignments and a user's access | `core/core-304-access-assign.dc.html` | AS1 to AS26 | Sara Nyberg's Access tab read by Jonas Holm, plant admin, and by Karin Dahl, company admin; Add role with the locked roles named; the server's refusal at Acme AB; removing a role with a reason; every permission with No access cells. Each at 1440 in light and dark, then the plant admin view at 1280 and the company admin view at 1920 in light and dark. Then the Access tab loading, for a user without a role, failed, and with the effective permissions denied, each in light and dark |
| 3 Users | `core/core-304-access-users.dc.html` | US1 to US18 | The users list and its row menu; New user for an operator without email, with field errors and with a refused username; Block user, Unblock user, Reset password and the temporary password shown once. Each at 1440 in light and dark. The list takes loading, empty, error and forbidden from the canonical list unchanged, with users as the noun, so the row draws no frame for them |
| 4 No access, 320, long strings, keyboard and focus | `core/core-304-access-noaccess-keyboard.dc.html` | NO1 to NO27 | A page opened by URL without the permission, a forbidden region, the No access cells when the reader may not read roles, a plant without a role (D2 ST29 and ST30 as approved), the access-lost dialog after close code 4403; the roles list, the Access tab and the role editor at 320; the role editor in German and Finnish in light (NO17) and dark (NO27); Tab order, focus in the checklist, after Add role, after a refusal and in both dialogs. NO26 holds the build notes for the whole page, from the part `core/core-304-access-notes.dc.html` |

The rows mount these shared parts:

| Part | What it draws |
|---|---|
| `core/core-304-access-checklist.dc.html` | The role editor checklist, permissions grouped by module, with the difference from the role a new role starts from |
| `core/core-304-access-picker.dc.html` | The role picker (Where and Role), the highlighted role's permissions, the person card and the note of the Add role form |
| `core/core-304-access-tab.dc.html` | A user's Access tab with the roles, the access changes and the remove dialog; it mounts the effective permissions part |
| `core/core-304-access-effective.dc.html` | The effective permissions table by module, with the No access cells |
| `core/core-304-access-notes.dc.html` | The build notes for the whole page, mounted by frame NO26 |
| `core/core-304-access.css` | The shared styles of the frames and parts |
| `core/core-304-access-data.js` | The modules, permissions, roles, people, history and the copy in English and German |

Where each item of the issue's frame list is drawn, as the header gives it:

| Item in #304 | Light | Dark |
|---|---|---|
| Roles: the list with the module default roles and custom roles; a custom role from module permissions, grouped by module, each in plain words; editing needs core.role:manage at company scope | RO1, RO3, RO4, RO11, RO13, RO15, RO17, RO19, RO20, RO27, RO29, RO31, RO35, RO37, RO39, RO41, NO11, NO15, NO17, NO20 | RO2, RO12, RO14, RO16, RO18, RO28, RO30, RO32, RO33, RO34, RO36, RO38, RO40, RO42, NO12, NO16, NO19, NO27 |
| Assignments: who holds which role at Acme AB or a plant; adding one at a scope and the refusal when the assigner does not hold every permission of the role there; removing one with a reason | RO21, RO23, RO24, RO25, AS1, AS3, AS5, AS7, AS14, AS16, NO22, NO24 | RO22, RO26, AS2, AS4, AS6, AS8, NO21, NO23 |
| A user's access: roles per company and plant, and what the user can do at a plant by module | AS1, AS9, AS11, AS13, AS15, AS19, AS21, AS23, AS25, NO13 | AS2, AS10, AS12, AS17, AS18, AS20, AS22, AS24, AS26, NO14, NO21 |
| The user list and user form as far as access goes: create, block, reset password with a temporary password, operators without email, retired usernames | US1, US3, US5, US7, US9, US11, US13, US15, US17 | US2, US4, US6, US8, US10, US12, US14, US16, US18 |
| No access: a page opened by URL without the permission, with its title, h1, the missing permission, no data and a way out | NO1, RO31 | NO2, RO32 |
| No access: a region inside a page whose data is FORBIDDEN | NO3, NO5, AS13, AS25 | NO4, NO6, AS17, AS26 |
| No access: a plant the user has no role at | NO7 | NO8 |
| No access: the access-lost message after close code 4403, which settles Q22 of the D2 record as a dialog | NO9 | NO10, NO25 |
| Empty, loading and error states; the users list takes the canonical list states unchanged, so it has no frames of its own | RO5, RO7, RO9, RO25, AS19, AS21, AS23 | RO6, RO8, RO10, RO26, AS20, AS22, AS24 |
| The company admin and the plant admin views | RO1, RO27, AS1, AS11, US1, US5 | RO2, RO28, AS2, AS12, US2, US6 |
| Widths 1280, 1440 and 1920 and a 320 reflow frame | 1280: RO3, RO19, RO23, AS13, AS14. 1440: every other frame. 1920: RO4, RO20, RO24, AS15, AS16. 320: NO11, NO13, NO15 | 1280: RO34, AS17. 1440: the twins beside the light frames. 1920: RO33, AS18. 320: NO12, NO14, NO16 |
| One frame with long German or Finnish labels and data | NO17 | NO27 |
| Keyboard and focus frames | NO18, NO20, NO22, NO24, RO35, RO37, RO39, RO41 | NO19, NO21, NO23, NO25, RO36, RO38, RO40, RO42 |

A dark twin repeats its light frame with the dark tokens. In rows 1 to 3 it sits to the right of its light frame, and the dark twins of the 1920 and 1280 frames sit in the row under them; in row 4 it follows its light frame in reading order. Focus rings are also drawn in frames outside the keyboard frames, such as RO11, RO17, AS3 and US5.

## Frames

Each chip gives the frame id, the state, the theme and the width, a short note and the route. A screen frame at 1440, 1280 or 1920 is the screen plus a 36 px line above it with its document title, which is an annotation. The PNGs were captured from the page's files at device scale 1 and show each frame with its chip. A frame marked "Not exported" has no PNG in this folder; [Frames without a PNG](#frames-without-a-png) lists them.

### Header

| Frame | State | Theme, size | What it shows | PNG |
|---|---|---|---|---|
| F0 | Header | Light, 1440 by 5409 | Issue, chosen direction, rows, acceptance criteria, frames per item, assumptions, proposals, known limits and open questions | [core-304-access-f0-header.png](core-304-access-f0-header.png) |

### Row 1, roles

Part file `core/core-304-access-roles.dc.html`.

| Frame | State | Theme, size | What it shows | PNG |
|---|---|---|---|---|
| RO1 | Roles list | Light, 1440 by 900 | Karin Dahl, company admin. Custom roles, then default roles by name; New role in the top bar. Held at Acme AB and Plant A counts the holders at those two places. The pager is the canonical grouped pager. Company admin has no row menu (`/plant-a/core/roles`) | [core-304-access-ro1-roles-list-light-1440.png](core-304-access-ro1-roles-list-light-1440.png) |
| RO2 | Roles list | Dark, 1440 by 900 | As RO1 (`/plant-a/core/roles`) | [core-304-access-ro2-roles-list-dark-1440.png](core-304-access-ro2-roles-list-dark-1440.png) |
| RO3 | Roles list | Light, 1280 by 800 | As RO1 beside the 256 px sidebar (`/plant-a/core/roles`) | [core-304-access-ro3-roles-list-light-1280.png](core-304-access-ro3-roles-list-light-1280.png) |
| RO4 | Roles list | Light, 1920 by 1080 | As RO1; the Role, Defined by and Last changed columns take the extra width (`/plant-a/core/roles`) | Not exported |
| RO5 | Roles list loading | Light, 1440 by 900 | Toolbar and table header drawn, skeleton rows, main busy, focus on the h1 (`/plant-a/core/roles`) | Not exported |
| RO6 | Roles list loading | Dark, 1440 by 900 | As RO5 (`/plant-a/core/roles`) | Not exported |
| RO7 | No custom roles yet | Light, 1440 by 900 | Acme AB right after onboarding: only the default roles, Karin Dahl the only holder (`/plant-a/core/roles`) | Not exported |
| RO8 | No custom roles yet | Dark, 1440 by 900 | As RO7 (`/plant-a/core/roles`) | Not exported |
| RO9 | Roles list failed | Light, 1440 by 900 | ErrorState in the table's Card with the correlation id; toolbar and New role keep their places (`/plant-a/core/roles`) | Not exported |
| RO10 | Roles list failed | Dark, 1440 by 900 | As RO9 (`/plant-a/core/roles`) | Not exported |
| RO11 | New role, Start from open | Light, 1440 by 900 | No role is the default; keyboard focus on Planner in the listbox (`/plant-a/core/roles/new`) | Not exported |
| RO12 | New role, Start from open | Dark, 1440 by 900 | As RO11 (`/plant-a/core/roles/new`) | Not exported |
| RO13 | New role from Planner | Light, 1440 by 900 | Night planner: Lock job orders added, Release and Cancel removed; focus in Role name (`/plant-a/core/roles/new?from=$roleId`) | [core-304-access-ro13-new-role-from-planner-light-1440.png](core-304-access-ro13-new-role-from-planner-light-1440.png) |
| RO14 | New role from Planner | Dark, 1440 by 900 | As RO13 (`/plant-a/core/roles/new?from=$roleId`) | Not exported |
| RO15 | New role from no role | Light, 1440 by 900 | Report checker with two permissions ticked; focus on Read job orders (`/plant-a/core/roles/new`) | Not exported |
| RO16 | New role from no role | Dark, 1440 by 900 | As RO15 (`/plant-a/core/roles/new`) | Not exported |
| RO17 | Edit Shift lead | Light, 1440 by 900 | Run autoplan ticked, not saved; the reason typed; focus on Save role (`/plant-a/core/roles/$roleId/edit`) | [core-304-access-ro17-edit-shift-lead-light-1440.png](core-304-access-ro17-edit-shift-lead-light-1440.png) |
| RO18 | Edit Shift lead | Dark, 1440 by 900 | As RO17 (`/plant-a/core/roles/$roleId/edit`) | Not exported |
| RO19 | Edit Shift lead | Light, 1280 by 800 | As RO17; permission lines wrap beside their ids (`/plant-a/core/roles/$roleId/edit`) | Not exported |
| RO20 | Edit Shift lead | Light, 1920 by 1080 | As RO17; the checklist column takes the extra width (`/plant-a/core/roles/$roleId/edit`) | Not exported |
| RO21 | Holders of Shift lead | Light, 1440 by 900 | Read only: nobody at Acme AB, 2 people at Plant A; no Assign or Remove (`/plant-a/core/roles/$roleId?tab=holders`) | [core-304-access-ro21-holders-of-shift-lead-light-1440.png](core-304-access-ro21-holders-of-shift-lead-light-1440.png) |
| RO22 | Holders of Shift lead | Dark, 1440 by 900 | As RO21 (`/plant-a/core/roles/$roleId?tab=holders`) | Not exported |
| RO23 | Holders of Shift lead | Light, 1280 by 800 | As RO21 (`/plant-a/core/roles/$roleId?tab=holders`) | Not exported |
| RO24 | Holders of Shift lead | Light, 1920 by 1080 | As RO21 (`/plant-a/core/roles/$roleId?tab=holders`) | Not exported |
| RO25 | Nobody holds Planning admin | Light, 1440 by 900 | A default role without holders: one empty line per place (`/plant-a/core/roles/$roleId?tab=holders`) | Not exported |
| RO26 | Nobody holds Planning admin | Dark, 1440 by 900 | As RO25 (`/plant-a/core/roles/$roleId?tab=holders`) | Not exported |
| RO27 | Roles list for a plant admin | Light, 1440 by 900 | Jonas Holm without core.role:manage: no New role, no row menus, a line says why (`/plant-a/core/roles`) | Not exported |
| RO28 | Roles list for a plant admin | Dark, 1440 by 900 | As RO27 (`/plant-a/core/roles`) | Not exported |
| RO29 | Shift lead for a plant admin | Light, 1440 by 900 | Jonas Holm reads the role: no Edit role; the read-only list shows only the permissions Shift lead includes, by module, with the reason it is read-only (`/plant-a/core/roles/$roleId`) | Not exported |
| RO30 | Shift lead for a plant admin | Dark, 1440 by 900 | As RO29 (`/plant-a/core/roles/$roleId`) | Not exported |
| RO31 | Edit route without core.role:manage | Light, 1440 by 900 | Jonas Holm opens an edit link: title and h1 No access to Edit role (`/plant-a/core/roles/$roleId/edit`) | Not exported |
| RO32 | Edit route without core.role:manage | Dark, 1440 by 900 | As RO31 (`/plant-a/core/roles/$roleId/edit`) | Not exported |
| RO33 | Roles list | Dark, 1920 by 1080 | As RO4 (`/plant-a/core/roles`) | [core-304-access-ro33-roles-list-dark-1920.png](core-304-access-ro33-roles-list-dark-1920.png) |
| RO34 | Roles list | Dark, 1280 by 800 | As RO3 (`/plant-a/core/roles`) | Not exported |
| RO35 | Row menu of a custom role | Light, 1440 by 900 | Actions for Shift lead open, keyboard focus on Edit role, the first item. Up and Down move, Enter chooses, Escape closes the menu and returns focus to its button (`/plant-a/core/roles`) | Not exported |
| RO36 | Row menu of a custom role | Dark, 1440 by 900 | As RO35 (`/plant-a/core/roles`) | Not exported |
| RO37 | Row menu of a default role | Light, 1440 by 900 | Actions for Planner open with one item, New role from Planner, which opens New role with Start from set to Planner. A default role cannot be edited here (`/plant-a/core/roles`) | Not exported |
| RO38 | Row menu of a default role | Dark, 1440 by 900 | As RO37 (`/plant-a/core/roles`) | Not exported |
| RO39 | Edit Shift lead, refused on Save | Light, 1440 by 900 | Petra Sund holds IT, with core.role:manage, at Plant A only (assumed). The client lets her open the edit route at Plant A; the server refuses the Save, because Shift lead is a role of Acme AB. The error summary has focus; every tick, the reason and the change stay (`/plant-a/core/roles/$roleId/edit`) | [core-304-access-ro39-edit-shift-lead-refused-on-save-light-1440.png](core-304-access-ro39-edit-shift-lead-refused-on-save-light-1440.png) |
| RO40 | Edit Shift lead, refused on Save | Dark, 1440 by 900 | As RO39 (`/plant-a/core/roles/$roleId/edit`) | Not exported |
| RO41 | Shift lead after Save | Light, 1440 by 900 | RO17 saved: the role detail replaces the form, its h1 has focus, and the note repeats the polite announcement. The Permissions tab lists the 6 permissions Shift lead now includes (`/plant-a/core/roles/$roleId`) | Not exported |
| RO42 | Shift lead after Save | Dark, 1440 by 900 | As RO41 (`/plant-a/core/roles/$roleId`) | Not exported |

### Row 2, assignments and a user's access

Part file `core/core-304-access-assign.dc.html`.

| Frame | State | Theme, size | What it shows | PNG |
|---|---|---|---|---|
| AS1 | Access tab, plant admin | Light, 1440 by 900 | Jonas Holm reads Sara Nyberg's roles per place: Shift lead at Plant A with Remove, and Viewer at Acme AB, all plants, with the line that a company admin of Acme AB can remove it. What she can do at Plant A follows, each permission with the role and place behind it (`/plant-a/core/users/$userId?tab=access`) | [core-304-access-as1-access-tab-plant-admin-light-1440.png](core-304-access-as1-access-tab-plant-admin-light-1440.png) |
| AS2 | Access tab, plant admin | Dark, 1440 by 900 | As AS1 (`/plant-a/core/users/$userId?tab=access`) | [core-304-access-as2-access-tab-plant-admin-dark-1440.png](core-304-access-as2-access-tab-plant-admin-dark-1440.png) |
| AS3 | Add role, locked roles named | Light, 1440 by 900 | Plant A only. The listbox is open with keyboard focus on Shift lead, which is locked and names the 3 permissions Jonas Holm does not hold at Plant A with their ids; further down the list, Operator is locked because Anna Berg already holds it at Plant A, and its line still names the permission Jonas Holm lacks there. The listbox lists custom roles, then default roles, each by name, as the roles list does. The side card lists every permission of Shift lead and whether he holds it (`/plant-a/core/users/$userId/roles/new`) | [core-304-access-as3-add-role-locked-roles-named-light-1440.png](core-304-access-as3-add-role-locked-roles-named-light-1440.png) |
| AS4 | Add role, locked roles named | Dark, 1440 by 900 | As AS3 (`/plant-a/core/users/$userId/roles/new`) | Not exported |
| AS5 | Add role, refused by the server | Light, 1440 by 900 | Acme AB, all plants, Viewer, then Add role. The client checks only Plant A, so the server refuses: the error summary takes focus and links to Role, and the message names the 2 permissions Jonas Holm lacks at Acme AB and the assignment permission there. The place, the role and the reason stay (`/plant-a/core/users/$userId/roles/new`) | [core-304-access-as5-add-role-refused-by-the-server-light-1440.png](core-304-access-as5-add-role-refused-by-the-server-light-1440.png) |
| AS6 | Add role, refused by the server | Dark, 1440 by 900 | As AS5 (`/plant-a/core/users/$userId/roles/new`) | Not exported |
| AS7 | Remove a role with a reason | Light, 1440 by 900 | Remove Shift lead at Plant A from Sara Nyberg: the 3 permissions she loses at Plant A, what Viewer at Acme AB still lets her do, focus in the optional reason, Cancel and Remove role. Focus returns to the row's Remove after the dialog closes (`/plant-a/core/users/$userId?tab=access (dialog state not in the URL)`) | [core-304-access-as7-remove-a-role-with-a-reason-light-1440.png](core-304-access-as7-remove-a-role-with-a-reason-light-1440.png) |
| AS8 | Remove a role with a reason | Dark, 1440 by 900 | As AS7 (`/plant-a/core/users/$userId?tab=access (dialog state not in the URL)`) | Not exported |
| AS9 | Every permission, No access cells | Light, 1440 by 900 | Show every permission is checked, and the tab is scrolled to where Core ends and Planning starts. A permission that no role of Sara Nyberg grants reads No access with a lock; screen readers hear No access. No role of Sara Nyberg at Plant A or at Acme AB includes it. Planning counts 4 of 11 (`/plant-a/core/users/$userId?tab=access`) | [core-304-access-as9-every-permission-no-access-cells-light-1440.png](core-304-access-as9-every-permission-no-access-cells-light-1440.png) |
| AS10 | Every permission, No access cells | Dark, 1440 by 900 | As AS9 (`/plant-a/core/users/$userId?tab=access`) | Not exported |
| AS11 | Access tab, company admin | Light, 1440 by 900 | Karin Dahl reads the same tab: Remove on both rows, Viewer at Acme AB included, and Reset password and Block user in the top bar. Access changes follow what Sara Nyberg can do, below the fold (`/plant-a/core/users/$userId?tab=access`) | Not exported |
| AS12 | Access tab, company admin | Dark, 1440 by 900 | As AS11 (`/plant-a/core/users/$userId?tab=access`) | Not exported |
| AS13 | Access tab, plant admin | Light, 1280 by 800 | Scrolled to the end of the tab: the permissions by module, then Access changes, which Jonas Holm cannot read. The region keeps its heading and names the permission it needs (core.audit:read) (`/plant-a/core/users/$userId?tab=access`) | Not exported |
| AS14 | Add role, plant admin | Light, 1280 by 800 | Plant A only and Viewer chosen; Jonas Holm holds both of its permissions at Plant A. A reason is typed and focus is on Add role (`/plant-a/core/users/$userId/roles/new`) | Not exported |
| AS15 | Access tab, company admin | Light, 1920 by 1080 | As AS11 at 1920, with Sara Nyberg's access changes: when, who changed it and on which surface, the change and the reason (`/plant-a/core/users/$userId?tab=access`) | [core-304-access-as15-access-tab-company-admin-light-1920.png](core-304-access-as15-access-tab-company-admin-light-1920.png) |
| AS16 | Add role, company admin | Light, 1920 by 1080 | Karin Dahl adds a role for Anna Berg at Acme AB, all plants. The roles sit under Checked when you add them, because the client checks Plant A only, and the list scrolls on to the last roles. The note for an assigner who lacks permissions is left out (`/plant-a/core/users/$userId/roles/new`) | Not exported |
| AS17 | Access tab, plant admin | Dark, 1280 by 800 | As AS13 (`/plant-a/core/users/$userId?tab=access`) | Not exported |
| AS18 | Access tab, company admin | Dark, 1920 by 1080 | As AS15 (`/plant-a/core/users/$userId?tab=access`) | Not exported |
| AS19 | Access tab loading | Light, 1440 by 900 | Jonas Holm opens Sara Nyberg's Access tab. The user record came with the page, so the h1 and the tabs are drawn; Roles and What Sara Nyberg can do keep their headings and draw skeleton rows, each region aria-busy. Add role is drawn, so its place does not move (`/plant-a/core/users/$userId?tab=access`) | Not exported |
| AS20 | Access tab loading | Dark, 1440 by 900 | As AS19 (`/plant-a/core/users/$userId?tab=access`) | Not exported |
| AS21 | Access tab, no role | Light, 1440 by 900 | Lena Ek holds no role at Plant A or at Acme AB, as after her last role is removed. The Roles card keeps Add role and says so; What Lena Ek can do at Plant A says that permissions come from roles. Question 38 asks whether the users list shows her (`/plant-a/core/users/$userId?tab=access`) | [core-304-access-as21-access-tab-no-role-light-1440.png](core-304-access-as21-access-tab-no-role-light-1440.png) |
| AS22 | Access tab, no role | Dark, 1440 by 900 | As AS21 (`/plant-a/core/users/$userId?tab=access`) | Not exported |
| AS23 | Access tab failed | Light, 1440 by 900 | The roles did not load: ErrorState in the Roles card with the correlation id and Try again, which stays focused while the region reloads. What Sara Nyberg can do is left out, because it is computed from the same roles (`/plant-a/core/users/$userId?tab=access`) | Not exported |
| AS24 | Access tab failed | Dark, 1440 by 900 | As AS23 (`/plant-a/core/users/$userId?tab=access`) | Not exported |
| AS25 | What Sara Nyberg can do, denied | Light, 1440 by 900 | The read field behind the effective permissions (question 16) answers FORBIDDEN: the region keeps its card and heading, and its EmptyState names the permission it needs. The Roles card above is unchanged (`/plant-a/core/users/$userId?tab=access`) | Not exported |
| AS26 | What Sara Nyberg can do, denied | Dark, 1440 by 900 | As AS25 (`/plant-a/core/users/$userId?tab=access`) | Not exported |

### Row 3, users

Part file `core/core-304-access-users.dc.html`.

| Frame | State | Theme, size | What it shows | PNG |
|---|---|---|---|---|
| US1 | Users list | Light, 1440 by 900 | Plant admin; roles per place as chips; a line where only a company admin can act (`/plant-a/core/users`) | [core-304-access-us1-users-list-light-1440.png](core-304-access-us1-users-list-light-1440.png) |
| US2 | Users list | Dark, 1440 by 900 | Plant admin; roles per place as chips; a line where only a company admin can act (`/plant-a/core/users`) | Not exported |
| US3 | Row menu | Light, 1440 by 900 | Actions for Anna Berg open, keyboard focus on Reset password (`/plant-a/core/users`) | Not exported |
| US4 | Row menu | Dark, 1440 by 900 | Actions for Anna Berg open, keyboard focus on Reset password (`/plant-a/core/users`) | Not exported |
| US5 | New user, operator without email | Light, 1440 by 900 | Company admin; Email empty with the placeholder note; first role Operator (`/plant-a/core/users/new`) | [core-304-access-us5-new-user-operator-without-email-light-1440.png](core-304-access-us5-new-user-operator-without-email-light-1440.png) |
| US6 | New user, operator without email | Dark, 1440 by 900 | Company admin; Email empty with the placeholder note; first role Operator (`/plant-a/core/users/new`) | Not exported |
| US7 | New user, field errors | Light, 1440 by 900 | After Create user: the error summary has focus and links to both fields (`/plant-a/core/users/new`) | Not exported |
| US8 | New user, field errors | Dark, 1440 by 900 | After Create user: the error summary has focus and links to both fields (`/plant-a/core/users/new`) | Not exported |
| US9 | New user, username refused | Light, 1440 by 900 | The server refused a username that is taken or was used before; entries kept (`/plant-a/core/users/new`) | Not exported |
| US10 | New user, username refused | Dark, 1440 by 900 | The server refused a username that is taken or was used before; entries kept (`/plant-a/core/users/new`) | Not exported |
| US11 | Block user | Light, 1440 by 900 | ConfirmDialog with the reason; focus in the reason field (`/plant-a/core/users/$userId?tab=access`) | Not exported |
| US12 | Block user | Dark, 1440 by 900 | ConfirmDialog with the reason; focus in the reason field (`/plant-a/core/users/$userId?tab=access`) | Not exported |
| US13 | Unblock user | Light, 1440 by 900 | ConfirmDialog for a blocked user; focus in the reason field (`/plant-a/core/users/$userId?tab=access`) | Not exported |
| US14 | Unblock user | Dark, 1440 by 900 | ConfirmDialog for a blocked user; focus in the reason field (`/plant-a/core/users/$userId?tab=access`) | Not exported |
| US15 | Reset password | Light, 1440 by 900 | ConfirmDialog; focus in the empty reason field (`/plant-a/core/users/$userId?tab=access`) | Not exported |
| US16 | Reset password | Dark, 1440 by 900 | ConfirmDialog; focus in the empty reason field (`/plant-a/core/users/$userId?tab=access`) | Not exported |
| US17 | Temporary password | Light, 1440 by 900 | Shown once in a dialog with Copy, never in a toast; focus on Copy password (`/plant-a/core/users/$userId?tab=access`) | [core-304-access-us17-temporary-password-light-1440.png](core-304-access-us17-temporary-password-light-1440.png) |
| US18 | Temporary password | Dark, 1440 by 900 | Shown once in a dialog with Copy, never in a toast; focus on Copy password (`/plant-a/core/users/$userId?tab=access`) | Not exported |

### Row 4, no access, 320, long strings, keyboard and focus

Part file `core/core-304-access-noaccess-keyboard.dc.html`.

| Frame | State | Theme, size | What it shows | PNG |
|---|---|---|---|---|
| NO1 | No access to Roles | Light, 1440 by 900 | Alex Lund, planner, opens Roles by URL without core.role:read: one h1 with focus, the missing permission, no data, a way out (`/plant-a/core/roles`) | [core-304-access-no1-no-access-to-roles-light-1440.png](core-304-access-no1-no-access-to-roles-light-1440.png) |
| NO2 | No access to Roles | Dark, 1440 by 900 | As NO1 (`/plant-a/core/roles`) | Not exported |
| NO3 | Forbidden region | Light, 1440 by 900 | Jonas Holm, plant admin, lacks core.audit:read: Access changes keeps its card and heading. The tab panel is scrolled so its top edge falls on the line above the Viewer row. The D2 admin preset still draws Audit log (`/plant-a/core/users/$userId?tab=access`) | [core-304-access-no3-forbidden-region-light-1440.png](core-304-access-no3-forbidden-region-light-1440.png) |
| NO4 | Forbidden region | Dark, 1440 by 900 | As NO3 (`/plant-a/core/users/$userId?tab=access`) | Not exported |
| NO5 | No access cells | Light, 1440 by 900 | Ida Wall reads users and assigns roles but lacks core.role:read (a role assumed for this frame, questions 29 and NQ3): the Role cells and every Granted by cell read No access, each header names the permission in its tooltip, Add role is left out and Remove is named by the place only (`/plant-a/core/users/$userId?tab=access`) | [core-304-access-no5-no-access-cells-light-1440.png](core-304-access-no5-no-access-cells-light-1440.png) |
| NO6 | No access cells | Dark, 1440 by 900 | As NO5 (`/plant-a/core/users/$userId?tab=access`) | Not exported |
| NO7 | Plant without a role | Light, 1440 by 900 | D2 ST29 as approved, not a new design: Alex Lund opens a Plant B link after his role there was removed; FORBIDDEN and NOT_FOUND read the same (`/plant-b/planning/board`) | Not exported |
| NO8 | Plant without a role | Dark, 1440 by 900 | D2 ST30 as approved, as NO7 (`/plant-b/planning/board`) | Not exported |
| NO9 | Access lost | Light, 1440 by 900 | Close code 4403 on the Planning board at Plant B for a planner who keeps Plant A and Plant C: the alertdialog over the inert page, focus on Go to Plant A (`/plant-b/planning/board`) | [core-304-access-no9-access-lost-light-1440.png](core-304-access-no9-access-lost-light-1440.png) |
| NO10 | Access lost | Dark, 1440 by 900 | As NO9, without annotations (`/plant-b/planning/board`) | Not exported |
| NO11 | Roles list | Light, 320 by 640 | Karin Dahl. RO1 in one column: the search, then Filters, which opens the Filters sheet with Defined by; the table keeps RO1's groups and counts and scrolls in its own region; Role stays (`/plant-a/core/roles`) | Not exported |
| NO12 | Roles list | Dark, 320 by 640 | As NO11 (`/plant-a/core/roles`) | Not exported |
| NO13 | Access tab | Light, 320 by 640 | Jonas Holm on Sara Nyberg: roles as cards, no table (`/plant-a/core/users/$userId?tab=access`) | [core-304-access-no13-access-tab-light-320.png](core-304-access-no13-access-tab-light-320.png) |
| NO14 | Access tab | Dark, 320 by 640 | As NO13 (`/plant-a/core/users/$userId?tab=access`) | Not exported |
| NO15 | Role editor | Light, 320 by 640 | Karin Dahl. One column, with Changes not saved above the reason; the Save bar stays at the bottom (`/plant-a/core/roles/$roleId/edit`) | Not exported |
| NO16 | Role editor | Dark, 320 by 640 | As NO15 (`/plant-a/core/roles/$roleId/edit`) | Not exported |
| NO17 | Long strings, German and Finnish | Light, 1440 by 900 | The role editor with German labels and data at full length; the column is scrolled to its end, where the plugin group Acme-työkalujen hallinta shows Finnish lines. Each holder's plant sits under the name (`/werk-sued/core/roles/$roleId/edit`) | [core-304-access-no17-long-strings-german-and-finnish-light-1440.png](core-304-access-no17-long-strings-german-and-finnish-light-1440.png) |
| NO18 | Tab order on the Access tab | Light, 1440 by 900 | Numbers are the Tab sequence; the skip link has focus (`/plant-a/core/users/$userId?tab=access`) | [core-304-access-no18-tab-order-on-the-access-tab-light-1440.png](core-304-access-no18-tab-order-on-the-access-tab-light-1440.png) |
| NO19 | Tab order on the role editor | Dark, 1440 by 900 | Oskar Wik, IT: locked permissions are no Tab stops. Numbers start in main (`/plant-a/core/roles/$roleId/edit`) | Not exported |
| NO20 | Focus in the permission checklist | Light, 1440 by 900 | Space ticked Run autoplan; focus stays on its checkbox (`/plant-a/core/roles/$roleId/edit`) | Not exported |
| NO21 | Focus after Add role | Dark, 1440 by 900 | Shift lead at Plant A added for Alex Lund: his Access tab, its h1 has focus, the polite region speaks; the new row sits beside Planner (`/plant-a/core/users/$userId?tab=access`) | Not exported |
| NO22 | Focus after a refusal | Light, 1440 by 900 | The server refused Viewer at Acme AB; the error summary has focus and its link repeats the message under Role (`/plant-a/core/users/$userId/roles/new`) | Not exported |
| NO23 | Summary link followed | Dark, 1440 by 900 | Enter on the summary's link: focus on Role (`/plant-a/core/users/$userId/roles/new`) | Not exported |
| NO24 | Focus in the remove dialog | Light, 1440 by 900 | Numbers are the Tab cycle inside the dialog; focus starts in Reason (`/plant-a/core/users/$userId?tab=access`) | Not exported |
| NO25 | Focus in the access-lost dialog | Dark, 1440 by 900 | Numbers are the Tab cycle; focus starts on Go to Plant A; Escape does nothing (`/plant-b/planning/board`) | Not exported |
| NO26 | Build notes, not part of the UI | Light, 4480 by 3728 | For the whole page: components, patterns, tokens, ARIA, announcements, keyboard, permission ids, copy and WCAG 2.2 | [core-304-access-no26-build-notes-light.png](core-304-access-no26-build-notes-light.png) |
| NO27 | Long strings, German and Finnish | Dark, 1440 by 900 | As NO17 (`/werk-sued/core/roles/$roleId/edit`) | Not exported |

### Frames without a PNG

This record has 28 PNGs in the folder: the header, the build notes, the roles list at 1440 in light and dark, at 1280 and at 1920, the Access tab of the plant admin in light and dark and of the company admin at 1920, at least one frame for each item of the issue's frame list, the Access tab at 320, the long strings and the Tab order on the Access tab. AS9 and NO5 show the two readings of the No access cells that the decision at approval separates, and RO21 shows the read-only Holders tab.

The other frames are on the design page only:

- Row 1: RO4 to RO12, RO14 to RO16, RO18 to RO20, RO22 to RO32, RO34 to RO38 and RO40 to RO42.
- Row 2: AS4, AS6, AS8, AS10 to AS14, AS16 to AS20 and AS22 to AS26.
- Row 3: US2 to US4, US6 to US16 and US18.
- Row 4: NO2, NO4, NO6 to NO8, NO10 to NO12, NO14 to NO16, NO19 to NO25 and NO27.

## Build notes

NO26 holds the build notes of the whole page, marked on the page as not part of the UI. This section carries them over in short, and its PNG holds the full text. The notes are for E05-S06 (#54), E05-S08 (#56), E04-S02 (#40) and E04-S07 (#45). When the design and the accessibility rules disagree, the rules win. Where the notes describe the No access cells, the decision at approval applies: the cells of a reader who may not read roles get their own wording.

### Components

The shadcn components by name, with the D1 look:

| Component | Use on this page | States and rules |
|---|---|---|
| Sidebar, Breadcrumb | The D2 shell on plant routes: Administration with Users and Roles; the planner shell on the page opened by URL | The bell is off in release 1 (ADR 0055); one h1 per page; the crumb starts with the plant |
| Card, Table | DataTable on TanStack Table v9: the users and roles lists, Roles on the Access tab, What the person can do, Access changes, Holders | Populated, loading, empty, error, a forbidden region, No access cells; the roles list groups its rows with the canonical grouped pager; at 320 the roles table scrolls in its own region with Role sticky (NO11) |
| DropdownMenu | Row menus for a user (Reset password, Block user or Unblock user) and for a role (Edit role and New role from the role on a custom role, New role from the role on a default role); Page actions at 320 | A button with aria-haspopup menu and aria-expanded; focus on the first item; Company admin and a reader without the permission get no menu |
| Tabs | User: General, Access, History. Role: Permissions, Holders, History | Roving tabindex; the tab is the URL parameter `tab`; focus stays on the tab |
| Collapsible | One per module in the permission checklist; the trigger is a button inside an h3 | aria-expanded, aria-controls; 44 px trigger; a closed module shows its count |
| Checkbox | Each permission; Show every permission | 24 px hit area; a locked permission draws Lock in its place with aria-disabled and no Tab stop; a refused one is aria-invalid |
| RadioGroup | Where: Plant A only, or Acme AB, all plants | One Tab stop; arrow keys choose; each radio is described by its line |
| Combobox | Role: a Popover with a Command listbox in two groups | Disabled options stay in the list with what they need; aria-activedescendant; aria-invalid after a refusal |
| Select | Start from on New role | The role is copied once; the difference group follows |
| Input, Textarea | Role name; Name, Username and Email on New user; Reason on every form and dialog | Field wires label, description, aria-invalid and aria-describedby |
| Badge | Added, Removed, Not installed, Plugin; StatusBadge Active and Blocked | Text always carries the state |
| Button | Add role, Remove, Save role, Create role, Create user, Copy password, Done, Try again; links as Buttons: Go to Planning board, Go to Roles, Your plants, Go to Plant A | At most one default Button per region; 36 px |
| Alert Dialog | ConfirmDialog for Remove role, Block user, Unblock user and Reset password; the access-lost dialog after close code 4403 | The page behind is inert; Block user is destructive; the access-lost dialog has no Cancel and ignores Escape |
| Dialog | Temporary password, shown once after Reset password and after Create user | Focus on Copy password; Done closes it; never a toast |
| Tooltip | The Granted by column header button (NO5, NO6) | Opens on focus and hover, stays while hovered, Escape closes it |
| Alert | The error summary; the success note; info notes | The summary takes focus; the note repeats the announcement |
| Skeleton | LoadingState rows of the tables | aria-busy on the region |

### Patterns and hooks

From `@northmes/ui` and `@northmes/web-sdk`:

- PageFrame for every state of a page: populated, loading, empty, error and forbidden.
- EntityListPage for Users and Roles, with the toolbar and DataTable in a Card, as on the canonical page. The users list takes loading, empty, error and forbidden from the canonical page unchanged, with users as the noun; the roles list draws its own (RO5 to RO10).
- EntityDetailPage and HistoryTab for the user (General, Access, History) and the role (Permissions, Holders, History).
- EntityForm and useCommandForm for New role, Edit role, Add role and New user: the error summary, server fieldErrors on the field, typed values kept and the shared reason argument.
- ConfirmDialog for Remove role, Block user, Unblock user and Reset password, each with the reason field.
- EmptyState, ErrorState and LoadingState for the page opened by URL and the edit route without the permission (Lock, one short Card, NO1, RO31), a forbidden region, an empty Roles card and a failed load with the correlation id and Try again.
- DefinitionList for the person card on Add role; VisuallyHidden for Included on a read-only permission and for the reason behind a No access cell.
- screenRoute checks the route permission before load and renders the page opened by URL; it writes no permission.denied event.
- usePermission and `<Can>` hide an action the reader cannot use on a record and lock what cannot be added. useConnection turns FORBIDDEN on a relation path into No access cells. announce() is the shell's polite region.

### Tokens and values that are not tokens

Every UI color, radius and font on the page is a D1 token: `--background`, `--foreground`, `--card`, `--card-foreground`, `--muted`, `--muted-foreground`, `--accent`, `--border`, `--input`, `--primary`, `--primary-foreground`, `--secondary`, `--secondary-foreground`, `--destructive`, `--destructive-subtle`, `--success`, `--success-subtle`, `--info`, `--info-subtle`, `--link`, `--focus-outline`, `--focus-ring`, `--radius-sm`, `--radius`, `--radius-lg`, `--radius-xl`, `--font-sans`, `--font-mono`, `--nm-control-height` and `--nm-target-min`. Dark uses the D1 dark values of the same tokens.

Each value that is not a token is a question for the implementer:

| Value | Where |
|---|---|
| 340 px | Side column of the role editor and Add role at 1280 and wider |
| 480 px | Role name field; the access-lost dialog, the box of D2's reload dialog |
| 520 px | ConfirmDialog, as on the canonical page |
| 44 px | Module disclosure button |
| 36 px | Minimum height of a permission row |
| 24 px | Lock and read-only check boxes in place of a checkbox |
| 280 px | Tooltip of the Granted by header |
| 148 px | Sticky Role column of the roles table at 320 |
| 168 px | When column of Access changes |
| 200 px | Held at Acme AB and Plant A column of the roles list |
| 220 px, 248 px | Row menus of the users and roles lists |
| Black at 50 percent | Overlay behind both dialogs, the D1 Dialog question of D2 |

### Shell, frame and slots

The pages mount the D2 shell on plant routes under `/$plant/core/users` and `/$plant/core/roles`, with the entries core.users and core.roles in Administration. Once #313 has a direction, the frame around these pages changes and their content does not. Page actions render in TopBarActions (New user, New role, Edit role, Reset password, Block user), with at most one default Button, folded into Page actions at 320. The header slot beside the h1 holds the StatusBadge and the username on a user, and the kind of a role on a role. These pages add no module slot.

### ARIA roles and names

| Element | Role, name and state |
|---|---|
| Page opened by URL | h1 "No access to Roles", tabindex -1, focused on arrival; the EmptyState has no heading of its own; Go to Planning board is a link |
| Forbidden region | The section keeps its h2 (Access changes); its EmptyState heading is an h3 |
| No access cell | The text No access with Lock (aria-hidden); the Granted by header is a button whose aria-describedby is the tooltip |
| Module group | A section labelled by its h3; the h3 holds a button with aria-expanded and aria-controls |
| Permission | A checkbox named by its plain line, described by its id and its reason line; locked: aria-disabled, not focusable; refused: aria-invalid |
| Selected count | A status: "6 of 36 selected." |
| Where | A radiogroup labelled Where; each radio described by its line |
| Role | A combobox with aria-expanded, aria-controls the listbox and aria-activedescendant; listbox groups labelled by their headings; disabled options aria-disabled |
| Roles on a user | The table "Roles of Sara Nyberg"; each Remove named "Remove Shift lead at Plant A". When the reader may not read roles, the Role header is a button described by its tooltip and Remove is named "Remove role at Plant A" (NO5) |
| Row menu | A button named "Actions for Shift lead", aria-haspopup menu, aria-expanded, aria-controls the menu; the items are menuitems |
| Temporary password | A dialog, aria-modal, labelled by its heading, described by its two sentences; the password is a read-only textbox labelled Temporary password |
| Error summary | A group labelled by its h2, tabindex -1; each link repeats its field's message and leads to the field; a refusal for the whole role is a list item without a link (RO39) |
| Remove dialog | An alertdialog, aria-modal, labelled by its heading, described by the permissions lost and kept |
| Access-lost dialog | An alertdialog over an inert page; its heading is the only h1; described by its two sentences. With one plant left it shows only Go to Plant A, with none only Your plants (proposed) |
| Roles table at 320 | The region "Roles table, scrolls sideways", tabindex 0 |

### Announcements

One message per event goes through the shell's polite region:

- Add role: "Shift lead at Plant A added for Alex Lund. It applies from Alex Lund's next action."
- Remove role: "Shift lead at Plant A removed from Sara Nyberg. It applies from Sara Nyberg's next action."
- Save role: "Shift lead saved. It applies to 2 people from their next action." (proposed)
- Create role: "Night planner created." (proposed)
- Block user and Unblock user: "Päivi Kärkkäinen-Leppänen is blocked and signed out within a minute." and "Mikael Strand is unblocked and can sign in again." (proposed)
- Copy password: "Password copied." (proposed)
- Tick or untick: the status count speaks, "6 of 36 selected."
- Create user and Reset password announce nothing: the Temporary password dialog opens and is read on open. A refusal or field errors move focus to the error summary. The page opened by URL has the title and the focused h1. The access-lost alertdialog is read on open. Loading sets aria-busy on the region.

### Keyboard and focus after each action

| Action | Where focus goes |
|---|---|
| Route change | The h1, also on the page opened by URL |
| Tab change | Stays on the tab; the URL parameter changes |
| Space on a permission | Stays; the count speaks (NO20) |
| Enter on a module | Stays; the group opens or closes |
| Save role | The role detail's h1, with a replace navigation (RO41, proposed) |
| Save role refused | The error summary (RO39); its links lead to the refused permissions |
| Row menu | Enter, Space or Down on Actions opens the menu with focus on the first item; Escape closes it and returns focus to the button (RO35, US3) |
| Create user | The new user's page with a replace navigation, the Temporary password dialog open and focus on Copy password; after Done the user's h1 (proposed) |
| Create user refused | The error summary (US7, US9) |
| Block user, Unblock user | Reason in the dialog; after confirming, the top bar button that takes the place of the one that opened it (proposed); Escape or Cancel back to the button |
| Reset password | Reason in the dialog; after confirming, Copy password in the Temporary password dialog; Done returns focus to Reset password |
| Add role | The user's h1 on the Access tab (NO21) |
| Add role refused | The error summary (NO22), then Role (NO23) |
| Remove | Reason in the dialog (NO24); Escape or Cancel back to Remove; after Remove role the next row's role link, else Add role (proposed) |
| Close code 4403 | Go to Plant A in the dialog (NO25); Escape does nothing |
| Try again | Stays on the button while the region reloads |

### WCAG 2.2 criteria

The page meets level AA (ADR 0021). The notes cite 1.3.1, 1.4.1, 1.4.3, 1.4.10, 1.4.11, 1.4.13, 2.1.1, 2.1.2, 2.4.2, 2.4.3, 2.4.6, 2.4.7, 2.4.11, 2.5.8, 3.2.2, 3.2.3, 3.2.4, 3.3.1, 3.3.3, 3.3.7, 4.1.2 and 4.1.3. The ones the page leans on: 1.4.10, because 320 by 640 has no sideways page scroll and only the roles table scrolls both ways, in its own region; 1.4.13 for the Granted by tooltip; 2.4.2 for the titles "No access to Roles · Plant A · NorthMES" and "You no longer have access to Plant B · NorthMES"; 3.2.2, because ticking a permission does not save; 3.2.4, one word for one meaning, which the decision on the No access cells keeps; 3.3.1 and 3.3.3, because refusals name the permission, the place and who can act; and 3.3.7, because typed values stay after a refusal.

### Permission ids shown on the page

Each permission row shows its plain line, then its id in Plex Mono. The plain lines are proposed (question 4), the proposed ids wait on question 3, and the invented ids exist only on this page. Permissions of a module that is not installed never appear in what a person can do.

| Permission id | Plain line (proposed) | Id from |
|---|---|---|
| `core.user:read` | Read users and their roles | Proposed id |
| `core.user:create` | Create users | Proposed id |
| `core.user:block` | Block users | Proposed id |
| `core.user:resetPassword` | Reset passwords | Proposed id |
| `core.role:read` | Read roles | Proposed id |
| `core.role:manage` | Create and edit roles | Plan docs |
| `core.roleAssignment:manage` | Assign and remove roles | Proposed id |
| `core.audit:read` | Read the audit log | Plan docs |
| `core.settings:manage` | Change core settings | Plan docs |
| `core.plant:create` | Create plants | Plan docs |
| `core.onboarding:manage` | Run onboarding | Plan docs |
| `core.company:update` | Rename the company | Plan docs |
| `planning.productionOrder:read` | Read production orders and the planning board | Plan docs |
| `planning.productionOrder:create` | Create production orders | Plan docs |
| `planning.productionOrder:update` | Change production orders | Plan docs |
| `planning.productionOrder:release` | Release production orders to the floor | Plan docs |
| `planning.productionOrder:cancel` | Cancel production orders | Plan docs |
| `planning.jobOrder:read` | Read job orders | Plan docs |
| `planning.jobOrder:schedule` | Move and schedule job orders and save the plan | Plan docs |
| `planning.jobOrder:lock` | Lock job orders | Plan docs |
| `planning.jobOrder:breakLock` | Break another planner's lock | Plan docs |
| `planning.autoplan:run` | Run autoplan | Plan docs |
| `planning.settings:manage` | Change planning settings | Plan docs |
| `productionStart.report:create` | Report production at a station | Plan docs |
| `productionStart.report:correct` | Correct operator reports | Plan docs |
| `pyramidConnector.import:upload` | Upload Pyramid files | Plan docs |
| `pyramidConnector.settings:manage` | Change Pyramid connector settings | Proposed id |
| `pyramidConnector.import:sync` | Use Sync now | Plan docs |
| `pyramidConnector.inbox:resolve` | Resolve files in the import inbox | Proposed id |
| `pyramidConnector.pendingChange:decide` | Accept or reject pending ERP changes | Plan docs |
| `pyramidConnector.importRun:read` | Read the import log | Plan docs |
| `ai.assistant:use` | Use the assistant | Plan docs |
| `ai.provider:manage` | Set up AI providers | Plan docs |
| `ai.usage:read` | Read AI usage | Plan docs |
| `acme.toolLife:read` | Read tool life | Invented |
| `acme.toolChange:record` | Record tool changes | Invented |
| `kanban.board:read` | Read the kanban board | Invented |

### Final English copy

The copy is proposed; names, places and numbers are the frames' fictional data. The NO26 PNG lists every string by region. The main strings:

- Page opened by URL: "No access to Roles", "Opening Roles needs the permission to read roles (core.role:read) at Plant A.", "Ask a plant admin for a role that includes it.", "Go to Planning board".
- Forbidden region and cells: "You cannot see access changes here", "This needs the permission to read the audit log (core.audit:read) at Plant A.", "No access", "No role of Sara Nyberg at Plant A or at Acme AB includes it.", "Granted by needs the permission to read roles (core.role:read) at Plant A." The last string belongs to the reader who may not read roles, whose cells get their own wording by the decision at approval.
- Access lost: "You no longer have access to Plant B", "Your role at Plant B was removed or changed, so this page cannot load or save anything at Plant B.", "Changes on this page that are not saved are lost.", "Your plants", "Go to Plant A".
- Roles list: "Roles", "11 roles at Acme AB", "New role", "Custom roles of Acme AB", "Default roles from modules", "Held at Acme AB and Plant A", "2 groups, 11 roles", "No custom roles yet", "Could not load roles", "No access to Edit role".
- Role editor: "Edit Shift lead", "Role name", "Unique within Acme AB.", "Grouped by module in the order of the sidebar. Each line says what the permission allows; its id is for docs and support.", "6 of 36 selected.", "You do not hold it at Plant A.", "Where Shift lead applies", "Changes not saved", "Reason for change (optional)", "Save role", "Shift lead was not saved", "Shift lead saved. It applies to 2 people from their next action."
- New role: "Start from", "No role", "The new role copies its permissions once. It does not follow later changes to Planner.", "Difference from Planner", "Create role".
- Add role: "Add role for Anna Berg", "Where", "Plant A only", "Acme AB, all plants", "Role", "Roles that need permissions you do not hold at Plant A stay in the list, with what they need.", "Fix 1 field to add the role", "You cannot assign Viewer at Acme AB. It includes 2 permissions you do not hold at Acme AB: {list}. Assigning at Acme AB also needs Assign and remove roles (core.roleAssignment:manage) there. Ask a company admin of Acme AB to assign it."
- Access tab: "Roles", "Sara Nyberg's roles that apply at Plant A.", "A company admin of Acme AB can remove it.", "What Sara Nyberg can do at Plant A", "Granted by", "Show every permission", "Lena Ek holds no role at Plant A or at Acme AB.", "Permissions come from roles. Add a role above."
- Remove dialog: "Remove Shift lead at Plant A from Sara Nyberg?", "From the next action, Sara Nyberg loses these permissions at Plant A:", "Remove role".
- Holders tab: "Nobody holds Shift lead at Acme AB.", "2 people hold Shift lead at Plant A.", "To add or remove a role, open the person and use the Access tab."
- Users: "Users", "New user", "Roles at Acme AB and Plant A", "A company admin of Acme AB can block this user or reset the password.", "Used to sign in. It cannot be changed later, and no one else can ever use it.", "Leave it empty for a person without email, such as an operator who signs in at a station.", "Temporary, shown to you once after you create the user", "The username t.lindqvist is taken or was used before. Choose another username."
- Block, unblock and reset: "Block Päivi Kärkkäinen-Leppänen?", "Unblock Mikael Strand?", "Reset the password of Alex Lund?", "Temporary password for Alex Lund", "Copy password", "Shown only now. After you close this dialog, it cannot be shown again.", "Done".

## Proposals still open

F0 lists these proposals as needing Krister Johansson's yes:

- Row 1: the roles list as one DataTable with two fixed group rows (custom roles of Acme AB first, then default roles from modules) and the canonical grouped pager, also at 320 (RO1, NO11); the row menus, with none on Company admin (RO35, RO37, question 34); Start from with No role first and as the default, and its one-time copy (RO11, RO13); option A's two columns for New role and the role editor (RO11 to RO20); the list, the role and the edit route without core.role:manage (RO27 to RO32); "New role from Planning admin" on a default role and the Holders tab shown to every reader (RO25, RO29, questions 32 and 33); the role detail after Save and the refused Save (RO39, RO41); a read-only role that lists only the permissions it includes (RO29).
- Row 2: Where before Role in Add role, with locked roles that name up to three missing permissions and their ids (AS3); "A company admin of Acme AB can remove it." for a plant admin (AS1); the server's refusal in the error summary (AS5); the 760 px main column of Add role at 1920 (AS16); the order of the role picker (AS3); the Access tab's loading, empty and failed states (AS19 to AS24).
- Row 3: New user drawn for Karin Dahl (question 36); no password field and a temporary password shown once (US5, US17); a username refusal that does not say whether the name is in use or retired (US9); no email, no last sign-in and no Lena Ek in the list, and Jonas Holm's own row keeps its menu (questions 13, 38 and 39); an optional reason on Block user, Unblock user and Reset password (question 9).
- Row 4: the page opened by URL (NO1); the access-lost dialog with focus on Go to Plant A and Escape doing nothing (NO9, NO25, NQ1); focus after Remove role (NO24, NQ2); focus after Add role (NO21); the Role cells when the reader may not read roles (NO5), whose wording the decision at approval leaves to be drawn; the access-lost dialog with one plant or none left; the announcement copy and the final English copy in NO26.

## Assumptions

From the header:

- Every value is fictional: Acme AB, its plants, the people, usernames, roles, permission ids marked invented, correlation ids and dates.
- The plain line of each permission is proposed, because the manifest declares permissions without a label (question 4). The ids core.user:read, :create, :block, :resetPassword, core.role:read and core.roleAssignment:manage are proposed (question 3); acme.toolLife:read, acme.toolChange:record and kanban.board:read are invented for the page.
- Plant admin and IT are custom roles of Acme AB, because core ships no plant admin role (question 6). Plant admin holds Viewer's two read permissions, so Shift lead needs three permissions Jonas Holm lacks at Plant A.
- From Plant A the pages read assignments at Acme AB and at Plant A, never at Plant B (question 1). Holder counts, a user's roles and every refusal name only those two places.
- The D2 admin preset draws every Administration entry. A narrower Plant admin role would show fewer, such as no Audit log without core.audit:read (NO3).
- The access-lost dialog takes the 480 px box of D2's reload dialog, so the two shell alertdialogs match.
- A role change and an assignment apply from the holder's next action.
- Every color is a D1 token; NO26 lists the values that are not tokens.

## Known limits

- AS25 and AS26 draw the effective permissions region denied with copy that names core.user:read. A reader of a user's page already holds that permission, so the permission the region names waits on question 16.
- The Filters sheet of the roles list at 320 is not drawn. It holds Defined by, as the canonical Filters sheet of #222 holds the list's filters.
- The wording for the cells of a reader who may not read roles, decided at approval, is not drawn; NO5 and NO6 still read No access.

## Open questions

From the header, with its numbers. Questions 17 to 21 of the variations round were answered by the choice of direction, and the decision at approval answers question 29.

- 1 Row-level security on core.role_assignment: may the pages at Plant A read a user's assignments at Plant B?
- 2 Should users, roles and assignments also be reachable under /admin?
- 3 Permission ids for assigning roles, reading roles and reading, creating, blocking and resetting users. May a planner read role names?
- 4 Where do the plain-language label and description of each permission come from?
- 5 Are module default roles read only? Does a role made from a default role keep a link to it?
- 6 Does core ship a plant admin default role, and what does it hold?
- 7 Does the catalog record a level, company or plant, per permission?
- 8 The refusal error: one code that lists every missing permission, or core.forbidden with one permission?
- 9 Is a reason required to remove an assignment, change a role or block a user?
- 10 Removing the last company admin, or your own admin role: refuse, warn or allow?
- 11 Does creating a user take the first role and place in the same command?
- 12 Can an admin add an existing user who works for another company?
- 13 Does the user list show email, last sign-in or a pending temporary password?
- 14 Are unblock, rename and change of email in release 1?
- 15 Does the UI show the placeholder address or No email?
- 16 Which read field returns another user's effective permissions at a plant?
- 22 Should any FORBIDDEN make the shell fetch the module list again?
- 23 A separate company admin beside the plant admin, while D2 drew Jonas Holm in its company admin frames; and D2's name for the link to /admin.
- 24 Who may edit and assign roles at which scope is open for the product owner; the page draws the working default.
- 25 E05-S15, the admin pages at /admin, has no GitHub issue yet.
- 26 Do role and assignment changes need the review step of WCAG 3.3.4?
- 27 Does a role carry a description, and are role names unique within a company?
- 28 Can a custom role be archived or deleted while people hold it?
- 30 What does removing an assignment at a scope need: the assignment permission alone, or also every permission of the role there?
- 31 May an editor untick a permission he does not hold?
- 32 Does a default role offer New role from it, as a page action and in its row menu?
- 33 Is the Holders tab shown to a plant admin who cannot assign the role?
- 34 Should Start from offer Company admin?
- 35 Does a permission of a module that is not installed block assigning a role that holds it?
- 36 Does Plant admin hold the permissions of the roles a plant admin hands out, or does creating operators stay with a company admin?
- 37 Does NorthMES create the temporary password, or does the admin type it?
- 38 Does a user without a role at Acme AB or Plant A appear in Plant A's users list?
- 39 May a plant admin block himself or reset his own password?
- NQ1 Escape in the access-lost dialog does nothing, as in D2's reload dialog. Keep it?
- NQ2 After Remove role, focus goes to the next row's role link, else Add role. Keep it?
- NQ3 Does a role with core.user:read and without core.role:read exist, and does core.user:read alone return a user's role names?
