import { randomUUID } from "node:crypto";

import {
  type EvidenceBackedText,
  type EvidenceGap,
  type FundingPathway,
  type Opportunity,
  type OpportunityClaim,
  type OpportunityRecord,
  OpportunitySchema,
  type SourceChunk,
  type SourceDocument,
} from "@/domain";
import type { ModelProvider } from "@/server/model-provider";
import type { Storage, UpsertOpportunityRecordInput } from "@/server/storage";
import { assessOpportunityInvestability } from "@/server/assessment/investability";
import { loadPrompt } from "@/server/prompts";
import { validateOpportunityCitations } from "@/server/validation/citations";

import { generateOpportunitiesWithModel } from "./model-backed";
import { enrichOpportunityRolesAndPathways } from "./roles";

type CandidateChunk = {
  chunk: SourceChunk;
  document: SourceDocument;
  score: number;
};

const MAX_OPPORTUNITIES = 1;

const investmentKeywords = [
  "fund",
  "funding",
  "financing",
  "grant",
  "investment",
  "investor",
  "donor",
  "capital",
  "scale",
  "scale-up",
  "pilot",
  "implementation",
  "implement",
  "program",
  "initiative",
  "intervention",
  "platform",
  "product",
  "partnership",
  "research",
  "trial",
  "develop",
  "procurement",
];

const problemKeywords = [
  "gap",
  "challenge",
  "burden",
  "need",
  "barrier",
  "shortage",
  "risk",
  "unmet",
  "inequity",
  "mortality",
  "morbidity",
  "access",
];

const outcomeKeywords = [
  "impact",
  "outcome",
  "improve",
  "increase",
  "reduce",
  "expand",
  "coverage",
  "access",
  "quality",
  "adoption",
  "delivery",
];

const beneficiaryKeywords = [
  "children",
  "women",
  "newborns",
  "mothers",
  "adolescents",
  "households",
  "patients",
  "health workers",
  "communities",
  "families",
];

function keywordScore(text: string, keywords: string[]) {
  const normalized = text.toLowerCase();
  return keywords.reduce(
    (score, keyword) =>
      normalized.includes(keyword.toLowerCase()) ? score + 1 : score,
    0,
  );
}

