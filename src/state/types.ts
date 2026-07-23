import type { CurrencyCode } from '@/lib/currency'
import type { PaymentTermMode } from '@/lib/terms'

export type ServiceLine = {
  id: string
  description: string
  price: string
  quantity: string
  /**
   * Optional, display-only unit/suffix appended to the quantity in the preview
   * and exports (e.g. "GB", "mo", "EMAILS"). Max 6 chars, casing preserved,
   * never affects calculations. Empty string when unused.
   */
  unit: string
}

export type BillingPeriod = 'Monthly' | 'Quarterly' | 'Annual' | 'Biennial' | 'Triennial'

export type PaymentMethod =
  | 'ACH / Bank Transfer'
  | 'Wire Transfer'
  | 'Credit Card'
  | 'Check'

/** Canonical payment-method options, shared by the app select and the fillable
 *  PDF dropdown so they can never drift. */
export const PAYMENT_METHODS: PaymentMethod[] = [
  'ACH / Bank Transfer',
  'Wire Transfer',
  'Credit Card',
  'Check',
]

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
  /**
   * QA warnings the user has intentionally acknowledged. Maps a check id to the
   * dependency-key that was current when it was ignored — if the underlying
   * fields change, the key no longer matches and the warning re-surfaces.
   */
  ignoredWarnings: Record<string, string>
  /**
   * Per-document overrides for the locked legal text: clause id → paragraphs.
   * Never mutates the canonical BASE_TERMS template; empty map = standard text.
   */
  termOverrides: Record<string, string[]>
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
    /** Optional — may be left blank ("") when the form is sent for review. */
    paymentMethod: PaymentMethod | ''
    /** How the payment term is expressed. Defaults to 'net' (back-compat: old
     *  drafts predate this field and resolve to 'net'). */
    paymentTermMode: PaymentTermMode
    /** Net payment term in days (15 | 30 | 45 | 60). Used when mode === 'net'.
     *  Drives the payment callout AND the Subscription Fees & Payment clause
     *  from one value so they can never disagree. */
    paymentTermDays: number
    /** Free-text wording used when mode === 'custom'. Empty otherwise. */
    paymentTermCustom: string
  }
  /**
   * Optional customer/reviewer comments on the whole Subscription Details
   * section (start date, payment method, billing period, term, payment terms).
   * Never blocks export; renders in customer output only when non-empty and is
   * an editable multiline field in the Fillable PDF (AcroForm field
   * `subscription.comments`; legacy `paymentTerms.comments` still imports).
   */
  subscriptionComments: string
  /**
   * Optional customer/reviewer comments on the Terms & Conditions. Same policy
   * as `paymentTermsComments` — never blocks export, renders only when non-empty,
   * editable multiline field in the Fillable PDF (AcroForm field `terms.comments`).
   */
  termsComments: string
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
  unit: '',
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
  ignoredWarnings: {},
  termOverrides: {},
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
    paymentMethod: '', // optional; blank until Sales confirms it
    paymentTermMode: 'net',
    paymentTermDays: 30,
    paymentTermCustom: '',
  },
  subscriptionComments: '',
  termsComments: '',
  signature: {
    customer: blankSignature(),
    surveysparrow: blankSignature('Trent Ward', 'Director of Sales'),
  },
  purchaseOrder: { required: 'No', number: '', amount: '' },
})
