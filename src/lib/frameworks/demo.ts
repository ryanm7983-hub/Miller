/**
 * Demo framework catalogue.
 *
 * IMPORTANT: none of this text reproduces a published standard. The wording of
 * standards such as ISO 9001 is copyrighted by its publisher and cannot be
 * redistributed in a product. These are original placeholder requirements that
 * mirror the *structure* real frameworks use (identifier, clause title,
 * requirement text, guidance, typical evidence) so the whole workflow can be
 * demonstrated and tested honestly.
 *
 * Customers enter the requirements they are licensed to use via custom
 * frameworks; the application is entirely framework-agnostic.
 */

export interface DemoRequirement {
  identifier: string;
  title: string;
  text: string;
  guidance: string;
  evidenceSuggestions: string[];
  importance: number;
  categoryCode: string;
}

export interface DemoCategory {
  code: string;
  name: string;
  description: string;
}

export interface DemoFramework {
  key: string;
  name: string;
  publisher: string;
  category: string;
  description: string;
  version: string;
  versionNotes: string;
  categories: DemoCategory[];
  requirements: DemoRequirement[];
}

const QMS_CATEGORIES: DemoCategory[] = [
  { code: 'CTX', name: 'Context and scope', description: 'What the management system covers and why.' },
  { code: 'LEAD', name: 'Leadership', description: 'Direction, policy and accountability from the top.' },
  { code: 'PLAN', name: 'Planning', description: 'Risks, objectives and how change is managed.' },
  { code: 'SUP', name: 'Support', description: 'People, equipment, knowledge and documented information.' },
  { code: 'OPS', name: 'Operation', description: 'Delivering the product or service under control.' },
  { code: 'PERF', name: 'Performance evaluation', description: 'Measuring, auditing and reviewing.' },
  { code: 'IMP', name: 'Improvement', description: 'Handling problems and getting better.' },
];

