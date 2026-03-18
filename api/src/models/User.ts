/**
 * User model - represents a user in the system
 */
export interface User {
  /** Unique user identifier */
  id: string;
  /** User's name */
  name: string;
  /** User's display name with location and year */
  displayName: string;
  /** User's unique handle */
  handle: string;
  /** Timestamp when the user was created */
  createdAt: Date;
  /** Timestamp when the user was last updated */
  updatedAt: Date;
}

/**
 * Input for creating a new user
 */
export interface UserInput {
  id: string;
  name: string;
  displayName: string;
  handle: string;
}

/**
 * Input for updating a user
 */
export interface UserUpdate {
  name?: string;
  displayName?: string;
  handle?: string;
}
