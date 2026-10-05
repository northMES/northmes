---
status: "accepted"
date: 2026-10-05
decision-makers: "Krister Johansson"
consulted: "internal research notes 09, 10, 16, 34 and 35"
informed: "product owner, contributors and coding agents"
release: "1"
needs-confirmation: "product owner (pieces per hour)"
---

# SI units with a NorthMES unit catalog

## Context and problem statement

Planning stores durations (cycle, retool, lead and fixed time), ratios (OEE target, planning factor) and article quantities. Later modules add temperatures, pressures, flows and machine signals. Krister Johansson decided that metric data is stored in SI units with conversion on the server, that NorthMES owns a small unit catalog with stable codes, exact factors, UNECE and UCUM codes instead of using `convert-units`, that absolute temperature is stored in degree Celsius and temperature differences in kelvin, and that article quantities stay in the article's own stock unit as `numeric(18,6)`.

An earlier MES attempt took its unit list, enum names and symbols from `convert-units` 3.0.0-beta.8, which has been in beta since June 2021. Its factors are not exact (1 inch converted to 0.0253999991872 m, 1 kgf to 9.807 N), its names leaked into the API and into stored rows, it had no temperature difference dimension, and a cycle-time helper rounded at storage, so 1 574 of the integer rates from 1 to 10 000 pieces per hour did not read back as entered.

This ADR covers the catalog, the server-side converter, column types and names, the GraphQL shape of measured fields, display rounding and the connector's unit map. Instants and local times are not metric data; they follow [ADR 0024](0024-time-utc-instants-plant-wall-clock-temporal-and-the-clamp-resolver.md).

## Decision drivers

