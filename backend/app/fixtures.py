from __future__ import annotations

from .models.audience import AudienceProfile
from .models.base import CitationRef, FieldMetadata, FieldValue
from .models.extraction import ExtractedField, ExtractionResult
from .models.generation import (
    GeneratedOutput,
    GeneratedSection,
    GenerationResult,
    InformationNeeded,
    ReviewFinding,
)
from .models.opportunity import Opportunity
from .models.project import (
    OpportunityAudienceState,
    Project,
    ReviewRole,
    ReviewSetupState,
    SourceReadiness,
    TaskState,
)
from .models.source import SourceDocument

DEMO_NOTICE = "Phase 1 demo data - not persistent"


SOURCES: list[SourceDocument] = [
    SourceDocument(
        id="src-water-brief",
        title="Drylands Water Access Concept Note",
        sourceType="brief",
        label="Example source set",
        locator="p. 2",
        excerpt="Synthetic source excerpt describing seasonal water access constraints and local maintenance capacity.",
        status="Example source set",
    ),
    SourceDocument(
        id="src-water-budget",
        title="Illustrative Water Platform Budget",
        sourceType="spreadsheet",
        label="Example source set",
        locator="tab: Phase 1",
        excerpt="Synthetic budget range of USD 8-12 million over 36 months for shared infrastructure and training.",
        status="Example source set",
    ),
    SourceDocument(
        id="src-health-memo",
        title="Community Health Navigation Memo",
        sourceType="memo",
        label="Example source set",
        locator="sec. 3",
        excerpt="Synthetic memo noting a 28% referral completion gap and partner readiness in two districts.",
        status="Example source set",
    ),
    SourceDocument(
        id="src-health-evidence",
        title="Illustrative Navigation Evidence Table",
        sourceType="table",
        label="Example source set",
        locator="rows 4-7",
        excerpt="Synthetic evidence table summarizing care-navigation outcomes from prior demonstrations.",
        status="Example source set",
    ),
    SourceDocument(
        id="src-seed-diligence",
        title="Resilient Seed Systems Diligence Snapshot",
        sourceType="diligence",
        label="Example source set",
        locator="p. 5",
        excerpt="Synthetic diligence note identifying unresolved certification and procurement questions.",
        status="Example source set",
    ),
    SourceDocument(
        id="src-seed-landscape",
        title="Regional Seed Availability Landscape",
        sourceType="landscape",
        label="Example source set",
        locator="map note",
        excerpt="Synthetic landscape note describing availability constraints across three example provinces.",
        status="Example source set",
    ),
    SourceDocument(
        id="src-learning-roadmap",
        title="Adaptive Learning Lab Roadmap",
        sourceType="roadmap",
        label="Example source set",
        locator="milestone 2",
        excerpt="Synthetic roadmap describing a 2027 learning cycle with district implementation partners.",
        status="Example source set",
    ),
    SourceDocument(
        id="src-learning-risk",
        title="Learning Lab Risk Register",
        sourceType="risk register",
        label="Example source set",
        locator="risk 6",
        excerpt="Synthetic risk entry flagging data-sharing agreements as an unresolved dependency.",
        status="Example source set",
    ),
]


