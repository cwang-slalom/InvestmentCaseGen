import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  createUploadedFileStore,
  GcsUploadedFileStore,
  getUploadStorageBackend,
  LocalUploadedFileStore,
} from "./files";

const tempDirs: string[] = [];

function createTempDir() {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "investmentgen-uploads-"));
  tempDirs.push(tempDir);
  return tempDir;
}

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

describe("uploaded file storage", () => {
  it("saves uploads locally by default with stable storage paths", async () => {
    const rootDir = createTempDir();
    const store = new LocalUploadedFileStore({ rootDir });

    const storagePath = await store.saveUploadedFile({
      buffer: Buffer.from("source text"),
      originalFilename: "Source deck 1.pdf",
      mimeType: "application/pdf",
      projectId: "project-1",
      documentId: "document-1",
    });

    expect(storagePath).toBe(
      "data/uploads/project-1/document-1-Source-deck-1.pdf",
    );
    expect(readFileSync(path.join(rootDir, ...storagePath.split("/")))).toEqual(
      Buffer.from("source text"),
    );
  });

  it("selects Cloud Storage only when configured or explicitly requested", () => {
    expect(getUploadStorageBackend({})).toBe("local");
    expect(getUploadStorageBackend({ GCS_UPLOAD_BUCKET: "case-bucket" })).toBe(
      "gcs",
    );
    expect(
      getUploadStorageBackend({
        UPLOAD_STORAGE_BACKEND: "local",
        GCS_UPLOAD_BUCKET: "case-bucket",
      }),
    ).toBe("local");
    expect(() =>
      createUploadedFileStore({
        env: {
          UPLOAD_STORAGE_BACKEND: "gcs",
        },
      }),
    ).toThrow(/GCS_UPLOAD_BUCKET/);
  });

  it("stores uploads in GCS with a gs path and safe object metadata", async () => {
    const savedUploads: Array<{
      bucketName: string;
      objectName: string;
      data: Buffer;
      options: {
        contentType: string;
        resumable: boolean;
        metadata: {
          metadata: Record<string, string>;
        };
      };
    }> = [];
    const fakeClient = {
      bucket(bucketName: string) {
        return {
          file(objectName: string) {
            return {
              async save(
                data: Buffer,
                options: {
                  contentType: string;
                  resumable: boolean;
                  metadata: {
                    metadata: Record<string, string>;
                  };
                },
              ) {
                savedUploads.push({
                  bucketName,
                  objectName,
                  data,
                  options,
                });
              },
            };
          },
        };
      },
    };
    const store = new GcsUploadedFileStore({
      bucketName: "investmentgen-source-docs",
      prefix: "source-uploads",
      client: fakeClient,
    });

    const storagePath = await store.saveUploadedFile({
      buffer: Buffer.from("source text"),
      originalFilename: "Case notes!.txt",
      mimeType: "text/plain",
      projectId: "project-1",
      documentId: "document-1",
    });

    expect(storagePath).toBe(
      "gs://investmentgen-source-docs/source-uploads/project-1/document-1-Case-notes-.txt",
    );
    expect(savedUploads).toMatchObject([
      {
        bucketName: "investmentgen-source-docs",
        objectName: "source-uploads/project-1/document-1-Case-notes-.txt",
        data: Buffer.from("source text"),
        options: {
          contentType: "text/plain",
          resumable: false,
          metadata: {
            metadata: {
              projectId: "project-1",
              sourceDocumentId: "document-1",
              originalFilename: "Case-notes-.txt",
            },
          },
        },
      },
    ]);
  });
});
