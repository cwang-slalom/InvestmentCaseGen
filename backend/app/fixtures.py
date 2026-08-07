from __future__ import annotations

from .models.audience import AudienceProfile
from .models.base import CitationRef, FieldMetadata, FieldValue
from .models.extraction import ExtractedField, ExtractionResult
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
        id="src-vaccine-strategy",
        title="Vaccine Strategy 2026",
        sourceType="PDF",
        label="PST Strategy",
        locator="p. 2",
        excerpt="Synthetic strategy excerpt describing a next-generation vaccine development platform.",
        status="Approved",
    ),
    SourceDocument(
        id="src-rd-landscape",
        title="R&D Landscape Report",
        sourceType="PDF",
        label="May 2026",
        locator="sec. 4",
        excerpt="Synthetic landscape excerpt on vaccine R&D readiness and partner interest.",
        status="Approved",
    ),
    SourceDocument(
        id="src-concept-note",
        title="Concept Note",
        sourceType="DOCX",
        label="Apr 2026",
        locator="p. 1",
        excerpt="Synthetic concept note excerpt summarizing the investment rationale and delivery assumptions.",
        status="Approved",
    ),
    SourceDocument(
        id="src-amr-brief",
        title="AMR Innovation Landscape",
        sourceType="PDF",
        label="Example source set",
        locator="p. 3",
        excerpt="Synthetic landscape excerpt describing antimicrobial resistance innovation and collaboration needs.",
        status="Example source set",
    ),
    SourceDocument(
        id="src-nutrition-brief",
        title="Nutrition Scale Brief",
        sourceType="PDF",
        label="Example source set",
        locator="p. 5",
        excerpt="Synthetic brief excerpt on maternal and child nutrition delivery models.",
        status="Example source set",
    ),
    SourceDocument(
        id="src-education-brief",
        title="Education Equity Brief",
        sourceType="PDF",
        label="Example source set",
        locator="p. 4",
        excerpt="Synthetic brief excerpt on education equity system-change opportunities.",
        status="Example source set",
    ),
    SourceDocument(
        id="src-vaccine-budget",
        title="Vaccine Platform Budget",
        sourceType="XLSX",
        label="Example source set",
        locator="tab: Phase 1",
        excerpt="Synthetic budget excerpt with a USD 10-25 million funding range.",
        status="Example source set",
    ),
    SourceDocument(
        id="src-vaccine-risk",
        title="Manufacturing Risk Register",
        sourceType="PDF",
        label="Example source set",
        locator="risk 6",
        excerpt="Synthetic risk entry flagging manufacturing scale-up and partnership diligence questions.",
        status="Example source set",
    ),
]


OPPORTUNITIES: list[Opportunity] = [
    Opportunity(
        id="opp-vaccine-platform",
        title="Vaccine Development Platform",
        programArea="Global Health",
        geography="China / Global",
        summary="Strengthen vaccine R&D and accelerate next-generation vaccines to reach more people, faster.",
        validationStatus="Demo PST Validated",
        lastUpdated="2026-07-15",
        fundingRange="$10M - $25M",
        whyNow="Scientific advances and partner readiness create a window of opportunity.",
        reach="200M+ people",
        primaryOutcomes=[
            "Impact, learning, and systems strengthening",
            "Faster vaccine development pathways",
            "Evidence for future manufacturing partnerships",
        ],
        differentiators=[
            "Matches donor interests in health innovation and China",
            "PST validated and approved for external use",
            "Strong strategic fit for cultivation stage",
        ],
        sourceList=[SOURCES[0], SOURCES[1], SOURCES[2], SOURCES[6], SOURCES[7]],
    ),
    Opportunity(
        id="opp-amr-fund",
        title="AMR Innovation Fund",
        programArea="Global Health",
        geography="Global",
        summary="Combat antimicrobial resistance through innovation and collaboration.",
        validationStatus="Demo PST Validated",
        lastUpdated="2026-07-10",
        fundingRange="$8M - $18M",
        whyNow="New technical coalitions and product-development needs are converging.",
        reach="Global health systems and priority patient populations.",
        primaryOutcomes=[
            "Accelerate AMR product innovation",
            "Improve technical collaboration",
            "Build evidence for future investment decisions",
        ],
        differentiators=[
            "Clear global health relevance",
            "Strong fit for collaborative funding conversations",
        ],
        sourceList=[SOURCES[3]],
    ),
    Opportunity(
        id="opp-nutrition-accelerator",
        title="Nutrition Impact Accelerator",
        programArea="Health",
        geography="Africa / Asia",
        summary="Scale proven solutions to improve maternal and child nutrition.",
        validationStatus="Example source set",
        lastUpdated="2026-06-30",
        fundingRange="$12M - $20M",
        whyNow="Evidence from delivery partners is ready for cultivation conversations.",
        reach="Mothers, newborns, and children in priority geographies.",
        primaryOutcomes=[
            "Improve maternal nutrition",
            "Strengthen child health outcomes",
            "Support scale decisions",
        ],
        differentiators=[
            "Clear human impact narrative",
            "Strong delivery evidence boundary",
        ],
        sourceList=[SOURCES[4]],
    ),
    Opportunity(
        id="opp-education-equity",
        title="Education Equity Initiative",
        programArea="Education",
        geography="Asia / Global",
        summary="Drive systems change for quality education at scale.",
        validationStatus="Demo approved",
        lastUpdated="2026-06-20",
        fundingRange="$5M - $12M",
        whyNow="Policy momentum and system reform windows are aligned.",
        reach="Learners and school systems across priority regions.",
        primaryOutcomes=[
            "Improve equitable learning outcomes",
            "Strengthen education delivery systems",
            "Document evidence for later scale decisions",
        ],
        differentiators=[
            "Strong systems-change framing",
            "Suitable for education-focused donors",
        ],
        sourceList=[SOURCES[5]],
    ),
]


