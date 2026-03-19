/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Comment } from '../models/Comment';
import type { CommentInput } from '../models/CommentInput';
import type { Event } from '../models/Event';
import type { EventDetailed } from '../models/EventDetailed';
import type { EventInput } from '../models/EventInput';
import type { EventUpdate } from '../models/EventUpdate';
import type { RSVP } from '../models/RSVP';
import type { RSVPInput } from '../models/RSVPInput';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class EventsService {
    /**
     * Retrieves events scoped by user's group membership. userId required.
     * Get all events
     * @param userId
     * @param groupId
     * @param startAfter
     * @param startBefore
     * @param limit
     * @returns EventDetailed Ok
     * @throws ApiError
     */
    public static getEvents(
        userId: string,
        groupId?: string,
        startAfter?: string,
        startBefore?: string,
        limit?: number,
    ): CancelablePromise<Array<EventDetailed>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/events',
            query: {
                'userId': userId,
                'groupId': groupId,
                'startAfter': startAfter,
                'startBefore': startBefore,
                'limit': limit,
            },
        });
    }
    /**
     * Creates a new event in a group
     * Create a new event
     * @param requestBody
     * @returns Event Created
     * @throws ApiError
     */
    public static createEvent(
        requestBody: EventInput,
    ): CancelablePromise<Event> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/events',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Retrieves a single event. userId required to verify access.
     * Get event by ID
     * @param id
     * @param userId
     * @returns EventDetailed Ok
     * @throws ApiError
     */
    public static getEvent(
        id: string,
        userId: string,
    ): CancelablePromise<EventDetailed> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/events/{id}',
            path: {
                'id': id,
            },
            query: {
                'userId': userId,
            },
        });
    }
    /**
     * Updates an existing event's information
     * Update an event
     * @param id
     * @param requestBody
     * @returns Event Ok
     * @throws ApiError
     */
    public static updateEvent(
        id: string,
        requestBody: EventUpdate,
    ): CancelablePromise<Event> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/events/{id}',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Deletes an event and all associated data
     * Delete an event
     * @param id
     * @returns void
     * @throws ApiError
     */
    public static deleteEvent(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/events/{id}',
            path: {
                'id': id,
            },
        });
    }
    /**
     * Creates or updates a user's RSVP for an event
     * Create or update RSVP
     * @param id
     * @param requestBody
     * @returns RSVP Ok
     * @throws ApiError
     */
    public static upsertRsvp(
        id: string,
        requestBody: RSVPInput,
    ): CancelablePromise<RSVP> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/events/{id}/rsvps',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Removes a user's RSVP from an event
     * Delete RSVP
     * @param id
     * @param userId
     * @returns void
     * @throws ApiError
     */
    public static deleteRsvp(
        id: string,
        userId: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/events/{id}/rsvps/{userId}',
            path: {
                'id': id,
                'userId': userId,
            },
        });
    }
    /**
     * Retrieves all comments for an event
     * Get event comments
     * @param id
     * @returns Comment Ok
     * @throws ApiError
     */
    public static getComments(
        id: string,
    ): CancelablePromise<Array<Comment>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/events/{id}/comments',
            path: {
                'id': id,
            },
        });
    }
    /**
     * Adds a new comment to an event
     * Create a comment
     * @param id
     * @param requestBody
     * @returns Comment Created
     * @throws ApiError
     */
    public static createComment(
        id: string,
        requestBody: CommentInput,
    ): CancelablePromise<Comment> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/events/{id}/comments',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
}
