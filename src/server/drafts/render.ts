import { randomUUID } from "node:crypto";

import {
  ValidatedDraftSchema,
  formatVariantLabel,
  getNarrativeAngleProfile,
  getOutputFormatProfile,
  normalizeProspectusBuilder,
  type AudienceTailoring,
  type Citation,
  type DraftSection,
  type EvidenceBackedText,
  type EvidenceGap,
  type FundingPathway,
  type InvestorSegment,
  type MoneyAmount,
  type OpportunityClaim,
  type OpportunityRecord,
  type OrganizationRole,
  type OutputType,
  type ProspectusBuilder,
  type ValidatedDraft,
} from "@/domain";

import { evaluateDraftQuality } from "./evaluation";
import {
  getAudienceTailoringProfile,
  getInvestorSegmentProfile,
  normalizeAudienceTailoring,
} from "./segments";
import { strengthenDraftNarrative } from "./strengthen";
import { validateDraftClaims } from "./validation";

type RenderOptions = {
  draftId?: string;
  outputType: OutputType;
  investorSegment: InvestorSegment;
  audienceTailoring?: AudienceTailoring;
  prospectusBuilder?: ProspectusBuilder;
  strengthenNarrative?: boolean;
};

type DraftBuilder = {
  draftId: string;
  record: OpportunityRecord;
  citations: Citation[];
  prospectusBuilder: ProspectusBuilder;
  citationLabels: Map<string, string>;
  claims: OpportunityClaim[];
  claimIdsByText: Map<string, string>;
};

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

function citationSuffix(citationIds: string[], labels: Map<string, string>) {
  const suffix = unique(citationIds)
    .map((citationId) => labels.get(citationId))
    .filter(Boolean)
    .join(" ");

  return suffix ? ` ${suffix}` : "";
}

function makeCitationLabels(citations: Citation[]) {
  return new Map(
    citations.map((citation, index) => [citation.id, `[S${index + 1}]`]),
  );
}

function addClaim(
  builder: DraftBuilder,
  statement: string,
  options: {
    kind?: OpportunityClaim["kind"];
    status?: OpportunityClaim["status"];
    validationStatus?: OpportunityClaim["validationStatus"];
    citationIds?: string[];
    note?: string;
  } = {},
) {
  const normalized = statement.trim();
  const key = `${normalized}:${options.status ?? "source_provided"}:${unique(
    options.citationIds ?? [],
  ).join(",")}`;
  const existingId = builder.claimIdsByText.get(key);
  if (existingId) {
    return existingId;
  }

  const citationIds = unique(options.citationIds ?? []);
  const claim: OpportunityClaim = {
    id: `${builder.draftId}-claim-${builder.claims.length + 1}`,
    statement: normalized,
    kind: options.kind ?? "factual",
    status: options.status ?? "source_provided",
    validationStatus:
      options.validationStatus ??
      (citationIds.length > 0 ? "supported" : "not_checked"),
    citationIds,
    derivedFromClaimIds: [],
    note: options.note,
  };
  builder.claims.push(claim);
  builder.claimIdsByText.set(key, claim.id);

  return claim.id;
}

function fieldLine(
  builder: DraftBuilder,
  label: string,
  field: EvidenceBackedText,
) {
  if (!field.value) {
    const statement = `${label} is not established in the provided source materials.`;
    const claimId = addClaim(builder, statement, {
      status: "unresolved",
      validationStatus: "not_checked",
      citationIds: [],
    });

    return {
      markdown: `**${label}:** Not established in the provided source materials.`,
      claimIds: [claimId],
      warnings: [statement],
    };
  }

  const claimId = addClaim(builder, field.value, {
    status: field.status,
    citationIds: field.citationIds,
    kind:
      field.status === "generated_framing" ? "narrative_framing" : "factual",
  });

  return {
    markdown: `**${label}:** ${field.value}${citationSuffix(
      field.citationIds,
      builder.citationLabels,
    )}`,
    claimIds: [claimId],
    warnings:
      field.citationIds.length === 0 ? [`${label} has no citation.`] : [],
  };
}

function paragraphFromField(builder: DraftBuilder, field: EvidenceBackedText) {
  if (!field.value) {
    const statement =
      "This field is not established in the provided source materials.";
    const claimId = addClaim(builder, statement, {
      status: "unresolved",
      validationStatus: "not_checked",
    });
    return {
      markdown: "Not established in the provided source materials.",
      claimIds: [claimId],
      warnings: [statement],
    };
  }

  const claimId = addClaim(builder, field.value, {
    status: field.status,
    citationIds: field.citationIds,
    kind:
      field.status === "generated_framing" ? "narrative_framing" : "factual",
  });

  return {
    markdown: `${field.value}${citationSuffix(
      field.citationIds,
      builder.citationLabels,
    )}`,
    claimIds: [claimId],
    warnings:
      field.citationIds.length === 0 && field.status !== "generated_framing"
        ? ["Field has no citation."]
        : [],
  };
}

function roleLine(
  builder: DraftBuilder,
  label: string,
  role: OrganizationRole | undefined,
) {
  if (!role) {
    const statement = `${label} is not established in the provided source materials.`;
    const claimId = addClaim(builder, statement, {
      status: "unresolved",
      validationStatus: "not_checked",
    });
    return {
      markdown: `**${label}:** Not established in the provided source materials.`,
      claimIds: [claimId],
      warnings: [statement],
    };
  }

  const statement = `${label} is ${role.organizationName}.`;
  const claimId = addClaim(builder, statement, {
    status: role.status,
    citationIds: role.citationIds,
  });

  return {
    markdown: `**${label}:** ${role.organizationName}${citationSuffix(
      role.citationIds,
      builder.citationLabels,
    )}`,
    claimIds: [claimId],
    warnings: [],
  };
}

function pathwayLine(
  builder: DraftBuilder,
  label: string,
  pathway: FundingPathway | undefined,
) {
  if (!pathway || pathway.pathwayType === "unresolved_pathway") {
    const statement = `${label} is not established in the provided source materials.`;
    const claimId = addClaim(builder, statement, {
      status: "unresolved",
      validationStatus: "not_checked",
    });
    return {
      markdown: `**${label}:** Not established in the provided source materials.`,
      claimIds: [claimId],
      warnings: [statement],
    };
  }

  const name = pathway.name ?? pathway.pathwayType.replaceAll("_", " ");
  const statement = `${label} is ${name}.`;
  const claimId = addClaim(builder, statement, {
    status: pathway.status,
    citationIds: pathway.citationIds,
  });

  return {
    markdown: `**${label}:** ${name}${citationSuffix(
      pathway.citationIds,
      builder.citationLabels,
    )}`,
    claimIds: [claimId],
    warnings: [],
  };
}

