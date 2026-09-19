"""Pydantic 模型：request / response 驗證"""
from typing import Generic, TypeVar
from urllib.parse import urlparse

from pydantic import BaseModel, Field, field_validator

T = TypeVar("T")

# 個人資料技能標籤的上限
MAX_SKILLS = 12
MAX_SKILL_LENGTH = 20


class ApiResponse(BaseModel, Generic[T]):
    """統一回傳格式"""
    success: bool
    data: T | None = None
    message: str


# ---------- 認證 ----------
class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=50)
    # bcrypt 只處理前 72 bytes，超過的密碼直接拒絕
    password: str = Field(min_length=1, max_length=72)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ---------- 作品 ----------
class ProjectCreate(BaseModel):
    """新增／更新作品的 request body（上傳檔案走另一個端點，不在這裡）"""
    title: str = Field(min_length=1, max_length=100)
    description: str = Field(default="", max_length=2000)
    link_url: str = Field(default="", max_length=500)

    @field_validator("link_url")
    @classmethod
    def check_link_url(cls, value: str) -> str:
        """連結可以留空；有填就必須是 http / https 網址（擋掉 javascript: 之類的危險網址）"""
        value = value.strip()
        if not value:
            return ""
        parsed = urlparse(value)
        if parsed.scheme not in ("http", "https") or not parsed.netloc or any(ch.isspace() for ch in value):
            raise ValueError("連結必須是 http:// 或 https:// 開頭的有效網址")
        return value


class ProjectResponse(BaseModel):
    """作品的 response（包含資料庫產生的欄位）"""
    id: int
    title: str
    description: str
    link_url: str
    file_name: str   # 上傳檔案的原始檔名，沒有檔案為空字串
    file_size: int   # 位元組數，沒有檔案為 0
    file_url: str    # 下載路徑（例如 /api/projects/1/file），沒有檔案為空字串
    created_at: str


# ---------- 留言 ----------
class MessageCreate(BaseModel):
    """訪客送出留言的 request body"""
    name: str = Field(min_length=1, max_length=50)
    email: str = Field(min_length=3, max_length=100, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    content: str = Field(min_length=1, max_length=2000)


class MessageResponse(BaseModel):
    """留言的 response"""
    id: int
    name: str
    email: str
    content: str
    created_at: str


# ---------- 個人資料 ----------
class ProfileUpdate(BaseModel):
    """更新個人資料的 request body"""
    display_name: str = Field(min_length=1, max_length=50)
    job_title: str = Field(min_length=1, max_length=50)
    location: str = Field(default="", max_length=50)
    bio: str = Field(default="", max_length=500)
    skills: list[str] = Field(default_factory=list, max_length=MAX_SKILLS)

    @field_validator("skills")
    @classmethod
    def clean_skills(cls, skills: list[str]) -> list[str]:
        """去除空白與空標籤，並限制每個標籤的長度"""
        cleaned = [skill.strip() for skill in skills if skill.strip()]
        if any(len(skill) > MAX_SKILL_LENGTH for skill in cleaned):
            raise ValueError(f"每個技能標籤最多 {MAX_SKILL_LENGTH} 字")
        return cleaned


class ProfileResponse(BaseModel):
    """個人資料的 response"""
    display_name: str
    job_title: str
    location: str
    bio: str
    skills: list[str]
    avatar_url: str  # 大頭貼路徑（例如 /uploads/avatars/xxx.png），沒有大頭貼為空字串
    updated_at: str
