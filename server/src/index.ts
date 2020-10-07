import "reflect-metadata";
import express from "express";
import { buildSchema } from "type-graphql";
import { PostResolver } from "./resolvers/post";
import { HelloResolver } from "./resolvers/hello";
import { UserResolver } from "./resolvers/user";
import { createConnection } from "typeorm";
import session from "express-session";
import { ApolloServer } from "apollo-server-express";
import Redis from "ioredis";
import connectRedis from "connect-redis";
import { COOKIE_NAME, __prod__ } from "./constants";
import cors from "cors";
import { Post } from "./entities/Post";
import { User } from "./entities/User";
import path from "path";

const main = async () => {
  const conn = await createConnection({
    type: "postgres",
    database: "gifts",
    username: "postgres",
    password: "postgres",
    logging: true,
    synchronize: true, // Will create the tables automatically for you and don't need to run a migration
    migrations: [path.join(__dirname, "./migrations/*")],
    entities: [Post, User],
  });

  await conn.runMigrations();

  // await Post.delete({});

  const app = express();

  // Create redis client which connects to your local redis service
  // Somewhere between MongoDB (no-sql database) and memcached (caching system)
  // https://gist.github.com/tomysmile/1b8a321e7c58499ef9f9441b2faa0aa8
  const RedisStore = connectRedis(session);
  const redis = new Redis();

  // Sets CORS to apply on all routs
  app.use(
    // '/', // Could set this to be only on certain route
    cors({
      origin: "http://localhost:3000", // Set CORS header to client URL,
      credentials: true,
    })
  );

  // Use redis middleware
  app.use(
    session({
      name: COOKIE_NAME,
      store: new RedisStore({
        client: redis,
        // disableTTL: true, // Keep sessions forever
        // disableTouch: true, // Don't touch every time user pings redis
      }),
      cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 365 * 10, // 10 years
        httpOnly: true, // JS code on front-end cannot access the cookie
        secure: __prod__, // Cookie only works in https (TURN OFF if not using HTTPS in prod)
        sameSite: "lax", // csrf
      },
      saveUninitialized: false, // Don't store empty sessions
      secret: "do not fold my diploma", // Make this an env variable
      resave: false,
    })
  );

  // GraphQL setup middleware
  const apolloServer = new ApolloServer({
    schema: await buildSchema({
      resolvers: [HelloResolver, PostResolver, UserResolver],
      validate: false, // I guess we don't like the default validation?
    }),
    context: ({ req, res }) => ({ req, res, redis }),
  });

  apolloServer.applyMiddleware({
    app,
    cors: false,
  });

  app.listen(4000, () => {
    console.log("server started on localhost:4000");
  });
};

main().catch((err) => {
  console.log(err);
});
