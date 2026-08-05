from __future__ import annotations

import tempfile
from pathlib import Path

from app.fixtures import default_extraction
from app.models.extraction import ExtractionResult
from app.repositories.base import SourceProcessor


class MockSourceProcessor(SourceProcessor):
    max_upload_bytes = 2 * 1024 * 1024

    async def extract(self, source_label: str, project_id: str | None) -> ExtractionResult:
        return default_extraction(project_id, source_label)

    async def extract_uploaded_bytes(
        self,
        content: bytes,
        source_label: str,
        project_id: str | None,
    ) -> ExtractionResult:
        if len(content) > self.max_upload_bytes:
            raise ValueError("File exceeds the Phase 1 test-size limit.")

        temp_path: Path | None = None
        try:
            suffix = Path(source_label).suffix[:12]
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
                temp_file.write(content)
                temp_path = Path(temp_file.name)
            return await self.extract(source_label, project_id)
        finally:
            if temp_path and temp_path.exists():
                temp_path.unlink()


source_processor = MockSourceProcessor()
