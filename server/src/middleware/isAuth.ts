import { MyContext } from "src/types";
import { MiddlewareFn } from "type-graphql";

// MiddlewareFN is Special class from type-graphql
export const isAuth: MiddlewareFn<MyContext> = ({ context }, next) => {
  if (!context.req.session.userId) {
    throw new Error("Not authenticated");
  }

  // Function to call if it's all good
  return next();
};
