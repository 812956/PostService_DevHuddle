import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { Request, Response, NextFunction } from 'express';
import { CustomError } from '../utils/error.util';
import { HttpStatus } from '../constands/http.status';

export function validateDto(dtoClass: any) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const dtoObject = plainToInstance(dtoClass, req.body);
    const errors: ValidationError[] = await validate(dtoObject, { 
      whitelist: true, // strip properties that don't have decorators
      forbidNonWhitelisted: true // throw error if non-whitelisted properties are present
    });

    if (errors.length > 0) {
      const messages = errors.map((error: ValidationError) => {
        return Object.values(error.constraints || {}).join(', ');
      }).join('; ');
      
      const error = new CustomError(HttpStatus.BAD_REQUEST, `Validation failed: ${messages}`);
      return next(error);
    }

    // Attach validated DTO to request body (optional, but good for type safety downstream if desired)
    // req.body = dtoObject;
    next();
  };
}
