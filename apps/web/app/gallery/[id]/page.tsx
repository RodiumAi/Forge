import { PublicTemplateDetail } from "@/components/gallery/PublicTemplateDetail";

/** Public template page: the detail of one catalogue template, signed in or not. */
export default async function GalleryTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PublicTemplateDetail id={decodeURIComponent(id)} />;
}
