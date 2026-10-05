---
status: "accepted"
date: 2026-10-05
decision-makers: "Krister Johansson"
consulted: "Krister Johansson"
informed: "product owner, contributors, coding agents, module and plugin authors"
release: "1"
needs-confirmation: ""
---

# Presentation settings for dates, clocks and numbers with one pinned locale

## Context and problem statement

Screens, the operator station and the planning board show instants, local dates, clock times, article quantities and measured values, and forms take them as input. No document decided which locale `Intl` uses, in which order a date is written, whether the clock has 12 or 24 hours, or which decimal and group signs a number has. Node takes its default locale from `LANG`, so the TIME6 label test passed or failed depending on the host: on Node 24.18.1 the instant 2026-10-25T00:30Z in `Europe/Stockholm` prints `02:30 CEST` in en-GB, `02:30 AM GMT+2` in en-US and `02.30 UTC+2` in fi-FI. [ADR 0023](0023-si-units-with-a-northmes-unit-catalog.md) has the unit-aware number input parse "12,5", but no number format stands behind that rule, and the UI is English only until General Translation arrives ([ADR 0053](0053-translation-english-first-general-translation-later.md)).

The earlier attempt at this product tied number output to the UI language (`Intl.NumberFormat(useLocale())`), and its own report noted that Swedish users would get `4,320.5` once the shell became English only. It kept format wrappers per module (`format-dates.ts` in 11 modules, 470 lines) and three Luxon `formatClock` copies. It kept the plant zone in three places (`Plant.timeZone`, the PLANT settings row and `Calendar.timeZone`), its screens followed the settings row and not the plant form, and a user zone override put the board's "today" and its 6 to 18 window in a different zone from the shifts. Six of its parts are worth keeping: per-field values tagged with their source, closed enums with literal tests, date-only values that never pass through a zone, one context in a federation singleton, the same Zod schema for the form and the command, and canonical storage.

Krister Johansson accepted the presentation settings review on 2026-10-05 with its recommended answers: en-GB, pinned as `en-GB-u-ca-gregory-nu-latn`, is the base locale for English text parts until General Translation arrives; the three fields `dateFormat`, `hourCycle` and `numberFormat` enter release 1 as one `core.presentation` schema on the E06-S08 settings kit, as story E06-S13; the default number format is `spaceComma`; the theme choice is stored per browser. The formatter rules, the function list and the tests below were adopted from that review. This ADR covers the core settings schema, the formatters and parsers in `@northmes/contracts`, the presentation context in `@northmes/ui` and `@northmes/web-sdk`, the shell boot response, the station inputs, the assistant's time context line and the rule for machine-readable output. How time and metric values are stored stays with [ADR 0023](0023-si-units-with-a-northmes-unit-catalog.md) and [ADR 0024](0024-time-utc-instants-plant-wall-clock-temporal-and-the-clamp-resolver.md).

## Decision drivers

* One value prints one string on every host, in every browser and on the server, so tests, screens, the station, the assistant's prose and later reports agree.
* The UI stays English only until General Translation ([ADR 0053](0053-translation-english-first-general-translation-later.md)), while the Swedish pilot writes `1 234,5`, not `1,234.5`.
* ADR 0023's "12,5" rule needs a defined number format and a refusal for input that fits none.
* Stored and transmitted values never change with display: instants are ISO 8601 with an offset and metric values are canonical ([ADR 0023](0023-si-units-with-a-northmes-unit-catalog.md), [ADR 0024](0024-time-utc-instants-plant-wall-clock-temporal-and-the-clamp-resolver.md)).
* Settings live in audited tables, and adding one is a field in a `defineSettings` schema ([ADR 0022](0022-shared-building-blocks-packages-the-master-data-kit-settings-and-generators.md), [ADR 0051](0051-regulated-readiness-no-regret-rules.md) rule 6).
* ECMA-402 accepts no pattern strings, and native Temporal and `temporal-polyfill` differ in their `dateStyle` and `timeStyle` defaults.
* Release 1 is full: a platform feature is built only when a release needs it ([ADR 0055](0055-release-1-scope-under-option-b-and-the-scope-rule.md)), so the settings must fit one story on top of the E06-S08 kit.

