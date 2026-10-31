/* Data and copy for the variations page shell-454-dashboard-variations.dc.html, issue northMES/northmes#454.
   Every company, plant, person, order, article, machine, number and time here is fictional. Demo date: Mon 2026-10-12,
   10:40 in plant time. Numbers follow the default presentation settings (spaceComma, iso, h23).
   The parts read window.DB454: the option parts -a, -b and -c and the grid part -grid.
   Layouts are in grid units. lg is the 12-column grid (container 900 px and wider), md the 6-column grid (600 to
   899 px), sm one column in reading order (y, then x). md comes from lg by first-fit packing in reading order. */
(function () {
  if (window.DB454) return;
  var NB = " ";

  var SIZE = {
    S: { name: "Small", lg: [3, 2], md: [3, 2] },
    M: { name: "Medium", lg: [4, 4], md: [3, 4] },
    L: { name: "Large", lg: [6, 4], md: [6, 4] },
    T: { name: "Tall", lg: [6, 6], md: [6, 6] },
    W: { name: "Wide", lg: [12, 4], md: [6, 4] }
  };
  // Release 1 ships these four types, each on demo data. Sizes list the default first.
  var TYPES = {
    list: { name: "List", icon: "List", sizes: ["M", "L", "T"], desc: "Rows from one data source, such as production orders, with a status on each row." },
    table: { name: "Table", icon: "Table", sizes: ["L", "T", "W"], desc: "Columns you choose from one data source, sorted and filtered." },
    value: { name: "Value", icon: "Hash", sizes: ["S"], desc: "One number, such as good quantity today, with a comparison." },
    chart: { name: "Chart", icon: "ChartColumn", sizes: ["L", "M", "W"], desc: "Bars over time for one or two series, such as good quantity per hour." }
  };
  var sizeText = function (k) { var s = SIZE[k]; return s.name + " " + s.lg[0] + " by " + s.lg[1]; };

  // Rows: production order number, article, status, deadline line, late.
  var R = function (no, art, st, sub, late, lang) { return { no: no, art: art, st: st, sub: sub, late: !!late, lang: lang || null }; };
  var LISTS = {
    late: [
      R("1018", "Hub 12", "Active", "Deadline 2026-10-12 11:00, planned end 13:20", true),
      R("1015", "Spacer 8", "Active", "Deadline 2026-10-12 12:00, planned end 14:05", true),
      R("1007", "Housing P", "Active", "Deadline 2026-10-12 14:00, planned end 2026-10-13 10:30", true),
      R("1012", "Flange DN50", "Planned", "Deadline 2026-10-12 16:00, planned end 21:40", true),
      R("1019", "Shaft 40", "Planned", "Deadline 2026-10-13 06:00, planned end 13:15", true),
      R("1023", "Hub 12", "Planned", "Deadline 2026-10-13 12:00, planned end 2026-10-14 08:00", true),
      R("1031", "Cover plate", "Paused", "Deadline 2026-10-14 10:00, planned end 15:20", true)
    ],
    pressing: [
      R("1004", "Gear blank 32", "Active", "Deadline 2026-10-12 15:00"),
      R("1009", "Cover plate", "Paused", "Deadline 2026-10-12 18:00"),
      R("1015", "Spacer 8", "Active", "Deadline 2026-10-12 12:00", true),
      R("1021", "Bracket L", "Planned", "Deadline 2026-10-13 09:00"),
      R("1026", "Hub 12", "Planned", "Deadline 2026-10-13 14:00")
    ],
    milling: [
      R("1018", "Hub 12", "Active", "Deadline 2026-10-12 11:00", true),
      R("1001", "Housing P", "Active", "Deadline 2026-10-12 16:00"),
      R("1002", "Bracket L", "Planned", "Deadline 2026-10-12 20:00"),
      R("1014", "Lagerhus 62", "Planned", "Deadline 2026-10-13 10:00", false, "sv"),
      R("1027", "Gear blank 32", "Planned", "Deadline 2026-10-14 08:00")
    ]
  };
  var TABLES = {
    jobsnow: {
      cols: "minmax(80px,0.8fr) minmax(120px,1.4fr) minmax(80px,0.9fr) 76px 80px 64px 96px",
      head: [{ t: "Job" }, { t: "Article" }, { t: "Machine" }, { t: "Started" }, { t: "Good", num: true }, { t: "Scrap", num: true }, { t: "Status" }],
      rows: [
        ["1001.20", "Housing P", "CNC1", "06:04", "40", "1", "Active"],
        ["1004.10", "Gear blank 32", "CNC2", "06:00", "118", "3", "Active"],
        ["1009.10", "Cover plate", "Press 3", "06:15", "104", "12", "Paused"],
        ["1015.10", "Spacer 8", "Press 4", "07:30", "148", "9", "Active"],
        ["1011.30", "Shaft 40", "Lathe 1", "08:10", "85", "0", "Active"],
        ["1018.20", "Hub 12", "Mill 1", "09:00", "22", "2", "Active"]
      ],
      minw: 700
    }
  };
  var CHARTS = {
    perhour: {
      series: [{ name: "Press 3", cls: "db-s1" }, { name: "Press 4", cls: "db-s2" }],
      groups: [["03", 30, 44], ["04", 28, 42], ["05", 32, 46], ["06", 34, 48], ["07", 36, 50], ["08", 38, 47], ["09", 8, 52], ["10", 0, 31]],
      max: 60, ticks: ["0", "20", "40", "60"],
      alt: "Good quantity per hour, 03:00 to 10:40. Press 4 makes 42 to 52 pieces an hour. Press 3 makes 28 to 38, drops to 8 at 09:00 and has 0 since."
    },
    press4: {
      series: [{ name: "Press 4", cls: "db-s1" }],
      groups: [["Tue", 1060], ["Wed", 1115], ["Thu", 840], ["Fri", 1130], ["Mon", 360]],
      max: 1200, ticks: ["0", "400", "800", "1" + NB + "200"],
      alt: "Good quantity on Press 4 per day, Tuesday to today: 1 060, 1 115, 840, 1 130, and 360 so far today."
    },
    shiftsB: {
      series: [{ name: "Scrap", cls: "db-s1" }],
      groups: [["Early", 14], ["Late", 22], ["Night", 9], ["Early", 11]],
      max: 30, ticks: ["0", "10", "20", "30"],
      alt: "Scrap per shift at Plant B, the last four shifts: 14, 22, 9 and 11 pieces."
    }
  };

  // Placed widgets. st is the widget's state where the frame shows it (Plant B for the Press line tab); perm names the
  // data a widget without permission stands for.
  var W = {
    good: { type: "value", title: "Good today", size: "S", v: "1" + NB + "284", u: "pcs", c: "96 more than at this time yesterday", trend: "TrendingUp" },
    scrap: { type: "value", title: "Scrap today", size: "S", v: "37", u: "pcs", c: "2,8 % of the reported quantity" },
    late: { type: "value", title: "Late production orders", size: "S", v: "7", u: "", c: "3 more than yesterday", trend: "TrendingUp" },
    running: { type: "value", title: "Machines running", size: "S", v: "31", u: "of 40", c: "Press 3 paused since 09:12" },
    perhour: { type: "chart", title: "Good quantity per hour", size: "L", chart: "perhour" },
    latelist: { type: "list", title: "Late production orders", size: "L", list: "late", more: "All 7 late production orders" },
    jobsnow: { type: "table", title: "Jobs running now", size: "W", table: "jobsnow", more: "All 23 running jobs" },

    pressing: { type: "list", title: "Production orders, Pressing", size: "M", list: "pressing", more: "All 9 in Pressing" },
    milling: { type: "list", title: "Production orders, Milling", size: "M", list: "milling", more: "All 14 in Milling" },
    press4: { type: "chart", title: "Good quantity, Press 4", size: "M", chart: "press4" },
    notplaced: { type: "value", title: "Jobs not placed", size: "S", v: "4", u: "", c: "On the board's Not placed row" },
    mylate: { type: "value", title: "Late production orders", size: "S", v: "7", u: "", c: "3 more than yesterday", trend: "TrendingUp" },

    b1: { type: "table", title: "Jobs on Press 4", size: "L", st: "missing", stText: "Press 4 is not a machine at Plant B." },
    b3: { type: "value", title: "Downtime today", size: "S", st: "forbidden", perm: "machine downtime" },
    b4: { type: "value", title: "Scrap today", size: "S", st: "error", cid: "01JA2V7Q9K3M5T" },
    b6: { type: "plugin", title: "Andon calls", size: "S", st: "removed" },
    b8: { type: "value", title: "Good today", size: "S", st: "loading" },
    b2: { type: "list", title: "Production orders, Pressing", size: "M", st: "missing", stText: "Pressing is not an equipment group at Plant B." },
    b7: { type: "list", title: "Jobs, Milling", size: "M", st: "empty" },
    b5: { type: "chart", title: "Scrap per shift", size: "M", chart: "shiftsB" }
  };

  // Tabs. scope: company, plant or mine. A shared tab belongs to a scope node; a personal tab to its user.
  var P = function (id, x, y) { return { id: id, x: x, y: y }; };
  var TABS = {
    acme: { name: "Acme overview", scope: "company", widgets: [] },
    shift: { name: "Shift overview", scope: "plant", widgets: [P("good", 0, 0), P("scrap", 3, 0), P("late", 6, 0), P("running", 9, 0), P("perhour", 0, 2), P("latelist", 6, 2), P("jobsnow", 0, 6)] },
    quality: { name: "Quality", scope: "plant", widgets: [] },
    bshift: { name: "Plant B overview", scope: "plant", widgets: [] },
    myshift: { name: "My shift", scope: "mine", widgets: [P("pressing", 0, 0), P("milling", 4, 0), P("press4", 8, 0), P("notplaced", 0, 4), P("mylate", 3, 4)] },
    pressline: { name: "Press line", scope: "mine", widgets: [P("b1", 0, 0), P("b3", 6, 0), P("b4", 9, 0), P("b6", 6, 2), P("b8", 9, 2), P("b2", 0, 4), P("b7", 4, 4), P("b5", 8, 4)] },
    night: { name: "Night shift", scope: "mine", widgets: [] },
    checks: { name: "Admin checks", scope: "mine", widgets: [] }
  };
  // The tab lists each person sees at a plant, in order: company tabs, plant tabs, own tabs.
  var LISTS_OF_TABS = {
    alexA: { company: ["acme"], plant: ["shift", "quality"], mine: ["myshift", "pressline"] },
    alexA6: { company: ["acme"], plant: ["shift", "quality"], mine: ["myshift", "pressline", "night"] },
    alexB: { company: ["acme"], plant: ["bshift"], mine: ["myshift", "pressline"] },
    jonasA: { company: ["acme"], plant: ["shift", "quality"], mine: ["checks"] }
  };
  var PEOPLE = {
    alex: { user: "Alex Lund", username: "alex.lund" },
    jonas: { user: "Jonas Holm", username: "jonas.holm" }
  };

  // First-fit packing in reading order: each widget takes the first place, row by row, where it fits.
  var pack = function (items, cols) {
    var used = {};
    var free = function (x, y, w, h) { for (var r = y; r < y + h; r++) for (var c = x; c < x + w; c++) if (used[r + ":" + c]) return false; return true; };
    return items.map(function (it) {
      for (var y = 0; y < 200; y++) {
        for (var x = 0; x + it.w <= cols; x++) {
          if (free(x, y, it.w, it.h)) {
            for (var r = y; r < y + it.h; r++) for (var c = x; c < x + it.w; c++) used[r + ":" + c] = true;
            return { id: it.id, x: x, y: y, w: it.w, h: it.h };
          }
        }
      }
      return { id: it.id, x: 0, y: 0, w: it.w, h: it.h };
    });
  };
  var readingOrder = function (ws) { return ws.slice().sort(function (a, b) { return a.y - b.y || a.x - b.x; }); };
  // Positions of a tab's widgets at 12, 6 or 1 columns; pos overrides positions (a move in a frame).
  var layout = function (tabId, cols, pos) {
    var t = TABS[tabId];
    var ws = readingOrder(t.widgets);
    var out;
    if (cols === 12) {
      out = ws.map(function (p) { var s = SIZE[W[p.id].size].lg; return { id: p.id, x: p.x, y: p.y, w: s[0], h: s[1] }; });
    } else if (cols === 6) {
      out = pack(ws.map(function (p) { var s = SIZE[W[p.id].size].md; return { id: p.id, w: s[0], h: s[1] }; }), 6);
    } else {
      var y = 0;
      out = ws.map(function (p) { var h = SIZE[W[p.id].size].lg[1]; var o = { id: p.id, x: 0, y: y, w: 1, h: h }; y += h; return o; });
    }
    if (pos) out.forEach(function (o) { if (pos[o.id]) { o.x = pos[o.id][0]; o.y = pos[o.id][1]; } });
    return out;
  };

  // Scenes: one per option frame. who, plant, theme and width feed the shell; the rest feeds the parts.
  var S = {};
  var base = { w: "1440", theme: "light", who: "alex", plant: "Plant A", tabs: "alexA", tab: "myshift", cols: 12, mode: "view", edit: false };
  var sc = function (id, o) { var x = {}; var k; for (k in base) x[k] = base[k]; for (k in o) x[k] = o[k]; x.id = id; x.opt = id.charAt(0); S[id] = x; };
  ["A", "B", "C"].forEach(function (o) {
    var c = o === "B" ? 6 : 12;
    sc(o + "1", { tab: "shift", cols: c, menu: o === "A" ? "tabActions" : o === "B" ? "rowMenu" : "picker" });
    sc(o + "2", { cols: c, edit: true, mode: o === "A" ? "edit" : "view", panel: "catalog" });
    sc(o + "3", { cols: c, edit: true, mode: o === "A" ? "edit" : "view", panel: "settings", target: "milling" });
    sc(o + "4", { theme: "dark", who: "jonas", tabs: "jonasA", tab: "shift", cols: c, edit: true, menu: o === "A" ? "newTab" : "", dialog: o === "B" ? "delete" : o === "C" ? "manage" : "" });
    sc(o + "5", { theme: "dark", plant: "Plant B", tabs: "alexB", tab: "pressline", cols: c, edit: true });
    sc(o + "6", { w: "1280", tabs: "alexA6", tab: "night", cols: c, edit: true });
    sc(o + "7", { theme: "dark", cols: c, edit: true, mode: o === "A" ? "edit" : "view", target: "milling", move: o !== "B", panel: o === "B" ? "settings" : "",
      pos: o === "B" ? { milling: [3, 4], notplaced: [3, 0], mylate: [3, 2] } : { milling: [6, 4] }, ghost: o === "B" ? null : [4, 0, 4, 4] });
    sc(o + "8", { w: "320", cols: 1, edit: true });
    sc(o + "9", { w: "320", cols: 1, edit: true, mode: o === "A" ? "edit" : "view", target: "milling", menu: o === "B" ? "" : "widget", panel: o === "B" ? "settings" : "" });
  });

  window.DB454 = {
    NB: NB, SIZE: SIZE, TYPES: TYPES, sizeText: sizeText, LISTS: LISTS, TABLES: TABLES, CHARTS: CHARTS, W: W, TABS: TABS,
    TABLISTS: LISTS_OF_TABS, PEOPLE: PEOPLE, layout: layout, pack: pack, SCENES: S,
    ANN: {
      A7: ["Production orders, Milling picked up. Column 5, row 1. Arrow keys move it, Enter drops it, Escape cancels.", "Column 7, row 5."],
      B7: ["Production orders, Milling moved to column 4, row 5."],
      C7: ["Moving Production orders, Milling. Column 5, row 1. Arrow keys move it, Enter places it, Escape cancels.", "Column 7, row 5."]
    }
  };
})();