function moneyLine(
  builder: DraftBuilder,
  label: string,
  money: MoneyAmount | undefined,
) {
  const value =
    money?.displayText ??
    (money?.amount && money.currency
      ? `${money.currency} ${money.amount.toLocaleString()}`
      : undefined);

  if (!value || !money) {
    const statement = `${label} is not established in the provided source materials.`;
    const claimId = addClaim(builder, statement, {
      status: "unresolved",
      validationStatus: "not_checked",
    });
    return {
      markdown: `**${label}:** Not established in the provided source materials.`,
      claimIds: [claimId],
      warnings: [statement],
    };
  }

  const statement = `${label} is ${value}.`;
  const claimId = addClaim(builder, statement, {
    status: money.status,
    citationIds: money.citationIds,
    kind: "numerical",
    validationStatus:
      money.validationStatus === "supported" && money.citationIds.length > 0
        ? "supported"
        : money.validationStatus,
  });

  return {
    markdown: `**${label}:** ${value}${citationSuffix(
      money.citationIds,
      builder.citationLabels,
    )}`,
    claimIds: [claimId],
    warnings:
      money.citationIds.length === 0 ? [`${label} has no citation.`] : [],
  };
}

function sourceList(builder: DraftBuilder) {
  if (builder.citations.length === 0) {
    const claimId = addClaim(builder, "No source citations are available.", {
      status: "unresolved",
      validationStatus: "not_checked",
    });
    return {
      lines: ["No source citations are available."],
      claimIds: [claimId],
    };
  }

  const claimIds: string[] = [];
  const lines = builder.citations.map((citation) => {
    const label = builder.citationLabels.get(citation.id) ?? "[S?]";
    const location = [
      citation.filename,
      citation.pageNumber ? `page ${citation.pageNumber}` : undefined,
      citation.slideNumber ? `slide ${citation.slideNumber}` : undefined,
      citation.sectionHeading,
    ]
      .filter(Boolean)
      .join(", ");
    const statement = `${label} ${location}: ${citation.excerpt}`;
    claimIds.push(
      addClaim(builder, statement, {
        status: "source_provided",
        citationIds: [citation.id],
      }),
    );
    return `- ${statement}`;
  });

  return { lines, claimIds };
}

function beneficiaryLines(builder: DraftBuilder) {
  const populations = builder.record.opportunity.beneficiaryPopulations;

  if (populations.length === 0) {
    const statement =
      "Beneficiary population is not established in the provided source materials.";
    const claimId = addClaim(builder, statement, {
      status: "unresolved",
      validationStatus: "not_checked",
    });

    return [
      {
        markdown:
          "**Beneficiary:** Not established in the provided source materials.",
        claimIds: [claimId],
        warnings: [statement],
      },
    ];
  }

  return populations.map((population) => {
    const statement = `Beneficiary population: ${population.label}.`;
    const claimId = addClaim(builder, statement, {
      status: population.status,
      citationIds: population.citationIds,
    });

    return {
      markdown: `**Beneficiary:** ${population.label}${citationSuffix(
        population.citationIds,
        builder.citationLabels,
      )}`,
      claimIds: [claimId],
      warnings: [],
    };
  });
}

function section(
  builder: DraftBuilder,
  orderIndex: number,
  sectionKey: string,
  title: string,
  parts: Array<{
    markdown: string;
    claimIds: string[];
    warnings?: string[];
    evidenceGapIds?: string[];
  }>,
): DraftSection {
  const claimIds = unique(parts.flatMap((part) => part.claimIds));
  const warnings = unique(parts.flatMap((part) => part.warnings ?? []));
  const evidenceGapIds = unique(
    parts.flatMap((part) => part.evidenceGapIds ?? []),
  );

  return {
    id: `${builder.draftId}-section-${sectionKey}`,
    sectionKey,
    title,
    renderedMarkdown: parts.map((part) => part.markdown).join("\n\n"),
    claimIds,
    evidenceGapIds,
    warningText: warnings,
    orderIndex,
    regenerationCount: 0,
  };
}

function gapPart(gaps: EvidenceGap[]) {
  return {
    markdown:
      gaps.length > 0
        ? gaps.map((gap) => `- ${gap.description}`).join("\n")
        : "No evidence gaps recorded.",
    claimIds: [],
    evidenceGapIds: gaps.map((gap) => gap.id),
  };
}

function sectionFromLines(
  builder: DraftBuilder,
  orderIndex: number,
  sectionKey: string,
  title: string,
  lines: ReturnType<typeof fieldLine>[],
) {
  return section(builder, orderIndex, sectionKey, title, lines);
}

function findPathway(
  record: OpportunityRecord,
  type: FundingPathway["pathwayType"],
) {
  return record.opportunity.fundingPathways.find(
    (pathway) => pathway.pathwayType === type,
  );
}

function firstResolvedPathway(record: OpportunityRecord) {
  return record.opportunity.fundingPathways.find(
    (pathway) => pathway.pathwayType !== "unresolved_pathway",
  );
}

function findRole(
  record: OpportunityRecord,
  type: OrganizationRole["roleType"],
) {
  return record.opportunity.organizationRoles.find(
    (role) => role.roleType === type,
  );
}

function generatedNote(builder: DraftBuilder, statement: string) {
  return {
    markdown: statement,
    claimIds: [
      addClaim(builder, statement, {
        kind: "narrative_framing",
        status: "generated_framing",
        validationStatus: "not_checked",
      }),
    ],
  };
}

function optionalGeneratedNote(
  builder: DraftBuilder,
  label: string,
  value: string | undefined,
) {
  if (!value) {
    return undefined;
  }

  return generatedNote(builder, `${label}: ${value}`);
}

function prospectusBuilderParts(
  builder: DraftBuilder,
  investorSegment: InvestorSegment,
  audienceTailoring: AudienceTailoring,
  outputType: OutputType,
) {
  const format = getOutputFormatProfile(outputType);
  const investorProfile = getInvestorSegmentProfile(investorSegment);
  const tailoringProfile = getAudienceTailoringProfile(audienceTailoring);
  const angleProfile = getNarrativeAngleProfile(
    builder.prospectusBuilder.narrativeAngle,
  );
  const notes = [
    generatedNote(builder, `Format guidance: ${format.promptGuidance}`),
    generatedNote(builder, investorProfile.propositionLens),
    generatedNote(builder, tailoringProfile.propositionLens),
    generatedNote(builder, `Narrative angle: ${angleProfile.lens}`),
    optionalGeneratedNote(
      builder,
      "Intended audience note, not source evidence",
      builder.prospectusBuilder.intendedAudience,
    ),
    optionalGeneratedNote(
      builder,
      "Positioning note from reviewer, not source evidence",
      builder.prospectusBuilder.positioningNotes,
    ),
    optionalGeneratedNote(
      builder,
      "Suggested call to action",
      builder.prospectusBuilder.callToAction,
    ),
  ];

  return notes.filter((note): note is ReturnType<typeof generatedNote> =>
    Boolean(note),
  );
}

