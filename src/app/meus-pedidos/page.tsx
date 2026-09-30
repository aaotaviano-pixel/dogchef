import { CustomerOrders } from "@/components/customer-orders";

export default function CustomerOrdersPage() {
  return <CustomerOrders turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || null} />;
}
