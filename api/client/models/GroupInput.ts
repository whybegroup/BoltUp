/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Input for creating a new group
 */
export type GroupInput = {
    id: string;
    name: string;
    emoji: string;
    colorHex: string;
    desc: string;
    isPublic: boolean;
    superAdminId: string;
    adminIds?: Array<string>;
    memberIds?: Array<string>;
};

