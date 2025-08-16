import { NextFunction, Request, Response } from "express";
import { ZodTypeAny } from "zod";
import logger from "../utils/logger.util";

// export const validate = (InputData :any ) => {
//     try {
//       schema.parse(InputData);
//       console.log('the validation completed')
//     } catch (error: any) {
//       logger.error('schema validation failed .........')
//       return error.message || "Server Error";
//     }
//   };

  