OPPORTUNITIES: list[Opportunity] = [
    Opportunity(
        id="opp-water-access",
        title="Community Water Reliability Platform",
        programArea="Climate-resilient services",
        geography="Fictional Drylands Region",
        summary="A shared maintenance and financing platform for community water points in drought-prone districts.",
        validationStatus="Demo approved",
        lastUpdated="2026-07-18",
        fundingRange="USD 8-12 million over 36 months",
        whyNow="District plans and maintenance cooperatives are aligned for a 2027 launch window.",
        reach="Illustrative reach of 420,000 people across six fictional districts.",
        primaryOutcomes=[
            "Reduce downtime for priority water points",
            "Improve transparent maintenance financing",
            "Strengthen local repair-market capacity",
        ],
        differentiators=[
            "Blends service reliability, local enterprise support, and accountable financing",
            "Uses existing district maintenance plans instead of creating a parallel delivery structure",
        ],
        sourceList=[SOURCES[0], SOURCES[1]],
    ),
    Opportunity(
        id="opp-health-navigation",
        title="Integrated Community Health Navigation",
        programArea="Primary health systems",
        geography="Fictional Lake Basin",
        summary="A referral-navigation model that helps households complete priority maternal and child health visits.",
        validationStatus="Demo review complete",
        lastUpdated="2026-07-22",
        fundingRange="USD 5-7 million over 24 months",
        whyNow="New district referral protocols create a practical window to test navigation supports.",
        reach="Synthetic estimate of 180,000 caregivers and children in four districts.",
        primaryOutcomes=[
            "Increase completed referrals for priority services",
            "Improve household follow-up after facility visits",
            "Generate implementation evidence for district scale decisions",
        ],
        differentiators=[
            "Centers continuity of care rather than one-time demand generation",
            "Pairs community navigation with facility feedback loops",
        ],
        sourceList=[SOURCES[2], SOURCES[3]],
    ),
    Opportunity(
        id="opp-seed-systems",
        title="Resilient Seed Access Accelerator",
        programArea="Agricultural resilience",
        geography="Fictional Highland Provinces",
        summary="A market-shaping package to improve access to stress-tolerant seed through local suppliers.",
        validationStatus="Example source set",
        lastUpdated="2026-07-29",
        fundingRange="USD 10-15 million over 30 months",
        whyNow="Supplier interest and provincial procurement calendars are converging before the next planting cycle.",
        reach="Illustrative reach of 95,000 smallholder households.",
        primaryOutcomes=[
            "Increase timely availability of stress-tolerant seed",
            "Improve supplier working-capital readiness",
            "Clarify certification and quality-assurance bottlenecks",
        ],
        differentiators=[
            "Targets market reliability instead of one-off seed distribution",
            "Builds a diligence pathway before recommending a funding vehicle",
        ],
        sourceList=[SOURCES[4], SOURCES[5]],
    ),
    Opportunity(
        id="opp-learning-lab",
        title="Adaptive District Learning Lab",
        programArea="Education systems",
        geography="Fictional Coastal Corridor",
        summary="A district learning lab to test adaptive coaching, formative assessment, and implementation routines.",
        validationStatus="Demo approved",
        lastUpdated="2026-08-01",
        fundingRange="USD 3-5 million over 18 months",
        whyNow="District implementation teams have committed to a 2027 learning cycle.",
        reach="Synthetic cohort of 620 schools and 310,000 learners.",
        primaryOutcomes=[
            "Improve use of formative assessment data",
            "Strengthen coaching routines for school leaders",
            "Document evidence for later scale decisions",
        ],
        differentiators=[
            "Treats learning systems as the investable asset",
            "Keeps scale decisions contingent on observed implementation quality",
        ],
        sourceList=[SOURCES[6], SOURCES[7]],
    ),
]


AUDIENCES: list[AudienceProfile] = [
    AudienceProfile(
        id="aud-riverbend",
        name="Riverbend Catalytic Fund",
        audienceType="Philanthropic foundation",
        relationshipStage="Warm exploratory relationship",
        interests=["Systems change", "co-funding leverage", "implementation evidence"],
        geography="East and Southern Africa examples",
        familiarity="Familiar with issue, new to this concept",
        donorPersona="Evidence-oriented catalytic funder",
        technicalFamiliarity="Moderate",
        narrativeApproach="Lead with proof points, credible constraints, and a clear learning agenda.",
        profileUrl="#mock-riverbend-profile",
    ),
    AudienceProfile(
        id="aud-northstar",
        name="Northstar Impact Partners",
        audienceType="Impact-first family office",
        relationshipStage="New introduction",
        interests=["measurable outcomes", "operational leverage", "risk visibility"],
        geography="Global health and resilience examples",
        familiarity="New to topic",
        donorPersona="Decision maker seeking concise risk-adjusted cases",
        technicalFamiliarity="Low to moderate",
        narrativeApproach="Frame the concept through decision relevance and near-term diligence questions.",
        profileUrl="#mock-northstar-profile",
    ),
    AudienceProfile(
        id="aud-civic-bridge",
        name="Civic Bridge Initiative",
        audienceType="Public-private funding collaborative",
        relationshipStage="Active technical exchange",
        interests=["government alignment", "scalable delivery models", "policy learning"],
        geography="Subnational government examples",
        familiarity="Technically familiar",
        donorPersona="Collaborative partner balancing program and policy outcomes",
        technicalFamiliarity="High",
        narrativeApproach="Use a detailed evidence thread and make unresolved implementation dependencies visible.",
        profileUrl="#mock-civic-bridge-profile",
    ),
]


