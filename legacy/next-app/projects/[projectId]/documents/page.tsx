import Link from "next/link";
import { notFound } from "next/navigation";

import { VoiceTextInput } from "@/app/_components/voice-text-input";
import type {
  DocumentStatus,
  DocumentWarning,
  ProjectAccessRole,
  ProjectMembershipWithUser,
  SourceDocument,
} from "@/domain";
import { getProjectAccess, requirePageUser } from "@/server/auth";
import { getStorage } from "@/server/storage";

export const dynamic = "force-dynamic";

type DocumentsPageProps = {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const statusLabels: Record<DocumentStatus, string> = {
  uploaded: "Uploaded",
  parsed: "Parsed",
  failed: "Failed",
  rejected: "Rejected",
};

const roleLabels: Record<ProjectAccessRole, string> = {
  owner: "Owner",
  editor: "Editor",
  viewer: "Viewer",
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatBytes(bytes: number) {
  const megabytes = bytes / (1024 * 1024);
  if (megabytes >= 1) {
    return `${megabytes.toFixed(megabytes >= 10 ? 0 : 1)} MB`;
  }

  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function WarningList({ warnings }: { warnings: DocumentWarning[] }) {
  if (warnings.length === 0) {
    return null;
  }

  return (
    <ul className="warning-list">
      {warnings.map((warning) => (
        <li key={`${warning.code}-${warning.message}`}>{warning.message}</li>
      ))}
    </ul>
  );
}

function DocumentRows({ documents }: { documents: SourceDocument[] }) {
  if (documents.length === 0) {
    return <p className="muted">No source documents uploaded.</p>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Document</th>
            <th>Format</th>
            <th>Status</th>
            <th>Metadata</th>
            <th>Size</th>
            <th>Uploaded</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((document) => (
            <tr key={document.id}>
              <td>
                <strong>{document.filename}</strong>
                <WarningList warnings={document.warnings} />
              </td>
              <td>{document.fileExtension.toUpperCase()}</td>
              <td>
                <span className={`status ${document.status}`}>
                  {statusLabels[document.status]}
                </span>
              </td>
              <td>
                {document.parserMetadata?.pageCount
                  ? `${document.parserMetadata.pageCount} pages`
                  : document.parserMetadata?.slideCount
                    ? `${document.parserMetadata.slideCount} slides`
                    : `${document.parserMetadata?.wordCount ?? 0} words`}
              </td>
              <td>{formatBytes(document.sizeBytes)}</td>
              <td>{formatDate(document.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProjectAccessPanel({
  canManage,
  members,
  projectId,
}: {
  canManage: boolean;
  members: ProjectMembershipWithUser[];
  projectId: string;
}) {
  return (
    <section className="panel stack" aria-labelledby="access-title">
      <div className="section-heading">
        <div>
          <p className="section-kicker">Access</p>
          <h2 id="access-title">Project access</h2>
        </div>
        <span className="counter">{members.length}</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Person</th>
              <th>Email</th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id}>
                <td>{member.user.name}</td>
                <td>{member.user.email}</td>
                <td>{roleLabels[member.role]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {canManage ? (
        <form
          action={`/api/projects/${projectId}/members`}
          className="access-form"
          method="post"
        >
          <label className="field">
            <span>User email</span>
            <VoiceTextInput
              fieldLabel="User email"
              name="email"
              placeholder="analyst@example.com"
              type="email"
              voiceLabel="Dictate user email"
            />
          </label>
          <label className="field">
            <span>Role</span>
            <select name="role" defaultValue="viewer">
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
              <option value="owner">Owner</option>
            </select>
          </label>
          <button className="button primary" type="submit">
            Update access
          </button>
        </form>
      ) : null}
    </section>
  );
}

export default async function SourceDocumentsPage({
  params,
  searchParams,
}: DocumentsPageProps) {
  const { projectId } = await params;
  const query = await searchParams;
  const user = await requirePageUser(`/projects/${projectId}/documents`);
  const storage = getStorage();
  const access = await getProjectAccess({ user, projectId, storage });
  const project = access.project;

  if (!project) {
    notFound();
  }

  const [documents, members] = await Promise.all([
    storage.listSourceDocuments(projectId),
    storage.listProjectMemberships(projectId),
  ]);
  const status = firstValue(query.status);
  const message = firstValue(query.message);
  const accessStatus = firstValue(query.accessStatus);
  const accessMessage = firstValue(query.accessMessage);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Project</p>
          <h1>{project.name}</h1>
          <p className="session-note">
            Signed in as {user.name} - {access.role ?? "admin"}
          </p>
        </div>
        <nav className="actions" aria-label="Project navigation">
          <Link className="button" href="/">
            Back to dashboard
          </Link>
          <Link
            className="button"
            href={`/projects/${projectId}/opportunities`}
          >
            Opportunities
          </Link>
          {access.canEdit ? (
            <Link
              className="button primary"
              href={`/projects/${projectId}/upload`}
            >
              Upload
            </Link>
          ) : null}
          <form action="/api/auth/logout" method="post">
            <button className="button" type="submit">
              Sign out
            </button>
          </form>
        </nav>
      </header>

      {status ? (
        <p className={`alert ${status === "error" ? "error" : "success"}`}>
          {message ??
            `Document status: ${statusLabels[status as DocumentStatus] ?? status}.`}
        </p>
      ) : null}
      {accessStatus === "updated" ? (
        <p className="alert success">Project access updated.</p>
      ) : null}
      {accessStatus === "error" ? (
        <p className="alert error">
          {accessMessage ?? "Project access could not be updated."}
        </p>
      ) : null}

      <section className="panel stack">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Sources</p>
            <h2>Source document list</h2>
          </div>
          <span className="counter">{documents.length}</span>
        </div>
        <DocumentRows documents={documents} />
      </section>
      <ProjectAccessPanel
        canManage={access.canManage}
        members={members}
        projectId={projectId}
      />
    </main>
  );
}