AUDIENCES: list[AudienceProfile] = [
    AudienceProfile(
        id="aud-hkjc",
        name="Hong Kong Jockey Club",
        audienceType="Corporate Foundation",
        relationshipStage="Cultivation stage",
        interests=["Health innovation", "China", "scalable impact", "scientific research"],
        geography="Hong Kong SAR / China -> Global",
        familiarity="Familiar with health innovation; new to this concept",
        donorPersona="Corporate Foundation / Health Innovator",
        technicalFamiliarity="Moderate",
        narrativeApproach="Innovation-focused, evidence-led",
        profileUrl="#mock-hkjc-profile",
    ),
    AudienceProfile(
        id="aud-wellcome",
        name="Wellcome Trust",
        audienceType="Philanthropic foundation",
        relationshipStage="New introduction",
        interests=["AMR", "scientific research", "global collaboration"],
        geography="Global",
        familiarity="Technically familiar",
        donorPersona="Research-oriented global health funder",
        technicalFamiliarity="High",
        narrativeApproach="Lead with scientific need, credibility, and collaborative leverage.",
        profileUrl="#mock-wellcome-profile",
    ),
    AudienceProfile(
        id="aud-unicef",
        name="UNICEF",
        audienceType="Multilateral organization",
        relationshipStage="Active technical exchange",
        interests=["nutrition", "country delivery", "systems strengthening"],
        geography="Africa / Asia",
        familiarity="Technically familiar",
        donorPersona="Implementation and policy partner",
        technicalFamiliarity="High",
        narrativeApproach="Use delivery evidence and identify implementation dependencies clearly.",
        profileUrl="#mock-unicef-profile",
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
            provenanceLabel="Suggested from audience profile",
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
            provenanceLabel="Suggested from library opportunity and audience profile",
            metadata=FieldMetadata(
                source="opportunity",
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
            provenanceLabel="Suggested from audience profile",
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
            provenanceLabel="Suggested from audience profile",
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
            provenanceLabel="Suggested from audience profile",
            metadata=FieldMetadata(
                source="audience_profile",
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
            value="Innovation-focused",
            provenanceLabel="Default setup value",
            metadata=FieldMetadata(
                source="system_setup",
                required=True,
                editable=True,
                confirmed=False,
                confidence=0.82,
            ),
        ),
        FieldValue(
            id="tone",
            label="Tone",
            value="Balanced and credible",
            provenanceLabel="Default setup value",
            metadata=FieldMetadata(source="system_setup", required=True, editable=True, confirmed=False),
        ),
        FieldValue(
            id="technical_depth",
            label="Technical depth",
            value="Moderate",
            provenanceLabel="Default setup value",
            metadata=FieldMetadata(source="system_setup", required=True, editable=True, confirmed=False),
        ),
        FieldValue(
            id="evidence_density",
            label="Evidence density",
            value="High",
            provenanceLabel="Default setup value",
            metadata=FieldMetadata(source="system_setup", required=True, editable=True, confirmed=False),
        ),
        FieldValue(
            id="ask_posture",
            label="Ask strength",
            value="Direct funding ask",
            provenanceLabel="Default setup value",
            metadata=FieldMetadata(source="system_setup", required=True, editable=True, confirmed=False),
        ),
        FieldValue(
            id="external_web_search",
            label="External web search",
            value="Disabled",
            provenanceLabel="Default setup value",
            metadata=FieldMetadata(source="system_setup", required=True, editable=True, confirmed=True),
        ),
        FieldValue(
            id="estimated_sources",
            label="Estimated sources",
            value="Attached internal/uploaded sources only",
            provenanceLabel="Computed from current source plan",
            metadata=FieldMetadata(source="system_setup", required=True, editable=False, confirmed=True),
        ),
    ]


def default_review_roles() -> list[ReviewRole]:
    return [
        ReviewRole(id="technical", label="PST review (Technical)", selected=True, status="Required", notes="Validate technical accuracy, strategy alignment, and opportunity framing."),
        ReviewRole(id="communications", label="Comms review", selected=True, status="Required", notes="Ensure narrative, tone, and messaging are externally appropriate."),
        ReviewRole(id="legal", label="Legal & policy review", selected=False, status="As needed", notes="Check for compliance, policy alignment, and risk considerations."),
        ReviewRole(id="partner", label="Partner review (if applicable)", selected=False, status="Optional", notes="Share with key partners or co-funders for input."),
    ]


def default_extraction(project_id: str | None, source_label: str) -> ExtractionResult:
    return ExtractionResult(
        id=f"extract-{project_id or 'demo'}",
        projectId=project_id,
        sourceLabel=source_label,
        temporaryStatus="Phase 1 temporary processing - content is not retained after restart",
        confidence=0.82,
        notes="Synthetic knowledge-base extraction from bundled demo fixtures. Upload a text-layer PDF, TXT, or Markdown file to parse real source text.",
        fields=[
            extracted_field("opportunity_name", "Opportunity name", "Global Vaccine Development Initiative", 0.91, source_label, "p. 1", "organization"),
            extracted_field("problem", "Problem", "Low vaccine coverage and slow development for emerging infectious diseases, especially in low- and middle-income countries.", 0.86, source_label, "p. 2", "problem"),
            extracted_field("solution", "Solution", "Accelerate R&D and equitable access to next-generation vaccines through innovation and strategic partnerships.", 0.84, source_label, "p. 3", "solution"),
            extracted_field("why_now", "Why now", "Rising disease outbreaks, mRNA platform readiness, and window to strengthen global preparedness.", 0.82, source_label, "p. 4", "timing"),
            extracted_field("geographies", "Geographies", "Global focus, with priority on Africa and Asia.", 0.88, source_label, "map note", "geography"),
            extracted_field("reach", "Reach / Impact", "Potential to reach 500M+ people over 5 years and prevent millions of infections and deaths.", 0.79, source_label, "p. 5", "number"),
            extracted_field("primary_outcomes", "Primary outcomes", "Increased vaccine coverage, reduced disease burden, improved pandemic preparedness.", 0.83, source_label, "p. 5", "outcomes"),
            extracted_field("differentiators", "Key differentiators", "mRNA platform leadership, local manufacturing partnerships, and last-mile delivery expertise.", 0.85, source_label, "p. 6", "differentiators"),
            extracted_field("timeframe", "Timeframe", "2026-2030 (5-year initiative)", 0.8, source_label, "p. 7", "date"),
            extracted_field("funding_range", "Funding range", "USD 10-25 million for Phase 1.", 0.81, source_label, "budget note", "currency"),
            extracted_field("investment_team", "Investment team", "Unresolved investment manager; sponsoring team is Global Health PST.", 0.7, source_label, "p. 8", "team"),
            extracted_field("technical_team", "Technical team", "Vaccine R&D and Manufacturing Working Group.", 0.74, source_label, "p. 8", "team"),
            extracted_field("diligence", "Diligence information", "Open diligence items include funding recipient, investment vehicle, partner commitments, and regulatory pathway.", 0.86, source_label, "risk register", "diligence"),
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
    second_opp = OPPORTUNITIES[1]
    second_audience = AUDIENCES[1]
    third_opp = OPPORTUNITIES[2]
    third_audience = AUDIENCES[2]
    return [
        Project(
            id="demo-project-1",
            name="HKJC - Vaccine Development",
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
                selectedOutputs=["investment_case", "one_page", "talking_points", "source_appendix"],
            ),
        ),
        Project(
            id="demo-project-2",
            name="Wellcome Trust - AMR",
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
        Project(
            id="demo-project-3",
            name="UNICEF - Nutrition",
            createdAt="2026-06-30T10:00:00Z",
            updatedAt="2026-06-30T10:00:00Z",
            demoNotice=DEMO_NOTICE,
            task=TaskState(
                selectedTaskId="opportunity_brief",
                taskLabel="Draft an opportunity brief",
                customDescription="",
                metadata={"source": "user", "required": True, "editable": True, "confirmed": True},
            ),
            opportunityAudience=OpportunityAudienceState(
                sourceMode="existing",
                opportunityId=third_opp.id,
                audienceId=third_audience.id,
                intendedOutcome="Agree to another conversation",
                suggestions=default_suggestions(third_opp, third_audience),
                selectedOutputs=["one_page", "source_appendix"],
            ),
        ),
    ]


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
