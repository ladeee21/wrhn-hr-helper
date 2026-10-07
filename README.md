# WRHN HR Assist

Build a clickable front-end prototype called "WRHN HR Research Assistant". It should look and behave like a real internal website for a hospital HR team. It is for HR Advisors and People Operations Associates at Waterloo Regional Health Network (WRHN), a hospital network in Ontario. Advisors ask an HR policy question in plain language and the assistant returns the governing clause, quoted word for word, with its source. When no clause governs, or the case needs a person's judgment, the assistant says so and names the team to route to instead of guessing. It never gives HR advice. The advisor stays in charge and sends any reply from their own email.

FRONT-END ONLY. No backend, no auth, no database, no Supabase, no real AI calls. Use in-memory React state and the scripted data below. Do not invent policy text. All quotes below are verbatim from a synthetic dataset and must be labelled "Synthetic dataset" in the UI.

=== THE FLOW THIS PROTOTYPE MODELS ===
An HR Advisor or POA opens the HR-only SharePoint site, clicks a link to the HR Research Assistant, lands on the assistant's homepage (WRHN logo plus a question box, nothing else to fill in), and asks a question about an inquiry. Advisors do NOT set context on the homepage. If a question needs more context (for example employment type), the assistant asks a follow-up question in the conversation, the advisor answers it (tap a suggested reply or type), and then the assistant gives the governing clause.

=== WRHN LOGO (required, must be visible on every page header) ===
Official logo URL: https://www.wrhn.ca/wp-content/uploads/2025/06/Logo.png
Square symbol (favicon and tab icon): https://www.wrhn.ca/wp-content/uploads/2025/11/cropped-WRHN_Logo_Symbol_Clr_High-Res_CMYK-270x270.jpg
First download both files into the project (public/wrhn-logo.png and a favicon) with your download tool or curl, and reference the local copies. If the download fails, hotlink the URLs and add an onError fallback showing a text wordmark "WRHN" with "Waterloo Regional Health Network" beneath it. Alt text: "Waterloo Regional Health Network (WRHN)". Do not redraw, recolour, crop or distort the logo. Header logo height about 40 to 44px on a white header bar. Confirm in the browser that the logo actually renders before reporting done.

