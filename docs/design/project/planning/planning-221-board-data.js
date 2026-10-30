/* Data and copy for the D3 spec page planning-221-board.dc.html, issue northMES/northmes#221.
   Every company, plant, person, order, article, machine, number and time here is fictional.
   Time t is hours since Mon 2 Nov 2026 00:00 in plant time (Europe/Stockholm, CET; no DST change falls in the range).
   The one exception is PB.DST, the night of Sun 25 Oct 2026, where t counts exact hours and PB.DST.wall gives the
   plant wall clock with its zone name.
   The shared parts read window.PB: planning-221-board-grid, -notplaced and -inspector. */
(() => {
  if (window.PB) return;
  var NB = ' ';
  var pad = (n) => String(n).padStart(2, '0');
  var hm = (t) => {
    var m = Math.round(t * 60);
    m = ((m % 1440) + 1440) % 1440;
    return pad(Math.floor(m / 60)) + ':' + pad(m % 60);
  };
  var WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  var dateOf = (d) => {
    var day = 2 + d,
      mon = 'Nov';
    if (day > 30) {
      day -= 30;
      mon = 'Dec';
    } else if (day < 1) {
      day += 31;
      mon = 'Oct';
    }
    return { wd: WD[((d % 7) + 7) % 7], day: day, mon: mon };
  };
  var dayLabel = (d) => {
    var x = dateOf(d);
    return x.wd + ' ' + x.day + ' ' + x.mon;
  };
  var dayOf = (t) => Math.floor(t / 24 + 1e-9);
  var at = (t) => dayLabel(dayOf(t)) + ' ' + hm(t);
  var isoWeek = (d) => 45 + Math.floor(d / 7);
  var num = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, NB);
  var NOW = 24 + 9 + 40 / 60;

  // Articles: number, short name, long-strings name and language.
  var ART = {
    'Housing P': { no: 'A-2040', de: 'Getriebegehäuse Vorderachse links' },
    'Bracket L': { no: 'A-1187', de: 'Befestigungswinkel lang' },
    'Shaft 40': { no: 'A-3302', de: 'Antriebswelle 40' },
    'Flange DN50': { no: 'A-4410', de: 'Anschlussflansch DN50' },
    'Cover plate': { no: 'A-1520', de: 'Abdeckplatte' },
    'Hub 12': { no: 'A-2275', de: 'Radnabe 12' },
    'Gear blank 32': { no: 'A-3018', de: 'Zahnradrohling 32' },
    'Spacer 8': { no: 'A-1004', de: 'Distanzhülse 8' },
    'Lagerhus 62': { no: 'A-6200', lang: 'sv', de: 'Laakeripesän kiinnityslevy', deLang: 'fi' },
  };
  var ARTS = Object.keys(ART);

  // Equipment groups (D1 group-1, group-2, then palette 16, 19, 17, 15 as proposed) and their 40 machines.
  var mk = (base, deBase, n, cal) => {
    var a = [];
    for (var i = 1; i <= n; i++)
      a.push({ id: base + ' ' + i, de: deBase + ' ' + i, cal: cal || 'A1' });
    return a;
  };
  var GROUPS = [
    {
      id: 'milling',
      name: 'Milling',
      de: 'Zerspanung',
      op: 'Milling',
      deOp: 'Fräsen',
      gc: 'var(--group-1)',
      machines: [
        { id: 'CNC1', de: 'Fünfachs-Bearbeitungszentrum 1', cal: 'A1' },
        { id: 'CNC2', de: 'Fünfachs-Bearbeitungszentrum 2', cal: 'A1' },
        { id: 'Mill 1', de: 'Senkrechtfräsmaschine 1', cal: 'A1' },
        { id: 'Mill 2', de: 'Senkrechtfräsmaschine 2', cal: 'A1' },
      ],
    },
    {
      id: 'turning',
      name: 'Turning',
      de: 'Drehbearbeitung',
      op: 'Turning',
      deOp: 'Drehen',
      gc: 'var(--group-2)',
      machines: [
        { id: 'Lathe 1', de: 'CNC-Drehmaschine 1', cal: 'A1' },
        { id: 'Lathe 2', de: 'CNC-Drehmaschine 2', cal: 'A1' },
        { id: 'Lathe 3', de: 'CNC-Drehmaschine 3', cal: 'L3' },
      ],
    },
    {
      id: 'pressing',
      name: 'Pressing',
      de: 'Umformtechnik und Pressen',
      op: 'Pressing',
      deOp: 'Pressen',
      gc: 'var(--palette-16)',
      machines: [
        { id: 'Press 3', de: 'Exzenterpresse 3', cal: 'P3' },
        { id: 'Press 4', de: 'Hydraulische Presse 4', cal: 'P4' },
      ],
    },
    {
      id: 'finishing',
      name: 'Finishing',
      de: 'Oberflächenbehandlung',
      op: 'Washing',
      deOp: 'Waschen',
      gc: 'var(--palette-19)',
      collapsed: true,
      machines: mk('Wash', 'Waschanlage', 2)
        .concat(mk('Deburr', 'Entgratstation', 2))
        .concat([{ id: 'Paint 1', de: 'Lackierkabine 1', cal: 'A1' }]),
    },
    {
      id: 'assembly',
      name: 'Assembly',
      de: 'Montage',
      op: 'Assembly',
      deOp: 'Montage',
      gc: 'var(--palette-17)',
      machines: mk('Assembly', 'Montageplatz', 14),
    },
    {
      id: 'inspection',
      name: 'Inspection',
      de: 'Qualitätsprüfung',
      op: 'Inspection',
      deOp: 'Prüfen',
      gc: 'var(--palette-15)',
      machines: mk('CMM', 'Koordinatenmessgerät', 3).concat(mk('Test bench', 'Prüfstand', 9)),
    },
  ];
  var MACHINES = [];
  GROUPS.forEach((g) => {
    g.machines.forEach((m) => {
      m.group = g;
      MACHINES.push(m);
    });
  });
  var machine = (id) => {
    for (var i = 0; i < MACHINES.length; i++) if (MACHINES[i].id === id) return MACHINES[i];
    return null;
  };

  // Calendars: working windows per day d (0 is Mon 2 Nov). A1: Mon to Fri 06:00 to 15:00 with breaks 08:30 and 11:00.
  var A1 = (d) =>
    ((d % 7) + 7) % 7 < 5
      ? [
          [6, 8.5],
          [8.75, 11],
          [11.5, 15],
        ]
      : [];
  var CAL = {
    A1: A1,
    P3: (d) =>
      d === 2
        ? []
        : d === 1
          ? [
              [10, 11],
              [11.5, 15],
            ]
          : A1(d),
    P4: (d) =>
      ((d % 7) + 7) % 7 < 5
        ? [
            [6, 8.5],
            [8.75, 11],
            [11.5, 17],
            [17.25, 22],
          ]
        : [],
    L3: (d) => (d === 5 ? [[6, 12]] : A1(d)),
  };
  // Non-working spans of a calendar inside [a, b], in absolute hours.
  var offSpans = (cal, a, b) => {
    var f = CAL[cal] || A1,
      out = [],
      cur = a;
    for (var d = dayOf(a) - 1; d <= dayOf(b) + 1; d++) {
      f(d).forEach((w) => {
        var s = d * 24 + w[0],
          e = d * 24 + w[1];
        if (e <= a || s >= b) return;
        if (s > cur) out.push([cur, Math.min(s, b)]);
        cur = Math.max(cur, e);
      });
    }
    if (cur < b) out.push([cur, b]);
    return out.filter((x) => x[1] - x[0] > 1e-6);
  };

  // Job orders. s and e are absolute hours. st: started, finpend, draft, held, lock, prop, conf, late, overdue, mat, erp, lost, stale.
  var T = 24;
  var J = (j, a, q, s, e, f, m, st, x) => {
    var o = { j: j, a: a, q: q, s: s, e: e, f: f, m: m, st: st || [] };
    for (var k in x || {}) o[k] = x[k];
    return o;
  };
  var AUTH = [
    J('1001.20', 'Housing P', 120, T + 6, T + 10.75, 6, 'CNC1', ['started'], { done: 40 }),
    J('1014.10', 'Lagerhus 62', 3600, T + 11.5, T + 14.75, 12, 'CNC1', [], { key: '1014.10-a' }),
    J('1004.10', 'Gear blank 32', 1200, T + 6, T + 9.5, 3, 'CNC2', ['finpend'], { done: 1200 }),
    J('1002.10', 'Bracket L', 1200, T + 9.75, T + 12.25, 2, 'CNC2', []),
    J('1014.10', 'Lagerhus 62', 3600, T + 12.5, T + 14.75, 12, 'CNC2', [], { key: '1014.10-b' }),
    J('1010.10', 'Bracket L', 1200, T + 6, T + 10, 15, 'Mill 1', ['started'], { done: 840 }),
    J('1005.10', 'Housing P', 120, T + 10.25, T + 12.75, 7, 'Mill 1', ['lock']),
    J('1022.10', 'Bracket L', 480, T + 13, T + 14.75, 14, 'Mill 1', []),
    J('1006.10', 'Hub 12', 1200, T + 7, T + 10.5, 10, 'Mill 2', ['overdue']),
    J('1013.10', 'Spacer 8', 7200, T + 11.5, T + 14.75, 11, 'Mill 2', ['mat']),
    J('1003.10', 'Shaft 40', 480, T + 6, T + 10.5, 4, 'Lathe 1', ['started'], { done: 300 }),
    J('1012.30', 'Hub 12', 480, T + 11.5, T + 14.75, 1, 'Lathe 1', ['late'], { lateBy: 2 }),
    J('1003.20', 'Shaft 40', 480, T + 11.5, T + 14.75, 4, 'Lathe 2', ['draft', 'conf'], {
      over: '1021.10',
      sub: 0,
      from: 'Lathe 1',
      lead: 30,
    }),
    J('1021.10', 'Flange DN50', 480, T + 6.5, T + 11.75, 5, 'Lathe 2', ['started', 'conf'], {
      over: '1003.20',
      sub: 1,
      done: 410,
    }),
    J('1023.10', 'Gear blank 32', 1200, T + 6, T + 9.75, 9, 'Lathe 3', ['started'], { done: 1080 }),
    J('1007.10', 'Flange DN50', 1200, T + 10, T + 13.5, 8, 'Lathe 3', ['held'], {
      holder: 'es',
      since: '09:12',
    }),
    J('1008.10', 'Housing P', 3600, T + 10.25, T + 13, 11, 'Press 3', ['conf'], {
      over: '1009.10',
      sub: 0,
    }),
    J('1009.10', 'Bracket L', 3600, T + 12.25, T + 14.75, 18, 'Press 3', ['conf'], {
      over: '1008.10',
      sub: 1,
    }),
    J('1017.10', 'Spacer 8', 7200, T + 6, T + 9.75, 13, 'Press 4', ['started'], { done: 6600 }),
    J('1030.10', 'Hub 12', 120, T + 10, T + 10 + 10 / 60, 6, 'Press 4', ['late'], { lateBy: 1 }),
    J('1031.10', 'Hub 12', 120, T + 10 + 10 / 60, T + 10 + 20 / 60, 6, 'Press 4', ['late'], {
      lateBy: 1,
    }),
    J('1032.10', 'Cover plate', 120, T + 10 + 20 / 60, T + 10.5, 9, 'Press 4', ['held'], {
      holder: 'es',
      since: '09:20',
    }),
    J('1033.10', 'Spacer 8', 120, T + 10.5, T + 10 + 40 / 60, 13, 'Press 4', []),
    J('1011.10', 'Cover plate', 7200, T + 10.75, T + 14.25, 20, 'Press 4', ['prop']),
    J('1014.20', 'Lagerhus 62', 7200, T + 15.25, T + 17.75, 12, 'Press 4', [], { lead: 30 }),
    J('1025.30', 'Bracket L', 1200, T + 6, T + 9.75, 2, 'Assembly 1', ['started'], { done: 500 }),
    J('1027.30', 'Lagerhus 62', 3600, T + 10, T + 14.5, 12, 'Assembly 1', []),
    J('1026.30', 'Cover plate', 480, T + 7.5, T + 10.25, 9, 'Assembly 2', ['started'], {
      done: 200,
    }),
    J('1028.30', 'Bracket L', 480, T + 11.5, T + 14, 14, 'Assembly 2', []),
    // Draft rows on later days, for the Day preset and the reconnect frame.
    J('1015.10', 'Cover plate', 480, 48 + 7, 48 + 10, 9, 'Mill 2', ['draft'], {
      reconnect: 'stale',
    }),
    J('1016.10', 'Hub 12', 1200, 48 + 9.5, 48 + 12.5, 10, 'CNC1', ['draft'], { reconnect: 'lost' }),
    J('1018.10', 'Flange DN50', 1200, 72 + 6, 72 + 9, 8, 'Lathe 3', ['draft', 'erp']),
  ];
  // Generated job orders for every other machine and working day, from a fixed seed.
  var seed = 7;
  var rnd = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  var QS = [120, 480, 1200, 3600, 7200];
  var gen = [],
    next = 1100;
  var taken = {};
  AUTH.forEach((b) => {
    taken[b.m + '@' + dayOf(b.s)] = true;
  });
  MACHINES.forEach((m) => {
    for (var d = 0; d < 28; d++) {
      if (taken[m.id + '@' + d]) continue;
      var wins = (CAL[m.cal] || A1)(d);
      if (!wins.length) continue;
      var s = d * 24 + wins[0][0],
        end = d * 24 + wins[wins.length - 1][1];
      var n = 0;
      while (s < end - 1 && n < 4) {
        var len = [3.75, 2.5, 3.25, 2.25, 4.5][Math.floor(rnd() * 5)];
        var e = Math.min(end, s + len);
        var st = [];
        if (rnd() < 0.08) st.push('late');
        gen.push(
          J(
            String(next++) + '.10',
            ARTS[Math.floor(rnd() * ARTS.length)],
            QS[Math.floor(rnd() * QS.length)],
            s,
            e,
            1 + Math.floor(rnd() * 20),
            m.id,
            st,
            { lateBy: 1, gen: true },
          ),
        );
        s = e + 0.25;
        n++;
      }
    }
  });
  var JOBS = AUTH.concat(gen);
  JOBS.forEach((b) => {
    b.key = b.key || b.j;
    b.order = b.j.split('.')[0];
  });
  var jobsOn = (mid) => JOBS.filter((b) => b.m === mid);
  var job = (key) => {
    for (var i = 0; i < JOBS.length; i++)
      if (JOBS[i].key === key || JOBS[i].j === key) return JOBS[i];
    return null;
  };
  var NOTPLACED = [
    J('1024.20', 'Hub 12', 1200, null, null, 10, null, [], { order: '1024' }),
    J('1024.30', 'Hub 12', 1200, null, null, 10, null, [], { order: '1024' }),
    J('1022.20', 'Bracket L', 480, null, null, 14, null, [], { order: '1022' }),
  ];
  var MORE = [
    'Cover plate',
    'Shaft 40',
    'Spacer 8',
    'Gear blank 32',
    'Housing P',
    'Flange DN50',
    'Bracket L',
    'Hub 12',
    'Cover plate',
  ].map((a, i) =>
    J(String(1034 + i) + '.10', a, QS[i % 5], null, null, 1 + ((i * 7) % 20), null, []),
  );

  // People. Alex Lund is the signed-in planner; Erik Sand and Lena Ek are the other planners.
  var PEOPLE = {
    es: { name: 'Erik Sand', ini: 'ES', de: 'Hannelore Wiesenthal-Brückner', deIni: 'HW' },
    le: { name: 'Lena Ek', ini: 'LE', de: 'Lena Ek', deIni: 'LE' },
  };
  var CUST = ['Gamma Oy', 'Beta Verkstad AB', 'Stock order'];
  var orderInfo = (o) => {
    var n = Number(o);
    return {
      cust: CUST[n % 3],
      deadline: dayLabel(2 + (n % 3)),
      drawing: 'ABDC'[n % 4],
      surface: ['Raw', 'Anodized', 'Painted', 'Zinc plated'][n % 4],
      tool: 'T-' + (100 + (n % 50)),
    };
  };

  // Copy in English and in the long-strings variant (German, with the Finnish article name).
  var EN = {
    lang: 'en',
    machines: 'Machines',
    inGroups: '40 in 6 groups',
    machinesN: (n) => n + (n === 1 ? ' machine' : ' machines'),
    collapsed: ', collapsed',
    collapse: (g) => 'Collapse ' + g,
    expand: (g) => 'Expand ' + g,
    jobsOn: (m) => 'Jobs on this machine, ' + m,
    noJobs: 'No jobs in this range',
    board: 'Plant A board',
    to: 'to',
    notPlaced: 'Not placed',
    notPlacedN: (n) => 'Not placed, ' + n + (n === 1 ? ' job order' : ' job orders'),
    npName: (b) => b.j + ' ' + b.an + ', ' + num(b.q) + ' pcs, not placed',
    npMore: (n) => n + ' more',
    npMoreName: (n) => n + ' more job orders not placed, show in the job table',
    npAll: (n) => n + (n === 1 ? ' job order' : ' job orders'),
    npAllName: (n) =>
      n + (n === 1 ? ' job order' : ' job orders') + ' not placed, show in the job table',
    npNone: 'No job orders without a place',
    pcs: 'pcs',
    ofPcs: (a, b) => num(a) + ' of ' + num(b) + ' pcs',
    ends: 'ends',
    st: {
      draft: 'changed in your draft, not saved',
      held: (p, since) => 'being edited by ' + p + ' since ' + since,
      lock: 'locked',
      prop: 'proposed by assistant, not reviewed',
      conf: (o) => 'overlaps ' + o,
      late: (n) => 'late by ' + n + (n === 1 ? ' day' : ' days'),
      overdue: (t) => 'overdue, planned ' + t + ', not started',
      finpend: (q) => 'finish pending, ' + q + ' reported',
      mat: 'material short',
      started: (q) => 'started, ' + q,
      erp: 'ERP change waiting',
      lost: 'soft lock lost, Lena Ek holds it since 09:30',
      stale: 'changed by Erik Sand at 09:05',
    },
    cl: {
      jobs: (n) => n + (n === 1 ? ' job' : ' jobs'),
      late: (n) => n + ' late',
      held: (n, p) => n + ' being edited by ' + p,
      draft: (n) => n + ' in your draft',
      conf: (n) => n + (n === 1 ? ' conflict' : ' conflicts'),
      lock: (n) => n + ' locked',
      prop: (n) => n + ' proposed',
      overdue: (n) => n + ' overdue',
      mat: (n) => n + ' material short',
      started: (n) => n + ' started',
      popTitle: (n, m, r) => n + ' jobs on ' + m + ', ' + r,
      move: 'Move',
      actions: (j) => 'Actions for ' + j,
    },
    hc: {
      op: 'Operation',
      article: 'Article',
      qty: 'Quantity',
      good: 'Good and scrap',
      setup: 'Setup start',
      run: 'Run start',
      end: 'End',
      planned: 'Planned',
      machine: 'Machine',
      tool: 'Tool',
      deadline: 'Order deadline',
      lateBy: 'Late by',
      status: 'Status',
      holder: 'Soft lock',
      customer: 'Customer',
      drawing: 'Drawing rev',
      surface: 'Surface',
      notLate: 'Not late',
      nobody: 'Nobody',
      planned2: (s, r) => 'Setup ' + s + ' min, run ' + r,
      good2: (g) => num(g) + ' good, 0 scrap',
      stPlanned: 'Planned',
      stStarted: 'Started',
      stFin: 'Finish pending',
    },
    menu: {
      move: 'Move',
      lock: 'Lock',
      unlock: 'Unlock',
      breakLock: 'Break soft lock',
      open: 'Open order',
      label: (j) => 'Actions for ' + j,
    },
    mv: {
      frozen: 'Starts in the frozen window. Save asks for a reason.',
      frozenUntil: (t) => 'Frozen until ' + t,
      refused: (m) => 'Not allowed on ' + m + '. This operation runs on Milling machines.',
      hint: 'Move mode. Arrow keys move, Enter places, Escape cancels.',
    },
  };
  var DE = {
    lang: 'de',
    machines: 'Maschinen',
    inGroups: '40 in 6 Gruppen',
    machinesN: (n) => n + (n === 1 ? ' Maschine' : ' Maschinen'),
    collapsed: ', eingeklappt',
    collapse: (g) => g + ' einklappen',
    expand: (g) => g + ' ausklappen',
    jobsOn: (m) => 'Aufträge auf dieser Maschine, ' + m,
    noJobs: 'Keine Aufträge in diesem Zeitraum',
    board: 'Plantafel Präzisionsfertigung Oberschwaben Werk Süd',
    to: 'bis',
    notPlaced: 'Nicht eingeplant',
    notPlacedN: (n) =>
      'Nicht eingeplant, ' + n + (n === 1 ? ' Arbeitsauftrag' : ' Arbeitsaufträge'),
    npName: (b) => b.j + ' ' + b.an + ', ' + num(b.q) + ' Stk, nicht eingeplant',
    npMore: (n) => 'Weitere ' + n,
    npMoreName: (n) =>
      'Weitere ' + n + ' nicht eingeplante Arbeitsaufträge, in der Auftragstabelle zeigen',
    npAll: (n) => n + (n === 1 ? ' Arbeitsauftrag' : ' Arbeitsaufträge'),
    npAllName: (n) => n + ' nicht eingeplante Arbeitsaufträge, in der Auftragstabelle zeigen',
    npNone: 'Keine Arbeitsaufträge ohne Platz',
    pcs: 'Stk',
    ofPcs: (a, b) => num(a) + ' von ' + num(b) + ' Stk',
    ends: 'Ende',
    st: {
      draft: 'in Ihrem Entwurf geändert, nicht gespeichert',
      held: (p, since) => 'wird seit ' + since + ' von ' + p + ' bearbeitet',
      lock: 'gesperrt',
      prop: 'vom Assistenten vorgeschlagen, nicht geprüft',
      conf: (o) => 'überschneidet sich mit ' + o,
      late: (n) => n + (n === 1 ? ' Tag' : ' Tage') + ' verspätet',
      overdue: (t) => 'überfällig, geplant ' + t + ', nicht gestartet',
      finpend: (q) => 'Abschluss ausstehend, ' + q + ' gemeldet',
      mat: 'Material fehlt',
      started: (q) => 'gestartet, ' + q,
      erp: 'ERP-Änderung wartet',
      lost: 'Bearbeitungssperre verloren, Lena Ek hält sie seit 09:30',
      stale: 'von Hannelore Wiesenthal-Brückner um 09:05 geändert',
    },
    cl: {
      jobs: (n) => n + (n === 1 ? ' Auftrag' : ' Aufträge'),
      late: (n) => n + ' verspätet',
      held: (n, p) => n + ' in Bearbeitung durch ' + p,
      draft: (n) => n + ' in Ihrem Entwurf',
      conf: (n) => n + (n === 1 ? ' Konflikt' : ' Konflikte'),
      lock: (n) => n + ' gesperrt',
      prop: (n) => n + ' vorgeschlagen',
      overdue: (n) => n + ' überfällig',
      mat: (n) => n + ' Material fehlt',
      started: (n) => n + ' gestartet',
      popTitle: (n, m, r) => n + ' Aufträge auf ' + m + ', ' + r,
      move: 'Verschieben',
      actions: (j) => 'Aktionen für ' + j,
    },
    hc: {
      op: 'Arbeitsgang',
      article: 'Artikel',
      qty: 'Menge',
      good: 'Gutteile und Ausschuss',
      setup: 'Rüstbeginn',
      run: 'Laufbeginn',
      end: 'Ende',
      planned: 'Geplant',
      machine: 'Maschine',
      tool: 'Werkzeug',
      deadline: 'Liefertermin',
      lateBy: 'Verspätung',
      status: 'Status',
      holder: 'Bearbeitungssperre',
      customer: 'Kunde',
      drawing: 'Zeichnungsstand',
      surface: 'Oberfläche',
      notLate: 'Nicht verspätet',
      nobody: 'Niemand',
      planned2: (s, r) => 'Rüsten ' + s + ' min, Lauf ' + r,
      good2: (g) => num(g) + ' gut, 0 Ausschuss',
      stPlanned: 'Geplant',
      stStarted: 'Gestartet',
      stFin: 'Abschluss ausstehend',
    },
    menu: {
      move: 'Verschieben',
      lock: 'Sperren',
      unlock: 'Entsperren',
      breakLock: 'Bearbeitungssperre aufheben',
      open: 'Auftrag öffnen',
      label: (j) => 'Aktionen für ' + j,
    },
    mv: {
      frozen: 'Beginnt im eingefrorenen Zeitfenster. Speichern fragt nach einem Grund.',
      frozenUntil: (t) => 'Eingefroren bis ' + t,
      refused: (m) => 'Auf ' + m + ' nicht erlaubt. Dieser Arbeitsgang läuft auf Fräsmaschinen.',
      hint: 'Verschiebemodus. Pfeiltasten verschieben, Enter setzt, Escape bricht ab.',
    },
  };

  // Zoom presets (proposed): span, gridline step, tick tiers and snap step.
  var ZOOM = {
    hours: { a: T + 6, b: T + 18, step: 1, snap: '15 min' },
    day: { a: T + 6, b: T + 6 + 72, step: 6, snap: '1 h' },
    week: { a: 6, b: 6 + 168, step: 24, snap: '4 h' },
    weeks: { a: 6, b: 6 + 672, step: 24, snap: '1 day' },
  };

  // Segments a text so numbers, times and job numbers render in Plex Mono.
  var segs = (t) =>
    String(t)
      .split(/(\d[\d ]*(?:[.:]\d+)?)/)
      .filter((x) => x !== '')
      .map((x) => ({ t: x, c: /^\d/.test(x) ? 'num' : '' }));
  var dur = (h) => {
    var m = Math.round(h * 60),
      hh = Math.floor(m / 60),
      mm = m % 60;
    return hh && mm ? hh + ' h ' + mm + ' min' : hh ? hh + ' h' : mm + ' min';
  };
  var BADGE_EN = {
    started: 'Started',
    finpend: 'Finish pending',
    draft: 'In my draft, not saved',
    held: 'Being edited by ',
    lock: 'Locked',
    prop: 'Proposed by assistant',
    conf: 'Overlaps ',
    late: 'Late by ',
    overdue: 'Overdue',
    mat: 'Material short',
    erp: 'ERP change waiting',
    lost: 'Soft lock lost',
    stale: 'Changed by someone else',
  };
  var BADGE_DE = {
    started: 'Gestartet',
    finpend: 'Abschluss ausstehend',
    draft: 'In meinem Entwurf, nicht gespeichert',
    held: 'In Bearbeitung durch ',
    lock: 'Gesperrt',
    prop: 'Vom Assistenten vorgeschlagen',
    conf: 'Überschneidet sich mit ',
    late: 'Verspätet um ',
    overdue: 'Überfällig',
    mat: 'Material fehlt',
    erp: 'ERP-Änderung wartet',
    lost: 'Bearbeitungssperre verloren',
    stale: 'Von jemand anderem geändert',
  };
  var BADGE_C = {
    started: 'b-ok',
    finpend: 'b-info',
    draft: 'b-draft',
    held: 'b-held',
    lock: 'b-mut',
    prop: 'b-info',
    conf: 'b-late',
    late: 'b-late',
    overdue: 'b-late',
    mat: 'b-warn',
    erp: 'b-info',
    lost: 'b-warn',
    stale: 'b-warn',
  };
  // State badges of a job order, for the hover card and the Details tab.
  var badges = (b, strings, extra) => {
    var L = strings === 'long',
      B = L ? BADGE_DE : BADGE_EN,
      st = (b.st || []).concat(extra || []);
    return st.map((k) => {
      var t = B[k];
      if (k === 'held') {
        var p = window.PB.person(b.holder, strings);
        t += (p ? p.name : '') + (L ? ' seit ' : ' since ') + b.since;
      }
      if (k === 'conf') t += b.over;
      if (k === 'late')
        t += L
          ? (b.lateBy || 1) + (b.lateBy === 1 ? ' Tag' : ' Tage')
          : (b.lateBy || 1) + (b.lateBy === 1 ? ' day' : ' days');
      return {
        k: k,
        c: BADGE_C[k],
        segs: segs(t),
        icon: k === 'draft' ? 'Pencil' : k === 'held' ? 'UserPen' : '',
        hasIcon: k === 'draft' || k === 'held',
      };
    });
  };
  // Working hours of a machine calendar inside [s, e]: the breaks and closed time the board hatches do not count.
  var workH = (cal, s, e) => offSpans(cal, s, e).reduce((h, x) => h - (x[1] - x[0]), e - s);
  // Every hover field of a job order (4.14): the hover card shows them and the Details tab repeats them.
  var facts = (b, strings) => {
    var L = strings === 'long',
      T = L ? DE : EN,
      H = T.hc,
      oi = orderInfo(b.order),
      m = machine(b.m),
      g = m ? m.group : null;
    var st = b.st || [],
      started = st.indexOf('started') >= 0 || st.indexOf('finpend') >= 0;
    var setup = 20 / 60,
      run = Math.max(0, (m ? workH(m.cal, b.s, b.e) : b.e - b.s) - setup);
    var an = window.PB.aName(b.a, strings);
    var held = st.indexOf('held') >= 0,
      mine = b.lockMine || (st.indexOf('draft') >= 0 ? '09:36' : '');
    var holder = held
      ? window.PB.person(b.holder, strings).name + (L ? ', seit ' : ', since ') + b.since
      : mine
        ? (L ? 'Sie, seit ' : 'You, since ') + mine
        : H.nobody;
    var lateText =
      st.indexOf('late') >= 0
        ? T.st
            .late(b.lateBy || 1)
            .replace(/^late by /, '')
            .replace(/ verspätet$/, '')
        : st.indexOf('overdue') >= 0
          ? L
            ? 'Überfällig'
            : 'Overdue'
          : H.notLate;
    var rows = [
      [H.op, b.j.split('.')[1] + ', ' + (g ? (L ? g.deOp : g.op) : '')],
      [H.article, (ART[b.a] ? ART[b.a].no + ' ' : '') + an.t, an.lang],
      [H.qty, num(b.q) + ' ' + T.pcs],
      started ? [H.good, H.good2(b.done || 0)] : null,
      [H.setup, at(b.s)],
      [H.run, hm(b.s + setup)],
      [H.end, dayOf(b.e) === dayOf(b.s) ? hm(b.e) : at(b.e)],
      [H.planned, H.planned2(20, dur(run))],
      [H.machine, window.PB.mName(b.m, strings)],
      [H.tool, oi.tool],
      [H.deadline, oi.deadline],
      [H.lateBy, lateText],
      [H.status, st.indexOf('finpend') >= 0 ? H.stFin : started ? H.stStarted : H.stPlanned],
      [H.holder, holder],
      [H.customer, oi.cust],
      [H.drawing, oi.drawing],
      [
        H.surface,
        L
          ? { 'Zinc plated': 'Verzinkt', Anodized: 'Eloxiert', Raw: 'Roh', Painted: 'Lackiert' }[
              oi.surface
            ]
          : oi.surface,
      ],
    ].filter(Boolean);
    return rows.map((r) => ({ k: r[0], segs: segs(r[1]), lang: r[2] || '' }));
  };

  // The night of Sat 24 to Sun 25 Oct 2026 (rules 2.4 and 15), in exact hours since Mon 2 Nov 00:00 CET. Summer time
  // ends at 03:00 CEST, which becomes 02:00 CET at t = -190: the plant day 2026-10-25 has 25 hours and 02:00 runs twice.
  // The Hours preset one Earlier step before Sun 25 Oct 06:00 spans Sat 24 Oct 18:00 CEST to Sun 25 Oct 06:00 CET, 13 h.
  var DST = {
    a: -199,
    b: -186,
    sw: -190,
    // Plant wall clock of an exact instant: CEST is one hour ahead of the CET numbering of t.
    wall: (t) => {
      var cest = t < -190 - 1e-9,
        w = cest ? t + 1 : t;
      return { t: w, zone: cest ? 'CEST' : 'CET', day: dayOf(w), hm: hm(w) };
    },
    // A time carries its zone name when its offset differs from the hour before or after it: 02:00 to 02:59, both times.
    amb: (t) => t > -191 - 1e-9 && t < -189 - 1e-9,
    // Press 4 runs a night shift that weekend from 22:00; every other machine is off all night.
    off: { 'Press 4': [[-199, -195]] },
    jobs: [
      J('1051.10', 'Spacer 8', 3600, -195, -190.5, 13, 'Press 4', [], {
        key: '1051.10',
        order: '1051',
      }),
      J('1052.10', 'Cover plate', 3600, -190.25, -186.5, 9, 'Press 4', [], {
        key: '1052.10',
        order: '1052',
      }),
    ],
  };

  // The connector's contribution to planning/board/block-fields/v1 (rules 4.16 and 10.2). Per block a synchronous
  // render returns a short text, an icon and accessibleText; the board draws them at the trailing edge and adds the
  // accessibleText to the block's name. Its hover renderer returns the fields the hover card and Details show.
  var FIELDS = {
    '1012.30': {
      text: 'ERP change',
      icon: 'FileDiff',
      acc: 'pending ERP change, quantity 480 to 600 pcs',
      hover: [
        ['Pending change', 'Quantity 480 to 600 pcs, sent by Pyramid at 09:20'],
        ['In ERP', 'Released'],
      ],
    },
    '1002.10': {
      text: 'Differs',
      icon: 'GitCompareArrows',
      acc: 'differs from ERP, ERP start 10:15',
      hover: [
        ['Differs from ERP', 'ERP start Tue 3 Nov 10:15, plan start 09:45'],
        ['In ERP', 'Released'],
      ],
    },
    '1027.30': {
      text: 'Not mirrored',
      icon: 'CloudOff',
      acc: 'not mirrored to ERP',
      hover: [
        ['Not mirrored', 'Plan changes since 07:15 have not reached Pyramid'],
        ['In ERP', 'Released'],
      ],
    },
    '1013.10': {
      text: 'Stale',
      icon: 'RefreshCwOff',
      acc: 'source stale, the import of order 1013 failed at 06:40',
      hover: [
        [
          'Source',
          'Stale. The import of order 1013 failed at 06:40, so the board shows Mon 2 Nov 22:10',
        ],
        ['In ERP', 'Released'],
      ],
    },
  };

  window.PB = {
    NB: NB,
    hm: hm,
    at: at,
    num: num,
    dayOf: dayOf,
    dayLabel: dayLabel,
    isoWeek: isoWeek,
    NOW: NOW,
    FROZEN_END: NOW + 4,
    ART: ART,
    GROUPS: GROUPS,
    MACHINES: MACHINES,
    machine: machine,
    CAL: CAL,
    offSpans: offSpans,
    workH: workH,
    DST: DST,
    FIELDS: FIELDS,
    JOBS: JOBS,
    jobsOn: jobsOn,
    job: job,
    NOTPLACED: NOTPLACED,
    MORE: MORE,
    PEOPLE: PEOPLE,
    orderInfo: orderInfo,
    EN: EN,
    DE: DE,
    ZOOM: ZOOM,
    segs: segs,
    dur: dur,
    badges: badges,
    facts: facts,
    tr: (strings) => (strings === 'long' ? DE : EN),
    // Display names for the long-strings variant.
    aName: (a, strings) => {
      var x = ART[a] || {};
      return strings === 'long'
        ? { t: x.de || a, lang: x.deLang || 'de' }
        : { t: a, lang: x.lang || 'en' };
    },
    mName: (m, strings) => {
      var x = machine(m);
      return strings === 'long' && x ? x.de : m;
    },
    gName: (g, strings) => (strings === 'long' ? g.de : g.name),
    person: (k, strings) => {
      var p = PEOPLE[k];
      return p
        ? strings === 'long'
          ? { name: p.de, ini: p.deIni }
          : { name: p.name, ini: p.ini }
        : null;
    },
  };
})();
