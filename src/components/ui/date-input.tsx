import { forwardRef, type InputHTMLAttributes } from 'react'
import { Input } from './input'

interface DateInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  invalid?: boolean
}

export const DateInput = forwardRef<HTMLInputElement, DateInputProps>(
  (props, ref) => <Input ref={ref} type="date" {...props} />,
)
DateInput.displayName = 'DateInput'
