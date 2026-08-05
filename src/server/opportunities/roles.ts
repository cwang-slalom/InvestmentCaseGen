import { randomUUID } from "node:crypto";

import type {
  EvidenceGap,
  FundingPathway,
  FundingPathwayType,
  Opportunity,
  OrganizationRole,
  OrganizationRoleType,
  SourceChunk,
} from "@/domain";

type RolePattern = {
  roleType: OrganizationRoleType;
  patterns: RegExp[];
};

type PathwayPattern = {
  pathwayType: FundingPathwayType;
  patterns: RegExp[];
};

const organizationNamePattern = "([A-Z][A-Za-z0-9&.,'() -]{2,90})";

const rolePatterns: RolePattern[] = [
  {
    roleType: "concept_owner",
    patterns: [
      new RegExp(`concept owner(?: is|:)?\\s+${organizationNamePattern}`, "i"),
      new RegExp(`owned by\\s+${organizationNamePattern}`, "i"),
    ],
  },
  {
    roleType: "sponsoring_team",
    patterns: [
      new RegExp(
        `sponsoring team(?: is|:)?\\s+${organizationNamePattern}`,
        "i",
      ),
      new RegExp(`sponsored by\\s+${organizationNamePattern}`, "i"),
    ],
  },
  {
    roleType: "implementing_organization",
    patterns: [
      new RegExp(
        `implementing organization(?: is|:)?\\s+${organizationNamePattern}`,
        "i",
      ),
      new RegExp(`implemented by\\s+${organizationNamePattern}`, "i"),
    ],
  },
  {
    roleType: "delivery_partner",
    patterns: [
      new RegExp(
        `delivery partner(?: is|:)?\\s+${organizationNamePattern}`,
        "i",
      ),
      new RegExp(`delivered by\\s+${organizationNamePattern}`, "i"),
    ],
  },
  {
    roleType: "investment_manager",
    patterns: [
      new RegExp(
        `investment manager(?: is|:)?\\s+${organizationNamePattern}`,
        "i",
      ),
      new RegExp(`fund manager(?: is|:)?\\s+${organizationNamePattern}`, "i"),
      new RegExp(`managed by\\s+${organizationNamePattern}`, "i"),
      new RegExp(
        `funds? (?:will|would|should|can) be managed by\\s+${organizationNamePattern}`,
        "i",
      ),
    ],
  },
  {
    roleType: "fiscal_sponsor",
    patterns: [
      new RegExp(`fiscal sponsor(?: is|:)?\\s+${organizationNamePattern}`, "i"),
      new RegExp(`fiscally sponsored by\\s+${organizationNamePattern}`, "i"),
    ],
  },
];

const pathwayPatterns: PathwayPattern[] = [
  {
    pathwayType: "funding_recipient",
    patterns: [
      new RegExp(
        `funding recipient(?: is|:)?\\s+${organizationNamePattern}`,
        "i",
      ),
      new RegExp(
        `grant recipient(?: is|:)?\\s+${organizationNamePattern}`,
        "i",
      ),
      new RegExp(
        `funds? (?:will|would|should|can) be (?:received by|provided to|granted to)\\s+${organizationNamePattern}`,
        "i",
      ),
      new RegExp(
        `funds? (?:will|would|should|can) flow to\\s+${organizationNamePattern}`,
        "i",
      ),
    ],
  },
  {
    pathwayType: "investment_vehicle",
    patterns: [
      new RegExp(
        `investment vehicle(?: is|:)?\\s+${organizationNamePattern}`,
        "i",
      ),
      new RegExp(
        `financing vehicle(?: is|:)?\\s+${organizationNamePattern}`,
        "i",
      ),
    ],
  },
  {
    pathwayType: "pooled_fund",
    patterns: [
      new RegExp(`pooled fund(?: is|:)?\\s+${organizationNamePattern}`, "i"),
      new RegExp(
        `fund would be managed through\\s+${organizationNamePattern}`,
        "i",
      ),
    ],
  },
  {
    pathwayType: "government_program",
    patterns: [
      new RegExp(
        `government program(?: is|:)?\\s+${organizationNamePattern}`,
        "i",
      ),
    ],
  },
  {
    pathwayType: "research_program",
    patterns: [
      new RegExp(
        `research program(?: is|:)?\\s+${organizationNamePattern}`,
        "i",
      ),
    ],
  },
  {
    pathwayType: "nonprofit",
    patterns: [
      new RegExp(
        `nonprofit(?: organization)?(?: is|:)?\\s+${organizationNamePattern}`,
        "i",
      ),
    ],
  },
  {
    pathwayType: "research_institution",
    patterns: [
      new RegExp(
        `research institution(?: is|:)?\\s+${organizationNamePattern}`,
        "i",
      ),
    ],
  },
  {
    pathwayType: "product_developer",
    patterns: [
      new RegExp(
        `product developer(?: is|:)?\\s+${organizationNamePattern}`,
        "i",
      ),
    ],
  },
  {
    pathwayType: "fiscal_sponsor_vehicle",
    patterns: [
      new RegExp(`fiscal sponsor(?: is|:)?\\s+${organizationNamePattern}`, "i"),
    ],
  },
  {
    pathwayType: "other_vehicle",
    patterns: [
      new RegExp(`other vehicle(?: is|:)?\\s+${organizationNamePattern}`, "i"),
    ],
  },
];