## Considered options

* Three closed-enum presentation settings in one core schema, with formatters in `@northmes/contracts` on one pinned base locale
* Formatting that follows the browser locale or the UI language through `Intl` defaults
* The same formatters with fixed values in release 1, and settings later
* Settings as in the earlier attempt: format patterns, one typed column per setting and the zone in the settings cascade

## Decision outcome

Chosen option: "Three closed-enum presentation settings in one core schema, with formatters in `@northmes/contracts` on one pinned base locale", because it makes every string independent of the host, gives the "12,5" rule a number format, leaves stored and transmitted values untouched, and costs one story on top of the settings kit.

### The settings

`core.presentation` is a `defineSettings` schema in `@northmes/core-contracts` with three fields, each with a label and a description. Each field is a closed enum, and each value has one literal rendering, because ECMA-402 accepts no pattern strings. The settings change how values are shown and typed, never what is stored or sent.

| Field | Values and renderings | Default | Controls |
|---|---|---|---|
| `dateFormat` | `iso` (2026-10-25), `dmyDot` (25.10.2026), `dmySlash` (25/10/2026), `mdySlash` (10/25/2026) | `iso` | The order and separators of numeric dates on screens, on the station, in date inputs and in the format hint on date fields |
| `hourCycle` | `h23` (14:05, and 00:05 after midnight, never 24:05), `h12` (2:05 pm) | `h23` | Clock times on screens, on the station, in board labels and in time inputs; time inputs accept 24-hour times under both values |
| `numberFormat` | `spaceComma` (1 234,5, grouped with U+00A0), `commaPoint` (1,234.5), `pointComma` (1.234,5) | `spaceComma` | Group and decimal signs of quantities and measured values on screens and in number inputs, independent of the UI language and of the browser or server locale; the minus sign is always ASCII U+002D, so copied values paste into spreadsheets |

`spaceComma` is the default because it matches the Swedish pilot and keeps ADR 0023's "12,5" case valid. The value enums, the `Presentation` type and `DEFAULT_PRESENTATION` live in MIT `@northmes/contracts` next to the formatters.

### Resolution and delivery

* The E06-S08 settings kit stores a company value and a plant override in its audited tables, and a change bumps `core.config_revision`.
* The server resolves each field on its own: the plant value, then the company value, then the default. When the user level arrives (cut candidate 1), a user value comes before the plant value.
* The SDK settings reader returns each field's effective value with its source (`default`, `company` or `plant`). At plant scope, `SettingsForm` shows the inherited company or default value for each field without a plant value, and offers to clear a plant value.
* Editing needs the core settings permission `core.settings:manage`, named after `planning.settings:manage`. Reading the resolved values needs only a session or station cookie for that plant.
* `GET /api/web/modules?plant=<slug>` also returns `plant { id, slug, name, timeZone, presentation }` with the resolved values. The shell renders `PresentationProvider` from `@northmes/ui` with them, so the shell and every remote read one context through the `@northmes/ui` singleton, and boot runs no extra blocking query.
* The plant switch already refetches that endpoint, and it swaps the presentation context together with the permission set. A settings change shows on the next load, plant switch or reconnect.
* The assistant's one-line time context gains the plant's three values, for example "dates 24.10.2026, 24-hour clock, decimal comma", so the model's prose matches the screens. The line sits after the cached prefix, so prompt caching still works. Tool outputs stay ISO 8601 and canonical, and the chat panel renders tool tables with the same formatters as the screens.

### Time zone

Time zone is not a presentation setting. `core.plant.time_zone` ([ADR 0024](0024-time-utc-instants-plant-wall-clock-temporal-and-the-clamp-resolver.md)) is the only zone: there is no company zone and no user zone, and the user level never gets one. No settings schema has a time zone key, and `core.presentation` refuses one. The browser zone decides only whether a zone label appears next to plant time. The plant form's zone picker lists the ids the server accepts (`pg_timezone_names` filtered by Temporal), served by core. It never uses the browser's `Intl.supportedValuesOf("timeZone")`, which on Node 24.18.1 lacks `UTC`, `Etc/UTC`, `Europe/Kyiv` and `Asia/Kolkata`, although a formatter accepts all four.

