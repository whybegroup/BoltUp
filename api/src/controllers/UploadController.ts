import { Body, Controller, Post, Query, Route, Tags } from 'tsoa';
import {
  CompleteUploadRequest,
  DeleteUploadRequest,
  PresignGetBatchRequest,
  PresignGetBatchResponse,
  PresignUploadRequest,
  PresignUploadResponse,
} from '../models/Upload';
import { S3UploadService } from '../services/S3UploadService';

@Route('storage')
@Tags('Storage')
export class UploadController extends Controller {
  private uploads = new S3UploadService();

  /**
   * Get a short-lived signed PUT URL for direct client upload to S3.
   * @summary Presign file upload (S3)
   */
  @Post('presign')
  public async presignUpload(@Body() body: PresignUploadRequest): Promise<PresignUploadResponse> {
    if (!body.userId?.trim()) {
      this.setStatus(400);
      throw new Error('userId is required');
    }
    if (!body.contentType?.trim()) {
      this.setStatus(400);
      throw new Error('contentType is required');
    }
    return this.uploads.presignUpload({
      userId: body.userId.trim(),
      contentType: body.contentType.trim(),
      filename: body.filename?.trim(),
      groupId: body.groupId?.trim(),
      contentLength: body.contentLength,
    });
  }

  /**
   * Record an S3 upload against a group's storage quota after the client PUT succeeds.
   */
  @Post('complete')
  public async completeUpload(@Body() body: CompleteUploadRequest): Promise<void> {
    if (!body.userId?.trim()) {
      this.setStatus(400);
      throw new Error('userId is required');
    }
    if (!body.publicUrl?.trim()) {
      this.setStatus(400);
      throw new Error('publicUrl is required');
    }
    await this.uploads.completeUpload({
      userId: body.userId.trim(),
      publicUrl: body.publicUrl.trim(),
      groupId: body.groupId?.trim(),
    });
  }

  /**
   * Resolve stored file URLs for display. S3 uploads return the public object URL; externals pass through.
   */
  @Post('presign-get')
  public async presignGetBatch(@Body() body: PresignGetBatchRequest): Promise<PresignGetBatchResponse> {
    const urls = body.sourceUrls;
    if (!urls || !Array.isArray(urls)) {
      this.setStatus(400);
      throw new Error('sourceUrls array is required');
    }
    if (urls.length === 0) {
      return { results: [] };
    }
    return this.uploads.presignGetBatch(urls);
  }

  /**
   * Delete a file under storage/{userId}/ for the given userId.
   */
  @Post('delete')
  public async deleteUploadedObject(
    @Query() userId: string,
    @Body() body: DeleteUploadRequest,
  ): Promise<void> {
    if (!userId?.trim()) {
      this.setStatus(400);
      throw new Error('userId is required');
    }
    const url = body.sourceUrl?.trim();
    if (!url) {
      this.setStatus(400);
      throw new Error('sourceUrl is required');
    }
    await this.uploads.deleteUploadedObject(userId.trim(), url);
  }
}
