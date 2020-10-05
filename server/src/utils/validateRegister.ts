import { UsernamePasswordInput } from "src/resolvers/UsernamePasswordInput";

export const validateRegister = (options: UsernamePasswordInput) => {
  // TODO: Better email validation
  if (!options.email.includes("@") || !options.email.includes(".")) {
    return [
      {
        field: "email",
        message: "Invalid email.",
      },
    ];
  }

  // TODO: Better username validation
  // Don't allow non-alpha/digit characters
  if (options.username.length <= 2) {
    return [
      {
        field: "username",
        message: "Username must be longer than 2 characters.",
      },
    ];
  }

  if (options.username.includes("@") || options.username.includes(".")) {
    return [
      {
        field: "username",
        message: "Username has invalid characters (@ or .).",
      },
    ];
  }

  if (options.password.length <= 3) {
    return [
      {
        field: "password",
        message: "Password must be longer than 3 characters.",
      },
    ];
  }

  return null;
};