function capitalPathwayLines(builder: DraftBuilder) {
  const { record } = builder;

  return [
    pathwayLine(
      builder,
      "Funding recipient",
      findPathway(record, "funding_recipient"),
    ),
    pathwayLine(
      builder,
      "Investment vehicle",
      findPathway(record, "investment_vehicle"),
    ),
    pathwayLine(builder, "Other capital pathway", firstResolvedPathway(record)),
  ];
}

function roleBoundaryLines(builder: DraftBuilder) {
  const { record } = builder;

  return [
    roleLine(builder, "Concept owner", findRole(record, "concept_owner")),
    roleLine(builder, "Sponsoring team", findRole(record, "sponsoring_team")),
    roleLine(
      builder,
      "Implementing organization",
      findRole(record, "implementing_organization"),
    ),
    roleLine(builder, "Delivery partner", findRole(record, "delivery_partner")),
    roleLine(
      builder,
      "Investment manager",
      findRole(record, "investment_manager"),
    ),
    roleLine(builder, "Fiscal sponsor", findRole(record, "fiscal_sponsor")),
  ];
}

function sourceFactLines(builder: DraftBuilder) {
  const opportunity = builder.record.opportunity;

  return [
    fieldLine(builder, "Problem", opportunity.problemStatement),
    fieldLine(
      builder,
      "Proposed intervention",
      opportunity.proposedIntervention,
    ),
    fieldLine(builder, "Why now", opportunity.whyNow),
    fieldLine(builder, "Investor relevance", opportunity.investorRelevance),
  ];
}

function moneySnapshotLines(builder: DraftBuilder) {
  const opportunity = builder.record.opportunity;

  return [
    moneyLine(builder, "Total cost", opportunity.totalCost),
    moneyLine(builder, "Current funding", opportunity.currentFunding),
    moneyLine(builder, "Funding gap", opportunity.fundingGap),
  ];
}

function evidenceSeparationSection(
  builder: DraftBuilder,
  orderIndex: number,
  sectionKey: string,
  title: string,
  outputType: OutputType,
) {
  const format = getOutputFormatProfile(outputType);
  const angle = getNarrativeAngleProfile(
    builder.prospectusBuilder.narrativeAngle,
  );
  const facts = sourceFactLines(builder);
  const gaps =
    builder.record.assessment?.missingEvidence ??
    builder.record.opportunity.evidenceGaps;
  const gap = gapPart(gaps);
  const gapClaimId = addClaim(
    builder,
    gaps.length > 0
      ? "Unresolved evidence gaps remain visible in this draft."
      : "No evidence gaps are recorded for this draft.",
    { status: "generated_framing", kind: "narrative_framing" },
  );

  return section(builder, orderIndex, sectionKey, title, [
    {
      markdown: [
        "**Source facts:**",
        ...facts.map((line) => `- ${line.markdown}`),
      ].join("\n"),
      claimIds: facts.flatMap((line) => line.claimIds),
      warnings: facts.flatMap((line) => line.warnings),
    },
    generatedNote(
      builder,
      `**Generated framing:** ${format.shortLabel} language uses the ${angle.label} angle to attract interest without adding facts.`,
    ),
    {
      ...gap,
      markdown: `**Unresolved items:**\n${gap.markdown}`,
      claimIds: [gapClaimId],
    },
  ]);
}

function visualBriefParts(
  builder: DraftBuilder,
  audienceTailoring: AudienceTailoring,
) {
  const { record } = builder;
  const tailoringProfile = getAudienceTailoringProfile(audienceTailoring);
  const unresolvedPathway = record.opportunity.fundingPathways.some(
    (pathway) =>
      pathway.status === "unresolved" ||
      pathway.pathwayType === "unresolved_pathway",
  );
  const hasNumericalAsk = Boolean(
    record.opportunity.totalCost ??
    record.opportunity.currentFunding ??
    record.opportunity.fundingGap,
  );
  const parts = [
    generatedNote(
      builder,
      "Visual lead: show the problem, the proposed intervention, and the donor decision as a simple evidence-backed story.",
    ),
    generatedNote(
      builder,
      "Evidence callouts: use only source-supported claims and preserve citation labels next to proof points.",
    ),
    generatedNote(
      builder,
      hasNumericalAsk
        ? "Funding visual: show sourced cost, current funding, and funding gap only where the values have citation support."
        : "Funding visual: do not create cost or funding-gap charts until sourced numerical evidence is available.",
    ),
    generatedNote(
      builder,
      unresolvedPathway
        ? "Capital pathway visual: keep funding recipient or investment vehicle marked unresolved until source evidence identifies it."
        : "Capital pathway visual: separate implementer, fund recipient, investment vehicle, delivery partner, beneficiary, and donor audience.",
    ),
    generatedNote(builder, tailoringProfile.visualGuidance),
  ];

  if (record.opportunity.beneficiaryPopulations.length > 0) {
    parts.push(
      generatedNote(
        builder,
        "Beneficiary visual: use source-supported beneficiary language to make the human stakes concrete.",
      ),
    );
  }

  return parts;
}

function behavioralFramingParts(
  builder: DraftBuilder,
  audienceTailoring: AudienceTailoring,
) {
  const tailoringProfile = getAudienceTailoringProfile(audienceTailoring);

  return [
    generatedNote(
      builder,
      "Language direction: keep the donor case concrete, specific, and easy to act on.",
    ),
    generatedNote(
      builder,
      "Behavioral framing: make the decision salient, show credible urgency, and end with a clear next action without adding unsupported facts.",
    ),
    generatedNote(builder, tailoringProfile.behavioralGuidance),
  ];
}

