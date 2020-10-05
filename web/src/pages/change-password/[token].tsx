// This file's naming is a convention in NextJS if we want a variable in the URL
// In this cases the variable is the pw reset token
import { Box, Button, Flex, Link } from "@chakra-ui/core";
import { Formik, Form } from "formik";
import { NextPage } from "next";
import { withUrqlClient } from "next-urql";
import { useRouter } from "next/dist/client/router";
import React, { useState } from "react";
import InputField from "../../components/InputField";
import Wrapper from "../../components/Wrapper";
import { useChangePasswordMutation } from "../../generated/graphql";
import { createUrqlClient } from "../../utils/createUrqlClient";
import { toErrorMap } from "../../utils/toErrorMap";
import NextLink from "next/link";

const ChangePassword: NextPage<{ token: string }> = ({ token }) => {
  const router = useRouter();
  const [, changePassword] = useChangePasswordMutation();
  const [tokenError, setTokenError] = useState("");

  return (
    <Wrapper variant="small">
      <Formik
        initialValues={{ newPassword: "" }}
        onSubmit={async (values, { setErrors }) => {
          const response = await changePassword({
            newPassword: values.newPassword,
            token,
          });
          if (response.data?.changePassword.errors) {
            const errorMap = toErrorMap(response.data.changePassword.errors);
            if ("token" in errorMap) {
              // Need to handle this differently because we don't have a token field in UI
              setTokenError(errorMap.token);
            }
            setErrors(errorMap);
          } else if (response.data?.changePassword.user) {
            // Register worked
            router.push("/");
          }
        }}>
        {({ isSubmitting }) => (
          <Form>
            <InputField
              name="newPassword"
              placeholder="New password"
              label="New password"
              type="password"
            />
            {tokenError && (
              <Box>
                <Box color="tomato">{tokenError}</Box>
                <NextLink href="/forgot-password">
                  <Link>Click here to get a new one.</Link>
                </NextLink>
              </Box>
            )}
            <Button
              mt={4}
              type="submit"
              colorScheme="orange"
              isLoading={isSubmitting}
              variant="solid">
              Change password
            </Button>
          </Form>
        )}
      </Formik>
    </Wrapper>
  );
};

// Build-in special NextJS function
// Get any query params and pass it to our component
// NextJS also has "getServerProps" for something we'd want to run on the server ??
ChangePassword.getInitialProps = ({ query }) => {
  return {
    token: query.token as string,
  };
};

export default withUrqlClient(createUrqlClient)(ChangePassword);
