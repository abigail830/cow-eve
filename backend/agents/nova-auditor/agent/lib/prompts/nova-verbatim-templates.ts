/**
 * Verbatim Nova prompt templates (see docs/nova-system-analysis.md Appendix).
 * Placeholders: {summary_controls}, {transcription_text}, {text}.
 * Finding intro/update JSON output instructions replace Nova plain-text closing only.
 */

export const NOVA_CHAT_SYSTEM_MESSAGE = `You are a helpful assistant.
IMPORTANT: User messages may contain transcribed text from dictation, clearly marked with
'--- Start of Dictated Text ---' and '--- End of Dictated Text ---'. When asked to recall,
summarize, or use dictated or transcribed content, pay close attention to text within these
markers in the user messages and treat it as source material. When referring in conversation
to text from transcribed images or audio, it should be treated as written input and should
not be referred to as transcribed.`;

export const AUDIT_SUMMARY_TEMPLATE = `
    Please fill the following form summarising the content provided under the Transcription heading.     
    Make sure to use the exact headers as the ones provided:

    **Form to be filled**:
    Title - Audit Summary
    Audit subject: 
    Auditor: 
    Auditee(s):
    Objective evidence, process controls reviewed and comments:

    **Language**: 
    Make sure that the output is generated in the same language as the input text. The language of the output must match the language of the input text. 
    Alternatively, the user may specify the desired language for the output.
    {summary_controls}
    
    **Transcription**:
    The input to summarise should include all document and audio transcriptions along with any notes provided by the auditor. Use the full content below:
    {transcription_text}
    
    **Output example**:
    Title - Audit Summary

    Audit subject: Management System Elements / Senior Leadership 
    Auditor: Tony Snowdon 
    Auditee(s):
    * Steven Bolton - Factory Manager
    * Nathan McCluskey - Production Engineer
    * Shelley Wales - Managing Director

    Objective evidence, process controls reviewed and comments:
    Scope: Remains current as - The design and manufacture of lifting equipment, cable termination and tensioning equipment, and ancillary components in the marine, oil and gas, offshore, construction, defence, and aerospace industries.
    Website: http://www.petersen-stainless.co.uk / Structural tab - ISO 9001:2008 + AS9100-C Certified (discussion with client team - website access issues / changes ongoing)
    Context Discussions Include:
    * Current business and performance
    * Risks and opportunities
    * Customer satisfaction and workforce collaboration
    MD Discussions Reference:Current and future state, capital investment, QMS ability to support operations.
    Business Overview:
    * Shifts: 4 days working - Mon to Thu - 7:00am to 4:30pm
    * Org Chart: 22.07.24
    * F004-3: Interested Parties Register
    * F004-2: Risk Register
    * Quality Policy: Quality Policy (Ver 3)
    * Management Review: Procedure P004 / (Template F004-1 Ver 4) / Meeting Number: 35 / 19.07.24 - Includes Actions, Context Review, Process Performance & Product Conformance Issues, Internal & External Audits, CA/PA (discussion with the client - 'language' of the customer base), Customer feedback (complaints and satisfaction), Supplier, L&D, CI, Objectives
    QMS Processes and Procedures Include:
    * Performance (Complaints and NCs): Non-conformance Report Log (F020-2) / Corrective and Preventative Register (F023-1) / Sampled NCs (Template F020-1 Ver 9)) #633 (GDOSPIN-ROD) / #634 (PHISTA-PENAG)
    * Internal Audits: Procedure P018 / Audit Schedule (F018-1 Ver 4) / Eg. P009 - Design & Development -16.04.24

    Comments:
    * A team that clearly understands the context of their operations and the requirements of their interested parties.
    * The QMS includes a number of core procedures which support the business in processing enquiries into product realisation.
    * Good standards of self-governance via internal audits and the annual management review meeting, supported by daily run-the-business meetings, and daily stand-up infrastructure reviews.
    * High levels of quality performance, with robust and effective root cause and corrective actions where sampled.
    
    Evaluation and conclusions:
    The processes were found to be compliant from the sample taken.

    **Instructions:**
    Return ONLY a JSON object with the following keys: "audit_subject", "auditor", "auditees", "objective_evidence_process_controls_reviewed_and_comments".
    Ensure the JSON is valid with double quotes.
    `;

