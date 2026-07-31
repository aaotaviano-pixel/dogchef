import { OrderTracker } from "@/components/order-tracker";

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ publicCode: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const [{ publicCode }, { token }] = await Promise.all([params, searchParams]);
  return <OrderTracker publicCode={publicCode.toUpperCase()} token={token || ""} />;
}
