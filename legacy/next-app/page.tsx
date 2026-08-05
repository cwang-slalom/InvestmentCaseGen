import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

import type {
  DocumentStatus,
  DraftRecord,
  GenerationRun,
  OpportunityRecord,
  Project,
  ProjectAccessRole,
  SourceDocument,
  User,
} from "@/domain";
import { listProjectsForUser, requirePageUser, userCan } from "@/server/auth";
import { getStorage } from "@/server/storage";

export const dynamic = "force-dynamic";

type HomePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type DashboardProject = {
  project: Project;
  documents: SourceDocument[];
  opportunities: OpportunityRecord[];
  drafts: DraftRecord[];
  generationRuns: GenerationRun[];
  accessRole?: ProjectAccessRole | "admin";
  canEdit: boolean;
};

type DashboardData = {
  rows: DashboardProject[];
  storageError?: string;
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function draftHref(draft: DraftRecord) {
  return `/projects/${draft.projectId}/opportunities/${draft.opportunityRecordId}/drafts/${draft.id}`;
}

function docxHref(draft: DraftRecord) {
  return `/api/projects/${draft.projectId}/opportunities/${draft.opportunityRecordId}/drafts/${draft.id}/export/docx`;
}

function latestDate(dates: Date[]) {
  const timestamps = dates.map((date) => date.getTime());

  return new Date(Math.max(...timestamps));
}

function latestActivity(row: DashboardProject) {
  return latestDate([
    row.project.updatedAt,
    ...row.documents.map((document) => document.updatedAt),
    ...row.opportunities.map((opportunity) => opportunity.updatedAt),
    ...row.drafts.map((draft) => draft.updatedAt),
    ...row.generationRuns.map((run) => run.updatedAt),
  ]);
}

function projectStatus(row: DashboardProject) {
  if (row.drafts.length > 0) {
    return "Drafted";
  }

  if (row.opportunities.length > 0) {
    return "Ready to draft";
  }

  if (row.documents.some((document) => document.status === "parsed")) {
    return "Sources parsed";
  }

  if (row.documents.length > 0) {
    return "Source review";
  }

  return "New";
}

function shortText(value: string | undefined, fallback: string, limit = 150) {
  const normalized = value?.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return fallback;
  }

  return normalized.length > limit
    ? `${normalized.slice(0, Math.max(0, limit - 1)).trim()}...`
    : normalized;
}