=== DESIGN DIRECTION ===
Calm, precise, trustworthy, like a professional hospital research or search tool. Generous whitespace, the WRHN logo prominent, primary blue used sparingly (the Ask button, links, the quote's left rule, the featured SharePoint tile outline). The memorable element is the answer card: the quoted clause is the hero, set in a serif face, with a provenance strip underneath. Everything else is flat and quiet.
- Fonts (Google Fonts): "Source Sans 3" for the interface, "Source Serif 4" for quoted source text only (line-height 1.6, max line length about 70 characters).
- Colours as CSS variables: page #F6F8F9, surface #FFFFFF, ink #14212B, muted #51626D, hairline #D9E1E6, primary #0B5A7A, primary-soft #E4F1F6, verified green #2E7D5B on #E6F3EC, caution amber #8A4B00 on #FFF3DD, route slate #3D4C58 on #ECEFF2. (Exact WRHN brand colours are not confirmed, so stay neutral and let the logo carry the brand.)
- Avoid: cream backgrounds, terracotta accents, ALL-CAPS labels, numbered markers (except the real step sequence in "How this was checked"), gradient washes, grids of identical rounded cards, entrance animations. Use hairline dividers and flat sections. Motion only answers an action. Sentence case everywhere. Plain verbs on buttons. Visible keyboard focus, labels on every control, WCAG 2.2 AA contrast, responsive down to 375px, respect prefers-reduced-motion.

=== ROUTES ===
Use TanStack file-based routes (do not edit the generated route tree by hand):
- "/" : a mock of the HR SharePoint site (page 1)
- "/assistant" : the assistant homepage and conversation (page 2)
- "/assistant/review" : Review queue (page 3)
- "/assistant/sources" : Sources (page 4)
Share state (role, review items, dataset checks) across the /assistant routes with a small React context provider in an /assistant layout route, so flags created in a conversation show up in the Review queue.

=== PAGE 1: "/" MOCK HR SHAREPOINT SITE ===
Looks like a modern intranet team site, neutral (do not copy Microsoft branding).
- Top bar (white, hairline border): WRHN logo, a divider, site name "People Operations, HR team site". Right: a small lock label "Private. HR Advisors and People Operations Associates only." and an avatar circle "HA" with the name "HR Advisor (demo)".
- Left navigation: Home (current), Policies in PolicyStat, Collective agreements, Forms, Process documents, HR Research Assistant (visually marked "New"), Team calendar. Only HR Research Assistant links to /assistant; the others are plain text with title "Not part of this prototype".
- Main: page title "HR Team Hub", a short welcome line, a "Quick links" row of five flat link tiles (wraps on mobile): PolicyStat, Collective agreements, Forms, Process documents, HR Research Assistant. The HR Research Assistant tile is featured (primary outline, description "Look up the governing policy clause for an inquiry, with its source.") and navigates to /assistant. The other four are inert.
- Below: "Announcements" (three short realistic HR-team notices, plain text, no policy facts) and "Team contacts" (generic role names only, no personal names).
- Small footer note: "This page is a mock of the HR SharePoint site, shown for the prototype."

=== PAGE 2: "/assistant" HOMEPAGE AND CONVERSATION ===
Header (white, hairline bottom border): WRHN logo | thin divider | "HR Research Assistant". Right: link "Back to HR team hub" (to "/"), nav links "Ask", "Review queue", "Sources", and a user menu button showing "HR Advisor (demo)" or "HR Reviewer (demo)" that opens a small menu with a role switch (Advisor / Reviewer) and the label "Prototype. Synthetic data only."

HOME STATE (no conversation yet): a centered column (max 760px):
- Heading (large, sentence case): "What do you need to look up?"
- Subtext: "Ask about an HR policy. I will find the governing clause and show exactly where it comes from."
- A large rounded question box (the placeholder for questions): auto-growing textarea, placeholder "Ask a question, for example: How many days of annual leave does a part-time employee get?", with an "Ask" button inside on the right. Enter submits, Shift+Enter adds a line. Under it, small muted text: "Do not include names or employee IDs. They are removed before processing."
- NO context fields of any kind.
- A quiet section "Recent help desk inquiries" (plain list with hairline dividers, not cards) showing the 8 inquiries below: ticket id, subject, small status label, requester department. Clicking a row starts the conversation from that ticket.
- A section "Or try asking" with four plain text links (free-text examples below).
- Footer line: "Answers are AI-assisted. Check the source before you send anything to an employee."

CONVERSATION STATE (after the first question): the page becomes a single-column thread (max 820px) with the question box moving to a sticky bottom bar ("Reply to the assistant or ask another question") and a "New inquiry" button top right that clears the thread. Messages:
1. The advisor's message, redacted: employee IDs, emails and phone numbers become chips like "[employee ID removed]" (regex for IDs: /\bE\d{4,6}\b/ so E0040 and E104522 both match). If anything was removed show "Personal details were removed before processing. Names and employee IDs are never stored."
2. If the thread started from a ticket, a thin banner above the first message: ticket id, subject, department, status, and "Synthetic help desk inquiry".
3. The assistant's reply, preceded each time by a short "How this was checked" sequence (steps appear one after another over about 1.2 seconds, then collapse into an expandable row). Steps with one-line details: Removed personal details. Matched the topic. Checked what context is needed. Searched the approved policies (detail: "18 policies searched; clause text loaded for 5"). Found candidate clauses. Confirmed the quote matches the stored text word for word. Checked the version and effective date.
4. The reply is ONE of four outcomes:
   A) ASKS A QUESTION BACK (clarify): slate panel with ONE plain question, a row of tappable reply chips (the options), and "Tap a reply or type it below." No clause shown. When the advisor answers (chip or typing), show their answer as their message, then continue with another follow-up or the answer. After context is collected, show a thin line "What I know so far:" with chips like "Employment type: part-time".
   B) ANSWERED: the answer card (below).
   C) ROUTED: slate panel, heading "I can't answer this one.", one sentence why, "Route this to:" team name and one-line instruction. No quote, no advice.
   D) NO GOVERNING CLAUSE: slate panel "No approved source covers this question." with route "People Operations supervisor", plus the dataset caution when relevant.

