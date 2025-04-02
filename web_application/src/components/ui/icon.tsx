import * as IoIcons from "react-icons/io5"

interface IconProps extends React.HTMLAttributes<HTMLDivElement> {
  name: string
  set: "io"
  className?: string
}

export function Icon({ name, className, ...props }: IconProps) {
  // Remove '-outline' from the name to match react-icons naming
  const iconName = name.replace("-outline", "")

  // Convert to pascal case and add Io prefix
  const iconComponentName = `Io${iconName
    .split("-")
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join("")}`

  const IconComponent = (IoIcons as any)[iconComponentName]

  if (!IconComponent) {
    console.warn(`Icon ${iconComponentName} not found`)
    return null
  }

  return <IconComponent className={className} {...props} />
}
