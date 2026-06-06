from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Project, ProjectMember, User
from app.schemas import Role
from app.security import decode_access_token

bearer_scheme = HTTPBearer(auto_error=False)

# Role ordering for permission checks (higher index == more power).
_ROLE_RANK: dict[str, int] = {"viewer": 0, "editor": 1, "owner": 2}


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None or not credentials.credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="未提供认证令牌")
    user_id = decode_access_token(credentials.credentials)
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="令牌无效或已过期")
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="用户不存在")
    return user


def role_for(db: Session, project: Project, user: User) -> Role | None:
    """Return the user's effective role on a project, or None if no access."""
    if project.owner_id == user.id:
        return "owner"
    member = db.scalar(
        select(ProjectMember).where(
            ProjectMember.project_id == project.id, ProjectMember.user_id == user.id
        )
    )
    return member.role if member else None  # type: ignore[return-value]


def require_project(
    project_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    min_role: Role = "viewer",
) -> tuple[Project, Role]:
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="项目不存在")
    role = role_for(db, project, user)
    if role is None or _ROLE_RANK[role] < _ROLE_RANK[min_role]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权访问该项目")
    return project, role


def require_role(min_role: Role):
    """Dependency factory enforcing a minimum role on the path's project_id."""

    def _dep(
        project_id: int,
        db: Session = Depends(get_db),
        user: User = Depends(get_current_user),
    ) -> tuple[Project, Role]:
        return require_project(project_id, db=db, user=user, min_role=min_role)

    return _dep
