/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class CommentsService {
    /**
     * Deletes a comment from an event
     * Delete a comment
     * @param id
     * @returns void
     * @throws ApiError
     */
    public static deleteComment(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/comments/{id}',
            path: {
                'id': id,
            },
        });
    }
}
