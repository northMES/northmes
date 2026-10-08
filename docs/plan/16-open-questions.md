# Open questions

This document lists every open question in the release 1 plan, grouped by who answers it: the product owner, pilot IT together with the pilot's Pyramid administrator, and the maintainer (Krister). Each question has an id, the working default the plan and the code use until the answer arrives, the ADR or plan section it affects, and the date it is needed by when one is set. Tasks build on the working defaults, so a late answer changes a setting or a small piece of code rather than stopping work. License texts need legal review; legal questions are not tracked in this document. Questions that matter only when a regulated customer signs are in [15-regulated-readiness.md](15-regulated-readiness.md#open-questions).

## How answers are recorded

- Ids are stable: `PO-nn` for the product owner, `IT-nn` for pilot IT and the Pyramid administrator, `M-nn` for the maintainer. Issues and pull requests cite the id.
- When an answer arrives, the planning session records it in the affected ADR (clearing or updating its needs-confirmation), marks the row here as answered with the date, and adjusts the issues that depend on it. A task moves to Ready only when every ADR it links is accepted with no open needs-confirmation ([ADR 0001][adr-0001]).
- The product owner session takes place in week 1. Any product owner answer still missing on 2026-10-30 (checkpoint M0) becomes a plant or connector setting whose default is recorded in an ADR ([14-roadmap.md](14-roadmap.md)). A setting whose default is "not decided" is required when a plant is created, so no plant runs on a guessed value, and tests set it explicitly.
- The written request to the Pyramid administrator and the Pyramid reseller goes out on 2026-10-15 with the questions in [08-pyramid-connector.md](08-pyramid-connector.md#17-questions-for-the-pyramid-administrator).
- An answer that needs code rather than a setting goes to the next checkpoint in [14-roadmap.md](14-roadmap.md). Late answers are risk R-11 in [17-risks.md](17-risks.md).
- In the Affects column, a number names a plan document in this folder: 01 [product and scope](01-product-and-scope.md), 02 [architecture](02-architecture.md), 03 [modules and extensibility](03-modules-and-extensibility.md), 04 [data and platform](04-data-and-platform.md), 05 [GraphQL and APIs](05-graphql-and-apis.md), 06 [web and UX](06-web-and-ux.md), 07 [production planning](07-production-planning.md), 08 [Pyramid connector](08-pyramid-connector.md), 09 [operator station](09-operator-station.md), 10 [AI and agents](10-ai-and-agents.md), 11 [quality and testing](11-quality-and-testing.md), 12 [operations and security](12-operations-and-security.md), 13 [delivery and GitHub](13-delivery-and-github.md), 14 [roadmap](14-roadmap.md), 15 [regulated readiness](15-regulated-readiness.md); README is [README.md](README.md).

## Product owner

### Pilot and scope

| Id | Question | Working default until answered | Affects | Needed by |
|---|---|---|---|---|
| PO-01 | Which three to six pilot acceptance criteria apply (import, autoplan, move and lock on the board, write-back or a daily write-back report)? | The draft criteria in [01-product-and-scope.md](01-product-and-scope.md#pilot-acceptance-criteria-draft) | [0055][adr-0055], 01 | 2026-10-30 |
| PO-02 | Is double entry in Pyramid acceptable while write-back runs in shadow mode, and for how long? | Write-back runs in shadow mode with a daily write-back report to the planner until a write method is verified | [0032][adr-0032], 08 | 2026-10-30 |
| PO-03 | Do operators report in NorthMES or keep reporting in Pyramid? | Operators report at the NorthMES station. If they keep reporting in Pyramid, the station moves to a 0.x release and statuses and quantities arrive from Pyramid through `reportSourceProgress` (`operatorReportingSystem` setting) | [0033][adr-0033], 09, 08 | 2026-10-30 |
| PO-04 | Is the pilot confirmed as not regulated? | Not regulated; release 1 applies the no-regret rules | [0051][adr-0051], 15 | 2026-10-30 |
| PO-05 | Is a one-way, CLI-only switch to a regulated profile acceptable? | Release 1 ships only the standard profile; a later switch is one-way and CLI-only | [0051][adr-0051], 15 | before the first regulated sale |
| PO-06 | Is a validator that blocks releasing orders for customers with unpaid invoices wanted at all? | Not built; release 1 has no invoice data. The example validator on `planning.releaseProductionOrder` stays an example | [0037][adr-0037], 03 | |
| PO-07 | Does the pilot need Power BI or Excel access to NorthMES data? | No; the reporting schema waits | 04, 14 | |

### Planning rules

| Id | Question | Working default until answered | Affects | Needed by |
|---|---|---|---|---|
| PO-10 | Is the duration divisor the OEE target, another factor, or none? | The operation's OEE target (`planningFactorSource: oeeTarget`); retool time is never divided | [0027][adr-0027], 07 | 2026-10-30 |
| PO-11 | May a tool override an operation's cycle seconds? | No; a tool may override pieces per cycle only | [0027][adr-0027] | 2026-10-30 |
| PO-12 | Is lead time counted in calendar time or working time? | Elapsed calendar time (`leadTimeBasis: elapsed`) | [0027][adr-0027], 07 | 2026-10-30 |
| PO-13 | What does a deadline date mean: the start of that day or the end of the shift? | The start of that day in plant time (`deadlineRule: startOfDay`) | [0027][adr-0027], [0028][adr-0028], 07 | 2026-10-30 |
| PO-14 | Where does the send-ahead quantity (`StartNextAfterQuantity`) live? | On the releasing operation; lead time sits on the waiting operation | [0028][adr-0028], 07 | 2026-10-30 |
| PO-15 | Is the frozen window counted in elapsed hours, working hours, or through the end of the next production day, and how long is it? May overdue unstarted work jump it? | Elapsed hours; the value is not decided (`frozenHours` required per plant). Overdue rows stay free, keep their machine, are flagged overdue and are placed no earlier than now plus the frozen window | [0028][adr-0028], 07 | 2026-10-30 |
| PO-16 | Does autoplan apply its result directly, or write a proposal into the requester's draft? | Direct apply through `planning.commitScheduleChanges(source: autoplan)`; rows held in another planner's draft or under a live soft lock stay put and are listed as held | [0028][adr-0028], 07 | 2026-10-30 |
| PO-17 | Are child orders planned independently, with links set only by hand? | Yes. Imported orders plan by their ERP deadlines; a child a planner links plans right after its parent; no BOM explosion into child orders in release 1 | [0028][adr-0028], 07 | |
| PO-18 | Does `isLocked` live on the operation or the job order? What does operation priority do? How is the operator's job list sorted? | `isLocked` on the operation, as in Pyramid. Operation priority only breaks ties between operations competing for one machine and defaults to the order priority. The operator list sorts by planned start and shows priority | [0028][adr-0028], [0033][adr-0033], 07, 09 | |
| PO-19 | Which status transitions are allowed, and does order status follow operation status? | The transition table proposed in 07 | [0026][adr-0026], 07 | |
| PO-20 | May a planner split and move the unreported remainder of a started job? | Refused | [0033][adr-0033], 07, 09 | |
| PO-21 | Do paused job orders keep their machine and actual start? | Yes, like active job orders | [0028][adr-0028], 07 | |
| PO-22 | Does a second consecutive job order of the same article and operation on one machine carry its own setup? | Yes; each job order carries the full retool time | [0027][adr-0027], 07 | |

### Calendars and the production day

| Id | Question | Working default until answered | Affects | Needed by |
|---|---|---|---|---|
| PO-30 | What are the break times and night shift times at the pilot plant? | No code default; plant admins enter shifts and breaks as calendar data | [0025][adr-0025], 07 | 2026-10-30 |
| PO-31 | Which even and odd week rule applies? | An anchored N-week cycle; ISO week parity only as an explicit option, because 2026-W53 and 2027-W01 are both odd | [0025][adr-0025], 07 | 2026-10-30 |
| PO-32 | Does equipment overtime override plant-wide non-working time, or does non-working always win? | Scope first, then kind: an equipment deviation overrides a plant-wide one; within one scope non-working beats overtime, overtime beats break, break beats shift. If the old rule is kept, creating such a deviation returns the warning `OVERTIME_FULLY_CANCELLED` | [0025][adr-0025], 07 | 2026-10-30 |
| PO-33 | Do overtime nights carry breaks? | No; if they do, overtime deviations get an optional shift template | [0025][adr-0025], 07 | |
| PO-34 | Does a schedule in effect lock past deviations? | Not decided | [0025][adr-0025], 07 | |
| PO-35 | When does the production day start (00:00, 06:00 or 07:00), and can it change later? | Not decided; `production_day_start` is required per plant and validated against the zone's transitions. Versioned plant settings wait for the answer on later changes | [0025][adr-0025], 07 | 2026-10-30 |

### Drafts, locks and the board

| Id | Question | Working default until answered | Affects | Needed by |
|---|---|---|---|---|
| PO-40 | Are soft locks taken per production order or per operation? | Per production order: the first draft change to any job order of an order locks the whole order | [0029][adr-0029], 07 | 2026-10-30 |
| PO-41 | Who may break another planner's lock? | Admins hold `breakLock`; the planner role gets it when the product owner confirms (the product owner's earlier rule lets the blocked planner break the lock). Agents never hold it | [0029][adr-0029], [0010][adr-0010], 07 | 2026-10-30 |
| PO-42 | After how long does an idle soft lock expire? | Not decided; `softLockIdleExpiry` is required per plant. The board warns before expiry and offers a one-action extension | [0029][adr-0029], 07 | 2026-10-30 |
| PO-43 | May a planner save with confirmed conflicts, or are new overlaps refused? | Save returns the conflicts; the planner confirms them with a reason stored on the audit command row | [0029][adr-0029], 07 | 2026-10-30 |
| PO-44 | How many machines and job orders per week does the pilot plan? | Budgets use 40 machines, 500 orders and about 1 600 job orders over 8 weeks. The board spike measures max(2 x weekly job orders x 8 weeks, 5 000) blocks on 60 rows | [0030][adr-0030], [0028][adr-0028], [0018][adr-0018], 07 | before the board spike verdict, 2026-11-06 |
| PO-45 | Is "Pause live updates" on the board wanted? | Built as described in 06 and 07 | [0021][adr-0021], 06, 07 | |
| PO-46 | Do purchase requisitions (Pyramid `A` rows) count in the material warning, and how does the send-ahead quantity enter it? | Not decided; `countPurchaseRequisitions` is required per plant | [0028][adr-0028], 07, 08 | |
| PO-47 | What should resizing a block on the board mean for the pilot? | Resize is not in release 1; block length follows from quantity, rates and the calendar | [0030][adr-0030], 07 | |

### ERP and Pyramid

| Id | Question | Working default until answered | Affects | Needed by |
|---|---|---|---|---|
| PO-50 | Which fields does NorthMES own against the ERP, given the earlier answer "NorthMES is master"? | Per-field ownership: Pyramid owns quantity, deadline, customer and cancellation (imported, pending changes on touched orders, a "differs from ERP" flag); NorthMES owns the planning fields and writes them back. Live write-back cannot be selected until this is answered | [0031][adr-0031], 08 | before live write-back |
| PO-51 | How does an ERP quantity change spread over a production order's job orders? | The delta goes to the last not-started job order by planned start. A decrease below reported quantities, or an operation without a not-started job order, stays pending as "split by hand" | [0031][adr-0031], 07, 08 | |
| PO-52 | What happens to a Pyramid order that moves to another plant, or whose operations span two plants? | A row error: the order goes to the import inbox with a named reason and the existing order stays unchanged | [0032][adr-0032], 08 | |
| PO-53 | Who uploads Pyramid XML files? | Permission `pyramidConnector.import:upload` at company scope, held by admins only | [0032][adr-0032], 08 | |
| PO-54 | If Pyramid offers no write method by 2027-02-26, which path does the pilot take: a file export that Pyramid imports, a third-party REST bridge, or a pilot without ERP write-back? | Shadow mode with the daily write-back report | [0032][adr-0032], 08 | 2027-02-26 |

### Operator station

| Id | Question | Working default until answered | Affects | Needed by |
|---|---|---|---|---|
| PO-60 | Who may correct a report? | The operator role holds `productionStart.report:correct` for reports from the same station in the current production day; other corrections need the supervisor role | [0033][adr-0033], 09 | |
| PO-61 | Can several operators work one station at once, and does a job pause when the operator changes? | One open operator session per station; the job's state does not change when the operator changes | [0033][adr-0033], 09 | |
| PO-62 | Should a badge scan sign in from anywhere on the station screen ("scan anywhere")? | No; badge input is read only in the focused badge field and on the Switch operator screen. Scan anywhere would be a per-station setting with a toggle the operator sees | [0033][adr-0033], 09 | |
| PO-63 | Which rule applies when an operator changes a machine-prefilled quantity, and are there preset note reasons? | Release 1 rejects machine prefill; the changed-prefill note rule applies only to machine prefill. Preset note reasons are not decided | [0033][adr-0033], 09 | |
| PO-64 | Is an upgrade window between shifts, with paper reporting meanwhile, acceptable? | Upgrades run between shifts with a paper fallback form | [0045][adr-0045], [0033][adr-0033], 12 | before the pilot install |

### Master data, tenancy and roles

| Id | Question | Working default until answered | Affects | Needed by |
|---|---|---|---|---|
| PO-70 | Are codes case-insensitive? | Yes, through a stored `code_key` | [0009][adr-0009], 04 | before the first register migration |
| PO-71 | Does an archived row keep its code? | Yes | [0009][adr-0009], 04 | before the first register migration |
| PO-72 | Are operation tools company-level or plant-level? | Not decided; the span check covers both | [0009][adr-0009], 04 | |
| PO-73 | At which scope do customer order lines sit, and may one plant supply another plant's order line? | The header sits at company scope; a line sits at its delivering plant when known, otherwise at the company. Supply between plants is rejected in release 1 | [0007][adr-0007], 04, 07 | before the customer order migration |
| PO-74 | Who may edit roles and assign them, at which scope? | Editing roles needs `core.role:manage` at company scope. Assigning a role at a scope needs the assignment permission plus every permission of that role at that scope | [0010][adr-0010], 04 | |
| PO-75 | Does "pieces per hour" count pieces or cycles when one cycle makes several pieces? | Not decided | [0023][adr-0023], 04, 07 | |
| PO-76 | Which stock units does the pilot use? | Not set; each article's stock unit references a catalog code | [0023][adr-0023], 04 | |

### Data collection (later module)

| Id | Question | Working default until answered | Affects | Needed by |
|---|---|---|---|---|
| PO-80 | How long are raw pulses kept online, and may every pulse be stored with short ones counted separately (pulses below the valid cycle time count in pulses but not in valid pulses)? A 300-machine plant with 10 s cycles writes about 2.6 million pulse rows a day: about 21 GB for 90 days, about 92 GB for 400 days | 90 days, as a per-installation setting. Every pulse is stored, and pulses below the valid cycle time count in pulses but not in valid pulses. Pulse rollups keep pulses, valid pulses and pieces per minute for as long as rollups are kept | [0059][adr-0059], 04 | before Data collection is shaped |

## Pilot IT and the Pyramid administrator

### Pyramid

| Id | Question | Working default until answered | Affects | Needed by |
|---|---|---|---|---|
| IT-01 | Which method writes `PlannedStartTime`, `PlannedEndTime`, `IsLocked`, `ProductionStatusId` and `Priority` per operation row? With it: the WSDL, a test company endpoint, a user for NorthMES, the firewall path from the NorthMES host, and recorded request and response pairs (delivered only after the data processing agreement is signed) | Build order: file-mode import, then shadow write-back whose body matches recorded pairs, then live transport | [0032][adr-0032], 08 | method names 2026-11-13; endpoint or recorded pairs 2026-12-18; live write-back verified, target 2027-01-22 |
| IT-02 | Does Pyramid store written planned times verbatim, and how does it treat an end before its start? | Echo detection compares exact wire text; the formatter clamps an end earlier than its start; if Pyramid normalizes values, the first value read back after each write becomes the echo baseline | [0032][adr-0032], 08 | 2026-12-18 |
| IT-03 | Does any method accept order quantity and deadline, or started, finished and scrapped quantities? | Quantity and deadline are not written back; differences show as "differs from ERP" | [0031][adr-0031], 08 | 2026-11-13 |
| IT-04 | Is `CycleTime` per piece or per cycle? (One known operation with `QuantityPerCycle` above 1 and its planned times answers it.) | No default: the import refuses to map operations until `cycleTimeBasis` is set | [0032][adr-0032], 08 | before the first import |
| IT-05 | What are the units of `RetoolTime`, `LeadTime`, `LagTime`, `ExtendedTime` and `CycleTime`? | No defaults for unverified fields; the import refuses to run until they are set | [0032][adr-0032], [0023][adr-0023], 08 | before the first import |
| IT-06 | Is `EquipmentCode` a machine or a resource group? | Mapped as equipment by external code in the order's plant; unknown codes follow the auto-create setting | [0032][adr-0032], 08 | before the first import |
| IT-07 | Is `FinishedQuantity` good pieces only? Does a scrap field exist? Does any free field carry a second finished count, and how does it relate to `FinishedQuantity`? | Not decided; quantities are not written back unless a method accepts them | [0032][adr-0032], 08 | |
| IT-08 | Does this site model setup as separate operation rows? | A setup row followed by a production row on the same `EquipmentCode` is folded into the next operation's retool time; a connector setting keeps setup rows as their own operations | [0032][adr-0032], 08 | |
| IT-09 | Do status ids 1 to 6 have the meanings described for Pyramid? | The `statusMap` default in 08 | [0032][adr-0032], 08 | |
| IT-10 | When does the first import run, and when does write-back go from shadow to live? | The first import runs in file mode on a throwaway install and is reviewed there. Going live is an audited settings command that runs a reconcile of all open orders first | [0032][adr-0032], 08 | |

The remaining administrator questions (installation, polling rate, response sizes, material re-dating, list behaviour) are in [08-pyramid-connector.md](08-pyramid-connector.md#17-questions-for-the-pyramid-administrator).

### Planner PCs, stations and network

| Id | Question | Working default until answered | Affects | Needed by |
|---|---|---|---|---|
| IT-20 | Which PC model and browser do planners use? One PC of that class is needed for the board spike and the NVDA passes | None; the board spike verdict depends on it | [0030][adr-0030], [0021][adr-0021], 07 | week 1, by 2026-10-23 |
| IT-21 | Which OS and browser versions run on station and planner PCs? | Browser floor Chrome and Edge 111, Firefox 128, Safari 16.4; Windows 7 and 8.1 cannot run NorthMES | [0019][adr-0019], 06 | before go-live |
| IT-22 | Do operators wear gloves, what screen size do stations have, and which badge reader model is used? | `--nm-target-min` is 44 px at stations; burst rejection in number fields waits for the reader test | [0033][adr-0033], 09 | before the station design |
| IT-23 | Which network ranges do stations use? | `allowedCidrs` per station is optional and unset; a security event is written when a station key is used from a new source IP | [0033][adr-0033], 09 | before go-live |
| IT-24 | Which plant network ranges, which bind address, and which TLS option? | The customer's own CA is preferred, Caddy's internal CA is the fallback; plain HTTP is never served; Caddy publishes on `NORTHMES_BIND_IP` | [0044][adr-0044], 12 | before go-live |
| IT-25 | Which Linux VM: hypervisor, outbound internet, amd64? | An amd64 Linux VM with Docker Engine 29 or later and Compose 5 or later; installs from the offline image bundle when there is no internet | [0044][adr-0044], 12 | before the pilot install |
| IT-26 | Do stations sync time to a plant NTP source? | Every station syncs to the plant NTP source; clock skew above 5 s shows a warning on System health | [0043][adr-0043], 12 | before go-live |

### Operations and security

| Id | Question | Working default until answered | Affects | Needed by |
|---|---|---|---|---|
| IT-30 | Does a monitoring tool poll `/health/ready`, or does hostcheck mail state changes through an SMTP relay? | One of the two is a go-live gate; no in-app notification service is built | [0046][adr-0046], 12 | before go-live |
| IT-31 | Disk layout, backup disk, offsite target for the second backup repository, RPO and RTO; agreement that a hypervisor snapshot revert is not the database recovery path | A local backup repository on a backup disk and an encrypted offsite repository on the customer's NAS, SFTP or S3; proposed RPO 1 minute and RTO 2 hours. Decided together with the maintainer (M-14) | [0045][adr-0045], 12 | before go-live |
| IT-32 | Where is the escrow of recovery secrets kept? | One offline escrow kept in two places; each quarter a restore from the offsite repository uses only the escrowed material | [0047][adr-0047], 12 | before go-live |
| IT-33 | Which tool verifies the release bundle on the transfer machine: `gh`, cosign, or checksums? | `gh attestation verify` with the documented offline procedure | [0050][adr-0050], 12, 13 | before the pilot install |
| IT-34 | Does the pilot fall under the Swedish Cybersäkerhetslag (NIS2)? | Unknown; the multi-factor authentication choice (Microsoft Entra as sign-in provider, or Better Auth two-factor) waits for the answer | [0051][adr-0051], 15 | before go-live |
| IT-35 | Which AI provider and plan does the customer configure: OpenRouter with global processing, OpenRouter EU in-region routing, or Azure in an EU data zone? | OpenRouter with the customer's own key, data collection denied and zero data retention required | [0035][adr-0035], 10 | before the assistant is enabled |

## The maintainer

### Before M0 (2026-10-30)

| Id | Question | Working default until answered | Affects | Needed by |
|---|---|---|---|---|
| M-01 | The TypeScript 6.0.x pin. The Node pin is settled: the Node 26 test of 2026-10-07 passed every gated test, so ADR 0004 pins Node 26 | TypeScript 6.0.x | [0004][adr-0004], 02 | week 1, by 2026-10-23 |
| M-02 | Does the scheduling domain live as `@northmes/planning-domain` in `modules/planning/domain`? | Yes | [0057][adr-0057], 07 | before E03 is shaped |
| M-03 | Base UI as the primitive library; shadcn neutral tokens with the contrast fixes as the token base | Yes to both | [0020][adr-0020], 06 | before design task D1 |
| M-04 | The ledger additions, the epic order and first weeks, and gate batching | As in [14-roadmap.md](14-roadmap.md) and [13-delivery-and-github.md](13-delivery-and-github.md); gates answered twice a day | [0055][adr-0055], [0049][adr-0049] | 2026-10-30 |
| M-05 | Spike sources in `docs/sources/` and the list of ADRs E02 needs (the private companion repository exists since 2026-10-05) | As stated in [13-delivery-and-github.md](13-delivery-and-github.md#before-the-first-handoff-run) | [0049][adr-0049] | 2026-10-15 |
| M-06 | The lifecycle class of each table, and job orders as record class whether or not they carry reports | As in the lifecycle table in 04; job orders are record class, so `DELETE` and `TRUNCATE` on them are revoked and autoplan never recreates them | [0013][adr-0013], 04 | 2026-10-30 |
| M-07 | Do tool results sent to a model count as exports? | No; the AI call log records in-app tool use and MCP reads go to the structured log. If yes, one `ai.toolResultsSent` command per run is written | [0013][adr-0013], 10 | 2026-10-30 |
| M-08 | The placeholder email scheme for operators without an email address | An address under the reserved `.invalid` domain | [0010][adr-0010], 04, 09 | before the first identity migration |
| M-09 | The station's online-only promise in place of an outage queue | Unsent entries stay on the screen and in browser storage, are never sent without the operator pressing Send, and loss on device failure is accepted | [0033][adr-0033], 09 | 2026-10-30 |
| M-10 | `/mcp` off by default per installation, and personal access tokens before OAuth sign-in | Yes to both | [0034][adr-0034], 10 | 2026-10-30 |
| M-11 | Must Google Vertex and the Gemini API ship in release 1? | No; release 1 ships OpenRouter, Azure OpenAI and OpenAI-compatible servers, and each further provider comes in a 0.x release | [0035][adr-0035], 10 | 2026-10-30 |
| M-12 | Does a company user work one plant at a time? | Yes; every request from a plant route carries exactly one plant, requests from company settings at `/settings/$companyId` carry none ([0066][adr-0066]), and one planner can keep two plants open in two tabs | [0007][adr-0007], 04 | 2026-10-30 |
| M-13 | No version range override in 0.x; no third-party plugin on the pilot; web-only plugins on a removed slot degrade to `incompatible` instead of failing boot | Yes to all three | [0038][adr-0038], [0037][adr-0037], 03 | 2026-10-30 |
| M-14 | The pilot host's disk layout, decided with pilot IT (IT-31) | As in IT-31 | [0045][adr-0045], 12 | before go-live |
| M-15 | The persona list | Planner, Operator, Plant admin, Plugin developer, Maintainer, Hosting partner | [0049][adr-0049], README | 2026-10-30 |
| M-16 | The docs content license, the robots signal (Docs7's default `Content-Signal: ai-train=yes`), and a CAA record that admits Docs7's certificate authority under northmes.dev | Not decided; Docs7's defaults apply until then | [0048][adr-0048], 13 | before the docs site goes live |
| M-17 | When does the repository move to the `northMES` organization? | Spike SP0 is done: handoff's GitHub organization support is built and checked. The repository moves when Krister approves the transfer, before the first image is pushed to GHCR | [0050][adr-0050], 13 | before the first image push |
| M-18 | The release cadence | Monthly minor releases, patches as needed, no long-term support line before 1.0 | [0038][adr-0038], 13 | before the first release |
| M-19 | How do models the customer deploys in Azure outside Azure OpenAI reach NorthMES? | Release 1 supports Azure OpenAI deployments with key or Entra ID; other Azure-hosted models wait for a measured test | [0035][adr-0035], 10 | before the assistant is enabled |

### Delivery and review

| Id | Question | Working default until answered | Affects |
|---|---|---|---|
| M-20 | Does the pull request step wait for CodeRabbit while the repository has fewer than 10 stars? | It waits up to 30 minutes per push; Krister or the operating session posts `@coderabbitai review` | [0050][adr-0050], 13 |
| M-21 | Does the `main` ruleset require resolved review threads? | Yes; Krister resolves threads, or uses `@coderabbitai approve`, before requesting a merge | [0050][adr-0050], 13 |
| M-22 | Which format do requirement ids in tests take? | Until the maintainer fixes the format, a test name starts with the plan case id when one exists (TC1, CAL8) and otherwise with the story's plan id (E07-S05) | [0041][adr-0041], 11, 13, 15 |
| M-23 | Do contributors translate by hand with `gt generate` or through a General Translation account? | Decided before translation work starts; translation files are committed either way | [0053][adr-0053] |

### Design points from the plan documents

| Id | Question | Working default until answered | Affects |
|---|---|---|---|
| M-30 | Is `audit` its own module folder or a second schema inside core, and how do its migrations run before every module whose tables carry the capture trigger? | Not decided | [0013][adr-0013], [0002][adr-0002], 02, 03 |
| M-31 | Which modules ship a web remote? The Pyramid connector (integration card, import log, inbox, upload), the `ai` module (provider settings, usage, budgets) and the audit screens need their own remote or a slot in a module they depend on | Not decided; core cannot render another module's screens. 08 proposes a connector remote, `@northmes/pyramid-connector-web`. The onboarding wizard's ERP connection and AI steps render in these remotes | [0019][adr-0019], [0066][adr-0066], 02, 03, 06, 08 |
| M-32 | Does release 1 ship a dashboard with the slot `core/dashboard/widgets/v1`? | Not decided | [0019][adr-0019], 06 |
| M-33 | Does core or production-start own the scrap reason register? | Not decided; the register joins the onboarding wizard's stations step once its owner is named | [0033][adr-0033], [0066][adr-0066], 06, 09 |
| M-34 | Which server decimal library and GraphQL decimal scalar carry article quantities? | Not chosen; the list prototype uses a float filter only | [0023][adr-0023], 04, 05 |
| M-35 | One spelling for error codes (snake_case, camelCase or upper case)? | Settled before the first release, because codes are never renamed | [0012][adr-0012], 05, 09 |
| M-36 | The base of the problem `type` URI in REST errors | `https://docs.northmes.dev/errors/<errorCode>`; the docs site generates no error pages in release 1 | [0012][adr-0012], 05 |
| M-37 | How REST routes take the plant | Answered 2026-10-05 by Krister, who accepted ADR 0064: a plant-scoped public route takes the plant as a path segment, `/api/v<major>/<module-id>/plants/{plant}/...`, so the token's scope node check reads it before the handler runs and the OpenAPI document lists it as a required parameter. First-party routes keep their rules: `/api/v1/web/modules` takes `?plant=` and `/api/v1/ai/chat` carries the route's plant in the request | [0010][adr-0010], [0064][adr-0064], 05 |
| M-38 | The route for the audit export | Any export route uses the shared principal resolver and writes its command before streaming | [0013][adr-0013], 05 |
| M-39 | Does the shell or the core remote own the chat panel code? | Not decided; it mounts through the shell aside slot either way | [0035][adr-0035], 10 |
| M-40 | The exact manifest key names for table lifecycle classes, audit field declarations and subscriptions | Fixed in ADR 0003 | [0003][adr-0003], 03 |
| M-41 | Does the example validator drop its own table, or do the docs say plugin tables need the later plugin database API? | Not decided | [0037][adr-0037], 03 |
| M-42 | Planning proposals in 07: split as a draft change, the hard-lock command, the derived status rules, the deadline column split, and the lifecycle classes of `job_order_progress`, `plant_plan_state`, `autoplan_run` and proposal tables | As proposed in 07 | [0028][adr-0028], [0029][adr-0029], [0013][adr-0013], 07 |
| M-43 | Pyramid connector design points: the name of the planning event for status and progress changes; the lifecycle class of `pending_change`; what write-back sends for a setup row folded into retool; the minute rounding rule; the request timeout and write-back concurrency defaults | Not fixed; each is settled in the connector task that needs it. Ownership is settled: planning owns `customer_order`, `customer_order_line`, `stock_balance` and `planned_movement` ([07](07-production-planning.md)); the connector keeps `stock_row` as sent and calls `planning.replaceStockSnapshot` | [0031][adr-0031], [0032][adr-0032], 08 |
| M-44 | Data layer points: policies or allowlist entries on `core.event` and `core.inbox`; the audit surface value `northmes migrate` records; the database role the later `core.pseudonymizeUser` uses to write the `auth` schema | Decided in the outbox task, the migration runner task and when the command is built | [0014][adr-0014], [0013][adr-0013], 04 |
| M-45 | GraphQL limits and list details: final `maxCost` and depth limit; whether `hasPreviousPage` is exact when paging forward; a "hidden" marker instead of a typed `NOT_FOUND` for hidden related rows; the date persisted documents are enforced | 20 000 and 12 until measured; `after != null`; typed `NOT_FOUND`; generated now, enforced after the pilot | [0015][adr-0015], [0016][adr-0016], 05 |
| M-46 | AI provider details: which Entra token scope the pilot's Azure resource accepts; whether the Entra, Google and AWS token libraries honour proxy settings behind a plant proxy; which local model gives acceptable tool calling on hardware a plant would buy | A spike decides the scope; proxy behaviour is tested before a customer needs it; a measured test with the planning toolset picks the model | [0035][adr-0035], 10 |
| M-47 | Name of the instant filter input | `DateTimeFilter` over `Instant` values, as in the list prototype | [0016][adr-0016], 05 |
| M-48 | The restore drill switch skips integration crons and forces Pyramid shadow mode through an environment flag, while rule 6 of ADR 0051 keeps behaviour settings out of environment variables. May the drill switch stay an environment flag? | Not decided; the drill copy runs on an internal network with no egress either way | [0045][adr-0045], [0051][adr-0051], 12 |
| M-51 | The codes for request errors on REST routes: malformed JSON (400) and the transport errors 413, 415 and 429 | Answered 2026-10-05 by Krister: `core.request.malformed` (400), `core.request.too_large` (413), `core.request.unsupported_media_type` (415) and `core.request.rate_limited` (429, with `Retry-After`) | [0012][adr-0012], 05 |
| M-52 | The correlation id header, and whether an id set by Caddy is trusted | Answered 2026-10-05 by Krister: the server creates a uuidv7 per request, ignores any client or proxy value and returns it in `x-northmes-correlation-id` | [0046][adr-0046], 05 |
| M-53 | Do the CLI commands that create users or set passwords (`northmes company create`, `company add-admin` and `admin reset-password`; `admin create` until [ADR 0066][adr-0066] replaced it) need the Better Auth secret in the migrate container, which today receives only `db_owner_password`? | Answered 2026-10-05 by Krister: they run with the migrate configuration; if Better Auth needs its secret to create a user, the migrate service also receives `auth_secret` | [0060][adr-0060], [0011][adr-0011], [0047][adr-0047], 12 |
| M-54 | Which REST routes carry the API version segment? | Answered 2026-10-05 by Krister: every REST route lives under `/api/v<major>/`, the first-party routes included. Under ADR 0064, which Krister accepted, Better Auth uses `basePath` `/api/v1/auth`. Public routes, `/api/v<major>/<module-id>/...`, carry the compatibility promise and are the only routes in the OpenAPI document; first-party routes carry none and move to the next major in the same release as the public API. `/health`, `/health/live`, `/health/ready`, `/graphql`, `/mcp`, `/modules/<id>/<version>/*`, `/assets/*` and the SPA paths stay at the root | [0064][adr-0064], [0011][adr-0011], 02, 05, 12 |
| M-55 | Does an SDK helper or Nest's global prefix with URI versioning put the version in the path? | Answered 2026-10-05 by Krister, who accepted ADR 0064: one SDK helper, `ApiController({ module, family })`, builds the path, with no Nest global prefix and no URI versioning. The boot route check reads its metadata | [0064][adr-0064], 02, 03, 05 |
| M-56 | Does release 1 build the OpenAPI pipeline? | Answered 2026-10-05 by Krister: no. Under ADR 0064, which Krister accepted, release 1 reserves the module ids `web`, `station` and `auth` and the plant slugs `api`, `graphql`, `mcp`, `health`, `modules`, `assets` and `station`, and adds the boot route check. `@nestjs/swagger`, zod-openapi, `schema/openapi-v1.json`, the oasdiff gate, `GET /api/v1/openapi.json` and integration tokens arrive with the first public route | [0064][adr-0064], [0055][adr-0055], 02, 05, 06, 11 |
| M-57 | May plugins add REST controllers? | Answered 2026-10-05 by Krister: not until the public API exists; then only public routes under `/api/v<major>/<plugin-id>/` | [0064][adr-0064], [0037][adr-0037], 03 |
| M-58 | How does a company get a company admin back when its last one is removed or banned? | Answered 2026-10-05 by Krister: the command line tool on the host is the recovery path, and the same tool creates each company's first company admin. Under ADR 0066 the command is `northmes company add-admin`, which assigns core's company admin role to an existing or a new user | [0066][adr-0066], [0010][adr-0010], 04, 12 |
| M-59 | Is `/admin` the path of the admin mount, with `admin` a reserved plant slug? | Answered 2026-10-06 by Krister: yes. `/admin` is the path of the admin mount, and `admin` is a reserved plant slug. Replaced on 2026-10-08: Krister chose option C of the #313 variations round, so company settings at `/settings/$companyId` replace the admin mount and `settings` is a reserved plant slug; `admin` stays reserved while that round's question 3 is open | [0066][adr-0066], [0064][adr-0064], 06 |
| M-60 | Who sets the installation-wide settings (the outbound URL allowlist, the `/mcp` switch, the security event retention, and later the event log retention) now that no role sits above a company? | Answered 2026-10-06 by Krister: `northmes installation set` on the host sets them. Under ADR 0066 each change is a command with the system principal `core.cli`, a required reason and a security event | [0066][adr-0066], [0034][adr-0034], [0047][adr-0047], 04, 05, 12 |
| M-61 | Does core's company admin role hold every installed permission, plugins' included, so that its holder can assign every role and do every onboarding step? | Yes; the permission sync in `northmes migrate` keeps it complete | [0066][adr-0066], [0010][adr-0010], 04 |
| M-62 | Do the nine release 1 pieces of ADR 0068 (slot kinds, the aside id, contributions as manifest data, `validates`, `consumes`, veto details, the plugin inventory, slot kinds in the snapshot, the `northmes-plugin` skill) enter the ADR 0055 ledger? | Yes, because each piece has a release 1 reader in the task that adds it; each row stays not estimated until its reader's stories are created | [0068][adr-0068], [0055][adr-0055], 03, 06, 14 |
| M-63 | Does the AI budget banner come from the `ai` module, as the first contribution to `core/shell/banners/v1`? | Yes if M-31 gives the `ai` module its own remote; otherwise the shell draws the budget banner itself from `BannerSpec` data and the slot waits | [0068][adr-0068], [0035][adr-0035], 06, 10 |
| M-64 | Does the shell draw top bar items from data (the `item` slot kind), which changes the top bar slot of ADR 0067? | Yes: a contribution supplies an icon name, a badge hook and a content component, and the shell draws the button named "{label}, {badge text}", its popover, and in the navigation sheet a button in the footer after the help menu that opens the content in a sheet, as D2 draws the bell at 320 px | [0068][adr-0068], [0067][adr-0067], 06 |
| M-65 | Do plugin permissions reach users through roles only, with no direct grant of one permission to a user? ADR 0066 lists roles only among Krister's decisions of 2026-10-05; this asks whether the plugin model keeps it | Yes; a one-off grant becomes a custom role with one permission, so every grant appears in the role list and its audit | [0068][adr-0068], [0066][adr-0066], [0010][adr-0010], 03, 04 |
| M-66 | May the notifications module declare plant-free fields, so that its bell works on company settings pages? | Decided when the notifications module is shaped; until then only core declares plant-free fields ([0066][adr-0066]) | [0068][adr-0068], [0066][adr-0066], [0067][adr-0067], 05, 06 |
| M-67 | Do the `command.rejected` security event and the validator ids and versions on the audit row wait for the first regulated sale? | Yes; until then a veto leaves no row, because a rejected command rolls back ([0012][adr-0012]). The event would reuse the separate connection that `permission.denied` uses ([0013][adr-0013]) | [0068][adr-0068], [0051][adr-0051], [0013][adr-0013], 15 |
| M-68 | Does ADR 0068 join the ADRs to accept before the walking skeleton's validator story (E02-S04) moves to Ready? | Yes; the alternative builds pieces 4 and 6 of ADR 0068 after the skeleton and keeps the veto shape of ADR 0037 until then | [0068][adr-0068], [0037][adr-0037], [0055][adr-0055], 03, 14 |

### Later modules

| Id | Question | Working default until answered | Affects | Needed by |
|---|---|---|---|---|
| M-50 | Is it right that the project builds and tests no TimescaleDB backend for Data collection, with or without the Timescale License? | Yes. Plain Postgres is the default backend, and `citus_columnar` and ClickHouse are the optional adapters. A third party may write a TimescaleDB adapter against the MIT port outside the NorthMES repository and images | [0059][adr-0059], 01, 04 | before Data collection is shaped |

[adr-0001]: ../adr/0001-record-architecture-decisions-in-madr.md
[adr-0002]: ../adr/0002-modular-monolith-with-module-owned-schemas-and-process-roles.md
[adr-0003]: ../adr/0003-module-package-shape-and-the-definemodule-manifest.md
[adr-0004]: ../adr/0004-monorepo-tooling-pnpm-turborepo-node-and-typescript-versions.md
[adr-0007]: ../adr/0007-tenancy-company-plants-and-the-scope-tree.md
[adr-0009]: ../adr/0009-code-uniqueness-per-scope-with-an-exclusion-constraint.md
[adr-0010]: ../adr/0010-identity-with-better-auth-roles-and-permissions-in-core-tables.md
[adr-0012]: ../adr/0012-commands-as-the-single-write-path.md
[adr-0013]: ../adr/0013-audit-trail-written-in-the-command-transaction.md
[adr-0014]: ../adr/0014-outbox-event-log-and-pg-boss-jobs.md
[adr-0015]: ../adr/0015-graphql-federation-inside-one-process-with-an-embedded-hive-gateway.md
[adr-0016]: ../adr/0016-graphql-list-conventions-connections-relations-filter-sort-search-and-group-by.md
[adr-0018]: ../adr/0018-realtime-subscriptions-over-graphql-ws-fed-by-the-event-tail.md
[adr-0019]: ../adr/0019-web-shell-with-react-module-federation-remotes.md
[adr-0020]: ../adr/0020-frontend-libraries-tanstack-router-apollo-client-4-shadcn-ui-and-forms.md
[adr-0021]: ../adr/0021-accessibility-target-wcag-2-2-aa.md
[adr-0023]: ../adr/0023-si-units-with-a-northmes-unit-catalog.md
[adr-0025]: ../adr/0025-plant-calendars-shift-patterns-and-the-production-day.md
[adr-0026]: ../adr/0026-planning-domain-names-aligned-with-isa-95.md
[adr-0027]: ../adr/0027-planned-duration-formula-and-override-precedence.md
[adr-0028]: ../adr/0028-autoplan-as-a-pure-deterministic-function.md
[adr-0029]: ../adr/0029-per-planner-drafts-soft-locks-and-the-plan-revision.md
[adr-0030]: ../adr/0030-a-planning-board-built-in-house.md
[adr-0031]: ../adr/0031-erp-integration-connector-modules-field-ownership-and-pending-changes.md
[adr-0032]: ../adr/0032-pyramid-connector-polling-file-mode-and-shadow-write-back.md
[adr-0033]: ../adr/0033-online-operator-station-in-the-production-start-module.md
[adr-0034]: ../adr/0034-mcp-surface-one-endpoint-a-read-mostly-planning-toolset.md
[adr-0035]: ../adr/0035-ai-provider-port-with-customer-configured-providers.md
[adr-0037]: ../adr/0037-plugins-drop-in-packages-command-validators-and-ui-slots.md
[adr-0038]: ../adr/0038-versions-and-releases-lockstep-0-x-release-please-api-reports.md
[adr-0041]: ../adr/0041-test-strategy-tdd-vitest-projects-testcontainers-and-playwright.md
[adr-0043]: ../adr/0043-health-endpoints-graceful-shutdown-and-the-system-health-page.md
[adr-0044]: ../adr/0044-on-prem-deployment-with-docker-compose-and-mandatory-tls.md
[adr-0045]: ../adr/0045-backups-restore-drills-upgrades-and-rollback.md
[adr-0046]: ../adr/0046-observability-structured-logs-host-checks-and-optional-opentelemetry.md
[adr-0047]: ../adr/0047-secrets-and-the-installation-key.md
[adr-0048]: ../adr/0048-documentation-on-docs7-at-docs-northmes-dev.md
[adr-0049]: ../adr/0049-delivery-workflow-handoff-thin-vertical-slices-and-claude-design-per-task.md
[adr-0050]: ../adr/0050-github-organization-rulesets-ci-runners-and-supply-chain.md
[adr-0051]: ../adr/0051-regulated-readiness-no-regret-rules.md
[adr-0053]: ../adr/0053-translation-english-first-general-translation-later.md
[adr-0055]: ../adr/0055-release-1-scope-under-option-b-and-the-scope-rule.md
[adr-0057]: ../adr/0057-scheduling-domain-as-a-pure-package-in-the-planning-module.md
[adr-0059]: ../adr/0059-time-series-storage-port-with-an-open-default-backend.md
[adr-0011]: ../adr/0011-principals-credentials-and-same-origin-rules.md
[adr-0060]: ../adr/0060-configuration-with-nestjs-config-one-zod-environment-schema-and-secret-files.md
[adr-0064]: ../adr/0064-rest-routes-under-api-v1-and-openapi-from-zod-contracts.md
[adr-0066]: ../adr/0066-companies-created-by-the-cli-plant-slugs-unique-per-installation-company-settings-at-settings-and-an-onboarding-wizard-before-a-plant-opens.md
[adr-0067]: ../adr/0067-plant-switcher-across-companies-nav-icons-by-lucide-name-and-a-top-bar-slot.md
[adr-0068]: ../adr/0068-extension-points-declared-by-their-owners-contributions-as-manifest-data-with-code-by-id-and-a-plugin-inventory.md