ANSWER CARD (flat, bordered):
- Heading: policy title with a small tag "Synthetic dataset".
- Quote block: serif, left border in primary colour, the clause text exactly as stored, in quotation marks. For table-row quotes keep the stored text exactly and add a caption "Row from a table in the source."
- Provenance strip (flat row with hairline dividers, wraps on small screens): Policy file | Clause reference | Version | Effective date | Source link (a disabled control "Open source (not available in prototype)").
- Green line: "Quote matches the stored text word for word."
- Amber notice when the effective date is missing (true for every source here): "This source does not state an effective date. HR needs to confirm one before you rely on it." The effective-date cell shows "Not stated in the document".
- Optional neutral note per clause (data field "note").
- "Draft reply" (collapsed by default): editable textarea prefilled with "Hello [employee name],\n\nI checked [policy title], [clause reference]. It states:\n\n“[quote]”\n\n[your answer for this employee's situation]\n\nPlease let me know if any of the facts above are not correct.", a "Copy draft" button, and the note "The assistant does not send email. Review the draft and send it from your own email."
- "Related questions": up to three tappable chips (data field "related") that ask that question.
- If the thread started from a ticket, a "Dataset check" row: "Ticket label: <related_policy_file>. Retrieved: <policy file>." then "Match." or "Different. Needs manual review before this is used for scoring." Add each result to the shared dataset checks list.
- Feedback row: "Was this the right clause?" buttons "Correct", "Wrong clause", "Missing something". Selecting one disables the row, shows the choice, shows a toast "Thanks. Flagged answers go to the review queue.", and for Wrong clause or Missing something adds an Open item to the review list. Small label "AI-assisted answer".
For ROUTED and NO CLAUSE outcomes show the same feedback row with the question "Was routing this the right call?" and buttons "Correct", "Should have answered", "Wrong team".

=== STARTING FROM A TICKET ===
Clicking a help desk row starts the thread with this as the advisor's message: "<subject>. <description>" (description after redaction, for example "Leave – Balance assistance. User [employee ID removed] requests help regarding Leave/Balance."), sets the ticket banner and the ticket's candidate label for the dataset check, and runs the normal matching.

Help desk inquiries (id | subject | department | status | category/subcategory | candidate label | description):
1. HR-202501-0006 | Leave – Balance assistance | Marketing | Waiting for Employee | Leave/Balance | leave_policy_en.docx | User E0064 requests help regarding Leave/Balance.
2. HR-202501-0009 | Leave – Policy assistance | Operations | Resolved | Leave/Policy | leave_policy_en.docx | User E0046 requests help regarding Leave/Policy.
3. HR-202501-0007 | Benefits – Health assistance | Sales | Open | Benefits/Health | compensation_benefits_policy_en.docx | User E0115 requests help regarding Benefits/Health.
4. HR-202501-0003 | Benefits – Wellbeing assistance | IT | Resolved | Benefits/Wellbeing | compensation_benefits_policy_en.docx | User E0062 requests help regarding Benefits/Wellbeing.
5. HR-202501-0001 | Payroll – Payslip assistance | IT | Closed | Payroll/Payslip | compensation_benefits_policy_en.docx | User E0040 requests help regarding Payroll/Payslip.
6. HR-202501-0027 | Training – Mandatory assistance | Finance | Resolved | Training/Mandatory | training_development_policy_en.docx | User E0006 requests help regarding Training/Mandatory.
7. HR-202501-0002 | Policy – GDPR assistance | Finance | In Progress | Policy/GDPR | code_of_conduct_en.docx | User E0061 requests help regarding Policy/GDPR.
8. HR-202501-0011 | Policy – Code of Conduct assistance | Sales | In Progress | Policy/Code of Conduct | code_of_conduct_en.docx | User E0019 requests help regarding Policy/Code of Conduct.
Also keep in the data file (not on the homepage list): HR-202501-0005 "Recruitment – Referral assistance" and HR-202501-0010 "Other – Question assistance" (unmapped set, no candidate label).

"Or try asking" free-text examples:
- "How many days of annual leave does a part-time employee get?"
- "What happens at 10 years of service for annual leave?"
- "How much is the training budget?"
- "An employee is asking about their active grievance. What should I tell them?"

=== MATCHING AND FOLLOW-UP LOGIC (scripted, no AI; keep in a small pure module with unit tests) ===
Lowercase the redacted question text (for tickets include subject and description). Evaluate in this order and stop at the first match:
1. SENSITIVE ROUTES (outcome ROUTED, never a quote):
   - grievance, disciplin, terminat, dismiss, investigation, whistle -> team "Labour Relations".
   - harass -> "Labour and Employee Relations".
   - accommodat, medical, disabilit -> "Health and Wellness".
   - union, collective agreement, bargaining -> "Labour Relations", reason "Collective agreements are not loaded in this prototype's dataset yet."
   Instruction for all: "This needs a person's judgment and confidentiality. Pass the question to <team> and do not reply with policy wording."
