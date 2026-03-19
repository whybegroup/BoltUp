/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * User model - represents a user in the system
 */
export type User = {
    /**
     * Unique user identifier
     */
    id: string;
    /**
     * User's name
     */
    name: string;
    /**
     * User's display name with location and year
     */
    displayName: string;
    /**
     * DiceBear bottts avatar seed
     */
    avatar?: string | null;
    /**
     * Timestamp when the user was created
     */
    createdAt: string;
    /**
     * Timestamp when the user was last updated
     */
    updatedAt: string;
};