### The pinned base locale

* One base locale, `en-GB-u-ca-gregory-nu-latn`, supplies the English text parts: month and weekday names, the day period and short zone names. On Node 24.18.1 it gives `02:30 CEST` (TIME6) and `Tue 3 Nov`, the form the board's keyboard move messages use.
* No code uses the process or browser default locale.
* Formatters set `hourCycle` explicitly.
* Formatters pass component options only, never `dateStyle`, `timeStyle` or `toLocaleString` defaults, because native Temporal and `temporal-polyfill` differ in those defaults.
* The numeric layout of dates and numbers is assembled from `formatToParts` according to the settings.
* `Intl` instances are created lazily and cached per zone and options, never at module scope ([ADR 0024](0024-time-utc-instants-plant-wall-clock-temporal-and-the-clamp-resolver.md)).
* When General Translation arrives, the base locale follows the UI language, and the settings still own the numeric layout.

### Formatters and parsers

All formatting goes through pure functions in `@northmes/contracts`, on the subpath `format`, so the web, the station, the server and later reports print the same strings. The formatters format values but never convert units: the ban on `@northmes/sdk/units` in web packages stays ([ADR 0023](0023-si-units-with-a-northmes-unit-catalog.md)).

| Function | Behaviour |
|---|---|
| `formatPlantDate(value, p)` | Converts an instant in `p.timeZone`; prints a `LocalDate` from its fields, so it never passes through a zone |
| `formatPlantTime(instant, p, { zoneName })` | Prints the clock per `hourCycle`; `zoneName` is `auto`, `always` or `never`, and `auto` keeps ADR 0024's short zone name when the offset differs from an hour before or after |
| `formatPlantDateTime(instant, p, options)` | Prints the date and the time together |
| `formatPlantDay(value, p)` | Prints `Tue 3 Nov`, for board ticks and screen-reader announcements |
| `formatIsoWeek(date, { withYear })` | Prints `2026-W53` or `W53` from `yearOfWeek` and `weekOfYear`, never from `year` |
| `formatNumber(value, p, { decimals })` | Rounds to at most the given decimals, drops trailing zeros, groups from four digits, maps `Intl`'s group and decimal parts to the setting and uses an ASCII minus |
| `formatMeasure(value, unit, p)` and `measureAccessibleName(value, unit, p)` | Use the catalog symbol and display decimals; the accessible name uses the unit's full name |
| `formatQuantity(decimalString, stockUnit, p)` | Passes the `numeric(18,6)` string to `Intl.NumberFormat`, which formats strings exactly, so no `parseFloat` is needed |
| `parseNumber(text, p)` | Accepts the setting's decimal sign, and its group sign only between groups of three; under `spaceComma` a point also reads as the decimal sign; any other input is refused with the expected form in the message |
| `parsePlantDate(text, p)`, `parsePlantTime(text, p)` and `dateFormatHint(p)` | Always accept ISO dates and 24-hour times; refuse impossible dates such as 2026-02-31 instead of rolling them into the next month |

Weeks start on Monday everywhere, date pickers included. Week numbers follow ISO 8601: `2026-W53` in group keys and lists, `W53` on board ticks where the year is visible. The label of a week group key comes from `formatIsoWeek`.

### Web and station

* `@northmes/ui` holds `PresentationProvider` and `usePresentation()`, which returns `DEFAULT_PRESENTATION` outside a provider, so component tests need no provider. `DateTimeText` reads the context and adds the zone label when the browser zone differs from the plant zone. `MeasureText` formats measured values. `NumberField`, `QuantityInput` and the date input parse with the helpers and show the format hint.
* `@northmes/web-sdk` fills the provider in `ShellProvider` and keeps `usePlantTime()`, which returns bound formatters. `formatPlantTime` moves to `@northmes/contracts`, and `<PlantDateTime>` is dropped as a duplicate of `DateTimeText`.
* `HistoryTab` formats diff values by the field's kind in the definition: instants in plant time, local dates and times as dates and times, metric values with the canonical unit symbol and display decimals, and an `_entry_value` and `_entry_unit` pair as one value.
* A form or detail field shows the entry value in its entry unit when one exists, else the unit in the screen's design. A list column or board field shows one unit, named in its header or label and chosen in the screen's design, and passes it as the GraphQL unit argument.
* The station quantity field uses `inputmode="numeric"` when the stock unit has 0 display decimals and `inputmode="decimal"` otherwise. The app keypad shows a decimal key, labelled with the plant's decimal sign, only when the stock unit has display decimals.