2. PAYROLL: payslip, pay stub, tax form, direct deposit, payroll -> ROUTED to "Payroll". Reason: "None of the loaded policies has a clause about this." Instruction: "Payroll updates are not an HR task. Send the employee to Payroll with the steps for changing their details." Add the dataset caution when a ticket label exists.
3. TOPICS from the topic list below, in order; a topic matches when any keyword appears. A topic has either a direct clause or a clarify tree (one or two follow-up questions) ending in a clause.
4. Unmatched, or contains referral, recruitment, or "other/question": outcome NO CLAUSE with the dataset caution: "This inquiry has no related policy in the dataset. Unmapped tickets are not verified no-answer cases, so a person should review it."
Follow-ups: when a clarify question is pending, treat the next advisor message as the answer. Match it to an option by label or keywords (case-insensitive). If it matches, continue. If it does not match and looks like a new question (matches a different topic by keywords, or contains a question mark), treat it as a new question. Otherwise reply with a clarify message: "I did not catch that. Choose one of these:" with the same chips. Never ask for something the advisor already said (if the question already says "part-time", skip the employment type question).

DATASET CAUTION (muted note under ROUTED and NO CLAUSE when the thread came from a ticket with a candidate label): "Ticket label: <file>. The labelled policy has no clause for this, so the label may be wrong. Flagged for manual review." Also add it to the dataset checks list as Different.

=== DATA FILE (src/lib/hr-research-data.ts) ===
Real synthetic dataset "WRHN HR Prototype Subset": 18 English policies, 155 policy-linked tickets, 63 unmapped tickets, derived from the Bilingual HR Bronze (EN/PL) Synthetic Corporate Data Lake Snapshot 2025-01, licence CC BY 4.0. Show attribution on the Sources page. Quotes are verbatim; do not paraphrase or "fix" them. Define types Policy, Clause, Topic, Ticket, ReviewItem, DatasetCheck.

Policies:
- leave_policy_en.docx | "Annual Leave Policy" | version 2025-01 | effective: not stated (placeholder "[Insert Date]" in the document) | linkedTickets 22 | clause text loaded
- compensation_benefits_policy_en.docx | "Compensation & Benefits Policy" | 2025-01 | not stated (placeholder) | 84 | loaded
- code_of_conduct_en.docx | "Code of Conduct & Ethics Policy" | 2025-01 | not stated (no effective date in the document) | 29 | loaded
- training_development_policy_en.docx | "Training & Development Policy" | 2025-01 | not stated (no effective date in the document) | 20 | loaded
- data_privacy_gdpr_policy_en.docx | "Data Privacy & GDPR Policy" | 2025-01 | not stated (placeholder) | 0 | loaded
- Without clause text in this prototype (title derived from file name, version and effective date "Not read in prototype", linkedTickets 0): dei_policy_en.docx "DEI policy"; anti_harassment_policy_en.docx "Anti-harassment policy"; travel_expense_policy_en.docx "Travel and expense policy"; whistleblowing_policy_en.docx "Whistleblowing policy"; remote_work_policy_en.docx "Remote work policy"; it_security_acceptable_use_en.docx "IT security and acceptable use policy"; performance_review_policy_en.docx "Performance review policy"; flexible_work_policy_en.docx "Flexible work policy"; termination_exit_policy_en.docx "Termination and exit policy"; equal_opportunity_policy_en.docx "Equal opportunity policy"; recruitment_onboarding_policy_en.docx "Recruitment and onboarding policy"; grievance_disciplinary_policy_en.docx "Grievance and disciplinary policy"; health_safety_policy_en.docx "Health and safety policy".
  If the advisor asks about one of these (travel, expense, remote work, flexible work, performance review, security, acceptable use, diversity, equal opportunity, health and safety, onboarding, exit), outcome NO CLAUSE with "This policy is in the dataset, but its clause text is not loaded into this prototype yet." and route "People Operations supervisor".

