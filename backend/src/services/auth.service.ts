import mongoose from "mongoose";
import UserModel from "../models/user.model";
import AccountModel from "../models/account.model";
import WorkspaceModel from "../models/workspace.model";
import RoleModel from "../models/roles-permission.model";
import { Roles } from "../enums/role.enum";
import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from "../utils/appError";
import MemberModel from "../models/member.model";
import { ProviderEnum } from "../enums/account-provider.enum";
import { RolePermissions } from "../utils/role-permission";

export const loginOrCreateAccountService = async (data: {
  provider: string;
  displayName: string;
  providerId: string;
  picture?: string;
  email?: string;
}): Promise<{ userId: any; workspaceId: any }> => {
  const { providerId, provider, displayName, email, picture } = data;

  if (!email) {     
    throw new BadRequestException("Email is required for authentication");
  }

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    // Try to find existing user
    let user = await UserModel.findOne({ email }).session(session);
    let workspace;

    if (!user) {
      // Create new user and related entities in a transaction
      const [createdUser] = await UserModel.create([{
        email,
        name: displayName,
        profilePicture: picture || null,
      }], { session });

      await AccountModel.create([{
        userId: createdUser._id,
        provider,
        providerId,
      }], { session });

      // Create workspace
      const [createdWorkspace] = await WorkspaceModel.create([{
        name: `${displayName}'s Workspace`,
        description: `Workspace for ${displayName}`,
        owner: createdUser._id,
      }], { session });
      workspace = createdWorkspace;

      // Get or create Owner role
      let ownerRole = await RoleModel.findOne({
        name: Roles.OWNER,
      }).session(session);

      if (!ownerRole) {
        [ownerRole] = await RoleModel.create([{
          name: Roles.OWNER,
          permissions: ['all'] // Default permissions for owner
        }], { session });
      }

      // Create member relationship
      await MemberModel.create([{
        userId: createdUser._id,
        workspaceId: workspace._id,
        role: ownerRole._id,
        joinedAt: new Date(),
      }], { session });

      // Update user's current workspace
      await UserModel.findByIdAndUpdate(
        createdUser._id,
        { currentWorkspace: workspace._id },
        { session }
      );

      user = createdUser;
    } else {
      // Update last login for existing user
      await UserModel.findByIdAndUpdate(
        user._id,
        { lastLogin: new Date() },
        { session }
      );
      
      // Get user's current workspace
      workspace = await WorkspaceModel.findById(user.currentWorkspace).session(session);
      if (!workspace) {
        throw new NotFoundException("User's workspace not found");
      }
    }

    await session.commitTransaction();
    return { userId: user._id, workspaceId: workspace._id };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

export const registerUserService = async (body: {
  email: string;
  name: string;
  password: string;
}): Promise<{ userId:any; workspaceId:any }> => {
  const { email, name, password } = body;
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    // 1. Check if user exists
    const existingUser = await UserModel.findOne({ email }).session(session);
    if (existingUser) {
      throw new BadRequestException("Email already exists");
    }

    // 2. Create user
    const [user] = await UserModel.create([{
      email,
      name,
      password,
    }], { session });

    // 3. Create account
    await AccountModel.create([{
      userId: user._id,
      provider: ProviderEnum.EMAIL,
      providerId: email,
    }], { session });

    // 4. Create workspace
    const [workspace] = await WorkspaceModel.create([{
      name: `${name}'s Workspace`,
      description: `Workspace for ${name}`,
      owner: user._id,
    }], { session });

    // 5. Get or create Owner role
    let ownerRole = await RoleModel.findOne({
      name: Roles.OWNER,
    }).session(session);
    console.log(ownerRole)

    if (!ownerRole) {
      console.warn("Owner role not found, creating it...");
      [ownerRole] = await RoleModel.create([{
        name: Roles.OWNER,
        permissions: RolePermissions[Roles.OWNER] || ['all']
      }], { session });
      console.log(ownerRole);
    }

    // 6. Create member relationship
    await MemberModel.create([{
      userId: user._id,
      workspaceId: workspace._id,
      role: ownerRole._id,
      joinedAt: new Date(),
    }], { session });


    // 7. Set user's current workspace
    await UserModel.findByIdAndUpdate(
      user._id,
      { currentWorkspace: workspace._id },
      { session }
    );

    await session.commitTransaction();

    return {
      userId: user._id,
      workspaceId: workspace._id,
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

export const verifyUserService = async ({
  email,
  password,
  provider = ProviderEnum.EMAIL,
}: {
  email: string;
  password: string;
  provider?: string;
}) => {
  const account = await AccountModel.findOne({ provider, providerId: email });
  if (!account) {
    throw new NotFoundException("Invalid email or password");
  }

  const user = await UserModel.findById(account.userId);

  if (!user) {
    throw new NotFoundException("User not found for the given account");
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new UnauthorizedException("Invalid email or password");
  }

  return user.omitPassword();
};
