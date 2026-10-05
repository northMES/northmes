# Glossary

This glossary fixes the words NorthMES uses for its domain. Use these terms in code names, test names, issue titles, ADRs and the UI. Each entry gives the term (code name first, UI label in parentheses where it differs), a one- or two-sentence definition, the word an ERP uses for the same thing where one exists, and the words to avoid. Rules and decisions live in the plan ([docs/plan](docs/plan/README.md), especially [07-production-planning.md](docs/plan/07-production-planning.md)) and the ADRs ([docs/adr](docs/adr/README.md)); this file holds meanings only.

## Company and plants

| Term | Definition | Avoid |
|---|---|---|
| `company` (Company) | The business that uses NorthMES and owns its plants, master data and customers. Better Auth calls it an organization; ISA-95 calls it the enterprise. | tenant; organization outside the auth module |
| `plant` (Plant) | One production site of a company, with its own time zone, machines, calendars and production orders. ISA-95 calls it a site; ERPs often tell plants apart by warehouse or department. | site, factory, location |
| `scope` | A node in the scope tree (company, plant, and later area and line) that a row, a code and a role assignment belong to. | level, tenant |
| installation | One NorthMES deployment: one database and one image version, serving one customer that may hold several companies. It is not a scope, and no role is held at it; the people who run the host create its companies with the CLI. | instance, tenant, site |
| plant setup (Setup) | The steps of the setup wizard that a new plant goes through, such as its calendar and its first machine, before planners, operators and stations can use it. A plant whose setup is complete is open, and an open plant never closes again. It is not the setup of a job order (see setup under Rates and durations). | onboarding, provisioning |
| plant time | The wall-clock time in the plant's time zone, which every screen shows with a zone label when the browser zone differs from the plant zone. | local time (ambiguous), server time |
| presentation settings | The company and plant settings that decide how dates, clock times and numbers are shown and typed: the date format, the hour cycle and the number format in `core.presentation`. Stored and transmitted values never change with them, and the plant's time zone is not one of them. | locale (NorthMES pins one base locale), regional settings, display preferences |

## Master data

| Term | Definition | Avoid |
|---|---|---|
| `article` (Article) | Something the company makes or consumes, identified by its article number. Pyramid calls it an article (`ArticleNumber`); ISA-95 calls it a material definition. | item, product, material (material means a consumed component) |
| stock unit | The unit an article's quantities are counted in, such as pieces, metres or litres. | UoM, measure |
| `routing` (Routing) | The ordered list of operations that makes one article. ISA-95 calls it an operations definition. | recipe, BOM |
| `routingOperation` (Operation) | One step of a routing, with its cycle time, rates, retool time, lead time and send-ahead quantity. ISA-95 calls it an operations segment; Pyramid sends the same values on each order row. | operation template, step |
| `operationEquipment` (Machines for operation) | A machine that may run a routing operation, optionally with its own rates. | machine assignment, routing resource |
| `operationTool` (Tools for operation) | A tool that may be used for a routing operation, optionally with its own pieces per cycle. Pyramid can send the tool in a `CustomData` free field that the connector's field mapping names. | |
| `operationMaterial` (Material) | An article that an operation consumes, with its quantity. Pyramid lists these under `BillOfMaterials` on each order operation. | BOM line, component |
| `equipmentGroup` (Equipment group) | A named, colored group of equipment, shown as a group of rows on the board. Pyramid calls it an equipment category (`EquipmentCategory`); ISA-95 calls it an equipment class. | work center, category |
| `equipment` (Machine) | Something that runs operations or is measured: usually a machine, sometimes a building, a lift or a truck. Pyramid identifies it by `EquipmentCode`. | work center, resource, lane |
| plannable equipment | Equipment marked plannable or OEE-measured, which therefore appears on the planning board. Pyramid has the flags `IsPlannable` and `IsOee`. | active machine |
| `tool` (Tool) | A tool or mould an operation may use, which can change how many pieces one cycle makes. | fixture |
| `warehouse` (Warehouse) | A stock location in a plant that holds balances of articles. Pyramid identifies it by a warehouse code. | storage location (a finer level, later), bin |
| `customer` (Customer) | A buyer of the company's products, identified by customer number. Pyramid sends it as `Customer/ExternalId` and `CustomerName`. | client, account |
| external reference | The identifier an ERP uses for a row, kept verbatim as text, such as Pyramid's `OrderNumber` or `ProductionOrderNumber`. | ERP id, ERP number |
| external data | Free fields an ERP sends with a row, kept as sent for display. Pyramid calls them `CustomData`. | custom fields, extra data |
| do not update | A flag on an imported row that stops later imports from changing it. | locked (that is the hard lock) |

