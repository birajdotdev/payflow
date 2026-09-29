import { InputGroup, InputGroupAddon, InputGroupInput } from "./ui/input-group";

interface TextInputProps extends React.ComponentProps<"input"> {
  icon?: React.ReactNode;
}

export function TextInput({ icon, ...props }: TextInputProps) {
  return (
    <InputGroup>
      {icon && <InputGroupAddon>{icon}</InputGroupAddon>}
      <InputGroupInput {...props} />
    </InputGroup>
  );
}
