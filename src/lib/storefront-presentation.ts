import type { Category, Product } from "./types";

export type StorefrontCategoryTile = {
  id: string;
  name: string;
  count: number;
  cover?: string;
};

export type StorefrontCategoryMarqueeItem = StorefrontCategoryTile & {
  copy: number;
  key: string;
  isDuplicate: boolean;
};

export function selectShowcaseProducts(products: Product[], limit = 5) {
  const selected = products
    .filter((product) => product.inShowcase && product.isAvailable)
    .sort((left, right) => left.showcaseOrder - right.showcaseOrder)
    .slice(0, limit);

  return selected.length
    ? selected
    : products.filter((product) => product.isAvailable).slice(0, limit);
}

export function selectFeaturedProducts(products: Product[]) {
  return products.filter((product) => product.featured && product.isAvailable);
}

export function buildCategoryTiles(categories: Category[], products: Product[]): StorefrontCategoryTile[] {
  const availableProducts = products.filter((product) => product.isAvailable);

  return [
    {
      id: "all",
      name: "Todos",
      count: availableProducts.length,
      cover: availableProducts[0]?.imageUrl,
    },
    ...categories.map((category) => {
      const categoryProducts = availableProducts.filter((product) => product.categoryId === category.id);
      return {
        id: category.id,
        name: category.name,
        count: categoryProducts.length,
        cover: categoryProducts[0]?.imageUrl,
      };
    }),
  ];
}

export function buildCategoryMarqueeItems(
  tiles: StorefrontCategoryTile[],
  copies = 2,
): StorefrontCategoryMarqueeItem[] {
  return Array.from({ length: Math.max(1, copies) }, (_, copy) =>
    tiles.map((tile) => ({
      ...tile,
      copy,
      key: `${copy}-${tile.id}`,
      isDuplicate: copy > 0,
    })),
  ).flat();
}
