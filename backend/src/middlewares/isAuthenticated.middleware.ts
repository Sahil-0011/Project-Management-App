import { NextFunction, Request, Response } from "express";
import { UnauthorizedException } from "../utils/appError";

const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {

  if (!req.user || !req.user._id) {
    console.log(req.user?. _id)
    console.log("Unauthorized. Please log in." , req.user ,"req.user")
    throw new UnauthorizedException("Unauthorized. Please log in.");
  }
  next();
};

export default isAuthenticated;
