# Phase 1 Changed Files

Root/runtime:

- `.env.example`
- `README.md`
- `app.yaml`
- `eslint.config.mjs`
- `package.json`
- `package-lock.json`
- `requirements.txt`
- `vitest.config.ts`
- `tsconfig.json`
- `next.config.ts` removed
- `next-env.d.ts` removed
- `src/app/` moved to `legacy/next-app/`

Backend:

- `backend/__init__.py`
- `backend/main.py`
- `backend/app.yaml`
- `backend/pyproject.toml`
- `backend/requirements.txt`
- `backend/app/main.py`
- `backend/app/fixtures.py`
- `backend/app/api/__init__.py`
- `backend/app/api/audiences.py`
- `backend/app/api/config.py`
- `backend/app/api/generation.py`
- `backend/app/api/health.py`
- `backend/app/api/opportunities.py`
- `backend/app/api/projects.py`
- `backend/app/api/sources.py`
- `backend/app/backends/__init__.py`
- `backend/app/backends/base.py`
- `backend/app/backends/databricks_backend.py`
- `backend/app/backends/mock_backend.py`
- `backend/app/models/__init__.py`
- `backend/app/models/audience.py`
- `backend/app/models/base.py`
- `backend/app/models/extraction.py`
- `backend/app/models/generation.py`
- `backend/app/models/opportunity.py`
- `backend/app/models/project.py`
- `backend/app/models/source.py`
- `backend/app/repositories/__init__.py`
- `backend/app/repositories/base.py`
- `backend/app/repositories/memory.py`
- `backend/app/services/__init__.py`
- `backend/app/services/extraction.py`
- `backend/app/services/generation.py`
- `backend/app/services/integrity.py`
- `backend/tests/test_phase1_api.py`

Frontend:

- `frontend/index.html`
- `frontend/package.json`
- `frontend/tsconfig.json`
- `frontend/vite.config.ts`
- `frontend/src/App.tsx`
- `frontend/src/main.tsx`
- `frontend/src/types.ts`
- `frontend/src/api/client.ts`
- `frontend/src/components/Icons.tsx`
- `frontend/src/components/OutputDocument.tsx`
- `frontend/src/components/OutputDocument.test.tsx`
- `frontend/src/components/Shell.tsx`
- `frontend/src/pages/ExtractionReviewPage.tsx`
- `frontend/src/pages/GeneratePage.tsx`
- `frontend/src/pages/HomePage.tsx`
- `frontend/src/pages/LibraryPages.tsx`
- `frontend/src/pages/OpportunityAudiencePage.tsx`
- `frontend/src/pages/ProjectsPage.tsx`
- `frontend/src/pages/ResultsPage.tsx`
- `frontend/src/pages/ReviewSetupPage.tsx`
- `frontend/src/pages/TaskPage.tsx`
- `frontend/src/state/generation.ts`
- `frontend/src/state/options.ts`
- `frontend/src/state/validation.ts`
- `frontend/src/state/validation.test.ts`
- `frontend/src/state/workflow.ts`
- `frontend/src/state/workflow.test.ts`
- `frontend/src/styles/app.css`

Prompts:

- `prompts/core-system.md`
- `prompts/fact-extractor.md`
- `prompts/investment-case-writer.md`
- `prompts/integrity-reviewer.md`
- `prompts/workspace-profile.example.yaml`
- `prompts/runtime-task.example.yaml`

Docs:

- `docs/CLIENT_CONFIGURATION_CHECKLIST.md`
- `docs/DATABRICKS_DEPLOYMENT.md`
- `docs/DECISIONS.md`
- `docs/PHASE1_CHANGED_FILES.md`
- `docs/PHASE1_LIMITATIONS.md`
- `docs/PHASE1_NOTES.md`
- `docs/PLAN.md`
