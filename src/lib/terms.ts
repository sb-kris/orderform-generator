/**
 * SurveySparrow standard order-form terms.
 *
 * These are treated as locked legal text in the UI. They may only be updated
 * with legal review. Keep the array structure (title + paragraphs) so that
 * both the on-screen accordion and the PDF renderer can consume them.
 */
export type TermClause = {
  title: string
  paragraphs: string[]
}

export const TERMS: TermClause[] = [
  {
    title: '1. Order Form & Agreement',
    paragraphs: [
      'This Service Order Form (the "Order Form") is entered into by and between SurveySparrow Inc. ("SurveySparrow", "we", "us") and the Customer identified above ("Customer", "you"). This Order Form is governed by and incorporates by reference the SurveySparrow Terms of Service available at https://surveysparrow.com/terms/ and the Data Processing Addendum available at https://surveysparrow.com/dpa/ (collectively, the "Agreement").',
      'In the event of a conflict between this Order Form and the Agreement, this Order Form will control solely with respect to the subject matter of this Order Form.',
    ],
  },
  {
    title: '2. Subscription Services & Fees',
    paragraphs: [
      'Customer is subscribing to the services and quantities described in the Services table above (the "Subscription Services") for the subscription term specified in the Subscription Details section (the "Subscription Term").',
      'Fees are exclusive of any applicable taxes, levies, or duties. Customer is responsible for payment of all such taxes, excluding taxes based on SurveySparrow\'s net income.',
      'Unless otherwise stated, fees are payable in United States Dollars (USD) and are non-cancelable and non-refundable.',
    ],
  },
  {
    title: '3. Payment Terms',
    paragraphs: [
      'Invoices are payable within thirty (30) days of the invoice date, unless a different net-term is expressly stated in the Subscription Details section.',
      'Any amount not paid when due will accrue interest at the lower of 1.5% per month or the maximum rate permitted by law, from the due date until paid.',
      'Customer is responsible for providing accurate billing and contact information and for keeping such information current.',
    ],
  },
  {
    title: '4. Term & Renewal',
    paragraphs: [
      'The Subscription Term will begin on the Subscription Term Start Date and continue for the duration set out above. Upon expiration, the Subscription Term will automatically renew for successive periods of equal length unless either party provides written notice of non-renewal at least thirty (30) days prior to the end of the then-current term.',
      'Renewal fees will be based on the then-current list price for the renewed services, unless otherwise agreed in writing.',
    ],
  },
  {
    title: '5. Confidentiality',
    paragraphs: [
      'Each party agrees to protect the other party\'s Confidential Information using at least the same degree of care it uses to protect its own confidential information of like importance, and in no event less than a reasonable degree of care. Confidential Information will be used only to perform obligations or exercise rights under this Order Form and the Agreement.',
    ],
  },
  {
    title: '6. Warranties & Disclaimers',
    paragraphs: [
      'SurveySparrow warrants that the Subscription Services will materially conform to the applicable documentation during the Subscription Term. EXCEPT AS EXPRESSLY PROVIDED, THE SUBSCRIPTION SERVICES ARE PROVIDED "AS IS" AND SURVEYSPARROW DISCLAIMS ALL WARRANTIES, WHETHER EXPRESS, IMPLIED, STATUTORY OR OTHERWISE, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE AND NON-INFRINGEMENT.',
    ],
  },
  {
    title: '7. Limitation of Liability',
    paragraphs: [
      'TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT WILL EITHER PARTY BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, COVER OR PUNITIVE DAMAGES ARISING OUT OF OR RELATED TO THIS ORDER FORM. EACH PARTY\'S AGGREGATE LIABILITY WILL NOT EXCEED THE AMOUNTS PAID OR PAYABLE BY CUSTOMER UNDER THIS ORDER FORM IN THE TWELVE (12) MONTHS IMMEDIATELY PRECEDING THE CLAIM.',
    ],
  },
  {
    title: '8. Governing Law',
    paragraphs: [
      'This Order Form is governed by the laws of the State of Delaware, without regard to its conflict-of-laws principles. The parties consent to the exclusive jurisdiction of the state and federal courts located in Delaware for any dispute arising out of or relating to this Order Form.',
    ],
  },
  {
    title: '9. Entire Agreement',
    paragraphs: [
      'This Order Form, together with the Agreement, constitutes the entire agreement between the parties regarding its subject matter and supersedes all prior or contemporaneous understandings. Any purchase order or additional or conflicting terms contained in Customer\'s ordering documents will be of no force or effect, unless expressly accepted in writing by an authorized SurveySparrow representative.',
    ],
  },
]
