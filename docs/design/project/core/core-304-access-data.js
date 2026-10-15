/* Shared data of the spec page core-304-access.dc.html, issue northMES/northmes#304, and its part files.
   Every company, plant, person, username, role, date, reason and plain-language line is fictional or proposed.
   Permission ids come from the plan documents unless marked: p (proposed id, open question 3) or inv (invented for the page).
   The plain-language line of each permission is proposed (open question 4): the manifest carries no such text yet.
   It extends core-304-access-variations-data.js (not changed) with places as tokens, the history and German copy for
   the long-strings frames: de is German, fi is Finnish (the Acme tooling plugin, as the shell's long preset names it). */
(function () {
  var P = function (id, en, de, o) { return Object.assign({ id: id, en: en, de: de }, o || {}); };
  var MODULES = [
    { id: "core", en: "Core", de: "Basisfunktionen", kind: "", perms: [
      P("core.user:read", "Read users and their roles", "Benutzer und ihre Rollen lesen", { p: true }),
      P("core.user:create", "Create users", "Benutzer anlegen", { p: true }),
      P("core.user:block", "Block users", "Benutzer sperren", { p: true }),
      P("core.user:resetPassword", "Reset passwords", "Passwörter zurücksetzen", { p: true }),
      P("core.role:read", "Read roles", "Rollen lesen", { p: true }),
      P("core.role:manage", "Create and edit roles", "Rollen anlegen und bearbeiten"),
      P("core.roleAssignment:manage", "Assign and remove roles", "Rollen zuweisen und entziehen", { p: true }),
      P("core.audit:read", "Read the audit log", "Das Prüfprotokoll lesen"),
      P("core.settings:manage", "Change core settings", "Einstellungen der Basisfunktionen ändern"),
      P("core.plant:create", "Create plants", "Werke anlegen"),
      P("core.onboarding:manage", "Run onboarding", "Die Einrichtung eines Werks durchführen"),
      P("core.company:update", "Rename the company", "Das Unternehmen umbenennen")
    ] },
    { id: "planning", en: "Planning", de: "Produktionsplanung", kind: "", perms: [
      P("planning.productionOrder:read", "Read production orders and the planning board", "Fertigungsaufträge und die Plantafel lesen"),
      P("planning.productionOrder:create", "Create production orders", "Fertigungsaufträge anlegen"),
      P("planning.productionOrder:update", "Change production orders", "Fertigungsaufträge ändern"),
      P("planning.productionOrder:release", "Release production orders to the floor", "Fertigungsaufträge für die Werkstatt freigeben"),
      P("planning.productionOrder:cancel", "Cancel production orders", "Fertigungsaufträge stornieren"),
      P("planning.jobOrder:read", "Read job orders", "Arbeitsaufträge lesen"),
      P("planning.jobOrder:schedule", "Move and schedule job orders and save the plan", "Arbeitsaufträge verschieben und einplanen und den Plan speichern"),
      P("planning.jobOrder:lock", "Lock job orders", "Arbeitsaufträge sperren"),
      P("planning.jobOrder:breakLock", "Break another planner's lock", "Die Sperre einer anderen Planerin oder eines anderen Planers aufheben"),
      P("planning.autoplan:run", "Run autoplan", "Automatische Planung starten"),
      P("planning.settings:manage", "Change planning settings", "Planungseinstellungen ändern")
    ] },
    { id: "productionStart", en: "Production start", de: "Fertigungsstart", kind: "", perms: [
      P("productionStart.report:create", "Report production at a station", "Produktion an einem Arbeitsplatz rückmelden"),
      P("productionStart.report:correct", "Correct operator reports", "Rückmeldungen der Werkerinnen und Werker korrigieren")
    ] },
    { id: "pyramidConnector", en: "Pyramid connector", de: "Pyramid-Anbindung", kind: "", perms: [
      P("pyramidConnector.import:upload", "Upload Pyramid files", "Pyramid-Dateien hochladen"),
      P("pyramidConnector.settings:manage", "Change Pyramid connector settings", "Einstellungen der Pyramid-Anbindung ändern", { p: true }),
      P("pyramidConnector.import:sync", "Use Sync now", "Jetzt synchronisieren verwenden"),
      P("pyramidConnector.inbox:resolve", "Resolve files in the import inbox", "Dateien im Importeingang klären", { p: true }),
      P("pyramidConnector.pendingChange:decide", "Accept or reject pending ERP changes", "Ausstehende ERP-Änderungen annehmen oder ablehnen"),
      P("pyramidConnector.importRun:read", "Read the import log", "Das Importprotokoll lesen")
    ] },
    { id: "ai", en: "AI", de: "KI-Assistent", kind: "", perms: [
      P("ai.assistant:use", "Use the assistant", "Den Assistenten verwenden"),
      P("ai.provider:manage", "Set up AI providers", "KI-Anbieter einrichten"),
      P("ai.usage:read", "Read AI usage", "Den KI-Verbrauch lesen")
    ] },
    { id: "acme", en: "Acme tooling", de: "Acme-työkalujen hallinta", deLang: "fi", kind: "plugin", perms: [
      P("acme.toolLife:read", "Read tool life", "Työkalujen käyttöiän tarkastelu", { inv: true, deLang: "fi" }),
      P("acme.toolChange:record", "Record tool changes", "Työkalunvaihtojen kirjaaminen", { inv: true, deLang: "fi" })
    ] },
    { id: "kanban", en: "Kanban", de: "Kanban", kind: "removed", removed: true, perms: [
      P("kanban.board:read", "Read the kanban board", "Die Kanban-Tafel lesen", { inv: true, ni: true })
    ] }
  ];
  var PERM = {};
  MODULES.forEach(function (m) { m.perms.forEach(function (p) { p.mod = m.id; PERM[p.id] = p; }); });
  var INSTALLED = [];
  MODULES.forEach(function (m) { if (!m.removed) m.perms.forEach(function (p) { INSTALLED.push(p.id); }); });

  var READ = ["planning.productionOrder:read", "planning.jobOrder:read"];
  var PLANNER = ["planning.productionOrder:read", "planning.productionOrder:create", "planning.productionOrder:update", "planning.productionOrder:release", "planning.productionOrder:cancel", "planning.jobOrder:read", "planning.jobOrder:schedule", "planning.autoplan:run"];
  // origin: the module that ships a default role; custom roles belong to the company.
  var ROLES = [
    { key: "companyAdmin", en: "Company admin", de: "Unternehmensadministration", origin: "core", def: true, all: true, perms: INSTALLED },
    { key: "planner", en: "Planner", de: "Planung", origin: "planning", def: true, perms: PLANNER },
    { key: "viewer", en: "Viewer", de: "Nur lesen", origin: "planning", def: true, perms: READ },
    { key: "planningAdmin", en: "Planning admin", de: "Planungsadministration", origin: "planning", def: true, perms: PLANNER.concat(["planning.jobOrder:lock", "planning.jobOrder:breakLock", "planning.settings:manage"]) },
    { key: "operator", en: "Operator", de: "Werkerin oder Werker", origin: "productionStart", def: true, perms: ["productionStart.report:create"] },
    { key: "toolKeeper", en: "Tool keeper", de: "Työkaluvastaava", deLang: "fi", origin: "acme", def: true, perms: ["acme.toolLife:read", "acme.toolChange:record"] },
    { key: "plantAdmin", en: "Plant admin", de: "Werksadministration", custom: true, perms: ["core.user:read", "core.user:create", "core.user:block", "core.user:resetPassword", "core.role:read", "core.roleAssignment:manage", "core.settings:manage"].concat(READ) },
    { key: "shiftLead", en: "Shift lead", de: "Schichtleitung Montage und Endprüfung", custom: true, perms: READ.concat(["planning.jobOrder:schedule", "planning.jobOrder:lock", "productionStart.report:correct"]) },
    { key: "it", en: "IT", de: "IT", custom: true, perms: ["core.role:read", "core.role:manage", "core.settings:manage", "ai.provider:manage", "ai.usage:read"] },
    { key: "upload", en: "Upload ERP files", de: "ERP-Dateien hochladen", custom: true, perms: ["pyramidConnector.import:upload"] },
    { key: "kanbanReader", en: "Kanban reader", de: "Kanban lesen", custom: true, perms: ["kanban.board:read"] },
    // New role of frame C1 (Start from Planner): Lock job orders added, Release and Cancel removed.
    { key: "nightPlanner", en: "Night planner", de: "Nachtplanung", custom: true, perms: PLANNER.filter(function (id) { return id !== "planning.productionOrder:release" && id !== "planning.productionOrder:cancel"; }).concat(["planning.jobOrder:lock"]) }
  ];
  var ROLE = {};
  ROLES.forEach(function (r) { ROLE[r.key] = r; });
  var MODULE = {};
  MODULES.forEach(function (m) { MODULE[m.id] = m; });

  // Places a page at Plant A can read (one plant per request): co is the company node, pl the current plant. The English
  // names hold a no-break space, so a place name never breaks across two lines.
  var PLACES = {
    en: { co: "Acme AB", pl: "Plant A", plB: "Plant B" },
    de: { co: "Oberschwäbische Präzisionswerkzeuge GmbH", pl: "Präzisionsfertigung Oberschwaben Werk Süd", plB: "Werk Biberach an der Riß" }
  };

  // People who hold a role at Acme AB or at Plant A. a: [role key, place token, assigned on, assigned by]
  var PEOPLE = [
    { name: "Karin Dahl", user: "karin.dahl", email: "karin.dahl@acme.example", a: [["companyAdmin", "co", "2026-10-01", "command line"]] },
    { name: "Oskar Wik", user: "oskar.wik", email: "oskar.wik@acme.example", a: [["it", "co", "2026-10-01", "Karin Dahl"]] },
    { name: "Erik Lind", user: "erik.lind", email: "erik.lind@acme.example", a: [["planner", "co", "2026-10-02", "Karin Dahl"], ["upload", "co", "2026-10-02", "Karin Dahl"]] },
    { name: "Sara Nyberg", user: "sara.nyberg", email: "sara.nyberg@acme.example", a: [["shiftLead", "pl", "2026-10-02", "Karin Dahl"], ["viewer", "co", "2026-10-01", "Karin Dahl"]] },
    { name: "Jonas Holm", user: "jonas.holm", email: "jonas.holm@acme.example", a: [["plantAdmin", "pl", "2026-10-01", "Karin Dahl"]] },
    { name: "Alex Lund", user: "alex.lund", email: "alex.lund@acme.example", a: [["planner", "pl", "2026-10-03", "Karin Dahl"]] },
    { name: "Hannelore Wiesenthal-Brückner", user: "h.wiesenthal", email: "h.wiesenthal@acme.example", lang: "de", a: [["planner", "pl", "2026-10-03", "Karin Dahl"], ["shiftLead", "pl", "2026-10-06", "Karin Dahl"], ["viewer", "co", "2026-10-03", "Karin Dahl"]] },
    { name: "Anna Berg", user: "anna.berg", noEmail: true, a: [["operator", "pl", "2026-10-03", "Karin Dahl"]] },
    { name: "Päivi Kärkkäinen-Leppänen", user: "paivi.karkkainen", email: "paivi.karkkainen@acme.example", lang: "fi", a: [["operator", "pl", "2026-10-04", "Karin Dahl"]] },
    { name: "Mikael Strand", user: "mikael.strand", blocked: true, email: "mikael.strand@acme.example", a: [["viewer", "pl", "2026-10-02", "Jonas Holm"]] },
    { name: "Lena Ek", user: "lena.ek", email: "lena.ek@acme.example", a: [] }
  ];
  var PERSON = {};
  PEOPLE.forEach(function (p) { PERSON[p.user] = p; });

  // Access changes at Acme AB and Plant A (audit list filtered to the person), newest first.
  var HISTORY = {
    "sara.nyberg": [
      { when: "2026-10-02 08:45", who: "Karin Dahl", surface: "Web", change: "Added Shift lead at Plant A", reason: "Shift lead for assembly from week 2026-W41" },
      { when: "2026-10-01 10:20", who: "Karin Dahl", surface: "Web", change: "Added Viewer at Acme AB", reason: "Reads plans at every plant" }
    ],
    "karin.dahl": [
      { when: "2026-10-01 09:12", who: "Command line", surface: "Command line", change: "Added Company admin at Acme AB", reason: "First company admin for Acme AB" }
    ]
  };

  var has = function (key, id) { return ROLE[key].perms.indexOf(id) >= 0; };
  var heldBy = function (keys) {
    var held = {};
    keys.forEach(function (k) { ROLE[k].perms.forEach(function (id) { held[id] = true; }); });
    return held;
  };
  // Permissions of a role that holders of the given role keys lack
  var missing = function (roleKey, heldKeys) {
    var held = heldBy(heldKeys);
    return ROLE[roleKey].perms.filter(function (id) { return !held[id]; });
  };
  var holdersOf = function (key) {
    var out = [];
    PEOPLE.forEach(function (p) { p.a.forEach(function (x) { if (x[0] === key) out.push({ person: p, place: x[1], on: x[2], by: x[3] }); }); });
    return out;
  };
  var joinAnd = function (a, and) { and = and || " and "; return a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + and + a[a.length - 1]; };

  // Copy. Each entry is English and German; {name} holes are filled by t().
  var T = {
    en: {
      perms: "Permissions", permsDesc: "Grouped by module in the order of the sidebar. Each line says what the permission allows; its id is for docs and support.",
      selected: "{n} of {m} selected.", ofN: "{n} of {m}", added: "Added", removed: "Removed", notInstalled: "Not installed", plugin: "Plugin", included: "Included", notIncluded: "Not included", refusedMk: "Refused",
      locked: "You do not hold it at {plant}.", lockedNote: "You can add a permission to {role} only when you hold it at {plant}, where {role} is assigned. The others show a lock.", refused: "Refused: you do not hold it at {place}, where {role} is assigned.",
      roDefault: "Default roles come from their module and cannot be changed here. To change one, create a role from it.",
      roCustom: "Changing a role needs the permission to create and edit roles (core.role:manage) at {company}.",
      roAll: "Company admin always holds every installed permission. The permission sync adds the permissions of modules installed later, so this role cannot be changed here.",
      diffH: "Difference from {base}", diffD: "{name} holds {n} permissions: {base}'s {m}, with {a} added and {r} removed.", addedN: "Added ({n})", removedN: "Removed ({n})", noneYet: "None",
      roleAndPlace: "Role and place", where: "Where", plantOnly: "{plant} only", plantOnlyD: "Applies at {plant}.", companyAll: "{company}, all plants", companyAllD: "Applies to every plant of {company}, also plants created later.",
      role: "Role", chooseRole: "Choose a role", roleDesc: "Roles that need permissions you do not hold at {plant} stay in the list, with what they need.",
      roleDescCo: "Checked when you add it: you need every permission of the role at {company}.",
      canHere: "You can assign these at {plant}", cantHere: "Needs permissions you do not hold at {plant}", allCo: "Roles of {company}",
      optOk: "{kind}. {n} permissions.", optOne: "{kind}. 1 permission.", optAll: "{kind}. Every installed permission. Only a company admin of {company} can assign it.",
      optMiss1: "{kind}. Needs 1 permission you do not hold at {plant}: {list}.", optMissN: "{kind}. Needs {n} permissions you do not hold at {plant}: {list}.", more: "{list} and {n} more",
      optHeld: "{kind}. {person} already holds it at {place}.", miss1: "Needs 1 permission you do not hold at {plant}: {list}.", missN: "Needs {n} permissions you do not hold at {plant}: {list}.",
      needH: "{role} at {plant}", needD: "The highlighted role. Each permission it includes, and whether you hold it at {plant}.", holdIt: "You hold it at {plant}", notHoldIt: "You do not hold it at {plant}",
      canCo: "Checked when you add them", cantCo: "Needs permissions you do not hold",
      refuseCoAssign: "Assigning at {company} also needs Assign and remove roles (core.roleAssignment:manage) there.",
      assignNote: "You can assign a role at {plant} when you hold every permission it includes there. A company admin of {company} can assign the others.",
      username: "Username", email: "Email", noEmail: "No email", rolesHere: "Roles here", noneRoles: "None",
      refuseCo: "You cannot assign {role} at {company}. It includes {n} permissions you do not hold at {company}: {list}.", refuseAsk: "Ask a company admin of {company} to assign it.",
      custom: "Custom role", defKind: "{origin}, default role", defShort: "{origin}, default", customShort: "Custom",
      general: "General", access: "Access", history: "History", roles: "Roles", rolesD: "{name}'s roles that apply at {plant}.", addRole: "Add role",
      colRole: "Role", colWhere: "Where", colAssigned: "Assigned", colActions: "Actions", by: "by {who}", remove: "Remove", removeName: "Remove {role} at {place}", removeNameNo: "Remove role at {place}", roleTip: "Role needs the permission to read roles (core.role:read) at {plant}.",
      coLine: "A company admin of {company} can remove it.", rolesTable: "Roles of {name}",
      rolesEmpty: "{name} holds no role at {plant} or at {company}.", rolesEmptyD: "Add a role so that {name} can work at {plant}.",
      loadErr: "Could not load {name}'s roles", errText: "Check the connection, then try again. If it fails again, give your plant admin the correlation id.", cid: "Correlation id", copyCid: "Copy correlation id", tryAgain: "Try again",
      changes: "Access changes", changesD: "Who added or removed {name}'s roles, and why.", colWhen: "When", colWho: "Changed by", colChange: "Change", colReason: "Reason", noReason: "No reason given",
      changesNo: "You cannot see access changes here", changesNoD: "This needs the permission to read the audit log (core.audit:read) at {plant}.",
      noteAdded: "{role} at {place} added for {name}. It applies from {name}'s next action.", noteRemoved: "{role} at {place} removed from {name}. It applies from {name}'s next action.",
      rmTitle: "Remove {role} at {place} from {name}?", rmLose: "From the next action, {name} loses these permissions at {plant}:", rmLoseNone: "{name} keeps every permission of {role} through other roles.",
      rmKeep: "{roles} still lets {name} {what}.", reason: "Reason", optional: "(optional)", reasonPh: "Why you remove this role", reasonD: "Shown in the user's history. Do not enter personal data. Up to 500 characters.",
      reasonReq: "Enter a reason of 3 to 500 characters. You entered {n}.", assignedOn: "Assigned {on} by {who}", changesEmpty: "No access changes at {plant} or at {company} yet.", tabsName: "{name}", cancel: "Cancel", removeRole: "Remove role",
      effH: "What {name} can do at {plant}", effD: "Every permission of the roles above, by module. A change applies from {name}'s next action.", colPerm: "Permission", colGranted: "Granted by",
      at: "{role} at {place}", noAccess: "No access", noAccessVh: "No role of {name} at {plant} or at {company} includes it.", showAll: "Show every permission",
      effAll: "Every installed permission, through Company admin at {company}", effAllD: "Company admin holds every permission of every installed module, also of modules installed later.",
      onboarding: "{plant} is not open yet. These permissions apply once its onboarding is complete.",
      deniedTip: "Granted by needs the permission to read roles (core.role:read) at {plant}.",
      effNo: "You cannot see what {name} can do here", effNoD: "This needs the permission to read users and their roles (core.user:read) at {plant}.", effErr: "Could not load what {name} can do",
      effEmpty: "{name} can do nothing at {plant} yet.", effEmptyD: "Permissions come from roles. Add a role above.",
      cmdLine: "Command line", web: "Web"
    },
    de: {
      perms: "Berechtigungen", permsDesc: "Nach Modul gruppiert, in der Reihenfolge der Seitenleiste. Jede Zeile sagt, was die Berechtigung erlaubt; ihre Kennung ist für Dokumentation und Support.",
      selected: "{n} von {m} ausgewählt.", ofN: "{n} von {m}", added: "Hinzugefügt", removed: "Entfernt", notInstalled: "Nicht installiert", plugin: "Plugin", included: "Enthalten", notIncluded: "Nicht enthalten", refusedMk: "Abgelehnt",
      locked: "Sie haben diese Berechtigung in {plant} nicht.", lockedNote: "Sie können {role} eine Berechtigung nur hinzufügen, wenn Sie sie in {plant} haben, wo {role} zugewiesen ist. Die anderen zeigen ein Schloss.", refused: "Abgelehnt: Sie haben diese Berechtigung in {place} nicht, wo {role} zugewiesen ist.",
      roDefault: "Standardrollen kommen aus ihrem Modul und lassen sich hier nicht ändern. Um eine zu ändern, legen Sie eine Rolle auf ihrer Grundlage an.",
      roCustom: "Um eine Rolle zu ändern, brauchen Sie die Berechtigung, Rollen anzulegen und zu bearbeiten (core.role:manage), in {company}.",
      roAll: "Die Unternehmensadministration hat immer jede installierte Berechtigung. Der Abgleich der Berechtigungen fügt die Berechtigungen später installierter Module hinzu, daher lässt sich diese Rolle hier nicht ändern.",
      diffH: "Unterschied zu {base}", diffD: "{name} hat {n} Berechtigungen: die {m} von {base}, {a} hinzugefügt und {r} entfernt.", addedN: "Hinzugefügt ({n})", removedN: "Entfernt ({n})", noneYet: "Keine",
      roleAndPlace: "Rolle und Ort", where: "Wo", plantOnly: "Nur {plant}", plantOnlyD: "Gilt in {plant}.", companyAll: "{company}, alle Werke", companyAllD: "Gilt in jedem Werk von {company}, auch in später angelegten Werken.",
      role: "Rolle", chooseRole: "Rolle auswählen", roleDesc: "Rollen mit Berechtigungen, die Sie in {plant} nicht haben, bleiben mit ihrem Bedarf in der Liste.",
      roleDescCo: "Geprüft beim Hinzufügen: Sie brauchen jede Berechtigung der Rolle in {company}.",
      canHere: "Diese Rollen können Sie in {plant} zuweisen", cantHere: "Braucht Berechtigungen, die Sie in {plant} nicht haben", allCo: "Rollen von {company}",
      optOk: "{kind}. {n} Berechtigungen.", optOne: "{kind}. 1 Berechtigung.", optAll: "{kind}. Jede installierte Berechtigung. Nur die Unternehmensadministration von {company} kann sie zuweisen.",
      optMiss1: "{kind}. Braucht 1 Berechtigung, die Sie in {plant} nicht haben: {list}.", optMissN: "{kind}. Braucht {n} Berechtigungen, die Sie in {plant} nicht haben: {list}.", more: "{list} und {n} weitere",
      optHeld: "{kind}. {person} hat diese Rolle bereits in {place}.", miss1: "Braucht 1 Berechtigung, die Sie in {plant} nicht haben: {list}.", missN: "Braucht {n} Berechtigungen, die Sie in {plant} nicht haben: {list}.",
      needH: "{role} in {plant}", needD: "Die markierte Rolle. Jede Berechtigung darin, und ob Sie sie in {plant} haben.", holdIt: "Sie haben sie in {plant}", notHoldIt: "Sie haben sie in {plant} nicht",
      canCo: "Werden beim Hinzufügen geprüft", cantCo: "Braucht Berechtigungen, die Sie nicht haben",
      refuseCoAssign: "Zuweisen in {company} braucht dort auch Rollen zuweisen und entziehen (core.roleAssignment:manage).",
      assignNote: "Sie können eine Rolle in {plant} zuweisen, wenn Sie dort jede Berechtigung der Rolle haben. Die Unternehmensadministration von {company} kann die anderen zuweisen.",
      username: "Benutzername", email: "E-Mail", noEmail: "Keine E-Mail", rolesHere: "Rollen hier", noneRoles: "Keine",
      refuseCo: "Sie können {role} in {company} nicht zuweisen. Die Rolle enthält {n} Berechtigungen, die Sie in {company} nicht haben: {list}.", refuseAsk: "Bitten Sie die Unternehmensadministration von {company}, sie zuzuweisen.",
      custom: "Eigene Rolle", defKind: "{origin}, Standardrolle", defShort: "{origin}, Standard", customShort: "Eigene",
      general: "Allgemein", access: "Zugriff", history: "Verlauf", roles: "Rollen", rolesD: "Die Rollen von {name}, die in {plant} gelten.", addRole: "Rolle hinzufügen",
      colRole: "Rolle", colWhere: "Wo", colAssigned: "Zugewiesen", colActions: "Aktionen", by: "von {who}", remove: "Entfernen", removeName: "{role} in {place} entfernen", removeNameNo: "Rolle in {place} entfernen", roleTip: "Die Spalte Rolle braucht die Berechtigung, Rollen zu lesen (core.role:read), in {plant}.",
      coLine: "Die Unternehmensadministration von {company} kann sie entfernen.", rolesTable: "Rollen von {name}",
      rolesEmpty: "{name} hat keine Rolle in {plant} oder in {company}.", rolesEmptyD: "Fügen Sie eine Rolle hinzu, damit {name} in {plant} arbeiten kann.",
      loadErr: "Die Rollen von {name} konnten nicht geladen werden", errText: "Prüfen Sie die Verbindung und versuchen Sie es erneut. Wenn es wieder scheitert, geben Sie der Werksadministration die Korrelations-ID.", cid: "Korrelations-ID", copyCid: "Korrelations-ID kopieren", tryAgain: "Erneut versuchen",
      changes: "Zugriffsänderungen", changesD: "Wer die Rollen von {name} hinzugefügt oder entfernt hat, und warum.", colWhen: "Wann", colWho: "Geändert von", colChange: "Änderung", colReason: "Grund", noReason: "Kein Grund angegeben",
      changesNo: "Sie können Zugriffsänderungen hier nicht sehen", changesNoD: "Dafür brauchen Sie die Berechtigung, das Prüfprotokoll zu lesen (core.audit:read), in {plant}.",
      noteAdded: "{role} in {place} für {name} hinzugefügt. Gilt ab der nächsten Aktion von {name}.", noteRemoved: "{role} in {place} von {name} entfernt. Gilt ab der nächsten Aktion von {name}.",
      rmTitle: "{role} in {place} von {name} entfernen?", rmLose: "Ab der nächsten Aktion verliert {name} diese Berechtigungen in {plant}:", rmLoseNone: "{name} behält jede Berechtigung von {role} durch andere Rollen.",
      rmKeep: "Durch {roles} darf {name} weiterhin: {what}.", reason: "Grund", optional: "(optional)", reasonPh: "Warum Sie diese Rolle entfernen", reasonD: "Erscheint im Verlauf des Benutzers. Geben Sie keine personenbezogenen Daten ein. Bis zu 500 Zeichen.",
      reasonReq: "Geben Sie einen Grund mit 3 bis 500 Zeichen ein. Sie haben {n} eingegeben.", assignedOn: "Zugewiesen am {on} von {who}", changesEmpty: "Noch keine Zugriffsänderungen in {plant} oder in {company}.", tabsName: "{name}", cancel: "Abbrechen", removeRole: "Rolle entfernen",
      effH: "Was {name} in {plant} tun darf", effD: "Jede Berechtigung der Rollen oben, nach Modul. Eine Änderung gilt ab der nächsten Aktion von {name}.", colPerm: "Berechtigung", colGranted: "Erteilt durch",
      at: "{role} in {place}", noAccess: "Kein Zugriff", noAccessVh: "Keine Rolle von {name} in {plant} oder in {company} enthält sie.", showAll: "Alle Berechtigungen anzeigen",
      effAll: "Jede installierte Berechtigung, durch die Unternehmensadministration in {company}", effAllD: "Die Unternehmensadministration hat jede Berechtigung jedes installierten Moduls, auch später installierter Module.",
      onboarding: "{plant} ist noch nicht eröffnet. Diese Berechtigungen gelten, sobald die Einrichtung abgeschlossen ist.",
      deniedTip: "Die Spalte Erteilt durch braucht die Berechtigung, Rollen zu lesen (core.role:read), in {plant}.",
      effNo: "Sie können hier nicht sehen, was {name} tun darf", effNoD: "Dafür brauchen Sie die Berechtigung, Benutzer und ihre Rollen zu lesen (core.user:read), in {plant}.", effErr: "Konnte nicht laden, was {name} tun darf",
      effEmpty: "{name} darf in {plant} noch nichts tun.", effEmptyD: "Berechtigungen kommen aus Rollen. Fügen Sie oben eine Rolle hinzu.",
      cmdLine: "Befehlszeile", web: "Web"
    }
  };
  var t = function (lang, key, vars) {
    var s = (T[lang] && T[lang][key]) || T.en[key] || key;
    return s.replace(/\{(\w+)\}/g, function (m, k) { return vars && vars[k] != null ? String(vars[k]) : m; });
  };
  // Labels in a language: lang is "en" or "de"; fiLang tells a Finnish label of the plugin.
  var permLabel = function (id, lang) { var p = PERM[id]; return lang === "de" ? p.de : p.en; };
  var permLang = function (id, lang) { var p = PERM[id]; return lang === "de" && p.deLang ? p.deLang : null; };
  var modLabel = function (mid, lang) { var m = MODULE[mid]; return lang === "de" ? m.de : m.en; };
  var modLang = function (mid, lang) { var m = MODULE[mid]; return lang === "de" && m.deLang ? m.deLang : null; };
  var roleName = function (key, lang) { var r = ROLE[key]; return lang === "de" ? r.de : r.en; };
  var roleLang = function (key, lang) { var r = ROLE[key]; return lang === "de" && r.deLang ? r.deLang : null; };
  var roleKind = function (key, lang) { var r = ROLE[key]; return r.def ? t(lang, "defKind", { origin: modLabel(r.origin, lang) }) : t(lang, "custom"); };
  var roleKindShort = function (key, lang) { var r = ROLE[key]; return r.def ? t(lang, "defShort", { origin: modLabel(r.origin, lang) }) : t(lang, "customShort"); };
  var place = function (tok, lang) { return (PLACES[lang] || PLACES.en)[tok]; };

  window.CA = {
    MODULES: MODULES, MODULE: MODULE, PERM: PERM, INSTALLED: INSTALLED, ROLES: ROLES, ROLE: ROLE, PLACES: PLACES, PEOPLE: PEOPLE, PERSON: PERSON, HISTORY: HISTORY,
    has: has, heldBy: heldBy, missing: missing, holdersOf: holdersOf, joinAnd: joinAnd, t: t,
    permLabel: permLabel, permLang: permLang, modLabel: modLabel, modLang: modLang, roleName: roleName, roleLang: roleLang, roleKind: roleKind, roleKindShort: roleKindShort, place: place
  };
})();
