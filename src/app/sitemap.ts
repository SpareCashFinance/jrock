import type { MetadataRoute } from "next";
import { project } from "@/lib/config";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = project.siteUrl;
  return [
    { url: base, lastModified: new Date() },
    { url: `${base}/memes`, lastModified: new Date() },
    { url: `${base}/lotto`, lastModified: new Date() },
    { url: `${base}/lotto/verify`, lastModified: new Date() },
  ];
}
