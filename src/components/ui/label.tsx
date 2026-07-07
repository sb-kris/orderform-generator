import * as LabelPrimitive from '@radix-ui/react-label'
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react'
import { cn } from '@/lib/cn'

export const Label = forwardRef<
  ElementRef<typeof LabelPrimitive.Root>,
  ComponentPropsWithoutRef<typeof LabelPrimitive.Root> & { required?: boolean }
>(({ className, children, required, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(
      'text-xs font-medium text-muted-foreground uppercase tracking-wide',
      className,
    )}
    {...props}
  >
    {children}
    {required && <span className="text-destructive ml-0.5">*</span>}
  </LabelPrimitive.Root>
))
Label.displayName = 'Label'
