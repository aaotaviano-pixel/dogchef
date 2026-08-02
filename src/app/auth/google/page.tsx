import type { Metadata } from "next";

import { GoogleAuthCallback } from "@/components/google-auth-callback";

export const metadata: Metadata = { title: "Acesso com Google | Dog do Chef", robots: { index: false, follow: false } };

export default function GoogleAuthPage() {
  return <GoogleAuthCallback />;
}
