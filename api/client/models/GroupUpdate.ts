/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Input for updating a group
 */
export type GroupUpdate = {
    name?: string;
    emoji?: string;
    colorHex?: string;
    desc?: string;
    isPublic?: boolean;
    superAdminId?: string;
    adminIds?: Array<string>;
    memberIds?: Array<string>;
};

