# GCP Deployment And Cloud Storage Setup

Update date: 2026-07-22

## Implemented Scope

The active MVP upload path now supports Google Cloud Storage for original
source documents. The database still stores source metadata, parser status,
chunks, citations, opportunities, and drafts. Uploaded source files are stored
behind a configurable file-store interface:

- Local development default: `data/uploads/[projectId]/[documentId]-[filename]`
- GCP option: `gs://[bucket]/[prefix]/[projectId]/[documentId]-[filename]`

The current Next.js route handlers are still the active MVP backend path. The
long-term plan remains FastAPI plus Postgres/Cloud SQL.

## Environment Variables

Local upload storage:

```bash
UPLOAD_STORAGE_BACKEND="local"
```

Cloud Storage upload storage:

```bash
UPLOAD_STORAGE_BACKEND="gcs"
GCS_UPLOAD_BUCKET="investmentgen-source-docs"
GCS_UPLOAD_PREFIX="uploads"
GOOGLE_CLOUD_PROJECT="your-gcp-project"
```

On Cloud Run, prefer the runtime service account for authentication. For local
GCS testing, use either:

```bash
GOOGLE_APPLICATION_CREDENTIALS="/absolute/path/to/service-account.json"
```

or gcloud application default credentials.

## Bucket Setup

Use a private bucket with uniform bucket-level access. Keep original source
documents private because they can contain confidential strategy material.

Example:

```bash
gcloud storage buckets create gs://investmentgen-source-docs \
  --project=your-gcp-project \
  --location=us-central1 \
  --uniform-bucket-level-access
```

Create or select a runtime service account for the app:

```bash
gcloud iam service-accounts create investmentgen-runtime \
  --project=your-gcp-project \
  --display-name="InvestmentGen runtime"
```

Grant bucket-scoped object access:

```bash
gcloud storage buckets add-iam-policy-binding gs://investmentgen-source-docs \
  --member="serviceAccount:investmentgen-runtime@your-gcp-project.iam.gserviceaccount.com" \
  --role="roles/storage.objectUser"
```

## Cloud Run Shape

For a first GCP deployment, run the Next.js app on Cloud Run and set the upload
storage env vars on the service. Keep secrets in Secret Manager rather than in
source-controlled `.env` files.

```bash
gcloud run deploy investmentgen-web \
  --project=your-gcp-project \
  --region=us-central1 \
  --source=. \
  --service-account=investmentgen-runtime@your-gcp-project.iam.gserviceaccount.com \
  --set-env-vars=UPLOAD_STORAGE_BACKEND=gcs,GCS_UPLOAD_BUCKET=investmentgen-source-docs,GCS_UPLOAD_PREFIX=uploads
```

Before using this with real client documents, finish the production database
move to Postgres/Cloud SQL. The transitional SQLite store is useful for the MVP
workflow, but Cloud Run containers are stateless and should not be treated as
durable storage.

## Security Notes

- Do not make the source-document bucket public.
- Do not store service-account JSON in the repository.
- Prefer bucket-level IAM over broad project-level storage roles.
- Store Anthropic, Vertex, Microsoft, and database credentials in Secret
  Manager.
- Treat generated outputs as drafts requiring human review; GCS persistence
  does not change the source-grounding or funding-recipient evidence rules.