const QMS_REQUIREMENTS: DemoRequirement[] = [
  {
    identifier: 'DEMO-4.1',
    title: 'Scope and context',
    text: 'The organization shall define and document the boundaries of its management system, including the sites, products, services and processes it covers, and record the external and internal issues that affect its ability to deliver consistently.',
    guidance:
      'A short scope statement is usually enough. Auditors will check that the scope you claim matches what you actually do, and that anything excluded has a stated reason.',
    evidenceSuggestions: ['Scope statement', 'Site and process list', 'Context or SWOT analysis', 'Organization chart'],
    importance: 4,
    categoryCode: 'CTX',
  },
  {
    identifier: 'DEMO-4.2',
    title: 'Interested parties',
    text: 'The organization shall identify the parties relevant to its management system — customers, regulators, employees, suppliers and others — and record what each of them requires.',
    guidance:
      'A simple table of party, requirement and how it is met is sufficient. Keep it current: an outdated list is a common finding.',
    evidenceSuggestions: ['Interested parties register', 'Customer requirement summaries', 'Applicable regulations list'],
    importance: 3,
    categoryCode: 'CTX',
  },
  {
    identifier: 'DEMO-4.3',
    title: 'Process map',
    text: 'The organization shall identify the processes needed for its management system, their sequence and interaction, and the criteria used to judge whether each process is operating effectively.',
    guidance: 'A one-page process map with inputs, outputs and owners answers most questions here.',
    evidenceSuggestions: ['Process map', 'Turtle diagrams', 'Process owner list', 'Process performance criteria'],
    importance: 3,
    categoryCode: 'CTX',
  },
  {
    identifier: 'DEMO-5.1',
    title: 'Leadership and commitment',
    text: 'Top management shall demonstrate active involvement in the management system, including making resources available, communicating its importance, and holding process owners accountable for results.',
    guidance:
      'Evidence is usually indirect: meeting minutes, approved budgets, resourcing decisions. Auditors often interview senior staff directly on this one.',
    evidenceSuggestions: ['Management meeting minutes', 'Approved budgets or resource decisions', 'Internal communications', 'Signed policy'],
    importance: 4,
    categoryCode: 'LEAD',
  },
  {
    identifier: 'DEMO-5.2',
    title: 'Policy',
    text: 'The organization shall maintain a documented policy that is appropriate to its purpose, includes a commitment to meeting applicable requirements and to continual improvement, and is communicated to everyone doing work on its behalf.',
    guidance:
      'The policy must be current, approved and actually known to staff. Expect the auditor to ask an operator what it means to them.',
    evidenceSuggestions: ['Signed policy statement', 'Policy communication records', 'Induction materials', 'Noticeboard photos'],
    importance: 4,
    categoryCode: 'LEAD',
  },
  {
    identifier: 'DEMO-5.3',
    title: 'Roles and responsibilities',
    text: 'The organization shall assign and communicate the responsibility and authority for each role that affects the management system, including who may stop or release work.',
    guidance: 'Job descriptions, an organization chart and a responsibility matrix together normally cover this.',
    evidenceSuggestions: ['Organization chart', 'Job descriptions', 'Responsibility matrix', 'Delegation of authority'],
    importance: 3,
    categoryCode: 'LEAD',
  },
  {
    identifier: 'DEMO-6.1',
    title: 'Risks and opportunities',
    text: 'The organization shall determine the risks and opportunities that could affect its ability to achieve intended results, plan actions to address them, and evaluate whether those actions worked.',
    guidance:
      'A risk register is the usual artefact. The weak point is almost always the last part — showing that you checked whether the mitigation was effective.',
    evidenceSuggestions: ['Risk register', 'Risk assessment records', 'Mitigation action plans', 'Effectiveness review notes'],
    importance: 5,
    categoryCode: 'PLAN',
  },
  {
    identifier: 'DEMO-6.2',
    title: 'Objectives and plans',
    text: 'The organization shall set measurable objectives at relevant functions and levels, and document what will be done, who is responsible, what resources are required, when it will be complete, and how results will be evaluated.',
    guidance:
      'Objectives need to be measurable and tracked. "Improve quality" fails; "reduce first-pass scrap to under 2% by Q3" passes.',
    evidenceSuggestions: ['Objectives register', 'KPI dashboard', 'Action plans with owners and dates', 'Progress reviews'],
    importance: 4,
    categoryCode: 'PLAN',
  },
  {
    identifier: 'DEMO-6.3',
    title: 'Managing change',
    text: 'When the organization determines a change to the management system is needed, it shall carry out that change in a planned manner, considering the consequences, resource availability and reallocation of responsibilities.',
    guidance: 'Show a change that actually happened and how it was assessed and communicated before going live.',
    evidenceSuggestions: ['Change request records', 'Change impact assessments', 'Change communication records'],
    importance: 3,
    categoryCode: 'PLAN',
  },
  {
    identifier: 'DEMO-7.1',
    title: 'Resources and equipment',
    text: 'The organization shall determine and provide the people, infrastructure and working environment needed for its processes, and shall maintain equipment that affects product or service conformity.',
    guidance:
      'Maintenance records are frequently requested here. Reactive-only maintenance with no plan is a common weakness.',
    evidenceSuggestions: ['Maintenance schedule', 'Maintenance and work order records', 'Equipment register', 'Facility inspection records'],
    importance: 4,
    categoryCode: 'SUP',
  },
  {
    identifier: 'DEMO-7.2',
    title: 'Competence',
    text: 'The organization shall determine the competence required for each role affecting performance, ensure people are competent on the basis of education, training or experience, and retain evidence of that competence.',
    guidance:
      'A training matrix on its own is not enough — auditors look for completion dates, evidence of how competence was verified, and coverage of every person in the role.',
    evidenceSuggestions: ['Competency matrix', 'Training records', 'Qualification certificates', 'Employee evaluations', 'On-the-job assessment records'],
    importance: 5,
    categoryCode: 'SUP',
  },
  {
    identifier: 'DEMO-7.3',
    title: 'Awareness',
    text: 'People doing work under the organization’s control shall be aware of the policy, the objectives relevant to their work, their contribution to effectiveness, and the implications of not following requirements.',
    guidance: 'Usually verified by talking to people on the floor. Induction and toolbox-talk records support it.',
    evidenceSuggestions: ['Induction records', 'Toolbox talk records', 'Awareness briefing attendance', 'Internal newsletters'],
    importance: 3,
    categoryCode: 'SUP',
  },
  {
    identifier: 'DEMO-7.4',
    title: 'Communication',
    text: 'The organization shall determine the internal and external communications relevant to its management system, including what is communicated, when, with whom and by whom.',
    guidance: 'A short communication plan covers this; evidence that it happens is what matters.',
    evidenceSuggestions: ['Communication plan', 'Meeting schedules and minutes', 'Customer communication records'],
    importance: 2,
    categoryCode: 'SUP',
  },
  {
    identifier: 'DEMO-7.5',
    title: 'Documented information',
    text: 'The organization shall control the documents and records required by its management system, ensuring they are identified, reviewed, approved, available where needed, and protected from unintended alteration or loss.',
    guidance:
      'Revision control is the usual failure point: uncontrolled copies on the shop floor, or documents with no revision or approval on them.',
    evidenceSuggestions: ['Document control procedure', 'Master document register', 'Approved document samples with revision', 'Record retention schedule', 'Backup records'],
    importance: 5,
    categoryCode: 'SUP',
  },
  {
    identifier: 'DEMO-8.1',
    title: 'Operational planning and control',
    text: 'The organization shall plan, implement and control the processes needed to meet requirements, including establishing criteria for the processes and for the acceptance of products and services.',
    guidance: 'Work instructions, control plans and acceptance criteria for each key process are typical evidence.',
    evidenceSuggestions: ['Work instructions', 'Control plans', 'Production schedules', 'Acceptance criteria'],
    importance: 4,
    categoryCode: 'OPS',
  },
  {
    identifier: 'DEMO-8.2',
    title: 'Customer requirements',
    text: 'The organization shall determine and review the requirements for the products and services it offers before committing to supply, and shall retain evidence of the review and of any new requirements.',
    guidance: 'Order review, contract review and quotation approval records normally satisfy this.',
    evidenceSuggestions: ['Contract review records', 'Order acknowledgements', 'Quotation approvals', 'Customer specifications'],
    importance: 4,
    categoryCode: 'OPS',
  },
  {
    identifier: 'DEMO-8.3',
    title: 'Externally provided processes and suppliers',
    text: 'The organization shall ensure that externally provided processes, products and services conform to requirements, and shall apply criteria for the evaluation, selection, monitoring and re-evaluation of external providers.',
    guidance:
      'Re-evaluation is the part most often missing. Auditors ask to see the current evaluation for a supplier you actually used this year.',
    evidenceSuggestions: ['Approved supplier list', 'Supplier evaluation records', 'Supplier performance monitoring', 'Incoming inspection records', 'Supplier agreements'],
    importance: 4,
    categoryCode: 'OPS',
  },
  {
    identifier: 'DEMO-8.4',
    title: 'Identification and traceability',
    text: 'The organization shall identify outputs where necessary to ensure conformity, identify the status of outputs with respect to inspection throughout production, and control unique identification where traceability is a requirement.',
    guidance: 'Show how an item on the floor right now can be traced to its order, materials and inspection status.',
    evidenceSuggestions: ['Job travellers or route cards', 'Batch or lot records', 'Labelling standards', 'Traceability test records'],
    importance: 3,
    categoryCode: 'OPS',
  },
  {
    identifier: 'DEMO-8.5',
    title: 'Monitoring and measuring resources',
    text: 'Where measurement is used to verify conformity, the organization shall ensure the measuring equipment is calibrated or verified at defined intervals against traceable standards, and that its status is identifiable.',
    guidance:
      'Expired calibration is one of the most common findings. Check every gauge in use, including personal instruments staff bring in.',
    evidenceSuggestions: ['Calibration schedule', 'Calibration certificates', 'Gauge register', 'Out-of-tolerance impact assessments'],
    importance: 5,
    categoryCode: 'OPS',
  },
  {
    identifier: 'DEMO-8.6',
    title: 'Release and nonconforming output',
    text: 'The organization shall verify that requirements have been met before release, and shall identify and control outputs that do not conform so they are not unintentionally used or delivered.',
    guidance: 'Quarantine areas, hold tags and concession records are the usual evidence. Show a real nonconformance end to end.',
    evidenceSuggestions: ['Final inspection records', 'Nonconformance reports', 'Concession or deviation approvals', 'Quarantine records'],
    importance: 4,
    categoryCode: 'OPS',
  },
  {
    identifier: 'DEMO-9.1',
    title: 'Monitoring, measurement and analysis',
    text: 'The organization shall determine what needs to be monitored and measured, the methods used, when it is performed and when results are analysed, and shall evaluate performance and effectiveness against its objectives.',
    guidance: 'Data that is collected but never analysed does not satisfy this. Show the analysis and what changed as a result.',
    evidenceSuggestions: ['KPI reports', 'Trend analysis', 'Customer satisfaction data', 'Process performance data'],
    importance: 4,
    categoryCode: 'PERF',
  },
  {
    identifier: 'DEMO-9.2',
    title: 'Internal audit',
    text: 'The organization shall conduct internal audits at planned intervals to determine whether the management system conforms to its own requirements and is effectively implemented, and shall retain evidence of the programme and results.',
    guidance:
      'Auditors check the programme covers all processes over the cycle, that auditors were independent of the area audited, and that findings were closed.',
    evidenceSuggestions: ['Internal audit programme', 'Internal audit reports', 'Auditor competence records', 'Audit finding closure records'],
    importance: 5,
    categoryCode: 'PERF',
  },
  {
    identifier: 'DEMO-9.3',
    title: 'Management review',
    text: 'Top management shall review the management system at planned intervals, considering performance data, audit results, customer feedback, the status of actions and opportunities for improvement, and shall record decisions and actions arising.',
    guidance:
      'Minutes must show the inputs were actually considered and that decisions were made — not just that a meeting happened.',
    evidenceSuggestions: ['Management review minutes', 'Management review input pack', 'Action items with owners', 'Previous review follow-up'],
    importance: 5,
    categoryCode: 'PERF',
  },
  {
    identifier: 'DEMO-10.1',
    title: 'Nonconformity and corrective action',
    text: 'When a nonconformity occurs, the organization shall react to control and correct it, evaluate whether similar nonconformities exist or could occur, implement corrective action, and review its effectiveness.',
    guidance:
      'Correction is not corrective action. Show root cause analysis and, critically, the later check that the fix worked.',
    evidenceSuggestions: ['Corrective action records', 'Root cause analysis', 'Effectiveness verification records', 'Customer complaint records'],
    importance: 5,
    categoryCode: 'IMP',
  },
  {
    identifier: 'DEMO-10.2',
    title: 'Continual improvement',
    text: 'The organization shall continually improve the suitability, adequacy and effectiveness of its management system, using the results of analysis, evaluation and management review to identify what needs improvement.',
    guidance: 'A handful of documented improvements with before-and-after data is far stronger than a policy statement.',
    evidenceSuggestions: ['Improvement register', 'Improvement project records', 'Before and after performance data', 'Suggestion scheme records'],
    importance: 3,
    categoryCode: 'IMP',
  },
];

