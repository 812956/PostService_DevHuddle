import { Request,Response,NextFunction } from "express";

export interface IShareController {
    sharePost(req:Request,res:Response,next:NextFunction):Promise<void>;
    getShareCount(req:Request,res:Response,next:NextFunction):Promise<void>;
    hasShared(req:Request,res:Response,next:NextFunction):Promise<void>;
}