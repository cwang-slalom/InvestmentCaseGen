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
  AssessmentCriterion,
  DraftRecord,
  EvidenceBackedText,
  FieldStatus,
  FundingPathway,
  OpportunityRecord,
  OrganizationRole,
} from "@/domain";
import { getProjectAccess, requirePageUser } from "@/server/auth";
import { getStorage } from "@/server/storage";

export const dynamic = "force-dynamic";

type ReviewPageProps = {
  params: Promise<{ projectId: string; opportunityId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const evidenceFields = [
  ["title", "Title"],
  ["summary", "Summary"],
  ["problemStatement", "Problem"],
  ["proposedIntervention", "Intervention"],
  ["whyNow", "Why now"],
  ["investorRelevance", "Investor relevance"],
] as const;

const fieldStatuses: FieldStatus[] = [
  "source_provided",
  "derived_from_sources",
  "generated_framing",
  "unresolved",
  "conflicting",
  "not_applicable",
];

const roleLabels = {
  concept_owner: "Concept Owner",
  sponsoring_team: "Sponsoring Team",
  implementing_organization: "Implementing Organization",
  delivery_partner: "Delivery Partner",
  investment_manager: "Investment Manager",
  fiscal_sponsor: "Fiscal Sponsor",
};

const requiredRoles = Object.keys(roleLabels) as Array<keyof typeof roleLabels>;

const capitalRoleLabels = {
  funding_recipient: "Funding Recipient",
  investment_vehicle: "Investment Vehicle",
} as const;

const requiredCapitalRoles = Object.keys(capitalRoleLabels) as Array<
  keyof typeof capitalRoleLabels
>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function labelFor(
  options: ReadonlyArray<{ value: string; label: string }>,
  value: string,
) {
  return options.find((option) => option.value === value)?.label ?? value;
}

function roleValue(
  record: OpportunityRecord,
  roleType: OrganizationRole["roleType"],
) {
  return record.opportunity.organizationRoles.find(
    (role) => role.roleType === roleType,
  );
}

function pathwayValue(
  record: OpportunityRecord,
  pathwayType: FundingPathway["pathwayType"],
) {
  return record.opportunity.fundingPathways.find(
    (pathway) => pathway.pathwayType === pathwayType,
  );
}

function ProspectusSnapshot({ record }: { record: OpportunityRecord }) {
  const implementer = roleValue(record, "implementing_organization");
  const fundingRecipient = pathwayValue(record, "funding_recipient");
  const investmentVehicle = pathwayValue(record, "investment_vehicle");
  const beneficiary = record.opportunity.beneficiaryPopulations[0];

  return (
    <div className="builder-snapshot">
      <div>
        <span>Implementer</span>
        <strong>
          {implementer?.organizationName ?? "Unresolved in source materials"}
        </strong>
      </div>
      <div>
        <span>Funding recipient</span>
        <strong>{fundingRecipient?.name ?? "Unresolved"}</strong>
      </div>
      <div>
        <span>Investment vehicle</span>
        <strong>{investmentVehicle?.name ?? "Unresolved"}</strong>
      </div>
      <div>
        <span>Beneficiary</span>
        <strong>{beneficiary?.label ?? "Unresolved"}</strong>
      </div>
    </div>
  );
}

function tailoringSummary(draft: DraftRecord) {
  const tailoring = draft.draft.audienceTailoring;
  return [
    labelFor(audienceFamiliarityOptions, tailoring.familiarity),
    labelFor(audienceScaleOptions, tailoring.scale),
    labelFor(narrativeToneOptions, tailoring.tone),
  ].join(" / ");
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`status ${status}`}>{status.replaceAll("_", " ")}</span>
  );
}

function FieldMeta({ field }: { field: EvidenceBackedText }) {
  return (
    <p className="field-meta">
      <StatusBadge status={field.status} />{" "}
      {field.humanReviewed ? (
        <span>Human reviewed</span>
      ) : (
        <span>Not reviewed</span>
      )}{" "}
      <span>{field.citationIds.length} citation(s)</span>
    </p>
  );
}