Clauses (id | policy file | ref | verbatim text | optional note):
LEAVE (leave_policy_en.docx):
- L11 | "1.1 Full-Time Employees" | "Full-time employees are entitled to an annual leave of 26 days per year. This leave is accrued monthly, starting from the first day of employment."
- L12 | "1.2 Part-Time Employees" | "Part-time employees will accrue annual leave on a pro-rata basis, calculated according to their contracted hours. For example, if a part-time employee works 20 hours a week, they will receive 13 days of annual leave per year."
- L13 | "1.3 Probationary Employees" | "Employees on probation are entitled to annual leave, which will be accrued at a rate of 1.5 days per month during the probation period. Upon successful completion of probation, the employee will transition to the full entitlement."
- L14 | "1.4 Contractors" | "Contractors are not eligible for annual leave benefits. However, they may negotiate time off within their contract terms."
- L21 | "2.1 Standard Accrual" | "Full-Time Employees: 2.17 days per month (26 days annually)"
- L31 | "3.1 Carry-Over Rules" | "Employees may carry over a maximum of 10 unused annual leave days into the next calendar year. Any unused days beyond this limit will be forfeited unless otherwise agreed upon by management."
- L33 | "3.3 Exceeding Maximums" | "If an employee exceeds the carry-over limit, they will receive a notification from HR. The employee must use the excess days within the next six months or risk forfeiture."
- L52 | "5.2 Timeframe" | "Requests should be approved or denied within 5 business days. If a supervisor does not respond within this timeframe, the request will be automatically escalated to the next level of management."
- L53 | "5.3 Escalation Process" | "If a request is denied, the employee can appeal to HR within 3 business days of the denial. HR will review the appeal and provide a final decision within 5 business days."
- L61 | "6.1 Public Holidays" | "If a public holiday falls within an employee's scheduled leave, that day will not be deducted from their annual leave balance."
- L62 | "6.2 Maternity/Paternity Leave" | "Employees on maternity or paternity leave will not accrue annual leave during their leave period. However, upon return, they will receive a one-time credit of 5 additional days."
- L63 | "6.3 Unpaid Leave" | "Employees on unpaid leave will not accrue annual leave during the unpaid period."
- L64 | "6.4 Long Service Awards" | "Employees who have completed 10 years of service will receive an additional 5 days of annual leave as a long service award."
- LFAQ5 | "Appendix, FAQ A5" | "You can check your leave balance in the HRIS or contact HR for assistance."
COMPENSATION AND BENEFITS (compensation_benefits_policy_en.docx; no clause numbers, so ref is the heading path). The note for C_HEALTH, C_RETIRE, C_WELL, C_ALLOW, C_PERKS is: "Benefits may vary by location and role. Source: Extended FAQ, question 4: \"Benefits may vary by location and role, but core offerings are consistent across the organization.\" Confirm the employee's role before replying."
- C_HEALTH | "Benefits > Healthcare" | "Comprehensive healthcare plans, including medical, dental, and vision coverage."
- C_RETIRE | "Benefits > Retirement" | "Retirement savings plans with company matching contributions."
- C_WELL | "Benefits > Wellbeing" | "Programs promoting physical and mental health, including gym memberships and wellness workshops."
- C_INS | "Benefits > Insurance" | "Life and disability insurance coverage for all employees."
- C_ALLOW | "Benefits > Allowances" | "Travel and relocation allowances for employees required to move for work."
- C_PERKS | "Benefits > Perks" | "Employee discounts, flexible work arrangements, and professional development opportunities."
- C_REVIEW | "Pay Review Process > Annual Cycle" | "Conduct annual salary reviews in Q4, with adjustments effective from January 1."
- C_MID | "Pay Review Process > Mid-Year Adjustments" | "Allow for mid-year salary adjustments in cases of significant changes in job responsibilities or market conditions."
- C_PROB | "Pay Review Process > Probation Raises" | "Employees completing their probation period will be reviewed for potential salary increases based on performance and role alignment."
- C_BONUS | "Bonus & Incentive Programs > Performance-Based Bonuses" | "Annual bonuses based on individual and company performance metrics."
- C_PARENT | "Leave Entitlements Connected to Compensation > Parental Leave" | "Paid parental leave for both primary and secondary caregivers, exceeding legal minimums."
- C_SICK | "Leave Entitlements Connected to Compensation > Sick Pay" | "Paid sick leave policy ensuring employees can take necessary time off without financial penalty."
- C_REMOTE | "Geographic/Remote Work Adjustments" | "Compensation for remote employees will be adjusted based on the cost of living in their location."
CODE OF CONDUCT (code_of_conduct_en.docx; heading paths):
- K_GIFT | "Conflicts of Interest > Prohibited Activities" | "Accepting gifts from clients or suppliers that exceed a nominal value." | note: "Appendix FAQ 2 adds: \"Only nominal gifts are acceptable; anything beyond that must be reported.\""
- K_CONFLICT | "Conflicts of Interest > Disclosure Process" | "Employees must disclose any potential conflicts to their manager or HR."
- K_REPORT | "Reporting Concerns and Whistleblower Protections" | "Employees are encouraged to report any unethical behavior or violations of this policy."
- K_PROTECT | "Reporting Concerns and Whistleblower Protections > Protections" | "Employees who report concerns in good faith will not face retaliation."
- K_IT | "Use of Company Assets and IT Resources" | "Company assets, including IT resources, should be used responsibly and primarily for business purposes."
- K_CONF | "Confidentiality and Data Protection Obligations" | "Employees must protect sensitive information related to the company, clients, and colleagues."
TRAINING AND DEVELOPMENT (training_development_policy_en.docx):
- T_MAND | "Appendix, FAQ question 1" | "Compliance, security, onboarding, and health & safety training are mandatory for all employees."
- T_REQ | "Appendix, FAQ question 2" | "Complete a training request form and submit it to your manager for approval."
- T_B_ENTRY | "Learning Budget Management > budget table (Role Level, Annual Training Budget Limit)" | "Entry-Level | $1,000"
- T_B_MID | same ref | "Mid-Level | $1,500"
- T_B_SENIOR | same ref | "Senior-Level | $2,500"
- T_B_EXEC | same ref | "Executive-Level | $5,000"
- T_CARRY | "Learning Budget Management > Carryover Rules" | "Unused training budgets may be carried over to the next fiscal year, subject to managerial approval."
- T_REIMB | "Reimbursement Process for External Training" | "Submit receipts to HR for reimbursement within 30 days of completion."
- T_DENIED | "Appendix, FAQ question 6" | "You may discuss the reasons with your manager and explore alternative training options."
DATA PRIVACY (data_privacy_gdpr_policy_en.docx):
- G_ACCESS | "Data Subject Rights" | "Right of Access: The right to request access to personal data."
- G_RECT | "Data Subject Rights" | "Right to Rectification: The right to request correction of inaccurate personal data."
- G_ERASE | "Data Subject Rights" | "Right to Erasure: The right to request deletion of personal data."
- G_TIME | "Data Subject Rights > Handling Timelines" | "Requests will be acknowledged within 5 business days. Responses will be provided within 30 days, extendable to 60 days for complex requests."
- G_BREACH | "Incident & Breach Notification" | "Notification: Notify the relevant authorities within 72 hours and affected individuals as required."
- G_RETAIN_EMP | "Retention & Deletion > Retention Schedule" | "Employee Records | 7 years post-employment"
- G_RETAIN_PAY | same ref | "Payroll Data | 7 years"
- G_RETAIN_CAND | same ref | "Candidate Applications | 1 year"
- G_RETAIN_PERF | same ref | "Performance Reviews | 3 years"

