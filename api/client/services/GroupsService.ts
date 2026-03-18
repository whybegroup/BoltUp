/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Group } from '../models/Group';
import type { GroupInput } from '../models/GroupInput';
import type { GroupUpdate } from '../models/GroupUpdate';
import type { User } from '../models/User';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class GroupsService {
    /**
     * Retrieves a list of all groups with their admin and member IDs
     * Get all groups
     * @returns Group Ok
     * @throws ApiError
     */
    public static getGroups(): CancelablePromise<Array<Group>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/groups',
        });
    }
    /**
     * Creates a new group with initial members
     * Create a new group
     * @param requestBody
     * @returns Group Created
     * @throws ApiError
     */
    public static createGroup(
        requestBody: GroupInput,
    ): CancelablePromise<Group> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/groups',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Retrieves a single group with member information
     * Get group by ID
     * @param id
     * @returns Group Ok
     * @throws ApiError
     */
    public static getGroup(
        id: string,
    ): CancelablePromise<Group> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/groups/{id}',
            path: {
                'id': id,
            },
        });
    }
    /**
     * Updates an existing group's information and/or members
     * Update a group
     * @param id
     * @param requestBody
     * @returns Group Ok
     * @throws ApiError
     */
    public static updateGroup(
        id: string,
        requestBody: GroupUpdate,
    ): CancelablePromise<Group> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/groups/{id}',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Deletes a group and all its associated data
     * Delete a group
     * @param id
     * @returns void
     * @throws ApiError
     */
    public static deleteGroup(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/groups/{id}',
            path: {
                'id': id,
            },
        });
    }
    /**
     * Retrieves all members of a specific group
     * Get group members
     * @param id
     * @returns User Ok
     * @throws ApiError
     */
    public static getGroupMembers(
        id: string,
    ): CancelablePromise<Array<User>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/groups/{id}/members',
            path: {
                'id': id,
            },
        });
    }
}
