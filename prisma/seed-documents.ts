/**
 * Demo evidence content.
 *
 * These are written to real files through the storage adapter and put through
 * the real extraction and analysis pipeline, so the seeded workspace exercises
 * the same code path a customer upload does — including the deliberate defects
 * (missing completion dates, an expired certificate, a stale supplier review)
 * that the gap engine is supposed to find.
 */

export interface SeedDocument {
  filename: string;
  mimeType: string;
  documentType: string;
  department: string;
  content: string;
  revision?: string;
  effectiveDaysAgo?: number;
  expiresInDays?: number;
  tags?: string[];
}

const today = new Date();
const iso = (daysFromNow: number) =>
  new Date(today.getTime() + daysFromNow * 86_400_000).toISOString().slice(0, 10);

export const SEED_DOCUMENTS: SeedDocument[] = [
  {
    filename: 'Quality Policy 2026.txt',
    mimeType: 'text/plain',
    documentType: 'policy',
    department: 'Quality',
    revision: 'Rev D',
    effectiveDaysAgo: 95,
    tags: ['policy', 'leadership'],
    content: `NORTHFIELD MANUFACTURING
QUALITY POLICY

Document: QP-POL-001    Revision: D    Issue date: ${iso(-95)}
Document owner: Dana Whitfield, Quality Manager
Approved by: Marcus Reed, Managing Director    Date: ${iso(-95)}
Next review: ${iso(270)}

PURPOSE
Northfield Manufacturing designs and manufactures precision machined components
for the industrial and transport sectors. This policy states our commitment to
consistently meeting customer and applicable statutory requirements, and to
continually improving the effectiveness of our management system.

COMMITMENTS
1. We will understand what our customers require before we commit to supply, and
   we will meet those requirements on time and in full.
2. We will meet applicable statutory and regulatory requirements for the products
   we make and the way we make them.
3. We will set measurable quality objectives, review them at least quarterly, and
   act on the results.
4. We will provide the training, equipment and working environment our people
   need to do their work correctly.
5. We will continually improve our processes, using data from monitoring,
   internal audits, customer feedback and management review.

RESPONSIBILITY
Every employee is responsible for the quality of their own work and has the
authority to stop work they believe to be nonconforming. The Quality Manager is
responsible for maintaining the management system and reporting on its
performance to top management.

COMMUNICATION
This policy is communicated to all employees at induction and is displayed in the
production area, the goods-in area and the main office. It is available to
interested parties on request.

Signed: Marcus Reed, Managing Director
Date: ${iso(-95)}`,
  },
  {
    filename: 'Scope Statement 2026.txt',
    mimeType: 'text/plain',
    documentType: 'policy',
    department: 'Quality',
    revision: 'Rev B',
    effectiveDaysAgo: 120,
    tags: ['scope', 'context'],
    content: `NORTHFIELD MANUFACTURING
MANAGEMENT SYSTEM SCOPE AND CONTEXT

Document: QP-SCP-001    Revision: B    Issue date: ${iso(-120)}
Approved by: Marcus Reed, Managing Director    Date: ${iso(-120)}
Document owner: Dana Whitfield, Quality Manager

SCOPE
The management system covers the design, manufacture, inspection and
distribution of precision machined components at the Northfield site,
14 Foundry Road. It covers CNC turning, CNC milling, deburring, inspection,
assembly and despatch.

EXCLUSIONS
Heat treatment and surface finishing are subcontracted to approved external
providers and are controlled under supplier management rather than performed
in house.

INTERNAL ISSUES CONSIDERED
- Ageing CNC equipment in cell 2 and the associated maintenance burden
- Difficulty recruiting experienced setters in the local area
- Knowledge concentrated in a small number of long-serving staff
- Shift pattern changes introduced in Q4 last year

EXTERNAL ISSUES CONSIDERED
- Customer consolidation of supply base and increased audit frequency
- Raw material lead time volatility on bar stock
- Regulatory changes affecting transport-sector customers
- Energy cost exposure

SITES AND PROCESSES
Site: Northfield (single site, 48 employees)
Processes: Sales and order review, planning, purchasing, goods-in inspection,
machining, in-process inspection, final inspection, despatch, maintenance,
calibration, training, internal audit, management review, improvement.`,
  },
  {
    filename: 'Document Control Procedure QP-001.txt',
    mimeType: 'text/plain',
    documentType: 'procedure',
    department: 'Quality',
    revision: 'Rev C',
    effectiveDaysAgo: 210,
    tags: ['procedure', 'document control'],
    content: `NORTHFIELD MANUFACTURING
DOCUMENT AND RECORD CONTROL PROCEDURE

Document: QP-001    Revision: C    Issue date: ${iso(-210)}
Prepared by: Dana Whitfield, Quality Manager
Approved by: Marcus Reed, Managing Director    Date: ${iso(-210)}

1. PURPOSE
To ensure documents required by the management system are identified, reviewed,
approved and available at the point of use, and that records are legible,
retrievable and protected from loss or unintended alteration.

2. SCOPE
All controlled documents and records within the management system.

3. RESPONSIBILITIES
The Quality Manager maintains the master document register. Process owners are
responsible for the technical accuracy of documents within their area. Top
management approves policy-level documents.

4. DOCUMENT IDENTIFICATION
Every controlled document carries a document number, a revision letter, an issue
date and the name of the approver. Documents without these are not controlled and
must not be used.

5. APPROVAL AND ISSUE
New and revised documents are reviewed by the process owner and approved by the
Quality Manager before issue. Policy-level documents are additionally approved by
the Managing Director.

6. DISTRIBUTION AND POINT OF USE
Controlled copies are issued electronically through the shared quality folder.
Printed copies displayed at machines are stamped "UNCONTROLLED WHEN PRINTED" and
must be checked against the register before use.

7. REVISION AND WITHDRAWAL
Superseded documents are removed from circulation on the day the new revision is
issued. One archive copy of each superseded revision is retained for seven years.

8. RECORDS
Records are retained for a minimum of seven years unless a customer or regulatory
requirement specifies longer. Electronic records are backed up nightly and the
restore process is tested annually.

9. REVIEW
This procedure is reviewed at least every three years or when the process
changes.`,
  },
  {
    filename: 'Training Matrix 2026.csv',
    mimeType: 'text/csv',
    documentType: 'competency_matrix',
    department: 'People / HR',
    effectiveDaysAgo: 40,
    tags: ['training', 'competence'],
    // Deliberately incomplete: several rows have no completion date and one has
    // TBD, which is exactly the finding the gap engine should surface.
    content: `Employee,Role,Required Training,Completed,Assessed By,Next Refresher
Dana Whitfield,Quality Manager,Internal Auditor Training,${iso(-380)},M. Reed,${iso(350)}
Dana Whitfield,Quality Manager,Measurement Systems Analysis,${iso(-190)},External,${iso(540)}
Marcus Reed,Managing Director,Management System Awareness,${iso(-300)},D. Whitfield,${iso(430)}
Priya Anand,CNC Setter,Machine Setting - Cell 1,${iso(-260)},T. Bassey,${iso(470)}
Priya Anand,CNC Setter,In-Process Inspection,${iso(-255)},D. Whitfield,${iso(475)}
Tomas Bassey,Production Supervisor,Machine Setting - Cell 1,${iso(-600)},External,${iso(130)}
Tomas Bassey,Production Supervisor,First Aid,${iso(-410)},External,${iso(320)}
Lena Fischer,Inspector,Final Inspection Procedure,${iso(-150)},D. Whitfield,${iso(580)}
Lena Fischer,Inspector,Gauge Handling and Calibration Awareness,,,
Sam Okafor,CNC Operator,Machine Operation - Cell 2,${iso(-95)},T. Bassey,${iso(635)}
Sam Okafor,CNC Operator,In-Process Inspection,,,
Sam Okafor,CNC Operator,Manual Handling,TBD,,
Rhea Kapoor,Goods-In Inspector,Goods-In Inspection Procedure,${iso(-70)},L. Fischer,${iso(660)}
Rhea Kapoor,Goods-In Inspector,Forklift Operation,,,
Joel Mwangi,Maintenance Technician,Planned Maintenance Procedure,${iso(-220)},T. Bassey,${iso(510)}
Joel Mwangi,Maintenance Technician,Lockout Tagout,${iso(-215)},External,${iso(150)}
Ana Costa,Despatch Coordinator,Despatch and Packing Procedure,${iso(-130)},T. Bassey,${iso(600)}
Ana Costa,Despatch Coordinator,Manual Handling,,,`,
  },
  {
    filename: 'Calibration Register 2026.csv',
    mimeType: 'text/csv',
    documentType: 'calibration_record',
    department: 'Quality',
    effectiveDaysAgo: 25,
    expiresInDays: 40,
    tags: ['calibration', 'equipment'],
    // Two instruments are already out of calibration.
    content: `Asset ID,Instrument,Location,Range,Last Calibration,Due,Certificate,Status
GA-001,Digital Caliper 0-150mm,Cell 1,0-150mm,${iso(-200)},${iso(165)},CERT-8841,In calibration
GA-002,Digital Caliper 0-150mm,Cell 2,0-150mm,${iso(-190)},${iso(175)},CERT-8842,In calibration
GA-003,Micrometer 25-50mm,Inspection,25-50mm,${iso(-410)},${iso(-45)},CERT-8203,OVERDUE
GA-004,Micrometer 0-25mm,Inspection,0-25mm,${iso(-160)},${iso(205)},CERT-8899,In calibration
GA-005,Bore Gauge Set,Inspection,6-100mm,${iso(-140)},${iso(225)},CERT-8912,In calibration
GA-006,Surface Plate,Inspection,600x400mm,${iso(-700)},${iso(30)},CERT-7740,Due soon
GA-007,Height Gauge 0-300mm,Inspection,0-300mm,${iso(-95)},${iso(270)},CERT-8961,In calibration
GA-008,Torque Wrench 20-100Nm,Assembly,20-100Nm,${iso(-430)},${iso(-65)},CERT-8150,OVERDUE
GA-009,Thread Plug Gauges M6-M20,Inspection,M6-M20,${iso(-120)},${iso(245)},CERT-8930,In calibration
GA-010,Pressure Gauge Coolant,Cell 1,0-10bar,${iso(-80)},${iso(285)},CERT-8975,In calibration`,
  },
  {
    filename: 'Management Review Minutes.txt',
    mimeType: 'text/plain',
    documentType: 'management_review',
    department: 'Quality',
    effectiveDaysAgo: 58,
    tags: ['management review', 'leadership'],
    content: `NORTHFIELD MANUFACTURING
MANAGEMENT REVIEW MEETING - MINUTES

Date: ${iso(-58)}
Location: Main office meeting room
Chair: Marcus Reed, Managing Director
Minuted by: Dana Whitfield, Quality Manager

Attendees: Marcus Reed (Managing Director), Dana Whitfield (Quality Manager),
Tomas Bassey (Production Supervisor), Ana Costa (Despatch Coordinator),
Joel Mwangi (Maintenance Technician)

Apologies: Priya Anand (annual leave)

1. STATUS OF ACTIONS FROM PREVIOUS REVIEW
Four of six actions from the previous review are closed. Two remain open:
introducing a supplier scorecard, and completing the shift-pattern impact
assessment. Both are carried forward with revised dates.

2. CHANGES IN INTERNAL AND EXTERNAL ISSUES
Two customers have moved to an annual on-site audit cycle, increasing audit load.
Bar stock lead times have improved since Q4. Recruitment of experienced setters
remains difficult; the training matrix was expanded to build internal capability.

3. CUSTOMER SATISFACTION AND FEEDBACK
On-time delivery averaged 94.2% over the period against a 96% objective.
Two customer complaints were received; both related to packaging damage in
transit and both are closed. No product nonconformances were reported by
customers in the period.

4. PROCESS PERFORMANCE AND PRODUCT CONFORMITY
First-pass yield averaged 97.1% against a 97% objective. Internal scrap value
was below budget. Cell 2 accounted for 68% of downtime, consistent with the
ageing equipment issue recorded in the context analysis.

5. INTERNAL AUDIT RESULTS
Four internal audits were completed in the period against a plan of five. The
purchasing audit slipped and is rescheduled. Six findings were raised, of which
five are closed. The open finding concerns supplier re-evaluation records.

6. ADEQUACY OF RESOURCES
Agreed to fund a second inspector position and to bring forward the cell 2
spindle overhaul. Training budget confirmed unchanged.

7. EFFECTIVENESS OF ACTIONS TAKEN ON RISKS AND OPPORTUNITIES
The risk register was reviewed. The mitigation for single-point-of-knowledge
risk (cross-training) is judged partially effective; several planned training
items remain incomplete.

8. OPPORTUNITIES FOR IMPROVEMENT
Agreed to trial digital job travellers in cell 1 and to introduce a supplier
scorecard covering delivery, quality and responsiveness.

9. DECISIONS AND ACTIONS
9.1 Complete outstanding training matrix entries - Owner: Dana Whitfield - Due ${iso(22)}
9.2 Re-evaluate all active suppliers - Owner: Marcus Reed - Due ${iso(45)}
9.3 Reschedule purchasing internal audit - Owner: Dana Whitfield - Due ${iso(30)}
9.4 Cell 2 spindle overhaul - Owner: Joel Mwangi - Due ${iso(75)}
9.5 Supplier scorecard trial - Owner: Marcus Reed - Due ${iso(90)}

10. NEXT REVIEW
Scheduled for ${iso(125)}.

Signed: Marcus Reed, Managing Director    Date: ${iso(-58)}`,
  },
  {
    filename: 'Internal Audit Programme 2026.csv',
    mimeType: 'text/csv',
    documentType: 'internal_audit',
    department: 'Quality',
    effectiveDaysAgo: 150,
    tags: ['internal audit'],
    content: `Audit Ref,Process,Planned Date,Actual Date,Auditor,Independent Of Area,Findings,Status
IA-2026-01,Order review and planning,${iso(-140)},${iso(-138)},D. Whitfield,Yes,1 minor,Closed
IA-2026-02,Machining and in-process inspection,${iso(-100)},${iso(-99)},D. Whitfield,Yes,2 minor,Closed
IA-2026-03,Calibration and measuring equipment,${iso(-60)},${iso(-58)},T. Bassey,Yes,1 minor,Closed
IA-2026-04,Training and competence,${iso(-30)},${iso(-28)},D. Whitfield,Yes,1 major,Open
IA-2026-05,Purchasing and supplier management,${iso(-10)},,D. Whitfield,Yes,,Not started
IA-2026-06,Despatch and delivery,${iso(45)},,T. Bassey,Yes,,Scheduled
IA-2026-07,Management review and improvement,${iso(90)},,D. Whitfield,No,,Scheduled`,
  },
  {
    filename: 'Supplier Evaluation Records.txt',
    mimeType: 'text/plain',
    documentType: 'supplier_evaluation',
    department: 'Purchasing',
    effectiveDaysAgo: 500,
    tags: ['supplier', 'purchasing'],
    // Deliberately stale — should trigger the outdated-evidence gap.
    content: `NORTHFIELD MANUFACTURING
APPROVED SUPPLIER LIST AND EVALUATION RECORD

Last updated: ${iso(-500)}
Maintained by: Purchasing

APPROVED SUPPLIERS

1. Kestrel Metals Ltd - Bar stock and billet
   Approval basis: Historical performance, certification held
   Last evaluation: ${iso(-500)}
   Delivery performance at evaluation: 96%
   Quality performance at evaluation: 99.1%
   Next evaluation due: ${iso(-135)}

2. Harlow Heat Treatment - Subcontract heat treatment
   Approval basis: Site visit and certification review
   Last evaluation: ${iso(-520)}
   Delivery performance at evaluation: 91%
   Quality performance at evaluation: 98.4%
   Next evaluation due: ${iso(-155)}

3. Vernon Surface Finishing - Subcontract plating and coating
   Approval basis: Certification review
   Last evaluation: ${iso(-540)}
   Delivery performance at evaluation: 88%
   Quality performance at evaluation: 97.2%
   Next evaluation due: ${iso(-175)}

4. Ridgeway Tooling - Cutting tools and inserts
   Approval basis: Historical performance
   Last evaluation: ${iso(-480)}
   Next evaluation due: ${iso(-115)}

5. Camden Calibration Services - Calibration services
   Approval basis: Accreditation certificate on file
   Last evaluation: ${iso(-460)}
   Next evaluation due: ${iso(-95)}

NOTE: Annual re-evaluation of all suppliers on this list has not been completed
for the current cycle. Raised at management review as action 9.2.`,
  },
  {
    filename: 'Risk Register 2026.csv',
    mimeType: 'text/csv',
    documentType: 'risk_assessment',
    department: 'Quality',
    effectiveDaysAgo: 70,
    tags: ['risk', 'planning'],
    content: `Ref,Risk or Opportunity,Process,Likelihood,Impact,Score,Mitigation,Owner,Review Date,Effectiveness Verified
R-01,Single point of knowledge on cell 1 setting,Machining,4,4,16,Cross-train two additional setters,T. Bassey,${iso(30)},Partially - training incomplete
R-02,Cell 2 spindle failure causing extended downtime,Maintenance,3,5,15,Bring forward spindle overhaul; hold spare,J. Mwangi,${iso(60)},Not yet verified
R-03,Bar stock lead time volatility,Purchasing,3,3,9,Dual-source bar stock; hold buffer,M. Reed,${iso(75)},Yes - buffer held since ${iso(-120)}
R-04,Measuring equipment out of calibration in use,Inspection,2,5,10,Monthly calibration status check at cell,D. Whitfield,${iso(20)},No - two instruments currently overdue
R-05,Customer audit finding on supplier control,Purchasing,4,3,12,Complete annual supplier re-evaluation,M. Reed,${iso(45)},No - evaluations overdue
R-06,Opportunity: digital job travellers reduce transcription error,Machining,3,3,9,Trial in cell 1,T. Bassey,${iso(90)},Trial not started
R-07,Loss of electronic records,All,2,5,10,Nightly backup; annual restore test,D. Whitfield,${iso(110)},Yes - restore tested ${iso(-80)}
R-08,Packaging damage in transit,Despatch,3,2,6,Revised packing standard,A. Costa,${iso(55)},Yes - no complaints since ${iso(-60)}`,
  },
  {
    filename: 'Nonconformance and Corrective Action Log.csv',
    mimeType: 'text/csv',
    documentType: 'corrective_action',
    department: 'Quality',
    effectiveDaysAgo: 15,
    tags: ['corrective action', 'improvement'],
    content: `Ref,Raised,Source,Description,Immediate Correction,Root Cause,Corrective Action,Owner,Due,Closed,Effectiveness Verified
NC-2026-001,${iso(-170)},Customer complaint,Packaging damage in transit,Replaced parts at no charge,Packing standard did not specify corner protection,Revised packing standard PS-004 and retrained despatch,A. Costa,${iso(-140)},${iso(-135)},Yes - no recurrence in 4 months
NC-2026-002,${iso(-120)},Internal audit IA-2026-02,Job traveller not signed at final inspection,Traveller completed retrospectively,Inspector unclear on sign-off requirement,Clarified procedure and briefed inspectors,L. Fischer,${iso(-95)},${iso(-92)},Yes - verified at next audit
NC-2026-003,${iso(-95)},In-process inspection,Bore diameter out of tolerance on batch 4471,Batch quarantined and 100% inspected,Tool wear compensation not applied at shift change,Added tool wear check to shift handover,T. Bassey,${iso(-70)},${iso(-66)},Yes
NC-2026-004,${iso(-58)},Internal audit IA-2026-03,Micrometer GA-003 found in use past calibration due date,Instrument withdrawn; parts re-measured,No routine check of calibration status at the cell,Monthly calibration status check introduced,D. Whitfield,${iso(-20)},,No - GA-003 and GA-008 currently overdue again
NC-2026-005,${iso(-28)},Internal audit IA-2026-04,Training records incomplete for four employees,None - records issue,Training completion not recorded at the time,Complete records and add matrix review to monthly meeting,D. Whitfield,${iso(22)},,
NC-2026-006,${iso(-12)},Customer complaint,Late delivery on order 88214,Expedited replacement shipment,Planning did not account for subcontract lead time,Under investigation,M. Reed,${iso(35)},,`,
  },
  {
    filename: 'Planned Maintenance Schedule.csv',
    mimeType: 'text/csv',
    documentType: 'maintenance_record',
    department: 'Maintenance',
    effectiveDaysAgo: 35,
    tags: ['maintenance', 'equipment'],
    content: `Asset,Description,Frequency,Last Completed,Next Due,Completed By,Notes
CNC-01,Doosan lathe cell 1,Monthly,${iso(-20)},${iso(10)},J. Mwangi,Coolant changed
CNC-02,Doosan lathe cell 1,Monthly,${iso(-18)},${iso(12)},J. Mwangi,
CNC-03,Haas mill cell 2,Monthly,${iso(-25)},${iso(5)},J. Mwangi,Spindle noise noted - overhaul scheduled
CNC-04,Haas mill cell 2,Monthly,${iso(-48)},${iso(-18)},J. Mwangi,OVERDUE
COMP-01,Air compressor,Quarterly,${iso(-70)},${iso(20)},External,Filters replaced
EXT-01,Extraction system,Six monthly,${iso(-150)},${iso(30)},External,
FLT-01,Forklift,Annual thorough examination,${iso(-300)},${iso(65)},External,Certificate on file
CRN-01,Overhead crane,Six monthly thorough examination,${iso(-170)},${iso(10)},External,Certificate on file`,
  },
  {
    filename: 'Goods-In Inspection Procedure QP-014.txt',
    mimeType: 'text/plain',
    documentType: 'procedure',
    department: 'Quality',
    revision: 'Rev A',
    effectiveDaysAgo: 300,
    tags: ['procedure', 'inspection'],
    content: `NORTHFIELD MANUFACTURING
GOODS-IN INSPECTION PROCEDURE

Document: QP-014    Revision: A    Issue date: ${iso(-300)}
Prepared by: Lena Fischer, Inspector
Approved by: Dana Whitfield, Quality Manager    Date: ${iso(-300)}

1. PURPOSE
To verify that externally provided materials and subcontracted work conform to
purchase order and specification requirements before release into production.

2. SCOPE
All incoming bar stock, billet, subcontract heat treatment and surface finishing,
cutting tools and bought-out components.

3. RESPONSIBILITIES
The Goods-In Inspector performs incoming inspection. The Quality Manager decides
on the disposition of nonconforming material.

4. METHOD
4.1 Check the delivery against the purchase order for part number, quantity and
    specification.
4.2 Check that the required certification is present. Bar stock requires a
    material certificate stating cast number and mechanical properties.
    Subcontract heat treatment requires a process certificate.
4.3 Perform dimensional checks per the sampling plan in Appendix A using
    calibrated equipment.
4.4 Record the result on the goods-in inspection record.
4.5 Apply an accepted label or route the material to quarantine.

5. NONCONFORMING MATERIAL
Nonconforming material is labelled, moved to the quarantine area and recorded on
the nonconformance log. It is not returned to stock until the disposition is
recorded.

6. TRACEABILITY
The cast number is recorded against the works order so finished parts can be
traced back to the material batch.

7. RECORDS
Goods-in inspection records and supplier certificates are retained for seven
years.`,
  },
];
