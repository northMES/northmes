import { useParams } from "@tanstack/react-router";

export function OrderScreen() {
  const { orderId } = useParams({ from: "/$plant/planning/orders/$orderId" });
  return <div data-testid="order-screen" className="p-2 text-sm">Production order {orderId}</div>;
}
