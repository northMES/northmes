import type { DashboardWidgetProps } from "@northmes/web-sdk";

export function LateOrdersWidget({ plantId }: DashboardWidgetProps) {
  return (
    <div data-testid="late-orders-widget" className="rounded-lg border border-border p-3 text-sm">
      Late orders at {plantId}: 2
    </div>
  );
}
