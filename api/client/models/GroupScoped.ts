/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { MembershipStatus } from './MembershipStatus';
/**
 * Group scoped by membership - API returns only appropriate fields per user's status
 */
export type GroupScoped = {
    id: string;
    name: string;
    desc: string;
    thumbnail?: string | null;
    avatarSeed?: string | null;
    isPublic: boolean;
    memberCount: number;
    membershipStatus: MembershipStatus;
    /**
     * Present when member or admin
     */
    inviteCode?: string | null;
    superAdminId?: string;
    adminIds?: Array<string>;
    memberIds?: Array<string>;
    /**
     * Present when admin only
     */
    pendingMemberIds?: Array<string>;
    createdBy?: string;
    updatedBy?: string;
    createdAt?: string;
    updatedAt?: string;
    /**
     * Set when group is soft-deleted
     */
    deletedAt?: string | null;
    deletedBy?: string | null;
};

