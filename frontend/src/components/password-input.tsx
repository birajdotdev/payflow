"use client";

import { EyeIcon, EyeOffIcon } from "lucide-react";
import React, { useState } from "react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "./ui/input-group";

interface PasswordInputProps extends React.ComponentProps<"input"> {
  icon?: React.ReactNode;
}

export function PasswordInput({ icon, ...props }: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState<boolean>(false);

  function togglePasswordVisibility() {
    setShowPassword((prev) => !prev);
  }

  return (
    <InputGroup>
      {icon && <InputGroupAddon>{icon}</InputGroupAddon>}
      <InputGroupInput {...props} type={showPassword ? "text" : "password"} />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          aria-label={showPassword ? "Hide password" : "Show password"}
          title={showPassword ? "Hide password" : "Show password"}
          onClick={togglePasswordVisibility}
        >
          {showPassword ? <EyeOffIcon /> : <EyeIcon />}
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  );
}