### Machine-readable output

GraphQL, REST, MCP tools, outbox events, the audit export and the rollback CSV never use presentation settings. They carry `Instant` values with an offset, the `Local*` scalars, and canonical values with the unit in the key or the argument ([ADR 0023](0023-si-units-with-a-northmes-unit-catalog.md), [ADR 0024](0024-time-utc-instants-plant-wall-clock-temporal-and-the-clamp-resolver.md)). Numbers use a point decimal and no grouping, and units are canonical and named. The rollback CSV writes ISO 8601 with offset and point decimals without grouping.

A later human-readable file, such as a PDF or xlsx report or a list export, is rendered on the server with the same `@northmes/contracts` formatters and the resolved presentation of the plant the file covers, and names the zone in the file. Release 1 has no such files.

### What waits

| Item | Release 1 instead | Scopes when built | Trigger |
|---|---|---|---|
| First day of the week (later `monday`, `sunday` or `saturday`, read with `Intl.Locale` `getWeekInfo()` if needed) | Monday, a constant in code, matching ISO 8601, the SQL week buckets and the Monday calendar anchors ([ADR 0025](0025-plant-calendars-shift-patterns-and-the-production-day.md)) | Company and plant, later user | A plant in a region whose weeks start on Sunday or Saturday. The change also moves the SQL group-by buckets and the calendar rules, so it is not purely presentation |
| Week numbering (later `iso` or `firstJanuary`, where week 1 contains 1 January) | ISO 8601, a constant | Company and plant | The same as the first day of the week. `firstJanuary` needs its own rule table, because `Intl` prints no week numbers and no longer exposes `minimalDays` outside Safari |
| Display units per dimension (later one catalog code per dimension, validated against that dimension's unit enum) | Each list column or board field names its unit in its design; forms and detail views show the entry unit | Company, plant and user | Data collection adds physical dimensions (ADR 0023's revisit trigger), or a pilot user asks for a column in another unit. The same task wires the screens that read the setting |
| User values for the three fields | Plant, then company, then default | A user value before the plant value; the zone never gets one | The user settings cascade, cut candidate 1 ([ADR 0055](0055-release-1-scope-under-option-b-and-the-scope-rule.md)) |

### Theme

