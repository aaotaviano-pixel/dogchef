import assert from "node:assert/strict";
import test from "node:test";

import { buildCategoryMarqueeItems, buildCategoryTiles, selectFeaturedProducts, selectShowcaseProducts } from "./storefront-presentation";
import type { Category, Product } from "./types";

function product(overrides: Partial<Product> & Pick<Product, "id" | "categoryId" | "name">): Product {
  return {
    description: "",
    priceCents: 1000,
    emoji: "",
    imageUrl: `/images/${overrides.id}.webp`,
    images: [],
    isAvailable: true,
    featured: false,
    inShowcase: false,
    showcaseOrder: 0,
    prepMinutes: 15,
    optionGroups: [],
    ...overrides,
  };
}

test("selectShowcaseProducts keeps only available banner products in admin order", () => {
  const products = [
    product({ id: "later", categoryId: "dogs", name: "Later", inShowcase: true, showcaseOrder: 3 }),
    product({ id: "hidden", categoryId: "dogs", name: "Hidden", inShowcase: true, showcaseOrder: 1, isAvailable: false }),
    product({ id: "first", categoryId: "dogs", name: "First", inShowcase: true, showcaseOrder: 1 }),
    product({ id: "regular", categoryId: "dogs", name: "Regular" }),
  ];

  assert.deepEqual(selectShowcaseProducts(products).map((item) => item.id), ["first", "later"]);
});

test("selectFeaturedProducts returns only available products explicitly marked as featured", () => {
  const products = [
    product({ id: "featured", categoryId: "dogs", name: "Featured", featured: true }),
    product({ id: "regular", categoryId: "dogs", name: "Regular" }),
    product({ id: "paused", categoryId: "dogs", name: "Paused", featured: true, isAvailable: false }),
  ];

  assert.deepEqual(selectFeaturedProducts(products).map((item) => item.id), ["featured"]);
});

test("selectShowcaseProducts falls back to available catalog products", () => {
  const products = [
    product({ id: "sold", categoryId: "dogs", name: "Sold", isAvailable: false }),
    product({ id: "one", categoryId: "dogs", name: "One" }),
    product({ id: "two", categoryId: "drinks", name: "Two" }),
  ];

  assert.deepEqual(selectShowcaseProducts(products, 1).map((item) => item.id), ["one"]);
});

test("buildCategoryTiles uses only real categories and available product covers", () => {
  const categories: Category[] = [
    { id: "dogs", name: "Hot dogs", description: "", sortOrder: 1 },
    { id: "drinks", name: "Bebidas", description: "", sortOrder: 2 },
  ];
  const products = [
    product({ id: "sold", categoryId: "dogs", name: "Sold", isAvailable: false }),
    product({ id: "dog", categoryId: "dogs", name: "Dog" }),
    product({ id: "drink", categoryId: "drinks", name: "Drink" }),
  ];

  assert.deepEqual(buildCategoryTiles(categories, products), [
    { id: "all", name: "Todos", count: 2, cover: "/images/dog.webp" },
    { id: "dogs", name: "Hot dogs", count: 1, cover: "/images/dog.webp" },
    { id: "drinks", name: "Bebidas", count: 1, cover: "/images/drink.webp" },
  ]);
});

test("buildCategoryMarqueeItems repeats category order with accessible duplicate metadata", () => {
  const tiles = [
    { id: "all", name: "Todos", count: 8, cover: "/images/all.webp" },
    { id: "dogs", name: "Hot dogs", count: 5, cover: "/images/dogs.webp" },
  ];

  assert.deepEqual(buildCategoryMarqueeItems(tiles, 2), [
    { ...tiles[0], copy: 0, key: "0-all", isDuplicate: false },
    { ...tiles[1], copy: 0, key: "0-dogs", isDuplicate: false },
    { ...tiles[0], copy: 1, key: "1-all", isDuplicate: true },
    { ...tiles[1], copy: 1, key: "1-dogs", isDuplicate: true },
  ]);
});
