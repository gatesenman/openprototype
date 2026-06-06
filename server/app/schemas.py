from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

Role = Literal["owner", "editor", "viewer"]


# ---- auth ----
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=200)
    name: str = Field(default="", max_length=120)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    name: str
    created_at: datetime


# ---- projects ----
class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    document: dict[str, Any] = Field(default_factory=dict)


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)


class DocumentUpdate(BaseModel):
    document: dict[str, Any]
    message: str = Field(default="", max_length=280)


class ProjectSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    owner_id: int
    role: Role
    updated_at: datetime


class ProjectDetail(ProjectSummary):
    document: dict[str, Any]


# ---- collaboration ----
class MemberInvite(BaseModel):
    email: EmailStr
    role: Role = "viewer"


class MemberOut(BaseModel):
    user_id: int
    email: EmailStr
    name: str
    role: Role


class VersionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    author_id: int | None
    message: str
    created_at: datetime
