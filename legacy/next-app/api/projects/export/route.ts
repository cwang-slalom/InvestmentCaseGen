import { NextRequest, NextResponse } from "next/server";

import type { OpportunityRecord, SourceDocument } from "@/domain";
import { listProjectsForUser, requireApiUser } from "@/server/auth";
import { getStorage } from "@/server/storage";

export const dynamic = "force-dynamic";

type ExportRow = {
  projectName: string;
  description: string;
  sourceDocuments: number;
  parsedDocuments: number;
  candidateConcepts: number;
  drafts: number;
  fundingPathwayStatus: string;
  updatedAt: string;
};

function csvCell(value: string | number) {
  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

function fundingPathwayStatus(opportunities: OpportunityRecord[]) {
  if (opportunities.length === 0) {
    return "unresolved";
  }

  const unresolvedCount = opportunities.filter((record) =>
    record.opportunity.fundingPathways.some(
      (pathway) =>
        pathway.status === "unresolved" ||
        pathway.pathwayType === "unresolved_pathway",
    ),
  ).length;

  return unresolvedCount === 0
    ? "source grounded"
    : `${unresolvedCount} unresolved`;
}

function parsedDocumentCount(documents: SourceDocument[]) {
  return documents.filter((document) => document.status === "parsed").length;
}

function toCsv(rows: ExportRow[]) {
  const header = [
    "Project",
    "Description",
    "Source documents",
    "Parsed documents",
    "Candidate concepts",
    "Drafts",
    "Funding pathway status",
    "Updated",
  ];
  const body = rows.map((row) =>
    [
      row.projectName,
      row.description,
      row.sourceDocuments,
      row.parsedDocuments,
      row.candidateConcepts,
      row.drafts,
      row.fundingPathwayStatus,
      row.updatedAt,
    ]
      .map(csvCell)
      .join(","),
  );

  return [header.map(csvCell).join(","), ...body].join("\n");
}

export async function GET(request: NextRequest) {
  try {
    const storage = getStorage();
    const auth = await requireApiUser(request, storage);

    if (!auth.user) {
      return auth.response;
    }

    const projects = await listProjectsForUser(auth.user, storage);
    const rows = await Promise.all(
      projects.map(async (project) => {
        const [documents, opportunities, drafts] = await Promise.all([
          storage.listSourceDocuments(project.id),
          storage.listOpportunityRecords(project.id),
          storage.listDraftRecords(project.id),
        ]);

        return {
          projectName: project.name,
          description: project.description ?? "",
          sourceDocuments: documents.length,
          parsedDocuments: parsedDocumentCount(documents),
          candidateConcepts: opportunities.length,
          drafts: drafts.length,
          fundingPathwayStatus: fundingPathwayStatus(opportunities),
          updatedAt: project.updatedAt.toISOString(),
        };
      }),
    );

    return new NextResponse(toCsv(rows), {
      headers: {
        "Content-Disposition":
          'attachment; filename="investmentgen-projects.csv"',
        "Content-Type": "text/csv; charset=utf-8",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Project export failed." },
      { status: 500 },
    );
  }
}