function renderExecutiveSections(
  builder: DraftBuilder,
  investorSegment: InvestorSegment,
  audienceTailoring: AudienceTailoring,
) {
  const { record } = builder;
  const opportunity = record.opportunity;
  const profile = getInvestorSegmentProfile(investorSegment);
  const tailoringProfile = getAudienceTailoringProfile(audienceTailoring);
  const sections: DraftSection[] = [];
  let index = 0;

  const propositionClaim = addClaim(builder, profile.propositionLens, {
    kind: "narrative_framing",
    status: "generated_framing",
    validationStatus: "not_checked",
  });
  const tailoringClaim = addClaim(builder, tailoringProfile.propositionLens, {
    kind: "narrative_framing",
    status: "generated_framing",
    validationStatus: "not_checked",
  });
  const summary = paragraphFromField(builder, opportunity.summary);
  const investorRelevance = paragraphFromField(
    builder,
    opportunity.investorRelevance,
  );
  sections.push(
    section(
      builder,
      index++,
      "investment_proposition",
      "Investment Proposition",
      [
        { markdown: profile.propositionLens, claimIds: [propositionClaim] },
        {
          markdown: tailoringProfile.propositionLens,
          claimIds: [tailoringClaim],
        },
        summary,
        investorRelevance,
      ],
    ),
  );

  sections.push(
    sectionFromLines(builder, index++, "the_problem", "The Problem", [
      paragraphFromField(builder, opportunity.problemStatement),
    ]),
  );
  sections.push(
    sectionFromLines(builder, index++, "the_opportunity", "The Opportunity", [
      paragraphFromField(builder, opportunity.summary),
      paragraphFromField(builder, opportunity.proposedIntervention),
    ]),
  );
  sections.push(
    sectionFromLines(builder, index++, "why_this_matters", "Why This Matters", [
      ...opportunity.expectedOutcomes.map((field) =>
        fieldLine(builder, "Expected outcome", field),
      ),
      ...opportunity.longTermImpact.map((field) =>
        fieldLine(builder, "Long-term impact", field),
      ),
      ...(opportunity.expectedOutcomes.length === 0 &&
      opportunity.longTermImpact.length === 0
        ? [
            fieldLine(builder, "Impact evidence", {
              status: "unresolved",
              confidence: "low",
              citationIds: [],
            }),
          ]
        : []),
    ]),
  );
  sections.push(
    sectionFromLines(builder, index++, "why_now", "Why Now", [
      paragraphFromField(builder, opportunity.whyNow),
    ]),
  );
  sections.push(
    sectionFromLines(
      builder,
      index++,
      "proposed_intervention",
      "Proposed Intervention",
      [paragraphFromField(builder, opportunity.proposedIntervention)],
    ),
  );
  sections.push(
    sectionFromLines(builder, index++, "investment_ask", "Investment Ask", [
      moneyLine(builder, "Total cost", opportunity.totalCost),
      moneyLine(builder, "Current funding", opportunity.currentFunding),
      moneyLine(builder, "Funding gap", opportunity.fundingGap),
      pathwayLine(
        builder,
        "Funding recipient",
        findPathway(record, "funding_recipient"),
      ),
      pathwayLine(builder, "Investment vehicle", firstResolvedPathway(record)),
    ]),
  );
  sections.push(
    sectionFromLines(builder, index++, "use_of_funds", "Use of Funds", [
      moneyLine(
        builder,
        "Use of funds",
        opportunity.fundingGap ?? opportunity.totalCost,
      ),
    ]),
  );
  sections.push(
    sectionFromLines(
      builder,
      index++,
      "expected_outcomes_and_impact",
      "Expected Outcomes and Impact",
      opportunity.expectedOutcomes.length > 0
        ? opportunity.expectedOutcomes.map((field) =>
            fieldLine(builder, "Outcome", field),
          )
        : [
            fieldLine(builder, "Expected outcomes", {
              status: "unresolved",
              confidence: "low",
              citationIds: [],
            }),
          ],
    ),
  );
  sections.push(
    sectionFromLines(
      builder,
      index++,
      "implementation_delivery_model",
      "Implementation and Delivery Model",
      [
        roleLine(
          builder,
          "Implementing organization",
          findRole(record, "implementing_organization"),
        ),
        roleLine(
          builder,
          "Delivery partner",
          findRole(record, "delivery_partner"),
        ),
        roleLine(
          builder,
          "Investment manager",
          findRole(record, "investment_manager"),
        ),
      ],
    ),
  );
  sections.push(
    sectionFromLines(
      builder,
      index++,
      "implementing_organizations",
      "Implementing Organization(s)",
      [
        roleLine(
          builder,
          "Implementing organization",
          findRole(record, "implementing_organization"),
        ),
      ],
    ),
  );
  sections.push(
    sectionFromLines(
      builder,
      index++,
      "investment_vehicle_or_funding_recipient",
      "Investment Vehicle or Funding Recipient",
      [
        pathwayLine(
          builder,
          "Funding recipient",
          findPathway(record, "funding_recipient"),
        ),
        pathwayLine(
          builder,
          "Investment vehicle",
          findPathway(record, "investment_vehicle"),
        ),
        pathwayLine(
          builder,
          "Other capital pathway",
          firstResolvedPathway(record),
        ),
      ],
    ),
  );
  sections.push(
    sectionFromLines(
      builder,
      index++,
      "risk_profile",
      "Risk Profile",
      opportunity.risks.length > 0
        ? opportunity.risks.map((risk) =>
            fieldLine(builder, risk.category, risk.rationale),
          )
        : [
            fieldLine(builder, "Risk profile", {
              status: "unresolved",
              confidence: "low",
              citationIds: [],
            }),
          ],
    ),
  );
  sections.push(
    sectionFromLines(
      builder,
      index++,
      "why_this_is_investable",
      "Why This Is Investable",
      [
        paragraphFromField(builder, opportunity.investorRelevance),
        {
          markdown:
            record.assessment?.overallRationale.value ??
            "Investability assessment has not been completed.",
          claimIds: [
            addClaim(
              builder,
              record.assessment?.overallRationale.value ??
                "Investability assessment has not been completed.",
              {
                status:
                  record.assessment?.overallRationale.status ?? "unresolved",
                kind: "derived",
                citationIds:
                  record.assessment?.overallRationale.citationIds ?? [],
              },
            ),
          ],
          warnings: record.assessment ? [] : ["Assessment is missing."],
        },
      ],
    ),
  );
  const sources = sourceList(builder);
  sections.push(
    section(builder, index++, "evidence_and_sources", "Evidence and Sources", [
      { markdown: sources.lines.join("\n"), claimIds: sources.claimIds },
    ]),
  );
  sections.push(
    section(
      builder,
      index++,
      "donor_language_and_behavioral_framing",
      "Donor Language and Behavioral Framing",
      behavioralFramingParts(builder, audienceTailoring),
    ),
  );
  sections.push(
    section(
      builder,
      index++,
      "visual_brief",
      "Visual Brief",
      visualBriefParts(builder, audienceTailoring),
    ),
  );
  const gapIds = record.assessment?.missingEvidence ?? opportunity.evidenceGaps;
  const gap = gapPart(gapIds);
  const gapClaimId = addClaim(
    builder,
    gapIds.length > 0
      ? "Evidence gaps are recorded for this draft."
      : "No evidence gaps are recorded for this draft.",
    { status: "generated_framing", kind: "narrative_framing" },
  );
  sections.push(
    section(builder, index++, "evidence_gaps", "Evidence Gaps", [
      { ...gap, claimIds: [gapClaimId] },
    ]),
  );

  return sections;
}

