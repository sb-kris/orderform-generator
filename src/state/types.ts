import type { CurrencyCode } from '@/lib/currency'

export type ServiceLine = {
  id: string
  description: string
  price: string
  quantity: string
}

export type BillingPeriod = 'Monthly' | 'Quarterly' | 'Annual' | 'Biennial' | 'Triennial'

export type PaymentMethod =
  | 'ACH / Bank Transfer'
  | 'Wire Transfer'
  | 'Credit Card'
  | 'Check'

/** In-memory image payload. base64 kept in localStorage for small assets. */
export type ImageAsset = {
  dataUrl: string // "data:image/png;base64,..."
  mime: 'image/png' | 'image/jpeg' | 'image/svg+xml'
  width?: number
  height?: number
  filename?: string
}

export type Signature = {
  type: 'typed' | 'image'
  signatureName: string // for typed
  image: ImageAsset | null // for image
  name: string
  designation: string
  date: string
}

export type PreviewZoom = 'fit' | '75' | '100' | '125'

export type LayoutPrefs = {
  sidebarCollapsed: boolean
  previewCollapsed: boolean
  formPaneWidth: number
  previewPaneWidth: number
  previewZoom: PreviewZoom
  collapsedSections: string[]
}

export type OrderFormData = {
  documentId: string
  currency: CurrencyCode
  customerLogo: ImageAsset | null
  customer: {
    legalName: string
    orderFormDate: string
    pricingValidThrough: string
    preparedBy: string
  }
  soldTo: {
    name: string
    email: string
  }
  services: ServiceLine[]
  billing: {
    sameAsBillTo: boolean
    billTo: { name: string; address: string }
    shipTo: { name: string; address: string }
  }
  subscription: {
    billingPeriod: BillingPeriod
    termMonths: string
    startDate: string
    paymentMethod: PaymentMethod
  }
  signature: {
    customer: Signature
    surveysparrow: Signature
  }
  purchaseOrder: {
    required: 'Yes' | 'No'
    number: string
    amount: string
  }
}

export const emptyLine = (): ServiceLine => ({
  id: crypto.randomUUID(),
  description: '',
  price: '',
  quantity: '',
})

export function newDocumentId(): string {
  const yy = new Date().getFullYear().toString().slice(-2)
  const rand = Math.floor(Math.random() * 46655)
    .toString(36)
    .toUpperCase()
    .padStart(4, '0')
  return `Q-${yy}-${rand}`
}

export const DEFAULT_LAYOUT_PREFS: LayoutPrefs = {
  sidebarCollapsed: false,
  previewCollapsed: false,
  formPaneWidth: 0.44,
  previewPaneWidth: 0.36,
  previewZoom: 'fit',
  collapsedSections: [],
}

const blankSignature = (name = '', designation = ''): Signature => ({
  type: 'typed',
  signatureName: '',
  image: null,
  name,
  designation,
  date: '',
})

export const defaultData = (): OrderFormData => ({
  documentId: newDocumentId(),
  currency: 'USD',
  customerLogo: null,
  customer: {
    legalName: '',
    orderFormDate: '',
    pricingValidThrough: '',
    preparedBy: '',
  },
  soldTo: { name: '', email: '' },
  services: Array.from({ length: 6 }, emptyLine),
  billing: {
    sameAsBillTo: false,
    billTo: { name: '', address: '' },
    shipTo: { name: '', address: '' },
  },
  subscription: {
    billingPeriod: 'Annual',
    termMonths: '12',
    startDate: '',
    paymentMethod: 'ACH / Bank Transfer',
  },
  signature: {
    customer: blankSignature(),
    surveysparrow: blankSignature('Trent Ward', 'Director of Sales'),
  },
  purchaseOrder: { required: 'No', number: '', amount: '' },
})