## Orders

| Term | Definition | Avoid |
|---|---|---|
| `customerOrder` (Customer order) | A customer's order, identified by its order number and optionally by the customer's own order number. Pyramid sends it as `CustomerOrderNumber`. | sales order (in code) |
| `customerOrderLine` (Line) | One article and quantity on a customer order, with an expected delivery date. Pyramid shows open lines as stock rows of type O. | order row |
| `productionOrder` (Production order) | An order to make a quantity of one article by a deadline at one plant; it may supply customer order lines or be a stock order. Pyramid calls it a manufacturing order (`OrderNumber`); earlier NorthMES documents called it a batch. | batch, lot, work order |
| stock order | A production order that supplies no customer order line. | make-to-stock order |
| `productionOrderDemand` (Demand) | The link that says which customer order lines a production order supplies, and how much of each. Planning tools call this pegging. | allocation (kept for stock reservations), reservation |
| `productionOrderOperation` (Operation) | One operation of a production order, copied from the routing when the order is released, with its own status, priority and hard lock. Pyramid identifies it by `ProductionOrderNumber`, such as `1001.20`, where the part after the dot is the ERP's order row number. | batch, order row in code |
| release | The step that copies an article's routing into a production order, recording which routing operation and which version each copy came from. | publish, launch |
| `jobOrder` (Job) | The part of one production order operation's quantity that runs on one machine; one block on the planning board. Earlier documents and the product owner's description call it a batch row; ISA-95 calls it a job order. | batch row, batch, job in code, task |
| deadline | The time by which a production order must be finished. When an ERP sends only a date, the plant's deadline rule turns it into a time. Pyramid sends `DeadlineDate`. | due date, delivery date (that belongs to the customer order line) |
| priority | A number that orders production orders with the same deadline; a lower number goes first. Pyramid sends `Priority`. | rank, urgency |
| status | Where a production order, operation or job order stands: registered, planned, active, paused, finished, delivered or cancelled. Pyramid uses `ProductionStatusId` 1 to 6 for the first six. | state (in UI text) |

## Rates and durations

| Term | Definition | Avoid |
|---|---|---|
| cycle time | The time one machine cycle takes, entered as seconds or as pieces per hour. Pyramid sends `CycleTime`. | takt time, piece time |
| pieces per cycle | How many pieces one cycle makes, for example the number of cavities in a mould. Pyramid sends `QuantityPerCycle`. | parts per cycle, multiplier |
| cycles per piece | How many cycles one piece needs. | strokes |
| retool time | The time to set a machine up for an operation before the first piece. Pyramid sends `RetoolTime`, and some sites send setup as a separate row named "Ställtid". | changeover, toolchange |
| fixed time | A duration added to an operation whatever the quantity. Pyramid sends it as `ExtendedTime`. | extra time |
| setup | The first part of a job order: retool time plus fixed time. | preparation |
| run | The part of a job order after setup, when pieces are made. | production time |
| planning factor | The divisor that stretches run time from the ideal machine speed to the expected real speed; by default the operation's OEE target. | efficiency, speed factor |
| OEE target | The target overall equipment effectiveness of an operation, as a fraction. Pyramid sends `Oee` as a percentage. | expected OEE |
| planned duration | The working time a job order needs: setup plus run, laid over the machine's working time. | length |
| lead time | The wait that must pass after the previous operation before this operation may start, such as cooling; it belongs to the waiting operation. Pyramid sends `LeadTime` on the waiting operation and `LagTime` on the previous one for the same kind of wait. | lag time, queue time, wait time |
| send-ahead quantity | The number of pieces an operation must have made before the next operation may start. Pyramid calls it `StartNextAfterQuantity`. | start-after quantity, transfer batch |

