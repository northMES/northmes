import { DateTime, Interval, Duration } from 'luxon'; console.log(DateTime.now().setZone('Europe/Stockholm').plus({days:1}).toISO(), Interval, Duration)
