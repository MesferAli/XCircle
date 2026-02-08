import type { Request, Response, NextFunction } from "express";

/**
 * Standard API error class for consistent error responses
 */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(statusCode: number, message: string, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  static badRequest(message: string): ApiError {
    return new ApiError(400, message);
  }

  static unauthorized(message = "Authentication required"): ApiError {
    return new ApiError(401, message);
  }

  static forbidden(message = "Insufficient permissions"): ApiError {
    return new ApiError(403, message);
  }

  static notFound(resource = "Resource"): ApiError {
    return new ApiError(404, `${resource} not found`);
  }

  static conflict(message: string): ApiError {
    return new ApiError(409, message);
  }

  static internal(message = "Internal server error"): ApiError {
    return new ApiError(500, message, false);
  }
}

/**
 * Standard API response envelope
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Centralized error handling middleware
 * Must be registered AFTER all routes
 */
export function errorHandler(
  err: Error | ApiError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Determine status code
  const statusCode = err instanceof ApiError ? err.statusCode : 500;

  // Log server errors
  if (statusCode >= 500) {
    console.error(`[ERROR] ${err.message}`, err.stack);
  }

  // Send consistent response
  const response: ApiResponse = {
    success: false,
    error: statusCode >= 500 && process.env.NODE_ENV === "production"
      ? "Internal server error"
      : err.message,
  };

  res.status(statusCode).json(response);
}
