/**
 * Request a short-lived signed URL to PUT a file into S3.
 */
export interface PresignUploadRequest {
  userId: string;
  contentType: string;
  filename?: string;
  /** When set, the upload counts toward this group's storage quota. */
  groupId?: string;
  /** Declared body size in bytes; used for quota checks before the PUT. */
  contentLength?: number;
}

export interface PresignUploadResponse {
  /** HTTP PUT target (S3 signed URL); include Content-Type header matching the presign request. */
  uploadUrl: string;
  /** Public S3 URL to store on events/comments after upload succeeds. */
  publicUrl: string;
  objectKey: string;
  expiresIn: number;
}

export interface CompleteUploadRequest {
  userId: string;
  publicUrl: string;
  groupId?: string;
  /** Original file name from the client (shown for non-image media). */
  filename?: string;
}

export interface PresignGetBatchRequest {
  /** Stored file URLs from the database (S3 public URLs or pass-through externals). */
  sourceUrls: string[];
}

export interface PresignGetEntry {
  sourceUrl: string;
  viewUrl: string;
  expiresIn: number;
}

export interface PresignGetBatchResponse {
  results: PresignGetEntry[];
}

export interface DeleteUploadRequest {
  /** Canonical object URL (same as stored after upload). */
  sourceUrl: string;
}
