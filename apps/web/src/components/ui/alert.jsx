import * as React from "react"
import { cn } from "cn"

function Alert({ className, variant = "default", ...props }) {
  return (
    <div
      data-slot="alert"
      data-variant={variant}
      role="alert"
      className={cn("relative w-full rounded-lg border px-4 py-3 text-sm", className)}
      {...props} />
  )
}

function AlertTitle({ className, ...props }) {
  return (
    <div
      data-slot="alert-title"
      className={cn("font-medium leading-none", className)}
      {...props} />
  )
}

function AlertDescription({ className, ...props }) {
  return (
    <div
      data-slot="alert-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props} />
  )
}

export { Alert, AlertTitle, AlertDescription }