function EvidenceEditor({ record }: { record: OpportunityRecord }) {
  return (
    <form
      className="panel stack"
      action={`/api/projects/${record.projectId}/opportunities/${record.id}/review`}
      method="post"
    >
      <div>
        <p className="section-kicker">Review</p>
        <h2>Edit opportunity fields</h2>
      </div>
      {evidenceFields.map(([fieldKey, label]) => {
        const field = record.opportunity[fieldKey];
        return (
          <label className="field" key={fieldKey}>
            <span>{label}</span>
            <VoiceTextInput
              as="textarea"
              fieldLabel={label}
              name={fieldKey}
              rows={fieldKey === "title" ? 2 : 4}
              defaultValue={field.value ?? ""}
              voiceLabel={`Dictate ${label.toLowerCase()}`}
            />
            <select name={`${fieldKey}Status`} defaultValue={field.status}>
              {fieldStatuses.map((status) => (
                <option value={status} key={status}>
                  {status.replaceAll("_", " ")}
                </option>
              ))}
            </select>
            <FieldMeta field={field} />
          </label>
        );
      })}
      <button className="button primary" type="submit">
        Save review
      </button>
    </form>
  );
}

function GenerateDraftPanel({ record }: { record: OpportunityRecord }) {
  return (
    <form
      className="panel stack"
      action={`/api/projects/${record.projectId}/opportunities/${record.id}/drafts`}
      method="post"
    >
      <div>
        <p className="section-kicker">Generation</p>
        <h2>Concept prospectus builder</h2>
      </div>
      <ProspectusSnapshot record={record} />
      <label className="field">
        <span>Saved format</span>
        <select name="outputType" defaultValue="investment_prospectus">
          {outputOptions.map((option) => (
            <option value={option.value} key={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Audience profile</span>
        <select
          name="investorSegment"
          defaultValue="us_foundation_program_officer"
        >
          {investorSegments.map((segment) => (
            <option value={segment.value} key={segment.value}>
              {segment.label}
            </option>
          ))}
        </select>
      </label>
      <div className="form-grid">
        <label className="field">
          <span>Audience familiarity</span>
          <select name="audienceFamiliarity" defaultValue="new_to_topic">
            {audienceFamiliarityOptions.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Funding scale</span>
          <select name="audienceScale" defaultValue="exploratory">
            {audienceScaleOptions.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="form-grid">
        <label className="field">
          <span>Tone</span>
          <select name="narrativeTone" defaultValue="balanced">
            {narrativeToneOptions.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Narrative angle</span>
          <select name="narrativeAngle" defaultValue="catalytic_philanthropy">
            {narrativeAngleOptions.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="field">
        <span>Variant name</span>
        <VoiceTextInput
          fieldLabel="Variant name"
          maxLength={120}
          name="variantLabel"
          placeholder="Optional saved variant label"
          type="text"
          voiceLabel="Dictate variant name"
        />
      </label>
      <div className="form-grid">
        <label className="field">
          <span>Intended audience</span>
          <VoiceTextInput
            fieldLabel="Intended audience"
            maxLength={160}
            name="intendedAudience"
            placeholder="Optional funder, donor type, or meeting context"
            type="text"
            voiceLabel="Dictate intended audience"
          />
        </label>
        <label className="field">
          <span>Call to action</span>
          <VoiceTextInput
            fieldLabel="Call to action"
            maxLength={240}
            name="callToAction"
            placeholder="Optional next conversation or donor action"
            type="text"
            voiceLabel="Dictate call to action"
          />
        </label>
      </div>
      <label className="field">
        <span>Tailoring notes</span>
        <VoiceTextInput
          as="textarea"
          fieldLabel="Tailoring notes"
          maxLength={500}
          name="tailoringNotes"
          placeholder="Optional audience nuance"
          rows={3}
          voiceLabel="Dictate tailoring notes"
        />
      </label>
      <label className="field">
        <span>Positioning notes</span>
        <VoiceTextInput
          as="textarea"
          fieldLabel="Positioning notes"
          maxLength={700}
          name="positioningNotes"
          placeholder="Optional narrative direction; not treated as source evidence"
          rows={3}
          voiceLabel="Dictate positioning notes"
        />
      </label>
      <label className="checkbox-row">
        <input name="strengthenNarrative" type="checkbox" defaultChecked />
        <span>Apply narrative strengthening</span>
      </label>
      <button className="button primary" type="submit">
        Generate draft
      </button>
    </form>
  );
}

function DraftList({
  projectId,
  opportunityId,
  drafts,
}: {
  projectId: string;
  opportunityId: string;
  drafts: DraftRecord[];
}) {
  if (drafts.length === 0) {
    return <p className="muted">No donor-facing drafts generated yet.</p>;
  }

  return (
    <div className="stack inset">
      {drafts.map((draft) => (
        <div className="detail-row" key={draft.id}>
          <div>
            <h4>
              {draft.draft.variant?.label ??
                draft.outputType.replaceAll("_", " ")}
            </h4>
            <p>
              {draft.draft.variant?.formatLabel ??
                draft.outputType.replaceAll("_", " ")}{" "}
              ·{" "}
              {draft.draft.variant?.audienceProfileLabel ??
                labelFor(investorSegments, draft.investorSegment)}{" "}
              · {tailoringSummary(draft)} · {draft.draft.sections.length}{" "}
              section(s) · quality{" "}
              {draft.draft.productQualityEvaluation?.overallScore.toFixed(1) ??
                "not scored"}
              /5
            </p>
          </div>
          <Link
            className="button"
            href={`/projects/${projectId}/opportunities/${opportunityId}/drafts/${draft.id}`}
          >
            Open
          </Link>
        </div>
      ))}
    </div>
  );
}

function RoleTable({
  roles,
  pathways,
}: {
  roles: OrganizationRole[];
  pathways: FundingPathway[];
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Role</th>
            <th>Organization</th>
            <th>Status</th>
            <th>Citations</th>
          </tr>
        </thead>
        <tbody>
          {requiredRoles.map((roleType) => {
            const role = roles.find(
              (candidate) => candidate.roleType === roleType,
            );
            return (
              <tr key={roleType}>
                <td>{roleLabels[roleType]}</td>
                <td>
                  {role?.organizationName ??
                    "Not established in the provided source materials."}
                </td>
                <td>
                  <StatusBadge status={role?.status ?? "unresolved"} />
                </td>
                <td>{role?.citationIds.length ?? 0}</td>
              </tr>
            );
          })}
          {requiredCapitalRoles.map((pathwayType) => {
            const pathway = pathways.find(
              (candidate) => candidate.pathwayType === pathwayType,
            );
            return (
              <tr key={pathwayType}>
                <td>{capitalRoleLabels[pathwayType]}</td>
                <td>
                  {pathway?.name ??
                    "Not established in the provided source materials."}
                </td>
                <td>
                  <StatusBadge status={pathway?.status ?? "unresolved"} />
                </td>
                <td>{pathway?.citationIds.length ?? 0}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function FundingPathwaySection({
  pathways,
  roles,
}: {
  pathways: FundingPathway[];
  roles: OrganizationRole[];
}) {
  const investmentManager = roles.find(
    (role) => role.roleType === "investment_manager",
  );
  const implementer = roles.find(
    (role) => role.roleType === "implementing_organization",
  );

  return (
    <div className="stack inset">
      {pathways.map((pathway) => (
        <div className="detail-row" key={pathway.id}>
          <div>
            <h4>{pathway.pathwayType.replaceAll("_", " ")}</h4>
            <p>
              {pathway.name ??
                pathway.note ??
                "Not established in the provided source materials."}
            </p>
          </div>
          <StatusBadge status={pathway.status} />
        </div>
      ))}
      <div className="detail-row">
        <div>
          <h4>funds managed by</h4>
          <p>
            {investmentManager?.organizationName ??
              "Not established in the provided source materials."}
          </p>
        </div>
        <StatusBadge status={investmentManager?.status ?? "unresolved"} />
      </div>
      <div className="detail-row">
        <div>
          <h4>work implemented by</h4>
          <p>
            {implementer?.organizationName ??
              "Not established in the provided source materials."}
          </p>
        </div>
        <StatusBadge status={implementer?.status ?? "unresolved"} />
      </div>
    </div>
  );
}

function Scorecard({ criteria }: { criteria: AssessmentCriterion[] }) {
  if (criteria.length === 0) {
    return <p className="muted">Assessment has not been calculated.</p>;
  }

  return (
    <div className="score-grid">
      {criteria.map((criterion) => (
        <div className="score-item" key={criterion.criterionKey}>
          <strong>{criterion.score}/5</strong>
          <span>{criterion.criterionKey.replaceAll("_", " ")}</span>
        </div>
      ))}
    </div>
  );
}

function EvidenceGaps({ record }: { record: OpportunityRecord }) {
  const gaps =
    record.assessment?.missingEvidence ?? record.opportunity.evidenceGaps;
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

function CitationsAndConflicts({ record }: { record: OpportunityRecord }) {
  const findings = record.validation?.findings ?? [];
  const conflicts = findings.filter(
    (finding) => finding.type === "conflicting_evidence",
  );
  const unsupported = findings.filter(
    (finding) => finding.type !== "conflicting_evidence",
  );

  return (
    <div className="stack inset">
      <p className="muted">
        Validation status: {record.validation?.status ?? "not checked"}.
      </p>
      <p className="muted">
        {record.opportunity.claims.length} claim(s),{" "}
        {record.opportunity.claims.reduce(
          (sum, claim) => sum + claim.citationIds.length,
          0,
        )}{" "}
        citation link(s).
      </p>
      {unsupported.length > 0 ? (
        <ul className="warning-list">
          {unsupported.map((finding) => (
            <li key={finding.id}>{finding.message}</li>
          ))}
        </ul>
      ) : null}
      {conflicts.length > 0 ? (
        <ul className="warning-list">
          {conflicts.map((finding) => (
            <li key={finding.id}>{finding.message}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default async function OpportunityReviewPage({
  params,
  searchParams,
}: ReviewPageProps) {
  const { projectId, opportunityId } = await params;
  const reviewed = firstValue((await searchParams).reviewed);
  const user = await requirePageUser(
    `/projects/${projectId}/opportunities/${opportunityId}`,
  );
  const storage = getStorage();
  const access = await getProjectAccess({ user, projectId, storage });
  const project = access.project;

  if (!project) {
    notFound();
  }

  const record = await storage.getOpportunityRecord(projectId, opportunityId);

  if (!record) {
    notFound();
  }

  const drafts = await storage.listDraftRecords(projectId, opportunityId);
  const readiness = record.assessment?.readinessLevel ?? "not assessed";

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Opportunity Review</p>
          <h1>{record.title}</h1>
          <p className="session-note">
            Signed in as {user.name} - {access.role ?? "admin"}
          </p>
        </div>
        <nav className="actions" aria-label="Opportunity navigation">
          <Link className="button" href="/">
            Back to dashboard
          </Link>
          <Link
            className="button"
            href={`/projects/${projectId}/opportunities`}
          >
            Opportunities
          </Link>
          <Link className="button" href={`/projects/${projectId}/documents`}>
            Documents
          </Link>
          <form action="/api/auth/logout" method="post">
            <button className="button" type="submit">
              Sign out
            </button>
          </form>
        </nav>
      </header>

      {reviewed ? <p className="alert success">Human review saved.</p> : null}

      <section className="review-grid">
        {access.canEdit ? (
          <EvidenceEditor record={record} />
        ) : (
          <section className="panel stack">
            <div>
              <p className="section-kicker">Review</p>
              <h2>Read-only access</h2>
            </div>
            <p className="muted">
              You can review the concept, evidence, and generated drafts for
              this project.
            </p>
          </section>
        )}

        <div className="stack">
          {access.canEdit ? <GenerateDraftPanel record={record} /> : null}

          <section className="panel stack">
            <div>
              <p className="section-kicker">Readiness</p>
              <h2>{readiness.toString().replaceAll("_", " ")}</h2>
            </div>
            <p className="muted">
              Investment case development:{" "}
              {record.assessment?.readyForInvestmentCaseDevelopment
                ? "Ready"
                : "Not ready"}
            </p>
            <p className="muted">
              Investor outreach:{" "}
              {record.assessment?.readyForInvestorOutreach
                ? "Ready"
                : "Not ready"}
            </p>
          </section>

          <section className="panel stack">
            <div>
              <p className="section-kicker">Scorecard</p>
              <h2>Investability assessment</h2>
            </div>
            <Scorecard criteria={record.assessment?.criteria ?? []} />
          </section>
        </div>
      </section>

      <section className="panel stack">
        <div>
          <p className="section-kicker">Drafts</p>
          <h2>Generated donor-facing outputs</h2>
        </div>
        <DraftList
          projectId={projectId}
          opportunityId={opportunityId}
          drafts={drafts}
        />
      </section>

      <section className="workspace-grid roomy">
        <section className="panel stack">
          <div>
            <p className="section-kicker">Roles</p>
            <h2>Organization-role table</h2>
          </div>
          <RoleTable
            roles={record.opportunity.organizationRoles}
            pathways={record.opportunity.fundingPathways}
          />
        </section>

        <section className="panel stack">
          <div>
            <p className="section-kicker">Capital Pathway</p>
            <h2>Funding pathway</h2>
          </div>
          <FundingPathwaySection
            pathways={record.opportunity.fundingPathways}
            roles={record.opportunity.organizationRoles}
          />
        </section>
      </section>

      <section className="workspace-grid roomy">
        <section className="panel stack">
          <div>
            <p className="section-kicker">Evidence</p>
            <h2>Evidence gaps</h2>
          </div>
          <EvidenceGaps record={record} />
        </section>

        <section className="panel stack">
          <div>
            <p className="section-kicker">Validation</p>
            <h2>Citations and conflicts</h2>
          </div>
          <CitationsAndConflicts record={record} />
        </section>
      </section>
    </main>
  );
}
