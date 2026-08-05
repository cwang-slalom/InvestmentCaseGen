import Link from "next/link";
import { notFound } from "next/navigation";

import { VoiceTextInput } from "@/app/_components/voice-text-input";
import {
  audienceFamiliarityOptions,
  audienceScaleOptions,
  investorSegments,
  narrativeAngleOptions,
  narrativeToneOptions,
  outputOptions,
} from "@/app/generation-options";
import type {
  Citation,
  DonorFollowUpUpdate,
  DraftRecord,
  DraftSection,
  OpportunityClaim,
  ProductQualityEvaluation,
  ValidatedDraft,
} from "@/domain";
import { getProjectAccess, requirePageUser } from "@/server/auth";
import { getStorage } from "@/server/storage";

export const dynamic = "force-dynamic";

type DraftPageProps = {
  params: Promise<{
    projectId: string;
    opportunityId: string;
    draftId: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function labelFor(
  options: ReadonlyArray<{ value: string; label: string }>,
  value: string,
) {
  return options.find((option) => option.value === value)?.label ?? value;
}

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`status ${status}`}>{status.replaceAll("_", " ")}</span>
  );
}

function citationLabels(citations: Citation[]) {
  return new Map(
    citations.map((citation, index) => [citation.id, `[S${index + 1}]`]),
  );
}

function evidenceGroupForClaim(claim: OpportunityClaim) {
  if (
    claim.status === "unresolved" ||
    claim.status === "conflicting" ||
    ["unsupported", "conflicting", "partially_supported"].includes(
      claim.validationStatus,
    )
  ) {
    return "unresolved";
  }

  if (
    claim.status === "generated_framing" ||
    claim.kind === "narrative_framing" ||
    claim.kind === "recommendation"
  ) {
    return "generated";
  }

  return "source";
}

