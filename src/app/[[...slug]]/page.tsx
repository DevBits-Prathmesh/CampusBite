import { App } from "@/components/app-shell";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug = [] } = await params;
  const initialPath = slug.length ? `/${slug.join("/")}/` : "/";
  return <App initialPath={initialPath} />;
}