function renderSpotlightSections(
  builder: DraftBuilder,
  investorSegment: InvestorSegment,
  audienceTailoring: AudienceTailoring,
) {
  const { record } = builder;
  const opportunity = record.opportunity;
  const profile = getInvestorSegmentProfile(investorSegment);
  const tailoringProfile = getAudienceTailoringProfile(audienceTailoring);
  const sections: DraftSection[] = [];
  let index = 0;

  sections.push(
    sectionFromLines(
      builder,
      index++,
      "problem_statement",
      "Problem Statement",
      [paragraphFromField(builder, opportunity.problemStatement)],
    ),
  );
  sections.push(
    sectionFromLines(
      builder,
      index++,
      "proposed_activities",
      "Proposed Activities",
      [paragraphFromField(builder, opportunity.proposedIntervention)],
    ),
  );
  sections.push(
    sectionFromLines(
      builder,
      index++,
      "outputs",
      "Outputs",
      opportunity.expectedOutcomes.length > 0
        ? opportunity.expectedOutcomes.map((field) =>
            fieldLine(builder, "Output", field),
          )
        : [
            fieldLine(builder, "Outputs", {
              status: "unresolved",
              confidence: "low",
              citationIds: [],
            }),
          ],
    ),
  );
  sections.push(
    sectionFromLines(
      builder,
      index++,
      "outcomes",
      "Outcomes",
      opportunity.expectedOutcomes.length > 0
        ? opportunity.expectedOutcomes.map((field) =>
            fieldLine(builder, "Outcome", field),
          )
        : [
            fieldLine(builder, "Outcomes", {
              status: "unresolved",
              confidence: "low",
              citationIds: [],
            }),
          ],
    ),
  );
  sections.push(
    sectionFromLines(
      builder,
      index++,
      "long_term_impact",
      "Long-Term Impact",
      opportunity.longTermImpact.length > 0
        ? opportunity.longTermImpact.map((field) =>
            fieldLine(builder, "Long-term impact", field),
          )
        : [
            fieldLine(builder, "Long-term impact", {
              status: "unresolved",
              confidence: "low",
              citationIds: [],
            }),
          ],
    ),
  );
  const geographyClaim = addClaim(
    builder,
    opportunity.geographies.length > 0
      ? `Target geography: ${opportunity.geographies
          .map((geography) => geography.label)
          .join(", ")}.`
      : "Target geography is not established in the provided source materials.",
    {
      status:
        opportunity.geographies.length > 0 ? "source_provided" : "unresolved",
      citationIds: opportunity.geographies.flatMap(
        (geography) => geography.citationIds,
      ),
    },
  );
  sections.push(
    section(
      builder,
      index++,
      "target_geography_population",
      "Target Geography and Population",
      [
        {
          markdown:
            opportunity.geographies.length > 0
              ? `**Geography:** ${opportunity.geographies
                  .map(
                    (geography) =>
                      `${geography.label}${citationSuffix(
                        geography.citationIds,
                        builder.citationLabels,
                      )}`,
                  )
                  .join(", ")}`
              : "**Geography:** Not established in the provided source materials.",
          claimIds: [geographyClaim],
        },
        ...opportunity.beneficiaryPopulations.map((population) => {
          const claimId = addClaim(
            builder,
            `Beneficiary population: ${population.label}.`,
            {
              status: population.status,
              citationIds: population.citationIds,
            },
          );
          return {
            markdown: `**Population:** ${population.label}${citationSuffix(
              population.citationIds,
              builder.citationLabels,
            )}`,
            claimIds: [claimId],
          };
        }),
      ],
    ),
  );
  sections.push(
    sectionFromLines(
      builder,
      index++,
      "implementing_partners",
      "Implementing Partner(s)",
      [
        roleLine(
          builder,
          "Implementing organization",
          findRole(record, "implementing_organization"),
        ),
        roleLine(
          builder,
          "Delivery partner",
          findRole(record, "delivery_partner"),
        ),
      ],
    ),
  );
  sections.push(
    sectionFromLines(
      builder,
      index++,
      "potential_funding_recipient_or_vehicle",
      "Potential Funding Recipient or Investment Vehicle",
      [
        pathwayLine(
          builder,
          "Funding recipient",
          findPathway(record, "funding_recipient"),
        ),
        pathwayLine(
          builder,
          "Investment vehicle",
          findPathway(record, "investment_vehicle"),
        ),
      ],
    ),
  );
  sections.push(
    sectionFromLines(builder, index++, "timeline", "Timeline", [
      fieldLine(builder, "Timeline", {
        value:
          opportunity.timeline?.label ?? opportunity.timeline?.durationText,
        status: opportunity.timeline?.status ?? "unresolved",
        confidence: "medium",
        citationIds: opportunity.timeline?.citationIds ?? [],
      }),
    ]),
  );
  sections.push(
    sectionFromLines(builder, index++, "total_cost", "Total Cost", [
      moneyLine(builder, "Total cost", opportunity.totalCost),
    ]),
  );
  sections.push(
    sectionFromLines(builder, index++, "current_funding", "Current Funding", [
      moneyLine(builder, "Current funding", opportunity.currentFunding),
    ]),
  );
  sections.push(
    sectionFromLines(builder, index++, "funding_gap", "Funding Gap", [
      moneyLine(builder, "Funding gap", opportunity.fundingGap),
    ]),
  );
  for (const [sectionKey, title, riskPattern] of [
    [
      "scientific_technical_risk",
      "Scientific and Technical Risk",
      "scientific_and_technical",
    ],
    ["regulatory_risk", "Regulatory Risk", "regulatory"],
    [
      "organizational_operational_risk",
      "Organizational and Operational Risk",
      "organizational_and_operational",
    ],
    [
      "commercial_demand_risk",
      "Commercial and Demand Risk",
      "commercial_and_demand",
    ],
    [
      "reputational_stakeholder_risk",
      "Reputational and Stakeholder Risk",
      "reputational_and_stakeholder",
    ],
  ] as const) {
    const risk = opportunity.risks.find(
      (item) => item.category === riskPattern,
    );
    sections.push(
      sectionFromLines(builder, index++, sectionKey, title, [
        risk
          ? fieldLine(builder, title, risk.rationale)
          : fieldLine(builder, title, {
              status: "unresolved",
              confidence: "low",
              citationIds: [],
            }),
      ]),
    );
  }
  sections.push(
    section(builder, index++, "investor_relevance", "Investor Relevance", [
      {
        markdown: profile.propositionLens,
        claimIds: [
          addClaim(builder, profile.propositionLens, {
            kind: "narrative_framing",
            status: "generated_framing",
            validationStatus: "not_checked",
          }),
        ],
      },
      {
        markdown: tailoringProfile.propositionLens,
        claimIds: [
          addClaim(builder, tailoringProfile.propositionLens, {
            kind: "narrative_framing",
            status: "generated_framing",
            validationStatus: "not_checked",
          }),
        ],
      },
      paragraphFromField(builder, opportunity.investorRelevance),
    ]),
  );
  const sources = sourceList(builder);
  sections.push(
    section(builder, index++, "supporting_evidence", "Supporting Evidence", [
      { markdown: sources.lines.join("\n"), claimIds: sources.claimIds },
    ]),
  );
  sections.push(
    section(
      builder,
      index++,
      "donor_language_and_behavioral_framing",
      "Donor Language and Behavioral Framing",
      behavioralFramingParts(builder, audienceTailoring),
    ),
  );
  sections.push(
    section(
      builder,
      index++,
      "visual_brief",
      "Visual Brief",
      visualBriefParts(builder, audienceTailoring),
    ),
  );
  const gaps = record.assessment?.missingEvidence ?? opportunity.evidenceGaps;
  const gapClaimId = addClaim(
    builder,
    gaps.length > 0
      ? "Missing information is recorded for this opportunity."
      : "No missing information is recorded for this opportunity.",
    { status: "generated_framing", kind: "narrative_framing" },
  );
  sections.push(
    section(builder, index++, "missing_information", "Missing Information", [
      { ...gapPart(gaps), claimIds: [gapClaimId] },
    ]),
  );

  return sections;
}

