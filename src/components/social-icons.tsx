type SocialIconProps = { size?: number; className?: string };

export function InstagramLogo({ size = 18, className }: SocialIconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="4.25" stroke="currentColor" strokeWidth="2" />
      <circle cx="17.5" cy="6.5" r="1.15" fill="currentColor" />
    </svg>
  );
}

export function WhatsAppLogo({ size = 18, className }: SocialIconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.52 3.48A11.86 11.86 0 0 0 12.07 0C5.53 0 .2 5.32.2 11.86c0 2.09.55 4.13 1.6 5.93L.1 24l6.36-1.67a11.84 11.84 0 0 0 5.59 1.42h.01c6.53 0 11.84-5.32 11.84-11.86 0-3.16-1.23-6.13-3.38-8.41Zm-8.45 18.22h-.01a9.84 9.84 0 0 1-5.02-1.38l-.36-.21-3.77.99 1.01-3.68-.23-.38a9.84 9.84 0 0 1-1.51-5.18c0-5.46 4.44-9.9 9.9-9.9 2.64 0 5.13 1.03 7 2.9a9.86 9.86 0 0 1 2.9 7c0 5.46-4.44 9.9-9.91 9.9Zm5.43-7.42c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.76-1.66-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.49s1.07 2.89 1.22 3.09c.15.2 2.1 3.21 5.09 4.5.71.31 1.26.5 1.69.64.71.23 1.36.2 1.87.12.57-.09 1.77-.72 2.02-1.41.25-.69.25-1.28.17-1.41-.07-.12-.27-.2-.57-.35Z" />
    </svg>
  );
}
