import { Field, Section } from './Section'
import { Input } from '../ui/input'
import { DateInput } from '../ui/date-input'
import { ImageUpload } from '../ui/image-upload'
import { useStore } from '@/state/store'
import { StatusBadge } from '../ui/status-badge'
import { Info, PenLine, Image as ImageIcon } from 'lucide-react'
import { RadioGroup, RadioGroupItem } from '../ui/radio-group'
import { cn } from '@/lib/cn'
import type { Signature } from '@/state/types'

type Party = 'customer' | 'surveysparrow'

export function SignatureSection() {
  const { data, update } = useStore()

  const setSig = (party: Party, patch: Partial<Signature>) =>
    update((p) => ({
      ...p,
      signature: {
        ...p.signature,
        [party]: { ...p.signature[party], ...patch },
      },
    }))

  return (
    <Section
      id="signature"
      number="07"
      title="Execution / Signature"
      description="Typed or uploaded signature. In the fillable PDF the customer signature/name/designation/date remain editable."
      actions={
        <StatusBadge variant="warning">
          <Info className="mr-1 h-3 w-3" /> Not a legal e-signature
        </StatusBadge>
      }
    >
      <div className="grid gap-5 md:grid-cols-2">
        <PartyBlock
          title="Customer"
          value={data.signature.customer}
          onChange={(patch) => setSig('customer', patch)}
        />
        <PartyBlock
          title="SurveySparrow Inc."
          value={data.signature.surveysparrow}
          onChange={(patch) => setSig('surveysparrow', patch)}
        />
      </div>
      <p className="text-[11px] leading-relaxed text-slate-500">
        The fillable PDF is not a DocuSign replacement. For a legally binding
        e-signature workflow — audit trail, signer authentication, envelope
        routing, and completion certificate — integrate with DocuSign, Adobe
        Sign, or PandaDoc.
      </p>
    </Section>
  )
}

function PartyBlock({
  title,
  value,
  onChange,
}: {
  title: string
  value: Signature
  onChange: (patch: Partial<Signature>) => void
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/40 p-4">
      <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-teal-700">
        {title}
      </div>

      <div className="mb-3">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          Signature Method
        </div>
        <RadioGroup
          value={value.type}
          onValueChange={(v) => onChange({ type: v as 'typed' | 'image' })}
          className="flex gap-4"
        >
          <label
            className={cn(
              'flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-[12px]',
              value.type === 'typed'
                ? 'border-teal-400 bg-teal-50 text-teal-800'
                : 'border-slate-200 bg-card text-slate-700',
            )}
          >
            <RadioGroupItem value="typed" />
            <PenLine className="h-3.5 w-3.5" /> Typed
          </label>
          <label
            className={cn(
              'flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-[12px]',
              value.type === 'image'
                ? 'border-teal-400 bg-teal-50 text-teal-800'
                : 'border-slate-200 bg-card text-slate-700',
            )}
          >
            <RadioGroupItem value="image" />
            <ImageIcon className="h-3.5 w-3.5" /> Upload image
          </label>
        </RadioGroup>
      </div>

      {value.type === 'typed' ? (
        <Field label="Typed signature">
          <Input
            value={value.signatureName}
            placeholder="/ signature /"
            className="font-[cursive] italic text-lg"
            onChange={(e) => onChange({ signatureName: e.target.value })}
          />
        </Field>
      ) : (
        <ImageUpload
          value={value.image}
          onChange={(asset) => onChange({ image: asset })}
          label="Signature Image"
          hint="Transparent PNG works best. Keep under 512 KB."
        />
      )}

      <div className="mt-3 grid gap-3">
        <Field label="Name">
          <Input
            value={value.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="e.g. Jane Doe"
          />
        </Field>
        <Field label="Designation">
          <Input
            value={value.designation}
            onChange={(e) => onChange({ designation: e.target.value })}
            placeholder="e.g. Head of Revenue Operations"
          />
        </Field>
        <Field label="Date">
          <DateInput
            value={value.date}
            onChange={(e) => onChange({ date: e.target.value })}
          />
        </Field>
      </div>
    </div>
  )
}
