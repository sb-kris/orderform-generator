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
      {/* Cover banner — the brand design background. The SurveySparrow logo,
          the Confidential pill and the decorative outlines are baked into the
          image; we overlay only the Doc ID (white, over the banner) and the
          document title on the white body below. */}
      <div
        className="odoc-hero relative overflow-hidden"
        style={{ background: 'url(/cover-background.png) top center / 100% auto no-repeat' }}
      >
        <div className="relative px-8 pb-6">
          {/* Banner band — Doc ID vertically centred to line up with the baked logo. */}
          <div className="flex h-16 items-center justify-end">
            <div className="text-right text-[10px] text-white/80">
              Doc ID <span className="font-mono font-semibold text-white">{data.documentId}</span>
            </div>
          </div>
          <div className="mt-6 flex items-end justify-between gap-4">
            <h1 className="!mt-0">Service Order Form</h1>
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
          {model.subscriptionComments && (
            <div className="odoc-comments">
              <div className="odoc-comments-label">Subscription Details Comments</div>
              <div className="odoc-comments-body">{model.subscriptionComments}</div>
            </div>
          )}
        </Section>

        <Section num="06" title="Terms & Conditions">
          <div className="space-y-4">
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
    <section className="odoc-section mt-6">
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
