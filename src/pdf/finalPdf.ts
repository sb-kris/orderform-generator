import type { OrderFormData } from '@/state/types'
import { renderOrderForm } from './orderForm'

export async function generateFinalPdf(data: OrderFormData): Promise<Uint8Array> {
  return renderOrderForm(data, 'final')
}
