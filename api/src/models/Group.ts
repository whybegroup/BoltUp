/**
 * Group model - represents a social group
 */
export interface Group {
  /** Unique group identifier */
  id: string;
  /** Group name */
  name: string;
  /** Group emoji icon */
  emoji: string;
  /** Group color hex code */
  colorHex: string;
  /** Group description */
  desc: string;
  /** Whether the group is publicly visible */
  isPublic: boolean;
  /** ID of the group's super admin */
  superAdminId: string;
  /** Array of admin user IDs */
  adminIds: string[];
  /** Array of member user IDs */
  memberIds: string[];
  /** Timestamp when the group was created */
  createdAt: Date;
  /** Timestamp when the group was last updated */
  updatedAt: Date;
}

/**
 * Input for creating a new group
 */
export interface GroupInput {
  id: string;
  name: string;
  emoji: string;
  colorHex: string;
  desc: string;
  isPublic: boolean;
  superAdminId: string;
  adminIds?: string[];
  memberIds?: string[];
}

/**
 * Input for updating a group
 */
export interface GroupUpdate {
  name?: string;
  emoji?: string;
  colorHex?: string;
  desc?: string;
  isPublic?: boolean;
  superAdminId?: string;
  adminIds?: string[];
  memberIds?: string[];
}

/**
 * Group member role
 */
export type GroupRole = 'member' | 'admin' | 'superadmin';
