"use client";

import { useState } from "react";
import { notifySessionChange } from "@/lib/auth/notify-session-change";
import { loginAction } from "@/lib/auth/actions";
import { cn } from "cn";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldDescription } from "@/components/ui/field";
import { loginSchema, LoginSchema } from "@/lib/validation/auth/login-schema";
import { LockIcon, MailIcon } from "lucide-react";
import Link from "next/link";
import { AuthForm, FormField } from "./auth-form";

const formFields: FormField<LoginSchema>[] = [
  {
    name: "email",
    label: "Email",
    type: "email",
    autoComplete: "email",
    placeholder: "m@example.com",
    icon: <MailIcon />,
  },
  {
    name: "password",
    label: "Password",
    type: "password",
    autoComplete: "current-password",
    placeholder: "••••••••",
    icon: <LockIcon />,
  },
];

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [submitError, setSubmitError] = useState<string>();

  async function handleSubmit(data: LoginSchema) {
    setSubmitError(undefined);
    try {
      const result = await loginAction(data);
      if (!result.ok) {
        setSubmitError(result.error);
        return;
      }
      // A document navigation discards the previous account's client state.
      notifySessionChange();
      window.location.assign("/dashboard");
    } catch {
      setSubmitError("Unable to connect to PayFlow. Please try again.");
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">
            <h1>Welcome back</h1>
          </CardTitle>
          <CardDescription>Login to your PayFlow account</CardDescription>
        </CardHeader>
        <CardContent>
          <AuthForm<LoginSchema>
            id="login-form"
            formFields={formFields}
            formSchema={loginSchema}
            defaultValues={{
              email: "",
              password: "",
            }}
            onSubmit={handleSubmit}
            submitLabel="Log in"
            pendingLabel="Signing in…"
            error={submitError}
          />
        </CardContent>
        <CardFooter className="flex flex-col items-center">
          <FieldDescription className="text-center">
            Don&apos;t have an account? <Link href="/signup">Sign up</Link>
          </FieldDescription>
        </CardFooter>
      </Card>
      <FieldDescription className="px-6 text-center">
        PayFlow is a demo wallet. All funds are simulated.
      </FieldDescription>
    </div>
  );
}