export const EXECUTIVE_SUMMARY_TEMPLATE = `
    Please fill the following form based on the content in the Transcription. 
    Make sure to use the exact headers as the ones provided:

    **Form to be filled**:    
    Audit outcome:
    This is the overall conclusion and recommendation regarding certification. Limit this to a maximum of two or three sentences when confirming if the clients management system is capable to meet the standard and stakeholder requirements and a statement regarding the status of certification. Ensure that your conclusions are clear for the client.
    
    Continual improvement:
    Highlight any significant continual improvement activities that have shown clear benefit. This section must also include a statement of effectiveness and if the system is delivering the desired outcomes, such as meeting client and regulatory requirements. Where the outcomes are not being achieved, summarise the ways in which it is not achieving and refer to the related nonconformities.
    
    Areas for senior management attentions:
    Be very brief and concise. The detail on non-conformities raised will be in your Audit findings log.
    If you do not detect any need for any management action, simply state this.
    Summarise your conclusions and recommendations from your audit related to continual improvement, this can include a summary of the planned improvements of the client plus their performance against any improvement objectives they currently have, and refer to any related nonconformities.

    **Language**: 
    Make sure that the output is generated in the same language as the input text. The language of the output must match the language of the input text. 
    Alternatively, the user may specify the desired language for the output.
    {summary_controls}

    **Transcription**:
    The input to summarise should include all document and audio transcriptions along with any notes provided by the auditor. Use the full content below:
    {transcription_text}

    **Output example**:
    Audit outcome:
    This visit was to audit the compliance of the management system of Petersen Stainless Rigging Ltd against ISO 9001:2015 as defined in the audit planning documentation. The outcome of the visit is recorded below. 
    
    There were no no open LRQA non-conformities to review, with none raised during the course of this audit. 
    
    Continued certification to ISO 9001:2015 is recommended based on objective evidence reviewed and sampled.
    
    All personnel were thanked for their support during the audit, and the LRQA would like to comment on the positive 
    and engaged nature of all auditees.
    
    This report was presented to, and accepted by, Steven Bolton (Factory Manager) on behalf of Petersen Stainless
    Rigging Limited.

    Continual improvement:
    - Continued investment in additional capital equipment (eg. new press).
    - The Quality Management System continues to be effective in supporting the needs of the business and associated 
    interested parties.

    Areas for senior management attention:
    None identified.

    Instructions:
    Any specific evidence from the Transcription should not be repeated. Be brief, and write using natural language.

    **Additional Instructions:**
    Return ONLY a JSON object with the following keys: "audit_outcome", "continual_improvement", "areas_for_senior_management_attention". Ensure the JSON is valid with double quotes.
    `;

export const FINDINGS_INTRO_TEMPLATE = `
    Please generate findings introduction paragraphs. The user has provided the Auditor's Notes below.
    The user must also provide the ISO standard reference in the format ISO <number>
    (for example, ISO 9001 or ISO 14001). If the standard is missing, do not
    generate the paragraphs and ask the user to provide it.
    You must generate FOUR distinct paragraphs, each addressing a specific aspect:

    **1. Clause**
    This is the specific clause of the standard (e.g., ISO 9001:2015 clause 4.4.2, ISO 14001:2015 clause 6.2.1, etc.) or the relevant requirement from the company's own system that was not met.
    It should be concise and directly reference the requirement
    It links the finding to the exact requirement in the standard.
    If the auditor's notes suggest multiple clauses or requirements, make sure to generate a bullet point for each clause/requirement mentioned.
    
    Example 1: "ISO 9001:2015, Clause 8.1 - Planning of product and service realization"
    Example 2 (2 clauses): "1. ISO 14001:2015, Clause 6.2.1 - Environmental objectives
                            2. ISO 14001:2015, Clause 6.2.2 - Environmental management programs"

    **2. Statement of Non-Conformity**
    This is a short sentence clearly stating the problem, followed by a short explanation of the identified problem.
    Use the standard format:
    - "The <process> was not found to be fully effective." followed by a short explanation.
    - "The <process> was not found to be effective." followed by a short explanation.
    The statement must be clear when read alone and not rely on process table evidence. Use standard sentence format.

    **3. Requirement**
    This explains what the standard (or the company's own system) expects.
    It is the "rule" the client should follow. In ART, part of it auto-populates from the selected clause.
    If there are multiple clauses, provide the corresponding requirements for each.
    
    Example 1: "The organization must plan product and service realization by determining the requirements 
    for products or services, including any regulatory and legal requirements, and the risks associated with 
    the products or services."

    Example 2 (with 2 clauses): "ISO 9001:2015 Clause 7.1.5.2 Measurement traceability
        When measurement traceability is a requirement, or is considered by the organisation to be an essential part of providing confidence in the validity of measurement results, measuring equipment shall be:
        a) calibrated or verified, or both, at specified intervals, or prior to use, against measurement standards traceable to international or national measurement standards; when no such standards exist, the
        basis used for calibration or verification shall be retained as documented information.

        ISO 13485:2016 Clause 7.6 Control of monitoring and measuring equipment 
        The organisation shall determine the monitoring and measurement to be undertaken and the monitoring and measuring equipment needed to provide evidence of conformity of product to determined requirements.
        The organisation shall document procedures to ensure that monitoring and measurement can be carried out and are carried out in a manner that is consistent with the monitoring and measurement requirements.
        The organisation shall perform calibration or verification in accordance with documented procedures."

    **4. Evidence of Non-Conformity**
    This is the proof showing the requirement was not met.
    It must be clear, short, factual and answer:
    - What did you review?
    - What was missing or incorrect?
    - Where did it happen?
    - How many / how often?
    Polish and refine the auditor's notes to make it stronger and more professional, while keeping it factual.

    The evidence must be strong enough to justify the finding on its own.

    Example: "During review of the design control process (procedure QA-05), no documented risk assessment 
    was present for the new product line launched in Q2 2024. Three product files sampled (SKU-001, SKU-002, SKU-003) 
    showed no evidence of requirement determination or risk analysis prior to design commencement."

    **Auditor's Notes**:
    {text}

    **Language**: 
    Make sure that the output is generated in the same language as the input text. The language of the output must match the language of the input text.

    **Important**: If the auditor's notes do not explicitly mention the standards being audited against, do not assume any standards. Instead, return a message asking the user to provide the relevant standards.

    **Instructions**:
    Return ONLY a JSON object with keys "clause", "statement_of_non_conformity", "requirement", "evidence_of_non_conformity".
    Use double quotes. Valid JSON only. Do NOT include markdown headers or extra keys.
    Each value must be as concise as possible while remaining professional and evidence-based; avoid unnecessary wording.
    `;

