// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic

// The planning module's screens. The routes import this file lazily, so the build puts the screens
// in one chunk of their own, which the browser loads when it first opens a planning route.
export { BoardScreen } from './screens/board/index.ts';
export { CustomerOrderScreen } from './screens/customer-order/index.ts';
export { CustomerOrdersScreen } from './screens/customer-orders/index.ts';
export { EditOrderScreen } from './screens/edit-order/index.ts';
export { GanttScreen } from './screens/gantt/index.ts';
export { JobOrdersScreen } from './screens/job-orders/index.ts';
export { OrderScreen } from './screens/order/index.ts';
export { ProductionOrdersScreen } from './screens/production-orders/index.ts';
export { StockScreen } from './screens/stock/index.ts';
export { StockArticleScreen } from './screens/stock-article/index.ts';
