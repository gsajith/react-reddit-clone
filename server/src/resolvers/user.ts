import argon2 from "argon2";
import {
  Arg,
  Ctx,
  Field,
  FieldResolver,
  Mutation,
  ObjectType,
  Query,
  Resolver,
  Root,
} from "type-graphql";
import { getConnection } from "typeorm";
import { v4 } from "uuid";
import { User } from "../entities/User";
import { MyContext } from "../types";
import { sendEmail } from "../utils/sendEmail";
import { COOKIE_NAME, FORGOT_PASSWORD_PREFIX } from "./../constants";
import { validateRegister } from "./../utils/validateRegister";
import { UsernamePasswordInput } from "./UsernamePasswordInput";

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

@Resolver(User)
export class UserResolver {
  @FieldResolver(() => String)
  email(@Root() user: User, @Ctx() { req }: MyContext) {
    // This is the current user and it's okay to show them their own email
    if (req.session.userId === user.id) {
      return user.email;
    }

    // The current user wants to see someone else's email
    return "";
  }

  @Query(() => User, { nullable: true })
  me(@Ctx() { req }: MyContext) {
    if (!req.session.userId) {
      // You are not logged in
      return null;
    }

    return User.findOne(req.session.userId);
  }

  @Mutation(() => UserResponse)
  async register(
    @Arg("options") options: UsernamePasswordInput,
    @Ctx() { req }: MyContext
  ): Promise<UserResponse> {
    const errors = validateRegister(options);
    if (errors) {
      return { errors };
    }

    const hashedPassword = await argon2.hash(options.password);
    let user;
    try {
      // We could have just done this...
      // User.create({
      //   username: options.username,
      //   email: options.email,
      //   password: hashedPassword
      // }).save()

      // How to use the query builder
      const result = await getConnection()
        .createQueryBuilder()
        .insert()
        .into(User)
        .values({
          username: options.username,
          email: options.email,
          password: hashedPassword,
        })
        .returning("*") // Return us back the fields
        .execute();
      user = result.raw[0];
    } catch (err) {
      if (
        err.code === "23505" ||
        (err.detail && err.detail.includes("already exists"))
      ) {
        return {
          errors: [
            {
              field: "username",
              message: "Username or email is already in use.",
            },
            {
              field: "email",
              message: "Username or email is already in use.",
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
    return { user };
  }

  @Mutation(() => UserResponse)
  async login(
    @Arg("usernameOrEmail") usernameOrEmail: string,
    @Arg("password") password: string,
    @Ctx() { req }: MyContext
  ): Promise<UserResponse> {
    const user = await User.findOne(
      usernameOrEmail.includes("@")
        ? { where: { email: usernameOrEmail.toLowerCase() } }
        : { where: { username: usernameOrEmail.toLowerCase() } }
    );
    if (!user) {
      return {
        errors: [
          {
            field: "usernameOrEmail",
            message: "Invalid username, email or password.",
          },
          {
            field: "password",
            message: "Invalid username, email or password.",
          },
        ],
      };
    }

    const valid = await argon2.verify(user.password, password);
    if (!valid) {
      return {
        errors: [
          {
            field: "usernameOrEmail",
            message: "Invalid username, email or password.",
          },
          {
            field: "password",
            message: "Invalid username, email or password.",
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

  @Mutation(() => UserResponse)
  async changePassword(
    @Arg("token") token: string,
    @Arg("newPassword") newPassword: string,
    @Ctx() { redis, req }: MyContext
  ): Promise<UserResponse> {
    // TODO: This is duplicated from validation - abstract it out
    if (newPassword.length <= 3) {
      return {
        errors: [
          {
            field: "newPassword",
            message: "Password must be longer than 3 characters.",
          },
        ],
      };
    }

    const userId = await redis.get(FORGOT_PASSWORD_PREFIX + token);
    if (!userId) {
      return {
        errors: [
          {
            field: "token",
            message: "Token expired.",
          },
        ],
      };
    }

    // Redis may store all it's values as strings and we're using an int for the ID
    const userIdNum = parseInt(userId);
    const user = await User.findOne(userIdNum);

    if (!user) {
      // This shouldn't ever happen but...
      return {
        errors: [
          {
            field: "token",
            message: "This user doesn't exist.",
          },
        ],
      };
    }

    await User.update(
      { id: userIdNum },
      {
        password: await argon2.hash(newPassword),
      }
    );

    // Remove the key from redis so it can't be re-used to change password again
    await redis.del(FORGOT_PASSWORD_PREFIX + token);

    // Log in user after change password
    // Optional
    // TODO: Maybe remove this?
    req.session.userId = user.id;

    return { user };
  }

  @Mutation(() => Boolean)
  async forgotPassword(
    @Arg("email") email: string,
    @Ctx() { redis }: MyContext
  ) {
    // Since email is not our primary key, we have to say "where"
    const user = await User.findOne({ where: { email } });
    if (!user) {
      // The email is not in the DB
      // We're returning true because we dont want to tell them the email doesn't exist
      return true;
    }

    const token = v4(); // 'qwuwoi-fjaskoj23-23dkfj'

    await redis.set(
      FORGOT_PASSWORD_PREFIX + token,
      user.id,
      "ex",
      1000 * 60 * 60 * 24 * 3 // Forgot PW link is good for 3 days
    );

    await sendEmail(
      email,
      "Recover your password",
      `<a href="http://localhost:3000/change-password/${token}">Reset password</a>`
    );
    return true;
  }
}
