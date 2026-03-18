/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Comment model
 */
export type Comment = {
    /**
     * Unique comment identifier
     */
    id: string;
    /**
     * ID of the user who made the comment
     */
    userId: string;
    /**
     * Comment text
     */
    text: string;
    /**
     * Array of photo URLs attached to comment
     */
    photos: Array<string>;
    /**
     * Timestamp when created
     */
    createdAt: string;
    /**
     * Timestamp when updated
     */
    updatedAt: string;
};

