import { Box, Button, Flex, Link } from "@chakra-ui/core";
import React from "react";
import NextLink from "next/link";
import { useMeQuery } from "../generated/graphql";

interface NavBarProps {}

const NavBar: React.FC<NavBarProps> = ({}) => {
  const [{ data, fetching }] = useMeQuery();

  let body = null;

  if (fetching) {
    // Data is loading
    body = null;
  } else if (!data?.me) {
    // User not logged in
    body = (
      <>
        <NextLink href="/login">
          <Link color="brown" mr={2}>
            Login
          </Link>
        </NextLink>

        <NextLink href="/register">
          <Link color="brown">Register</Link>
        </NextLink>
      </>
    );
  } else {
    // User is logged in
    body = (
      <Flex>
        <Box mr={2}>{data.me.username}</Box>
        <Button variant="link">Logout</Button>
      </Flex>
    );
  }

  return (
    <Flex p={4} bg="tomato">
      <Box ml={"auto"}>{body}</Box>
    </Flex>
  );
};

export default NavBar;
