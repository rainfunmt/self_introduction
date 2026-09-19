"""檔案上傳工具：驗證類型與大小、以隨機檔名儲存、安全刪除

安全原則：
1. 不信任使用者給的檔名：儲存用隨機檔名，原始檔名只當作顯示用途（並去掉路徑）。
2. 副檔名必須在白名單內，而且檔案開頭的真實內容（簽章）要與副檔名相符。
3. 大小有上限，超過就中斷並刪除已寫入的部分。
4. 不接受 SVG（可夾帶腳本）與可執行檔。
"""
import logging
import re
import uuid
from pathlib import Path
from typing import NamedTuple

from fastapi import HTTPException, UploadFile, status

logger = logging.getLogger(__name__)

# 上傳檔案放在 backend/uploads/；只有 avatars/ 會以靜態檔案公開，作品檔案要走 API 下載
UPLOAD_DIR = Path(__file__).resolve().parent / "uploads"
AVATAR_DIR = UPLOAD_DIR / "avatars"
PROJECT_FILE_DIR = UPLOAD_DIR / "project-files"

MAX_AVATAR_BYTES = 2 * 1024 * 1024
MAX_PROJECT_FILE_BYTES = 10 * 1024 * 1024

# 副檔名白名單
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp"}
PROJECT_FILE_EXTENSIONS = IMAGE_EXTENSIONS | {".pdf", ".zip", ".docx", ".pptx", ".xlsx"}

# 各副檔名對應的檔案開頭簽章（Office 檔案本質是 zip，簽章相同）
ZIP_SIGNATURE = b"PK\x03\x04"
SIGNATURES = {
    ".png": (b"\x89PNG\r\n\x1a\n",),
    ".jpg": (b"\xff\xd8\xff",),
    ".jpeg": (b"\xff\xd8\xff",),
    ".gif": (b"GIF87a", b"GIF89a"),
    ".pdf": (b"%PDF-",),
    ".zip": (ZIP_SIGNATURE,),
    ".docx": (ZIP_SIGNATURE,),
    ".pptx": (ZIP_SIGNATURE,),
    ".xlsx": (ZIP_SIGNATURE,),
}

CHUNK_SIZE = 64 * 1024
HEAD_SIZE = 16
MAX_ORIGINAL_NAME_LENGTH = 100


class SavedFile(NamedTuple):
    """儲存完成的檔案資訊"""
    stored_name: str    # 磁碟上的隨機檔名
    original_name: str  # 顯示用的原始檔名（已清理）
    size: int           # 位元組數


def sanitize_filename(name: str | None) -> str:
    """清理原始檔名：去掉任何路徑、控制字元，限制長度"""
    base = (name or "").replace("\\", "/").split("/")[-1]
    base = re.sub(r"[\x00-\x1f\x7f]", "", base).strip()
    return base[:MAX_ORIGINAL_NAME_LENGTH] or "file"


def matches_signature(extension: str, head: bytes) -> bool:
    """檔案開頭的內容是否與副檔名相符"""
    if extension == ".webp":
        return head[:4] == b"RIFF" and head[8:12] == b"WEBP"
    return any(head.startswith(signature) for signature in SIGNATURES.get(extension, ()))


def format_extensions(extensions: set[str]) -> str:
    """把副檔名集合轉成給使用者看的文字，例如「.gif、.jpg、.png」"""
    return "、".join(sorted(extensions))


def save_upload(
    upload: UploadFile,
    directory: Path,
    allowed_extensions: set[str],
    max_bytes: int,
) -> SavedFile:
    """驗證並儲存上傳的檔案；不合格就丟 HTTPException，且不會留下殘檔"""
    original_name = sanitize_filename(upload.filename)
    extension = Path(original_name).suffix.lower()
    if extension not in allowed_extensions:
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            f"不支援的檔案類型，只接受：{format_extensions(allowed_extensions)}",
        )

    directory.mkdir(parents=True, exist_ok=True)
    stored_name = f"{uuid.uuid4().hex}{extension}"
    target = directory / stored_name
    size = 0
    head = b""

    try:
        with target.open("wb") as output:
            while chunk := upload.file.read(CHUNK_SIZE):
                size += len(chunk)
                if size > max_bytes:
                    raise HTTPException(
                        status.HTTP_413_CONTENT_TOO_LARGE,
                        f"檔案太大，上限為 {max_bytes // (1024 * 1024)} MB",
                    )
                if len(head) < HEAD_SIZE:
                    head += chunk[: HEAD_SIZE - len(head)]
                output.write(chunk)

        if size == 0:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "檔案是空的")
        if not matches_signature(extension, head):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "檔案內容與副檔名不符，可能不是正確的檔案")
    except HTTPException:
        target.unlink(missing_ok=True)
        raise
    except OSError:
        target.unlink(missing_ok=True)
        logger.exception("儲存上傳檔案失敗")
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "儲存檔案失敗")

    return SavedFile(stored_name, original_name, size)


def delete_stored_file(directory: Path, stored_name: str) -> None:
    """刪除已儲存的檔案；只接受單純的檔名，找不到或失敗都不會丟例外（只記 log）"""
    if not stored_name or Path(stored_name).name != stored_name:
        return
    try:
        (directory / stored_name).unlink(missing_ok=True)
    except OSError:
        logger.exception("刪除檔案失敗：%s", stored_name)