function plainMarkdown(value: string) {
  return value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`[\]()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function sortByUpdatedAt<T extends { updatedAt: Date }>(items: T[]) {
  return [...items].sort(
    (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
  );
}

function sortRowsByActivity(rows: DashboardProject[]) {
  return [...rows].sort(
    (a, b) => latestActivity(b).getTime() - latestActivity(a).getTime(),
  );
}

function latestDraft(row: DashboardProject | undefined) {
  return row ? sortByUpdatedAt(row.drafts).at(0) : undefined;
}

function selectedOpportunity(row: DashboardProject | undefined) {
  if (!row) {
    return undefined;
  }

  const draft = latestDraft(row);

  return (
    row.opportunities.find(
      (opportunity) => opportunity.id === draft?.opportunityRecordId,
    ) ?? sortByUpdatedAt(row.opportunities).at(0)
  );
}

function readinessLabel(record: OpportunityRecord | undefined) {
  return record?.assessment?.readinessLevel
    ? record.assessment.readinessLevel.replaceAll("_", " ")
    : "review not complete";
}

function investabilityScore(record: OpportunityRecord | undefined) {
  const criteria = record?.assessment?.criteria ?? [];

  if (criteria.length === 0) {
    return undefined;
  }

  const average =
    criteria.reduce((sum, criterion) => sum + criterion.score, 0) /
    criteria.length;

  return Math.round((average / 5) * 100);
}

function criterionScore(record: OpportunityRecord | undefined, key: string) {
  return record?.assessment?.criteria.find(
    (criterion) => criterion.criterionKey === key,
  )?.score;
}

function sourceMeta(document: SourceDocument) {
  const metadata = document.parserMetadata;

  if (metadata?.pageCount) {
    return `${metadata.pageCount} pages`;
  }

  if (metadata?.slideCount) {
    return `${metadata.slideCount} slides`;
  }

  return `${metadata?.wordCount ?? 0} words`;
}

const documentStatusLabels: Record<DocumentStatus, string> = {
  uploaded: "Running",
  parsed: "Parsed",
  failed: "Warning",
  rejected: "Warning",
};

function documentStatusTone(status: DocumentStatus) {
  if (status === "parsed") {
    return "success";
  }

  if (status === "uploaded") {
    return "running";
  }

  return "warning";
}

function sourceIconClass(document: SourceDocument) {
  return `source-file-icon ${document.fileExtension}`;
}

function citationCountForSection(draft: DraftRecord, claimIds: string[]) {
  const citationIds = new Set<string>();

  claimIds.forEach((claimId) => {
    const claim = draft.draft.claims.find(
      (candidate) => candidate.id === claimId,
    );
    claim?.citationIds.forEach((citationId) => citationIds.add(citationId));
  });

  return citationIds.size;
}

function latestRunFor(
  row: DashboardProject | undefined,
  runTypes: GenerationRun["runType"][],
) {
  return row
    ? sortByUpdatedAt(
        row.generationRuns.filter((run) => runTypes.includes(run.runType)),
      ).at(0)
    : undefined;
}

function runStatus(run: GenerationRun | undefined, hasOutput: boolean) {
  if (run) {
    return run.status === "completed"
      ? "Completed"
      : run.status === "failed"
        ? "Warning"
        : "Queued";
  }

  return hasOutput ? "Completed" : "Waiting";
}

function runTone(status: string) {
  if (status === "Completed") {
    return "success";
  }

  if (status === "Warning") {
    return "warning";
  }

  if (status === "Queued") {
    return "queued";
  }

  return "waiting";
}

async function loadDashboardData(user: User): Promise<DashboardData> {
  try {
    const storage = getStorage();
    const projects = await listProjectsForUser(user, storage);
    const rows = await Promise.all(
      projects.map(async (project) => {
        const [documents, opportunities, drafts, generationRuns, membership] =
          await Promise.all([
            storage.listSourceDocuments(project.id),
            storage.listOpportunityRecords(project.id),
            storage.listDraftRecords(project.id),
            storage.listGenerationRuns(project.id),
            user.systemRole === "admin"
              ? Promise.resolve(null)
              : storage.getProjectMembership(project.id, user.id),
          ]);
        const accessRole: ProjectAccessRole | "admin" | undefined =
          user.systemRole === "admin" ? "admin" : membership?.role;

        return {
          project,
          documents,
          opportunities,
          drafts,
          generationRuns,
          accessRole,
          canEdit:
            user.systemRole === "admin" || userCan(membership?.role, "edit"),
        };
      }),
    );
    return { rows };
  } catch {
    return {
      rows: [],
      storageError: "Database not initialized. Run npm run db:push.",
    };
  }
}

function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}

type SidebarIconName =
  "projects" | "documents" | "opportunities" | "drafts" | "exports";

function SidebarIcon({ name }: { name: SidebarIconName }) {
  if (name === "projects") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3.5 6.5h6.2l1.7 2h9.1v9.8a1.7 1.7 0 0 1-1.7 1.7H5.2a1.7 1.7 0 0 1-1.7-1.7z" />
        <path d="M3.5 8.5v-2A1.7 1.7 0 0 1 5.2 4.8h4.1l1.7 2" />
      </svg>
    );
  }

  if (name === "documents") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6.5 3.5h7.2l4.8 4.8v12.2h-12z" />
        <path d="M13.5 3.8v4.9h4.8" />
        <path d="M8.8 12.2h6.4M8.8 15.2h6.4" />
      </svg>
    );
  }

  if (name === "opportunities") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="8.2" />
        <circle cx="12" cy="12" r="4.4" />
        <circle cx="12" cy="12" r="1.4" />
      </svg>
    );
  }

  if (name === "drafts") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4.8 18.8 6 14.2 15.9 4.3a2 2 0 0 1 2.8 2.8l-9.9 9.9z" />
        <path d="m14.4 5.8 3.8 3.8" />
        <path d="M4.5 20h15" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 4.5v10.2" />
      <path d="m7.8 8.8 4.2-4.3 4.2 4.3" />
      <path d="M5.5 14.7v4.8h13v-4.8" />
    </svg>
  );
}

type InterfaceIconName =
  | "upload"
  | "sparkle"
  | "draft"
  | "plus"
  | "refresh"
  | "star"
  | "export"
  | "signOut";

function InterfaceIcon({ name }: { name: InterfaceIconName }) {
  if (name === "upload") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7.2 17.5H6.8a4.2 4.2 0 0 1-.7-8.3 5.8 5.8 0 0 1 11.2 1.7 3.4 3.4 0 0 1-.7 6.6h-.5" />
        <path d="M12 18.6V10" />
        <path d="m8.8 13.2 3.2-3.3 3.2 3.3" />
      </svg>
    );
  }

  if (name === "sparkle") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m12 3 1.6 5.1L18.7 10l-5.1 1.9L12 17l-1.6-5.1L5.3 10l5.1-1.9z" />
        <path d="m18.5 15 .7 2.2 2.3.8-2.3.8-.7 2.2-.7-2.2-2.3-.8 2.3-.8z" />
      </svg>
    );
  }

  if (name === "draft" || name === "export") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6.5 3.5h7.2l4.8 4.8v12.2h-12z" />
        <path d="M13.5 3.8v4.9h4.8" />
        <path d="M9 12.4h6M9 15.4h6" />
        {name === "export" ? (
          <path d="M12 19.5v-5.8m0 0 2.2 2.2M12 13.7l-2.2 2.2" />
        ) : null}
      </svg>
    );
  }

  if (name === "refresh") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20 6.8v4.7h-4.7" />
        <path d="M19.2 11.5a7.2 7.2 0 1 0-2.1 5.1" />
      </svg>
    );
  }

  if (name === "star") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m12 3.8 2.4 5 5.5.8-4 3.9.9 5.5-4.8-2.6L7.1 19l.9-5.5-4-3.9 5.5-.8z" />
      </svg>
    );
  }

  if (name === "signOut") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M10.5 5.5h-5v13h5" />
        <path d="M11 12h8" />
        <path d="m16 8.8 3.2 3.2-3.2 3.2" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function SidebarItem({
  active = false,
  href,
  icon,
  label,
}: {
  active?: boolean;
  href?: string;
  icon: SidebarIconName;
  label: string;
}) {
  const className = `workspace-nav-item${active ? " active" : ""}${
    href ? "" : " unavailable"
  }`;
  const content = (
    <>
      <span className="workspace-nav-marker" aria-hidden="true">
        <SidebarIcon name={icon} />
      </span>
      <span>{label}</span>
    </>
  );

  return href ? (
    <Link className={className} href={href}>
      {content}
    </Link>
  ) : (
    <span className={className} aria-disabled="true">
      {content}
    </span>
  );
}

function WorkspaceSidebar({
  activeRow,
  latestDraftRecord,
  rows,
  user,
}: {
  activeRow?: DashboardProject;
  latestDraftRecord?: DraftRecord;
  rows: DashboardProject[];
  user: User;
}) {
  const recentProjects = sortRowsByActivity(rows).slice(0, 3);

  return (
    <aside className="workspace-sidebar">
      <div className="workspace-brand">
        <BrandMark />
        <strong>Investment Case Generator</strong>
      </div>

      <nav className="workspace-nav" aria-label="Workspace navigation">
        <SidebarItem active href="/" icon="projects" label="Projects" />
        <SidebarItem
          href={
            activeRow
              ? `/projects/${activeRow.project.id}/documents`
              : undefined
          }
          icon="documents"
          label="Documents"
        />
        <SidebarItem
          href={
            activeRow
              ? `/projects/${activeRow.project.id}/opportunities`
              : undefined
          }
          icon="opportunities"
          label="Opportunities"
        />
        <SidebarItem
          href={latestDraftRecord ? draftHref(latestDraftRecord) : undefined}
          icon="drafts"
          label="Drafts"
        />
        <SidebarItem
          href={latestDraftRecord ? docxHref(latestDraftRecord) : undefined}
          icon="exports"
          label="Exports"
        />
      </nav>

      {recentProjects.length > 0 ? (
        <div className="sidebar-project-list">
          <p>Recent projects</p>
          {recentProjects.map((row) => (
            <Link href={`/?projectId=${row.project.id}`} key={row.project.id}>
              <span>{row.project.name.slice(0, 2).toUpperCase()}</span>
              {shortText(row.project.name, "Untitled project", 30)}
            </Link>
          ))}
        </div>
      ) : null}

      <div className="workspace-user-card">
        <span>{user.name.slice(0, 2).toUpperCase()}</span>
        <div>
          <strong>{user.name}</strong>
          <p>{user.systemRole === "admin" ? "Admin" : "Member"}</p>
        </div>
        <form action="/api/auth/logout" method="post">
          <button aria-label="Sign out" title="Sign out" type="submit">
            <InterfaceIcon name="signOut" />
          </button>
        </form>
      </div>
    </aside>
  );
}

function WorkflowActions({
  activeRow,
  opportunity,
}: {
  activeRow?: DashboardProject;
  opportunity?: OpportunityRecord;
}) {
  if (!activeRow) {
    return (
      <section className="workflow-actions" aria-label="Primary workflow">
        <Link className="workflow-action primary" href="/create">
          <span aria-hidden="true">
            <InterfaceIcon name="plus" />
          </span>
          Create Case
        </Link>
        <span className="workflow-action disabled">
          <span aria-hidden="true">
            <InterfaceIcon name="sparkle" />
          </span>
          Extract Concepts
        </span>
        <span className="workflow-action disabled">
          <span aria-hidden="true">
            <InterfaceIcon name="draft" />
          </span>
          Generate Draft
        </span>
      </section>
    );
  }

  const parsedDocumentCount = activeRow.documents.filter(
    (document) => document.status === "parsed",
  ).length;
  const canExtract = activeRow.canEdit && parsedDocumentCount > 0;
  const canGenerate = Boolean(activeRow.canEdit && opportunity);

  return (
    <section className="workflow-actions" aria-label="Primary workflow">
      {activeRow.canEdit ? (
        <Link
          className="workflow-action primary"
          href={`/projects/${activeRow.project.id}/upload`}
        >
          <span aria-hidden="true">
            <InterfaceIcon name="upload" />
          </span>
          Upload Document
        </Link>
      ) : (
        <span className="workflow-action disabled">
          <span aria-hidden="true">
            <InterfaceIcon name="upload" />
          </span>
          Upload Document
        </span>
      )}
      <form
        action={`/api/projects/${activeRow.project.id}/opportunities/extract`}
        method="post"
      >
        <button
          className="workflow-action"
          disabled={!canExtract}
          type="submit"
        >
          <span aria-hidden="true">
            <InterfaceIcon name="sparkle" />
          </span>
          Extract Concepts
        </button>
      </form>
      {opportunity ? (
        <form
          action={`/api/projects/${activeRow.project.id}/opportunities/${opportunity.id}/drafts`}
          method="post"
        >
          <input
            name="outputType"
            type="hidden"
            value="investment_prospectus"
          />
          <input
            name="investorSegment"
            type="hidden"
            value="us_foundation_program_officer"
          />
          <input
            name="audienceFamiliarity"
            type="hidden"
            value="new_to_topic"
          />
          <input name="audienceScale" type="hidden" value="exploratory" />
          <input name="narrativeTone" type="hidden" value="balanced" />
          <input
            name="narrativeAngle"
            type="hidden"
            value="catalytic_philanthropy"
          />
          <input name="strengthenNarrative" type="hidden" value="true" />
          <button
            className="workflow-action primary"
            disabled={!canGenerate}
            type="submit"
          >
            <span aria-hidden="true">
              <InterfaceIcon name="draft" />
            </span>
            Generate Draft
          </button>
        </form>
      ) : (
        <span className="workflow-action disabled">
          <span aria-hidden="true">
            <InterfaceIcon name="draft" />
          </span>
          Generate Draft
        </span>
      )}
    </section>
  );
}

function SourceDocumentsPanel({ row }: { row?: DashboardProject }) {
  const documents = row ? sortByUpdatedAt(row.documents).slice(0, 5) : [];

  return (
    <section
      className="workspace-panel source-panel"
      aria-labelledby="source-title"
    >
      <div className="panel-heading">
        <div>
          <h2 id="source-title">1. Source Documents</h2>
          <p>Upload and parse source materials</p>
        </div>
        {row?.canEdit ? (
          <Link
            className="button compact"
            href={`/projects/${row.project.id}/upload`}
          >
            <InterfaceIcon name="plus" />
            Add Documents
          </Link>
        ) : null}
      </div>

      {documents.length === 0 ? (
        <div className="workspace-empty">
          <h3>No source documents</h3>
          <p className="muted">
            Add a source file to begin concept extraction and citation review.
          </p>
        </div>
      ) : (
        <div className="source-table">
          <div className="source-table-head">
            <span>Document</span>
            <span>Type</span>
            <span>Status</span>
            <span>Last Updated</span>
          </div>
          {documents.map((document) => (
            <div className="source-table-row" key={document.id}>
              <div className="source-name">
                <span className={sourceIconClass(document)}>
                  {document.fileExtension.toUpperCase()}
                </span>
                <div>
                  <strong>{document.filename}</strong>
                  <p>{sourceMeta(document)}</p>
                </div>
              </div>
              <span>{document.fileExtension.toUpperCase()}</span>
              <span
                className={`mini-status ${documentStatusTone(document.status)}`}
              >
                {documentStatusLabels[document.status]}
              </span>
              <span>{formatDateTime(document.updatedAt)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="parsing-note">
        <strong>Parsing notes</strong>
        <p>
          Some documents may take longer to process. Warnings remain visible
          before donor-facing drafts are exported.
        </p>
      </div>

      {row ? (
        <Link
          className="panel-link"
          href={`/projects/${row.project.id}/documents`}
        >
          View all documents
          <span aria-hidden="true">&gt;</span>
        </Link>
      ) : (
        <Link className="panel-link" href="/create">
          Create a case
          <span aria-hidden="true">&gt;</span>
        </Link>
      )}
    </section>
  );
}

function OpportunityReviewPanel({
  opportunity,
  row,
}: {
  opportunity?: OpportunityRecord;
  row?: DashboardProject;
}) {
  const score = investabilityScore(opportunity);
  const evidenceScore = criterionScore(opportunity, "evidence_strength") ?? 0;
  const fundingRecipient = opportunity?.opportunity.fundingPathways.find(
    (pathway) => pathway.pathwayType === "funding_recipient",
  );
  const beneficiaries =
    opportunity?.opportunity.beneficiaryPopulations.slice(0, 4) ?? [];
  const primaryOutcome =
    opportunity?.opportunity.expectedOutcomes[0]?.value ??
    opportunity?.opportunity.longTermImpact[0]?.value;
  const scoreStyle = {
    "--score": `${score ?? 0}%`,
  } as CSSProperties;

  return (
    <section
      className="workspace-panel opportunity-panel"
      aria-labelledby="opportunity-title"
    >
      <div className="panel-heading">
        <div>
          <h2 id="opportunity-title">2. Opportunity Review</h2>
          <p>Review the selected opportunity</p>
        </div>
        {row ? (
          <Link
            className="button compact"
            href={`/projects/${row.project.id}/opportunities`}
          >
            Change Opportunity
          </Link>
        ) : null}
      </div>

      {opportunity ? (
        <div className="concept-card">
          <p className="field-label">Concept Title</p>
          <h3>{opportunity.title}</h3>
          <div className="investability-row">
            <div className="score-ring" style={scoreStyle}>
              <strong>{score ?? "--"}</strong>
              <span>{score ? "/100" : "score"}</span>
            </div>
            <div>
              <strong>{readinessLabel(opportunity)}</strong>
              <p>
                {shortText(
                  opportunity.opportunity.investorRelevance.value,
                  "Investor relevance requires review.",
                  95,
                )}
              </p>
            </div>
          </div>

          <div className="opportunity-detail-row">
            <span>Involved Funding Recipient</span>
            <div>
              <strong
                className={
                  fundingRecipient?.status === "source_provided"
                    ? "status-positive"
                    : "status-warning"
                }
              >
                {fundingRecipient?.name ?? "Unresolved"}
              </strong>
              <p>{fundingRecipient?.note ?? "Recipient not yet confirmed"}</p>
            </div>
          </div>

          <div className="opportunity-detail-row">
            <span>Evidence Strength</span>
            <div
              className="evidence-meter"
              aria-label={`${evidenceScore} of 5`}
            >
              {Array.from({ length: 5 }, (_, index) => (
                <i
                  className={index < evidenceScore ? "active" : ""}
                  key={index}
                />
              ))}
              <strong>
                {evidenceScore > 0 ? `${evidenceScore}/5` : "Not scored"}
              </strong>
            </div>
          </div>

          <div className="opportunity-detail-row">
            <span>Key Beneficiaries</span>
            <div className="chip-row">
              {beneficiaries.length > 0 ? (
                beneficiaries.map((beneficiary) => (
                  <span key={beneficiary.id}>{beneficiary.label}</span>
                ))
              ) : (
                <span>Unresolved beneficiaries</span>
              )}
            </div>
          </div>

          <div className="opportunity-detail-row compact-row">
            <span>Primary Outcome</span>
            <strong>{shortText(primaryOutcome, "Unresolved", 70)}</strong>
          </div>
        </div>
      ) : (
        <div className="workspace-empty">
          <h3>No opportunity selected</h3>
          <p className="muted">
            Parse source documents, then extract a concept for review.
          </p>
        </div>
      )}
    </section>
  );
}

function GeneratedDraftPanel({
  draft,
  opportunity,
}: {
  draft?: DraftRecord;
  opportunity?: OpportunityRecord;
}) {
  const sections = draft
    ? [...draft.draft.sections]
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .slice(0, 4)
    : [];
  const warningCount =
    (draft?.draft.validation?.findings.filter(
      (finding) => finding.severity !== "info",
    ).length ?? 0) + (draft?.draft.evidenceGaps.length ?? 0);

  return (
    <section
      className="workspace-panel draft-panel"
      aria-labelledby="draft-title"
    >
      <div className="panel-heading">
        <div>
          <h2 id="draft-title">3. Generated Draft</h2>
          <p>Review and refine the generated investment case</p>
        </div>
        {draft ? (
          <a className="button compact primary-light" href={docxHref(draft)}>
            <InterfaceIcon name="export" />
            Export to DOCX
          </a>
        ) : null}
      </div>

      <div className="draft-tabs" aria-label="Draft views">
        <span className="active">Preview</span>
        <span>Sections</span>
        <span>Citations ({draft?.draft.citations.length ?? 0})</span>
      </div>

      {draft ? (
        <div className="draft-preview-list">
          {sections.map((section) => {
            const sectionCitationCount = citationCountForSection(
              draft,
              section.claimIds,
            );
            return (
              <article className="draft-preview-card" key={section.id}>
                <div>
                  <h3>{section.title}</h3>
                  <p>
                    {shortText(
                      plainMarkdown(section.renderedMarkdown),
                      "Section preview unavailable.",
                      145,
                    )}
                  </p>
                </div>
                <span className="citation-pill">{sectionCitationCount}</span>
                <span
                  className={`review-check${
                    section.warningText.length > 0 ? " warning" : ""
                  }`}
                  aria-label={
                    section.warningText.length > 0
                      ? "Section has warnings"
                      : "Section reviewed"
                  }
                >
                  {section.warningText.length > 0 ? "!" : "OK"}
                </span>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="workspace-empty">
          <h3>No draft yet</h3>
          <p className="muted">
            {opportunity
              ? "Generate a prospectus draft from the selected concept."
              : "Extract an opportunity before generating donor-facing output."}
          </p>
        </div>
      )}

      {draft ? (
        <div
          className={`validation-strip${warningCount > 0 ? " warning" : ""}`}
        >
          <strong>
            {warningCount > 0
              ? `${warningCount} validation warning${
                  warningCount === 1 ? "" : "s"
                }`
              : "No validation warnings"}
          </strong>
          <Link href={draftHref(draft)}>Review</Link>
        </div>
      ) : null}
    </section>
  );
}

function JobStatusPanel({ row }: { row?: DashboardProject }) {
  const latestDocument = row ? sortByUpdatedAt(row.documents).at(0) : undefined;
  const conceptRun = latestRunFor(row, ["extract_opportunities"]);
  const draftRun = latestRunFor(row, [
    "render_investment_prospectus",
    "render_executive_investment_case",
    "render_opportunity_spotlight",
    "render_donor_one_pager",
    "render_donor_deck",
    "render_meeting_talking_points",
    "render_source_appendix",
    "render_concept_note",
    "render_board_brief",
    "render_hnwi_donor_teaser",
  ]);
  const validationRun = latestRunFor(row, ["validate_draft_claims"]);
  const conceptStatus = runStatus(
    conceptRun,
    Boolean(row?.opportunities.length),
  );
  const draftStatus = runStatus(draftRun, Boolean(row?.drafts.length));
  const validationStatus = runStatus(
    validationRun,
    Boolean(row?.drafts.some((draft) => draft.draft.validation)),
  );
  const documentStatus = latestDocument
    ? documentStatusLabels[latestDocument.status]
    : "Waiting";
  const jobs = [
    {
      title: latestDocument
        ? `Document Parsing - ${latestDocument.fileExtension.toUpperCase()}`
        : "Document Parsing",
      detail: latestDocument
        ? `${latestDocument.filename} - updated ${formatDateTime(
            latestDocument.updatedAt,
          )}`
        : "No source document queued",
      status: documentStatus,
      tone: latestDocument
        ? documentStatusTone(latestDocument.status)
        : "waiting",
    },
    {
      title: "Concept Extraction",
      detail: conceptRun
        ? `Updated ${formatDateTime(conceptRun.updatedAt)}`
        : `${row?.opportunities.length ?? 0} concept(s) available`,
      status: conceptStatus,
      tone: runTone(conceptStatus),
    },
    {
      title: "Draft Generation",
      detail: draftRun
        ? `Updated ${formatDateTime(draftRun.updatedAt)}`
        : `${row?.drafts.length ?? 0} draft(s) generated`,
      status: draftStatus,
      tone: runTone(draftStatus),
    },
    {
      title: "Citation Validation",
      detail: validationRun
        ? `Updated ${formatDateTime(validationRun.updatedAt)}`
        : "Claim-level evidence review",
      status: validationStatus,
      tone: runTone(validationStatus),
    },
  ];

  return (
    <section className="workspace-panel job-panel" aria-labelledby="jobs-title">
      <div className="panel-heading">
        <div>
          <h2 id="jobs-title">Databricks Job Status</h2>
          <p>
            Background jobs powering document processing and draft generation
          </p>
        </div>
        {row ? (
          <Link
            className="panel-link inline"
            href={`/projects/${row.project.id}/documents`}
          >
            All jobs
            <span aria-hidden="true">&gt;</span>
          </Link>
        ) : null}
      </div>
      <div className="job-grid">
        {jobs.map((job) => (
          <article className="job-card" key={job.title}>
            <span className={`job-icon ${job.tone}`} aria-hidden="true" />
            <div>
              <h3>{job.title}</h3>
              <strong className={job.tone}>{job.status}</strong>
              <p>{shortText(job.detail, "No details", 82)}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ProjectListView({ rows }: { rows: DashboardProject[] }) {
  const sortedRows = sortRowsByActivity(rows);

  return (
    <section
      className="workspace-panel projects-list-panel"
      aria-labelledby="projects-title"
    >
      <div className="panel-heading projects-heading">
        <div>
          <h2 id="projects-title">Projects</h2>
          <p>
            Select a project to review source documents, opportunities, drafts,
            and jobs.
          </p>
        </div>
        <Link className="button compact primary-light" href="/create">
          <InterfaceIcon name="plus" />
          Create Project
        </Link>
      </div>

      {sortedRows.length === 0 ? (
        <div className="workspace-empty">
          <h3>No projects yet</h3>
          <p className="muted">
            Create a project and upload source material to start generating
            source-grounded investment case drafts.
          </p>
        </div>
      ) : (
        <div className="projects-table">
          <div className="projects-table-head">
            <span>Project</span>
            <span>Status</span>
            <span>Sources</span>
            <span>Opportunities</span>
            <span>Drafts</span>
            <span>Last Updated</span>
            <span>Action</span>
          </div>
          {sortedRows.map((row, index) => {
            const parsedDocuments = row.documents.filter(
              (document) => document.status === "parsed",
            ).length;
            const rowDraft = latestDraft(row);

            return (
              <article className="projects-table-row" key={row.project.id}>
                <div className="project-list-title">
                  <span className={`project-thumb thumb-${index % 4}`}>
                    {row.project.name.slice(0, 2).toUpperCase()}
                  </span>
                  <div>
                    <h3>
                      <Link href={`/?projectId=${row.project.id}`}>
                        {row.project.name}
                      </Link>
                    </h3>
                    <p>
                      {shortText(
                        row.project.description,
                        rowDraft?.draft.title ??
                          "No project description recorded.",
                        92,
                      )}
                    </p>
                  </div>
                </div>
                <span className="active-chip project-status-chip">
                  {projectStatus(row)}
                </span>
                <span>
                  {row.documents.length}
                  <small>{parsedDocuments} parsed</small>
                </span>
                <span>{row.opportunities.length}</span>
                <span>{row.drafts.length}</span>
                <span>{formatDateTime(latestActivity(row))}</span>
                <Link
                  className="button compact"
                  href={`/?projectId=${row.project.id}`}
                >
                  Open
                </Link>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function WorkspaceShell({
  activeRow,
  children,
  latestDraftRecord,
  rows,
  user,
}: {
  activeRow?: DashboardProject;
  children: ReactNode;
  latestDraftRecord?: DraftRecord;
  rows: DashboardProject[];
  user: User;
}) {
  return (
    <main className="workspace-app">
      <WorkspaceSidebar
        activeRow={activeRow}
        latestDraftRecord={latestDraftRecord}
        rows={rows}
        user={user}
      />
      <div className="workspace-main">{children}</div>
    </main>
  );
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const user = await requirePageUser("/");
  const [{ rows, storageError }, params] = await Promise.all([
    loadDashboardData(user),
    searchParams,
  ]);
  const status = firstValue(params.status);
  const message = firstValue(params.message);
  const selectedProjectId = firstValue(params.projectId);
  const activeRow = selectedProjectId
    ? rows.find((row) => row.project.id === selectedProjectId)
    : undefined;
  const activeOpportunity = selectedOpportunity(activeRow);
  const activeDraft = latestDraft(activeRow);
  const latestDraftRecord = activeDraft;
  const activeDescription = activeRow?.project.description
    ? shortText(activeRow.project.description, "", 110)
    : "Source-grounded concept review, donor narrative generation, and export history in one place.";
  const lastUpdated = activeRow
    ? formatDateTime(latestActivity(activeRow))
    : "No activity yet";

  return (
    <WorkspaceShell
      activeRow={activeRow}
      latestDraftRecord={latestDraftRecord}
      rows={rows}
      user={user}
    >
      <header className="workspace-header">
        <div>
          <p>{activeRow ? "Project" : "Workspace"}</p>
          <div className="workspace-title-row">
            <h1>{activeRow?.project.name ?? "Projects"}</h1>
            {activeRow ? (
              <>
                <span className="workspace-star" aria-hidden="true">
                  <InterfaceIcon name="star" />
                </span>
                <span className="active-chip">{projectStatus(activeRow)}</span>
              </>
            ) : null}
          </div>
          <span>{activeDescription}</span>
        </div>
        <div className="workspace-header-actions">
          <p>Last updated: {lastUpdated}</p>
          <Link className="icon-link" href="/" aria-label="Refresh dashboard">
            <InterfaceIcon name="refresh" />
          </Link>
          <Link className="icon-link" href="/create" aria-label="Create case">
            <InterfaceIcon name="plus" />
          </Link>
        </div>
      </header>

      {storageError ? <p className="alert error">{storageError}</p> : null}
      {status === "error" && message ? (
        <p className="alert error">{message}</p>
      ) : null}
      {status === "success" && message ? (
        <p className="alert success">{message}</p>
      ) : null}

      {activeRow ? (
        <>
          <WorkflowActions
            activeRow={activeRow}
            opportunity={activeOpportunity}
          />

          <section className="workspace-board">
            <SourceDocumentsPanel row={activeRow} />
            <OpportunityReviewPanel
              opportunity={activeOpportunity}
              row={activeRow}
            />
            <GeneratedDraftPanel
              draft={activeDraft}
              opportunity={activeOpportunity}
            />
          </section>

          <JobStatusPanel row={activeRow} />
        </>
      ) : (
        <ProjectListView rows={rows} />
      )}
    </WorkspaceShell>
  );
}
