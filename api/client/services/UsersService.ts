/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { User } from '../models/User';
import type { UserInput } from '../models/UserInput';
import type { UserUpdate } from '../models/UserUpdate';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class UsersService {
    /**
     * Retrieves a list of all users in the system
     * Get all users
     * @returns User Ok
     * @throws ApiError
     */
    public static getUsers(): CancelablePromise<Array<User>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/users',
        });
    }
    /**
     * Creates a new user in the system
     * Create a new user
     * @param requestBody
     * @returns User Created
     * @throws ApiError
     */
    public static createUser(
        requestBody: UserInput,
    ): CancelablePromise<User> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/users',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Retrieves a single user by their unique identifier
     * Get user by ID
     * @param id
     * @returns User Ok
     * @throws ApiError
     */
    public static getUser(
        id: string,
    ): CancelablePromise<User> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/users/{id}',
            path: {
                'id': id,
            },
            errors: {
                404: `User not found`,
            },
        });
    }
    /**
     * Updates an existing user's information
     * Update a user
     * @param id
     * @param requestBody
     * @returns User Ok
     * @throws ApiError
     */
    public static updateUser(
        id: string,
        requestBody: UserUpdate,
    ): CancelablePromise<User> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/users/{id}',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Deletes a user from the system
     * Delete a user
     * @param id
     * @returns void
     * @throws ApiError
     */
    public static deleteUser(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/users/{id}',
            path: {
                'id': id,
            },
        });
    }
}
