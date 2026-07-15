import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { projectHomePath } from "@/lib/video-kind";

export const dynamic = "force-dynamic";

export default async function ProjectIndexPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    select: { videoKind: true },
  });
  if (!project) notFound();
  redirect(projectHomePath(id, project.videoKind));
}
