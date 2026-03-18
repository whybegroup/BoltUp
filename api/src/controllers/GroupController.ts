import {
  Body,
  Controller,
  Delete,
  Get,
  Path,
  Post,
  Put,
  Route,
  Tags,
  SuccessResponse,
} from 'tsoa';
import { Group, GroupInput, GroupUpdate, User } from '../models';
import { GroupService } from '../services/GroupService';

@Route('groups')
@Tags('Groups')
export class GroupController extends Controller {
  private groupService = new GroupService();

  /**
   * Get all groups
   * @summary Retrieves a list of all groups with their admin and member IDs
   */
  @Get()
  public async getGroups(): Promise<Group[]> {
    return this.groupService.getAll();
  }

  /**
   * Get group by ID
   * @summary Retrieves a single group with member information
   */
  @Get('{id}')
  public async getGroup(@Path() id: string): Promise<Group> {
    const group = await this.groupService.getById(id);
    if (!group) {
      this.setStatus(404);
      throw new Error('Group not found');
    }
    return group;
  }

  /**
   * Get group members
   * @summary Retrieves all members of a specific group
   */
  @Get('{id}/members')
  public async getGroupMembers(@Path() id: string): Promise<User[]> {
    // First check if group exists
    const group = await this.groupService.getById(id);
    if (!group) {
      this.setStatus(404);
      throw new Error('Group not found');
    }
    return this.groupService.getMembers(id);
  }

  /**
   * Create a new group
   * @summary Creates a new group with initial members
   */
  @Post()
  @SuccessResponse('201', 'Created')
  public async createGroup(@Body() body: GroupInput): Promise<Group> {
    this.setStatus(201);
    return this.groupService.create(body);
  }

  /**
   * Update a group
   * @summary Updates an existing group's information and/or members
   */
  @Put('{id}')
  public async updateGroup(
    @Path() id: string,
    @Body() body: GroupUpdate
  ): Promise<Group> {
    return this.groupService.update(id, body);
  }

  /**
   * Delete a group
   * @summary Deletes a group and all its associated data
   */
  @Delete('{id}')
  @SuccessResponse('204', 'No Content')
  public async deleteGroup(@Path() id: string): Promise<void> {
    await this.groupService.delete(id);
    this.setStatus(204);
  }
}
