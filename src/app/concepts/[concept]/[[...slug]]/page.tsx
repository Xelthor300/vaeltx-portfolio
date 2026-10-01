import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { conceptNames, conceptRoutes, projects, type ConceptRoute } from "@/lib/content";
import { ProjectPage } from "@/components/ProjectPages";
import { getSiteOrigin } from "@/lib/site";

export const dynamic = "force-dynamic";
export function generateStaticParams() {
  return Object.entries(conceptRoutes).flatMap(([concept, routes]) => routes.map(route => ({ concept, ...(route.path ? { slug: route.path.split("/") } : {}) })));
}

function findRoute(concept: string, slug: string[] | undefined): ConceptRoute | undefined {
  return conceptRoutes[concept]?.find(route => route.path === (slug ?? []).join("/"));
}

export async function generateMetadata({ params }: { params: Promise<{ concept: string; slug?: string[] }> }): Promise<Metadata> {
  const { concept, slug } = await params;
  const route = findRoute(concept, slug);
  const project = projects.find(item => item.slug === concept);
  if (!route || !project) return {};
  const title = route.path ? `${route.label} — ${conceptNames[concept]} Concept` : `${conceptNames[concept]} — Independent Concept`;
  const origin = getSiteOrigin();
  const routePath = `/concepts/${concept}${route.path ? `/${route.path}` : ""}`;
  return { title, description: route.description, alternates: origin ? { canonical: new URL(routePath, origin).toString() } : undefined, robots: { index: false, follow: false }, openGraph: { title, description: route.description, type: "website" } };
}

export default async function Page({ params, searchParams }: { params: Promise<{ concept: string; slug?: string[] }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ concept, slug }, query] = await Promise.all([params, searchParams]);
  const route = findRoute(concept, slug);
  if (!route || !projects.some(project => project.slug === concept)) notFound();
  return <ProjectPage concept={concept} page={route} searchParams={query}/>;
}