def default_suggestions(opportunity: Opportunity, audience: AudienceProfile) -> list[FieldValue]:
    citations = [
        CitationRef(
            sourceId=opportunity.source_list[0].id,
            label=opportunity.source_list[0].title,
            locator=opportunity.source_list[0].locator,
            excerpt=opportunity.source_list[0].excerpt,
        )
    ]
    return [
        FieldValue(
            id="relationship_stage",
            label="Relationship stage",
            value=audience.relationship_stage,
            provenanceLabel="Suggested from demo profile",
            metadata=FieldMetadata(
                source="audience_profile",
                required=True,
                editable=True,
                confirmed=False,
                confidence=0.86,
            ),
        ),
        FieldValue(
            id="geography_lens",
            label="Geography lens",
            value=f"{opportunity.geography}; audience lens: {audience.geography}",
            provenanceLabel="Suggested from demo opportunity and profile",
            metadata=FieldMetadata(
                source="ai_suggestion",
                required=True,
                editable=True,
                confirmed=False,
                confidence=0.8,
                citations=citations,
            ),
        ),
        FieldValue(
            id="donor_persona",
            label="Donor persona",
            value=audience.donor_persona,
            provenanceLabel="Suggested from demo profile",
            metadata=FieldMetadata(
                source="audience_profile",
                required=True,
                editable=True,
                confirmed=False,
                confidence=0.88,
            ),
        ),
        FieldValue(
            id="technical_familiarity",
            label="Technical familiarity",
            value=audience.technical_familiarity,
            provenanceLabel="Suggested from demo profile",
            metadata=FieldMetadata(
                source="audience_profile",
                required=True,
                editable=True,
                confirmed=False,
                confidence=0.83,
            ),
        ),
        FieldValue(
            id="narrative_approach",
            label="Narrative approach",
            value=audience.narrative_approach,
            provenanceLabel="Suggested from AI using demo data",
            metadata=FieldMetadata(
                source="ai_suggestion",
                required=True,
                editable=True,
                confirmed=False,
                confidence=0.78,
                citations=citations,
            ),
        ),
    ]


def default_review_fields() -> list[FieldValue]:
    return [
        FieldValue(
            id="narrative_style",
            label="Narrative style",
            value="Evidence-led and opportunity-focused",
            provenanceLabel="Suggested by Phase 1 setup",
            metadata=FieldMetadata(
                source="ai_suggestion",
                required=True,
                editable=True,
                confirmed=False,
                confidence=0.82,
            ),
        ),
        FieldValue(
            id="tone",
            label="Tone",
            value="Balanced, credible and invitational",
            provenanceLabel="Suggested by Phase 1 setup",
            metadata=FieldMetadata(source="ai_suggestion", required=True, editable=True, confirmed=False),
        ),
        FieldValue(
            id="technical_depth",
            label="Technical depth",
            value="Moderate",
            provenanceLabel="Suggested by Phase 1 setup",
            metadata=FieldMetadata(source="ai_suggestion", required=True, editable=True, confirmed=False),
        ),
        FieldValue(
            id="evidence_density",
            label="Evidence density",
            value="High",
            provenanceLabel="Suggested by Phase 1 setup",
            metadata=FieldMetadata(source="ai_suggestion", required=True, editable=True, confirmed=False),
        ),
        FieldValue(
            id="ask_posture",
            label="Ask posture",
            value="No direct solicitation; conversation-opening briefing",
            provenanceLabel="Suggested by Phase 1 setup",
            metadata=FieldMetadata(source="ai_suggestion", required=True, editable=True, confirmed=False),
        ),
        FieldValue(
            id="external_web_search",
            label="External web search",
            value="Disabled in Phase 1",
            provenanceLabel="System constraint",
            metadata=FieldMetadata(source="ai_suggestion", required=True, editable=False, confirmed=True),
        ),
        FieldValue(
            id="estimated_sources",
            label="Estimated source count",
            value="Based only on the supplied mock or uploaded sources",
            provenanceLabel="Computed from current source plan",
            metadata=FieldMetadata(source="ai_suggestion", required=True, editable=False, confirmed=True),
        ),
    ]


