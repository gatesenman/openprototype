from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_project
from app.models import Project, ProjectMember, User
from app.schemas import MemberInvite, MemberOut

router = APIRouter(prefix="/api/projects", tags=["collaboration"])


def _members_payload(db: Session, project: Project) -> list[MemberOut]:
    owner = db.get(User, project.owner_id)
    out: list[MemberOut] = []
    if owner is not None:
        out.append(MemberOut(user_id=owner.id, email=owner.email, name=owner.name, role="owner"))
    rows = db.execute(
        select(ProjectMember, User)
        .join(User, User.id == ProjectMember.user_id)
        .where(ProjectMember.project_id == project.id)
    ).all()
    for member, user in rows:
        out.append(
            MemberOut(user_id=user.id, email=user.email, name=user.name, role=member.role)  # type: ignore[arg-type]
        )
    return out


@router.get("/{project_id}/members", response_model=list[MemberOut])
def list_members(
    project_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> list[MemberOut]:
    project, _ = require_project(project_id, db=db, user=user, min_role="viewer")
    return _members_payload(db, project)


@router.post("/{project_id}/members", response_model=list[MemberOut], status_code=status.HTTP_201_CREATED)
def invite_member(
    project_id: int,
    body: MemberInvite,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[MemberOut]:
    project, _ = require_project(project_id, db=db, user=user, min_role="owner")
    if body.role == "owner":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="不能再指派 owner")
    invitee = db.scalar(select(User).where(User.email == body.email.lower()))
    if invitee is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="该邮箱用户尚未注册")
    if invitee.id == project.owner_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="该用户已是项目所有者")
    existing = db.scalar(
        select(ProjectMember).where(
            ProjectMember.project_id == project.id, ProjectMember.user_id == invitee.id
        )
    )
    if existing is not None:
        existing.role = body.role
    else:
        db.add(ProjectMember(project_id=project.id, user_id=invitee.id, role=body.role))
    db.commit()
    return _members_payload(db, project)


@router.delete("/{project_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(
    project_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    project, _ = require_project(project_id, db=db, user=user, min_role="owner")
    member = db.scalar(
        select(ProjectMember).where(
            ProjectMember.project_id == project.id, ProjectMember.user_id == user_id
        )
    )
    if member is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="成员不存在")
    db.delete(member)
    db.commit()
