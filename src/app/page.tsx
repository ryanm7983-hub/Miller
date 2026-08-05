import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  Check,
  ClipboardList,
  Clock,
  FileSearch,
  FolderSearch,
  Layers,
  Lock,
  MessagesSquare,
  Minus,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Upload,
  Users,
} from 'lucide-react';

import { getSessionUser } from '@/lib/auth/session';
import { PUBLIC_PLANS, PLANS, formatPrice } from '@/lib/billing/plans';
import { AI_DISCLAIMER } from '@/lib/enums';
import { MarketingNav } from '@/components/marketing/nav';
import { Logo } from '@/components/marketing/logo';
import { AiAssessmentCard, ProductMockup } from '@/components/marketing/product-mockup';
import { Badge } from '@/components/ui/badge';
import { ReadinessBar } from '@/components/ui/readiness';

export default async function LandingPage() {
  const user = await getSessionUser();

  return (
    <div className="min-h-screen bg-white">
      <MarketingNav signedIn={!!user} />

      <main>
        <Hero />
        <Audience />
        <Problem />
        <HowItWorks />
        <Analysis />
        <Dashboard />
        <Gaps />
        <Simulator />
        <ConsultantMode />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>

      <Footer />
    </div>
  );
}

/* ------------------------------------------------------------------ hero */

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-ink-200/70">
      <div className="pointer-events-none absolute inset-0 grid-backdrop radial-fade" aria-hidden />
      <div
        className="pointer-events-none absolute left-1/2 top-[-180px] h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-kelp-300/25 blur-[120px]"
        aria-hidden
      />

      <div className="container-page relative pb-16 pt-14 sm:pb-20 sm:pt-20">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-ink-200 bg-white/80 px-3 py-1 text-[12.5px] font-medium text-ink-600 shadow-xs">
            <Sparkles className="h-3.5 w-3.5 text-kelp-600" aria-hidden />
            AI evidence analysis · Built for lean quality teams
          </span>

          <h1 className="mt-6 text-[34px] font-bold leading-[1.08] tracking-tight text-ink-900 sm:text-[52px]">
            Know you&rsquo;re ready
            <br className="hidden sm:block" /> before the auditor arrives.
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-[16px] leading-relaxed text-ink-600 sm:text-[17px]">
            Upload your evidence. Let AI identify gaps, organize requirements, and show your team exactly what needs
            attention — before someone shows up asking for it.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/signup" className="btn-primary btn-lg w-full sm:w-auto">
              Check your readiness
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <a href="#how-it-works" className="btn-secondary btn-lg w-full sm:w-auto">
              See how it works
            </a>
          </div>

          <p className="mt-4 text-[12.5px] text-ink-500">
            14-day free trial · No credit card · Your documents stay private
          </p>
        </div>

        <div className="relative mx-auto mt-14 max-w-5xl">
          <ProductMockup />
          <AiAssessmentCard className="absolute -bottom-8 -right-4 hidden xl:block" />
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- audience */

const AUDIENCE = [
  'Small manufacturers',
  'Quality managers',
  'Operations managers',
  'Safety & EHS teams',
  'Compliance leads',
  'Internal auditors',
  'Consultants',
];

