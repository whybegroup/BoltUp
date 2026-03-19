/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Group model - represents a social group (full, for members/admins)
 */
export type Group = {
    /**
     * Unique group identifier
     */
    id: string;
    /**
     * Group name
     */
    name: string;
    /**
     * Group description
     */
    desc: string;
    /**
     * Group thumbnail/avatar URL
     */
    thumbnail?: string | null;
    /**
     * DiceBear icons seed for generated avatar
     */
    avatarSeed?: string | null;
    /**
     * Unique invite code for joining the group
     */
    inviteCode?: string | null;
    /**
     * Whether the group is publicly visible
     */
    isPublic: boolean;
    /**
     * ID of the group's super admin
     */
    superAdminId: string;
    /**
     * Array of admin user IDs
     */
    adminIds: Array<string>;
    /**
     * Array of member user IDs
     */
    memberIds: Array<string>;
    /**
     * Array of pending member request user IDs
     */
    pendingMemberIds?: Array<string>;
    /**
     * ID of the user who created this group
     */
    createdBy: string;
    /**
     * ID of the user who last updated this group
     */
    updatedBy: string;
    /**
     * Timestamp when the group was created
     */
    createdAt: string;
    /**
     * Timestamp when the group was last updated
     */
    updatedAt: string;
};

