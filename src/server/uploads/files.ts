import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { Storage as GoogleCloudStorage } from "@google-cloud/storage";

type Env = Record<string, string | undefined>;

export type SaveUploadedFileInput = {
  buffer: Buffer;
  originalFilename: string;
  mimeType: string;
  projectId: string;
  documentId: string;
};

export interface UploadedFileStore {
  saveUploadedFile(input: SaveUploadedFileInput): Promise<string>;
}

type GcsFileLike = {
  save(
    data: Buffer,
    options: {
      contentType: string;
      resumable: boolean;
      metadata: {
        metadata: Record<string, string>;
      };
    },
  ): Promise<unknown>;
};

type GcsClientLike = {
  bucket(name: string): {
    file(name: string): GcsFileLike;
  };
};

export class UploadedFileStorageError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 500,
  ) {
    super(message);
    this.name = "UploadedFileStorageError";
  }
}

function normalized(value: string | undefined) {
  return value?.trim().toLowerCase();
}

function storagePath(...segments: string[]) {
  return segments
    .map((segment) => segment.trim().replace(/^\/+|\/+$/g, ""))
    .filter(Boolean)
    .join("/");
}

function localTargetPath(rootDir: string, relativePath: string) {
  return path.join(rootDir, ...relativePath.split("/"));
}

export function sanitizeFilename(filename: string) {
  const trimmed = filename.trim() || "source-document";
  return (
    trimmed.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") ||
    "source-document"
  );
}

function sanitizeStorageSegment(value: string, fallback: string) {
  return sanitizeFilename(value) || fallback;
}

export function getUploadStorageBackend(env: Env = process.env) {
  const explicit = normalized(
    env.UPLOAD_STORAGE_BACKEND ?? env.FILE_STORAGE_BACKEND,
  );

  if (explicit === "gcs" || explicit === "google-cloud-storage") {
    return "gcs" as const;
  }

  if (explicit === "local" || explicit === "filesystem") {
    return "local" as const;
  }

  if (env.GCS_UPLOAD_BUCKET ?? env.GOOGLE_CLOUD_STORAGE_BUCKET) {
    return "gcs" as const;
  }

  return "local" as const;
}

export class LocalUploadedFileStore implements UploadedFileStore {
  constructor(
    private readonly options: {
      rootDir?: string;
      prefix?: string;
    } = {},
  ) {}

  async saveUploadedFile(input: SaveUploadedFileInput) {
    const safeFilename = sanitizeFilename(input.originalFilename);
    const relativePath = storagePath(
      this.options.prefix ?? "data/uploads",
      sanitizeStorageSegment(input.projectId, "project"),
      `${sanitizeStorageSegment(input.documentId, "document")}-${safeFilename}`,
    );
    const targetPath = localTargetPath(
      this.options.rootDir ?? process.cwd(),
      relativePath,
    );

    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, input.buffer);

    return relativePath;
  }
}

export class GcsUploadedFileStore implements UploadedFileStore {
  constructor(
    private readonly options: {
      bucketName: string;
      prefix?: string;
      client: GcsClientLike;
    },
  ) {}

  async saveUploadedFile(input: SaveUploadedFileInput) {
    const safeFilename = sanitizeFilename(input.originalFilename);
    const objectName = storagePath(
      this.options.prefix ?? "uploads",
      sanitizeStorageSegment(input.projectId, "project"),
      `${sanitizeStorageSegment(input.documentId, "document")}-${safeFilename}`,
    );

    try {
      await this.options.client
        .bucket(this.options.bucketName)
        .file(objectName)
        .save(input.buffer, {
          contentType: input.mimeType,
          resumable: false,
          metadata: {
            metadata: {
              projectId: input.projectId,
              sourceDocumentId: input.documentId,
              originalFilename: safeFilename,
            },
          },
        });
    } catch (error) {
      const errorName = error instanceof Error ? error.name : typeof error;
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(
        `Cloud Storage upload failed: ${errorName}: ${errorMessage}`,
      );
      throw new UploadedFileStorageError(
        "cloud_storage_upload_failed",
        "The source document could not be stored in Cloud Storage.",
        502,
      );
    }

    return `gs://${this.options.bucketName}/${objectName}`;
  }
}

export function createUploadedFileStore({
  env = process.env,
  gcsClient,
}: {
  env?: Env;
  gcsClient?: GcsClientLike;
} = {}): UploadedFileStore {
  const backend = getUploadStorageBackend(env);

  if (backend === "local") {
    return new LocalUploadedFileStore({
      rootDir: env.UPLOAD_STORAGE_LOCAL_ROOT,
      prefix: env.UPLOAD_STORAGE_LOCAL_PREFIX,
    });
  }

  const bucketName = env.GCS_UPLOAD_BUCKET ?? env.GOOGLE_CLOUD_STORAGE_BUCKET;
  if (!bucketName) {
    throw new UploadedFileStorageError(
      "gcs_bucket_not_configured",
      "Set GCS_UPLOAD_BUCKET before enabling Cloud Storage uploads.",
    );
  }

  return new GcsUploadedFileStore({
    bucketName,
    prefix: env.GCS_UPLOAD_PREFIX,
    client:
      gcsClient ??
      new GoogleCloudStorage({
        projectId: env.GOOGLE_CLOUD_PROJECT,
        keyFilename: env.GOOGLE_APPLICATION_CREDENTIALS,
      }),
  });
}

export async function saveUploadedFile(
  input: SaveUploadedFileInput,
  store = createUploadedFileStore(),
) {
  return store.saveUploadedFile(input);
}
