import { Lock } from 'lucide-react'
import { Section } from './Section'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../ui/accordion'
import { TERMS } from '@/lib/terms'
import { StatusBadge } from '../ui/status-badge'

export function TermsSection() {
  return (
    <Section
      id="terms"
      number="06"
      title="Terms & Conditions"
      description="Standard SurveySparrow order-form terms. Rendered in full inside every generated PDF."
      actions={
        <StatusBadge variant="muted">
          <Lock className="mr-1 h-3 w-3" /> Locked legal text
        </StatusBadge>
      }
      complete
    >
      <div className="rounded-lg border border-slate-200">
        <Accordion type="multiple">
          {TERMS.map((t, i) => (
            <AccordionItem key={t.title} value={`t-${i}`} className="px-4">
              <AccordionTrigger className="text-sm font-semibold text-slate-900">
                {t.title}
              </AccordionTrigger>
              <AccordionContent className="space-y-2 text-slate-700">
                {t.paragraphs.map((p, j) => (
                  <p key={j} className="text-[13px] leading-relaxed">
                    {p}
                  </p>
                ))}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </Section>
  )
}
