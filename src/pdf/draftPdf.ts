import type { OrderFormData } from '@/state/types'
import { renderOrderForm } from './orderForm'

/**
 * Internal review copy: identical layout to the Final PDF but flattened with a
 * diagonal DRAFT watermark on every page. Intentionally permissive — it can be
 * generated even with open QA issues so reviewers can see work in progress.
 */
export async function generateDraftPdf(data: OrderFormData): Promise<Uint8Array> {
  return renderOrderForm(data, 'draft')
}
