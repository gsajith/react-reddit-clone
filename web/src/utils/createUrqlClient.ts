import { stringifyVariables } from "@urql/core";
import { cacheExchange, Resolver } from "@urql/exchange-graphcache";
import Router from "next/router";
import { dedupExchange, Exchange, fetchExchange } from "urql";
import { pipe, tap } from "wonka";
import {
  LoginMutation,
  LogoutMutation,
  MeDocument,
  MeQuery,
  RegisterMutation,
} from "../generated/graphql";
import { betterUpdateQuery } from "./betterUpdateQuery";

export interface PaginationParams {
  cursorArgument?: string;
}

export const cursorPagination = (): Resolver => {
  // const compareArgs = (
  //   fieldArgs: Variables,
  //   connectionArgs: Variables
  // ): boolean => {
  //   for (const key in connectionArgs) {
  //     if (key === cursorArgument || key === limitArgument) {
  //       continue;
  //     } else if (!(key in fieldArgs)) {
  //       return false;
  //     }

  //     const argA = fieldArgs[key];
  //     const argB = connectionArgs[key];

  //     if (
  //       typeof argA !== typeof argB || typeof argA !== "object"
  //         ? argA !== argB
  //         : stringifyVariables(argA) !== stringifyVariables(argB)
  //     ) {
  //       return false;
  //     }
  //   }

  //   for (const key in fieldArgs) {
  //     if (key === cursorArgument || key === limitArgument) {
  //       continue;
  //     }
  //     if (!(key in connectionArgs)) return false;
  //   }

  //   return true;
  // };

  return (_parent, fieldArgs, cache, info) => {
    const { parentKey: entityKey, fieldName } = info;
    const allFields = cache.inspectFields(entityKey);
    console.log("allFields", allFields);
    const fieldInfos = allFields.filter((info) => info.fieldName === fieldName);
    const size = fieldInfos.length;
    if (size === 0) {
      return undefined;
    }

    // Tells URQL we did not get all the data
    // info.partial = true;
    const fieldKey = `${fieldName}(${stringifyVariables(fieldArgs)})`;
    const isItInTheCache = cache.resolveFieldByKey(entityKey, fieldKey);
    info.partial = !isItInTheCache;

    // As we paginate, it's going to add more and more data to results
    let results: string[] = [];
    fieldInfos.forEach((fieldInfo) => {
      const data = cache.resolveFieldByKey(
        entityKey,
        fieldInfo.fieldKey
      ) as string[];
      results.push(...data);
    });

    return results;

    // const visited = new Set();
    // let result: NullArray<string> = [];
    // let prevOffset: number | null = null;

    // for (let i = 0; i < size; i++) {
    //   const { fieldKey, arguments: args } = fieldInfos[i];
    //   if (args === null || !compareArgs(fieldArgs, args)) {
    //     continue;
    //   }

    //   const links = cache.resolveFieldByKey(entityKey, fieldKey) as string[];
    //   const currentOffset = args[cursorArgument];

    //   if (
    //     links === null ||
    //     links.length === 0 ||
    //     typeof currentOffset !== "number"
    //   ) {
    //     continue;
    //   }

    //   if (!prevOffset || currentOffset > prevOffset) {
    //     for (let j = 0; j < links.length; j++) {
    //       const link = links[j];
    //       if (visited.has(link)) continue;
    //       result.push(link);
    //       visited.add(link);
    //     }
    //   } else {
    //     const tempResult: NullArray<string> = [];
    //     for (let j = 0; j < links.length; j++) {
    //       const link = links[j];
    //       if (visited.has(link)) continue;
    //       tempResult.push(link);
    //       visited.add(link);
    //     }
    //     result = [...tempResult, ...result];
    //   }

    //   prevOffset = currentOffset;
    // }

    // const hasCurrentPage = cache.resolve(entityKey, fieldName, fieldArgs);
    // if (hasCurrentPage) {
    //   return result;
    // } else if (!(info as any).store.schema) {
    //   return undefined;
    // } else {
    //   info.partial = true;
    //   return result;
    // }
  };
};

const errorExchange: Exchange = ({ forward }) => (ops$) => {
  return pipe(
    forward(ops$),
    tap(({ error }) => {
      if (error?.message.includes("Not authenticated")) {
        // Replaces current route in the history rather than pushing on a new entry
        // This is what you want to do when you redirect
        Router.replace("/login");
      }
    })
  );
};

export const createUrqlClient = (ssrExchange: any) => ({
  url: "http://localhost:4000/graphql",
  fetchOptions: {
    // Made this const to fix a type error... not sure how this fixes
    credentials: "include" as const,
  },
  exchanges: [
    dedupExchange,
    cacheExchange({
      resolvers: {
        Query: {
          // Client-side resolvers that run whenever query is run
          // Name should match whatever we have in posts.graphql
          posts: cursorPagination(),
        },
      },
      updates: {
        Mutation: {
          login: (_result, args, cache, info) => {
            // Runs whenever a login mutation runs to update cache
            // Updates the "MeQuery" and puts the user in there
            betterUpdateQuery<LoginMutation, MeQuery>(
              cache,
              { query: MeDocument },
              _result,
              (result, query) => {
                if (result.login.errors) {
                  return query;
                } else {
                  return {
                    me: result.login.user,
                  };
                }
              }
            );
          },
          register: (_result, args, cache, info) => {
            // Runs whenever a register mutation runs to update cache
            // Updates the "MeQuery" and puts the user in there
            betterUpdateQuery<RegisterMutation, MeQuery>(
              cache,
              { query: MeDocument },
              _result,
              (result, query) => {
                if (result.register.errors) {
                  return query;
                } else {
                  return {
                    me: result.register.user,
                  };
                }
              }
            );
          },
          logout: (_result, args, cache, info) => {
            // We want the MeQuery to return null
            betterUpdateQuery<LogoutMutation, MeQuery>(
              cache,
              { query: MeDocument },
              _result,
              () => ({
                me: null,
              })
            );
          },
        },
      },
    }),
    errorExchange,
    ssrExchange,
    fetchExchange,
  ],
});