function riskLines(builder: DraftBuilder) {
  const risks = builder.record.opportunity.risks;

  if (risks.length === 0) {
    return [
      fieldLine(builder, "Risk profile", {
        status: "unresolved",
        confidence: "low",
        citationIds: [],
      }),
    ];
  }

  return risks.map((risk) => fieldLine(builder, risk.category, risk.rationale));
}

function nextConversationParts(builder: DraftBuilder) {
  const gaps =
    builder.record.assessment?.missingEvidence ??
    builder.record.opportunity.evidenceGaps;
  const gap = gapPart(gaps);
  const callToAction =
    builder.prospectusBuilder.callToAction ??
    "Invite a focused diligence conversation before developing a full proposal.";
  const gapClaimId = addClaim(
    builder,
    gaps.length > 0
      ? "Open diligence questions should be resolved before donor outreach is treated as final."
      : "No open diligence questions are recorded in the current evidence model.",
    { status: "generated_framing", kind: "narrative_framing" },
  );

  return [
    generatedNote(builder, `Suggested next step: ${callToAction}`),
    generatedNote(
      builder,
      "Human review is required before treating this draft as donor-ready.",
    ),
    {
      ...gap,
      markdown: `**Open questions:**\n${gap.markdown}`,
      claimIds: [gapClaimId],
    },
  ];
}

