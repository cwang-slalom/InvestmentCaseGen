from pydantic import Field

from .base import APIModel


class AudienceProfile(APIModel):
    id: str
    name: str
    audience_type: str = Field(alias="audienceType")
    relationship_stage: str = Field(alias="relationshipStage")
    interests: list[str]
    geography: str
    familiarity: str
    donor_persona: str = Field(alias="donorPersona")
    technical_familiarity: str = Field(alias="technicalFamiliarity")
    narrative_approach: str = Field(alias="narrativeApproach")
    profile_url: str = Field(alias="profileUrl")
