from typing import Literal
from pydantic import BaseModel, Field, ConfigDict, field_validator

KINDS = ['pdf']

class Criterion(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    name: str = Field(min_length=1, max_length=100)
    description: str = Field(min_length=1, max_length=2000)
    weight: int = Field(default=1, ge=1, le=10)

class Profile(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    name: str = Field(min_length=1, max_length=120)
    category: Literal['Resume', 'Document', 'Image', 'Custom'] = 'Resume'
    description: str = Field(min_length=1, max_length=20000)
    input_label: str = Field(default='Resume', min_length=1, max_length=60)
    accepted_types: list[str] = Field(default_factory=lambda: ['pdf'], min_length=1)
    criteria: list[Criterion] = Field(min_length=1, max_length=20)

    @field_validator('accepted_types')
    @classmethod
    def valid_types(cls, value):
        if any(x not in KINDS for x in value):
            raise ValueError('Unsupported file type')
        return list(dict.fromkeys(value))

class Settings(BaseModel):
    api_key: str = Field(min_length=1, max_length=1000)

class RoutingOption(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    name: str = Field(min_length=1, max_length=60)
    description: str = Field(min_length=1, max_length=500)
    # A hard disqualifier beats the weighted score: a well-funded, perfectly
    # staffed lead you cannot sell to is not a warm lead.
    disqualifying: bool = False

class LeadProfile(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    name: str = Field(min_length=1, max_length=120)
    icp_description: str = Field(min_length=1, max_length=20000)
    criteria: list[Criterion] = Field(min_length=1, max_length=20)
    industry_levels: list[str] = Field(min_length=2, max_length=10)
    maturity_levels: list[str] = Field(min_length=2, max_length=10)
    intent_levels: list[str] = Field(min_length=2, max_length=10)
    routing: list[RoutingOption] = Field(min_length=2, max_length=8)

    @field_validator('industry_levels', 'maturity_levels', 'intent_levels')
    @classmethod
    def valid_levels(cls, value):
        cleaned = [v.strip() for v in value]
        if any(not v or len(v) > 300 for v in cleaned):
            raise ValueError('Each level needs a short, non-empty description.')
        return cleaned
