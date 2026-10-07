import { productionDayOf } from "./sdk/index.js";
export const d: string = productionDayOf(Temporal.Instant.from("2026-10-25T04:30:00Z"), "Europe/Stockholm", Temporal.PlainTime.from("06:00")).toString();
