import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { parentRoutes } from "@/lib/content";
import { getParentMetadata, ParentPage } from "@/components/ParentPages";
import { getSiteOrigin } from "@/lib/site";

export const dynamicParams = false;
export function generateStaticParams() { return parentRoutes.map(route => ({ path: route.split("/") })); }

export async function generateMetadata({ params }: { params: Promise<{ path: string[] }> }): Promise<Metadata> {
  const { path } = await params;
  const metadata = getParentMetadata(path.join("/"));
  if (!metadata) return {};
  const origin = getSiteOrigin();
  return { ...metadata, alternates: origin ? { canonical: new URL(`/${path.join("/")}`, origin).toString() } : undefined, openGraph: { title: metadata.title, description: metadata.description, type: "website" } };
}

export default async function Page({ params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const route = path.join("/");
  if (!getParentMetadata(route)) notFound();
  return <ParentPage path={route} />;
}
