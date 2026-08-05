import { requirePageUser } from "@/server/auth";
import { DOCUMENT_LIMITS } from "@/server/documents";

import { CreateWorkflow } from "./create-workflow";

export const dynamic = "force-dynamic";

type CreatePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CreatePage({ searchParams }: CreatePageProps) {
  const user = await requirePageUser("/create");
  const params = await searchParams;

  return (
    <CreateWorkflow
      maxUploadMb={DOCUMENT_LIMITS.maxFileSizeBytes / (1024 * 1024)}
      message={firstValue(params.message)}
      status={firstValue(params.status)}
      userEmail={user.email}
      userName={user.name}
    />
  );
}
