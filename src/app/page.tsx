import { Storefront } from "@/components/storefront";

export default function HomePage() {
  return <Storefront turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || null} />;
}
