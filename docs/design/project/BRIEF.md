# NorthMES design brief

NorthMES is an open source, developer-first manufacturing execution system (MES). It plans production and follows it on the shop floor, and production planning is its first module. Each installation serves one customer on the customer's own server and runs with Docker Compose. NorthMES is built first for manufacturers without an ERP. The release 1 pilot connects to the customer's ERP through a connector module, and nothing in core depends on one ERP. Domain words follow `GLOSSARY.md` in the repository: production order, operation, job order (UI label "Job"), machine, planning board, block, draft, soft lock and hard lock.

## Stack the designs map to

- Web: one shell that loads a React remote per module at run time, TanStack Router, Apollo Client 4, shadcn/ui on Base UI, Tailwind 4 and Lucide icons. Build notes name each element by its shadcn component name.
- Tokens: the Graphite tokens in `ui/tokens.css`. IBM Plex Sans for text, IBM Plex Mono for numbers, a 6 px radius and 36 px controls. Every screen defaults to the light theme, and each user or station can switch to dark. `@northmes/ui` in the repository holds the source values.
- Server: NestJS, GraphQL with live updates over subscriptions, Postgres. Release 1 uses no TimescaleDB.
- The UI is English only in release 1. Labels are plain strings, and each page has a long-strings frame in German or Finnish.
- Accessibility: WCAG 2.2 AA. Color never carries state alone. Every control is at least 24 by 24 px, and 44 px at stations until a glove test sets the final value.

## Release 1 modules

- `core`: companies and plants, users and roles, master data (equipment groups, machines, tools, articles, routings, calendars, warehouses, customers), settings and System health.
- `planning`: customer orders, production orders, job orders, the planning board, the job order table view, drafts and soft locks, autoplan and agent proposals.
- `production-start`: the operator station at `/station/$stationId`, full screen without the sidebar. Operators switch machine, start, pause and finish a job, and report good and scrap quantities with a scrap reason.
- `ai`: AI provider settings and the read-only planning assistant, a chat panel beside the page.
- `audit`: the audit trail that the History tab on detail pages shows.
- An ERP connector module: import log, import inbox, pending ERP changes and write-back. Where its screens live is not decided.
- Two example plugins: a command validator and a widget on the board.

Later modules (not in release 1): data collection, OEE, quality monitoring, maintenance, traceability, document control, human resource planning, analyzing and notifications.

## Personas and devices

Header frames use these personas and no others.

- Planner: plans production orders on the board and in the job order table view, runs autoplan, saves drafts and handles ERP changes. Works at a desktop PC. Planner pages are drawn at 1280, 1440 and 1920 px, plus a 320 px reflow frame.
- Operator: signs in at a shared shop-floor station by badge or personal login, and reports work on touch screens. Station pages are drawn at 1280 by 800, 1920 by 1080 and portrait.
- Plant admin: sets up the company and its plants, users, roles, master data, calendars, settings, the ERP connector, AI providers and stations.
- Plugin developer: builds modules and plugins on the `defineModule` contract, including slot widgets and remotes.
- Maintainer: builds and releases NorthMES itself.
- Hosting partner: runs NorthMES for customers. Release 1 has no story for this persona.

## Extension slots

A slot is a typed, versioned place in a screen that its owning module renders and other modules fill. Ids follow `<module>/<area>/<name>/v<N>`. Each contribution has a label, which the shell renders as its section heading. Core modules and plugins use the same slots and components, so plugin UI looks like core UI.

- `planning/board/side/v1`: widgets beside the board.
- `planning/order/panels/v1`: panels on a production order, filled by `production-start`.
- `planning/board/block-fields/v1` (proposed id): text and icon fields on every board block.
- `planning/board/header/v1` (proposed id): board header content, such as the ERP connector's "data as of" time.
- The shell aside slot: the AI chat panel, docked beside `main` and a modal sheet below about 640 px.
- Also: page actions in the top bar, help menu entries grouped by module, and slot tabs on detail pages. Whether release 1 has a dashboard slot is not decided.

The sidebar lists core items first, then modules, then plugins in their own section, in a fixed order. A module that failed to load shows its header with "(unavailable)".

## How design work runs

- One page per task, approved before the task moves to Ready. A new kind of screen gets a variations round of three or more options first.
- Pages sit in area folders (`ui/`, `shell/` and one per module id), listed with their status in `README.md`. States are frames inside the page.
- Every page has a header frame, all its states, light and dark, the widths above, a long-strings frame, keyboard and focus frames, and build notes. Pages use invented demo data.
- Module pages mount the shared `Shell.dc.html`, and station pages mount `StationFrame.dc.html`, both in `shell/` once D2 is approved.
- Approval is by etag. The approved etag, PNGs of each frame in light and dark, and the build notes go to `docs/design/<area>/` in the repository. An approved page is frozen, and a later change copies it under a new issue number.
- The implementer takes layout, states, copy, the keyboard model and slot placements, never markup, class names or demo numbers. A value that is not a token is a question.
- Order: D1 tokens (approved), D2 shell and navigation (in review), then D3 planning board and D4 operator station, then the list and form page for core master data.