const SAFETY_CATEGORIES: DemoCategory[] = [
  { code: 'GOV', name: 'Governance', description: 'Policy, responsibility and legal duties.' },
  { code: 'HAZ', name: 'Hazard management', description: 'Identifying and controlling risk to people.' },
  { code: 'PEOPLE', name: 'People', description: 'Training, consultation and supervision.' },
  { code: 'READY', name: 'Emergency and incident', description: 'Preparing for and learning from events.' },
];

const SAFETY_REQUIREMENTS: DemoRequirement[] = [
  {
    identifier: 'SAFE-1.1',
    title: 'Safety policy and accountability',
    text: 'The organization shall maintain a signed workplace safety policy and shall define who is accountable for safety at each level of the organization.',
    guidance: 'The policy needs a current date and a signature from the most senior person on site.',
    evidenceSuggestions: ['Signed safety policy', 'Safety responsibility matrix', 'Organization chart'],
    importance: 4,
    categoryCode: 'GOV',
  },
  {
    identifier: 'SAFE-1.2',
    title: 'Legal and other requirements',
    text: 'The organization shall identify the safety legislation, permits and other requirements applicable to its operations, and shall periodically evaluate its compliance with them.',
    guidance: 'Keep a register with a review date. An out-of-date register is worse than none.',
    evidenceSuggestions: ['Legal register', 'Permits and licences', 'Compliance evaluation records'],
    importance: 5,
    categoryCode: 'GOV',
  },
  {
    identifier: 'SAFE-2.1',
    title: 'Hazard identification and risk assessment',
    text: 'The organization shall identify hazards arising from its activities, assess the associated risk, and record the controls applied, reviewing assessments when the activity or equipment changes.',
    guidance: 'Every assessment needs a review date and a named assessor. Check coverage of contractor and maintenance activities.',
    evidenceSuggestions: ['Risk assessments', 'Hazard register', 'Job safety analyses', 'Review records'],
    importance: 5,
    categoryCode: 'HAZ',
  },
  {
    identifier: 'SAFE-2.2',
    title: 'Control of hazardous work',
    text: 'The organization shall control high-risk activities — including work at height, confined space entry, hot work and isolation of energy — through documented authorisation before work begins.',
    guidance: 'Permits must be signed before the work, not filled in afterwards. Auditors check the timestamps.',
    evidenceSuggestions: ['Permit to work records', 'Lockout/tagout records', 'Contractor authorisations', 'Isolation procedures'],
    importance: 5,
    categoryCode: 'HAZ',
  },
  {
    identifier: 'SAFE-2.3',
    title: 'Personal protective equipment',
    text: 'The organization shall determine where personal protective equipment is required, provide it at no cost to the worker, and maintain records of issue, inspection and replacement.',
    guidance: 'Issue records with signatures are the expected evidence, along with evidence that PPE is actually being worn.',
    evidenceSuggestions: ['PPE issue records', 'PPE inspection records', 'PPE assessment by task', 'Site inspection photos'],
    importance: 3,
    categoryCode: 'HAZ',
  },
  {
    identifier: 'SAFE-2.4',
    title: 'Equipment inspection',
    text: 'Safety-critical equipment shall be inspected and maintained at defined intervals by competent people, with records retained showing the outcome of each inspection.',
    guidance: 'Covers lifting equipment, pressure systems, guarding, ladders and fire equipment.',
    evidenceSuggestions: ['Inspection schedule', 'Inspection certificates', 'Defect and repair records', 'Inspector competence records'],
    importance: 4,
    categoryCode: 'HAZ',
  },
  {
    identifier: 'SAFE-3.1',
    title: 'Safety training and induction',
    text: 'The organization shall ensure every worker, including contractors and temporary staff, receives safety induction before starting work and role-specific training thereafter, with records retained.',
    guidance: 'Contractor and agency staff coverage is the most common gap here.',
    evidenceSuggestions: ['Induction records', 'Training matrix', 'Contractor induction records', 'Refresher training records'],
    importance: 5,
    categoryCode: 'PEOPLE',
  },
  {
    identifier: 'SAFE-3.2',
    title: 'Worker consultation',
    text: 'The organization shall consult workers on matters affecting their safety and shall provide a route for raising concerns without fear of reprisal.',
    guidance: 'Safety committee minutes and a visible reporting route are the usual evidence.',
    evidenceSuggestions: ['Safety committee minutes', 'Toolbox talk records', 'Concern reporting records', 'Employee survey results'],
    importance: 3,
    categoryCode: 'PEOPLE',
  },
  {
    identifier: 'SAFE-4.1',
    title: 'Emergency preparedness',
    text: 'The organization shall establish and periodically test procedures for foreseeable emergencies, including evacuation, fire, spill and serious injury, and shall record the outcome of each test.',
    guidance: 'A drill record with a date, participants and lessons learned is what is asked for.',
    evidenceSuggestions: ['Emergency plan', 'Evacuation drill records', 'Fire equipment inspection records', 'First aider certificates'],
    importance: 5,
    categoryCode: 'READY',
  },
  {
    identifier: 'SAFE-4.2',
    title: 'Incident reporting and investigation',
    text: 'The organization shall record incidents and near misses, investigate them proportionately to their potential severity, and implement and verify corrective actions.',
    guidance: 'Near-miss reporting with zero entries is a red flag, not a good sign.',
    evidenceSuggestions: ['Incident register', 'Investigation reports', 'Corrective action records', 'Near miss reports'],
    importance: 5,
    categoryCode: 'READY',
  },
  {
    identifier: 'SAFE-4.3',
    title: 'Performance monitoring',
    text: 'The organization shall monitor safety performance using both leading and lagging indicators and shall review that performance with management at planned intervals.',
    guidance: 'Lagging indicators alone (injury counts) are weak; show at least one leading indicator such as inspections completed.',
    evidenceSuggestions: ['Safety KPI reports', 'Inspection completion data', 'Management review minutes'],
    importance: 3,
    categoryCode: 'READY',
  },
];