function renderProspectusSections(
  builder: DraftBuilder,
  investorSegment: InvestorSegment,
  audienceTailoring: AudienceTailoring,
  outputType: OutputType,
) {
  const { record } = builder;
  const opportunity = record.opportunity;
  const sections: DraftSection[] = [];
  let index = 0;

  if (outputType === "donor_deck") {
    sections.push(
      section(builder, index++, "deck_strategy", "Deck Strategy", [
        ...prospectusBuilderParts(
          builder,
          investorSegment,
          audienceTailoring,
          outputType,
        ),
        generatedNote(
          builder,
          "Use this as a draft deck outline for human review; every slide claim should retain citation labels or stay marked unresolved.",
        ),
      ]),
    );
    sections.push(
      section(builder, index++, "slide_narrative", "Slide Narrative", [
        generatedNote(
          builder,
          "Slide 1: Open with the source-backed problem and donor-relevant reason to pay attention.",
        ),
        paragraphFromField(builder, opportunity.problemStatement),
        generatedNote(
          builder,
          "Slide 2: Describe the investable concept and the proposed intervention.",
        ),
        paragraphFromField(builder, opportunity.proposedIntervention),
        generatedNote(
          builder,
          "Slide 3: Explain why now, then show the path to the next donor conversation.",
        ),
        paragraphFromField(builder, opportunity.whyNow),
      ]),
    );
    sections.push(
      sectionFromLines(
        builder,
        index++,
        "opportunity_at_a_glance",
        "Opportunity at a Glance",
        [
          paragraphFromField(builder, opportunity.summary),
          ...moneySnapshotLines(builder),
          ...beneficiaryLines(builder),
        ],
      ),
    );
    sections.push(
      sectionFromLines(builder, index++, "audience_fit", "Audience Fit", [
        paragraphFromField(builder, opportunity.investorRelevance),
        ...opportunity.expectedOutcomes.map((field) =>
          fieldLine(builder, "Expected outcome", field),
        ),
      ]),
    );
    sections.push(
      evidenceSeparationSection(
        builder,
        index++,
        "evidence_and_claims",
        "Evidence and Claims",
        outputType,
      ),
    );
    sections.push(
      section(
        builder,
        index++,
        "speaker_notes_and_next_step",
        "Speaker Notes and Next Step",
        [
          ...visualBriefParts(builder, audienceTailoring),
          ...nextConversationParts(builder),
        ],
      ),
    );
  } else if (outputType === "meeting_talking_points") {
    sections.push(
      section(builder, index++, "opening_frame", "Opening Frame", [
        ...prospectusBuilderParts(
          builder,
          investorSegment,
          audienceTailoring,
          outputType,
        ),
        paragraphFromField(builder, opportunity.summary),
      ]),
    );
    sections.push(
      sectionFromLines(builder, index++, "core_points", "Core Points", [
        paragraphFromField(builder, opportunity.problemStatement),
        paragraphFromField(builder, opportunity.proposedIntervention),
        paragraphFromField(builder, opportunity.investorRelevance),
      ]),
    );
    sections.push(
      evidenceSeparationSection(
        builder,
        index++,
        "evidence_caveats",
        "Evidence Caveats",
        outputType,
      ),
    );
    sections.push(
      sectionFromLines(
        builder,
        index++,
        "questions_to_ask",
        "Questions to Ask",
        [
          ...capitalPathwayLines(builder),
          ...moneySnapshotLines(builder),
          ...riskLines(builder),
        ],
      ),
    );
    sections.push(
      section(
        builder,
        index++,
        "suggested_next_step",
        "Suggested Next Step",
        nextConversationParts(builder),
      ),
    );
  } else if (outputType === "source_appendix") {
    const sources = sourceList(builder);
    sections.push(
      section(builder, index++, "source_inventory", "Source Inventory", [
        {
          markdown: sources.lines.join("\n"),
          claimIds: sources.claimIds,
        },
      ]),
    );
    sections.push(
      sectionFromLines(builder, index++, "supported_facts", "Supported Facts", [
        ...sourceFactLines(builder),
        ...roleBoundaryLines(builder),
        ...capitalPathwayLines(builder),
        ...moneySnapshotLines(builder),
      ]),
    );
    sections.push(
      evidenceSeparationSection(
        builder,
        index++,
        "unresolved_claims",
        "Unresolved Claims",
        outputType,
      ),
    );
    sections.push(
      section(
        builder,
        index++,
        "external_use_readiness",
        "External-Use Readiness",
        [
          generatedNote(
            builder,
            "External-use readiness depends on PST review, claim support, source permissions, and reviewer approval before export.",
          ),
          ...nextConversationParts(builder),
        ],
      ),
    );
  } else if (outputType === "donor_one_pager") {
    sections.push(
      section(builder, index++, "donor_hook", "Hook", [
        ...prospectusBuilderParts(
          builder,
          investorSegment,
          audienceTailoring,
          outputType,
        ),
        paragraphFromField(builder, opportunity.summary),
      ]),
    );
    sections.push(
      sectionFromLines(builder, index++, "the_concept", "The Concept", [
        paragraphFromField(builder, opportunity.proposedIntervention),
        paragraphFromField(builder, opportunity.investorRelevance),
      ]),
    );
    sections.push(
      sectionFromLines(builder, index++, "why_now", "Why Now", [
        paragraphFromField(builder, opportunity.whyNow),
      ]),
    );
    sections.push(
      sectionFromLines(builder, index++, "funding_pathway", "Funding Pathway", [
        ...capitalPathwayLines(builder),
        ...moneySnapshotLines(builder),
      ]),
    );
    sections.push(
      evidenceSeparationSection(
        builder,
        index++,
        "evidence_guardrails",
        "Evidence Guardrails",
        outputType,
      ),
    );
    sections.push(
      section(
        builder,
        index++,
        "next_conversation",
        "Suggested Next Step",
        nextConversationParts(builder),
      ),
    );
  } else if (outputType === "concept_note") {
    sections.push(
      section(builder, index++, "concept_summary", "Concept Summary", [
        ...prospectusBuilderParts(
          builder,
          investorSegment,
          audienceTailoring,
          outputType,
        ),
        paragraphFromField(builder, opportunity.summary),
      ]),
    );
    sections.push(
      sectionFromLines(
        builder,
        index++,
        "source_backed_need",
        "Source-Backed Need",
        [
          paragraphFromField(builder, opportunity.problemStatement),
          paragraphFromField(builder, opportunity.whyNow),
        ],
      ),
    );
    sections.push(
      sectionFromLines(
        builder,
        index++,
        "proposed_approach",
        "Proposed Approach",
        [
          paragraphFromField(builder, opportunity.proposedIntervention),
          ...opportunity.expectedOutcomes.map((field) =>
            fieldLine(builder, "Expected outcome", field),
          ),
        ],
      ),
    );
    sections.push(
      sectionFromLines(
        builder,
        index++,
        "roles_and_funding_pathway",
        "Roles and Funding Pathway",
        [
          ...roleBoundaryLines(builder),
          ...capitalPathwayLines(builder),
          ...beneficiaryLines(builder),
        ],
      ),
    );
    sections.push(
      evidenceSeparationSection(
        builder,
        index++,
        "evidence_gaps",
        "Evidence Gaps",
        outputType,
      ),
    );
    sections.push(
      section(
        builder,
        index++,
        "review_needs",
        "Human Review Needs",
        nextConversationParts(builder),
      ),
    );
  } else if (outputType === "board_brief") {
    sections.push(
      section(builder, index++, "decision_context", "Decision Context", [
        ...prospectusBuilderParts(
          builder,
          investorSegment,
          audienceTailoring,
          outputType,
        ),
        paragraphFromField(builder, opportunity.summary),
      ]),
    );
    sections.push(
      sectionFromLines(
        builder,
        index++,
        "investment_thesis",
        "Investment Thesis",
        [
          paragraphFromField(builder, opportunity.investorRelevance),
          paragraphFromField(builder, opportunity.whyNow),
        ],
      ),
    );
    sections.push(
      evidenceSeparationSection(
        builder,
        index++,
        "evidence_base",
        "Evidence Base",
        outputType,
      ),
    );
    sections.push(
      sectionFromLines(
        builder,
        index++,
        "risks_and_open_issues",
        "Risks and Open Issues",
        [...riskLines(builder)],
      ),
    );
    sections.push(
      sectionFromLines(
        builder,
        index++,
        "role_capital_clarity",
        "Role and Capital-Pathway Clarity",
        [
          ...roleBoundaryLines(builder),
          ...capitalPathwayLines(builder),
          ...moneySnapshotLines(builder),
        ],
      ),
    );
    sections.push(
      section(
        builder,
        index++,
        "recommended_discussion",
        "Recommended Discussion",
        nextConversationParts(builder),
      ),
    );
  } else if (outputType === "hnwi_donor_teaser") {
    sections.push(
      section(builder, index++, "donor_hook", "Human Hook", [
        ...prospectusBuilderParts(
          builder,
          investorSegment,
          audienceTailoring,
          outputType,
        ),
        paragraphFromField(builder, opportunity.problemStatement),
      ]),
    );
    sections.push(
      sectionFromLines(builder, index++, "the_opportunity", "The Opportunity", [
        paragraphFromField(builder, opportunity.summary),
        paragraphFromField(builder, opportunity.proposedIntervention),
      ]),
    );
    sections.push(
      sectionFromLines(
        builder,
        index++,
        "why_this_donor_could_matter",
        "Why This Donor Could Matter",
        [
          paragraphFromField(builder, opportunity.investorRelevance),
          paragraphFromField(builder, opportunity.whyNow),
        ],
      ),
    );
    sections.push(
      evidenceSeparationSection(
        builder,
        index++,
        "what_is_known",
        "What Is Known",
        outputType,
      ),
    );
    sections.push(
      sectionFromLines(
        builder,
        index++,
        "what_remains_unresolved",
        "What Remains Unresolved",
        [...capitalPathwayLines(builder), ...moneySnapshotLines(builder)],
      ),
    );
    sections.push(
      section(
        builder,
        index++,
        "donor_invitation",
        "Invitation",
        nextConversationParts(builder),
      ),
    );
  } else {
    sections.push(
      section(builder, index++, "interest_thesis", "Interest Thesis", [
        ...prospectusBuilderParts(
          builder,
          investorSegment,
          audienceTailoring,
          outputType,
        ),
        paragraphFromField(builder, opportunity.summary),
        paragraphFromField(builder, opportunity.whyNow),
      ]),
    );
    sections.push(
      sectionFromLines(
        builder,
        index++,
        "investable_concept",
        "Investable Concept",
        [
          paragraphFromField(builder, opportunity.problemStatement),
          paragraphFromField(builder, opportunity.proposedIntervention),
          paragraphFromField(builder, opportunity.investorRelevance),
        ],
      ),
    );
    sections.push(
      sectionFromLines(
        builder,
        index++,
        "why_this_fits_the_audience",
        "Why This Fits the Audience",
        [
          ...opportunity.expectedOutcomes.map((field) =>
            fieldLine(builder, "Expected outcome", field),
          ),
          ...(opportunity.expectedOutcomes.length === 0
            ? [
                fieldLine(builder, "Expected outcomes", {
                  status: "unresolved",
                  confidence: "low",
                  citationIds: [],
                }),
              ]
            : []),
        ],
      ),
    );
    sections.push(
      sectionFromLines(
        builder,
        index++,
        "prospectus_snapshot",
        "Prospectus Snapshot",
        [
          ...roleBoundaryLines(builder),
          ...capitalPathwayLines(builder),
          ...moneySnapshotLines(builder),
          ...beneficiaryLines(builder),
        ],
      ),
    );
    sections.push(
      evidenceSeparationSection(
        builder,
        index++,
        "evidence_and_open_questions",
        "Evidence and Open Questions",
        outputType,
      ),
    );
    sections.push(
      section(
        builder,
        index++,
        "next_conversation",
        "Next Conversation",
        nextConversationParts(builder),
      ),
    );
  }

  const sources = sourceList(builder);
  sections.push(
    section(builder, index++, "evidence_and_sources", "Evidence and Sources", [
      { markdown: sources.lines.join("\n"), claimIds: sources.claimIds },
    ]),
  );

  return sections;
}

