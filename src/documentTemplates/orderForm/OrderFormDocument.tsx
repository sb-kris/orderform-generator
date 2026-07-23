/**
 * Reusable, print-style Order Form document renderer.
 *
 * This is the single HTML/CSS representation of the exported order form. It is
 * intentionally decoupled from the app UI (no cards / inputs / buttons) and
 * takes an `OrderFormData` prop rather than reading the store, so it can be
 * mounted anywhere: the live preview pane today, and a headless print route or
 * Playwright/Chromium PDF pipeline in future (see docs/html-css-pdf-engine.md).
 *
 * It consumes the same `buildDocModel` + shared formatters as the pdf-lib and
 * DOCX generators, so nothing can drift between preview and export.
 */
import { motion } from 'motion/react'
import { useMemo } from 'react'
import type { OrderFormData, Signature } from '@/state/types'
import { formatCurrency, formatDate, formatQuantityWithUnit, parseNumber } from '@/lib/format'
import { buildDocModel } from '@/lib/docModel'
import { CURRENCIES } from '@/lib/currency'
import { buildTerms } from '@/lib/terms'
import { cn } from '@/lib/cn'
import './orderFormPrint.css'

export function OrderFormDocument({
  data,
  animate = true,
}: {
  data: OrderFormData
  /** Subtle fade on content change — disable for a static print/headless render. */
  animate?: boolean
}) {
  const currency = data.currency
  const model = useMemo(() => buildDocModel(data), [data])
  const populated = data.services.filter(
    (l) => l.description.trim() || parseNumber(l.price) || parseNumber(l.quantity),
  )

  return (
    <motion.div
      key={animate ? `prev-${data.customer.legalName}-${model.total}-${currency}` : 'static'}
      initial={animate ? { opacity: 0.85 } : false}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      className="doc odoc overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card"
    >
      {/* Page-1 hero band — mirrors the PDF's branded first-page background.
          A white veil over the image keeps the header text fully readable. */}
      <div className="odoc-hero relative">
        <div className="h-1 accent-gradient" aria-hidden />
        <div className="relative px-8 pb-5 pt-6">
          <img
            src="/page1-background.jpg"
            aria-hidden
            className="pointer-events-none absolute inset-0 h-full w-full object-cover object-top opacity-70"
          />
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/55 via-white/70 to-white"
            aria-hidden
          />
          <div className="relative">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <BirdMark />
                <div className="font-display text-[15px] font-bold tracking-tight text-slate-950">
                  SurveySparrow
                </div>
              </div>
              <div className="text-right">
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white/80 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.14em] text-slate-700">
                  Confidential
                </span>
                <div className="mt-1.5 text-[10px] text-slate-500">
                  Doc ID <span className="font-mono text-slate-800">{data.documentId}</span>
                </div>
              </div>
            </div>
            <div className="mt-5 flex items-end justify-between gap-4">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-teal-700">
                  SurveySparrow Inc
                </div>
                <h1 className="!mt-1">Service Order Form</h1>
              </div>
              {data.customerLogo?.dataUrl && (
                <img
                  src={data.customerLogo.dataUrl}
                  alt=""
                  className="max-h-[34px] max-w-[130px] shrink-0 object-contain"
                />
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="px-8 pb-8">
        <div className="doc-rule mb-3" />

        <Section num="01" title="Customer Information">
          <FieldRow>
            <Field label="Customer’s Legal Name" value={data.customer.legalName} required />
            <Field label="Order Form Date" value={formatDate(data.customer.orderFormDate)} required />
          </FieldRow>
          <FieldRow>
            <Field label="Pricing Valid Through" value={formatDate(data.customer.pricingValidThrough)} required />
            <Field label="Prepared By" value={data.customer.preparedBy} required />
          </FieldRow>
        </Section>

        <Section num="02" title="Sold To">
          <FieldRow>
            <Field label="Name" value={data.soldTo.name} required />
            <Field label="Email" value={data.soldTo.email} required />
          </FieldRow>
        </Section>

        <Section num="03" title="Services">
          <table>
            <thead>
              <tr>
                <th style={{ width: '46%' }}>Line Item</th>
                <th style={{ width: '18%', textAlign: 'right' }}>Price</th>
                <th style={{ width: '16%', textAlign: 'right' }}>Qty / Unit</th>
                <th style={{ width: '20%', textAlign: 'right' }}>Sub-Total</th>
              </tr>
            </thead>
            <tbody>
              {populated.length === 0 ? (
                <tr>
                  <td colSpan={4} className="!text-slate-400">
                    Add a service line item to preview the table.
                  </td>
                </tr>
              ) : (
                populated.map((l) => {
                  const sub = parseNumber(l.price) * parseNumber(l.quantity)
                  return (
                    <tr key={l.id}>
                      <td className={cn(l.description && 'filled')}>{l.description || '—'}</td>
                      <td className={cn('text-right', l.price && 'filled')}>
                        {l.price ? formatCurrency(parseNumber(l.price), currency) : '—'}
                      </td>
                      <td className={cn('text-right', l.quantity && 'filled')}>
                        {formatQuantityWithUnit(l.quantity, l.unit) || '—'}
                      </td>
                      <td className="text-right filled">{formatCurrency(sub, currency)}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
            <tfoot>
              <tr className="doc-total">
                <td colSpan={3} className="text-right">
                  Total
                </td>
                <td className="text-right">{model.totalLabel}</td>
              </tr>
            </tfoot>
          </table>
        </Section>

        <Section num="04" title="Billing & Shipping">
          <div className="grid grid-cols-2 gap-3">
            <AddressCard label="Bill To" name={data.billing.billTo.name} address={data.billing.billTo.address} />
            <AddressCard
              label="Ship To"
              name={data.billing.sameAsBillTo ? data.billing.billTo.name : data.billing.shipTo.name}
              address={data.billing.sameAsBillTo ? data.billing.billTo.address : data.billing.shipTo.address}
            />
          </div>
        </Section>

        <Section num="05" title="Subscription Details">
          <FieldRow>
            <Field label="Billing Period" value={data.subscription.billingPeriod} required />
            <Field
              label="Subscription Term"
              value={data.subscription.termMonths ? `${data.subscription.termMonths} months` : ''}
              required
            />
          </FieldRow>
          <FieldRow>
            <Field label="Start Date" value={formatDate(data.subscription.startDate)} optional />
            <Field label="Payment Method" value={data.subscription.paymentMethod} optional />
          </FieldRow>
          <p className="odoc-callout">{model.payableNote}</p>
          {model.paymentTermsComments && (
            <div className="odoc-comments">
              <div className="odoc-comments-label">Payment Terms Comments</div>
              <div className="odoc-comments-body">{model.paymentTermsComments}</div>
            </div>
          )}
        </Section>

        <Section num="06" title="Terms & Conditions">
          <div className="space-y-3">
            {buildTerms(data.subscription, data.termOverrides ?? {}).map((t) => (
              <div key={t.title} className="odoc-clause">
                <div className="odoc-clause-title">{t.title}</div>
                {t.paragraphs.map((p, j) => (
                  <p key={j} className="odoc-legal">
                    {p}
                  </p>
                ))}
              </div>
            ))}
          </div>
          {model.termsComments && (
            <div className="odoc-comments">
              <div className="odoc-comments-label">Terms &amp; Conditions Comments</div>
              <div className="odoc-comments-body">{model.termsComments}</div>
            </div>
          )}
        </Section>

        <Section num="07" title="Execution / Signature">
          <div className="grid grid-cols-2 gap-4">
            <SignatureBlock title="Customer" block={data.signature.customer} />
            <SignatureBlock title="SurveySparrow Inc." block={data.signature.surveysparrow} />
          </div>
        </Section>

        {/* Commercial summary — the at-a-glance deal snapshot, mirrors the PDF. */}
        <Section num="08" title="Acceptance & Purchase Order">
          <div className="odoc-summary">
            <div className="odoc-summary-label">Commercial Summary</div>
            <div className="odoc-summary-grid">
              <SummaryCell label="Customer" value={data.customer.legalName || '—'} wide />
              <SummaryCell label="Total" value={model.totalLabel} emphasize />
              <SummaryCell label="Currency" value={model.currencyCode} />
              <SummaryCell label="Billing Period" value={data.subscription.billingPeriod} />
              <SummaryCell
                label="Subscription Term"
                value={data.subscription.termMonths ? `${data.subscription.termMonths} months` : '—'}
              />
              <SummaryCell label="Start Date" value={formatDate(data.subscription.startDate) || '—'} />
              <SummaryCell label="Valid Through" value={formatDate(data.customer.pricingValidThrough) || '—'} />
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <Field label="PO Required" value={data.purchaseOrder.required} />
            <Field
              label="PO Number"
              value={data.purchaseOrder.required === 'Yes' ? data.purchaseOrder.number : ''}
            />
            <Field
              label={`PO Amount (${CURRENCIES[currency].code})`}
              value={
                data.purchaseOrder.required === 'Yes' && data.purchaseOrder.amount
                  ? formatCurrency(parseNumber(data.purchaseOrder.amount), currency)
                  : ''
              }
            />
          </div>
          <div className="odoc-endmark">End of Order Form</div>
        </Section>

        <div className="doc-rule mt-6" />
        <div className="mt-2 flex justify-between text-[9.5px] text-slate-500">
          <div>SurveySparrow Inc · Order Form · Confidential</div>
          <div>Preview</div>
        </div>
      </div>
    </motion.div>
  )
}

function Section({ num, title, children }: { num: string; title: string; children: React.ReactNode }) {
  return (
    <section className="odoc-section mt-4">
      <div className="flex items-center gap-2">
        <span className="doc-sectnum">{num}</span>
        <h2 className="!m-0">{title}</h2>
      </div>
      <div className="doc-rule mt-2" />
      {children}
    </section>
  )
}

function FieldRow({ children }: { children: React.ReactNode }) {
  return <div className="mt-2 grid grid-cols-2 gap-3">{children}</div>
}

function Field({
  label,
  value,
  required,
  optional,
}: {
  label: string
  value?: string
  required?: boolean
  /** Blank optional fields show an empty box — never the `{{Label}}` token. */
  optional?: boolean
}) {
  const filled = !!value?.trim()
  return (
    <div>
      <div className="doc-field-label">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </div>
      <div className={cn('doc-field', filled && 'filled')}>
        {filled ? value : optional ? '' : `{{${label.replace(/[^\w]+/g, '_')}}}`}
      </div>
    </div>
  )
}

function AddressCard({ label, name, address }: { label: string; name?: string; address?: string }) {
  return (
    <div className="odoc-card">
      <div className="odoc-card-label">{label}</div>
      <div className="mt-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">Name</div>
      <div className={cn('doc-field mt-0.5', name && 'filled')}>{name || '{{Name}}'}</div>
      <div className="mt-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">Address</div>
      <div className={cn('doc-field mt-0.5 whitespace-pre-line', address && 'filled')}>
        {address || '{{Address}}'}
      </div>
    </div>
  )
}

function SummaryCell({
  label,
  value,
  emphasize,
  wide,
}: {
  label: string
  value: string
  emphasize?: boolean
  wide?: boolean
}) {
  return (
    <div className={cn('odoc-summary-cell', wide && 'odoc-summary-cell--wide')}>
      <div className="odoc-summary-cell-label">{label}</div>
      <div className={cn('odoc-summary-cell-value', emphasize && 'odoc-summary-cell-value--total')}>
        {value}
      </div>
    </div>
  )
}

function SignatureBlock({ title, block }: { title: string; block: Signature }) {
  return (
    <div className="odoc-card">
      <div className="odoc-card-label">{title}</div>
      {block.type === 'image' && block.image?.dataUrl ? (
        <div className="mt-3 flex h-[34px] items-end border-b border-slate-400 pb-1">
          <img src={block.image.dataUrl} alt="" className="max-h-[30px] max-w-[150px] object-contain" />
        </div>
      ) : (
        <div className="mt-4 min-h-[22px] border-b border-slate-400 pb-1 font-[cursive] italic text-slate-800">
          {block.signatureName || <span className="text-slate-300">Signature</span>}
        </div>
      )}
      <div className="mt-2 grid gap-1 text-[11px]">
        <div>
          <span className="doc-field-label">Name</span>
          <div className={cn('doc-field', block.name && 'filled')}>{block.name || '{{Name}}'}</div>
        </div>
        <div>
          <span className="doc-field-label">Designation</span>
          <div className={cn('doc-field', block.designation && 'filled')}>
            {block.designation || '{{Designation}}'}
          </div>
        </div>
        <div>
          <span className="doc-field-label">Date</span>
          <div className={cn('doc-field', block.date && 'filled')}>
            {block.date ? formatDate(block.date) : '{{Date}}'}
          </div>
        </div>
      </div>
    </div>
  )
}

function BirdMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 93 102" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <g fill="rgb(60,166,179)">
        <path d="M77.88 26.03c.48-6.81-3.49-13.15-9.79-15.62-6.31-2.48-13.48-.54-17.7 4.79l-3.03-1.05-3.09-.97-3.12-.88C45.42 4.97 53.11.33 61.55.01 69.98-.3 78 3.76 82.81 10.76l9.62.68-14.55 14.59Z" />
        <path d="M85 52 84.16 60.34 83.28 64.44 82.02 68.45 80.43 72.32 78.5 76.04 76.28 79.57 73.76 82.93 70.98 86.03 67.94 88.91 64.66 91.49 61.18 93.79 57.52 95.78 53.69 97.45 49.76 98.78 45.72 99.77 41.6 100.4 37.44 100.69H35.37L31.21 100.42 27.1 99.81 23.05 98.85 19.79 98.95 15.78 100.62 11.54 101.56 8.65 101.78 4.32 101.47 2.88 101.21 18.05 85.98C33.04 94.03 51.48 91.28 63.52 79.21 75.56 67.13 78.4 48.55 70.51 33.39L77.87 26 79.87 29.69 81.57 33.52 82.98 37.49 84.33 43.62 84.83 47.78 84.96 51.97 85 52Z" />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M36.3 82.78C53.4 82.78 67.28 68.79 67.28 51.53 67.28 50.47 67.23 49.41 67.12 48.37 66.79 45 65.92 41.78 64.6 38.82L37.77 65.59 21.54 49.35C20.08 47.9 20.08 45.53 21.54 44.07 23 42.62 25.36 42.62 26.82 44.07L37.78 55.03 60.65 32.21C57.13 27.7 52.4 24.19 46.96 22.17 46.46 22 46.03 21.85 45.6 21.71 35.36 18.28 24.48 16.43 13.18 16.43 9.49 16.43 5.84 16.63 2.25 17.02.91 20.83.19 24.92.19 29.19c0 6.98 1.94 13.49 5.31 19.04C5.38 49.32 5.33 50.42 5.33 51.53c0 17.26 13.88 31.25 30.98 31.25Z"
        />
      </g>
    </svg>
  )
}
