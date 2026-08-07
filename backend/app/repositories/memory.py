from __future__ import annotations

from datetime import UTC, datetime

from fastapi import HTTPException

from ..fixtures import (
    AUDIENCES,
    DEMO_NOTICE,
    OPPORTUNITIES,
    SOURCES,
    default_review_setup,
    default_suggestions,
    recent_projects,
    source_readiness,
)
from ..models.base import CitationRef
from ..models.audience import AudienceProfile
from ..models.extraction import ExtractionResult
from ..models.generation import GeneratedOutput, GeneratedSection, GenerationResult, InformationNeeded, ReviewFinding
from ..models.memory import (
    AffectedOutput,
    ArtifactVersion,
    ProjectMemoryItem,
    ProjectMemorySummary,
    ProjectUpdate,
    ProjectUpdateReview,
    UpdateCandidate,
)
from ..models.opportunity import Opportunity
from ..models.project import (
    OpportunityAudienceState,
    OpportunityAudienceUpdate,
    Project,
    ProjectCreate,
    ReviewSetupState,
    ReviewSetupUpdate,
    TaskState,
    TaskUpdate,
)
from ..models.source import SourceDocument
from .base import AudienceRepository, CaseRepository, GenerationStore, OpportunityRepository


def utc_now() -> str:
    return datetime.now(tz=UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


class InMemoryOpportunityRepository(OpportunityRepository):
    def __init__(self, opportunities: list[Opportunity] | None = None):
        self.opportunities = {item.id: item for item in opportunities or OPPORTUNITIES}

    def list_opportunities(self) -> list[Opportunity]:
        return list(self.opportunities.values())

    def get_opportunity(self, opportunity_id: str) -> Opportunity:
        try:
            return self.opportunities[opportunity_id]
        except KeyError as error:
            raise HTTPException(status_code=404, detail="Opportunity not found.") from error


class InMemoryAudienceRepository(AudienceRepository):
    def __init__(self, audiences: list[AudienceProfile] | None = None):
        self.audiences = {item.id: item for item in audiences or AUDIENCES}

    def list_audiences(self) -> list[AudienceProfile]:
        return list(self.audiences.values())

    def get_audience(self, audience_id: str) -> AudienceProfile:
        try:
            return self.audiences[audience_id]
        except KeyError as error:
            raise HTTPException(status_code=404, detail="Audience not found.") from error


class InMemoryGenerationStore(GenerationStore):
    def __init__(self):
        self.generations: dict[str, GenerationResult] = {}

    def get_generation(self, generation_id: str) -> GenerationResult:
        try:
            return self.generations[generation_id]
        except KeyError as error:
            raise HTTPException(status_code=404, detail="Generation not found.") from error

    def save_generation(self, generation: GenerationResult) -> GenerationResult:
        self.generations[generation.generation_id] = generation
        return generation


class InMemoryCaseRepository(CaseRepository):
    def __init__(
        self,
        opportunity_repo: InMemoryOpportunityRepository,
        audience_repo: InMemoryAudienceRepository,
        generation_store: InMemoryGenerationStore,
    ):
        now = utc_now()
        self.opportunity_repo = opportunity_repo
        self.audience_repo = audience_repo
        self.generation_store = generation_store
        self.projects: dict[str, Project] = {project.id: project for project in recent_projects(now)}
        self.extractions: dict[str, ExtractionResult] = {}
        self.project_updates: dict[str, list[ProjectUpdate]] = {}
        self.project_memory_items: dict[str, list[ProjectMemoryItem]] = {}
        self.artifact_versions: dict[str, list[ArtifactVersion]] = {}
        self.next_number = 4
        self._seed_demo_project_overview()

    def _seed_demo_project_overview(self) -> None:
        project = self.projects.get("demo-project-1")
        if not project:
            return

        project.created_at = "2025-07-30T09:00:00Z"
        project.updated_at = "2026-08-04T09:00:00Z"
        project.generation_id = "gen-demo-project-1-v3"
        self.projects[project.id] = project

        strategy_citation = CitationRef(
            sourceId="src-vaccine-strategy",
            label="Vaccine Strategy 2026",
            locator="p. 2",
            excerpt="Synthetic strategy excerpt describing a next-generation vaccine development platform.",
        )
        generation = GenerationResult(
            generationId=project.generation_id,
            projectId=project.id,
            status="completed",
            outputs=[
                GeneratedOutput(
                    id="out-demo-investment-memo",
                    type="investment_case",
                    title="Investment Memo",
                    status="draft",
                    sections=[
                        GeneratedSection(
                            id="memo-thesis",
                            type="narrative",
                            heading="Investment rationale",
                            body="A therapeutic vaccine development platform can help accelerate R&D readiness for priority health threats in Asia while preserving unresolved implementation and capital-pathway questions for diligence.",
                            citations=[strategy_citation],
                        ),
                        GeneratedSection(
                            id="memo-diligence",
                            type="diligence",
                            heading="Diligence questions",
                            body="Funding recipient, investment vehicle, investment manager, and delivery partner roles remain unresolved unless confirmed by source material.",
                            citations=[strategy_citation],
                        ),
                    ],
                ),
                GeneratedOutput(
                    id="out-demo-executive-summary",
                    type="one_page",
                    title="Executive Summary",
                    status="draft",
                    sections=[
                        GeneratedSection(
                            id="summary-overview",
                            type="narrative",
                            heading="Executive summary",
                            body="The case frames HKJC as a potential donor audience for an Asia-focused therapeutic vaccine development concept, not as the funding recipient.",
                            citations=[strategy_citation],
                        ),
                        GeneratedSection(
                            id="summary-why-now",
                            type="opportunity",
                            heading="Why now",
                            body="Scientific readiness and partner interest create a near-term window for a source-grounded donor conversation.",
                            citations=[strategy_citation],
                        ),
                    ],
                ),
                GeneratedOutput(
                    id="out-demo-donor-brief",
                    type="talking_points",
                    title="Donor Brief",
                    status="draft",
                    sections=[
                        GeneratedSection(
                            id="brief-conversation",
                            type="engage",
                            heading="Donor conversation",
                            body="Use the donor brief to test appetite for co-funding, clarify unanswered questions, and avoid implying a confirmed funding recipient.",
                            citations=[strategy_citation],
                        )
                    ],
                ),
                GeneratedOutput(
                    id="out-demo-source-appendix",
                    type="source_appendix",
                    title="Source Appendix",
                    status="draft",
                    sections=[
                        GeneratedSection(
                            id="appendix-sources",
                            type="diligence",
                            heading="Source appendix",
                            body="Initial cited materials include the vaccine strategy, R&D landscape report, concept note, budget excerpt, and risk register.",
                            citations=[strategy_citation],
                        )
                    ],
                ),
            ],
            informationNeeded=[
                InformationNeeded(
                    id="need-demo-capital-pathway",
                    message="Confirm the funding recipient, investment vehicle, and investment manager before external circulation.",
                    relatedSection="Diligence questions",
                )
            ],
            reviewFindings=[
                ReviewFinding(
                    id="finding-demo-unresolved-recipient",
                    severity="warning",
                    type="unresolved_role",
                    message="Funding recipient and investment vehicle are unresolved in the current source set.",
                    resolved=False,
                )
            ],
            metadata={"mode": "demo", "createdFor": "Project Overview seed"},
        )
        self.generation_store.save_generation(generation)

        self.artifact_versions[project.id] = [
            ArtifactVersion(
                id="artifact-demo-project-1-investment_case-v1",
                projectId=project.id,
                outputId="out-demo-investment-memo",
                outputType="investment_case",
                title="Investment Memo",
                version=1,
                status="superseded",
                generationId=project.generation_id,
                createdFromUpdateId=None,
                createdAt="2026-07-30T10:00:00Z",
            ),
            ArtifactVersion(
                id="artifact-demo-project-1-investment_case-v2",
                projectId=project.id,
                outputId="out-demo-investment-memo",
                outputType="investment_case",
                title="Investment Memo",
                version=2,
                status="superseded",
                generationId=project.generation_id,
                createdFromUpdateId=None,
                createdAt="2026-08-01T10:00:00Z",
            ),
            ArtifactVersion(
                id="artifact-demo-project-1-investment_case-v3",
                projectId=project.id,
                outputId="out-demo-investment-memo",
                outputType="investment_case",
                title="Investment Memo",
                version=3,
                status="needs_refresh",
                generationId=project.generation_id,
                createdFromUpdateId=None,
                createdAt="2026-08-02T10:00:00Z",
            ),
            ArtifactVersion(
                id="artifact-demo-project-1-one_page-v2",
                projectId=project.id,
                outputId="out-demo-executive-summary",
                outputType="one_page",
                title="Executive Summary",
                version=2,
                status="needs_refresh",
                generationId=project.generation_id,
                createdFromUpdateId=None,
                createdAt="2026-08-02T10:05:00Z",
            ),
            ArtifactVersion(
                id="artifact-demo-project-1-talking_points-v1",
                projectId=project.id,
                outputId="out-demo-donor-brief",
                outputType="talking_points",
                title="Donor Brief",
                version=1,
                status="current",
                generationId=project.generation_id,
                createdFromUpdateId=None,
                createdAt="2026-08-02T10:10:00Z",
            ),
            ArtifactVersion(
                id="artifact-demo-project-1-source_appendix-v1",
                projectId=project.id,
                outputId="out-demo-source-appendix",
                outputType="source_appendix",
                title="Source Appendix",
                version=1,
                status="current",
                generationId=project.generation_id,
                createdFromUpdateId=None,
                createdAt="2026-08-02T10:12:00Z",
            ),
        ]

        meeting_citation = CitationRef(
            sourceId="upd-demo-hkjc-meeting",
            label="HKJC partner meeting",
            locator="Aug 7 notes",
            excerpt="HKJC team asked to move the expected funding start from Q1 2027 to Q2 2027 and requested clearer implementation-role language.",
        )
        budget_citation = CitationRef(
            sourceId="upd-demo-hkjc-budget",
            label="Budget model.xlsx",
            locator="Phase 1 tab",
            excerpt="The updated budget model separates R&D, clinical validation, and partnership-management assumptions.",
        )
        self.project_updates[project.id] = [
            ProjectUpdate(
                id="upd-demo-hkjc-meeting",
                projectId=project.id,
                updateType="meeting_notes",
                sourceLabel="Meeting with HKJC team",
                rawText="HKJC team asked to move the expected funding start from Q1 2027 to Q2 2027. They also asked for clearer language distinguishing the concept owner, implementing organization, and funding recipient. Follow up is needed on whether a pooled vehicle or separate research institution would receive funds.",
                summary="HKJC feedback changes the expected funding timeline and asks for clearer role distinctions.",
                status="pending_review",
                extractedFacts=[
                    UpdateCandidate(
                        id="upd-demo-hkjc-meeting-fact-1",
                        category="timeline",
                        label="Funding timeline",
                        value="Funding is expected to begin in Q2 2027 rather than Q1 2027.",
                        confidence=0.78,
                        sourceReference="HKJC partner meeting · Aug 7",
                        citations=[meeting_citation],
                    ),
                    UpdateCandidate(
                        id="upd-demo-hkjc-meeting-fact-2",
                        category="implementation_roles",
                        label="Role clarity",
                        value="The materials should distinguish concept owner, implementing organization, funding recipient, and donor audience more explicitly.",
                        confidence=0.76,
                        sourceReference="HKJC partner meeting · Aug 7",
                        citations=[meeting_citation],
                    ),
                    UpdateCandidate(
                        id="upd-demo-hkjc-meeting-fact-3",
                        category="audience_context",
                        label="Audience emphasis",
                        value="HKJC requested a sharper explanation of why the vaccine development concept is relevant to Asia-based philanthropic health innovation.",
                        confidence=0.72,
                        sourceReference="HKJC partner meeting · Aug 7",
                        citations=[meeting_citation],
                    ),
                ],
                openQuestions=[
                    UpdateCandidate(
                        id="upd-demo-hkjc-meeting-question-1",
                        category="open_capital_pathway",
                        label="Open question: capital pathway",
                        value="It remains unresolved whether a pooled vehicle or a separate research institution would receive funds.",
                        confidence=0.7,
                        sourceReference="HKJC partner meeting · Aug 7",
                        citations=[meeting_citation],
                    )
                ],
                affectedOutputs=[
                    AffectedOutput(
                        outputType="investment_case",
                        reason="Timeline, role clarity, and capital-pathway language affect the memo narrative and diligence section.",
                        status="needs_refresh",
                    ),
                    AffectedOutput(
                        outputType="one_page",
                        reason="The summary should reflect the Q2 2027 timing and Asia-focused audience framing.",
                        status="needs_refresh",
                    ),
                ],
                createdAt="2026-08-07T09:30:00Z",
                approvedAt=None,
            ),
            ProjectUpdate(
                id="upd-demo-hkjc-budget",
                projectId=project.id,
                updateType="document_upload",
                sourceLabel="Budget model.xlsx",
                rawText="The updated budget model separates R&D, clinical validation, and partnership-management assumptions. No final funding gap or funding recipient is confirmed.",
                summary="Budget model adds structure for discussion but does not confirm a funding gap or recipient.",
                status="pending_review",
                extractedFacts=[
                    UpdateCandidate(
                        id="upd-demo-hkjc-budget-fact-1",
                        category="funding",
                        label="Budget structure",
                        value="The budget model separates R&D, clinical validation, and partnership-management assumptions.",
                        confidence=0.73,
                        sourceReference="Budget model.xlsx · Aug 6",
                        citations=[budget_citation],
                    )
                ],
                openQuestions=[],
                affectedOutputs=[
                    AffectedOutput(
                        outputType="talking_points",
                        reason="The donor brief should include a budget-discussion prompt without inventing a final funding gap.",
                        status="needs_refresh",
                    )
                ],
                createdAt="2026-08-06T15:00:00Z",
                approvedAt=None,
            ),
        ]

        self.project_memory_items[project.id] = [
            ProjectMemoryItem(
                id="mem-demo-capital-pathway",
                projectId=project.id,
                category="capital_pathway",
                label="Capital pathway unresolved",
                value="Funding recipient, investment vehicle, and investment manager are unresolved in the approved source set.",
                sourceUpdateId="seed-source-set",
                sourceReference="Initial source review",
                status="approved",
                citations=[strategy_citation],
                createdAt="2026-08-02T10:20:00Z",
                approvedAt="2026-08-02T10:20:00Z",
            )
        ]

    def list_projects(self) -> list[Project]:
        return sorted(
            [self._with_default_review(project) for project in self.projects.values()],
            key=lambda item: item.updated_at,
            reverse=True,
        )

    def create_project(self, request: ProjectCreate) -> Project:
        project_id = f"demo-project-{self.next_number}"
        self.next_number += 1
        now = utc_now()
        project = Project(
            id=project_id,
            name=request.name or "HKJC - Vaccine Development",
            createdAt=now,
            updatedAt=now,
            demoNotice=DEMO_NOTICE,
        )
        self.projects[project.id] = project
        return self._with_default_review(project)

    def get_project(self, project_id: str) -> Project:
        try:
            project = self.projects[project_id]
        except KeyError as error:
            raise HTTPException(status_code=404, detail="Project not found.") from error
        return self._with_default_review(project)

    def update_task(self, project_id: str, request: TaskUpdate) -> Project:
        project = self.get_project(project_id)
        metadata = {
            "source": "user",
            "required": True,
            "editable": True,
            "confirmed": bool(request.selected_task_id or request.custom_description),
        }
        project.task = TaskState(
            selectedTaskId=request.selected_task_id,
            taskLabel=request.task_label,
            customDescription=request.custom_description or "",
            metadata=metadata,
        )
        return self._touch(project)

    def update_opportunity_audience(
        self,
        project_id: str,
        request: OpportunityAudienceUpdate,
    ) -> Project:
        project = self.get_project(project_id)
        custom_title = None
        if request.source_mode == "new" and project.extraction_id:
            extraction = self.extractions.get(project.extraction_id)
            if extraction:
                name_field = next(
                    (field for field in extraction.fields if field.id == "opportunity_name"),
                    None,
                )
                custom_title = name_field.value if name_field else None

        suggestions = list(request.suggestions)
        if (
            request.source_mode == "existing"
            and request.opportunity_id
            and request.audience_id
            and not suggestions
        ):
            suggestions = default_suggestions(
                self.opportunity_repo.get_opportunity(request.opportunity_id),
                self.audience_repo.get_audience(request.audience_id),
            )

        project.opportunity_audience = OpportunityAudienceState(
            sourceMode=request.source_mode,
            opportunityId=request.opportunity_id,
            audienceId=request.audience_id,
            intendedOutcome=request.intended_outcome,
            suggestions=suggestions,
            selectedOutputs=request.selected_outputs,
            customOpportunityTitle=custom_title,
        )
        project.review_setup = None
        return self._touch(project)

    def save_extraction(self, project_id: str, extraction: ExtractionResult) -> Project:
        project = self.get_project(project_id)
        self.extractions[extraction.id] = extraction
        project.extraction_id = extraction.id
        if project.opportunity_audience and project.opportunity_audience.source_mode == "new":
            name_field = next((field for field in extraction.fields if field.id == "opportunity_name"), None)
            project.opportunity_audience.custom_opportunity_title = name_field.value if name_field else None
        project.review_setup = None
        return self._touch(project)

    def get_extraction(self, extraction_id: str) -> ExtractionResult:
        try:
            return self.extractions[extraction_id]
        except KeyError as error:
            raise HTTPException(status_code=404, detail="Extraction not found.") from error

    def update_extraction(
        self,
        project_id: str,
        extraction: ExtractionResult,
        confirmed: bool,
    ) -> Project:
        project = self.get_project(project_id)
        extraction = extraction.model_copy(
            update={
                "fields": [
                    field.model_copy(
                        update={
                            "metadata": field.metadata.model_copy(
                                update={"confirmed": confirmed or field.verified},
                            )
                        }
                    )
                    for field in extraction.fields
                ]
            },
            deep=True,
        )
        self.extractions[extraction.id] = extraction
        project.extraction_id = extraction.id
        if project.opportunity_audience and project.opportunity_audience.source_mode == "new":
            name_field = next((field for field in extraction.fields if field.id == "opportunity_name"), None)
            project.opportunity_audience.custom_opportunity_title = name_field.value if name_field else None
        project.review_setup = None
        return self._touch(project)

    def update_review_setup(self, project_id: str, request: ReviewSetupUpdate) -> Project:
        project = self.get_project(project_id)
        source_count = self._source_count(project)
        extraction_confirmed = self._extraction_confirmed(project)
        output_count = len(project.opportunity_audience.selected_outputs) if project.opportunity_audience else 0
        project.review_setup = ReviewSetupState(
            approachFields=request.approach_fields,
            roles=request.roles,
            confirmed=request.confirmed,
            sourceReadiness=source_readiness(source_count, extraction_confirmed, output_count),
        )
        return self._touch(project)

    def save_generation(
        self,
        project_id: str,
        generation: GenerationResult,
        created_from_update_id: str | None = None,
    ) -> Project:
        project = self.get_project(project_id)
        self.generation_store.save_generation(generation)
        project.generation_id = generation.generation_id
        self._record_artifact_versions(project_id, generation, created_from_update_id)
        return self._touch(project)

    def list_project_updates(self, project_id: str) -> list[ProjectUpdate]:
        self.get_project(project_id)
        return sorted(
            self.project_updates.get(project_id, []),
            key=lambda item: item.created_at,
            reverse=True,
        )

    def save_project_update(self, update: ProjectUpdate) -> ProjectUpdate:
        self.get_project(update.project_id)
        updates = [
            item
            for item in self.project_updates.get(update.project_id, [])
            if item.id != update.id
        ]
        updates.append(update)
        self.project_updates[update.project_id] = updates
        project = self.get_project(update.project_id)
        self._touch(project)
        return update

    def get_project_update(self, project_id: str, update_id: str) -> ProjectUpdate:
        self.get_project(project_id)
        update = next(
            (item for item in self.project_updates.get(project_id, []) if item.id == update_id),
            None,
        )
        if not update:
            raise HTTPException(status_code=404, detail="Project update not found.")
        return update

    def approve_project_update(
        self,
        project_id: str,
        update_id: str,
        request: ProjectUpdateReview,
    ) -> ProjectUpdate:
        update = self.get_project_update(project_id, update_id)
        approved_at = utc_now()
        update = update.model_copy(
            update={"status": "approved", "approved_at": approved_at},
            deep=True,
        )
        self.save_project_update(update)

        selected_fact_ids = set(request.approved_fact_ids)
        selected_question_ids = set(request.approved_question_ids)
        candidates = [
            *[
                candidate
                for candidate in update.extracted_facts
                if candidate.id in selected_fact_ids
            ],
            *[
                candidate
                for candidate in update.open_questions
                if candidate.id in selected_question_ids
            ],
        ]
        existing = {
            item.id: item
            for item in self.project_memory_items.get(project_id, [])
        }
        for candidate in candidates:
            memory_id = f"mem-{candidate.id}"
            existing[memory_id] = ProjectMemoryItem(
                id=memory_id,
                projectId=project_id,
                category=candidate.category,
                label=candidate.label,
                value=candidate.value,
                sourceUpdateId=update.id,
                sourceReference=candidate.source_reference,
                status="approved",
                citations=candidate.citations,
                createdAt=approved_at,
                approvedAt=approved_at,
            )
        self.project_memory_items[project_id] = list(existing.values())
        self._mark_affected_artifacts(project_id, update)
        project = self.get_project(project_id)
        self._touch(project)
        return update

    def list_project_memory(self, project_id: str) -> list[ProjectMemoryItem]:
        self.get_project(project_id)
        return sorted(
            self.project_memory_items.get(project_id, []),
            key=lambda item: item.created_at,
            reverse=True,
        )

    def list_artifact_versions(self, project_id: str) -> list[ArtifactVersion]:
        self.get_project(project_id)
        return sorted(
            self.artifact_versions.get(project_id, []),
            key=lambda item: (item.output_type, item.version),
            reverse=True,
        )

    def save_artifact_version(
        self,
        project_id: str,
        generation_id: str,
        output: GeneratedOutput,
    ) -> ArtifactVersion:
        project = self.get_project(project_id)
        generation = self.generation_store.get_generation(generation_id)
        if generation.project_id != project_id:
            raise HTTPException(status_code=400, detail="Generation does not belong to this project.")

        replaced = False
        generation.outputs = [
            output if existing.id == output.id else existing
            for existing in generation.outputs
        ]
        replaced = any(existing.id == output.id for existing in generation.outputs)
        if not replaced:
            raise HTTPException(status_code=404, detail="Output not found in this generation.")

        self.generation_store.save_generation(generation)
        version = self._record_single_artifact_version(project_id, generation_id, output)
        self._touch(project)
        return version

    def _touch(self, project: Project) -> Project:
        project.updated_at = utc_now()
        self.projects[project.id] = project
        return self._with_default_review(project)

    def _record_artifact_versions(
        self,
        project_id: str,
        generation: GenerationResult,
        created_from_update_id: str | None,
    ) -> None:
        created_at = utc_now()
        versions = self.artifact_versions.get(project_id, [])
        next_versions = []
        for existing in versions:
            if any(output.type == existing.output_type for output in generation.outputs) and existing.status == "current":
                next_versions.append(existing.model_copy(update={"status": "superseded"}))
            else:
                next_versions.append(existing)

        for output in generation.outputs:
            prior_versions = [
                item.version
                for item in versions
                if item.output_type == output.type
            ]
            version = max(prior_versions, default=0) + 1
            next_versions.append(
                ArtifactVersion(
                    id=f"artifact-{project_id}-{output.type}-v{version}",
                    projectId=project_id,
                    outputId=output.id,
                    outputType=output.type,
                    title=output.title,
                    version=version,
                    status="current",
                    generationId=generation.generation_id,
                    createdFromUpdateId=created_from_update_id,
                    createdAt=created_at,
                )
            )
        self.artifact_versions[project_id] = next_versions

    def _record_single_artifact_version(
        self,
        project_id: str,
        generation_id: str,
        output: GeneratedOutput,
    ) -> ArtifactVersion:
        created_at = utc_now()
        versions = self.artifact_versions.get(project_id, [])
        prior_versions = [
            item.version
            for item in versions
            if item.output_type == output.type
        ]
        next_version = max(prior_versions, default=0) + 1
        next_versions = [
            (
                version.model_copy(update={"status": "superseded"})
                if version.output_type == output.type and version.status in {"current", "needs_refresh"}
                else version
            )
            for version in versions
        ]
        saved = ArtifactVersion(
            id=f"artifact-{project_id}-{output.type}-v{next_version}",
            projectId=project_id,
            outputId=output.id,
            outputType=output.type,
            title=output.title,
            version=next_version,
            status="current",
            generationId=generation_id,
            createdFromUpdateId=None,
            createdAt=created_at,
        )
        next_versions.append(saved)
        self.artifact_versions[project_id] = next_versions
        return saved

    def _mark_affected_artifacts(self, project_id: str, update: ProjectUpdate) -> None:
        affected = {
            item.output_type
            for item in update.affected_outputs
            if item.status == "needs_refresh"
        }
        if not affected:
            return
        self.artifact_versions[project_id] = [
            (
                version.model_copy(update={"status": "needs_refresh"})
                if version.status == "current" and version.output_type in affected
                else version
            )
            for version in self.artifact_versions.get(project_id, [])
        ]

    def _memory_summary(self, project_id: str) -> ProjectMemorySummary:
        updates = self.project_updates.get(project_id, [])
        memory = self.project_memory_items.get(project_id, [])
        versions = self.artifact_versions.get(project_id, [])
        return ProjectMemorySummary(
            updateCount=len(updates),
            pendingUpdateCount=sum(1 for item in updates if item.status == "pending_review"),
            approvedMemoryCount=sum(1 for item in memory if item.status == "approved"),
            needsRefreshCount=sum(1 for item in versions if item.status == "needs_refresh"),
        )

    def _source_count(self, project: Project) -> int:
        if project.opportunity_audience and project.opportunity_audience.source_mode == "existing":
            if project.opportunity_audience.opportunity_id:
                return len(
                    self.opportunity_repo.get_opportunity(
                        project.opportunity_audience.opportunity_id,
                    ).source_list
                )
        if project.extraction_id:
            return 1
        return len(SOURCES)

    def _extraction_confirmed(self, project: Project) -> bool:
        if not project.extraction_id:
            return project.opportunity_audience is not None and project.opportunity_audience.source_mode == "existing"
        extraction = self.extractions.get(project.extraction_id)
        if not extraction:
            return False
        return all(field.metadata.confirmed for field in extraction.fields if field.metadata.required)

    def _with_default_review(self, project: Project) -> Project:
        if project.review_setup is None:
            output_count = len(project.opportunity_audience.selected_outputs) if project.opportunity_audience else 0
            project.review_setup = default_review_setup(
                self._source_count(project),
                self._extraction_confirmed(project),
                output_count,
            )
        project.memory_summary = self._memory_summary(project.id)
        return project


opportunity_repository = InMemoryOpportunityRepository()
audience_repository = InMemoryAudienceRepository()
generation_store = InMemoryGenerationStore()
case_repository = InMemoryCaseRepository(
    opportunity_repository,
    audience_repository,
    generation_store,
)
