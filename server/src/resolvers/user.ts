import { COOKIE_NAME } from "./../constants";
import { User } from "../entities/User";
import { MyContext } from "../types";
import {
  Resolver,
  Mutation,
  Arg,
  InputType,
  Field,
  Ctx,
  ObjectType,
  Query,
} from "type-graphql";
import argon2 from "argon2";
import { EntityManager } from "@mikro-orm/postgresql";

@InputType()
class UsernamePasswordInput {
  @Field()
  username: string;

  @Field()
  password: string;
}

@ObjectType()
class FieldError {
  @Field()
  field: string;

  @Field()
  message: string;
}

@ObjectType()
class UserResponse {
  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];

  @Field(() => User, { nullable: true })
  user?: User;
}

@Resolver()
export class UserResolver {
  @Query(() => User, { nullable: true })
  async me(@Ctx() { em, req }: MyContext) {
    if (!req.session.userId) {
      // You are not logged in
      return null;
    }

    const user = await em.findOne(User, { id: req.session.userId });
    return user;
  }

  @Mutation(() => UserResponse)
  async register(
    @Arg("options") options: UsernamePasswordInput,
    @Ctx() { em, req }: MyContext
  ): Promise<UserResponse> {
    if (options.username.length <= 2) {
      return {
        errors: [
          {
            field: "username",
            message: "Username must be longer than 2 characters.",
          },
        ],
      };
    }

    if (options.password.length <= 3) {
      return {
        errors: [
          {
            field: "password",
            message: "Password must be longer than 3 characters.",
          },
        ],
      };
    }

    const hashedPassword = await argon2.hash(options.password);
    let user;
    try {
      // em.persistAndFlush(user); // Did this with the query builder instead

      // em.persistAndFlush() was doing something weird when user already existed
      const result = await (em as EntityManager)
        .createQueryBuilder(User)
        .getKnexQuery()
        .insert({
          username: options.username,
          password: hashedPassword,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning("*");
      user = result[0];
    } catch (err) {
      if (err.detail && err.detail.includes("already exists")) {
        return {
          errors: [
            {
              field: "username",
              message: "Username is already in use.",
            },
          ],
        };
      }
    }

    // Store user ID session
    // This will set a cookie on the user and keep them logged in
    req.session.userId = user.id;

    // We need to do this the query builder sets created_at and updated_at
    // But not createdAt and updatedAt
    return {
      user: {
        ...user,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      },
    };
  }

  @Mutation(() => UserResponse)
  async login(
    @Arg("options") options: UsernamePasswordInput,
    @Ctx() { em, req }: MyContext
  ): Promise<UserResponse> {
    const user = await em.findOne(User, {
      username: options.username.toLowerCase(),
    });
    if (!user) {
      return {
        errors: [
          {
            field: "username",
            message: "Invalid username or password.",
          },
        ],
      };
    }

    const valid = await argon2.verify(user.password, options.password);
    if (!valid) {
      return {
        errors: [
          {
            field: "password",
            message: "Invalid username or password.",
          },
        ],
      };
    }

    // Log in the user
    req.session.userId = user.id;

    // =========== Sessions + Redis explanation ===========
    // {userId: 1} -> Send that to redis - a key:value store
    // 1. Store in redis
    // sess:ajsdkfqjldfjqsdfsdfl -> {userId: 1}
    //
    // 2. Encrypted key sent to browser
    // express-session will set a cookie on my browser: djfkqjdklfqwjdkf2oir2jwfkl (signed version of redis key)
    // This gets stored in browser
    //
    // 3. User makes a request... Encrypted key sent to server
    // djfkqjdklfqwjdkf2oir2jwfkl -> sent to the server
    //
    // 4. On server, it decrypts it using "secret" specified on session init
    // djfkqjdklfqwjdkf2oir2jwfkl -> sess:ajsdkfqjldfjqsdfsdfl
    //
    // 5. Make a request to redit
    // sess:ajsdkfqjldfjqsdfsdfl -> {userId: 1}

    return {
      user,
    };
  }

  @Mutation(() => Boolean)
  logout(@Ctx() { req, res }: MyContext) {
    // Remove the session from redis
    return new Promise((resolve) =>
      req.session.destroy((err) => {
        // Cookie name that we set elsewhere
        res.clearCookie(COOKIE_NAME);

        if (err) {
          console.log(err);
          resolve(false);
          return;
        }

        resolve(true);
      })
    );
  }
}