function cleanName(value: string) {
  return value
    .replace(/[.;]\s+[\s\S]*$/, "")
    .replace(/[.;:,]+$/, "")
    .replace(/\s+(?:to|for|with)\s.*$/i, "")
    .trim();
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

function unresolvedPathway(): FundingPathway {
  return {
    id: randomUUID(),
    pathwayType: "unresolved_pathway",
    status: "unresolved",
    confidence: "low",
    citationIds: [],
    note: "Not established in the provided source materials.",
  };
}

export function detectOrganizationRoles(chunks: SourceChunk[]) {
  const detections = new Map<string, OrganizationRole>();

  for (const chunk of chunks) {
    for (const rolePattern of rolePatterns) {
      for (const pattern of rolePattern.patterns) {
        const match = chunk.text.match(pattern);
        const name = match?.[1] ? cleanName(match[1]) : undefined;
        if (!name) {
          continue;
        }

        const key = `${rolePattern.roleType}:${name.toLowerCase()}`;
        if (detections.has(key)) {
          continue;
        }

        detections.set(key, {
          id: randomUUID(),
          organizationName: name,
          roleType: rolePattern.roleType,
          status: "source_provided",
          confidence: "medium",
          citationIds: [chunk.citation.id],
          note: "Detected from explicit source wording.",
        });
      }
    }
  }

  return Array.from(detections.values());
}

export function detectFundingPathways(chunks: SourceChunk[]) {
  const detections = new Map<string, FundingPathway>();

  for (const chunk of chunks) {
    for (const pathwayPattern of pathwayPatterns) {
      for (const pattern of pathwayPattern.patterns) {
        const match = chunk.text.match(pattern);
        const name = match?.[1] ? cleanName(match[1]) : undefined;
        if (!name) {
          continue;
        }

        const key = `${pathwayPattern.pathwayType}:${name.toLowerCase()}`;
        if (detections.has(key)) {
          continue;
        }

        detections.set(key, {
          id: randomUUID(),
          pathwayType: pathwayPattern.pathwayType,
          name,
          status: "source_provided",
          confidence: "medium",
          citationIds: [chunk.citation.id],
          note: "Detected from explicit source wording.",
        });
      }
    }
  }

  return Array.from(detections.values());
}

export function enrichOpportunityRolesAndPathways(
  opportunity: Opportunity,
  chunks: SourceChunk[],
): Opportunity {
  const organizationRoles = detectOrganizationRoles(chunks);
  const detectedFundingPathways = detectFundingPathways(chunks);
  const fundingPathways =
    detectedFundingPathways.length > 0
      ? detectedFundingPathways
      : [unresolvedPathway()];

  const evidenceGaps = opportunity.evidenceGaps.filter(
    (gap) =>
      detectedFundingPathways.length > 0 || gap.fieldKey !== "funding_pathway",
  );

  if (detectedFundingPathways.length === 0) {
    evidenceGaps.push(
      evidenceGap(
        "funding_pathway",
        "Funding recipient or investment vehicle is not established in the provided source materials.",
      ),
    );
  }

  const roleTypes = new Set(organizationRoles.map((role) => role.roleType));
  for (const requiredRole of [
    "concept_owner",
    "sponsoring_team",
    "implementing_organization",
    "delivery_partner",
    "investment_manager",
    "fiscal_sponsor",
  ] as OrganizationRoleType[]) {
    if (!roleTypes.has(requiredRole)) {
      evidenceGaps.push(
        evidenceGap(
          `organization_role.${requiredRole}`,
          `${requiredRole.replaceAll("_", " ")} is not established in the provided source materials.`,
        ),
      );
    }
  }

  return {
    ...opportunity,
    organizationRoles,
    fundingPathways,
    evidenceGaps,
  };
}
