import Link from "next/link";
import { notFound } from "next/navigation";

import type { OpportunityRecord } from "@/domain";
import { getProjectAccess, requirePageUser } from "@/server/auth";
import { getStorage } from "@/server/storage";

export const dynamic = "force-dynamic";

type OpportunitiesPageProps = {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function EvidencePreview({ record }: { record: OpportunityRecord }) {
  const sourceClaims = record.opportunity.claims.slice(0, 3);

  if (sourceClaims.length === 0) {
    return <p className="muted">No source claims were captured.</p>;
  }

  return (
    <ul className="compact-list">
      {sourceClaims.map((claim) => (
        <li key={claim.id}>{claim.statement}</li>
      ))}
    </ul>
  );
}

function GapPreview({ record }: { record: OpportunityRecord }) {
  const gaps = record.opportunity.evidenceGaps.slice(0, 4);

  if (gaps.length === 0) {
    return <p className="muted">No evidence gaps recorded.</p>;
  }

  return (
    <ul className="warning-list">
      {gaps.map((gap) => (
        <li key={gap.id}>{gap.description}</li>
      ))}
    </ul>
  );
}

export default async function OpportunitiesPage({
  params,
  searchParams,
}: OpportunitiesPageProps) {
  const { projectId } = await params;
  const query = await searchParams;
  const user = await requirePageUser(`/projects/${projectId}/opportunities`);
  const storage = getStorage();
  const access = await getProjectAccess({ user, projectId, storage });
  const project = access.project;

  if (!project) {
    notFound();
  }

  const [documents, opportunities] = await Promise.all([
    storage.listSourceDocuments(projectId),
    storage.listOpportunityRecords(projectId),
  ]);
  const parsedDocumentCount = documents.filter(
    (document) => document.status === "parsed",
  ).length;
  const extracted = firstValue(query.extracted);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Project</p>
          <h1>{project.name}</h1>
          <p className="session-note">
            Signed in as {user.name} - {access.role ?? "admin"}
          </p>
        </div>
        <nav className="actions" aria-label="Project navigation">
          <Link className="button" href="/">
            Back to dashboard
          </Link>
          <Link className="button" href={`/projects/${projectId}/documents`}>
            Documents
          </Link>
          {access.canEdit ? (
            <Link className="button" href={`/projects/${projectId}/upload`}>
              Upload
            </Link>
          ) : null}
          <form action="/api/auth/logout" method="post">
            <button className="button" type="submit">
              Sign out
            </button>
          </form>
        </nav>
      </header>

      {extracted ? (
        <p className="alert success">
          Prepared {extracted} investment case candidate
          {extracted === "1" ? "" : "s"}.
        </p>
      ) : null}

      <section className="panel stack">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Document intelligence</p>
            <h2>Investment case output</h2>
          </div>
          {access.canEdit ? (
            <form
              action={`/api/projects/${projectId}/opportunities/extract`}
              method="post"
            >
              <button
                className="button primary"
                type="submit"
                disabled={parsedDocumentCount === 0}
              >
                Prepare output
              </button>
            </form>
          ) : null}
        </div>

        {parsedDocumentCount === 0 ? (
          <p className="alert error">
            Upload and parse at least one source document before extracting an
            investment case output.
          </p>
        ) : null}

        {opportunities.length === 0 ? (
          <p className="muted">No investment case output prepared yet.</p>
        ) : (
          <div className="opportunity-grid">
            {opportunities.map((record) => (
              <article className="opportunity-card" key={record.id}>
                <div>
                  <p className="section-kicker">Selected concept</p>
                  <h3>{record.title}</h3>
                </div>
                <p className="muted">
                  {record.opportunity.summary.value ??
                    "Summary requires review."}
                </p>
                <div>
                  <h4>Source Claims</h4>
                  <EvidencePreview record={record} />
                </div>
                <div>
                  <h4>Evidence Gaps</h4>
                  <GapPreview record={record} />
                </div>
                <Link
                  className="button small"
                  href={`/projects/${projectId}/opportunities/${record.id}`}
                >
                  Review and generate
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