## Calendars and time

| Term | Definition | Avoid |
|---|---|---|
| calendar | The shift patterns and deviations that give equipment its working time. ISA-95 calls it a work calendar. | schedule |
| calendar version | A calendar's shift pattern from an effective date onward; it cannot change once in effect. | schedule version |
| shift pattern | The repeating set of shifts and breaks of a calendar version, over one week or several. | rota (crew rotation is HR planning) |
| shift | A working period on a weekday; it may cross midnight and belongs to the date it starts. | crew, team |
| break | A non-working period inside a shift. | pause (that is a job order status) |
| deviation | A dated exception to the shift pattern: overtime or non-working time, for one machine or for the whole plant. | exception, holiday (a holiday is one kind of deviation) |
| availability | The working time of one machine over a period, after shifts, breaks and deviations. | capacity (capacity also counts load) |
| production day | The plant's working day for daily figures, starting at the plant's production day start; a night shift belongs to the production day it started on. | calendar day, shift day |
| clamp rule | The rule for local times around clock changes: a time that does not exist resolves to the end of the gap, and a repeated time to its first occurrence. | compatible mode |

## Planning work

| Term | Definition | Avoid |
|---|---|---|
| plan | The committed placements of all job orders at a plant. | schedule |
| draft | One planner's own changes to the plan at one plant, kept on the server until the planner saves or discards them. | sandbox, scenario, shared draft |
| Save | Committing the whole draft at once. | publish |
| soft lock | A claim on a production order by the planner whose draft changes it; other planners cannot move its job orders until it is saved, expires or is broken. | lock (alone), checkout |
| hard lock | The locked flag on a production order operation, which stops planners and autoplan from moving its job orders. Pyramid sends it as `IsLocked`. | pin, freeze |
| plan revision | A counter per plant that grows with every committed change to placements, locks, quantities, deadlines or statuses. | plan version |
| autoplan | The automatic placement of a plant's free job orders, backward from their deadlines, that a planner starts. | optimizer, solver, auto-schedule |
| autoplan run | One execution of autoplan for one plant, with its status and result. | autoplan job (the queue entry behind it) |
| frozen window | The time from now to a set number of hours ahead, inside which autoplan keeps job orders on their machine and in their order. Planning tools call it a time fence. | freeze, frozen (alone) |
| frozen by reports | Said of a job order that carries operator reports, which is therefore never deleted or recreated. | frozen (alone), locked |
| fixed job order | A job order autoplan does not place: finished, started, paused, hard-locked, inside the frozen window or held. | locked |
| held | Said of the job orders of a production order under another planner's live soft lock, which autoplan leaves in place. | locked |
| overdue | Said of a job order that has not started although its planned start has passed. | late (that is about the deadline) |
| late | Said of a production order whose planned end is after its deadline. | overdue, delayed |
| conflict | A broken planning rule, such as two job orders overlapping on one machine, that NorthMES reports and does not repair by itself. | error, clash |
| material warning | A flag on a job order whose operation consumes an article whose projected stock falls below zero at that time. | shortage error |
| stock balance | The quantity of an article in a warehouse at a point in time. Pyramid sends it as `StockQuantity`. | inventory |
| planned movement | A dated future change to an article's stock in a warehouse: a purchase, a purchase requisition, a consumption, an output, a customer demand or a transfer. Pyramid sends them as stock rows of type I, A, T, R, O, M and N. | transaction |
| proposal | A set of suggested job order moves that an AI agent writes for one planner, who alone can accept them into a draft. | suggestion, AI plan |
| planning board (Board) | The screen with one row per machine and job orders as blocks along a time axis. | Gantt (a project Gantt has one task per row) |
| block | A job order as drawn on the planning board. | bar, card |
| job order table view | The table of job orders with the same filters and actions as the board. | list view |

