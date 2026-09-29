"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Controller,
  DefaultValues,
  FieldValues,
  Path,
  useForm,
} from "react-hook-form";
import { z } from "zod";
import { PasswordInput } from "./password-input";
import { TextInput } from "./text-input";
import { Button } from "./ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "./ui/field";
import { Spinner } from "./ui/spinner";

export interface FormField<T extends FieldValues> {
  name: Path<T>;
  label: string;
  type: "text" | "email" | "tel" | "password";
  placeholder?: string;
  icon?: React.ReactNode;
  autoComplete?: React.ComponentProps<"input">["autoComplete"];
}

interface AuthFormProps<T extends FieldValues> extends Omit<
  React.ComponentProps<"form">,
  "onSubmit"
> {
  id: string;
  formFields: FormField<T>[];
  formSchema: z.ZodType<T, T>;
  defaultValues: DefaultValues<T>;
  onSubmit: (data: T) => void | Promise<void>;
  submitLabel: string;
  pendingLabel: string;
  error?: string;
}

export function AuthForm<T extends FieldValues>({
  id,
  formFields,
  formSchema,
  defaultValues,
  onSubmit,
  submitLabel,
  pendingLabel,
  error,
  ...props
}: AuthFormProps<T>) {
  const form = useForm<T>({
    resolver: zodResolver(formSchema),
    defaultValues: defaultValues,
  });

  return (
    <form
      {...props}
      id={id}
      noValidate
      aria-busy={form.formState.isSubmitting}
      onSubmit={form.handleSubmit(onSubmit)}
    >
      <FieldGroup>
        {formFields.map((formField) => (
          <Controller
            key={formField.name}
            name={formField.name}
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={`${id}-${field.name}`}>
                  {formField.label}
                </FieldLabel>
                {formField.type === "password" ? (
                  <PasswordInput
                    {...field}
                    id={`${id}-${field.name}`}
                    autoComplete={formField.autoComplete}
                    aria-describedby={
                      fieldState.invalid
                        ? `${id}-${field.name}-error`
                        : undefined
                    }
                    icon={formField.icon}
                    aria-invalid={fieldState.invalid}
                    placeholder={formField.placeholder}
                  />
                ) : (
                  <TextInput
                    {...field}
                    id={`${id}-${field.name}`}
                    autoComplete={formField.autoComplete}
                    aria-describedby={
                      fieldState.invalid
                        ? `${id}-${field.name}-error`
                        : undefined
                    }
                    icon={formField.icon}
                    aria-invalid={fieldState.invalid}
                    type={formField.type}
                    placeholder={formField.placeholder}
                  />
                )}
                {fieldState.invalid && (
                  <FieldError
                    id={`${id}-${field.name}-error`}
                    errors={[fieldState.error]}
                  />
                )}
              </Field>
            )}
          />
        ))}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Field>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting && <Spinner aria-hidden="true" />}
            <span>
              {form.formState.isSubmitting ? pendingLabel : submitLabel}
            </span>
          </Button>
        </Field>
      </FieldGroup>
    </form>
  );
}
