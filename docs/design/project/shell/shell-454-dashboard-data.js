/* Data and copy for the spec page shell-454-dashboard.dc.html, issue northMES/northmes#454.
   Every company, plant, person, order, article, machine, number and time here is fictional. Demo day: Monday
   2026-10-12, 10:40 in plant time (05:40 in WS5 and WS6). Numbers follow the default presentation settings
   (space and comma, ISO dates, 24-hour clock).
   The parts read window.DB454S: the screen, the grid, the settings, the catalog and the row parts.
   Layouts are in grid units. lg is the 12-column grid (container 900 px and wider), md the 6-column grid (600 to
   899 px), sm one column in reading order (y, then x). md comes from lg by first-fit packing in reading order.
   Each scene is one frame: who is signed in, at which plant, which tab is open, the mode, what is open and where
   focus is. Frame ids carry the row prefix: SH, PE, ED, TC, WS, TM, WI and KF; odd numbers are light, even dark. */
(() => {
  if (window.DB454S) return;
  var NB = ' ';

  var SIZE = {
    S: { key: 'small', name: 'Small', lg: [3, 2], md: [3, 2] },
    M: { key: 'medium', name: 'Medium', lg: [4, 4], md: [3, 4] },
    L: { key: 'large', name: 'Large', lg: [6, 4], md: [6, 4] },
    T: { key: 'tall', name: 'Tall', lg: [6, 6], md: [6, 6] },
    W: { key: 'wide', name: 'Wide', lg: [12, 4], md: [6, 4] },
  };
  var SIZE_ORDER = ['S', 'M', 'L', 'T', 'W'];
  // Release 1 ships these four types from core, each on demo data. sizes: the allowed sizes, default first.
  var TYPES = {
    list: {
      id: 'core.list',
      name: 'List',
      icon: 'List',
      sizes: ['M', 'L', 'T'],
      resizable: true,
      desc: 'Rows from one data source, such as production orders, with a status on each row.',
    },
    table: {
      id: 'core.table',
      name: 'Table',
      icon: 'Table',
      sizes: ['L', 'T', 'W'],
      resizable: true,
      desc: 'Columns you choose from one data source, sorted and filtered.',
    },
    value: {
      id: 'core.value',
      name: 'Value',
      icon: 'Hash',
      sizes: ['S'],
      resizable: false,
      desc: 'One number, such as good quantity today, with a comparison.',
    },
    chart: {
      id: 'core.chart',
      name: 'Chart',
      icon: 'ChartColumn',
      sizes: ['L', 'M', 'W'],
      resizable: true,
      desc: 'Bars over time for one or two series, such as good quantity per hour.',
    },
    plugin: {
      id: 'andon.calls',
      name: 'Andon calls',
      icon: 'Unplug',
      sizes: ['S'],
      resizable: false,
      desc: '',
    },
  };
  var sizeDim = (k) => SIZE[k].lg[0] + ' by ' + SIZE[k].lg[1];

  // List rows: number, article, status, the line under it, late, lang.
  var R = (no, art, st, sub, late, lang) => ({
    no: no,
    art: art,
    st: st,
    sub: sub,
    late: !!late,
    lang: lang || null,
  });
  var LISTS = {
    late: [
      R('1018', 'Hub 12', 'Active', 'Deadline 2026-10-12 11:00, planned end 13:20', true),
      R('1015', 'Spacer 8', 'Active', 'Deadline 2026-10-12 12:00, planned end 14:05', true),
      R(
        '1007',
        'Housing P',
        'Active',
        'Deadline 2026-10-12 14:00, planned end 2026-10-13 10:30',
        true,
      ),
      R('1012', 'Flange DN50', 'Planned', 'Deadline 2026-10-12 16:00, planned end 21:40', true),
      R('1019', 'Shaft 40', 'Planned', 'Deadline 2026-10-13 06:00, planned end 13:15', true),
      R(
        '1023',
        'Hub 12',
        'Planned',
        'Deadline 2026-10-13 12:00, planned end 2026-10-14 08:00',
        true,
      ),
      R('1031', 'Cover plate', 'Paused', 'Deadline 2026-10-14 10:00, planned end 15:20', true),
    ],
    pressing: [
      R('1004', 'Gear blank 32', 'Active', 'Deadline 2026-10-12 15:00'),
      R('1009', 'Cover plate', 'Paused', 'Deadline 2026-10-12 18:00'),
      R('1015', 'Spacer 8', 'Active', 'Deadline 2026-10-12 12:00', true),
      R('1021', 'Bracket L', 'Planned', 'Deadline 2026-10-13 09:00'),
      R('1026', 'Hub 12', 'Planned', 'Deadline 2026-10-13 14:00'),
    ],
    milling: [
      R('1018', 'Hub 12', 'Active', 'Deadline 2026-10-12 11:00', true),
      R('1001', 'Housing P', 'Active', 'Deadline 2026-10-12 16:00'),
      R('1002', 'Bracket L', 'Planned', 'Deadline 2026-10-12 20:00'),
      R('1014', 'Lagerhus 62', 'Planned', 'Deadline 2026-10-13 10:00', false, 'sv'),
      R('1027', 'Gear blank 32', 'Planned', 'Deadline 2026-10-14 08:00'),
    ],
    jobsMillA: [
      R('1018.20', 'Hub 12', 'Active', 'Mill 1, started 09:00', true),
      R('1001.20', 'Housing P', 'Active', 'CNC1, started 06:04'),
      R('1004.10', 'Gear blank 32', 'Active', 'CNC2, started 06:00'),
      R('1002.10', 'Bracket L', 'Planned', 'CNC1, planned start 12:10'),
      R('1027.10', 'Gear blank 32', 'Planned', 'Mill 1, planned start 14:00'),
    ],
    jobsMillB: [
      R('2041.10', 'Bracket L', 'Active', 'Mill 2, started 06:10'),
      R('2044.20', 'Housing P', 'Active', 'CNC3, started 07:45'),
      R('2047.10', 'Hub 12', 'Planned', 'Mill 2, planned start 11:30'),
      R('2052.10', 'Shaft 40', 'Planned', 'CNC3, planned start 13:00'),
      R('2055.10', 'Cover plate', 'Planned', 'Mill 2, planned start 15:15'),
    ],
  };
  // Tables: grid columns, head, rows; link: the column that links to the entity (-1 none), badge: the status column,
  // mono and num: columns in Plex Mono and right-aligned numbers; minw: the width below which the table scrolls.
  var TABLES = {
    jobsnow: {
      cols: 'minmax(80px,0.8fr) minmax(120px,1.4fr) minmax(80px,0.9fr) 76px 80px 64px 96px',
      head: ['Job', 'Article', 'Machine', 'Started', 'Good', 'Scrap', 'Status'],
      link: 0,
      badge: 6,
      mono: [3],
      num: [4, 5],
      minw: 700,
      rows: [
        ['1001.20', 'Housing P', 'CNC1', '06:04', '40', '1', 'Active'],
        ['1004.10', 'Gear blank 32', 'CNC2', '06:00', '118', '3', 'Active'],
        ['1009.10', 'Cover plate', 'Press 3', '06:15', '104', '12', 'Paused'],
        ['1015.10', 'Spacer 8', 'Press 4', '07:30', '148', '9', 'Active'],
        ['1011.30', 'Shaft 40', 'Lathe 1', '08:10', '85', '0', 'Active'],
        ['1018.20', 'Hub 12', 'Mill 1', '09:00', '22', '2', 'Active'],
      ],
    },
    press4jobs: {
      cols: 'minmax(80px,0.8fr) minmax(110px,1.4fr) 64px 64px 96px',
      head: ['Job', 'Article', 'Start', 'Good', 'Status'],
      link: 0,
      badge: 4,
      mono: [2],
      num: [3],
      minw: 460,
      rows: [
        ['1015.10', 'Spacer 8', '07:30', '148', 'Active'],
        ['1021.10', 'Bracket L', '11:45', '0', 'Planned'],
        ['1026.10', 'Hub 12', '14:10', '0', 'Planned'],
        ['1033.10', 'Spacer 8', '16:30', '0', 'Planned'],
        ['1036.10', 'Cover plate', '19:00', '0', 'Planned'],
      ],
    },
    jobsPressing: {
      cols: 'minmax(76px,0.8fr) minmax(110px,1.4fr) minmax(70px,0.8fr) 64px 92px',
      head: ['Job', 'Article', 'Machine', 'Good', 'Status'],
      link: 0,
      badge: 4,
      mono: [],
      num: [3],
      minw: 460,
      rows: [
        ['1015.10', 'Spacer 8', 'Press 4', '148', 'Active'],
        ['1009.10', 'Cover plate', 'Press 3', '104', 'Paused'],
        ['1021.10', 'Bracket L', 'Press 4', '0', 'Planned'],
        ['1026.10', 'Hub 12', 'Press 4', '0', 'Planned'],
      ],
    },
    jobsMilling: {
      cols: 'minmax(76px,0.8fr) minmax(70px,0.9fr) 64px 64px 92px',
      head: ['Job', 'Machine', 'Start', 'Scrap', 'Status'],
      link: 0,
      badge: 4,
      mono: [2],
      num: [3],
      minw: 420,
      rows: [
        ['1004.10', 'CNC2', '06:00', '3', 'Active'],
        ['1001.20', 'CNC1', '06:04', '1', 'Active'],
        ['1018.20', 'Mill 1', '09:00', '2', 'Active'],
        ['1002.10', 'CNC1', '12:10', '0', 'Planned'],
      ],
    },
    plants: {
      cols: 'minmax(90px,1.2fr) 80px 64px 90px 56px',
      head: ['Plant', 'Good', 'Scrap', 'Scrap rate', 'Late'],
      link: 0,
      badge: -1,
      mono: [],
      num: [1, 2, 3, 4],
      minw: 420,
      rows: [
        ['Plant A', '1' + NB + '284', '37', '2,8' + NB + '%', '7'],
        ['Plant B', '968', '22', '2,2' + NB + '%', '4'],
      ],
    },
    reasons: {
      cols: 'minmax(100px,1.4fr) minmax(90px,1fr) 70px',
      head: ['Reason', 'Machine', 'Scrap'],
      link: -1,
      badge: -1,
      mono: [],
      num: [2],
      minw: 300,
      rows: [
        ['Burr', 'Press 3', '12'],
        ['Dimension', 'CNC2', '9'],
        ['Surface', 'Press 4', '8'],
        ['Material', 'Lathe 1', '5'],
        ['Other', 'Mill 1', '3'],
      ],
    },
  };
  var CHARTS = {
    perhour: {
      series: [
        { name: 'Press 3', cls: 'db-s1' },
        { name: 'Press 4', cls: 'db-s2' },
      ],
      groups: [
        ['03', 30, 44],
        ['04', 28, 42],
        ['05', 32, 46],
        ['06', 34, 48],
        ['07', 36, 50],
        ['08', 38, 47],
        ['09', 8, 52],
        ['10', 0, 31],
      ],
      max: 60,
      ticks: ['0', '20', '40', '60'],
      alt: 'Good quantity per hour, 03:00 to 10:40. Press 4 makes 42 to 52 pieces an hour. Press 3 makes 28 to 38, drops to 8 at 09:00 and has 0 since.',
    },
    press4: {
      series: [{ name: 'Press 4', cls: 'db-s1' }],
      groups: [
        ['Tue', 1060],
        ['Wed', 1115],
        ['Thu', 840],
        ['Fri', 1130],
        ['Mon', 360],
      ],
      max: 1200,
      ticks: ['0', '400', '800', '1' + NB + '200'],
      alt: 'Good quantity on Press 4 per day, Tuesday to today: 1 060, 1 115, 840, 1 130, and 360 so far today.',
    },
    shiftsA: {
      series: [{ name: 'Scrap', cls: 'db-s1' }],
      groups: [
        ['Early', 16],
        ['Late', 21],
        ['Night', 12],
        ['Early', 9],
      ],
      max: 30,
      ticks: ['0', '10', '20', '30'],
      alt: 'Scrap per shift at Plant A, the last four shifts: 16, 21, 12 and 9 pieces.',
    },
    shiftsB: {
      series: [{ name: 'Scrap', cls: 'db-s1' }],
      groups: [
        ['Early', 14],
        ['Late', 22],
        ['Night', 9],
        ['Early', 11],
      ],
      max: 30,
      ticks: ['0', '10', '20', '30'],
      alt: 'Scrap per shift at Plant B, the last four shifts: 14, 22, 9 and 11 pieces.',
    },
    millDay: {
      series: [{ name: 'Mill 1', cls: 'db-s1' }],
      groups: [
        ['Tue', 410],
        ['Wed', 455],
        ['Thu', 380],
        ['Fri', 470],
        ['Mon', 160],
      ],
      max: 600,
      ticks: ['0', '200', '400', '600'],
      alt: 'Good quantity on Mill 1 per day, Tuesday to today: 410, 455, 380, 470, and 160 so far today.',
    },
    acmeDay: {
      series: [
        { name: 'Plant A', cls: 'db-s1' },
        { name: 'Plant B', cls: 'db-s2' },
      ],
      groups: [
        ['Tue', 2510, 1820],
        ['Wed', 2630, 1905],
        ['Thu', 2280, 1760],
        ['Fri', 2700, 1990],
        ['Mon', 1284, 968],
      ],
      max: 3000,
      ticks: ['0', '1' + NB + '000', '2' + NB + '000', '3' + NB + '000'],
      alt: 'Good quantity per day at Acme AB, Tuesday to today. Plant A makes 2 280 to 2 700 a day, Plant B 1 760 to 1 990; so far today 1 284 and 968.',
    },
  };

  // Placed widgets. set: the widget's settings as its Sheet shows them. at: what changes at another plant (st is the
  // widget's state there). perm names the data a widget without permission stands for.
  var LIST_STATUS = ['Planned', 'Active', 'Paused'];
  var W = {
    good: {
      type: 'value',
      title: 'Good today',
      size: 'S',
      v: '1' + NB + '284',
      u: 'pcs',
      c: '96 more than at this time yesterday',
      trend: 'TrendingUp',
      set: {
        measure: 'Good quantity',
        where: 'Plant A',
        period: 'Today',
        compare: 'Yesterday at this time',
      },
    },
    scrap: {
      type: 'value',
      title: 'Scrap today',
      size: 'S',
      v: '37',
      u: 'pcs',
      c: '2,8 % of the reported quantity',
      cid: '01JA2V7Q9K3M5T',
      set: {
        measure: 'Scrap quantity',
        where: 'Plant A',
        period: 'Today',
        compare: 'Share of the reported quantity',
      },
    },
    late: {
      type: 'value',
      title: 'Late production orders',
      size: 'S',
      v: '7',
      u: '',
      c: '3 more than yesterday',
      trend: 'TrendingUp',
      set: {
        measure: 'Late production orders',
        where: 'Plant A',
        period: 'Now',
        compare: 'Yesterday',
      },
    },
    running: {
      type: 'value',
      title: 'Machines running',
      size: 'S',
      v: '31',
      u: 'of 40',
      c: 'Press 3 paused since 09:12',
      set: { measure: 'Machines running', where: 'Plant A', period: 'Now', compare: 'None' },
    },
    perhour: {
      type: 'chart',
      title: 'Good quantity per hour',
      size: 'L',
      chart: 'perhour',
      cid: '01JA2V8B4N7W2R',
      set: {
        measure: 'Good quantity',
        series: ['Press 3', 'Press 4'],
        groupBy: 'Hour',
        period: 'Today',
      },
    },
    latelist: {
      type: 'list',
      title: 'Late production orders',
      size: 'L',
      list: 'late',
      more: 'All 7 late production orders',
      set: {
        source: 'Late production orders',
        group: 'All equipment groups',
        statuses: LIST_STATUS,
        rows: 5,
      },
    },
    jobsnow: {
      type: 'table',
      title: 'Jobs running now',
      size: 'W',
      table: 'jobsnow',
      more: 'All 23 running jobs',
      set: {
        source: 'Jobs',
        group: 'All equipment groups',
        cols: ['Job', 'Article', 'Machine', 'Started', 'Good', 'Scrap', 'Status'],
        sort: 'Started, oldest first',
        rows: 6,
      },
    },

    q1: {
      type: 'value',
      title: 'Scrap today',
      size: 'S',
      v: '37',
      u: 'pcs',
      c: 'Press 3 has 12 of them',
    },
    q2: {
      type: 'value',
      title: 'Scrap rate today',
      size: 'S',
      v: '2,8',
      u: '%',
      c: '0,4 points lower than yesterday',
      trend: 'TrendingDown',
    },
    q3: { type: 'chart', title: 'Scrap per shift', size: 'L', chart: 'shiftsA' },
    q4: {
      type: 'table',
      title: 'Scrap by reason today',
      size: 'L',
      table: 'reasons',
      more: 'All scrap reports today',
    },

    a1: {
      type: 'value',
      title: 'Good today, Acme AB',
      size: 'S',
      v: '2' + NB + '252',
      u: 'pcs',
      c: 'Plant A 1' + NB + '284, Plant B 968',
    },
    a2: {
      type: 'value',
      title: 'Late production orders, Acme AB',
      size: 'S',
      v: '11',
      u: '',
      c: 'Plant A 7, Plant B 4',
    },
    a3: {
      type: 'value',
      title: 'Machines running, Acme AB',
      size: 'S',
      v: '55',
      u: 'of 72',
      c: 'Plant A 31 of 40, Plant B 24 of 32',
    },
    a4: { type: 'table', title: 'Today by plant', size: 'L', table: 'plants', more: '' },
    a5: { type: 'chart', title: 'Good quantity per day, Acme AB', size: 'L', chart: 'acmeDay' },

    pressing: {
      type: 'list',
      title: 'Production orders, Pressing',
      size: 'M',
      list: 'pressing',
      more: 'All 9 in Pressing',
      set: { source: 'Production orders', group: 'Pressing', statuses: LIST_STATUS, rows: 5 },
    },
    milling: {
      type: 'list',
      title: 'Production orders, Milling',
      size: 'M',
      list: 'milling',
      more: 'All 14 in Milling',
      set: { source: 'Production orders', group: 'Milling', statuses: LIST_STATUS, rows: 5 },
    },
    press4: {
      type: 'chart',
      title: 'Good quantity, Press 4',
      size: 'M',
      chart: 'press4',
      set: {
        measure: 'Good quantity',
        series: ['Press 4'],
        groupBy: 'Day',
        period: 'Last 5 working days',
      },
    },
    notplaced: {
      type: 'value',
      title: 'Jobs not placed',
      size: 'S',
      v: '4',
      u: '',
      c: "On the board's Not placed row",
      set: { measure: 'Jobs not placed', where: 'Plant A', period: 'Now', compare: 'None' },
    },
    mylate: {
      type: 'value',
      title: 'Late production orders',
      size: 'S',
      v: '7',
      u: '',
      c: '3 more than yesterday',
      trend: 'TrendingUp',
      set: {
        measure: 'Late production orders',
        where: 'Plant A',
        period: 'Now',
        compare: 'Yesterday',
      },
    },

    b1: {
      type: 'table',
      title: 'Jobs on Press 4',
      size: 'L',
      table: 'press4jobs',
      more: 'All 6 jobs on Press 4',
      emptyHead: 'No jobs on Press 4',
      emptyText: 'No job is running or planned on Press 4 today.',
      at: { 'Plant B': { st: 'missing', stText: 'Press 4 is not a machine at Plant B.' } },
    },
    b3: {
      type: 'value',
      title: 'Downtime today',
      size: 'S',
      v: '128',
      u: 'min',
      c: 'Press 3: 88 min since 09:12',
      at: { 'Plant B': { st: 'forbidden', perm: 'machine downtime' } },
    },
    b4: {
      type: 'value',
      title: 'Scrap today',
      size: 'S',
      v: '37',
      u: 'pcs',
      c: '2,8 % of the reported quantity',
      at: { 'Plant B': { v: '22', c: '2,2 % of the reported quantity' } },
    },
    b8: {
      type: 'value',
      title: 'Good today',
      size: 'S',
      v: '1' + NB + '284',
      u: 'pcs',
      c: '96 more than at this time yesterday',
      trend: 'TrendingUp',
      at: {
        'Plant B': { v: '968', c: '40 fewer than at this time yesterday', trend: 'TrendingDown' },
      },
    },
    b9: {
      type: 'value',
      title: 'Late production orders',
      size: 'S',
      v: '7',
      u: '',
      c: '3 more than yesterday',
      trend: 'TrendingUp',
      at: { 'Plant B': { v: '4', c: '1 more than yesterday' } },
    },
    b2: {
      type: 'list',
      title: 'Production orders, Pressing',
      size: 'M',
      list: 'pressing',
      more: 'All 9 in Pressing',
      emptyHead: 'No production orders',
      emptyText: 'No production orders match these settings at Plant A.',
      at: {
        'Plant B': { st: 'missing', stText: 'Pressing is not an equipment group at Plant B.' },
      },
    },
    b7: {
      type: 'list',
      title: 'Jobs, Milling',
      size: 'M',
      list: 'jobsMillA',
      more: 'All 11 jobs in Milling',
      emptyHead: 'No jobs',
      emptyText: 'No jobs match these settings at Plant A.',
      at: { 'Plant B': { list: 'jobsMillB', more: 'All 8 jobs in Milling' } },
    },
    b5: {
      type: 'chart',
      title: 'Scrap per shift',
      size: 'M',
      chart: 'shiftsA',
      emptyHead: 'No scrap reported',
      emptyText: 'No scrap was reported in the last 4 shifts.',
      at: { 'Plant B': { chart: 'shiftsB' } },
    },

    la: {
      type: 'list',
      title: 'Production orders, Pressing',
      size: 'L',
      list: 'pressing',
      more: 'All 9 in Pressing',
      set: { source: 'Production orders', group: 'Pressing', statuses: LIST_STATUS, rows: 5 },
    },
    lb: {
      type: 'list',
      title: 'Production orders, Milling',
      size: 'L',
      list: 'milling',
      more: 'All 14 in Milling',
      set: {
        source: 'Production orders',
        group: 'Milling',
        statuses: ['Registered', 'Planned', 'Active', 'Paused'],
        rows: 5,
      },
    },
    ca: {
      type: 'chart',
      title: 'Good quantity per hour, Press 3 and Press 4',
      size: 'L',
      chart: 'perhour',
      set: {
        measure: 'Good quantity',
        series: ['Press 3', 'Press 4'],
        groupBy: 'Hour',
        period: 'Today',
      },
    },
    cb: {
      type: 'chart',
      title: 'Good quantity per day, Mill 1',
      size: 'L',
      chart: 'millDay',
      set: {
        measure: 'Good quantity',
        series: ['Mill 1'],
        groupBy: 'Day',
        period: 'Last 5 working days',
      },
    },
    ta: {
      type: 'table',
      title: 'Jobs, Pressing',
      size: 'L',
      table: 'jobsPressing',
      more: 'All 4 jobs in Pressing',
      set: {
        source: 'Jobs',
        group: 'Pressing',
        cols: ['Job', 'Article', 'Machine', 'Good', 'Status'],
        sort: 'Status, then job',
        rows: 6,
      },
    },
    tb: {
      type: 'table',
      title: 'Jobs, Milling',
      size: 'L',
      table: 'jobsMilling',
      more: 'All 11 jobs in Milling',
      set: {
        source: 'Jobs',
        group: 'Milling',
        cols: ['Job', 'Machine', 'Start', 'Scrap', 'Status'],
        sort: 'Start, earliest first',
        rows: 6,
      },
    },
    va: {
      type: 'value',
      title: 'Good today, Pressing',
      size: 'S',
      v: '252',
      u: 'pcs',
      c: 'Press 3 104, Press 4 148',
      set: {
        measure: 'Good quantity',
        where: 'Equipment group Pressing',
        period: 'Today',
        compare: 'One figure per machine',
      },
    },
    vb: {
      type: 'value',
      title: 'Good today, Milling',
      size: 'S',
      v: '180',
      u: 'pcs',
      c: 'CNC1 40, CNC2 118, Mill 1 22',
      set: {
        measure: 'Good quantity',
        where: 'Equipment group Milling',
        period: 'Today',
        compare: 'One figure per machine',
      },
    },

    newgood: {
      type: 'value',
      title: 'Good today',
      size: 'S',
      v: '1' + NB + '284',
      u: 'pcs',
      c: '96 more than at this time yesterday',
      trend: 'TrendingUp',
    },
    andon: { type: 'plugin', title: 'Andon calls', size: 'S', st: 'removed' },
  };

  // Tabs. scope: company, plant or mine. A shared tab belongs to a scope node; an own tab to its user.
  var P = (id, x, y) => ({ id: id, x: x, y: y });
  var SHIFT = [
    P('good', 0, 0),
    P('scrap', 3, 0),
    P('late', 6, 0),
    P('running', 9, 0),
    P('perhour', 0, 2),
    P('latelist', 6, 2),
    P('jobsnow', 0, 6),
  ];
  var TABS = {
    acme: {
      name: 'Acme overview',
      scope: 'company',
      widgets: [P('a1', 0, 0), P('a2', 3, 0), P('a3', 6, 0), P('a4', 0, 2), P('a5', 6, 2)],
    },
    shift: { name: 'Shift overview', scope: 'plant', widgets: SHIFT },
    quality: {
      name: 'Quality',
      scope: 'plant',
      widgets: [P('q1', 0, 0), P('q2', 3, 0), P('q3', 6, 0), P('q4', 0, 2)],
    },
    bshift: { name: 'Plant B overview', scope: 'plant', widgets: [] },
    maint: { name: 'Maintenance', scope: 'plant', widgets: [] },
    ship: { name: 'Shipping today', scope: 'plant', widgets: [] },
    presshall: { name: 'Press hall', scope: 'plant', widgets: [] },
    millhall: { name: 'Mill hall', scope: 'plant', widgets: [] },
    myshift: {
      name: 'My shift',
      scope: 'mine',
      widgets: [
        P('pressing', 0, 0),
        P('milling', 4, 0),
        P('press4', 8, 0),
        P('notplaced', 0, 4),
        P('mylate', 3, 4),
      ],
    },
    pressline: {
      name: 'Press line',
      scope: 'mine',
      widgets: [
        P('b1', 0, 0),
        P('b3', 6, 0),
        P('b4', 9, 0),
        P('b8', 6, 2),
        P('b9', 9, 2),
        P('b2', 0, 4),
        P('b7', 4, 4),
        P('b5', 8, 4),
      ],
    },
    night: { name: 'Night shift', scope: 'mine', widgets: [] },
    checks: { name: 'Admin checks', scope: 'mine', widgets: [] },
    weekly: { name: 'Weekly review', scope: 'mine', widgets: [] },
    pressmill: {
      name: 'Press and mill',
      scope: 'mine',
      widgets: [
        P('la', 0, 0),
        P('lb', 6, 0),
        P('ca', 0, 4),
        P('cb', 6, 4),
        P('ta', 0, 8),
        P('tb', 6, 8),
        P('va', 0, 12),
        P('vb', 3, 12),
      ],
    },
    shiftcopy: { name: 'Copy of Shift overview', scope: 'mine', widgets: SHIFT },
  };
  // The tabs each person sees at a plant, in order: company tabs, plant tabs, own tabs.
  var TABLISTS = {
    alexA: { company: ['acme'], plant: ['shift', 'quality'], mine: ['myshift', 'pressline'] },
    alexA6: {
      company: ['acme'],
      plant: ['shift', 'quality'],
      mine: ['myshift', 'pressline', 'night'],
    },
    alexTC: {
      company: ['acme'],
      plant: ['shift', 'quality'],
      mine: ['myshift', 'pressline', 'pressmill'],
    },
    alexSwap: { company: ['acme'], plant: ['shift', 'quality'], mine: ['pressline', 'myshift'] },
    alexCopy: {
      company: ['acme'],
      plant: ['shift', 'quality'],
      mine: ['myshift', 'pressline', 'shiftcopy'],
    },
    alexB: { company: ['acme'], plant: ['bshift'], mine: ['myshift', 'pressline'] },
    jonasA: { company: ['acme'], plant: ['shift', 'quality'], mine: ['checks'] },
    jonasMany: {
      company: ['acme'],
      plant: ['shift', 'quality', 'maint', 'ship', 'presshall', 'millhall'],
      mine: ['checks', 'weekly'],
    },
    karinA: { company: ['acme'], plant: ['shift', 'quality'], mine: [] },
    lenaC: { company: [], plant: [], mine: [] },
  };
  var PEOPLE = {
    alex: { user: 'Alex Lund', username: 'alex.lund' },
    jonas: { user: 'Jonas Holm', username: 'jonas.holm' },
    karin: { user: 'Karin Dahl', username: 'karin.dahl' },
    lena: { user: 'Lena Ek', username: 'lena.ek' },
  };
  var SLUG = { 'Plant A': 'plant-a', 'Plant B': 'plant-b', 'Plant C': 'plant-c' };
  // Who may change a tab: an own tab always; a shared tab with core.dashboardTab:manage (proposed) held at its node or
  // above. Karin Dahl holds it at Acme AB, Jonas Holm at Plant A; Alex Lund and Lena Ek hold it nowhere.
  var mayEdit = (who, plant, scope) => {
    if (scope === 'mine') return true;
    if (who === 'karin') return true;
    if (who === 'jonas') return scope === 'plant' && plant === 'Plant A';
    return false;
  };

  // A widget as it shows in a scene: the plant's overrides, then the scene's states and overrides.
  var widget = (id, S) => {
    var b = W[id];
    var o = {},
      k;
    for (k in b) o[k] = b[k];
    var at = b.at && S && b.at[S.plant];
    if (at) for (k in at) o[k] = at[k];
    if (S && S.over && S.over[id]) for (k in S.over[id]) o[k] = S.over[id][k];
    if (S && S.states && S.states[id]) o.st = S.states[id];
    if (S && S.loading) o.st = 'loading';
    if (S && S.sizes && S.sizes[id]) o.size = S.sizes[id];
    o.id = id;
    return o;
  };

  // First-fit packing in reading order: each widget takes the first place, row by row, where it fits.
  var pack = (items, cols) => {
    var used = {};
    var free = (x, y, w, h) => {
      for (var r = y; r < y + h; r++)
        for (var c = x; c < x + w; c++) if (used[r + ':' + c]) return false;
      return true;
    };
    return items.map((it) => {
      for (var y = 0; y < 200; y++) {
        for (var x = 0; x + it.w <= cols; x++) {
          if (free(x, y, it.w, it.h)) {
            for (var r = y; r < y + it.h; r++)
              for (var c = x; c < x + it.w; c++) used[r + ':' + c] = true;
            return { id: it.id, x: x, y: y, w: it.w, h: it.h };
          }
        }
      }
      return { id: it.id, x: 0, y: 0, w: it.w, h: it.h };
    });
  };
  var readingOrder = (ws) => ws.slice().sort((a, b) => a.y - b.y || a.x - b.x);
  // Positions of the scene's widgets at 12, 6 or 1 columns. pos overrides positions (a move), add places new widgets,
  // order fixes the one-column order (a move at one column).
  var layout = (S, cols, posKey) => {
    var t = TABS[S.tab];
    if (!t) return [];
    var ws = t.widgets
      .map((p) => ({ id: p.id, x: p.x, y: p.y }))
      .concat((S.add || []).map((p) => ({ id: p.id, x: p.x, y: p.y })));
    var pos = S[posKey || 'pos'];
    if (pos)
      ws.forEach((o) => {
        if (pos[o.id]) {
          o.x = pos[o.id][0];
          o.y = pos[o.id][1];
        }
      });
    ws = readingOrder(ws);
    var sizeOf = (id) => SIZE[widget(id, S).size];
    if (cols === 12)
      return ws.map((p) => {
        var s = sizeOf(p.id).lg;
        return { id: p.id, x: p.x, y: p.y, w: s[0], h: s[1] };
      });
    if (cols === 6)
      return pack(
        ws.map((p) => {
          var s = sizeOf(p.id).md;
          return { id: p.id, w: s[0], h: s[1] };
        }),
        6,
      );
    if (S.order) ws = S.order.map((id) => ({ id: id }));
    var y = 0;
    return ws.map((p) => {
      var h = sizeOf(p.id).lg[1];
      var o = { id: p.id, x: 0, y: y, w: 1, h: h };
      y += h;
      return o;
    });
  };
  // The first place, in reading order, where a widget of w by h fits; after the last widget when none is free.
  var firstFree = (items, cols, w, h) => {
    var used = {};
    items.forEach((o) => {
      for (var r = o.y; r < o.y + o.h; r++)
        for (var c = o.x; c < o.x + o.w; c++) used[r + ':' + c] = true;
    });
    for (var y = 0; y < 80; y++)
      for (var x = 0; x + w <= cols; x++) {
        var ok = true;
        for (var r = y; r < y + h && ok; r++)
          for (var c = x; c < x + w; c++)
            if (used[r + ':' + c]) {
              ok = false;
              break;
            }
        if (ok) return [x, y];
      }
    return [0, 0];
  };

  // Scenes, one per frame.
  var SC = {};
  var base = {
    w: '1440',
    theme: 'light',
    h: 0,
    who: 'alex',
    plant: 'Plant A',
    tabs: 'alexA',
    tab: 'myshift',
    mode: 'view',
  };
  var mk = (id, o) => {
    var x = {},
      k;
    for (k in base) x[k] = base[k];
    for (k in o) x[k] = o[k];
    x.id = id;
    SC[id] = x;
  };
  var pair = (pre, n, o) => {
    var a = {},
      b = {},
      k;
    for (k in o) {
      a[k] = o[k];
      b[k] = o[k];
    }
    a.theme = 'light';
    b.theme = 'dark';
    mk(pre + (2 * n - 1), a);
    mk(pre + 2 * n, b);
  };
  var JONAS = { who: 'jonas', tabs: 'jonasA' };
  var KARIN = { who: 'karin', tabs: 'karinA' };
  var j = (o) => {
    var x = {},
      k;
    for (k in JONAS) x[k] = JONAS[k];
    for (k in o) x[k] = o[k];
    return x;
  };
  var kd = (o) => {
    var x = {},
      k;
    for (k in KARIN) x[k] = KARIN[k];
    for (k in o) x[k] = o[k];
    return x;
  };
  var MOVED = { milling: [5, 0], press4: [8, 4] };
  var PICKUP =
    'Production orders, Milling picked up. Column 5, row 1. Arrow keys move it, Enter drops it, Escape cancels.';

  // Row 1, shared tabs
  pair('SH', 1, { tab: 'shift' });
  pair('SH', 2, { tab: 'acme' });
  pair('SH', 3, j({ tab: 'shift' }));
  pair('SH', 4, j({ tab: 'shift', mode: 'edit', focus: 'editbar' }));
  pair('SH', 5, j({ tab: 'acme' }));
  pair('SH', 6, kd({ tab: 'acme' }));
  pair('SH', 7, kd({ tab: 'acme', mode: 'edit', focus: 'editbar' }));
  // Row 2, own tabs
  pair('PE', 1, { tab: 'myshift' });
  pair('PE', 2, { tabs: 'alexA6', tab: 'night' });
  pair('PE', 3, { tabs: 'alexA6', tab: 'night', mode: 'edit', focus: 'tile' });
  pair('PE', 4, { tab: 'pressline' });
  pair('PE', 5, { tabs: 'alexB', tab: 'pressline', plant: 'Plant B' });
  // Row 3, edit mode on My shift
  pair('ED', 1, { mode: 'edit', focus: 'editbar' });
  pair('ED', 2, { mode: 'edit', panel: 'catalog', tileOpen: true });
  pair('ED', 3, { mode: 'edit', panel: 'catalog', tileOpen: true, catQuery: 'chart' });
  pair('ED', 4, {
    mode: 'edit',
    add: [{ id: 'newgood', x: 6, y: 4 }],
    focus: 'move:newgood',
    ann: ['Good today added at column 7, row 5.'],
  });
  pair('ED', 5, { mode: 'edit', target: 'milling', menu: 'widget' });
  pair('ED', 6, { mode: 'edit', target: 'milling', panel: 'settings', sheetFocus: 'title' });
  pair('ED', 7, {
    mode: 'edit',
    target: 'milling',
    panel: 'settings',
    sheetFocus: 'right',
    sheetPos: MOVED,
    ann: ['Column 6, row 1. 1 other widget moves down.'],
  });
  pair('ED', 8, {
    mode: 'edit',
    target: 'milling',
    pos: MOVED,
    focus: 'actions:milling',
    ann: ['Settings applied. Production orders, Milling is at column 6, row 1.'],
  });
  pair('ED', 9, { mode: 'edit', pos: MOVED, dialog: 'leave' });
  pair(
    'ED',
    10,
    j({
      tab: 'shift',
      mode: 'edit',
      pos: { perhour: [6, 2], latelist: [0, 2] },
      dialog: 'conflict',
    }),
  );
  // Row 4, two copies of each type on Press and mill (1440 by 1500)
  pair('TC', 1, { tabs: 'alexTC', tab: 'pressmill', h: 1500 });
  pair('TC', 2, {
    tabs: 'alexTC',
    tab: 'pressmill',
    h: 1500,
    mode: 'edit',
    target: 'lb',
    panel: 'settings',
  });
  pair('TC', 3, {
    tabs: 'alexTC',
    tab: 'pressmill',
    h: 1500,
    mode: 'edit',
    target: 'tb',
    panel: 'settings',
  });
  pair('TC', 4, {
    tabs: 'alexTC',
    tab: 'pressmill',
    h: 1500,
    mode: 'edit',
    target: 'vb',
    panel: 'settings',
  });
  pair('TC', 5, {
    tabs: 'alexTC',
    tab: 'pressmill',
    h: 1500,
    mode: 'edit',
    target: 'cb',
    panel: 'settings',
  });
  // Row 5, widget states
  pair('WS', 1, { tab: 'myshift', loading: true });
  pair('WS', 2, { tab: 'shift', states: { scrap: 'error', perhour: 'render' } });
  pair('WS', 3, {
    tab: 'pressline',
    states: { b1: 'empty', b2: 'empty', b7: 'empty', b5: 'empty' },
    over: {
      b3: { v: '0', c: 'No downtime reported today' },
      b4: { v: '0', c: 'No quantity reported yet today' },
      b8: { v: '0', c: 'The early shift starts at 06:00', trend: '' },
      b9: { trend: '' },
    },
  });
  pair('WS', 4, { tab: 'myshift', add: [{ id: 'andon', x: 6, y: 4 }] });
  pair('WS', 5, {
    tab: 'myshift',
    add: [{ id: 'andon', x: 6, y: 4 }],
    mode: 'edit',
    target: 'andon',
    menu: 'widget',
  });
  pair('WS', 6, { tab: 'shift', pageState: 'tabError' });
  pair('WS', 7, { tab: 'acme', status: 'unknownTab', focus: 'h1' });
  pair('WS', 8, { who: 'lena', plant: 'Plant C', tabs: 'lenaC', tab: '', pageState: 'noTabs' });
  // Row 6, tab management
  pair('TM', 1, { tab: 'myshift', dialog: 'newTab' });
  pair('TM', 2, j({ tab: 'shift', dialog: 'newTabShared' }));
  pair('TM', 3, j({ tab: 'shift', dialog: 'newTabTaken' }));
  pair('TM', 4, { tab: 'myshift', menu: 'tabActions' });
  pair('TM', 5, { tab: 'myshift', dialog: 'rename' });
  pair('TM', 6, {
    tabs: 'alexSwap',
    tab: 'myshift',
    focus: 'tabActions',
    ann: ['My shift moved to position 2 of 2 in your tabs.'],
  });
  pair('TM', 7, { tab: 'pressline', dialog: 'deleteMine' });
  pair('TM', 8, j({ tab: 'quality', menu: 'tabActions' }));
  pair('TM', 9, j({ tab: 'quality', dialog: 'deleteShared' }));
  pair('TM', 10, { tab: 'quality', menu: 'tabActions' });
  pair('TM', 11, {
    tab: 'shift',
    hidden: ['quality'],
    focus: 'tab:shift',
    ann: ['Quality is hidden for you. Hidden tabs shows it again.'],
  });
  pair('TM', 12, { tab: 'shift', hidden: ['quality'], menu: 'hiddenTabs' });
  pair('TM', 13, {
    tabs: 'alexCopy',
    tab: 'shiftcopy',
    focus: 'tab:shiftcopy',
    ann: ['Shift overview copied to your tabs as Copy of Shift overview.'],
  });
  pair('TM', 14, { who: 'jonas', tabs: 'jonasMany', tab: 'shift', more: 5, menu: 'moreTabs' });
  // Row 7, widths
  pair('WI', 1, { w: '1280', tab: 'shift' });
  pair('WI', 2, { w: '1920', tab: 'shift' });
  pair('WI', 3, { w: '1280', tab: 'myshift', mode: 'edit' });
  pair('WI', 4, { w: '1920', tab: 'myshift', mode: 'edit' });
  pair('WI', 5, { w: '320', tab: 'myshift' });
  pair('WI', 6, { w: '320', tab: 'myshift', menu: 'tabSelect' });
  pair('WI', 7, { w: '320', tab: 'shift', scrollY: 1700, focus: 'table:jobsnow' });
  pair('WI', 8, { w: '320', tab: 'myshift', mode: 'edit', target: 'pressing', menu: 'widget' });
  pair('WI', 9, { w: '320', tab: 'myshift', mode: 'edit', target: 'milling', panel: 'settings' });
  pair('WI', 10, { w: '320', tab: 'myshift', mode: 'edit', panel: 'catalog' });
  // Row 8, keyboard and focus
  pair('KF', 1, j({ tab: 'shift', kf: true }));
  pair('KF', 2, { tab: 'myshift', mode: 'edit', kf: true });
  pair('KF', 3, { tab: 'shift', focus: 'tab:quality' });
  pair('KF', 4, {
    mode: 'edit',
    lift: 'milling',
    focus: 'move:milling',
    ghost: [4, 0, 4, 4],
    ann: [PICKUP],
  });
  pair('KF', 5, {
    mode: 'edit',
    lift: 'milling',
    focus: 'move:milling',
    pos: { milling: [6, 4] },
    ghost: [4, 0, 4, 4],
    ann: [PICKUP, 'Column 6, row 1.', 'Column 7, row 1.', 'Column 7, row 5.'],
  });
  pair('KF', 6, {
    mode: 'edit',
    focus: 'move:milling',
    pos: { milling: [6, 4] },
    ann: ['Production orders, Milling dropped at column 7, row 5.'],
  });
  pair('KF', 7, {
    mode: 'edit',
    focus: 'move:milling',
    ann: ['Move cancelled. Production orders, Milling is back at column 5, row 1.'],
  });
  pair('KF', 8, {
    mode: 'edit',
    focus: 'actions:milling',
    sizes: { milling: 'L' },
    pos: { press4: [8, 4] },
    ann: ['Production orders, Milling is now Large, 6 columns by 4 rows. 1 other widget moved.'],
  });
  pair('KF', 9, {
    mode: 'edit',
    focus: 'actions:milling',
    pos: MOVED,
    ann: ['Production orders, Milling moved to column 6, row 1. 1 other widget moved.'],
  });
  pair('KF', 10, { focus: 'editLayout', pos: { milling: [6, 4] }, ann: ['My shift saved.'] });
  pair('KF', 11, j({ tab: 'shift', mode: 'edit', scrollY: 420, focus: 'move:jobsnow' }));
  pair('KF', 12, {
    mode: 'edit',
    drag: 'milling',
    pos: { milling: [6, 4] },
    ph: [6, 4, 4, 4],
    dragOff: 'transform:translate(-58px,-74px)',
    cursor: 'left:178px;top:96px',
  });
  pair('KF', 13, {
    mode: 'edit',
    resize: 'milling',
    sizes: { milling: 'L' },
    pos: { press4: [8, 4] },
    ph: [4, 0, 6, 4],
    rszW: '84%',
    rszTip: 'Large, 6 by 4',
  });
  pair('KF', 14, {
    w: '320',
    mode: 'edit',
    target: 'milling',
    focus: 'actions:milling',
    order: ['pressing', 'press4', 'milling', 'notplaced', 'mylate'],
    scrollY: 560,
    ann: ['Production orders, Milling moved to position 3 of 5.'],
  });

  var scene = (id) => {
    var S = SC[id];
    if (!S) return null;
    if (!S.__done) {
      var t = TABS[S.tab];
      S.canEdit = !!t && mayEdit(S.who, S.plant, t.scope);
      S.company = S.plant === 'Plant C' ? 'Nordic Tools AB' : 'Acme AB';
      S.url =
        '/' +
        SLUG[S.plant] +
        (S.status === 'unknownTab' ? '?tab=$unknownTabId' : S.tab ? '?tab=$tabId' : '');
      S.__done = true;
    }
    return S;
  };

  window.DB454S = {
    NB: NB,
    SIZE: SIZE,
    SIZE_ORDER: SIZE_ORDER,
    TYPES: TYPES,
    sizeDim: sizeDim,
    LISTS: LISTS,
    TABLES: TABLES,
    CHARTS: CHARTS,
    W: W,
    TABS: TABS,
    TABLISTS: TABLISTS,
    PEOPLE: PEOPLE,
    SLUG: SLUG,
    mayEdit: mayEdit,
    widget: widget,
    layout: layout,
    pack: pack,
    firstFree: firstFree,
    scene: scene,
    SCENES: SC,
  };
})();