function EvidenceClaimItem({
  claim,
  citationsById,
  labels,
}: {
  claim: OpportunityClaim;
  citationsById: Map<string, Citation>;
  labels: Map<string, string>;
}) {
  return (
    <div className="evidence-item" key={claim.id}>
      <p>{claim.statement}</p>
      <p className="field-meta">
        <StatusBadge status={claim.status} />
        <span>{claim.kind.replaceAll("_", " ")}</span>
        <span>{claim.validationStatus.replaceAll("_", " ")}</span>
      </p>
      {claim.citationIds.length > 0 ? (
        <ul>
          {claim.citationIds.map((citationId) => {
            const citation = citationsById.get(citationId);
            return (
              <li key={citationId}>
                <strong>{labels.get(citationId) ?? "[S?]"}</strong>{" "}
                {citation?.filename ?? "Unknown source"}
                {citation?.pageNumber ? `, page ${citation.pageNumber}` : ""}
                {citation?.slideNumber ? `, slide ${citation.slideNumber}` : ""}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="muted">No citation attached.</p>
      )}
    </div>
  );
}

function EvidencePanel({
  draft,
  section,
}: {
  draft: ValidatedDraft;
  section: DraftSection;
}) {
  const labels = citationLabels(draft.citations);
  const citationsById = new Map(
    draft.citations.map((citation) => [citation.id, citation]),
  );
  const claims = section.claimIds
    .map((claimId) => draft.claims.find((claim) => claim.id === claimId))
    .filter((claim): claim is OpportunityClaim => Boolean(claim));
  const groupedClaims = {
    source: claims.filter((claim) => evidenceGroupForClaim(claim) === "source"),
    generated: claims.filter(
      (claim) => evidenceGroupForClaim(claim) === "generated",
    ),
    unresolved: claims.filter(
      (claim) => evidenceGroupForClaim(claim) === "unresolved",
    ),
  };
  const gaps = section.evidenceGapIds
    .map((gapId) => draft.evidenceGaps.find((gap) => gap.id === gapId))
    .filter(Boolean);

  return (
    <aside className="evidence-panel">
      <h4>Evidence</h4>
      {[
        { title: "Source facts", items: groupedClaims.source },
        { title: "Generated framing", items: groupedClaims.generated },
        {
          title: "Unresolved or weak support",
          items: groupedClaims.unresolved,
        },
      ].map(({ title, items }) => (
        <div className="evidence-group" key={title}>
          <h4>{title}</h4>
          {items.length > 0 ? (
            items.map((claim) => (
              <EvidenceClaimItem
                claim={claim}
                citationsById={citationsById}
                labels={labels}
                key={claim.id}
              />
            ))
          ) : (
            <p className="muted">None in this section.</p>
          )}
        </div>
      ))}
      {gaps.length > 0 ? (
        <div className="evidence-item">
          <h4>Gaps</h4>
          <ul>
            {gaps.map((gap) => (
              <li key={gap?.id}>{gap?.description}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {section.warningText.length > 0 ? (
        <div className="evidence-item">
          <h4>Warnings</h4>
          <ul>
            {section.warningText.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </aside>
  );
}

function QualityPanel({
  evaluation,
}: {
  evaluation: ProductQualityEvaluation | undefined;
}) {
  if (!evaluation) {
    return <p className="muted">Product-quality evaluation has not run.</p>;
  }

  return (
    <div className="stack inset">
      <div className="score-item">
        <strong>{evaluation.overallScore.toFixed(1)}/5</strong>
        <span>overall product quality</span>
      </div>
      <div className="score-grid">
        {evaluation.metrics.map((metric) => (
          <div className="score-item" key={metric.metricKey}>
            <strong>{metric.score}/5</strong>
            <span>{metric.metricKey.replaceAll("_", " ")}</span>
          </div>
        ))}
      </div>
      {evaluation.blockers.length > 0 ? (
        <ul className="warning-list">
          {evaluation.blockers.map((blocker) => (
            <li key={blocker}>{blocker}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function ValidationPanel({ draft }: { draft: ValidatedDraft }) {
  const findings = draft.validation?.findings ?? [];

  return (
    <div className="stack inset">
      <p>
        <StatusBadge status={draft.validation?.status ?? "not_checked"} />
      </p>
      {findings.length > 0 ? (
        <ul className="warning-list">
          {findings.map((finding) => (
            <li key={finding.id}>{finding.message}</li>
          ))}
        </ul>
      ) : (
        <p className="muted">No validation findings.</p>
      )}
    </div>
  );
}

function AudienceTailoringPanel({ draft }: { draft: ValidatedDraft }) {
  const tailoring = draft.audienceTailoring;

  return (
    <div className="stack inset">
      <div className="detail-row">
        <div>
          <h4>Audience familiarity</h4>
          <p>{labelFor(audienceFamiliarityOptions, tailoring.familiarity)}</p>
        </div>
      </div>
      <div className="detail-row">
        <div>
          <h4>Funding scale</h4>
          <p>{labelFor(audienceScaleOptions, tailoring.scale)}</p>
        </div>
      </div>
      <div className="detail-row">
        <div>
          <h4>Tone</h4>
          <p>{labelFor(narrativeToneOptions, tailoring.tone)}</p>
        </div>
      </div>
      {tailoring.customInstructions ? (
        <div className="detail-row">
          <div>
            <h4>Tailoring notes</h4>
            <p>{tailoring.customInstructions}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function VariantPanel({ draft }: { draft: ValidatedDraft }) {
  const builder = draft.prospectusBuilder;
  const narrativeAngle = labelFor(
    narrativeAngleOptions,
    builder.narrativeAngle,
  );

  return (
    <div className="stack inset">
      <div className="detail-row">
        <div>
          <h4>Saved format</h4>
          <p>
            {draft.variant?.formatLabel ??
              labelFor(outputOptions, draft.outputType)}
          </p>
        </div>
      </div>
      <div className="detail-row">
        <div>
          <h4>Variant</h4>
          <p>{draft.variant?.label ?? "Untitled variant"}</p>
        </div>
      </div>
      <div className="detail-row">
        <div>
          <h4>Audience profile</h4>
          <p>
            {draft.variant?.audienceProfileLabel ??
              labelFor(investorSegments, draft.investorSegment)}
          </p>
        </div>
      </div>
      <div className="detail-row">
        <div>
          <h4>Narrative angle</h4>
          <p>{narrativeAngle}</p>
        </div>
      </div>
      {builder.intendedAudience ? (
        <div className="detail-row">
          <div>
            <h4>Intended audience</h4>
            <p>{builder.intendedAudience}</p>
          </div>
        </div>
      ) : null}
      {builder.callToAction ? (
        <div className="detail-row">
          <div>
            <h4>Call to action</h4>
            <p>{builder.callToAction}</p>
          </div>
        </div>
      ) : null}
      {builder.positioningNotes ? (
        <div className="detail-row">
          <div>
            <h4>Positioning notes</h4>
            <p>{builder.positioningNotes}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FollowUpUpdatesPanel({
  canEdit,
  draftRecord,
}: {
  canEdit: boolean;
  draftRecord: DraftRecord;
}) {
  const updates = [...draftRecord.draft.followUpUpdates].reverse();

  return (
    <section className="panel stack" aria-labelledby="followups-title">
      <div className="followup-header">
        <div>
          <p className="section-kicker">Donor follow-ups</p>
          <h2 id="followups-title">Proactive updates</h2>
        </div>
        <span className="counter">{updates.length}</span>
      </div>
      {canEdit ? (
        <form
          action={`/api/projects/${draftRecord.projectId}/opportunities/${draftRecord.opportunityRecordId}/drafts/${draftRecord.id}/followups`}
          className="followup-form"
          method="post"
        >
          <label className="field">
            <span>Donor or funder</span>
            <VoiceTextInput
              fieldLabel="Donor or funder"
              name="donorName"
              placeholder="Optional"
              type="text"
              voiceLabel="Dictate donor or funder"
            />
          </label>
          <label className="field">
            <span>Follow-up</span>
            <VoiceTextInput
              as="textarea"
              fieldLabel="Follow-up"
              name="message"
              placeholder="Paste the question, concern, or requested change."
              required
              rows={4}
              voiceLabel="Dictate follow-up"
            />
          </label>
          <button className="button primary" type="submit">
            Apply follow-up
          </button>
        </form>
      ) : null}
      {updates.length > 0 ? (
        <div className="followup-list">
          {updates.map((update) => (
            <FollowUpUpdateItem update={update} key={update.id} />
          ))}
        </div>
      ) : (
        <p className="muted">No donor follow-ups recorded.</p>
      )}
    </section>
  );
}

function FollowUpUpdateItem({ update }: { update: DonorFollowUpUpdate }) {
  return (
    <article className="followup-item">
      <div>
        <p className="field-meta">
          <span>{update.receivedAtIso.slice(0, 10)}</span>
          {update.donorName ? <span>{update.donorName}</span> : null}
        </p>
        <h3>
          {update.topics.map((topic) => topic.replaceAll("_", " ")).join(", ")}
        </h3>
      </div>
      <p>{update.message}</p>
      <p className="field-meta">
        {update.actions.map((action) => (
          <StatusBadge status={action} key={action} />
        ))}
      </p>
      {update.sourceBackedSummary ? (
        <p className="muted">{update.sourceBackedSummary}</p>
      ) : null}
      <div className="followup-response">{update.proposedResponseMarkdown}</div>
      {update.unresolvedRequests.length > 0 ? (
        <div>
          <h4>Evidence needed</h4>
          <ul className="warning-list">
            {update.unresolvedRequests.map((gap) => (
              <li key={gap.id}>{gap.description}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}

function DraftSectionView({
  canEdit,
  draftRecord,
  section,
}: {
  canEdit: boolean;
  draftRecord: DraftRecord;
  section: DraftSection;
}) {
  return (
    <section className="draft-section">
      <div className="draft-section-main">
        <div className="section-heading-row">
          <div>
            <p className="section-kicker">Section</p>
            <h2>{section.title}</h2>
          </div>
          {canEdit ? (
            <form
              action={`/api/projects/${draftRecord.projectId}/opportunities/${draftRecord.opportunityRecordId}/drafts/${draftRecord.id}/sections/${section.sectionKey}/regenerate`}
              method="post"
            >
              <button className="button" type="submit">
                Regenerate
              </button>
            </form>
          ) : null}
        </div>
        <div className="draft-section-body">{section.renderedMarkdown}</div>
        {section.regenerationCount > 0 ? (
          <p className="muted">
            Regenerated {section.regenerationCount} time(s).
          </p>
        ) : null}
      </div>
      <EvidencePanel draft={draftRecord.draft} section={section} />
    </section>
  );
}

export default async function DraftReviewPage({
  params,
  searchParams,
}: DraftPageProps) {
  const { projectId, opportunityId, draftId } = await params;
  const query = await searchParams;
  const regenerated = firstValue(query.regenerated);
  const followup = firstValue(query.followup);
  const followupError = firstValue(query.followupError);
  const user = await requirePageUser(
    `/projects/${projectId}/opportunities/${opportunityId}/drafts/${draftId}`,
  );
  const storage = getStorage();
  const access = await getProjectAccess({ user, projectId, storage });
  const project = access.project;
  const draftRecord = project
    ? await storage.getDraftRecord(projectId, draftId)
    : null;

  if (
    !project ||
    !draftRecord ||
    draftRecord.opportunityRecordId !== opportunityId
  ) {
    notFound();
  }

  const sections = [...draftRecord.draft.sections].sort(
    (a, b) => a.orderIndex - b.orderIndex,
  );

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Donor-Facing Draft</p>
          <h1>{draftRecord.draft.title}</h1>
          <p className="muted">
            {draftRecord.draft.variant?.formatLabel ??
              labelFor(outputOptions, draftRecord.outputType)}{" "}
            ·{" "}
            {draftRecord.draft.variant?.audienceProfileLabel ??
              labelFor(investorSegments, draftRecord.investorSegment)}{" "}
            ·{" "}
            {labelFor(
              narrativeAngleOptions,
              draftRecord.draft.prospectusBuilder.narrativeAngle,
            )}
          </p>
          <p className="session-note">
            Signed in as {user.name} - {access.role ?? "admin"}
          </p>
        </div>
        <nav className="actions" aria-label="Draft navigation">
          <Link className="button" href="/">
            Back to dashboard
          </Link>
          <Link
            className="button"
            href={`/projects/${projectId}/opportunities/${opportunityId}`}
          >
            Opportunity
          </Link>
          <a
            className="button primary"
            href={`/api/projects/${projectId}/opportunities/${opportunityId}/drafts/${draftId}/export/docx`}
          >
            Export DOCX
          </a>
          <form action="/api/auth/logout" method="post">
            <button className="button" type="submit">
              Sign out
            </button>
          </form>
        </nav>
      </header>

      {regenerated ? (
        <p className="alert success">
          Regenerated {regenerated.replaceAll("_", " ")}.
        </p>
      ) : null}
      {followup === "applied" ? (
        <p className="alert success">Applied donor follow-up update.</p>
      ) : null}
      {followupError ? <p className="alert error">{followupError}</p> : null}

      <section className="workspace-grid roomy">
        <section className="panel stack">
          <div>
            <p className="section-kicker">Validation</p>
            <h2>Claim and citation checks</h2>
          </div>
          <ValidationPanel draft={draftRecord.draft} />
        </section>

        <section className="panel stack">
          <div>
            <p className="section-kicker">Evaluation</p>
            <h2>Product-quality scorecard</h2>
          </div>
          <QualityPanel
            evaluation={draftRecord.draft.productQualityEvaluation}
          />
        </section>

        <section className="panel stack">
          <div>
            <p className="section-kicker">Variant</p>
            <h2>Saved narrative variant</h2>
          </div>
          <VariantPanel draft={draftRecord.draft} />
        </section>

        <section className="panel stack">
          <div>
            <p className="section-kicker">Audience</p>
            <h2>Tailoring lens</h2>
          </div>
          <AudienceTailoringPanel draft={draftRecord.draft} />
        </section>
      </section>

      <FollowUpUpdatesPanel
        canEdit={access.canEdit}
        draftRecord={draftRecord}
      />

      <section className="panel stack">
        <div>
          <p className="section-kicker">Narrative</p>
          <h2>Strengthening notes</h2>
        </div>
        {draftRecord.draft.narrativeChanges.length > 0 ? (
          <ul className="warning-list">
            {draftRecord.draft.narrativeChanges.map((change) => (
              <li key={change}>{change}</li>
            ))}
          </ul>
        ) : (
          <p className="muted">No strengthening notes recorded.</p>
        )}
      </section>

      <div className="stack">
        {sections.map((section) => (
          <DraftSectionView
            canEdit={access.canEdit}
            draftRecord={draftRecord}
            section={section}
            key={section.id}
          />
        ))}
      </div>
    </main>
  );
}
