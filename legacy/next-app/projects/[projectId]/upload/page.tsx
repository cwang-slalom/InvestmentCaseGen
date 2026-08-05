import Link from "next/link";
import { notFound } from "next/navigation";

import { getProjectAccess, requirePageUser } from "@/server/auth";
import { DOCUMENT_LIMITS } from "@/server/documents";
import { getStorage } from "@/server/storage";

export const dynamic = "force-dynamic";

type UploadPageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function UploadPage({ params }: UploadPageProps) {
  const { projectId } = await params;
  const user = await requirePageUser(`/projects/${projectId}/upload`);
  const storage = getStorage();
  const access = await getProjectAccess({ user, projectId, storage });
  const project = access.project;

  if (!project || !access.canEdit) {
    notFound();
  }

  return (
    <main className="app-shell narrow">
      <header className="topbar">
        <div>
          <p className="eyebrow">Upload</p>
          <h1>{project.name}</h1>
          <p className="session-note">
            Signed in as {user.name} - {access.role ?? "admin"}
          </p>
        </div>
        <nav className="actions" aria-label="Project navigation">
          <Link className="button" href="/">
            Back to dashboard
          </Link>
          <Link className="button" href={`/projects/${projectId}/documents`}>
            Documents
          </Link>
          <Link
            className="button"
            href={`/projects/${projectId}/opportunities`}
          >
            Opportunities
          </Link>
          <form action="/api/auth/logout" method="post">
            <button className="button" type="submit">
              Sign out
            </button>
          </form>
        </nav>
      </header>

      <form
        className="panel stack"
        action={`/api/projects/${projectId}/documents`}
        method="post"
        encType="multipart/form-data"
      >
        <div>
          <p className="section-kicker">Source file</p>
          <h2>Add document</h2>
        </div>
        <label className="field file-field">
          <span>File</span>
          <input
            name="file"
            type="file"
            accept=".pdf,.docx,.pptx,.txt,.md,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation"
            required
          />
        </label>
        <p className="muted">
          PDF, DOCX, PPTX, TXT, or Markdown.{" "}
          {DOCUMENT_LIMITS.maxFileSizeBytes / (1024 * 1024)} MB max.
        </p>
        <button className="button primary" type="submit">
          Upload document
        </button>
      </form>
    </main>
  );
}
