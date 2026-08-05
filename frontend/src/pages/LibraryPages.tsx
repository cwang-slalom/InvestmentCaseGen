import type { AppConfig, AudienceProfile, Opportunity } from "../types";

type LibraryProps = {
  opportunities: Opportunity[];
  audiences: AudienceProfile[];
  config?: AppConfig | null;
};

export function OpportunityLibraryPage({ opportunities }: LibraryProps) {
  return (
    <section className="panel full-panel">
      <p className="eyebrow">Read-only synthetic data</p>
      <h2>Opportunity library</h2>
      <div className="card-grid">
        {opportunities.map((opportunity) => (
          <article className="item-card" key={opportunity.id}>
            <span className="status-pill">{opportunity.validationStatus}</span>
            <h3>{opportunity.title}</h3>
            <p>{opportunity.summary}</p>
            <dl>
              <div><dt>Program area</dt><dd>{opportunity.programArea}</dd></div>
              <div><dt>Funding range</dt><dd>{opportunity.fundingRange}</dd></div>
              <div><dt>Geography</dt><dd>{opportunity.geography}</dd></div>
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}

export function DonorProfilesPage({ audiences }: LibraryProps) {
  return (
    <section className="panel full-panel">
      <p className="eyebrow">Read-only synthetic profiles</p>
      <h2>Donor profiles</h2>
      <div className="card-grid">
        {audiences.map((audience) => (
          <article className="item-card" key={audience.id}>
            <span className="status-pill">{audience.audienceType}</span>
            <h3>{audience.name}</h3>
            <p>{audience.narrativeApproach}</p>
            <dl>
              <div><dt>Stage</dt><dd>{audience.relationshipStage}</dd></div>
              <div><dt>Familiarity</dt><dd>{audience.familiarity}</dd></div>
              <div><dt>Interests</dt><dd>{audience.interests.join(", ")}</dd></div>
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}

export function KnowledgeBasePage({ config }: LibraryProps) {
  return (
    <section className="panel full-panel">
      <p className="eyebrow">Demo source list</p>
      <h2>Knowledge base</h2>
      <div className="table-list">
        {(config?.knowledgeSources || []).map((source) => (
          <div className="table-row static" key={source.id}>
            <span>{source.title}</span>
            <span>{source.sourceType}</span>
            <span>{source.status}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function PlaceholderPage({ title }: { title: string }) {
  return (
    <section className="panel full-panel">
      <p className="eyebrow">Phase 1 placeholder</p>
      <h2>{title}</h2>
      <p className="muted">This module is visible in the shell and reserved for a future production workflow.</p>
    </section>
  );
}
