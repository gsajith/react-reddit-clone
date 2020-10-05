import { Redis } from "ioredis";
import { Request, Response } from "express";

export type MyContext = {
  req: Request & { session: Express.Session };
  redis: Redis;
  res: Response;
};