Topics (evaluate in this order; keywords are lowercase substrings):
1. long-service: ["10 years", "ten years", "long service", "years of service"] -> L64; related: ["How does annual leave carry over?", "How many days of annual leave does a full-time employee get?"].
2. carry-over: ["carry over", "carry-over", "carryover", "forfeit", "unused leave"] -> L31; if the text also contains "exceed" -> L33; related: ["What happens if the employee exceeds the carry-over limit?"].
3. leave-approval: question contains "leave" and one of ["approve", "approval", "how long does leave", "escalat"] -> L52; if it contains "denied" or "appeal" -> L53; related: ["What if a leave request is denied?"].
4. leave-special: "maternity" or "paternity" -> L62; "public holiday" -> L61; "unpaid leave" -> L63.
5. leave-balance: ["leave/balance", "leave balance"] -> clarify Q1 "What do you need to know about the leave balance?" with options "How it accrues" (keywords accru, earn), "Carry-over" (carry), "How to check it" (check, view, find, where). "How to check it" -> LFAQ5. "Carry-over" -> L31. "How it accrues" -> clarify Q2 (employment type, below).
6. leave-entitlement: ["annual leave", "vacation", "days of leave", "leave entitlement", "leave days", "accrue", "accrual", "leave/policy"]. If the question already says full-time, part-time, probation or contractor, skip the question. For "leave/policy" tickets and generic leave questions that are not clearly about entitlement or accrual, first ask Q0 "Which leave topic is this about?" with options "Annual leave entitlement" (entitle, how many, days), "Carry-over" (carry), "Requesting and approval" (request, approv), "Maternity or paternity leave" (maternity, paternity), "Long service" (long, years). Entitlement and accrual go to Q2 "Is the employee full-time, part-time or on probation?" with options "Full-time" (full) -> L11, or L21 when the original question was about accrual; "Part-time" (part) -> L12; "On probation" (probation, probationary) -> L13; "Contractor" (contract) -> L14. Related for all: ["What happens at 10 years of service for annual leave?", "How does annual leave carry over?"].
7. benefits-specific: "health", "dental", "vision" -> C_HEALTH; "wellbeing", "wellness", "gym" -> C_WELL; "retirement", "pension", "401" -> C_RETIRE; "insurance", "disability" -> C_INS; "relocation", "allowance" -> C_ALLOW; "perk", "discount" -> C_PERKS. Ticket text "Benefits/Health" and "Benefits/Wellbeing" match the first two. Related: ["How does remote work affect pay?", "How often are salary reviews held?"].
8. benefits-generic: ["benefit"] -> ask "Which benefit is the employee asking about?" with options Healthcare (health), Retirement (retire, pension), Wellbeing (well), Insurance (insur), Allowances (allowance, relocat), Perks (perk, discount) -> the matching C_ clause.
9. pay-review: "salary review", "pay review", "how often are salary" -> C_REVIEW; "mid-year" -> C_MID; "probation raise", "raise after probation" -> C_PROB; "bonus" -> C_BONUS; "remote" with ("pay" or "salary" or "compensation") -> C_REMOTE; "parental" -> C_PARENT; "sick pay" or "sick leave" -> C_SICK.
10. training-budget: contains ("training" or "learning") and ("budget") -> ask "What is the employee's role level?" with options Entry-level (entry) -> T_B_ENTRY, Mid-level (mid) -> T_B_MID, Senior-level (senior) -> T_B_SENIOR, Executive-level (exec) -> T_B_EXEC. Skip the question if the text already names a level. If the text contains "carry" -> T_CARRY. Related: ["Can unused training budget be carried over?", "How does the employee get training reimbursed?"].
11. training-other: "reimburse" -> T_REIMB; "request training", "request a course" -> T_REQ; "denied" with "training" -> T_DENIED; "mandatory" or "training/mandatory" -> T_MAND (related: ["How does the employee request optional training?"]).
12. conduct-specific: "gift" -> K_GIFT (related: ["What must an employee disclose about conflicts of interest?"]); "conflict" -> K_CONFLICT; "report", "unethical" -> K_REPORT (related: ["Is the employee protected if they report a concern?"]); "protected", "retaliat" -> K_PROTECT; "it resources", "company assets", "laptop", "software" -> K_IT; "confidential" -> K_CONF.
13. conduct-generic: ["code of conduct", "policy/code of conduct", "conduct"] -> ask "Which part of the code of conduct is this about?" with options Gifts (gift) -> K_GIFT, Conflicts of interest (conflict) -> K_CONFLICT, Reporting a concern (report, concern) -> K_REPORT, Company IT and assets (it, asset, laptop) -> K_IT, Confidentiality (confiden) -> K_CONF.
14. privacy-specific: "breach" -> G_BREACH; "how long" with ("keep" or "retain" or "retention") -> ask "Which records?" with options Employee records (employee) -> G_RETAIN_EMP, Payroll data (payroll) -> G_RETAIN_PAY, Candidate applications (candidate, applicant) -> G_RETAIN_CAND, Performance reviews (performance) -> G_RETAIN_PERF; "how quickly", "timeline", "respond to a data request" -> G_TIME.
15. privacy-generic: ["gdpr", "policy/gdpr", "personal data", "data privacy", "dsar", "data request"] -> ask "What does the employee want to do with their personal data?" with options See it (see, access, copy, request) -> G_ACCESS, Correct it (correct, wrong, rectif, fix, update) -> G_RECT, Delete it (delete, erase, remove) -> G_ERASE, Report a breach (breach, leak, lost) -> G_BREACH, Know how long it is kept (long, keep, retain) -> the retention question above. For G_ACCESS, G_RECT and G_ERASE related: ["How quickly must a data request be answered?"].
Every "related" entry is a plain question string that starts a new question when tapped. Make sure each topic can be reached and tested.

