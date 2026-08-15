# DogChef mobile motion and light-to-dark flow

## Goal

Refine the public storefront without touching catalog data, admin uploads, checkout,
authentication, orders, APIs, or the database. The mobile hero must become a compact,
sophisticated rectangle; categories must move automatically; and the page must transition
from a light highlights section to a dark ending.

## Approved direction

The user explicitly approved implementation without checkpoints and requested the best
visual choices within the existing DogChef identity. In the final refinement, the user
also explicitly requested production deployment after validation.

## Hero

- Keep the real admin-managed Showcase as the image source.
- On screens up to 619 px, render the hero as a horizontal 4:3 rectangle with rounded
  corners, full-bleed photography, and a controlled dark overlay.
- Keep one primary action and the real product price visible; hide secondary copy that
  would make the rectangle tall or crowded.
- Animate each headline in three short stages whenever the Showcase product changes.
- Rotate three factual institutional headlines in sequence, synchronized with automatic
  and manual Showcase navigation.
- Keep automatic Showcase rotation, manual controls, pause after interaction, tab
  visibility handling, and reduced-motion support.
- Preserve the existing desktop composition, applying only compatible motion and polish.

## Category marquee

- Remove the four-item red operational benefits strip and all of its phrases.
- Move the existing category cards into a red full-width marquee directly below the hero.
- Duplicate the real category sequence for a seamless CSS loop. The duplicate copy is
  hidden from assistive technology and keyboard navigation.
- Keep every category card clickable and keep the current filter behavior.
- Run automatically on mobile and desktop, pause after pointer, wheel, hover, or focus
  interaction, then resume.
- Keep a slower continuous loop when the browser requests reduced motion, while disabling
  the decorative headline entrance. This preserves the explicitly requested video-like
  category movement without introducing fast motion.
- Never invent categories or images; use the existing catalog-derived tiles and counts.

## Light-to-dark page flow

- Keep `Destaques da casa` on a white surface with white cards and dark text.
- Start a separate full-width dark flow exactly at `Escolha seu favorito`.
- Render every full-menu category and product card on dark surfaces with light text.
- Deepen the background from warm grill-black at the menu heading to near-black at the
  end of the full menu, creating the requested gradient while scrolling.
- Return the about section to a clean white surface with dark text before the footer, as
  requested in the final visual adjustment.

## Accessibility and performance

- Keep semantic regions, category button labels, selected states, and Showcase controls.
- Use CSS transforms and opacity only for continuous motion.
- Disable the decorative headline entrance under `prefers-reduced-motion: reduce` and
  slow the category loop substantially instead of stopping it.
- Avoid background attachment, scroll listeners, image editing, or per-frame JavaScript.
- No horizontal overflow at 320, 360, 375, 390, 414, 768, 1024, 1440, and 1920 px.

## Validation

- Unit-test deterministic category marquee item generation before implementation.
- Run all tests, typecheck, lint, build, and `git diff --check`.
- Validate hero framing, category animation, filters, product modal, cart, gradient contrast,
  footer, and reduced-motion behavior in the in-app browser.

## Deployment

The initial request authorized local implementation only. The follow-up request explicitly
authorizes commit, push, Vercel deployment, and production verification for this scope.
