# DogChef Mobile Motion and Light-to-Dark Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the tall mobile hero and red benefits strip with a compact animated hero, an automatic category marquee, white highlights, and a dark menu flow.

**Architecture:** Keep all commerce state and handlers inside the existing storefront. Add one pure presentation helper for accessible marquee copies, restructure only public JSX, and isolate every visual change in the existing `.storefront-reference-redesign` CSS scope.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, CSS, Node test runner.

## Global Constraints

- Keep real Showcase products, images, descriptions, prices, categories, and counts.
- Do not edit admin-uploaded image files or any database/API/admin code.
- Mobile hero is a 4:3 rectangle at widths up to 619 px.
- Category movement uses transforms, pauses after interaction, and remains automatic at a slower speed under reduced motion.
- `Destaques da casa` stays white; `Escolha seu favorito` starts the black section, which reaches near-black before the footer.
- The validated result must be deployed to production in this task.

---

### Task 1: Deterministic category marquee copies

**Files:**
- Modify: `src/lib/storefront-presentation.ts`
- Test: `src/lib/storefront-presentation.test.ts`

**Interfaces:**
- Consumes: `StorefrontCategoryTile[]` from `buildCategoryTiles`.
- Produces: `buildCategoryMarqueeItems(tiles, copies)` returning tiles with `copy`, `key`, and `isDuplicate`.

- [ ] **Step 1: Write the failing test**

Add a test asserting that two copies preserve tile order, produce stable keys, and mark only the second copy as duplicate.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npx tsx --test src/lib/storefront-presentation.test.ts`

Expected: FAIL because `buildCategoryMarqueeItems` is not exported.

- [ ] **Step 3: Implement the pure helper**

Return a flattened array for `Math.max(1, copies)` copies without changing the source tiles.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npx tsx --test src/lib/storefront-presentation.test.ts`

Expected: all storefront presentation tests PASS.

### Task 2: Restructure the public storefront

**Files:**
- Modify: `src/components/storefront.tsx`

**Interfaces:**
- Consumes: `buildCategoryMarqueeItems`, existing `categoryTiles`, `selectCategory`, Showcase state, product handlers.
- Produces: `.hero-title-motion`, `.category-marquee`, and `.storefront-tone-flow` DOM structures.

- [ ] **Step 1: Remove the benefits strip**

Delete the four benefit articles and remove now-unused icon imports.

- [ ] **Step 2: Add animated headline structure**

Key the headline wrapper by the current Showcase product and split the headline into three spans while preserving the same accessible text.

- [ ] **Step 3: Place category cards in the red marquee**

Render flattened marquee items directly below the hero. Duplicate items use `aria-hidden`, `tabIndex=-1`, and stable keys; original cards remain clickable filters.

- [ ] **Step 4: Separate the light highlights from the dark menu flow**

Keep `Destaques da casa` in `.storefront-tone-flow` and wrap the full menu plus about
section in `.storefront-dark-flow`; do not move the footer, dialogs, cart, or social controls.

### Task 3: Implement the visual system

**Files:**
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes: the three scoped classes introduced in Task 2.
- Produces: responsive hero geometry, marquee motion, headline motion, and gradient contrast states.

- [ ] **Step 1: Replace benefit styles with marquee styles**

Create a full-width red strip with compact category image cards, a seamless transform animation, interaction pause, and no layout shift.

- [ ] **Step 2: Make the mobile hero rectangular**

At `max-width: 619px`, use `aspect-ratio: 4 / 3`, rounded corners, full-height photography, bottom/left overlay, compact content, one visible CTA, price, and contained controls.

- [ ] **Step 3: Add headline animation**

Animate headline segments with delayed opacity/translate transitions on Showcase changes; disable under reduced motion.

- [ ] **Step 4: Invert the page from the full menu onward**

Keep highlights white, start the dark gradient exactly at `Escolha seu favorito`, and
switch all full-menu cards plus the about section to dark surfaces with light text.

- [ ] **Step 5: Preserve desktop and narrow screens**

Keep the current desktop hero structure and verify dynamic font sizing and control placement at 320 and 359 px.

### Task 4: Verification and documentation

**Files:**
- Modify: `README.md`
- Modify: `arquitetura.md`
- Modify: `convencoes.md`
- Modify: `historico.md`
- Modify: `C:/mind/projetos/dogchef/contexto.md`
- Modify: `C:/mind/projetos/dogchef/arquitetura.md`
- Modify: `C:/mind/projetos/dogchef/convencoes.md`
- Modify: `C:/mind/projetos/dogchef/mapa-do-codigo.md`
- Modify: `C:/mind/projetos/dogchef/operacao.md`
- Modify: `C:/mind/projetos/dogchef/pendencias.md`
- Modify: `C:/mind/projetos/dogchef/historico.md`

- [ ] **Step 1: Run automated checks**

Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check`.

- [ ] **Step 2: Validate visually**

Inspect 320, 375, 390, 414, 768, 1024, 1440, and 1920 px. Confirm no overflow, automatic motion, category filtering, product modal, cart, footer, and readable gradient contrast.

- [ ] **Step 3: Update documentation**

Record only behavior actually implemented and tests actually executed. After validation,
commit, push, deploy to Vercel, and record the exact production result.