=== PAGE 3: "/assistant/review" REVIEW QUEUE ===
Role Advisor: gentle message "The review queue is for reviewers. Switch role to Reviewer to open it." with a "Switch to Reviewer" button. Role Reviewer:
- "Flagged answers": flat rows with hairline dividers: question (redacted), verdict, cited clause, date flagged, status (Open or Reviewed), "Mark as reviewed" button. New flags appear at the top. Seed: (a) "Leave – Balance assistance (HR-202501-0006)", verdict "Missing something", clause "Appendix, FAQ A5", 2026-10-05, Open; (b) the same ticket flagged again, "Missing something", same clause, 2026-10-04, Open; (c) "Payroll – Payslip assistance (HR-202501-0001)", verdict "Wrong clause", cited clause "No clause", 2026-10-03, Reviewed. Show a count per cited clause and, when a clause is flagged two or more times, "Flagged 2 times. This may be a gap in the sources or in the precedence rules, not a one-off."
- "Ticket label checks": a small table of dataset checks (ticket id, ticket label, retrieved policy, result). Seed: HR-202501-0002 | code_of_conduct_en.docx | data_privacy_gdpr_policy_en.docx | Different; HR-202501-0001 | compensation_benefits_policy_en.docx | none (no clause) | Different; HR-202501-0007 | compensation_benefits_policy_en.docx | compensation_benefits_policy_en.docx | Match. Plus live results from conversations. Caption: "Ticket labels in this dataset are candidate labels, not ground truth. Review disagreements by hand before scoring."