## ERP integration

| Term | Definition | Avoid |
|---|---|---|
| connector | A module that links one ERP to NorthMES, importing its data and writing planning results back. | plugin, adapter, integration (alone) |
| import | Reading orders, operations, materials and stock from an ERP into NorthMES. | sync (outside the Sync now label) |
| Sync now | The connector action that queues an order poll and a stock poll at once, outside the polling schedule; its permission is `pyramidConnector.import:sync`. This UI label and its permission are the one allowed use of the word sync; elsewhere write import or poll. | sync (alone) |
| write-back | Sending NorthMES planning results (planned times, locks, statuses, priority) back to the ERP. | export, push |
| shadow mode | A write-back mode in which NorthMES computes and logs what it would send but sends nothing. | dry run, test mode |
| echo | A value read from the ERP that equals what NorthMES last sent, and is therefore not a change. | |
| touched order | A production order with a committed planner change, a live soft lock or a started job order; an expired draft change does not count. | edited order |
| pending change | An ERP change to a touched production order, held until a planner accepts it. | conflict, ERP conflict |
| import inbox | ERP rows that could not be imported, waiting for a person to fix or assign them. | error queue |

## Shop floor

| Term | Definition | Avoid |
|---|---|---|
| station | A device at one or more machines where operators sign in and report their work. | terminal, kiosk |
| operator session | The period an operator is signed in at a station. | login |
| report | A recorded shop-floor fact about a job order: start, pause, finish, or good and scrap quantities. A report is never edited. | booking, confirmation |
| correction | A new report that adjusts the quantities of an earlier report, with a reason. | edit, adjustment |
| good quantity | Pieces reported as made and usable. Pyramid sends `FinishedQuantity`. | yield |
| scrap quantity | Pieces reported as made and unusable, each with a scrap reason. | waste, reject |
| scrap reason | A coded cause of scrap that the customer defines. | defect code |

## Platform words the plan relies on

| Term | Definition | Avoid |
|---|---|---|
| module | A part of NorthMES with its own data, server code and screens, such as core, planning or the Pyramid connector. | service, app |
| plugin | A module that is installed into NorthMES without being part of the core repository's release. | extension, add-on |
| command | A named write with a validated input; every change to data in NorthMES is one command. | mutation (that is its GraphQL form), action |
| command validator | Plugin code that can veto a command before it runs. | interceptor, hook |
| slot | A named place in a screen where another module or a plugin renders content. | extension point (in UI context) |
| background job | A unit of work in the job queue, such as an autoplan run or a write-back. It is not a job order. | job (alone, when a job order is meant), task |
| public API | The REST routes under `/api/v<major>/<module-id>/` that outside systems call with an integration token. They carry the compatibility promise and are the only routes in the OpenAPI document; release 1 has none. Earlier documents call it the integration REST API. | REST API (alone; first-party routes are REST too) |
| first-party route | A REST route under `/api/v<major>/` that only the shell, the remotes and the stations of the same image call, such as `/api/v1/web/modules`. It shares the version segment with the public API but carries no compatibility promise and never appears in the OpenAPI document. | internal API, private API |
| route family | The class a REST route under `/api/v<major>/` belongs to: public API, first-party route, or the library routes of Better Auth under `/api/v1/auth/`. Health, `/graphql`, `/mcp`, static mounts and SPA paths are root routes outside the families. | |