Every screen, stations included, defaults to the light theme, and each user or station can switch to dark ([06-web-and-ux.md](../plan/06-web-and-ux.md#design-tokens), decided 2026-10-05). The theme choice is stored per browser in `localStorage` under one key, and the shell entry applies it before the first render. It is not a setting and is not audited, because it changes no behaviour ([ADR 0051](0051-regulated-readiness-no-regret-rules.md) rule 6). A station keeps its choice per device.

### Changes to earlier decisions

An accepted ADR keeps its text, and a changed decision goes into a new ADR ([README](README.md)). This ADR makes these changes, and the plan documents point here for them:

* [ADR 0022](0022-shared-building-blocks-packages-the-master-data-kit-settings-and-generators.md), package map: `@northmes/contracts` also holds the presentation value enums, the `Presentation` type, `DEFAULT_PRESENTATION` and the pure formatters and parsers on the subpath `format`. `@northmes/core-contracts` holds the `core.presentation` schema. `@northmes/ui` also holds `PresentationProvider`, `usePresentation()`, `DateTimeText` and `MeasureText`. `@northmes/web-sdk` fills the provider in its shell provider and keeps `usePlantTime()`; `formatPlantTime` leaves it for `@northmes/contracts`, and `<PlantDateTime>` is dropped. This removes the gap where `DateTimeText` in `@northmes/ui` had no source for the plant zone, because `@northmes/ui` may not import `@northmes/web-sdk`.
* [ADR 0023](0023-si-units-with-a-northmes-unit-catalog.md), API rules: the number input rule becomes "The unit-aware number input parses with the effective `numberFormat`: its decimal sign always, its group sign only between groups of three, and a point as the decimal sign under `spaceComma`. Any other input is refused with the expected form in the message. The input sends `{ value, unit }` and never converts. The formatter rounds to the unit's display decimals and drops trailing zeros." The formatter that ADR 0023 calls the web formatter is the `@northmes/contracts` formatter set, which screens, the station and later human-readable files use. The "12,5" case in `cycle-time.test.ts` runs under `spaceComma`.
* [ADR 0024](0024-time-utc-instants-plant-wall-clock-temporal-and-the-clamp-resolver.md), the lint in its Confirmation: the rule that fails on `Intl.DateTimeFormat` without `timeZone` becomes a rule that fails on `Intl.DateTimeFormat`, `Intl.NumberFormat`, `Intl.DurationFormat`, `toLocaleString`, `toLocaleDateString` and `toLocaleTimeString` outside `packages/contracts/src/format/`. `formatPlantTime` lives in `@northmes/contracts`. ADR 0024 is still proposed, so its own text takes both changes in place.
* [ADR 0019](0019-web-shell-with-react-module-federation-remotes.md), boot and plant switch: the module list response also carries the plant and its resolved presentation, and the plant switch swaps the presentation context together with the permission set and the per-plant Apollo client.
* [ADR 0035](0035-ai-provider-port-with-customer-configured-providers.md), assistant instructions: the one line of time context also carries the plant's three presentation values, and the caching test also compares two runs with different presentation values.
* [ADR 0055](0055-release-1-scope-under-option-b-and-the-scope-rule.md), ledger: Krister Johansson admitted the presentation settings to release 1 on 2026-10-05 as story E06-S13 "core: Set date, clock and number format per company and plant", blocked by E06-S08, E04-S07, E04-S04 and E07-S01. No release 1 story waits for it: until it lands, every screen shows the defaults. The review sized it as about one story on top of the E06-S08 kit and measured no raw-day estimate. E04-S07 builds the formatters with `DEFAULT_PRESENTATION`, so the formatters do not wait for E06-S13. For ADR 0055's scope rule and shaping check, this entry is the ledger row for E06-S13.

### Consequences

* Good, because every string is the same on every host and browser, so TIME6 and the format tests no longer depend on `LANG`, and the server, the station, the web and the assistant agree.
* Good, because a plant whose people write dates, clock times or numbers differently changes a setting, with history and audit from the settings kit, and no code changes.
* Good, because ADR 0023's "12,5" rule has a defined format and a refusal message that names the expected form.
* Good, because stored and transmitted values never change with the settings, so integrations, the audit export and the rollback CSV read the same under every presentation.
* Good, because the values arrive with the module list, so boot has no separate settings query or loading screen.
* Bad, because North American zones show as `GMT-4` in the DST label under en-GB.
* Bad, because month and weekday names stay English (`Tue 3 Nov`) under every setting until General Translation arrives.
* Bad, because the enums are closed: a plant that writes dates another way needs a new enum value with its literal test.
* Bad, because module authors cannot call `Intl` or `toLocale*String` directly; every format goes through the helpers.
* Bad, because a settings change reaches an open screen only on the next load, plant switch or reconnect.
* Neutral, because Monday weeks, ISO week numbers and the lack of display-unit preferences hold until their triggers, and user values wait for the user settings cascade.
* Neutral, because the theme choice does not follow a user to another browser.

### Confirmation

* `packages/contracts/src/format/plant-time.test.ts` (TIME6, moved from `packages/web-sdk/test/format-plant-time.test.ts`): in `Europe/Stockholm`, 2026-10-25T00:30Z and 01:30Z give `02:30 CEST` and `02:30 CET`; in `Europe/Helsinki` the same instants give `03:30 EEST` and `03:30 EET`; 2026-10-25T13:05Z gives `14:05` under `h23` and `2:05 pm` under `h12`; 2026-10-25T23:05Z gives `00:05`, never `24:05`.
* Locale leak leg: the format suite runs under `LANG=en_US.UTF-8` and `LANG=fi_FI.UTF-8`, and in a Playwright project with locale `en-US`, and every string is identical across the runs. Node takes its default locale from `LANG`: under `fi_FI`, `(1234.5).toLocaleString()` gives `1 234,5`.
* `packages/contracts/src/format/plant-date.test.ts`: 2026-10-25 gives `2026-10-25`, `25.10.2026`, `25/10/2026` and `10/25/2026` under the four `dateFormat` values; the `LocalDate` 2026-10-25 stays the 25th with zone `Pacific/Kiritimati` and with `Pacific/Pago_Pago`; the instant 2026-10-27T23:30Z gives 2026-10-28 in `Europe/Stockholm`; `parsePlantDate` refuses `2026-02-31`; `2026-10-25` parses under every format; `25/10/2026` is refused under `mdySlash`.
* `packages/contracts/src/format/number.test.ts`: 1234.5 gives `1 234,5` (U+00A0), `1,234.5` and `1.234,5`; -0.5 gives `-0,5` with U+002D under `spaceComma`; `parseNumber("12,5")` gives 12.5 under `spaceComma` (ADR 0023's case) and is refused under `commaPoint`, with the expected form in the message; both `1 234,5` and `1234,5` parse under `spaceComma`; `1,23,4` is refused under `commaPoint`.
* `packages/contracts/src/format/measure.test.ts`: 3600/420 s requested as `PIECES_PER_HOUR` prints `420` with the catalog symbol; `formatQuantity("123456789012.123456", ...)` keeps every digit; a value rounds to its unit's display decimals and drops trailing zeros.
* `packages/contracts/src/format/week.test.ts`: 2027-01-01 gives `2026-W53`, 2027-01-04 gives `2027-W01`, 2024-12-30 gives `2025-W01` and 2021-01-03 gives `2020-W53`.
* Every format test also runs with native Temporal and with `temporal-polyfill` forced, under `TZ=UTC`, `Europe/Stockholm` and `Pacific/Chatham` (the TIME7 legs), and the results are identical.
* `modules/core/test/presentation-settings.int.test.ts` (Testcontainers Postgres): a plant value overrides the company value per field; a field without a plant value returns the company value with source `company`; a field with neither returns the default with source `default`; a `timeZone` key is refused; a change bumps `config_revision` and writes one change row.
* `modules/core/test/settings.int.test.ts`: "a field without a plant value reports source company".
* `apps/server/test/rest/web-modules.int.test.ts`: `/api/web/modules?plant=p2` returns p2's `timeZone` and resolved presentation; a station cookie for p2 gets the same values.
* `packages/ui/test/date-time-text.test.tsx`: `DateTimeText` renders with the provider's values, and with `DEFAULT_PRESENTATION` outside a provider; it shows the zone label only when the browser zone differs from the plant zone.
* `cycle-time.test.ts` from ADR 0023: the "12,5" case runs under `spaceComma` and gives 12.5 s.
* Wire test: with the company set to `dmyDot`, `h12` and `commaPoint`, a GraphQL `Instant` field, an MCP tool result and the audit export are byte-identical to a run with the defaults.
* The assistant's caching test: the instructions string stays identical for two runs with different presentation values.
* Lint: a rule fails on `Intl.DateTimeFormat`, `Intl.NumberFormat`, `Intl.DurationFormat`, `toLocaleString`, `toLocaleDateString` and `toLocaleTimeString` outside `packages/contracts/src/format/`; a fixture remote that calls `toLocaleDateString()` or `new Intl.NumberFormat()` fails it. The import rule that fails when a web package imports `@northmes/sdk/units` stays.
* Playwright: the company uses `dmyDot` and plant P2 overrides it with `iso`; an order deadline shows `25.10.2026` at P1 and `2026-10-25` after switching to P2; the switch causes no document navigation when the module set is unchanged.

## Pros and cons of the options

### Three closed-enum settings with formatters on one pinned base locale

* Good, because the strings depend only on the value and the plant's settings, never on the host, the browser or the UI language.
* Good, because each enum value has one literal rendering that a test pins.
* Good, because the schema is one field set on the E06-S08 kit, so the form, the history and the audit come from the kit.
* Neutral, because the English text parts follow en-GB until General Translation arrives.
* Bad, because a new layout needs a code change and a new enum value.

### Formatting that follows the browser locale or the UI language

* Good, because nobody configures anything, and each person sees their own browser's conventions.
* Bad, because the UI language is English only ([ADR 0053](0053-translation-english-first-general-translation-later.md)), so Swedish users would see `4,320.5`, as the earlier attempt's report noted.
* Bad, because strings depend on the host: TIME6's `02:30 CEST` becomes `02:30 AM GMT+2` under en-US and `02.30 UTC+2` under fi-FI, and the server and the browser can print the same value differently.
* Bad, because ADR 0023's "12,5" rule still has no format: whether "1,234" means 1234 or 1.234 depends on the browser.

### The same formatters with fixed values, settings later

* Good, because release 1 saves the settings story; E04-S07 ships the same formatters with `DEFAULT_PRESENTATION`.
* Neutral, because the formatters and the wire rule are the same as in the chosen option, so the settings could arrive later as one story.
* Bad, because a plant whose people write dates, clock times or numbers differently has no switch until the trigger "a plant needs a different date or number format" brings E06-S13.

### Settings as in the earlier attempt

* Good, because a format pattern can express any layout.
* Bad, because ECMA-402 accepts no pattern strings, so patterns need Luxon, which [ADR 0024](0024-time-utc-instants-plant-wall-clock-temporal-and-the-clamp-resolver.md) rules out, or a pattern engine of NorthMES's own.
* Bad, because one typed column per setting, each with an `Effective*` wrapper type, an input field, a form control and a boot mapping, took 22 files and 822 lines for three module settings.
* Bad, because a separate blocking `EffectiveSettings` query at boot had its own loading screen.
* Bad, because a zone in the settings cascade and a user zone override put the board's "today" and its 6 to 18 window in a different zone from the shifts.
* Bad, because a `preferredUnits` setting per dimension that no screen read could be configured and had no effect.

## More information

* Related ADRs: [0035](0035-ai-provider-port-with-customer-configured-providers.md) (the time context line), [0019](0019-web-shell-with-react-module-federation-remotes.md) (boot and plant switch), [0022](0022-shared-building-blocks-packages-the-master-data-kit-settings-and-generators.md) (package map and settings), [0023](0023-si-units-with-a-northmes-unit-catalog.md) (units and the number input), [0024](0024-time-utc-instants-plant-wall-clock-temporal-and-the-clamp-resolver.md) (time, scalars and the lint), [0025](0025-plant-calendars-shift-patterns-and-the-production-day.md) (Monday anchors), [0045](0045-backups-restore-drills-upgrades-and-rollback.md) (the rollback CSV), [0051](0051-regulated-readiness-no-regret-rules.md) (rule 6), [0053](0053-translation-english-first-general-translation-later.md) (English first), [0055](0055-release-1-scope-under-option-b-and-the-scope-rule.md) (ledger and cut order).
* Plan: [04-data-and-platform.md](../plan/04-data-and-platform.md#settings-and-configuration) (settings) and [Time in the database](../plan/04-data-and-platform.md#time-in-the-database) (machine-readable output), [05-graphql-and-apis.md](../plan/05-graphql-and-apis.md#rest-endpoints-in-release-1) (`/api/web/modules`), [06-web-and-ux.md](../plan/06-web-and-ux.md) (time, numbers and units, shared web packages, the History tab, the plant switch, design tokens), [07-production-planning.md](../plan/07-production-planning.md#time-and-dst-rules) (TIME6 and TIME7), [09-operator-station.md](../plan/09-operator-station.md#44-screen-rules) (the quantity field), [10-ai-and-agents.md](../plan/10-ai-and-agents.md#plant-permissions-and-time) (the time context line), [14-roadmap.md](../plan/14-roadmap.md) (E04-S07, E06-S05, E06-S06, E06-S08 and E06-S13), [GLOSSARY.md](../../GLOSSARY.md) (presentation settings, plant time).
* Revisit when General Translation arrives (the base locale follows the UI language), when a plant needs Sunday or Saturday weeks or another week numbering, when Data collection adds physical dimensions or a pilot user asks for a column in another unit, and when the user settings cascade is built.
* Background: the presentation settings review of 2026-10-05, accepted by Krister Johansson with its recommended answers.
