import { redirect } from "next/navigation";

/** The public gallery lives on the landing. */
export default function GalleryPage() {
  redirect("/#templates");
}
