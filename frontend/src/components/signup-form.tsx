"use client";

import { useState } from "react";
import { signupAction } from "@/lib/auth/actions";
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
import {
  signupSchema,
  SignupSchema,
} from "@/lib/validation/auth/signup-schema";
import { LockIcon, MailIcon, PhoneIcon, UserIcon } from "lucide-react";
import Link from "next/link";
import { AuthForm, FormField } from "./auth-form";

const formFields: FormField<SignupSchema>[] = [
  {
    name: "fullName",
    label: "Full Name",
    type: "text",
    autoComplete: "name",
    placeholder: "John Doe",
    icon: <UserIcon />,
  },
  {
    name: "email",
    label: "Email",
    type: "email",
    autoComplete: "email",
    placeholder: "m@example.com",
    icon: <MailIcon />,
  },
  {
    name: "phone",
    label: "Phone Number",
    type: "tel",
    autoComplete: "tel",
    placeholder: "+9779812345678",
    icon: <PhoneIcon />,
  },
  {
    name: "password",
    label: "Password",
    type: "password",
    autoComplete: "new-password",
    placeholder: "••••••••",
    icon: <LockIcon />,
  },
];

export function SignupForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [submitError, setSubmitError] = useState<string>();

  async function handleSubmit(data: SignupSchema) {
    setSubmitError(undefined);
    try {
      const result = await signupAction(data);
      if (!result.ok) {
        setSubmitError(result.error);
        return;
      }
      // A document navigation discards the previous account's client state.
      window.location.assign("/login?registered=1");
    } catch {
      setSubmitError("Unable to connect to PayFlow. Please try again.");
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">
            <h1>Create your account</h1>
          </CardTitle>
          <CardDescription>
            Create a wallet for simulated NPR funds
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AuthForm<SignupSchema>
            id="signup-form"
            formFields={formFields}
            formSchema={signupSchema}
            defaultValues={{
              fullName: "",
              email: "",
              phone: "",
              password: "",
            }}
            onSubmit={handleSubmit}
            submitLabel="Create account"
            pendingLabel="Creating account…"
            error={submitError}
          />
        </CardContent>
        <CardFooter className="flex flex-col items-center">
          <FieldDescription className="text-center">
            Already have an account? <Link href="/login">Sign in</Link>
          </FieldDescription>
        </CardFooter>
      </Card>
      <FieldDescription className="px-6 text-center">
        PayFlow is a demo wallet. All funds are simulated.
      </FieldDescription>
    </div>
  );
}
