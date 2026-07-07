/**
 * Derived, render-ready view of the order form. Both document generators
 * (PDF and DOCX) and the on-screen preview consume this model so totals,
 * currency formatting, ship-to resolution, and populated-row filtering can
 * never drift between outputs.
 */
import type { OrderFormData } from '@/state/types'
import { formatCurrency, formatDate, parseNumber } from './format'
import { CURRENCIES, type CurrencyCode } from './currency'

export type ServiceRow = {
  description: string
  price: number
  quantity: number
  subtotal: number
  priceLabel: string
  quantityLabel: string
  subtotalLabel: string
}

export type DocModel = {
  currency: CurrencyCode
  currencyCode: string
  documentId: string
  customer: {
    legalName: string
    orderFormDate: string
    pricingValidThrough: string
    preparedBy: string
  }
  soldTo: { name: string; email: string }
  services: ServiceRow[]
  total: number
  totalLabel: string
  billTo: { name: string; address: string }
  shipTo: { name: string; address: string }
  subscription: {
    billingPeriod: string
    termMonths: string
    startDate: string
    paymentMethod: string
  }
  po: {
    required: 'Yes' | 'No'
    numberLabel: string
    amountLabel: string
    amountHeading: string
  }
}

export function buildDocModel(data: OrderFormData): DocModel {
  const currency = data.currency
  const populated = data.services.filter(
    (s) => s.description.trim() || parseNumber(s.price) || parseNumber(s.quantity),
  )
  const services: ServiceRow[] = populated.map((line) => {
    const price = parseNumber(line.price)
    const quantity = parseNumber(line.quantity)
    const subtotal = price * quantity
    return {
      description: line.description,
      price,
      quantity,
      subtotal,
      priceLabel: price ? formatCurrency(price, currency) : '',
      quantityLabel: quantity ? String(quantity) : '',
      subtotalLabel: price && quantity ? formatCurrency(subtotal, currency) : '',
    }
  })
  const total = services.reduce((a, r) => a + r.subtotal, 0)

  const shipTo = data.billing.sameAsBillTo ? data.billing.billTo : data.billing.shipTo

  return {
    currency,
    currencyCode: CURRENCIES[currency].code,
    documentId: data.documentId,
    customer: {
      legalName: data.customer.legalName,
      orderFormDate: formatDate(data.customer.orderFormDate),
      pricingValidThrough: formatDate(data.customer.pricingValidThrough),
      preparedBy: data.customer.preparedBy,
    },
    soldTo: data.soldTo,
    services,
    total,
    totalLabel: formatCurrency(total, currency),
    billTo: data.billing.billTo,
    shipTo,
    subscription: {
      billingPeriod: data.subscription.billingPeriod,
      termMonths: data.subscription.termMonths,
      startDate: formatDate(data.subscription.startDate),
      paymentMethod: data.subscription.paymentMethod,
    },
    po: {
      required: data.purchaseOrder.required,
      numberLabel:
        data.purchaseOrder.required === 'Yes'
          ? data.purchaseOrder.number || '—'
          : '—',
      amountLabel:
        data.purchaseOrder.required === 'Yes' && data.purchaseOrder.amount
          ? formatCurrency(parseNumber(data.purchaseOrder.amount), currency)
          : '—',
      amountHeading: `PO Amount (${CURRENCIES[currency].code})`,
    },
  }
}
