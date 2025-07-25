import { Request, Response } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.middleware";
import { HTTPSTATUS } from "../config/http.config";
import { getCurrentUserService } from "../services/user.service";

export const getCurrentUserController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    console.log(" userId" , userId)
    const user = await getCurrentUserService(userId);
    console.log(" user" , user)
    return res.status(HTTPSTATUS.OK).json({
      message: "User fetch successfully",
      user,
    });
  }
);