def default_review_roles() -> list[ReviewRole]:
    return [
        ReviewRole(id="technical", label="Technical or program review", selected=True, status="Planned", notes="Generic role; no notifications sent."),
        ReviewRole(id="communications", label="Communications review", selected=True, status="Planned", notes="Generic role; no notifications sent."),
        ReviewRole(id="legal", label="Legal and policy review", selected=False, status="Optional", notes="Use when external language or policy claims need review."),
        ReviewRole(id="partner", label="Partner review", selected=False, status="Optional", notes="Use when an implementing partner should review facts."),
    ]


def default_extraction(project_id: str | None, source_label: str) -> ExtractionResult:
    return ExtractionResult(
        id=f"extract-{project_id or 'demo'}",
        projectId=project_id,
        sourceLabel=source_label,
        temporaryStatus="Phase 1 temporary processing - content is not retained after restart",
        confidence=0.82,
        notes="Mock extraction from bundled synthetic source fixtures; uploaded real documents are not used as factual evidence in Phase 1.",
        fields=[
            extracted_field("opportunity_name", "Opportunity name", "District Cold Chain Reliability Fund", 0.91, source_label, "p. 1", "organization"),
            extracted_field("problem", "Problem or strategic constraint", "Fictional districts report 31% spoilage risk during peak outreach months.", 0.77, source_label, "p. 2", "percentage"),
            extracted_field("solution", "Solution or intervention", "A pooled maintenance and monitoring vehicle for solar cold-chain equipment.", 0.84, source_label, "p. 3", "organization"),
            extracted_field("why_now", "Why now", "A 2027 procurement window opens on March 15, 2027.", 0.79, source_label, "p. 4", "date"),
            extracted_field("geographies", "Geographies", "Fictional North Valley and East Ridge districts.", 0.88, source_label, "map note", "geography"),
            extracted_field("reach", "Reach or impact", "Illustrative reach of 240 clinics and 1.2 million residents.", 0.72, source_label, "p. 5", "number"),
            extracted_field("primary_outcomes", "Primary outcomes", "Lower spoilage risk, faster repair response, and clearer district maintenance accountability.", 0.8, source_label, "p. 5", "organization"),
            extracted_field("differentiators", "Key differentiators", "Combines maintenance finance, remote monitoring, and district repair protocols.", 0.83, source_label, "p. 6", "organization"),
            extracted_field("timeframe", "Timeframe", "24-month Phase 1 beginning Q2 2027.", 0.76, source_label, "p. 7", "date"),
            extracted_field("funding_range", "Funding range", "USD 6-9 million for Phase 1.", 0.81, source_label, "budget note", "currency"),
            extracted_field("investment_team", "Investment team", "Unresolved investment manager; fictional sponsoring team is the Health Systems Design Unit.", 0.7, source_label, "p. 8", "team"),
            extracted_field("technical_team", "Technical team", "Fictional Cold Chain Technical Working Group.", 0.74, source_label, "p. 8", "team"),
            extracted_field("diligence", "Diligence information", "Open diligence items include service-level agreements, repair-market capacity, and data-sharing permissions.", 0.86, source_label, "risk register", "diligence"),
        ],
    )


