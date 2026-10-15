/* Shared data of the variations page core-304-access-variations.dc.html, issue northMES/northmes#304.
   Every company, plant, person, username, role, date and plain-language line is fictional or proposed.
   Permission ids come from the plan documents unless marked: p (proposed id, open question 3, or proposed in plan 08) or inv (invented for the page).
   The plain-language line of each permission is proposed (open question 4): the manifest carries no such text yet. */
(function () {
  var P = function (id, label, o) { return Object.assign({ id: id, label: label }, o || {}); };
  var MODULES = [
    { id: "core", label: "Core", kind: "Core", perms: [
      P("core.user:read", "Read users and their roles", { p: true }),
      P("core.user:create", "Create users", { p: true }),
      P("core.user:block", "Block users", { p: true }),
      P("core.user:resetPassword", "Reset passwords", { p: true }),
      P("core.role:read", "Read roles", { p: true }),
      P("core.role:manage", "Create and edit roles"),
      P("core.roleAssignment:manage", "Assign and remove roles", { p: true }),
      P("core.audit:read", "Read the audit log"),
      P("core.settings:manage", "Change core settings"),
      P("core.plant:create", "Create plants"),
      P("core.onboarding:manage", "Run onboarding"),
      P("core.company:update", "Rename the company")
    ] },
    { id: "planning", label: "Planning", kind: "Module", perms: [
      P("planning.productionOrder:read", "Read production orders and the planning board"),
      P("planning.productionOrder:create", "Create production orders"),
      P("planning.productionOrder:update", "Change production orders"),
      P("planning.productionOrder:release", "Release production orders to the floor"),
      P("planning.productionOrder:cancel", "Cancel production orders"),
      P("planning.jobOrder:read", "Read job orders"),
      P("planning.jobOrder:schedule", "Move and schedule job orders and save the plan"),
      P("planning.jobOrder:lock", "Lock job orders"),
      P("planning.jobOrder:breakLock", "Break another planner's lock"),
      P("planning.autoplan:run", "Run autoplan"),
      P("planning.settings:manage", "Change planning settings")
    ] },
    { id: "productionStart", label: "Production start", kind: "Module", perms: [
      P("productionStart.report:create", "Report production at a station"),
      P("productionStart.report:correct", "Correct operator reports")
    ] },
    { id: "pyramidConnector", label: "Pyramid connector", kind: "Module", perms: [
      P("pyramidConnector.import:upload", "Upload Pyramid files"),
      P("pyramidConnector.settings:manage", "Change Pyramid connector settings", { p: true }),
      P("pyramidConnector.import:sync", "Use Sync now"),
      P("pyramidConnector.inbox:resolve", "Resolve files in the import inbox", { p: true }),
      P("pyramidConnector.pendingChange:decide", "Accept or reject pending ERP changes"),
      P("pyramidConnector.importRun:read", "Read the import log")
    ] },
    { id: "ai", label: "AI", kind: "Module", perms: [
      P("ai.assistant:use", "Use the assistant"),
      P("ai.provider:manage", "Set up AI providers"),
      P("ai.usage:read", "Read AI usage")
    ] },
    { id: "acme", label: "Acme tooling", kind: "Plugin", perms: [
      P("acme.toolLife:read", "Read tool life", { inv: true }),
      P("acme.toolChange:record", "Record tool changes", { inv: true })
    ] },
    { id: "kanban", label: "Kanban", kind: "Plugin, not installed", removed: true, perms: [
      P("kanban.board:read", "Read the kanban board", { inv: true, ni: true })
    ] }
  ];
  var PERM = {};
  MODULES.forEach(function (m) { m.perms.forEach(function (p) { p.mod = m.id; p.modLabel = m.label; PERM[p.id] = p; }); });
  var INSTALLED = [];
  MODULES.forEach(function (m) { if (!m.removed) m.perms.forEach(function (p) { INSTALLED.push(p.id); }); });

  var READ = ["planning.productionOrder:read", "planning.jobOrder:read"];
  var PLANNER = ["planning.productionOrder:read", "planning.productionOrder:create", "planning.productionOrder:update", "planning.productionOrder:release", "planning.productionOrder:cancel", "planning.jobOrder:read", "planning.jobOrder:schedule", "planning.autoplan:run"];
  var ROLES = [
    { key: "companyAdmin", name: "Company admin", origin: "Core", def: true, all: true, perms: INSTALLED },
    { key: "planner", name: "Planner", origin: "Planning", def: true, perms: PLANNER },
    { key: "viewer", name: "Viewer", origin: "Planning", def: true, perms: READ },
    { key: "planningAdmin", name: "Planning admin", origin: "Planning", def: true, perms: PLANNER.concat(["planning.jobOrder:lock", "planning.jobOrder:breakLock", "planning.settings:manage"]) },
    { key: "operator", name: "Operator", origin: "Production start", def: true, perms: ["productionStart.report:create"] },
    { key: "toolKeeper", name: "Tool keeper", origin: "Acme tooling", def: true, perms: ["acme.toolLife:read", "acme.toolChange:record"] },
    { key: "plantAdmin", name: "Plant admin", custom: true, perms: ["core.user:read", "core.user:create", "core.user:block", "core.user:resetPassword", "core.role:read", "core.roleAssignment:manage", "core.settings:manage"].concat(READ) },
    { key: "shiftLead", name: "Shift lead", custom: true, perms: READ.concat(["planning.jobOrder:schedule", "planning.jobOrder:lock", "productionStart.report:correct"]) },
    { key: "it", name: "IT", custom: true, perms: ["core.role:read", "core.role:manage", "core.settings:manage", "ai.provider:manage", "ai.usage:read"] },
    { key: "upload", name: "Upload ERP files", custom: true, perms: ["pyramidConnector.import:upload"] },
    { key: "kanbanReader", name: "Kanban reader", custom: true, perms: ["kanban.board:read"] }
  ];
  var ROLE = {};
  ROLES.forEach(function (r) { r.kind = r.def ? r.origin + ", default role" : "Custom role"; r.kindShort = r.def ? r.origin + ", default" : "Custom"; ROLE[r.key] = r; });

  // People who hold a role at Acme AB or at Plant A, so the pages at Plant A can read them (one plant per request).
  // a: [role key, scope, assigned on, assigned by]
  var PEOPLE = [
    { name: "Karin Dahl", user: "karin.dahl", a: [["companyAdmin", "Acme AB", "2026-10-01", "command line"]] },
    { name: "Oskar Wik", user: "oskar.wik", a: [["it", "Acme AB", "2026-10-01", "Karin Dahl"]] },
    { name: "Erik Lind", user: "erik.lind", a: [["planner", "Acme AB", "2026-10-02", "Karin Dahl"], ["upload", "Acme AB", "2026-10-02", "Karin Dahl"]] },
    { name: "Sara Nyberg", user: "sara.nyberg", a: [["shiftLead", "Plant A", "2026-10-02", "Karin Dahl"], ["viewer", "Acme AB", "2026-09-30", "Karin Dahl"]] },
    { name: "Jonas Holm", user: "jonas.holm", a: [["plantAdmin", "Plant A", "2026-10-01", "Karin Dahl"]] },
    { name: "Alex Lund", user: "alex.lund", a: [["planner", "Plant A", "2026-10-03", "Karin Dahl"]] },
    { name: "Hannelore Wiesenthal-Brückner", user: "h.wiesenthal", lang: "de", a: [["planner", "Plant A", "2026-10-03", "Karin Dahl"], ["shiftLead", "Plant A", "2026-10-06", "Karin Dahl"]] },
    { name: "Anna Berg", user: "anna.berg", noEmail: true, a: [["operator", "Plant A", "2026-10-03", "Karin Dahl"]] },
    { name: "Päivi Kärkkäinen-Leppänen", user: "paivi.karkkainen", lang: "fi", a: [["operator", "Plant A", "2026-10-04", "Karin Dahl"]] },
    { name: "Mikael Strand", user: "mikael.strand", blocked: true, a: [["viewer", "Plant A", "2026-09-29", "Jonas Holm"]] }
  ];

  var has = function (key, id) { return ROLE[key].perms.indexOf(id) >= 0; };
  var holdersOf = function (key) {
    var out = [];
    PEOPLE.forEach(function (p) { p.a.forEach(function (x) { if (x[0] === key) out.push({ person: p, scope: x[1], on: x[2], by: x[3] }); }); });
    return out;
  };
  // Permissions that the holder of role keys lacks among a role's permissions
  var missing = function (roleKey, heldKeys) {
    var held = {};
    heldKeys.forEach(function (k) { ROLE[k].perms.forEach(function (id) { held[id] = true; }); });
    return ROLE[roleKey].perms.filter(function (id) { return !held[id]; });
  };
  var named = function (ids) { return ids.map(function (id) { return PERM[id].label + " (" + id + ")"; }); };
  var joinAnd = function (a) { return a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1]; };
  // Module groups for a permission list: { label, kind, rows: [{ id, label, on, ... }], count }
  var groups = function (on, opts) {
    opts = opts || {};
    return MODULES.filter(function (m) { return !m.removed || (opts.withRemoved && m.perms.some(function (p) { return on.indexOf(p.id) >= 0; })); }).map(function (m) {
      var rows = m.perms.map(function (p) { return { id: p.id, label: p.label, on: on.indexOf(p.id) >= 0 }; });
      var n = rows.filter(function (r) { return r.on; }).length;
      return { id: m.id, label: m.label, kind: m.kind, rows: rows, n: n, count: n + " of " + rows.length };
    });
  };
  window.ACC = { MODULES: MODULES, PERM: PERM, INSTALLED: INSTALLED, ROLES: ROLES, ROLE: ROLE, PEOPLE: PEOPLE, has: has, holdersOf: holdersOf, missing: missing, named: named, joinAnd: joinAnd, groups: groups };
})();
