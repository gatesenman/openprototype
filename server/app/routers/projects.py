from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_project, role_for
from app.models import DocumentVersion, Project, ProjectMember, User
from app.schemas import (
    DocumentUpdate,
    ProjectCreate,
    ProjectDetail,
    ProjectSummary,
    ProjectUpdate,
    VersionOut,
)

router = APIRouter(prefix="/api/projects", tags=["projects"])


def _summary(project: Project, role: str) -> ProjectSummary:
    return ProjectSummary(
        id=project.id,
        name=project.name,
        owner_id=project.owner_id,
        role=role,  # type: ignore[arg-type]
        updated_at=project.updated_at,
    )


@router.get("", response_model=list[ProjectSummary])
def list_projects(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> list[ProjectSummary]:
    owned = db.scalars(select(Project).where(Project.owner_id == user.id)).all()
    shared_rows = db.execute(
        select(Project, ProjectMember.role)
        .join(ProjectMember, ProjectMember.project_id == Project.id)
        .where(ProjectMember.user_id == user.id)
    ).all()
    out = [_summary(p, "owner") for p in owned]
    out.extend(_summary(p, role) for p, role in shared_rows)
    out.sort(key=lambda s: s.updated_at, reverse=True)
    return out


@router.post("", response_model=ProjectDetail, status_code=status.HTTP_201_CREATED)
def create_project(
    body: ProjectCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> ProjectDetail:
    project = Project(name=body.name, owner_id=user.id, document=body.document)
    db.add(project)
    db.commit()
    db.refresh(project)
    return ProjectDetail(
        id=project.id,
        name=project.name,
        owner_id=project.owner_id,
        role="owner",
        updated_at=project.updated_at,
        document=project.document,
    )


@router.get("/{project_id}", response_model=ProjectDetail)
def get_project(ctx: tuple[Project, str] = Depends(require_project)) -> ProjectDetail:
    project, role = ctx
    return ProjectDetail(
        id=project.id,
        name=project.name,
        owner_id=project.owner_id,
        role=role,  # type: ignore[arg-type]
        updated_at=project.updated_at,
        document=project.document,
    )


@router.patch("/{project_id}", response_model=ProjectSummary)
def update_project(
    project_id: int,
    body: ProjectUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ProjectSummary:
    project, role = require_project(project_id, db=db, user=user, min_role="editor")
    if body.name is not None:
        project.name = body.name
    db.commit()
    db.refresh(project)
    return _summary(project, role)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> None:
    project, _ = require_project(project_id, db=db, user=user, min_role="owner")
    db.delete(project)
    db.commit()


@router.put("/{project_id}/document", response_model=ProjectDetail)
def save_document(
    project_id: int,
    body: DocumentUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ProjectDetail:
    project, role = require_project(project_id, db=db, user=user, min_role="editor")
    project.document = body.document
    db.add(
        DocumentVersion(
            project_id=project.id,
            author_id=user.id,
            document=body.document,
            message=body.message,
        )
    )
    db.commit()
    db.refresh(project)
    return ProjectDetail(
        id=project.id,
        name=project.name,
        owner_id=project.owner_id,
        role=role,  # type: ignore[arg-type]
        updated_at=project.updated_at,
        document=project.document,
    )


@router.get("/{project_id}/versions", response_model=list[VersionOut])
def list_versions(
    project_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> list[DocumentVersion]:
    require_project(project_id, db=db, user=user, min_role="viewer")
    return list(
        db.scalars(
            select(DocumentVersion)
            .where(DocumentVersion.project_id == project_id)
            .order_by(DocumentVersion.id.desc())
        ).all()
    )


@router.post("/{project_id}/versions/{version_id}/restore", response_model=ProjectDetail)
def restore_version(
    project_id: int,
    version_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ProjectDetail:
    project, role = require_project(project_id, db=db, user=user, min_role="editor")
    version = db.get(DocumentVersion, version_id)
    if version is None or version.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="版本不存在")
    project.document = version.document
    db.add(
        DocumentVersion(
            project_id=project.id,
            author_id=user.id,
            document=version.document,
            message=f"恢复到版本 #{version_id}",
        )
    )
    db.commit()
    db.refresh(project)
    return ProjectDetail(
        id=project.id,
        name=project.name,
        owner_id=project.owner_id,
        role=role,  # type: ignore[arg-type]
        updated_at=project.updated_at,
        document=project.document,
    )