const SUPPLIER_CATEGORIES: DemoCategory[] = [
  { code: 'CAP', name: 'Capability', description: 'Can they actually make it?' },
  { code: 'QUAL', name: 'Quality control', description: 'How they keep it right.' },
  { code: 'CHAIN', name: 'Supply chain', description: 'Their own suppliers and materials.' },
];

const SUPPLIER_REQUIREMENTS: DemoRequirement[] = [
  {
    identifier: 'CUST-1.1',
    title: 'Quality system in place',
    text: 'The supplier shall operate a documented quality management system covering the products supplied, and shall make its procedures available for review on request.',
    guidance: 'Certification is not always required, but a documented system is.',
    evidenceSuggestions: ['Quality manual', 'Certification certificate', 'Procedure index'],
    importance: 4,
    categoryCode: 'CAP',
  },
  {
    identifier: 'CUST-1.2',
    title: 'Capacity and continuity',
    text: 'The supplier shall demonstrate the capacity to meet the agreed volumes and shall have a documented plan for continuity of supply in the event of disruption.',
    guidance: 'A named alternative source or buffer stock policy is usually expected.',
    evidenceSuggestions: ['Capacity analysis', 'Business continuity plan', 'Alternative source agreements'],
    importance: 4,
    categoryCode: 'CAP',
  },
  {
    identifier: 'CUST-2.1',
    title: 'Inspection and test records',
    text: 'The supplier shall inspect or test product against agreed acceptance criteria before shipment and shall retain the records for the agreed retention period.',
    guidance: 'Ask for records against a specific recent shipment rather than a sample the supplier chooses.',
    evidenceSuggestions: ['Inspection records', 'Certificates of conformity', 'Test reports', 'Acceptance criteria'],
    importance: 5,
    categoryCode: 'QUAL',
  },
  {
    identifier: 'CUST-2.2',
    title: 'Calibration of measuring equipment',
    text: 'Measuring equipment used to verify supplied product shall be calibrated against traceable standards at defined intervals, with certificates retained.',
    guidance: 'Check the calibration is current for the specific gauge used on your product.',
    evidenceSuggestions: ['Calibration certificates', 'Gauge register', 'Calibration schedule'],
    importance: 4,
    categoryCode: 'QUAL',
  },
  {
    identifier: 'CUST-2.3',
    title: 'Nonconformance and corrective action',
    text: 'The supplier shall control nonconforming product, notify the customer of any escapes, and provide corrective action responses within the agreed timeframe.',
    guidance: 'Look at how a real past issue was handled, including the response time.',
    evidenceSuggestions: ['Nonconformance records', 'Corrective action responses', 'Customer notification records'],
    importance: 5,
    categoryCode: 'QUAL',
  },
  {
    identifier: 'CUST-2.4',
    title: 'Change notification',
    text: 'The supplier shall notify the customer before implementing changes to materials, processes, sub-suppliers or manufacturing location that could affect the supplied product.',
    guidance: 'A signed change-notification agreement plus evidence it has been followed.',
    evidenceSuggestions: ['Change notification agreement', 'Past change notifications', 'Change control procedure'],
    importance: 4,
    categoryCode: 'CHAIN',
  },
  {
    identifier: 'CUST-3.1',
    title: 'Material traceability',
    text: 'The supplier shall maintain traceability from supplied product back to raw material batch and shall be able to identify affected product in the event of a recall.',
    guidance: 'Run a live traceability exercise on a delivered part — this is the strongest test.',
    evidenceSuggestions: ['Material certificates', 'Batch records', 'Traceability exercise results'],
    importance: 5,
    categoryCode: 'CHAIN',
  },
  {
    identifier: 'CUST-3.2',
    title: 'Sub-supplier control',
    text: 'The supplier shall evaluate and monitor its own suppliers and shall flow down the customer’s relevant requirements to them.',
    guidance: 'Ask to see the approved supplier list and one recent evaluation.',
    evidenceSuggestions: ['Approved supplier list', 'Sub-supplier evaluations', 'Flow-down agreements'],
    importance: 3,
    categoryCode: 'CHAIN',
  },
];