* Metric data in SI with server-side conversion (Krister Johansson's decision).
* Exact factors, so a typed or ERP value equals its stored value by definition and tests compare tightly.
* Codes chosen by NorthMES, because they are stored in rows and appear as GraphQL enum values; a library rename must never become a data migration.
* Interop codes: UNECE Recommendation 20 (which OPC UA uses) and UCUM.
* A license that fits the MIT contracts package and the dependency license gate ([ADR 0040](0040-dependency-license-policy-ci-gate-and-sbom.md)).
* No rounding before storage.
* Article quantities match the ERP to the last digit.
* A unit enum used by several subgraphs must compose ([ADR 0015](0015-graphql-federation-inside-one-process-with-an-embedded-hive-gateway.md)).

## Considered options

* A NorthMES unit catalog with an affine converter, and mathjs as a test oracle only
* `convert-units` 3.0.0-beta.8, as in the earlier attempt
* Another conversion library at run time: `convert` 8.0.2, mathjs 15.2.0, `@lhncbc/ucum-lhc` 7.1.9 or unitsnet-js 4.0.10

## Decision outcome

Chosen option: "A NorthMES unit catalog with an affine converter, and mathjs as a test oracle only", because no candidate library combines exact factors, the dimensions an MES needs, interop codes and a license that suits the MIT contracts package, and the converter is about 30 lines.

### The catalog

Each unit has a stable code (also the GraphQL enum value and the stored code), dimension, symbol, exact scale as numerator and denominator, shift (added before scaling, for temperature), UNECE Recommendation 20 code, UCUM code, display decimals and ingestion aliases. Conversion is `canonical = (value + shift) x num / den` and its inverse. A unit with scale 1 and shift 0 returns its input unchanged, so a value entered in the canonical unit is stored bit-identical. Definitions are written as products of exact constants (inch, pound, standard gravity, US gallon), never as rounded decimals.

The catalog data lives in MIT `@northmes/contracts`, with a Zod enum and a TypeScript union of codes per dimension. The converter and the ingestion alias table are server code, proposed for `@northmes/sdk/units`; web packages may not import them, so the frontend never converts. mathjs 15.2.0 is a devDependency used only as an oracle. `convert-units` is not used.

| Dimension | Canonical unit (code) | Column suffix | UNECE |
|---|---|---|---|
| time (durations only) | second (`SECOND`) | `_s` | SEC |
| length | metre (`METRE`) | `_m` | MTR |
| mass | kilogram (`KILOGRAM`) | `_kg` | KGM |
| temperature, absolute | degree Celsius (`DEGREE_CELSIUS`) | `_c` | CEL |
| temperature difference | kelvin (`KELVIN_DIFFERENCE`) | `_k` | KEL |
| pressure | pascal | `_pa` | PAL |
| ratio | one, as a fraction (OEE target 0.75, not 75) | `_ratio` | C62 |

Area, volume, speed, flows, force, torque, energy, power, frequency and rotational speed have canonical units as well ([04-data-and-platform.md](../plan/04-data-and-platform.md#canonical-units)). An absolute temperature is at least -273.15 °C and is never summed. A temperature difference converts without the shift: 10 K is 18 °F of difference.

### Storage

* Metric values are `double precision`, never rounded before storage.
* Column names end in the canonical unit's suffix (`cycle_time_s`, `retool_time_s`, `lead_time_s`, `oee_target_ratio`). The suffix is the contract: changing a column's unit renames the column.
* A value a person typed in another unit keeps `<name>_entry_value` and `<name>_entry_unit` (a catalog code), both or neither. Machine samples never get entry columns. Only the canonical column feeds validation, scheduling, aggregation and events.
* Article quantities (order, good, scrap, stock, BOM and send-ahead quantities) are business quantities: `numeric(18,6)` in the article's stock unit, with no suffix. `article.stock_unit` references a catalog code. A physical property of an article, such as `net_mass_kg`, is metric data.
* Counts of events (pulses, cycles, stops) are integers.

### API

* A measured field is a `Float` with a unit argument whose type is the dimension's enum and whose default is the canonical unit, for example `cycleTime(unit: CycleTimeUnit! = SECOND)` with `SECOND`, `MINUTE`, `PIECES_PER_HOUR` and `PIECES_PER_MINUTE`. Rate units convert by reciprocal (seconds = 3600 / pieces per hour). `cycleTimeEntry` returns what the planner typed.
* Mutations take `{ value, unit }` inputs and convert to canonical before validation, so limits and cross-field rules compare canonical values.
* A filter on a measured field carries one unit for its bounds, converted before SQL; a rate unit swaps the bounds. Sorting uses the canonical column. Aggregates are computed in SQL on the canonical column and converted on the way out; temperature offers no sum.
* Unit enums and unit inputs are SDK-shared types that every subgraph emits identically. A plugin never emits its own copy, and composition fails on a drifted copy with `NORTHMES_SDK_TYPE_DRIFT` ([ADR 0016](0016-graphql-list-conventions-connections-relations-filter-sort-search-and-group-by.md)).
* MCP tools and outbox events carry canonical values with the unit in the key (`cycleTimeSeconds`), never a bare number.
* Rounding happens only in the web formatter and at external boundaries that demand it, such as Pyramid write-back. The unit-aware number input parses locale decimals ("12,5"), sends `{ value, unit }` and never converts. Visible labels carry the unit symbol; the accessible name uses the unit's name.

### Connector input

The Pyramid connector owns the map from Pyramid fields to catalog units, because nothing in core is Pyramid-specific ([ADR 0032](0032-pyramid-connector-polling-file-mode-and-shadow-write-back.md)). Time fields whose unit the pilot's Pyramid administrator has not confirmed have no default, and the import refuses to run until they are set. Pyramid's integer OEE percent is stored as a fraction. Articles created by an import get the stock unit `PIECE` until someone sets another.

### Release 1 scope and open points

Release 1 needs about 14 units (time units, the cycle-time rates, ratios and the pilot's stock units), cycle time end to end, the Pyramid field unit map and the unit-aware number input. The other dimensions exist as catalog data and reach the API with the Data collection module.

Open:

* Product owner: when one cycle makes several pieces, does "pieces per hour" count pieces or cycles? Working default: `cycle_time_s = 3600 / rate`, which reads the entered rate as cycles per hour whenever pieces per cycle is above 1.
* Which stock units the pilot uses besides pieces.
* The server decimal library and the GraphQL decimal scalar for `numeric` quantities.

### Consequences

* Good, because typed and ERP values store exactly and read back as entered after display rounding.
* Good, because stored codes and API names belong to NorthMES and survive any library change.
* Good, because UNECE codes let a later OPC UA adapter propose a unit from a server's `EngineeringUnits`.
* Good, because most temperature readings are stored without conversion.
* Bad, because hand-written factors can be wrong; the exact-definition tests, the oracle and the UNECE check script guard them.
* Bad, because degree Celsius is coherent only for differences, so a formula that needs kelvin converts at the formula, and absolute temperatures are never multiplied or summed.
* Bad, because two number types coexist (`double precision` for metric data, `numeric(18,6)` for quantities), and the server needs a decimal type for quantities.

### Confirmation

* `catalog.test.ts` in `@northmes/contracts`: codes are unique and valid GraphQL enum names; every dimension has exactly one canonical unit with scale 1 and shift 0; each Zod enum equals the catalog codes of its dimension.
* Exact-definition tests (inch, foot, pound, pound-force, psi, US gallon, kgf, °F to °C at -40, 32 and 212, K to °C at 0 and 273.15) and an oracle test against mathjs at 0, 1, 37.5 and 1e6 within 1e-12 relative, with psi listed as a known mathjs difference.
* fast-check properties: a round trip through canonical stays within 1e-12 relative over ±1e9; conversion is monotonic; no absolute temperature below -273.15 °C is accepted; a difference never applies the shift.
* `cycle-time.test.ts`: "12,5" gives 12.5 s; 420 pieces per hour stores `cycle_time_s` 3600/420 with entry value 420 and entry unit `PIECES_PER_HOUR` and reads back as 420 after display rounding; every integer rate from 1 to 100 000 reads back as entered after display rounding to 6 decimals; zero and negative rates are refused.
* A list test: a cycle-time filter of at least 300 pieces per hour returns rows with at most 12 seconds.
* A composition test: two subgraphs that emit `TimeUnit` compose; one that emits a different value set fails with `NORTHMES_SDK_TYPE_DRIFT`.
* Integration tests on Testcontainers Postgres: a `double precision` value round-trips bit-identical; `numeric` arrives as a string; the entry columns' both-or-neither check and the absolute temperature check reject bad rows.
* An import rule fails when a web package imports `@northmes/sdk/units`.
* A script, run by hand when the catalog changes, checks the UNECE codes against the OPC Foundation's `UNECE_to_OPCUA.csv`.

## Pros and cons of the options

### A NorthMES unit catalog with an affine converter

* Good, because factors are exact by construction and codes are chosen once.
* Good, because the catalog adds no run-time dependency and bundled to about 1.9 KB gzip in a prototype.
* Neutral, because the oracle test still uses mathjs as a devDependency.
* Bad, because NorthMES maintains the unit list itself.

### convert-units 3.0.0-beta.8

* Good, because it covers every dimension an MES needs, including flow, mass flow and torque.
* Bad, because it has been beta since 2021, its factors are inexact (1 ft³ converts to 1728.0071 in³), its names leak into the API, and it has no difference dimension and no interop codes.

### Another conversion library at run time

* Good, because `convert` 8.0.2 is maintained and small, mathjs is exact enough, ucum-lhc carries UCUM codes and unitsnet-js models temperature differences.
* Bad, because `convert` lacks speed, flow, mass flow and torque; mathjs is 67 KB gzip if it reaches the browser, is Apache-2.0 beside an MIT package and has no interop codes; ucum-lhc's license is not an SPDX identifier, forbids modifying UCUM content and pulls a dependency with an open advisory; unitsnet-js has one maintainer and no tree shaking.
* Neutral, because unitsnet-js stays the fallback, on the server behind the same codes, if a factor library is wanted later.

## More information

* Related ADRs: [0015](0015-graphql-federation-inside-one-process-with-an-embedded-hive-gateway.md), [0016](0016-graphql-list-conventions-connections-relations-filter-sort-search-and-group-by.md), [0022](0022-shared-building-blocks-packages-the-master-data-kit-settings-and-generators.md) (the catalog's package), [0024](0024-time-utc-instants-plant-wall-clock-temporal-and-the-clamp-resolver.md), [0027](0027-planned-duration-formula-and-override-precedence.md) (cycle time and the planning factor), [0032](0032-pyramid-connector-polling-file-mode-and-shadow-write-back.md) (Pyramid unit map), [0040](0040-dependency-license-policy-ci-gate-and-sbom.md).
* Plan: [04-data-and-platform.md](../plan/04-data-and-platform.md#units-and-the-unit-catalog), [07-production-planning.md](../plan/07-production-planning.md#planned-duration).
* Public sources: the SI Brochure, [NIST SP 330 (2019)](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.330-2019.pdf), Table 4 and section 2.3.4; [OPC UA Part 8, EUInformation](https://reference.opcfoundation.org/Core/Part8/v105/docs/5.6.4); [UNECE_to_OPCUA.csv](https://raw.githubusercontent.com/OPCFoundation/UA-Nodeset/latest/Schema/UNECE_to_OPCUA.csv).
* Revisit when the product owner answers the pieces-per-hour question, when Data collection adds physical dimensions and the ingestion port's unit step, and when display preferences per user, plant and company are built.
* Background: internal research note 35.
