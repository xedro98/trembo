"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "~/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2 py-px text-xs font-medium capitalize whitespace-nowrap transition-colors border [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3",
  {
    defaultVariants: {
      variant: "default",
    },
    variants: {
      variant: {
        default: "bg-muted text-muted-foreground border-border",
        brand: "bg-foreground/8 text-brand border-brand/25",
        green: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/25",
        red: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/25",
        orange: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/25",
        yellow: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/25",
        blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/25",
        muted: "bg-muted/50 text-muted-foreground border-border",
        destructive: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/25",
        error: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/25",
        info: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/25",
        success: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/25",
        warning: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/25",
        secondary: "bg-muted text-muted-foreground border-border",
        outline: "border-border text-foreground bg-transparent",
      },
      size: {
        default: "",
        sm: "text-[10px] px-1.5",
        lg: "text-sm px-2.5 py-0.5",
      },
    },
  },
);

interface BadgeProps extends useRender.ComponentProps<"span"> {
  variant?: VariantProps<typeof badgeVariants>["variant"];
  size?: VariantProps<typeof badgeVariants>["size"];
}

function Badge({ className, variant, size, render, ...props }: BadgeProps) {
  const defaultProps = {
    className: cn(badgeVariants({ className, size, variant })),
    "data-slot": "badge",
  };

  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(defaultProps, props),
    render,
  });
}

export { Badge, badgeVariants };