def extracted_field(
    field_id: str,
    label: str,
    value: str,
    confidence: float,
    source_label: str,
    locator: str,
    example_type: str,
) -> ExtractedField:
    source_id = f"src-upload-{field_id}"
    return ExtractedField(
        id=field_id,
        label=label,
        value=value,
        confidence=confidence,
        sourceLabel=source_label,
        locator=locator,
        metadata=FieldMetadata(
            source="extracted_source",
            required=True,
            editable=True,
            confirmed=False,
            confidence=confidence,
            citations=[
                CitationRef(
                    sourceId=source_id,
                    label=source_label,
                    locator=locator,
                    excerpt=f"Synthetic {example_type} excerpt for {label.lower()}.",
                )
            ],
        ),
    )


def recent_projects(now_iso: str) -> list[Project]:
    first_opp = OPPORTUNITIES[0]
    first_audience = AUDIENCES[0]
    second_opp = OPPORTUNITIES[2]
    second_audience = AUDIENCES[2]
    return [
        Project(
            id="demo-project-1",
            name="Water reliability donor briefing",
            createdAt="2026-07-31T09:00:00Z",
            updatedAt=now_iso,
            demoNotice=DEMO_NOTICE,
            task=TaskState(
                selectedTaskId="donor_meeting",
                taskLabel="Prepare for a donor meeting",
                customDescription="",
                metadata={"source": "user", "required": True, "editable": True, "confirmed": True},
            ),
            opportunityAudience=OpportunityAudienceState(
                sourceMode="existing",
                opportunityId=first_opp.id,
                audienceId=first_audience.id,
                intendedOutcome="Explore a co-funding partnership",
                suggestions=default_suggestions(first_opp, first_audience),
                selectedOutputs=["investment_case", "one_page", "source_appendix"],
            ),
        ),
        Project(
            id="demo-project-2",
            name="Seed access technical follow-up",
            createdAt="2026-07-29T16:00:00Z",
            updatedAt="2026-08-01T12:00:00Z",
            demoNotice=DEMO_NOTICE,
            task=TaskState(
                selectedTaskId="opportunity_brief",
                taskLabel="Draft an opportunity brief",
                customDescription="",
                metadata={"source": "user", "required": True, "editable": True, "confirmed": True},
            ),
            opportunityAudience=OpportunityAudienceState(
                sourceMode="existing",
                opportunityId=second_opp.id,
                audienceId=second_audience.id,
                intendedOutcome="Review the opportunity in more detail",
                suggestions=default_suggestions(second_opp, second_audience),
                selectedOutputs=["investment_case", "talking_points", "source_appendix"],
            ),
        ),
    ]