function sentenceSplit(text: string) {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

function sentenceWithKeywords(text: string, keywords: string[]) {
  return sentenceSplit(text).find((sentence) =>
    keywords.some((keyword) =>
      sentence.toLowerCase().includes(keyword.toLowerCase()),
    ),
  );
}

function concise(text: string, maxLength = 420) {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 1).trimEnd()}...`;
}

function normalizeTitle(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function titleFromChunk(chunk: SourceChunk) {
  const heading =
    chunk.metadata.sectionHeading ?? chunk.citation.sectionHeading;
  if (heading && heading.length >= 4 && heading.length <= 120) {
    return heading.replace(/:$/, "");
  }

  const headingLine = chunk.text
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length >= 4 && line.length <= 120);

  return (headingLine ?? sentenceSplit(chunk.text)[0] ?? "Untitled opportunity")
    .replace(/:$/, "")
    .slice(0, 120);
}

function evidenceText(
  value: string | undefined,
  citationId: string,
  note?: string,
): EvidenceBackedText {
  return {
    value,
    status: value ? "source_provided" : "unresolved",
    confidence: value ? "medium" : "low",
    citationIds: value ? [citationId] : [],
    note,
  };
}

function unresolvedText(note: string): EvidenceBackedText {
  return {
    status: "unresolved",
    confidence: "low",
    citationIds: [],
    note,
  };
}

function claimFromSentence(
  statement: string,
  citationId: string,
  kind: OpportunityClaim["kind"] = "factual",
): OpportunityClaim {
  return {
    id: randomUUID(),
    statement,
    kind,
    status: "source_provided",
    validationStatus: "supported",
    citationIds: [citationId],
    derivedFromClaimIds: [],
  };
}

function evidenceGap(fieldKey: string, description: string): EvidenceGap {
  return {
    id: randomUUID(),
    fieldKey,
    description,
    severity: "medium",
    suggestedNextStep:
      "Confirm this field from source material or human review.",
  };
}

function unresolvedFundingPathway(): FundingPathway {
  return {
    id: randomUUID(),
    pathwayType: "unresolved_pathway",
    status: "unresolved",
    confidence: "low",
    citationIds: [],
    note: "Source material did not identify a funding recipient or investment vehicle.",
  };
}

function detectBeneficiary(text: string, citationId: string) {
  const normalized = text.toLowerCase();
  const keyword = beneficiaryKeywords.find((candidate) =>
    normalized.includes(candidate),
  );

  if (!keyword) {
    return [];
  }

  return [
    {
      id: randomUUID(),
      label: keyword,
      status: "source_provided" as const,
      confidence: "low" as const,
      citationIds: [citationId],
      description:
        "Detected from source text; confirm beneficiary definition during review.",
    },
  ];
}

function scoreChunk(chunk: SourceChunk) {
  return (
    keywordScore(chunk.text, investmentKeywords) * 3 +
    keywordScore(chunk.text, problemKeywords) * 2 +
    keywordScore(chunk.text, outcomeKeywords)
  );
}

function buildOpportunity(candidate: CandidateChunk): Opportunity {
  const { chunk } = candidate;
  const citationId = chunk.citation.id;
  const title = titleFromChunk(chunk);
  const summary =
    sentenceSplit(chunk.text).slice(0, 2).join(" ") || concise(chunk.text);
  const problemStatement = sentenceWithKeywords(chunk.text, problemKeywords);
  const intervention = sentenceWithKeywords(chunk.text, investmentKeywords);
  const outcomeSentences = sentenceSplit(chunk.text)
    .filter((sentence) =>
      outcomeKeywords.some((keyword) =>
        sentence.toLowerCase().includes(keyword),
      ),
    )
    .slice(0, 3);
  const whyNow = sentenceWithKeywords(chunk.text, [
    "now",
    "urgent",
    "scale",
    "pilot",
    "window",
    "funding",
    "gap",
  ]);

  const sourceClaims = [
    summary,
    problemStatement,
    intervention,
    whyNow,
    ...outcomeSentences,
  ]
    .filter((statement): statement is string => Boolean(statement))
    .map((statement) => claimFromSentence(statement, citationId));

  const gaps = [
    evidenceGap(
      "funding_pathway",
      "Funding recipient or investment vehicle is unresolved.",
    ),
    evidenceGap("total_cost", "Total cost is not established by extraction."),
    evidenceGap("timeline", "Timeline is not established by extraction."),
    evidenceGap(
      "implementation_roles",
      "Implementing organization and delivery partners require confirmation.",
    ),
  ];

  if (!problemStatement) {
    gaps.push(
      evidenceGap(
        "problem_statement",
        "Problem statement was not clearly detected in candidate source text.",
      ),
    );
  }

  if (!intervention) {
    gaps.push(
      evidenceGap(
        "proposed_intervention",
        "Proposed intervention was not clearly detected in candidate source text.",
      ),
    );
  }

  return OpportunitySchema.parse({
    id: randomUUID(),
    title: evidenceText(title, citationId),
    summary: evidenceText(concise(summary), citationId),
    problemStatement: problemStatement
      ? evidenceText(problemStatement, citationId)
      : unresolvedText("No clear problem statement detected."),
    proposedIntervention: intervention
      ? evidenceText(intervention, citationId)
      : unresolvedText("No clear intervention statement detected."),
    whyNow: whyNow
      ? evidenceText(whyNow, citationId)
      : unresolvedText("No urgency or timing evidence detected."),
    investorRelevance:
      candidate.score >= 6
        ? {
            value:
              "Candidate source text contains investment-relevant signals such as funding, scale, implementation, program, or outcome language.",
            status: "derived_from_sources",
            confidence: "low",
            citationIds: [citationId],
            note: "Deterministic extraction signal for review, not polished investor narrative.",
          }
        : unresolvedText("Insufficient investment-relevance signals detected."),
    expectedOutcomes: outcomeSentences.map((sentence) =>
      evidenceText(sentence, citationId),
    ),
    longTermImpact: [],
    geographies: [],
    timeline: {
      status: "unresolved",
      citationIds: [],
    },
    organizationRoles: [],
    fundingPathways: [unresolvedFundingPathway()],
    beneficiaryPopulations: detectBeneficiary(chunk.text, citationId),
    claims: sourceClaims,
    risks: [],
    evidenceGaps: gaps,
    overallStatus: "source_provided",
  });
}

function citationIdsFromEvidence(field: EvidenceBackedText | undefined) {
  return field?.citationIds ?? [];
}

function opportunityCitationIds(opportunity: Opportunity) {
  const citationIds = new Set<string>();
  const add = (ids: string[]) => ids.forEach((id) => citationIds.add(id));

  add(citationIdsFromEvidence(opportunity.title));
  add(citationIdsFromEvidence(opportunity.summary));
  add(citationIdsFromEvidence(opportunity.problemStatement));
  add(citationIdsFromEvidence(opportunity.proposedIntervention));
  add(citationIdsFromEvidence(opportunity.whyNow));
  add(citationIdsFromEvidence(opportunity.investorRelevance));
  opportunity.expectedOutcomes.forEach((field) =>
    add(citationIdsFromEvidence(field)),
  );
  opportunity.longTermImpact.forEach((field) =>
    add(citationIdsFromEvidence(field)),
  );
  opportunity.geographies.forEach((geography) => add(geography.citationIds));
  if (opportunity.timeline) {
    add(opportunity.timeline.citationIds);
  }
  opportunity.organizationRoles.forEach((role) => add(role.citationIds));
  opportunity.fundingPathways.forEach((pathway) => add(pathway.citationIds));
  opportunity.beneficiaryPopulations.forEach((population) =>
    add(population.citationIds),
  );
  [opportunity.totalCost, opportunity.currentFunding, opportunity.fundingGap]
    .filter(Boolean)
    .forEach((money) => add(money?.citationIds ?? []));
  opportunity.claims.forEach((claim) => add(claim.citationIds));
  opportunity.risks.forEach((risk) => {
    add(risk.citationIds);
    add(citationIdsFromEvidence(risk.rationale));
    add(citationIdsFromEvidence(risk.mitigation));
  });

  return citationIds;
}

function filterCitationIds(
  citationIds: string[],
  validCitationIds: Set<string>,
) {
  return citationIds.filter((citationId) => validCitationIds.has(citationId));
}

function normalizeModelOpportunityCitations(
  opportunity: Opportunity,
  validCitationIds: Set<string>,
): Opportunity {
  const filterEvidence = (field: EvidenceBackedText): EvidenceBackedText => ({
    ...field,
    citationIds: filterCitationIds(field.citationIds, validCitationIds),
  });

  return OpportunitySchema.parse({
    ...opportunity,
    title: filterEvidence(opportunity.title),
    summary: filterEvidence(opportunity.summary),
    problemStatement: filterEvidence(opportunity.problemStatement),
    proposedIntervention: filterEvidence(opportunity.proposedIntervention),
    whyNow: filterEvidence(opportunity.whyNow),
    investorRelevance: filterEvidence(opportunity.investorRelevance),
    expectedOutcomes: opportunity.expectedOutcomes.map(filterEvidence),
    longTermImpact: opportunity.longTermImpact.map(filterEvidence),
    geographies: opportunity.geographies.map((geography) => ({
      ...geography,
      citationIds: filterCitationIds(geography.citationIds, validCitationIds),
    })),
    timeline: opportunity.timeline
      ? {
          ...opportunity.timeline,
          citationIds: filterCitationIds(
            opportunity.timeline.citationIds,
            validCitationIds,
          ),
        }
      : undefined,
    organizationRoles: opportunity.organizationRoles
      .map((role) => ({
        ...role,
        citationIds: filterCitationIds(role.citationIds, validCitationIds),
      }))
      .filter((role) => role.citationIds.length > 0),
    fundingPathways: opportunity.fundingPathways.map((pathway) => ({
      ...pathway,
      citationIds: filterCitationIds(pathway.citationIds, validCitationIds),
    })),
    beneficiaryPopulations: opportunity.beneficiaryPopulations
      .map((population) => ({
        ...population,
        geographies: population.geographies.map((geography) => ({
          ...geography,
          citationIds: filterCitationIds(
            geography.citationIds,
            validCitationIds,
          ),
        })),
        citationIds: filterCitationIds(
          population.citationIds,
          validCitationIds,
        ),
      }))
      .filter((population) => population.citationIds.length > 0),
    totalCost: opportunity.totalCost
      ? {
          ...opportunity.totalCost,
          citationIds: filterCitationIds(
            opportunity.totalCost.citationIds,
            validCitationIds,
          ),
        }
      : undefined,
    currentFunding: opportunity.currentFunding
      ? {
          ...opportunity.currentFunding,
          citationIds: filterCitationIds(
            opportunity.currentFunding.citationIds,
            validCitationIds,
          ),
        }
      : undefined,
    fundingGap: opportunity.fundingGap
      ? {
          ...opportunity.fundingGap,
          citationIds: filterCitationIds(
            opportunity.fundingGap.citationIds,
            validCitationIds,
          ),
        }
      : undefined,
    claims: opportunity.claims.map((claim) => ({
      ...claim,
      citationIds: filterCitationIds(claim.citationIds, validCitationIds),
    })),
    risks: opportunity.risks.map((risk) => ({
      ...risk,
      rationale: filterEvidence(risk.rationale),
      mitigation: risk.mitigation ? filterEvidence(risk.mitigation) : undefined,
      citationIds: filterCitationIds(risk.citationIds, validCitationIds),
    })),
  });
}

function sourceDocumentIdsForOpportunity(
  opportunity: Opportunity,
  chunks: SourceChunk[],
  fallbackDocumentIds: string[],
) {
  const citationIds = opportunityCitationIds(opportunity);
  const sourceDocumentIds = chunks
    .filter((chunk) => citationIds.has(chunk.citation.id))
    .map((chunk) => chunk.sourceDocumentId);
  const uniqueDocumentIds = Array.from(new Set(sourceDocumentIds));

  return uniqueDocumentIds.length > 0 ? uniqueDocumentIds : fallbackDocumentIds;
}

function validationStatusForRecords(records: OpportunityRecord[]) {
  return records.some((record) => record.validation?.status === "failed")
    ? "failed"
    : records.some(
          (record) => record.validation?.status === "passed_with_warnings",
        )
      ? "passed_with_warnings"
      : "passed";
}

async function recordFailedModelExtractionRun({
  projectId,
  provider,
  storage,
  chunks,
}: {
  projectId: string;
  provider: ModelProvider;
  storage: Storage;
  chunks: SourceChunk[];
}) {
  const prompt = await loadPrompt("extract-opportunities");

  await storage.createGenerationRun({
    id: randomUUID(),
    projectId,
    runType: "extract_opportunities",
    promptName: prompt.name,
    promptVersion: prompt.version,
    modelProvider: provider.providerName,
    modelName: provider.modelName,
    inputChunkIds: chunks.map((chunk) => chunk.id),
    status: "failed",
    storedPayloadMode: "validated_outputs_only",
  });
}

async function extractModelBackedOpportunityRecords({
  projectId,
  storage,
  provider,
  chunks,
  parsedDocuments,
}: {
  projectId: string;
  storage: Storage;
  provider: ModelProvider;
  chunks: SourceChunk[];
  parsedDocuments: SourceDocument[];
}) {
  const { prompt, response } = await generateOpportunitiesWithModel({
    chunks,
    provider,
  });
  const generationRunId = randomUUID();
  const fallbackDocumentIds = parsedDocuments.map((document) => document.id);
  const validCitationIds = new Set(chunks.map((chunk) => chunk.citation.id));
  const opportunities: UpsertOpportunityRecordInput[] =
    response.output.opportunities
      .slice(0, MAX_OPPORTUNITIES)
      .map((modelOpportunity) => {
        const opportunity = enrichOpportunityRolesAndPathways(
          normalizeModelOpportunityCitations(
            OpportunitySchema.parse(modelOpportunity),
            validCitationIds,
          ),
          chunks,
        );
        const validation = validateOpportunityCitations(opportunity);
        const assessment = assessOpportunityInvestability(opportunity);

        return {
          id: opportunity.id,
          projectId,
          title: opportunity.title.value ?? "Untitled opportunity",
          overallStatus: opportunity.overallStatus,
          opportunity,
          assessment,
          validation,
          sourceDocumentIds: sourceDocumentIdsForOpportunity(
            opportunity,
            chunks,
            fallbackDocumentIds,
          ),
          extractionRunId: generationRunId,
        };
      });

  const records = await storage.replaceOpportunityRecords(
    projectId,
    opportunities,
  );
  await storage.createGenerationRun({
    id: generationRunId,
    projectId,
    runType: "extract_opportunities",
    promptName: prompt.name,
    promptVersion: prompt.version,
    modelProvider: response.modelProvider,
    modelName: response.modelName,
    inputChunkIds: chunks.map((chunk) => chunk.id),
    validationResult: {
      status: validationStatusForRecords(records),
      findings: records.flatMap((record) => record.validation?.findings ?? []),
      checkedAtIso: new Date().toISOString(),
    },
    status: "completed",
    storedPayloadMode: response.storedPayloadMode,
  });

  return records;
}

export async function extractOpportunitiesForProject({
  projectId,
  storage,
  provider,
}: {
  projectId: string;
  storage: Storage;
  provider?: ModelProvider;
}) {
  const documents = await storage.listSourceDocuments(projectId);
  const parsedDocuments = documents.filter(
    (document) => document.status === "parsed",
  );
  const candidates: CandidateChunk[] = [];
  const allChunks: SourceChunk[] = [];

  for (const document of parsedDocuments) {
    const chunks = await storage.listSourceChunks(document.id);
    allChunks.push(...chunks);
    for (const chunk of chunks) {
      const score = scoreChunk(chunk);
      if (score >= 4) {
        candidates.push({ chunk, document, score });
      }
    }
  }

  if (provider && allChunks.length > 0) {
    try {
      const records = await extractModelBackedOpportunityRecords({
        projectId,
        storage,
        provider,
        chunks: allChunks,
        parsedDocuments,
      });

      if (records.length > 0) {
        return records;
      }
    } catch (error) {
      console.warn(
        "Model-backed opportunity extraction failed; falling back to deterministic extraction.",
        error instanceof Error ? error.message : "Unknown model error.",
      );
      await recordFailedModelExtractionRun({
        projectId,
        provider,
        storage,
        chunks: allChunks,
      });
    }
  }

  const seenTitles = new Set<string>();
  const opportunities: UpsertOpportunityRecordInput[] = [];
  const prompt = await loadPrompt("extract-opportunities");
  const generationRunId = randomUUID();

  for (const candidate of candidates.sort((a, b) => b.score - a.score)) {
    const titleKey = normalizeTitle(titleFromChunk(candidate.chunk));
    if (seenTitles.has(titleKey)) {
      continue;
    }

    seenTitles.add(titleKey);
    const opportunity = enrichOpportunityRolesAndPathways(
      buildOpportunity(candidate),
      allChunks,
    );
    const validation = validateOpportunityCitations(opportunity);
    const assessment = assessOpportunityInvestability(opportunity);
    opportunities.push({
      id: opportunity.id,
      projectId,
      title: opportunity.title.value ?? "Untitled opportunity",
      overallStatus: opportunity.overallStatus,
      opportunity,
      assessment,
      validation,
      sourceDocumentIds: [candidate.document.id],
      extractionRunId: generationRunId,
    });

    if (opportunities.length >= MAX_OPPORTUNITIES) {
      break;
    }
  }

  const records = await storage.replaceOpportunityRecords(
    projectId,
    opportunities,
  );
  await storage.createGenerationRun({
    id: generationRunId,
    projectId,
    runType: "extract_opportunities",
    promptName: prompt.name,
    promptVersion: prompt.version,
    modelProvider: "deterministic",
    modelName: "keyword-role-pathway-extractor-v1",
    inputChunkIds: allChunks.map((chunk) => chunk.id),
    validationResult: {
      status: validationStatusForRecords(records),
      findings: records.flatMap((record) => record.validation?.findings ?? []),
      checkedAtIso: new Date().toISOString(),
    },
    status: "completed",
    storedPayloadMode: "validated_outputs_only",
  });

  return records;
}