=== PAGE 4: "/assistant/sources" SOURCES ===
- Table of all 18 policies: Policy file | Title | Version | Effective date | Linked tickets | Clause text loaded | How questions are handled. Handling: "Answered with a quote" for the five loaded policies; "Routed to a person" for grievance_disciplinary, anti_harassment, whistleblowing, termination_exit; "Not loaded in prototype" for the other eight.
- Plain summary under it: "155 tickets are linked to an English policy (compensation and benefits 84, code of conduct 29, leave 22, training and development 20). 63 tickets have no related policy."
- Section "Not in this dataset yet": collective agreements, PolicyStat applicability and site fields, effective dates, harmonisation status, and form files. One line: "The real build needs these. The prototype cannot show them with this data."
- Section "About this prototype" with three short disclosures: What is mocked (answers are scripted, sources are synthetic, nothing is sent or stored). What the real build will add (search over approved WRHN documents, exact-quote verification, HR-owned routes). Scope (HR Advisors and People Operations Associates only; employees and people leaders are out of scope for release 1).
- Attribution: "Synthetic data derived from the Bilingual HR Bronze (EN/PL) Synthetic Corporate Data Lake Snapshot (2025-01), licensed CC BY 4.0. These policies are generic templates, not WRHN policies."

=== QUALITY BAR ===
- Everything works with the sample data only, no console errors.
- Unit tests for the matching module: redaction (including E0040), sensitive route ordering, payroll routing, leave entitlement follow-up (asks employment type then answers), skipping the follow-up when the question already says part-time, the "10 years of service" direct answer, the leave balance two-step follow-up, the GDPR follow-up, the training budget follow-up, the unmapped ticket outcome, and an unmatched reply to a pending follow-up.
- Verify in the browser at desktop and 375px: the SharePoint tile opens /assistant; the logo renders on both pages; "How many days of annual leave does a part-time employee get?" answers directly with 1.2; "How many days of annual leave does the employee get?" asks employment type, tapping Part-time answers 1.2; the "Leave – Balance assistance" inquiry asks what to know, "How it accrues" asks employment type, "Full-time" answers 2.1; the "Payroll – Payslip assistance" inquiry routes to Payroll with the dataset caution; the "Policy – GDPR assistance" inquiry asks what the employee wants, "See it" answers G_ACCESS and the dataset check shows Different; flagging an answer shows it in the Review queue as a Reviewer.
- When done, give me a short summary and confirm the logo is visible on both pages.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://wrhn-hr-helper.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/9c39d8f4-614b-4c62-955f-b0ecc234082c).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
