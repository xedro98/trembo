"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "~/lib/utils";

const buttonVariants = cva(
  "btn-surface inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-[3px] border font-medium text-base capitalize outline-none transition-[background-color,border-color,color] focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 pointer-coarse:after:absolute pointer-coarse:after:size-full pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11 sm:text-sm",
  {
    defaultVariants: {
      size: "default",
      variant: "default",
    },
    variants: {
      size: {
        default: "h-10 px-5 py-2.5",
        icon: "size-10",
        "icon-lg": "size-10",
        "icon-sm": "size-9",
        "icon-xl": "size-11",
        "icon-xs": "size-7",
        lg: "h-11 rounded-[3px] px-8",
        sm: "h-9 rounded-[3px] px-3.5 text-xs",
        xl: "h-11 px-8 text-lg sm:text-base",
        xs: "h-7 gap-1 rounded-[3px] px-2 text-sm sm:text-xs",
      },
      variant: {
        default:
          "btn-shine-filled border-[color:var(--btn-filled-bg)] text-[color:var(--btn-filled-fg)] hover:text-[color:var(--btn-filled-fg)] [:hover,[data-pressed]]:border-[color:var(--btn-filled-bg-hover)]",
        destructive:
          "btn-shine-destructive border-destructive text-destructive-foreground hover:text-destructive-foreground [:hover,[data-pressed]]:bg-destructive/90",
        "destructive-outline":
          "btn-shine-outline border border-[color:var(--input-surface-border)] text-destructive-foreground [:hover,[data-pressed]]:border-destructive/32 [:hover,[data-pressed]]:bg-destructive/4",
        ghost:
          "border-transparent text-foreground [:hover,[data-pressed]]:bg-accent/80 [:hover,[data-pressed]]:text-foreground",
        link: "border-transparent text-brand underline-offset-4 [:hover,[data-pressed]]:underline",
        outline:
          "btn-shine-outline border border-[color:var(--input-surface-border)] text-foreground [:hover,[data-pressed]]:border-[color:var(--input-surface-border-focus)] dark:[:hover,[data-pressed]]:bg-muted/35",
        secondary:
          "btn-shine-muted border border-transparent bg-secondary text-secondary-foreground [:hover,[data-pressed]]:bg-secondary/90 dark:border-[color:var(--border)] dark:bg-muted/30 dark:text-foreground dark:[:hover,[data-pressed]]:bg-muted/45",
      },
    },
  },
);

interface ButtonProps extends useRender.ComponentProps<"button"> {
  variant?: VariantProps<typeof buttonVariants>["variant"];
  size?: VariantProps<typeof buttonVariants>["size"];
}

function Button({ className, variant, size, render, ...props }: ButtonProps) {
  const typeValue: React.ButtonHTMLAttributes<HTMLButtonElement>["type"] = render
    ? undefined
    : "button";

  const defaultProps = {
    className: cn(buttonVariants({ className, size, variant })),
    "data-slot": "button",
    type: typeValue,
  };

  return useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(defaultProps, props),
    render,
  });
}

export { Button, buttonVariants };
