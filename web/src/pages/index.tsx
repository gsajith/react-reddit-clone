import { withUrqlClient } from "next-urql";
import Layout from "../components/Layout";
import { usePostsQuery } from "../generated/graphql";
import { createUrqlClient } from "../utils/createUrqlClient";
import NextLink from "next/link";
import { Box, Button, Flex, Heading, Link, Stack, Text } from "@chakra-ui/core";
import React, { useState } from "react";

const Index = () => {
  const [variables, setVariables] = useState({
    limit: 15,
    cursor: null as null | string,
  });
  const [{ data, fetching }] = usePostsQuery({
    variables,
  });

  if (!fetching && !data) {
    // TODO: Something went wrong?
    return <div>No posts loaded.</div>;
  }

  return (
    <Layout>
      <Flex align="center">
        <Heading>jury.gifts</Heading>
        <NextLink href="/create-post">
          <Link ml={"auto"}>Create post</Link>
        </NextLink>
      </Flex>
      <br />
      <br />
      {!data && fetching ? (
        <div>Loading...</div>
      ) : (
        <Stack spacing={8}>
          {data!.posts.posts.map((p) => (
            <Box key={p.id} p={5} shadow="md" borderWidth="1px">
              <Heading fontSize="xl">{p.title}</Heading>{" "}
              <Text>Posted by {p.creator.username}</Text>
              <Text mt={4}>{p.textSnippet}</Text>
            </Box>
          ))}
        </Stack>
      )}
      {data && data.posts.hasMore ? (
        <Flex>
          <Button
            onClick={() => {
              setVariables({
                limit: variables.limit,
                cursor: data.posts.posts[data.posts.posts.length - 1].createdAt, // Use last createdAt as cursor
              });
            }}
            isLoading={fetching}
            m={"auto"}
            my={8}>
            Load more
          </Button>
        </Flex>
      ) : null}
    </Layout>
  );
};

// Only need SSR if you're doing a query on the page that needs to be seen for SEO
// =========== Explanation of how SSR works ===============
// me -> browse http://localhost:3000
// -> next.js server
// -> request graphql server at localhost:4000
// -> building the HTML
// -> sending back to your browser
// NextJS only does SSR for first page load... after that it will do client-side renders
// e.g. load index -> go to login page and refresh to clear cache
// -> hit back to index -> it is client-side loaded
export default withUrqlClient(createUrqlClient, { ssr: true })(Index);
