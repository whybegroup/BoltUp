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
import { User, UserInput, UserUpdate } from '../models';
import { UserService } from '../services/UserService';

@Route('users')
@Tags('Users')
export class UserController extends Controller {
  private userService = new UserService();

  /**
   * Get all users
   * @summary Retrieves a list of all users in the system
   */
  @Get()
  public async getUsers(): Promise<User[]> {
    return this.userService.getAll();
  }

  /**
   * Get user by ID
   * @summary Retrieves a single user by their unique identifier
   */
  @Get('{id}')
  public async getUser(@Path() id: string): Promise<User> {
    const user = await this.userService.getById(id);
    if (!user) {
      this.setStatus(404);
      throw new Error('User not found');
    }
    return user;
  }

  /**
   * Create a new user
   * @summary Creates a new user in the system
   */
  @Post()
  @SuccessResponse('201', 'Created')
  public async createUser(@Body() body: UserInput): Promise<User> {
    this.setStatus(201);
    return this.userService.create(body);
  }

  /**
   * Update a user
   * @summary Updates an existing user's information
   */
  @Put('{id}')
  public async updateUser(
    @Path() id: string,
    @Body() body: UserUpdate
  ): Promise<User> {
    return this.userService.update(id, body);
  }

  /**
   * Delete a user
   * @summary Deletes a user from the system
   */
  @Delete('{id}')
  @SuccessResponse('204', 'No Content')
  public async deleteUser(@Path() id: string): Promise<void> {
    await this.userService.delete(id);
    this.setStatus(204);
  }
}
