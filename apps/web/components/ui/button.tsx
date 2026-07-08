import { type VariantProps, cva } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

// Exported so links can be styled as buttons — nesting <button> inside <a> is
// invalid HTML and confuses screen readers.
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-[transform,background-color,color] duration-150 ease-out active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ground disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-fg text-ground hover:bg-fg/90",
        accent: "bg-accent text-on-accent hover:bg-accent/90",
        outline: "border border-fg/15 text-fg hover:bg-fg/5",
        ghost: "text-fg hover:bg-fg/5",
      },
      size: {
        sm: "h-9 px-4 text-sm",
        md: "h-10 px-5 text-sm",
        lg: "h-12 px-7 text-base",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button className={cn(buttonVariants({ variant, size }), className)} {...props} />
  );
}