def generated_example(project_id: str = "demo-project-1") -> GenerationResult:
    opp = OPPORTUNITIES[0]
    aud = AUDIENCES[0]
    citation = CitationRef(
        sourceId=opp.source_list[0].id,
        label=opp.source_list[0].title,
        locator=opp.source_list[0].locator,
        excerpt=opp.source_list[0].excerpt,
    )
    outputs = [
        GeneratedOutput(
            id="out-investment-case",
            type="investment_case",
            title="Investment Case Draft",
            status="Mock generated - human review required",
            sections=[
                GeneratedSection(id="case-exec", type="narrative", heading="Strategic Opportunity", body=f"{opp.title} is framed as a conversation-opening investment case for {aud.name}. The draft preserves the synthetic funding range of {opp.funding_range} and keeps the funding recipient unresolved until source evidence identifies a vehicle.", citations=[citation]),
                GeneratedSection(id="case-metric", type="metric", heading="Metric Callouts", body=f"Illustrative reach: {opp.reach}. Primary outcomes include {', '.join(opp.primary_outcomes[:2])}. These figures remain demo-only and require human verification.", citations=[citation]),
                GeneratedSection(id="case-team", type="team", heading="Team And Delivery Pathway", body="Concept owner, implementation organization, investment manager, and funding recipient are separated. The current mock source identifies a sponsoring design team only; the funding recipient is unresolved.", citations=[citation]),
                GeneratedSection(id="case-diligence", type="diligence", heading="Diligence Priorities", body="Confirm the capital pathway, test maintenance-finance assumptions, and review district procurement dependencies before external use.", citations=[citation]),
                GeneratedSection(id="case-risk", type="risk", heading="Risks And Open Questions", body="The largest Phase 1 risks are durable maintenance financing, supplier response time, and whether the example districts can sustain accountable reporting.", citations=[citation]),
                GeneratedSection(id="case-engage", type="engage", heading="Suggested Next Conversation", body="Invite a focused discussion on whether a co-funding partnership should move into a diligence sprint, without presenting this as a direct funding ask.", citations=[citation]),
            ],
        ),
        GeneratedOutput(
            id="out-one-page",
            type="one_page",
            title="1-Page Opportunity Summary",
            status="Mock generated - human review required",
            sections=[
                GeneratedSection(id="one-page-summary", type="opportunity", heading="Opportunity Summary", body=f"{opp.summary} Why now: {opp.why_now}", citations=[citation]),
                GeneratedSection(id="one-page-fit", type="narrative", heading="Audience Fit", body=f"{aud.name} may find the concept relevant because it connects {aud.interests[0]} with practical implementation evidence.", citations=[citation]),
            ],
        ),
        GeneratedOutput(
            id="out-talking-points",
            type="talking_points",
            title="Meeting Talking Points",
            status="Mock generated - human review required",
            sections=[
                GeneratedSection(id="talk-open", type="engage", heading="Opening", body="Start with the reliability constraint, then ask what evidence would be most useful before deeper diligence.", citations=[citation]),
                GeneratedSection(id="talk-questions", type="diligence", heading="Questions To Invite", body="Which co-funding conditions matter most? What proof would make a follow-up conversation worthwhile?", citations=[]),
            ],
        ),
        GeneratedOutput(
            id="out-appendix",
            type="source_appendix",
            title="Source Appendix",
            status="Mock generated - human review required",
            sections=[
                GeneratedSection(id="appendix-sources", type="diligence", heading="Source List", body="This appendix lists only synthetic Phase 1 sources used by the mock generator.", citations=[citation]),
                GeneratedSection(id="appendix-boundary", type="risk", heading="Evidence Boundary", body="No external web research was performed. Uploaded real documents are not treated as durable stored sources in Phase 1.", citations=[]),
            ],
        ),
    ]
    return GenerationResult(
        generationId=f"gen-{project_id}",
        projectId=project_id,
        status="needs_information",
        outputs=outputs,
        informationNeeded=[
            InformationNeeded(id="info-funding-pathway", message="Funding recipient or investment vehicle is unresolved in the current source set.", relatedSection="case-team"),
            InformationNeeded(id="info-cost-basis", message="Cost basis and per-beneficiary assumptions require human review before external circulation.", relatedSection="case-metric"),
        ],
        reviewFindings=[
            ReviewFinding(id="finding-1", severity="warning", type="unresolved_role", message="Funding recipient is not established by the supplied sources.", resolved=False),
            ReviewFinding(id="finding-2", severity="editorial", type="tone", message="Confirm the briefing language is appropriate for the selected audience.", resolved=False),
            ReviewFinding(id="finding-3", severity="blocking", type="source_readiness", message="Human review is required before using this output externally.", resolved=False),
        ],
        metadata={
            "mode": "mock",
            "storedPayloadMode": "validated_outputs_only",
            "externalWebSearch": "disabled",
        },
    )


def source_readiness(
    source_count: int,
    extraction_confirmed: bool,
    output_count: int,
) -> SourceReadiness:
    checks = [
        f"{source_count} source(s) available",
        "Required extracted fields reviewed" if extraction_confirmed else "Existing demo opportunity selected or extraction pending",
        f"{output_count} functional output(s) selected",
        "External web search disabled in Phase 1",
    ]
    issues: list[str] = []
    if source_count < 1:
        issues.append("At least one source is required.")
    if output_count < 1:
        issues.append("At least one output must be selected.")
    return SourceReadiness(ready=not issues, checks=checks, blockingIssues=issues)


def default_review_setup(source_count: int, extraction_confirmed: bool, output_count: int) -> ReviewSetupState:
    return ReviewSetupState(
        approachFields=default_review_fields(),
        roles=default_review_roles(),
        confirmed=False,
        sourceReadiness=source_readiness(source_count, extraction_confirmed, output_count),
    )
