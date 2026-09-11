import type { MetadataRoute } from "next";
import { project } from "@/lib/config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: project.siteUrl ? `${project.siteUrl}/sitemap.xml` : undefined,
  };
}
