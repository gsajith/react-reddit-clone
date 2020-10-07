import { Box, Button, Flex, Link } from "@chakra-ui/core";
import React from "react";
import NextLink from "next/link";
import { useLogoutMutation, useMeQuery } from "../generated/graphql";
import { isServer } from "../utils/isServer";

interface NavBarProps {}

const NavBar: React.FC<NavBarProps> = ({}) => {
  const [{ fetching: logoutFetching }, logout] = useLogoutMutation();

  // Use wherever we want to use the current user.
  // HOWEVER, since Navbar is in Index and Index is SSR'd
  // ... this hits the server whenever navbar is loaded
  // ... but the server doesn't have a user cookie so
  // this always returns null. We want to skip this.
  // const [{ data, fetching }] = useMeQuery();

  const [{ data, fetching }] = useMeQuery({
    pause: isServer(), // Don't run when we're on the server
  });

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
        <Button
          onClick={() => {
            logout();
          }}
          isLoading={logoutFetching}
          variant="link">
          Logout
        </Button>
      </Flex>
    );
  }

  return (
    <Flex position="sticky" top={0} p={4} zIndex={1} bg="tomato">
      <Box ml={"auto"}>{body}</Box>
    </Flex>
  );
};

export default NavBar;