export const DEMO_FRAMEWORKS: DemoFramework[] = [
  {
    key: 'demo-qms',
    name: 'Demo Quality Management Framework',
    publisher: 'AuditReady (demonstration content)',
    category: 'Quality',
    description:
      'A 25-requirement demonstration framework covering context, leadership, planning, support, operation, performance evaluation and improvement. Original placeholder requirements — not a reproduction of any published standard.',
    version: '1.0',
    versionNotes: 'Initial demonstration release. Use this to try the full workflow, then build your own framework from the standard you are licensed to use.',
    categories: QMS_CATEGORIES,
    requirements: QMS_REQUIREMENTS,
  },
  {
    key: 'demo-safety',
    name: 'Demo Workplace Safety Framework',
    publisher: 'AuditReady (demonstration content)',
    category: 'Health & Safety',
    description:
      'An 11-requirement demonstration framework covering safety governance, hazard management, people, and emergency and incident handling. Original placeholder requirements.',
    version: '1.0',
    versionNotes: 'Initial demonstration release.',
    categories: SAFETY_CATEGORIES,
    requirements: SAFETY_REQUIREMENTS,
  },
  {
    key: 'demo-customer-audit',
    name: 'Demo Customer Supplier Audit Checklist',
    publisher: 'AuditReady (demonstration content)',
    category: 'Customer audit',
    description:
      'An 8-requirement demonstration checklist of the kind a customer sends before auditing a supplier: capability, quality control and supply chain. Original placeholder requirements.',
    version: '1.0',
    versionNotes: 'Initial demonstration release.',
    categories: SUPPLIER_CATEGORIES,
    requirements: SUPPLIER_REQUIREMENTS,
  },
];
