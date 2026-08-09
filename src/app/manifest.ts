import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dog do Chef — prensado de verdade",
    short_name: "DogChef",
    description: "Peça hot dogs prensados, gratinados, porções e bebidas em poucos toques.",
    start_url: "/",
    display: "standalone",
    background_color: "#0b0908",
    theme_color: "#0b0908",
    icons: [{ src: "/icon.png", sizes: "150x150", type: "image/png" }],
  };
}
