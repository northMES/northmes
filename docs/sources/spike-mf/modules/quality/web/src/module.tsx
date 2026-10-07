import { createRoute } from "@tanstack/react-router";
import { defineWebModule, type DashboardWidgetProps } from "@northmes/web-sdk";
import "@module-styles";

function QualityWidget({ plantId }: DashboardWidgetProps) {
  return (
    <div data-testid="quality-widget" className="qa:rounded-lg qa:border qa:border-border qa:bg-primary qa:p-3 qa:text-primary-foreground">
      Open deviations at {plantId}: 1
      <span data-testid="quality-responsive" className="qa:hidden qa:md:flex">wide only</span>
    </div>
  );
}

export default defineWebModule({
  id: "quality",
  version: "0.1.0",
  northmesRange: ">=0.1.0 <0.2.0",
  permissions: [],
  routes: (plantRoute) =>
    createRoute({ getParentRoute: () => plantRoute, path: "quality", component: () => <p className="qa:p-4">Quality</p> }),
  nav: [{ id: "quality.home", label: "Quality", to: "quality" }],
  widgets: [{ id: "quality.deviations", slot: "core/dashboard/widgets/v1", component: QualityWidget }],
});
