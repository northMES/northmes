/* Shared data for the D4 spec page production-start-303-station.dc.html, issue northMES/northmes#303.
   window.PS holds the station, its machines, jobs, last reports, scrap reasons and the copy in English and German.
   Every value is fictional: Acme AB, Plant A, invented people, jobs, articles and machines. Now is Tue 2026-11-03 14:06 CET.
   Quantities print in the plant format spaceComma: a no-break space between thousands and a decimal comma. */
(function () {
  var NB = String.fromCharCode(160);
  function num(v, dec) {
    var d = dec || 0;
    var neg = v < 0;
    var s = Math.abs(v).toFixed(d);
    var parts = s.split(".");
    var int = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, NB);
    return (neg ? "-" : "") + int + (d ? "," + parts[1] : "");
  }
  function nb(s) { return String(s).replace(/ /g, NB); }

  var STATUS = {
    planned: { en: "Planned", de: "Geplant", icon: "Info" },
    active: { en: "Active", de: "Aktiv", icon: "Play" },
    paused: { en: "Paused", de: "Unterbrochen", icon: "Pause" },
    finished: { en: "Finished", de: "Beendet", icon: "CircleCheck" },
    cancelled: { en: "Cancelled", de: "Storniert", icon: "Ban" }
  };

  // Eight reasons draw as radio rows; the register of 14 draws as a searchable list (spec 6.7).
  var REASONS = [
    { en: "Dimension out of tolerance", de: "Maßabweichung außerhalb der Toleranz" },
    { en: "Surface damage", de: "Oberflächenschaden" },
    { en: "Burr", de: "Grat" },
    { en: "Crack", de: "Riss" },
    { en: "Wrong material", de: "Falsches Material" },
    { en: "Setup piece", de: "Einrichteteil" },
    { en: "Tool wear", de: "Werkzeugverschleiß" },
    { en: "Other", de: "Sonstiges" }
  ];
  var REASONS_MORE = [
    { en: "Porosity", de: "Porosität" },
    { en: "Deformation", de: "Verformung" },
    { en: "Contamination", de: "Verschmutzung" },
    { en: "Missing feature", de: "Fehlendes Merkmal" },
    { en: "Handling damage", de: "Transportschaden" },
    { en: "Test piece", de: "Prüfteil" }
  ];

  // Machines. The station Press 4 is bound to the machine Press 4; the station Press cell 1 to Press 3 and Press 4.
  var MACHINES = {
    "Press 4": { de: "Umformpresse 4 Halle Süd" },
    "Press 3": { de: "Umformpresse 3 Halle Süd" }
  };

  // Jobs. planned: the planned window or start; startedBy and startedAt feed the meta line (spec 3.13).
  var JOBS = {
    "5002.10": { machine: "Press 4", art: "A-1187 Bracket L", artDe: "A-1187 Laakeripesän kiinnityslevy", artLang: "fi", status: "paused", qty: 480, good: 200, scrap: 0, unit: "pcs", dec: 0, start: 8.0, pausedSince: "11:40", startedAt: "Mon 2 Nov 20:15", startedAtDe: "Mo 2. Nov. 20:15", startedBy: "Omar Haddad", lastReport: "11:35" },
    "5001.20": { machine: "Press 4", art: "A-2040 Housing P", artDe: "A-2040 Getriebegehäuse Vorderachse links", artLang: "de", status: "active", qty: 1200, good: 640, scrap: 12, unit: "pcs", dec: 0, start: 12.0, window: "12:00 to 16:30", windowDe: "12:00 bis 16:30", priority: 2, startedAt: "12:02", startedBy: "Anna Berg", lastReport: "13:58" },
    "5005.20": { machine: "Press 4", art: "A-2275 Hub 12", artDe: "A-2275 Radnabe 12", artLang: "de", status: "planned", qty: 360, good: 0, scrap: 0, unit: "pcs", dec: 0, start: 13.0, planned: "13:00", window: "13:00 to 15:10", windowDe: "13:00 bis 15:10", flag: "overdue" },
    "5006.10": { machine: "Press 4", art: "A-1520 Cover plate", artDe: "A-1520 Abdeckplatte", artLang: "de", status: "active", qty: 7200, good: 2400, scrap: 30, unit: "pcs", dec: 0, start: 13.5, flag: "elsewhere", plannedOn: "Press 3", startedAt: "13:35", startedBy: "Anna Berg", lastReport: "13:50" },
    "5003.30": { machine: "Press 4", art: "A-4410 Flange DN50", artDe: "A-4410 Flansch DN50", artLang: "de", status: "planned", qty: 3600, good: 0, scrap: 0, unit: "pcs", dec: 0, start: 16.5, planned: "16:30", window: "16:30 to 21:45", windowDe: "16:30 bis 21:45", priority: 1 },
    "5007.10": { machine: "Press 4", art: "A-1004 Spacer 8", artDe: "A-1004 Distanzhülse 8", artLang: "de", status: "finished", qty: 960, good: 948, scrap: 12, unit: "pcs", dec: 0, start: 6.0, startedAt: "06:10", startedBy: "Liisa Korhonen", finishedAt: "10:15" },
    "5008.10": { machine: "Press 3", art: "A-7710 Sheet blank 2 mm", artDe: "A-7710 Blechzuschnitt 2 mm", artLang: "de", status: "active", qty: 850, good: 412.5, scrap: 7.5, unit: "kg", dec: 1, start: 12.5, window: "12:30 to 17:00", windowDe: "12:30 bis 17:00", startedAt: "12:40", startedBy: "Liisa Korhonen", lastReport: "13:45" },
    "5009.10": { machine: "Press 3", art: "A-3310 Bushing 20", artDe: "A-3310 Lagerbuchse 20", artLang: "de", status: "planned", qty: 2400, good: 0, scrap: 0, unit: "pcs", dec: 0, start: 15.0, planned: "15:00", window: "15:00 to 19:20", windowDe: "15:00 bis 19:20" }
  };
  Object.keys(JOBS).forEach(function (k) { JOBS[k].num = k; });

  // The last five reports per job, newest first. kind: report, start, pause, finish, correction.
  // Times are record times in plant time; "day" marks a report from an earlier production day.
  var REPORTS = {
    "5001.20": [
      { t: "13:58", who: "Anna Berg", kind: "report", good: 120, scrap: 3, reason: 2 },
      { t: "13:20", who: "Anna Berg", kind: "report", good: 160, scrap: 4, reason: 1 },
      { t: "12:47", who: "Omar Haddad", kind: "report", good: 200, scrap: 0 },
      { t: "12:30", who: "Omar Haddad", kind: "report", good: 160, scrap: 5, reason: 5 },
      { t: "12:02", who: "Anna Berg", kind: "start" }
    ],
    "5002.10": [
      { t: "11:40", who: "Anna Berg", kind: "pause" },
      { t: "11:35", who: "Anna Berg", kind: "report", good: 60, scrap: 0 },
      { t: "09:30", who: "Omar Haddad", kind: "report", good: 60, scrap: 0 },
      { t: "21:40", day: "Mon 2 Nov", dayDe: "Mo 2. Nov.", who: "Omar Haddad", kind: "report", good: 80, scrap: 0 },
      { t: "20:15", day: "Mon 2 Nov", dayDe: "Mo 2. Nov.", who: "Omar Haddad", kind: "start" }
    ],
    "5006.10": [
      { t: "13:50", who: "Anna Berg", kind: "report", good: 2400, scrap: 30, reason: 6 },
      { t: "13:35", who: "Anna Berg", kind: "start" }
    ],
    "5007.10": [
      { t: "10:15", who: "Liisa Korhonen", kind: "finish" },
      { t: "10:10", who: "Liisa Korhonen", kind: "report", good: 228, scrap: 2, reason: 3 },
      { t: "08:55", who: "Liisa Korhonen", kind: "report", good: 360, scrap: 6, reason: 0 },
      { t: "07:40", who: "Liisa Korhonen", kind: "report", good: 360, scrap: 4, reason: 6 },
      { t: "06:10", who: "Liisa Korhonen", kind: "start" }
    ],
    "5008.10": [
      { t: "13:45", who: "Liisa Korhonen", kind: "report", good: 212.5, scrap: 2.5, reason: 0 },
      { t: "13:05", who: "Liisa Korhonen", kind: "report", good: 200, scrap: 5, reason: 4 },
      { t: "12:40", who: "Liisa Korhonen", kind: "start" }
    ],
    "5005.20": [],
    "5003.30": [],
    "5009.10": []
  };
  // After the correction of 13:58 (minus 2 good, reason "Two pieces counted twice"), state="corrected".
  var CORRECTION = { t: "14:06", who: "Anna Berg", kind: "correction", of: "13:58", good: -2, scrap: 0, note: "Two pieces counted twice", noteDe: "Zwei Teile doppelt gezählt" };
  // The report Anna Berg sends at 14:06 on 5001.20: 96 good, 2 scrap, Burr (the report form's default entries).
  var SENT = { t: "14:06", who: "Anna Berg", kind: "report", good: 96, scrap: 2, reason: 2 };
  // A job once the server has answered: after="sent" adds the report of 14:06, after="corrected" the correction of 14:06.
  // Only 5001.20 has these; every other job comes back unchanged. A correction is a report row, so the last report reads 14:06.
  function after(j, kind) {
    if (!j || j.num !== "5001.20" || (kind !== "sent" && kind !== "corrected")) return j;
    var row = kind === "sent" ? SENT : CORRECTION;
    var c = Object.assign({}, j);
    c.good = j.good + row.good;
    c.scrap = j.scrap + row.scrap;
    c.lastReport = row.t;
    return c;
  }
  // The last five reports of a job after the same answer: the new row leads and the list keeps five rows.
  function reportsAfter(num, kind) {
    var list = (REPORTS[num] || []).slice();
    if (num === "5001.20" && kind === "sent") list = [SENT].concat(list);
    if (num === "5001.20" && kind === "corrected") list = [CORRECTION].concat(list);
    return list.slice(0, 5);
  }

  var EN = {
    lang: "en",
    machine: "Machine",
    jobsOn: function (m) { return "Jobs on " + m; },
    byStart: "By planned start",
    finishedToday: "Finished today",
    unsent: "Unsent entries",
    unsentOn: function (j) { return "Unsent entries on " + j; },
    overdue: "Start overdue",
    finishPending: "Finish pending",
    plannedOn: function (m) { return "Planned on " + m; },
    left: function (r, q, u) { return r + " of " + q + " " + u + " left"; },
    qtyOnly: function (q, u) { return q + " " + u; },
    plannedAt: function (t) { return "Planned " + t; },
    pausedSince: function (t) { return "Paused since " + t; },
    startedAt: function (t) { return "Started " + t; },
    priority: function (p) { return "Priority " + p; },
    finishedSum: function (g, s, q, u) { return g + " good, " + s + " scrap of " + q + " " + u; },
    finishedAt: function (t) { return "Finished " + t; },
    pickCount: function (n, j) { return n + " jobs by planned start, " + j + " selected"; },
    changeJob: "Change job",
    close: "Close",
    noJobs: function (m) { return "No jobs on " + m; },
    noJobsText: function (m) { return "Jobs planned on " + m + " show here by planned start."; },
    showJobsOn: function (m) { return "Show jobs on " + m; },
    staleText: "The job list could not be refreshed. It shows the jobs as of 13:40.",
    errorTitle: "Jobs could not be loaded.",
    errorId: "Error id 7f3a91c2.",
    tryAgain: "Try again",
    loadingJobs: "Loading jobs",
    quantity: "Quantity",
    good: "Good",
    scrap: "Scrap",
    remaining: "Remaining",
    unitPcs: "pcs",
    unitKg: "kg",
    metaStarted: function (j, at, by, last) { return j + " started " + at + " by " + by + (last ? ", last report " + last : ""); },
    metaFinished: function (j, at, by, fin) { return j + " started " + at + " by " + by + ", finished " + fin; },
    metaPlanned: function (w) { return "Planned " + w + ", not started"; },
    start: "Start",
    pause: "Pause",
    finish: "Finish",
    sending: "Sending",
    cmdOffline: { start: "Not started. There is no connection to NorthMES. Press Start again when the connection is back.", pause: "Not paused. There is no connection to NorthMES. Press Pause again when the connection is back.", finish: "Not finished. There is no connection to NorthMES. Press Finish again when the connection is back." },
    cmdTimeout: { start: "No answer from NorthMES within 15 seconds. Press Start again; a job that already started stays started.", pause: "No answer from NorthMES within 15 seconds. Press Pause again; a job that already paused stays paused.", finish: "No answer from NorthMES within 15 seconds. Press Finish again; a job that already finished stays finished." },
    report: "Report",
    goodQty: function (u) { return "Good quantity (" + u + ")"; },
    scrapQty: function (u) { return "Scrap quantity (" + u + ")"; },
    goodName: "Good quantity",
    scrapName: "Scrap quantity",
    reason: "Scrap reason",
    searchReasons: "Search scrap reasons",
    reasonsFound: function (n) { return n + " of 14 reasons"; },
    send: "Send",
    keypadFor: function (f) { return "Keypad for " + f; },
    systemKeyboard: "System keyboard",
    keypad: "Keypad",
    clear: "Clear",
    clearName: function (f) { return "Clear " + f; },
    del: "Delete last digit",
    decimal: "Decimal comma",
    sendOffline: "Not sent. There is no connection to NorthMES. Your entries are kept. Press Send again when the connection is back.",
    sendTimeout: "No answer from NorthMES within 15 seconds. Your entries are kept. Press Send again; the report is counted once.",
    sendOutdated: "NorthMES was updated. Reload the station to send. Your entries stay on this screen.",
    reload: "Reload",
    sendServer: "Not sent. NorthMES could not save the report. Your entries are kept. Press Send again. Error id 7f3a91c2.",
    sent: function (g, s, j) { return "Reported " + g + " good, " + s + " scrap on " + j + " at 14:06."; },
    summary: function (n) { return n === 1 ? "1 field needs attention" : n + " fields need attention"; },
    errWhole: "Enter whole pieces, for example 96.",
    errReason: "Choose a scrap reason. Scrap is above 0.",
    errEmpty: "Enter a good or a scrap quantity above 0.",
    lastReports: "Last reports",
    onJob: function (j) { return "On " + j + ", record time"; },
    time: "Time",
    operator: "Operator",
    action: "Action",
    correct: "Correct",
    correctName: function (t) { return "Correct the report of " + t; },
    started: "Started the job",
    paused: "Paused the job",
    finished: "Finished the job",
    correctionOf: function (t) { return "Correction of " + t; },
    needsSupervisor: "Needs a supervisor",
    supervisorNote: "Reports from earlier production days are corrected by a supervisor.",
    noReports: function (j) { return "No reports on " + j + " yet."; },
    loadingReports: "Loading reports",
    dlgCorrectTitle: function (t) { return "Correct the report of " + t; },
    dlgCorrectText: "The report stays as it is. Saving adds a correction row that refers to it.",
    reportedBy: "Reported by",
    change: "Change",
    reasonReq: "Reason (required)",
    cancel: "Cancel",
    saveCorrection: "Save correction",
    errNoReason: "Enter a reason for the correction.",
    refused: "Not saved. Another correction of this report was saved first. It now counts 118 good, 3 scrap. Check the totals and save again.",
    largeTitle: function (g) { return "Report " + g + " good?"; },
    largeText: function (g, r) { return g + " good is more than 1.5 times the remaining " + r + " pcs. Check the count before you send it."; },
    changeQty: "Change quantity",
    reportGood: function (g) { return "Report " + g + " good"; },
    againTitle: "Report again?",
    againText: "You reported 120 good, 3 scrap on 5001.20 at 13:58, 8 minutes ago.",
    dontReport: "Do not report",
    reportAgain: "Report again"
  };

  var DE = Object.assign({}, EN, {
    lang: "de",
    machine: "Maschine",
    jobsOn: function (m) { return "Aufträge an " + m; },
    byStart: "Nach geplantem Start",
    finishedToday: "Heute beendet",
    unsent: "Nicht gesendete Eingaben",
    unsentOn: function (j) { return "Nicht gesendete Eingaben auf " + j; },
    overdue: "Start überfällig",
    finishPending: "Abschluss ausstehend",
    plannedOn: function (m) { return "Geplant auf " + m; },
    left: function (r, q, u) { return r + " von " + q + " " + u + " offen"; },
    qtyOnly: function (q, u) { return q + " " + u; },
    plannedAt: function (t) { return "Geplant " + t; },
    pausedSince: function (t) { return "Unterbrochen seit " + t; },
    startedAt: function (t) { return "Gestartet " + t; },
    priority: function (p) { return "Priorität " + p; },
    finishedSum: function (g, s, q, u) { return g + " gut, " + s + " Ausschuss von " + q + " " + u; },
    finishedAt: function (t) { return "Beendet " + t; },
    pickCount: function (n, j) { return n + " Aufträge nach geplantem Start, " + j + " ausgewählt"; },
    changeJob: "Auftrag wechseln",
    close: "Schließen",
    noJobs: function (m) { return "Keine Aufträge an " + m; },
    noJobsText: function (m) { return "Aufträge, die an " + m + " geplant sind, erscheinen hier nach geplantem Start."; },
    showJobsOn: function (m) { return "Aufträge an " + m + " anzeigen"; },
    staleText: "Die Auftragsliste konnte nicht aktualisiert werden. Sie zeigt den Stand von 13:40.",
    errorTitle: "Die Aufträge konnten nicht geladen werden.",
    errorId: "Fehlerkennung 7f3a91c2.",
    tryAgain: "Erneut versuchen",
    loadingJobs: "Aufträge werden geladen",
    quantity: "Menge",
    good: "Gut",
    scrap: "Ausschuss",
    remaining: "Rest",
    unitPcs: "Stk.",
    metaStarted: function (j, at, by, last) { return j + " gestartet " + at + " von " + by + (last ? ", letzte Meldung " + last : ""); },
    metaFinished: function (j, at, by, fin) { return j + " gestartet " + at + " von " + by + ", beendet " + fin; },
    metaPlanned: function (w) { return "Geplant " + w + ", nicht gestartet"; },
    start: "Starten",
    pause: "Unterbrechen",
    finish: "Beenden",
    sending: "Wird gesendet",
    report: "Meldung",
    goodQty: function (u) { return "Gutmenge (" + u + ")"; },
    scrapQty: function (u) { return "Ausschussmenge (" + u + ")"; },
    goodName: "Gutmenge",
    scrapName: "Ausschussmenge",
    reason: "Ausschussgrund",
    send: "Senden",
    keypadFor: function (f) { return "Tastenfeld für " + f; },
    systemKeyboard: "Systemtastatur",
    keypad: "Tastenfeld",
    clear: "Leeren",
    clearName: function (f) { return f + " leeren"; },
    del: "Letzte Ziffer löschen",
    decimal: "Dezimalkomma",
    lastReports: "Letzte Meldungen",
    onJob: function (j) { return "Auf " + j + ", Erfassungszeit"; },
    time: "Zeit",
    operator: "Bediener",
    action: "Aktion",
    correct: "Korrigieren",
    correctName: function (t) { return "Meldung von " + t + " korrigieren"; },
    started: "Auftrag gestartet",
    paused: "Auftrag unterbrochen",
    finished: "Auftrag beendet",
    correctionOf: function (t) { return "Korrektur von " + t; },
    needsSupervisor: "Nur durch Schichtleitung",
    supervisorNote: "Meldungen früherer Produktionstage korrigiert die Schichtleitung.",
    noReports: function (j) { return "Noch keine Meldungen auf " + j + "."; },
    loadingReports: "Meldungen werden geladen",
    cmdOffline: { start: "Nicht gestartet. Es besteht keine Verbindung zu NorthMES. Drücken Sie erneut Starten, sobald die Verbindung wieder besteht.", pause: "Nicht unterbrochen. Es besteht keine Verbindung zu NorthMES. Drücken Sie erneut Unterbrechen, sobald die Verbindung wieder besteht.", finish: "Nicht beendet. Es besteht keine Verbindung zu NorthMES. Drücken Sie erneut Beenden, sobald die Verbindung wieder besteht." },
    cmdTimeout: { start: "Keine Antwort von NorthMES innerhalb von 15 Sekunden. Drücken Sie erneut Starten; ein bereits gestarteter Auftrag bleibt gestartet.", pause: "Keine Antwort von NorthMES innerhalb von 15 Sekunden. Drücken Sie erneut Unterbrechen; ein bereits unterbrochener Auftrag bleibt unterbrochen.", finish: "Keine Antwort von NorthMES innerhalb von 15 Sekunden. Drücken Sie erneut Beenden; ein bereits beendeter Auftrag bleibt beendet." },
    searchReasons: "Ausschussgründe durchsuchen",
    reasonsFound: function (n) { return n + " von 14 Gründen"; },
    sendOffline: "Nicht gesendet. Es besteht keine Verbindung zu NorthMES. Ihre Eingaben bleiben erhalten. Drücken Sie erneut Senden, sobald die Verbindung wieder besteht.",
    sendTimeout: "Keine Antwort von NorthMES innerhalb von 15 Sekunden. Ihre Eingaben bleiben erhalten. Drücken Sie erneut Senden; die Meldung wird nur einmal gezählt.",
    sendOutdated: "NorthMES wurde aktualisiert. Laden Sie die Station neu, um zu senden. Ihre Eingaben bleiben auf diesem Bildschirm.",
    reload: "Neu laden",
    sendServer: "Nicht gesendet. NorthMES konnte die Meldung nicht speichern. Ihre Eingaben bleiben erhalten. Drücken Sie erneut Senden. Fehlerkennung 7f3a91c2.",
    sent: function (g, s, j) { return g + " gut, " + s + " Ausschuss auf " + j + " um 14:06 gemeldet."; },
    summary: function (n) { return n === 1 ? "1 Feld braucht Ihre Eingabe" : n + " Felder brauchen Ihre Eingabe"; },
    errWhole: "Geben Sie ganze Stück ein, zum Beispiel 96.",
    errReason: "Wählen Sie einen Ausschussgrund. Der Ausschuss ist größer als 0.",
    errEmpty: "Geben Sie eine Gut- oder Ausschussmenge größer als 0 ein.",
    dlgCorrectTitle: function (t) { return "Meldung von " + t + " korrigieren"; },
    dlgCorrectText: "Die Meldung bleibt, wie sie ist. Beim Speichern entsteht eine Korrekturzeile, die auf sie verweist.",
    reportedBy: "Gemeldet von",
    change: "Änderung",
    reasonReq: "Begründung (Pflichtfeld)",
    cancel: "Abbrechen",
    saveCorrection: "Korrektur speichern",
    errNoReason: "Geben Sie eine Begründung für die Korrektur ein.",
    refused: "Nicht gespeichert. Eine andere Korrektur dieser Meldung wurde zuerst gespeichert. Sie zählt jetzt 118 gut, 3 Ausschuss. Prüfen Sie die Summen und speichern Sie erneut.",
    largeTitle: function (g) { return g + " gut melden?"; },
    largeText: function (g, r) { return g + " gut ist mehr als das 1,5-Fache der Restmenge von " + r + " Stk. Prüfen Sie die Zählung, bevor Sie senden."; },
    changeQty: "Menge ändern",
    reportGood: function (g) { return g + " gut melden"; },
    againTitle: "Erneut melden?",
    againText: "Sie haben vor 8 Minuten um 13:58 auf 5001.20 120 gut, 3 Ausschuss gemeldet.",
    dontReport: "Nicht melden",
    reportAgain: "Erneut melden",
    loadingJob: "Auftrag wird geladen"
  });
  EN.loadingJob = "Loading job";

  window.PS = {
    NB: NB,
    num: num,
    nb: nb,
    STATUS: STATUS,
    REASONS: REASONS,
    REASONS14: REASONS.concat(REASONS_MORE),
    MACHINES: MACHINES,
    JOBS: JOBS,
    REPORTS: REPORTS,
    CORRECTION: CORRECTION,
    SENT: SENT,
    after: after,
    reportsAfter: reportsAfter,
    EN: EN,
    DE: DE,
    // Long strings: German labels, the German and Finnish articles, and the long operator name (rule 19.19).
    LONG_OPERATOR: "Hannelore Wiesenthal-Brückner",
    tr: function (strings) { return strings === "long" ? DE : EN; },
    job: function (key) { return JOBS[key] || JOBS["5001.20"]; },
    mName: function (m, strings) { return strings === "long" ? (MACHINES[m] || {}).de || m : m; },
    person: function (who, strings) { return strings === "long" && who === "Anna Berg" ? "Hannelore Wiesenthal-Brückner" : who; },
    unit: function (j, strings) { return j.unit === "kg" ? "kg" : strings === "long" ? DE.unitPcs : "pcs"; },
    // Jobs on a machine in order of planned start: open jobs, then the finished ones of today.
    jobsOn: function (m) {
      var all = Object.keys(JOBS).map(function (k) { return JOBS[k]; }).filter(function (j) { return j.machine === m; });
      all.sort(function (a, b) { return a.start - b.start; });
      return { open: all.filter(function (j) { return j.status !== "finished"; }), done: all.filter(function (j) { return j.status === "finished"; }) };
    }
  };
})();