export function renderDraft(
  record: OpportunityRecord,
  citations: Citation[],
  options: RenderOptions,
): ValidatedDraft {
  const draftId = options.draftId ?? randomUUID();
  const audienceTailoring = normalizeAudienceTailoring(
    options.audienceTailoring,
  );
  const prospectusBuilder = normalizeProspectusBuilder(
    options.prospectusBuilder,
  );
  const tailoringProfile = getAudienceTailoringProfile(audienceTailoring);
  const formatProfile = getOutputFormatProfile(options.outputType);
  const builder: DraftBuilder = {
    draftId,
    record,
    citations,
    prospectusBuilder,
    citationLabels: makeCitationLabels(citations),
    claims: [],
    claimIdsByText: new Map(),
  };
  const sections =
    options.outputType === "executive_investment_case"
      ? renderExecutiveSections(
          builder,
          options.investorSegment,
          audienceTailoring,
        )
      : options.outputType === "opportunity_spotlight"
        ? renderSpotlightSections(
            builder,
            options.investorSegment,
            audienceTailoring,
          )
        : renderProspectusSections(
            builder,
            options.investorSegment,
            audienceTailoring,
            options.outputType,
          );
  const audienceProfile = getInvestorSegmentProfile(options.investorSegment);
  const variantLabel = formatVariantLabel({
    outputType: options.outputType,
    audienceLabel: audienceProfile.label,
    prospectusBuilder,
  });
  let draft = ValidatedDraftSchema.parse({
    id: draftId,
    opportunityId: record.opportunity.id,
    outputType: options.outputType,
    investorSegment: options.investorSegment,
    audienceTailoring,
    prospectusBuilder,
    variant: {
      label: variantLabel,
      formatLabel: formatProfile.label,
      audienceProfileLabel: audienceProfile.label,
      narrativeAngle: prospectusBuilder.narrativeAngle,
      createdAtIso: new Date().toISOString(),
    },
    title: record.title,
    sectionOrder: sections.map((item) => item.sectionKey),
    sections,
    claims: builder.claims,
    citations,
    evidenceGaps:
      record.assessment?.missingEvidence ?? record.opportunity.evidenceGaps,
    narrativeChanges: [
      `Audience tailoring applied: ${tailoringProfile.label}.`,
    ],
    generatedAtIso: new Date().toISOString(),
    draftNotice: "Draft for human review",
  });

  if (options.strengthenNarrative ?? true) {
    draft = strengthenDraftNarrative(
      draft,
      options.investorSegment,
      audienceTailoring,
      prospectusBuilder,
    );
  }

  const validation = validateDraftClaims(draft);
  draft = ValidatedDraftSchema.parse({
    ...draft,
    validation,
  });
  const productQualityEvaluation = evaluateDraftQuality(draft);

  return ValidatedDraftSchema.parse({
    ...draft,
    productQualityEvaluation,
  });
}

export function renderDraftMarkdown(draft: ValidatedDraft) {
  const sections = draft.sections
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((section) => `## ${section.title}\n\n${section.renderedMarkdown}`)
    .join("\n\n");
  const variant = draft.variant
    ? [
        `Format: ${draft.variant.formatLabel}`,
        `Audience: ${draft.variant.audienceProfileLabel}`,
        `Variant: ${draft.variant.label}`,
      ].join("\n")
    : undefined;

  return [`# ${draft.title}`, `_${draft.draftNotice}_`, variant, sections]
    .filter(Boolean)
    .join("\n\n");
}

export function regenerateDraftSection(
  draft: ValidatedDraft,
  record: OpportunityRecord,
  citations: Citation[],
  sectionKey: string,
): ValidatedDraft {
  const regenerated = renderDraft(record, citations, {
    draftId: draft.id,
    outputType: draft.outputType,
    investorSegment: draft.investorSegment,
    audienceTailoring: draft.audienceTailoring,
    prospectusBuilder: draft.prospectusBuilder,
    strengthenNarrative: true,
  });
  const existing = draft.sections.find(
    (section) => section.sectionKey === sectionKey,
  );
  const sections = regenerated.sections.map((section) =>
    section.sectionKey === sectionKey
      ? {
          ...section,
          id: existing?.id ?? section.id,
          regenerationCount: (existing?.regenerationCount ?? 0) + 1,
          lastRegeneratedAtIso: new Date().toISOString(),
        }
      : (draft.sections.find(
          (current) => current.sectionKey === section.sectionKey,
        ) ?? section),
  );
  const validation = validateDraftClaims({ ...regenerated, sections });
  const productQualityEvaluation = evaluateDraftQuality({
    ...regenerated,
    sections,
    validation,
  });

  return ValidatedDraftSchema.parse({
    ...regenerated,
    sections,
    validation,
    productQualityEvaluation,
    variant: draft.variant,
    narrativeChanges: unique([
      ...draft.narrativeChanges,
      ...regenerated.narrativeChanges,
      `Regenerated section: ${sectionKey}.`,
    ]),
  });
}
