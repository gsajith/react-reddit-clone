import "reflect-metadata";
import express from "express";
import { buildSchema } from "type-graphql";
import { PostResolver } from "./resolvers/post";
import { HelloResolver } from "./resolvers/hello";
import { UserResolver } from "./resolvers/user";
import { MikroORM } from "@mikro-orm/core";
import microConfig from "./mikro-orm.config";
import session from "express-session";
import { ApolloServer } from "apollo-server-express";
import redis from "redis";
import connectRedis from "connect-redis";
import { __prod__ } from "./constants";
import cors from "cors";
// import { Post } from './entities/Post';

const main = async () => {
  // Set up MikroORM, makes postgres operations easier
  const orm = await MikroORM.init(microConfig);

  // Run migrations if any - matched to a pg table of past migrations so won't re-run
  // npm run create:migrations
  await orm.getMigrator().up();

  const app = express();

  // Create redis client which connects to your local redis service
  // Somewhere between MongoDB (no-sql database) and memcached (caching system)
  // https://gist.github.com/tomysmile/1b8a321e7c58499ef9f9441b2faa0aa8
  const RedisStore = connectRedis(session);
  const redisClient = redis.createClient();

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
      name: "qid",
      store: new RedisStore({
        client: redisClient,
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
    context: ({ req, res }) => ({ em: orm.em, req, res }),
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
