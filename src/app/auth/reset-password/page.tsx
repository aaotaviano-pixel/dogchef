import type { Metadata } from "next";

import { PasswordResetForm } from "@/components/password-reset-form";

export const metadata: Metadata = { title: "Redefinir senha | Dog do Chef", robots: { index: false, follow: false } };

export default function ResetPasswordPage() {
  return <PasswordResetForm />;
}