export const FINDINGS_OUTRO_TEMPLATE = `
    Please generate three structured paragraphs related to the following audit
    finding information and the client's proposed correction/corrective action
    and timescale. Check against ISO 17021 unless stated otherwise.
    Do not mention the standard, clause, or paragraph headings in the body of
    the paragraphs. This step is for update findings, so the ISO reference and
    clause are unnecessary.

    **1. Correction Review (What was fixed immediately?)**
    Purpose: Confirm the organization has eliminated the symptom of the nonconformity.

    What the auditor checks: 
    Evidence that the problem has been corrected (e.g., containment, replaced item, updated record).
    That the correction actually removes the immediate nonconforming condition.

    Example 1: "The issue was communicated to YGP and it was confirmed that the register did include the mentioned legislation but that the site had incorrectly searched."
    Example 2: "An environmental drill report has been produced (dated 17/07/25)."

    **2. Root Cause Review (Why did it happen?)**
    Purpose: Assess whether the organization has properly identified the real cause of the nonconformity.
    
    What the auditor checks:
    A documented and logical root cause analysis. That the RCA method is appropriate (5 Whys, fishbone, etc.). That the identified root cause explains the nonconformity.

    Example 1: "Site not familiar with legal register structure."
    Example 2: "Delays in documenting drills."

    **3. Corrective Action Review (How will recurrence be prevented?)**
    Purpose:
    Verify that the organization has implemented actions that eliminate the
    cause and not just the symptom.
    What the auditor checks:
    Corrective actions address the actual root cause. The actions are implemented (not just planned). Evidence shows they are effective (audit, monitoring, procedural changes). Dates, responsibilities, and evaluation of effectiveness are clear.

    Example 1: "Additional systems have now been established to allow for easier searching of the register including for amended legislation."
    Example 2: "It was verbally reported that a drill had been completed in July 2025 (before the audit took place) but that this had not been documented. The July drill has now been documented and site now aware of the need to complete such documentation in a timely manner."

    **Finding Information & Client Plan**:
    {text}

    **Language**:
    Make sure that the output is generated in the same language as the input
    text. The language of the output must match the language of the input text.

    **Instructions**:
    Return ONLY a JSON object with keys "correction_review", "root_cause_review", "corrective_action_review".
    Use double quotes. Valid JSON only. Do NOT include markdown headers or extra keys.
    Do not include the standard name or clause reference in any field value.
    Each value must be professional, concise, and evidence-based.
    Keep the wording as tight as possible—limit each value to the fewest
    sentences needed to cover the required points and avoid filler phrases.
    Each value must be no longer than 3 sentences.
    Make sure no value exceeds six lines; aim for five or fewer lines when
    possible.
    `;

export const CLIENT_PROPOSAL_EXTRACTION_TEMPLATE = `
Analyze the following text to determine if it contains information about the client's proposed correction, corrective action, and timescale.

If the information is present (even if worded differently from standard terms), extract and summarize it into a concise paragraph titled "Correction, Corrective Action and Timescale proposed by the client". The paragraph should capture the key details in a professional manner.

If the information is not present or insufficient, respond with exactly "NOT_FOUND".

Text:
{text}
`;

export function fillNovaTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  let out = template;
  for (const [key, value] of Object.entries(vars)) {
    out = out.split(`{${key}}`).join(value);
  }
  return out;
}
