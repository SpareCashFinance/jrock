import type { MetadataRoute } from "next";
import { project } from "@/lib/config";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = project.siteUrl || "https://jrock.local";
  return [{ url: base, lastModified: new Date() }];
}
