import type { Clause, Policy } from "./hr-research-data";

export const SYNTHETIC_TAG = "Synthetic sample. Not WRHN policy.";
export const LOA_FILE = "leaves_of_absence_guideline_synthetic.docx";
export const EL_FILE = "employment_letter_procedure_synthetic.docx";
export const BC_FILE = "benefits_compensation_guide_synthetic.docx";

const sp = (file: string, title: string): Policy => ({
  file,
  title,
  version: "2026-01",
  effectiveDate: "2026-01-01",
  effectiveNote: "Stated in the document",
  linkedTickets: 0,
  loaded: true,
  handling: "Answered with a quote",
  synthetic: true,
});

export const syntheticPolicies: Policy[] = [
  sp(LOA_FILE, "Leaves of Absence Guideline (synthetic)"),
  sp(EL_FILE, "Employment Letter Procedure (synthetic)"),
  sp(BC_FILE, "Benefits and Compensation Guide (synthetic)"),
];

const s = (id: string, policyFile: string, ref: string, text: string): Clause => ({ id, policyFile, ref, text });

export const syntheticClauses: Clause[] = [
  s("LOA-0.1", LOA_FILE, "0.1 Eligibility", "Full-time and part-time employees are eligible for a leave of absence. Casual employees are not eligible for the supplemental top-up."),
  s("LOA-0.2", LOA_FILE, "0.2 Unpaid leave", "A personal leave of absence is unpaid. The supplemental top-up applies only to pregnancy and parental leave."),
  s("LOA-1.1", LOA_FILE, "1.1 Notice", "An employee who plans to take pregnancy or parental leave tells their manager and People Operations in writing at least 4 weeks before the planned first day of leave."),
  s("LOA-1.2", LOA_FILE, "1.2 Forms", "The employee completes the Leave of Absence Request Form and attaches the documents that support the type of leave requested."),
  s("LOA-1.3", LOA_FILE, "1.3 Length of leave", "Pregnancy and parental leave may be taken for up to 52 weeks in total. People Operations confirms the exact dates when it reviews the request form."),
  s("LOA-2.1", LOA_FILE, "2.1 Benefits", "Group benefits continue during an approved leave of absence. The employee continues to pay their share of the premiums."),
  s("LOA-2.2", LOA_FILE, "2.2 Paying premiums", "While the employee is away from payroll, premiums are paid by pre-authorized payment arranged with People Operations."),
  s("LOA-2.3", LOA_FILE, "2.3 Opting out", "An employee may opt out of optional coverage by submitting the Benefits Change Form before the leave starts."),
  s("LOA-3.1", LOA_FILE, "3.1 Pension contributions", "Contributions to the pension plan are optional during an unpaid leave."),
  s("LOA-3.2", LOA_FILE, "3.2 Stopping contributions", "An employee may stop contributions during a leave by telling People Operations in writing."),
  s("LOA-3.3", LOA_FILE, "3.3 Pensionable service", "Pensionable service does not accrue for any period in which no contributions are made."),
  s("LOA-4.1", LOA_FILE, "4.1 EI and ROE", "The employee applies for Employment Insurance as soon as their last day worked is known. People Operations issues the Record of Employment within 5 business days after the last pay period."),
  s("LOA-4.2", LOA_FILE, "4.2 SUB top-up", "An eligible employee on pregnancy or parental leave receives a supplemental top-up payment after People Operations receives their EI payment statements."),
  s("LOA-4.3", LOA_FILE, "4.3 EI statements", "The employee sends EI payment statements to People Operations by email or through the HR portal."),
  s("LOA-4.4", LOA_FILE, "4.4 Extended parental EI", "An employee who chooses the extended parental EI option tells People Operations, because the top-up is then paid over the longer period."),
  s("EL-1.1", EL_FILE, "1.1 Requests", "People Operations provides an employment letter to a current employee on request."),
  s("EL-1.2", EL_FILE, "1.2 Standard content", "A standard letter confirms the employee's job title, employment status and start date."),
  s("EL-2.1", EL_FILE, "2.1 Salary and hours", "Salary and hours of work are included only when the employee asks for them."),
  s("EL-2.2", EL_FILE, "2.2 Contract dates", "Contract start and end dates are included for an employee on a fixed-term contract when the employee asks for them."),
  s("EL-2.3", EL_FILE, "2.3 NOC code", "A National Occupation Classification (NOC) code is included when the letter is for an immigration purpose and the employee asks for it."),
  s("EL-3.1", EL_FILE, "3.1 Purpose and recipient", "A letter may be addressed to a named recipient and may state its purpose, such as a mortgage or an immigration application. People Operations does not add statements about future employment."),
  s("EL-5.1", EL_FILE, "5.1 Verifying the recipient", "People Operations confirms who the letter is for before it is issued. A letter is issued only for the employee it describes."),
  s("BC-0.1", BC_FILE, "0.1 Eligibility", "Benefits are available to full-time and part-time employees. Casual employees are not eligible."),
  s("BC-1.1", BC_FILE, "1.1 Adding a dependant", "An employee adds a spouse, partner or child to their benefits by submitting the Benefits Change Form to People Operations."),
  s("BC-1.2", BC_FILE, "1.2 Documents", "The form is supported by proof of the life event, such as a birth certificate or a marriage certificate."),
  s("BC-1.3", BC_FILE, "1.3 Time limit", "A dependant added within 31 days of the life event is covered from the date of the event. A request made after 31 days follows the insurer's underwriting process."),
  s("BC-2.1", BC_FILE, "2.1 Step increases", "Eligible employees move to the next salary step on their anniversary date, up to the top step of their pay band."),
  s("BC-2.2", BC_FILE, "2.2 Transfers", "On a transfer to a role in a different pay band, the employee is placed at the lowest step of the new band that is not less than their current rate."),
  s("BC-3.1", BC_FILE, "3.1 Enrolling", "An eligible employee enrols in the pension plan by completing the Pension Enrolment Form and returning it to People Operations."),
  s("BC-3.2", BC_FILE, "3.2 Eligibility", "Full-time and part-time employees are eligible to enrol in the pension plan. Casual employees are not."),
];
