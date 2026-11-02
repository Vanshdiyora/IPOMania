import { forwardRef, useId, type ComponentProps } from "react";
import { FormField, Input, Select, Textarea } from "./Input";

type FieldProps = { label: string; error?: string; hint?: string; fieldClassName?: string };

export const FormInput = forwardRef<HTMLInputElement, ComponentProps<typeof Input> & FieldProps>(
  function FormInput({ label, error, hint, fieldClassName, id, ...props }, ref) {
    const generatedId = useId();
    const fieldId = id ?? generatedId;
    return (
      <FormField
        label={label}
        htmlFor={fieldId}
        error={error}
        hint={hint}
        required={props.required}
        className={fieldClassName}
      >
        <Input
          {...props}
          ref={ref}
          id={fieldId}
          aria-invalid={Boolean(error)}
          aria-describedby={
            error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : props["aria-describedby"]
          }
        />
      </FormField>
    );
  },
);

export const FormSelect = forwardRef<HTMLSelectElement, ComponentProps<typeof Select> & FieldProps>(
  function FormSelect({ label, error, hint, fieldClassName, id, ...props }, ref) {
    const generatedId = useId();
    const fieldId = id ?? generatedId;
    return (
      <FormField
        label={label}
        htmlFor={fieldId}
        error={error}
        hint={hint}
        required={props.required}
        className={fieldClassName}
      >
        <Select
          {...props}
          ref={ref}
          id={fieldId}
          aria-invalid={Boolean(error)}
          aria-describedby={
            error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : props["aria-describedby"]
          }
        />
      </FormField>
    );
  },
);

export const FormTextarea = forwardRef<
  HTMLTextAreaElement,
  ComponentProps<typeof Textarea> & FieldProps
>(function FormTextarea({ label, error, hint, fieldClassName, id, ...props }, ref) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  return (
    <FormField
      label={label}
      htmlFor={fieldId}
      error={error}
      hint={hint}
      required={props.required}
      className={fieldClassName}
    >
      <Textarea
        {...props}
        ref={ref}
        id={fieldId}
        aria-invalid={Boolean(error)}
        aria-describedby={
          error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : props["aria-describedby"]
        }
      />
    </FormField>
  );
});
