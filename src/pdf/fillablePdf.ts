import type { OrderFormData } from '@/state/types'
import { renderOrderForm } from './orderForm'

/**
 * Generate a PDF that preserves editable form fields for:
 *  - customer.signature (typed text field)
 *  - customer.name, customer.designation, customer.date
 *  - po.required.yes / po.required.no (checkboxes)
 *  - po.number, po.amount
 *
 * SurveySparrow-side signatures and all other fields are rendered as
 * flattened text so only the customer‑facing fields remain editable.
 */
export async function generateFillablePdf(data: OrderFormData): Promise<Uint8Array> {
  return renderOrderForm(data, 'fillable')
}