function Audience() {
  return (
    <section className="border-b border-ink-200/70 bg-ink-50/50 py-8">
      <div className="container-page">
        <p className="text-center text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-500">
          Built for the people who actually get audited
        </p>
        <ul className="mt-4 flex flex-wrap items-center justify-center gap-x-7 gap-y-2.5">
          {AUDIENCE.map((item) => (
            <li key={item} className="text-[13.5px] font-medium text-ink-600">
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- problem */

const PROBLEMS = [
  {
    title: 'Evidence lives in six places',
    body: 'A shared drive, someone’s inbox, a filing cabinet, a spreadsheet, and one person’s memory. Nobody can say what exists without asking around.',
  },
  {
    title: 'You find the gaps in the room',
    body: 'The first time anyone notices a training record has no completion date is when an auditor is holding it.',
  },
  {
    title: 'Enterprise QMS is overkill',
    body: 'Six-figure implementations, months of configuration, and a consultant on retainer — for a 40-person shop preparing for one audit.',
  },
  {
    title: 'Nobody knows how ready you are',
    body: '“We’re mostly there” isn’t a number. Without one, you can’t prioritise, you can’t delegate, and you can’t tell leadership anything credible.',
  },
];

function Problem() {
  return (
    <section className="border-b border-ink-200/70 py-20">
      <div className="container-page">
        <div className="max-w-2xl">
          <SectionLabel>The problem</SectionLabel>
          <h2 className="mt-3 text-[28px] font-bold leading-tight text-ink-900 sm:text-[34px]">
            Audit prep is a scramble because nobody can see the whole picture.
          </h2>
          <p className="mt-4 text-[16px] leading-relaxed text-ink-600">
            Not because your team isn&rsquo;t competent. Because the information needed to answer one simple question is
            scattered across your whole organization.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {PROBLEMS.map((problem) => (
            <div key={problem.title} className="card card-hover p-5">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-risk-50 text-risk-600">
                  <Minus className="h-3.5 w-3.5" aria-hidden />
                </span>
                <div>
                  <h3 className="text-[15px] font-semibold text-ink-900">{problem.title}</h3>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-ink-600">{problem.body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-xl border border-kelp-200 bg-kelp-50/70 px-6 py-7 text-center">
          <p className="text-[13px] font-semibold uppercase tracking-wide text-kelp-700">
            The question AuditReady answers
          </p>
          <p className="mt-2 text-[22px] font-bold leading-snug text-ink-900 sm:text-[26px]">
            &ldquo;If an auditor showed up tomorrow, how prepared are we?&rdquo;
          </p>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------- how it works */

const STEPS = [
  {
    icon: Layers,
    title: 'Pick your framework',
    body: 'Choose a standard and create an audit project. Requirements are imported with guidance and suggested evidence, ready to work through.',
  },
  {
    icon: Upload,
    title: 'Upload what you already have',
    body: 'Drag in PDFs, Word files, spreadsheets, CSVs and photos. Text is extracted and indexed so everything becomes searchable.',
  },
  {
    icon: ScanSearch,
    title: 'Let the analysis run',
    body: 'Each document is matched against your requirements with a relevance score, an explanation, and the specific concerns a reviewer should check.',
  },
  {
    icon: BarChart3,
    title: 'Fix what matters first',
    body: 'A readiness score, a prioritised gap list and assignable actions — so the work goes to the right people in the right order.',
  },
];

function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20 border-b border-ink-200/70 bg-ink-50/50 py-20">
      <div className="container-page">
        <div className="max-w-2xl">
          <SectionLabel>How it works</SectionLabel>
          <h2 className="mt-3 text-[28px] font-bold leading-tight text-ink-900 sm:text-[34px]">
            From scattered files to a real answer, in an afternoon.
          </h2>
        </div>

        <ol className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <li key={step.title} className="card card-hover flex flex-col p-5">
              <div className="flex items-center justify-between">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-kelp-700 text-white">
                  <step.icon className="h-4.5 w-4.5" aria-hidden />
                </span>
                <span className="tnum text-[13px] font-bold text-ink-300">0{index + 1}</span>
              </div>
              <h3 className="mt-4 text-[15px] font-semibold text-ink-900">{step.title}</h3>
              <p className="mt-1.5 text-[14px] leading-relaxed text-ink-600">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- analysis */

function Analysis() {
  return (
    <section id="analysis" className="scroll-mt-20 border-b border-ink-200/70 py-20">
      <div className="container-page grid items-center gap-12 lg:grid-cols-2">
        <div>
          <SectionLabel>AI evidence analysis</SectionLabel>
          <h2 className="mt-3 text-[28px] font-bold leading-tight text-ink-900 sm:text-[34px]">
            It reads your documents and tells you what it can&rsquo;t find.
          </h2>
          <p className="mt-4 text-[16px] leading-relaxed text-ink-600">
            Every uploaded file is analysed against the requirements in scope. You get a relevance score, a plain-English
            reason, and the specific things a person still needs to confirm.
          </p>

          <ul className="mt-7 space-y-3.5">
            {[
              'Which requirements this document appears to address, and why',
              'What looks missing — approvals, signatures, revisions, dates',
              'Whether the record is current or has gone stale',
              'Inconsistencies and incomplete entries inside the document',
              'A confidence score you can disagree with and override',
            ].map((item) => (
              <li key={item} className="flex gap-3 text-[14.5px] leading-relaxed text-ink-700">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-kelp-600" aria-hidden />
                {item}
              </li>
            ))}
          </ul>

          <div className="mt-7 rounded-lg border border-info-500/25 bg-info-50 px-4 py-3.5">
            <p className="text-[13px] leading-relaxed text-info-700">
              <strong className="font-semibold">AI never decides compliance.</strong> Assessments are labelled as
              AI-generated, every conclusion is reviewable, and nothing counts toward your readiness score until a person
              approves it.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <AiAssessmentCard className="w-full" />
          <div className="card p-5">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-500">
              Provenance kept on every conclusion
            </p>
            <dl className="mt-3 space-y-2.5 text-[13px]">
              {[
                ['Source document', 'Training Matrix 2026.xlsx'],
                ['Assessment type', 'AI · human verification pending'],
                ['Model & prompt version', 'Recorded per assessment'],
                ['Confidence', '0.87'],
                ['Reviewer decision', 'Approve, reject or override'],
              ].map(([term, value]) => (
                <div key={term} className="flex items-baseline justify-between gap-4 border-b border-ink-100 pb-2 last:border-0">
                  <dt className="text-ink-500">{term}</dt>
                  <dd className="text-right font-medium text-ink-800">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- dashboard */

function Dashboard() {
  return (
    <section className="border-b border-ink-200/70 bg-ink-50/50 py-20">
      <div className="container-page">
        <div className="max-w-2xl">
          <SectionLabel>Readiness dashboard</SectionLabel>
          <h2 className="mt-3 text-[28px] font-bold leading-tight text-ink-900 sm:text-[34px]">
            One number your whole team understands.
          </h2>
          <p className="mt-4 text-[16px] leading-relaxed text-ink-600">
            Readiness is weighted by requirement importance, so a critical gap moves the number more than a minor one.
            Underneath it, the detail that tells you what to do next.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: ShieldCheck, title: 'Requirement status', body: 'Satisfied, partial, needs review, missing, not assessed and N/A — at a glance and per department.' },
            { icon: FileSearch, title: 'Evidence health', body: 'Accepted, awaiting review, expiring soon and already expired, so nothing quietly goes stale.' },
            { icon: ClipboardList, title: 'Action load', body: 'Open and overdue actions, who owns them, and whether they are actually moving.' },
            { icon: Clock, title: 'Time pressure', body: 'Set your audit date and get a live countdown with a ranked top-ten priority list.' },
          ].map((item) => (
            <div key={item.title} className="card card-hover p-5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-kelp-700 ring-1 ring-ink-200">
                <item.icon className="h-4.5 w-4.5" aria-hidden />
              </span>
              <h3 className="mt-4 text-[15px] font-semibold text-ink-900">{item.title}</h3>
              <p className="mt-1.5 text-[14px] leading-relaxed text-ink-600">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ gaps */

const GAP_EXAMPLES = [
  { severity: 'CRITICAL', label: 'Critical', tone: 'risk' as const, text: 'No evidence linked to DEMO-9.2 Internal audit' },
  { severity: 'HIGH', label: 'High', tone: 'risk' as const, text: 'Calibration certificate expired 46 days ago' },
  { severity: 'MEDIUM', label: 'Medium', tone: 'caution' as const, text: '3 incomplete entries in Training Matrix 2026.xlsx' },
  { severity: 'MEDIUM', label: 'Medium', tone: 'caution' as const, text: 'Document Control SOP has no revision recorded' },
  { severity: 'LOW', label: 'Low', tone: 'info' as const, text: 'Supplier Evaluation 2025.pdf has no owner assigned' },
];

function Gaps() {
  return (
    <section id="gaps" className="scroll-mt-20 border-b border-ink-200/70 py-20">
      <div className="container-page grid items-start gap-12 lg:grid-cols-2">
        <div>
          <SectionLabel>Gap detection</SectionLabel>
          <h2 className="mt-3 text-[28px] font-bold leading-tight text-ink-900 sm:text-[34px]">
            The findings, before someone else finds them.
          </h2>
          <p className="mt-4 text-[16px] leading-relaxed text-ink-600">
            The Gap Center runs continuously across your project and surfaces the things audits actually get written up
            for — filtered by severity, department, requirement, owner or due date.
          </p>

          <div className="mt-7 grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
            {[
              'Requirements with no evidence',
              'Expired and expiring documents',
              'Incomplete or blank records',
              'Missing approvals and signatures',
              'Missing revision control',
              'Inconsistent or implausible dates',
              'Evidence with no responsible owner',
              'Conflicting documents in one area',
              'Overdue and blocked actions',
              'AI matches nobody has reviewed',
            ].map((item) => (
              <div key={item} className="flex gap-2.5 text-[14px] text-ink-700">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-kelp-600" aria-hidden />
                {item}
              </div>
            ))}
          </div>

          <p className="mt-7 text-[14px] leading-relaxed text-ink-600">
            Every gap converts into a tracked action in one click — with an AI-drafted description you can edit, an
            owner, a due date and a verification step.
          </p>
        </div>

        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-ink-200 bg-ink-50/60 px-4 py-3">
            <span className="text-[13px] font-semibold text-ink-800">Gap Center</span>
            <Badge tone="risk" size="sm">
              23 open
            </Badge>
          </div>
          <ul className="divide-y divide-ink-100">
            {GAP_EXAMPLES.map((gap) => (
              <li key={gap.text} className="flex items-start gap-3 px-4 py-3.5">
                <Badge tone={gap.tone} size="sm" className="mt-0.5 w-[62px] justify-center">
                  {gap.label}
                </Badge>
                <span className="flex-1 text-[13.5px] leading-relaxed text-ink-700">{gap.text}</span>
                <span className="shrink-0 text-[12px] font-medium text-kelp-700">Create action</span>
              </li>
            ))}
          </ul>
          <div className="border-t border-ink-200 bg-ink-50/60 px-4 py-2.5 text-[12px] text-ink-500">
            Detected automatically · re-checked after every upload
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- simulator */

function Simulator() {
  return (
    <section className="border-b border-ink-200/70 bg-ink-900 py-20 text-white">
      <div className="container-page grid items-center gap-12 lg:grid-cols-2">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[12px] font-semibold uppercase tracking-wide text-kelp-200">
            <MessagesSquare className="h-3.5 w-3.5" aria-hidden />
            Audit simulator
          </span>
          <h2 className="mt-4 text-[28px] font-bold leading-tight text-white sm:text-[34px]">
            Ask Me Like an Auditor
          </h2>
          <p className="mt-4 text-[16px] leading-relaxed text-ink-300">
            The hardest part of an audit isn&rsquo;t having the evidence. It&rsquo;s answering the question in the room.
            The simulator generates the questions an auditor would actually ask about <em>your</em> framework and{' '}
            <em>your</em> evidence — then scores how you answered.
          </p>
          <ul className="mt-7 space-y-3">
            {[
              'Questions targeted at your weakest requirements first',
              'Scored on clarity, evidence referenced and consistency',
              'Tells you which document you should have named',
              'Practise before the day, not on it',
            ].map((item) => (
              <li key={item} className="flex gap-3 text-[14.5px] text-ink-200">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-kelp-400" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-[13px] text-ink-400">
            Included on the Professional plan and above. A preparation tool — not an audit.
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
          <p className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-400">Auditor asks</p>
          <p className="mt-2 text-[16px] font-medium leading-relaxed text-white">
            &ldquo;Show me how you determine whether employees performing this process are competent.&rdquo;
          </p>

          <div className="mt-5 rounded-lg bg-ink-950/60 p-4">
            <p className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-400">Your answer</p>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-300">
              &ldquo;We have a training matrix that lists each role and the training required. New starters go through
              induction and their supervisor signs it off.&rdquo;
            </p>
          </div>

          <div className="mt-5 flex items-center justify-between gap-4">
            <span className="text-[12px] font-semibold uppercase tracking-wide text-ink-400">Response readiness</span>
            <span className="tnum text-[30px] font-bold leading-none text-caution-500">82%</span>
          </div>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-caution-500" style={{ width: '82%' }} />
          </div>

          <p className="mt-4 rounded-lg bg-caution-500/10 px-3.5 py-3 text-[13px] leading-relaxed text-caution-100">
            Your response identifies the training process but does not mention how competency effectiveness is verified.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------- consultant mode */

const CLIENTS = [
  { name: 'Company A', audit: '18 days', readiness: 92, critical: 1 },
  { name: 'Company B', audit: '32 days', readiness: 74, critical: 5 },
  { name: 'Company C', audit: '7 days', readiness: 61, critical: 9 },
];

function ConsultantMode() {
  return (
    <section className="border-b border-ink-200/70 py-20">
      <div className="container-page grid items-center gap-12 lg:grid-cols-2">
        <div>
          <SectionLabel>Consultant mode</SectionLabel>
          <h2 className="mt-3 text-[28px] font-bold leading-tight text-ink-900 sm:text-[34px]">
            Every client&rsquo;s readiness on one screen.
          </h2>
          <p className="mt-4 text-[16px] leading-relaxed text-ink-600">
            If you prepare other organizations for audits, you already know the pain: separate drives, separate
            spreadsheets, and no way to see which client is about to be in trouble. Consultant mode gives you scoped
            access to each client&rsquo;s workspace and one portfolio view across all of them.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Badge tone="info" dot>
              Architecture is in place today
            </Badge>
            <span className="text-[13.5px] text-ink-500">Portfolio dashboard ships with the Consultant tier.</span>
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="border-b border-ink-200 bg-ink-50/60 px-4 py-3 text-[13px] font-semibold text-ink-800">
            Client portfolio
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-ink-200 text-left text-[11.5px] uppercase tracking-wide text-ink-500">
                <th className="px-4 py-2.5 font-medium">Client</th>
                <th className="px-2 py-2.5 font-medium">Audit</th>
                <th className="px-2 py-2.5 font-medium">Readiness</th>
                <th className="px-4 py-2.5 text-right font-medium">Critical</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {CLIENTS.map((client) => (
                <tr key={client.name}>
                  <td className="px-4 py-3 text-[13.5px] font-medium text-ink-900">{client.name}</td>
                  <td className="px-2 py-3 text-[13px] text-ink-600">{client.audit}</td>
                  <td className="px-2 py-3">
                    <ReadinessBar score={client.readiness} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Badge tone={client.critical > 5 ? 'risk' : client.critical > 2 ? 'caution' : 'strong'} size="sm">
                      {client.critical}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- pricing */

function Pricing() {
  const trial = PLANS.find((p) => p.key === 'trial')!;
  const consultant = PLANS.find((p) => p.key === 'consultant');

  return (
    <section id="pricing" className="scroll-mt-20 border-b border-ink-200/70 bg-ink-50/50 py-20">
      <div className="container-page">
        <div className="mx-auto max-w-2xl text-center">
          <SectionLabel className="justify-center">Pricing</SectionLabel>
          <h2 className="mt-3 text-[28px] font-bold leading-tight text-ink-900 sm:text-[34px]">
            Priced for a 40-person shop, not a 4,000-person enterprise.
          </h2>
          <p className="mt-4 text-[16px] leading-relaxed text-ink-600">
            Start with a {trial.trialDays}-day free trial. No credit card, no implementation project, no consultant
            required to switch it on.
          </p>
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {PUBLIC_PLANS.map((plan) => (
            <div
              key={plan.key}
              className={`card relative flex flex-col p-6 ${
                plan.highlight ? 'border-kelp-500 shadow-lg ring-1 ring-kelp-500/20' : ''
              }`}
            >
              {plan.highlight && (
                <span className="absolute -top-2.5 left-6 rounded-full bg-kelp-700 px-2.5 py-0.5 text-[11px] font-semibold text-white">
                  Most popular
                </span>
              )}
              <h3 className="text-[17px] font-bold text-ink-900">{plan.name}</h3>
              <p className="mt-1 text-[13.5px] text-ink-500">{plan.tagline}</p>

              <div className="mt-5 flex items-baseline gap-1.5">
                <span className="tnum text-[38px] font-bold leading-none text-ink-900">
                  {formatPrice(plan.monthlyCents)}
                </span>
                <span className="text-[14px] text-ink-500">/month</span>
              </div>
              <p className="mt-1.5 text-[12.5px] text-ink-500">{plan.audience}</p>

              <ul className="mt-6 flex-1 space-y-2.5">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2.5 text-[13.5px] leading-relaxed text-ink-700">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-kelp-600" aria-hidden />
                    {feature}
                  </li>
                ))}
              </ul>

              <Link
                href={`/signup?plan=${plan.key}`}
                className={`${plan.highlight ? 'btn-primary' : 'btn-secondary'} btn-md mt-7 w-full`}
              >
                Start free trial
              </Link>
            </div>
          ))}
        </div>

        {consultant && (
          <div className="mt-6 flex flex-col items-center justify-between gap-4 rounded-xl border border-ink-200 bg-white px-6 py-5 sm:flex-row">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-600">
                <Users className="h-4.5 w-4.5" aria-hidden />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-[15px] font-semibold text-ink-900">{consultant.name}</h3>
                  <Badge tone="info" size="sm">
                    In development
                  </Badge>
                </div>
                <p className="mt-0.5 text-[13.5px] text-ink-600">
                  {consultant.tagline} Client portfolio dashboard, scoped access and white-label reports.
                </p>
              </div>
            </div>
            <span className="tnum shrink-0 text-[15px] font-semibold text-ink-700">
              {formatPrice(consultant.monthlyCents)}/mo
            </span>
          </div>
        )}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------- faq */

const FAQS = [
  {
    q: 'Does AuditReady replace an auditor or a consultant?',
    a: 'No, and it is not designed to. AuditReady organizes your requirements, analyzes your evidence, and shows you where the gaps are. Certification decisions, legal advice and formal audit conclusions come from accredited people. What this does is make sure you walk into that conversation knowing what they will find.',
  },
  {
    q: 'Which standards does it support?',
    a: 'The framework model is generic — a framework has versions, categories, requirements, guidance and suggested evidence, none of which is hard-coded to any one standard. AuditReady ships with a demo framework of sample requirements so you can try the whole workflow immediately, and you can build your own framework from your standard, your customer’s checklist or your internal audit programme.',
  },
  {
    q: 'Why does it ship with a demo framework instead of the real standards?',
    a: 'The text of standards like ISO 9001 is copyrighted and licensed by the publishing body. Reproducing it in a product would not be legitimate. The demo framework uses original placeholder requirements with the same structure, so you can evaluate the workflow honestly — and then enter the requirements you are licensed to use.',
  },
  {
    q: 'What happens to my documents?',
    a: 'They are stored privately and are only ever served through authenticated, authorized requests — never from a public URL. Each organization is isolated at the database and API layer, not just in the interface. Uploads, downloads and permission changes are recorded in an audit log.',
  },
  {
    q: 'Can the AI be wrong?',
    a: 'Yes, and the product is built on that assumption. Every AI conclusion is labelled as such and carries its confidence, source document, model and prompt version. Nothing counts toward your readiness score until a person approves it, and you can override any assessment. That is a deliberate design decision, not a limitation.',
  },
  {
    q: 'How long does it take to get a real number?',
    a: 'Most teams get their first readiness score the same afternoon. Create a project, import requirements, upload the evidence you already have, and run the analysis. The score gets more accurate as your team reviews the suggested matches.',
  },
  {
    q: 'What if we already use a QMS?',
    a: 'Plenty of teams keep their QMS for controlled document management and use AuditReady for readiness and gap analysis, which is usually the part the QMS is worst at. Evidence can live in both places; AuditReady stores its own copy of what you upload.',
  },
  {
    q: 'Can I cancel?',
    a: 'Any time, from Settings → Billing. Your subscription runs to the end of the period you have paid for. You can export your reports before you go.',
  },
];

function Faq() {
  return (
    <section id="faq" className="scroll-mt-20 border-b border-ink-200/70 py-20">
      <div className="container-page">
        <div className="max-w-2xl">
          <SectionLabel>Questions</SectionLabel>
          <h2 className="mt-3 text-[28px] font-bold leading-tight text-ink-900 sm:text-[34px]">
            The things people ask before signing up.
          </h2>
        </div>

        <div className="mt-10 grid gap-3 lg:grid-cols-2">
          {FAQS.map((faq) => (
            <details key={faq.q} className="card group p-5 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer items-start justify-between gap-4 text-[15px] font-semibold text-ink-900">
                {faq.q}
                <span className="mt-1 shrink-0 text-ink-400 transition-transform group-open:rotate-45" aria-hidden>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </span>
              </summary>
              <p className="mt-3 text-[14px] leading-relaxed text-ink-600">{faq.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- final cta */

function FinalCta() {
  return (
    <section className="py-20">
      <div className="container-page">
        <div className="relative overflow-hidden rounded-2xl border border-kelp-800 bg-kelp-900 px-6 py-14 text-center sm:px-12">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.14]"
            style={{
              backgroundImage:
                'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
              backgroundSize: '48px 48px',
            }}
            aria-hidden
          />
          <div className="relative">
            <h2 className="text-[28px] font-bold leading-tight text-white sm:text-[36px]">
              Find your gaps this week, not on audit day.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[16px] leading-relaxed text-kelp-100">
              Create an account, upload what you already have, and get a readiness score you can actually act on.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/signup" className="btn btn-lg w-full bg-white text-kelp-900 hover:bg-kelp-50 sm:w-auto">
                Check your readiness
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link
                href="/login"
                className="btn btn-lg w-full border border-white/25 text-white hover:bg-white/10 sm:w-auto"
              >
                Sign in
              </Link>
            </div>
            <p className="mt-5 text-[12.5px] text-kelp-200">
              14-day trial · No credit card · Cancel any time
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------- footer */

function Footer() {
  return (
    <footer className="border-t border-ink-200 bg-ink-50/60 py-12">
      <div className="container-page">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <Logo href={null} />
            <p className="mt-3 text-[13.5px] leading-relaxed text-ink-600">
              Know exactly what you&rsquo;re missing before the auditor arrives.
            </p>
            <div className="mt-4 flex items-center gap-2 text-[12.5px] text-ink-500">
              <Lock className="h-3.5 w-3.5" aria-hidden />
              Private document storage · tenant-isolated · audit logged
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-12 gap-y-6 sm:grid-cols-3">
            <FooterColumn
              title="Product"
              links={[
                { label: 'How it works', href: '#how-it-works' },
                { label: 'AI analysis', href: '#analysis' },
                { label: 'Gap detection', href: '#gaps' },
                { label: 'Pricing', href: '#pricing' },
              ]}
            />
            <FooterColumn
              title="Get started"
              links={[
                { label: 'Create an account', href: '/signup' },
                { label: 'Sign in', href: '/login' },
                { label: 'FAQ', href: '#faq' },
              ]}
            />
            <FooterColumn
              title="For consultants"
              links={[
                { label: 'Consultant mode', href: '#pricing' },
                { label: 'Client portfolio', href: '#pricing' },
              ]}
            />
          </div>
        </div>

        <div className="mt-10 border-t border-ink-200 pt-6">
          <p className="max-w-3xl text-[12px] leading-relaxed text-ink-500">{AI_DISCLAIMER}</p>
          <div className="mt-4 flex flex-col gap-2 text-[12px] text-ink-500 sm:flex-row sm:items-center sm:justify-between">
            <span>© {new Date().getFullYear()} AuditReady</span>
            <span className="flex items-center gap-1.5">
              <FolderSearch className="h-3.5 w-3.5" aria-hidden />
              Preparation software — not a certification body
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: Array<{ label: string; href: string }> }) {
  return (
    <div>
      <h3 className="text-[12px] font-semibold uppercase tracking-wide text-ink-500">{title}</h3>
      <ul className="mt-3 space-y-2">
        {links.map((link) => (
          <li key={link.label}>
            <Link href={link.href} className="text-[13.5px] text-ink-700 transition-colors hover:text-kelp-700">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-kelp-700 ${className ?? ''}`}>
      <span className="h-px w-6 bg-kelp-500/50" aria-hidden />
      {children}
    </span>
  );
}
