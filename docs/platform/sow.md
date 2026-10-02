Statement of Work (SOW) 
SOW No.: [LRQA-Inspire-2026-001]
Project Name: [China Region Landing]
Master Agreement: This SOW is subject to the Master Services Agreement [LRQA-Inspire-MSA-001] signed by the Parties. For this SOW only, in the event of any inconsistency between this SOW and the MSA, the terms of this SOW shall prevail. All other MSA terms continue to apply without modification.
1. Project Background & Objectives
The objective of this project is to deploy five core components—Vault & Assure, MyLRQA, ART, Nova, and the SO Travel Matrix—onto Alibaba Cloud and make them operational in China. This architecture ensures that sensitive client data (including audit reports, findings, and corrective action plans) remains resident within China, while maintaining global accessibility for non-sensitive data and services.
Component-Specific Objectives:
- Vault & Assure: Re-platform the .NET document repository onto Alibaba Cloud via a Provider Abstraction Layer (PAL). Enable robust content search capabilities within the China region to support Assure’s document management workflows.
- MyLRQA: Serve as the unified user entry point. Implement localized module hosting and replace Auth0 with a regional identity provider. The system will intelligently route traffic, redirecting non-localized requests to Global while securely surfacing China-resident sensitive data for authenticated local users.
- ART: Deliver an online, collaborative reporting ecosystem optimized for both China and global users. Features include a mobile-first responsive design, a metadata-driven form architecture for dynamic UI/UX rendering, and real-time multi-user collaboration to meet diverse reporting requirements.
- Nova: Rebuild the application leveraging a compliant operational model to preserve existing prompts and user experience (UX). Architected as a standalone service decoupled from ART, with optional support for local Retrieval-Augmented Generation (RAG) capabilities.
- SO Travel Matrix: Implement a dedicated data pipeline (non-application) to source China-specific travel data and populate a segregated China matrix for the SO engine, ensuring data sovereignty.
2. Scope & Deliverables
Workstream
Scope
Quotation (RMB)
Quotation (USD)
Platform foundation
Alibaba six-layer build, ICP/MLPS, CI/CD, IaC, ~40% of Azure infra needing China equivalents
441.6k
65k

Identity — AuthN & AuthZ
Self-hosted Keycloak (two realms), Graph-API sync service in HK, OpenFGA deployment, local visibility store + authz component, existing-user cutover
404.8k
59.5k
Cross-border Integration & Network
Self-built event bridge, Alibaba Cloud Kafka, reliability (idempotency/ordering/offset/reconciliation), CEN/TR + VPN connectivity, adapter layer
404.8k
59.5k
Vault & Assure
Re-platform to OSS/RDS/PGVector, provider abstraction, Assure signing via M2M, content search
515.2k
75.8k
MyLRQA
Region fork, split data sources, China IdP, remove Google deps, out-of-scope redirects
552k
81.2k
ART
Rebuilt new; metadata-driven forms engine, collaborative consolidation, responsive front end, status exchange — heaviest module
982.6k
144.5k
Nova
Rebuild, swap to Qwen, storage/OCR/worker, output to ART
662.4k
97.4k
SO travel matrix
Batch pipeline, Ctrip + AMap sourcing, push to global China matrix — lightest
220.8k
32.5k
Project & Technical & Architecture Management
Overall 5 components projects management & communication & architecture lead & technical decisions
618.2k
90.9k
Total

4.8m
706k
Milestone/Activities
Description of Service
Deliverable(s)
Expected Timeframe
Milestone 1: MVP

Foundation — platform: Alibaba build · CI/CD · IaC
Foundation — identity: IdP · OpenFGA · sync
Foundation — network/bridge: CEN/TR · VPN(HK) · event bridge
ART: core findings + report authoring
Nova: MVP: rebuild · Qwen
Vault & Assure: re-platform · signing

Foundation — Platform: Provisioned Alibaba Cloud environment with CI/CD pipelines and Infrastructure-as-Code.
Foundation — Identity: China-hosted identity platform (IdP) with OpenFGA authorization and identity sync from global.
Foundation — Network / Bridge: Tested private cross-border connectivity and a working event bridge between China and global.
ART: Standalone China ART application (MVP) for findings capture and report authoring, with sensitive data resident in China.
Nova: Rebuilt China Nova (MVP) on a current stack with a China-compliant model, capturing field inputs and pushing structured output to ART.
Vault & Assure: Vault and Assure re-platformed onto Alibaba Cloud, with signing and client documents resident in China.
3 months

Milestone 2: Full Scope
Art: Full Scope: core findings + report authoring
Nova: Full Scope: quality continuous improvement / enhancement
myLRQA: region fork · data-source split
SO travel matrix: batch pipeline

ART — Full Scope: Complete China ART application covering the full findings and report-authoring scope, including the remaining metadata-driven forms and collaborative/team-report capability.
Nova — Full Scope: Enhanced China Nova with quality improvements and expanded capability beyond the MVP baseline (e.g. broader input handling, model/RAG refinement based on real usage).
MyLRQA: China MyLRQA deployment via region fork, reading non-sensitive operational data from global and sensitive data from China-local sources.
SO travel matrix: Batch pipeline sourcing China travel data and pushing the computed matrix to the global SO engine.
3 months






Any adjustments to the scope, timing, reporting requirements, fees or expenses of the Services or Deliverables shall only be made pursuant to a written Change Order to this SOW signed by authorized representatives of both Parties.

3. Fees and Expenses
Fixed Fee: Party A shall pay Party B a fixed service fee of RMB 4,800,000, exclusive of taxes if there is any.  
a. Tax Exclusion: All prices quoted by Party B are exclusive of any applicable taxes. Party B shall be responsible for and pay all applicable taxes.
 
b. Expenses. Party B shall pay all of its own necessary and ordinary business expenses associated with performance of the Services and Deliverables. In the event that Party B incurs unanticipated expenses outside  its usual business costs as a direct result of work requested by Party A hereunder, Party B shall obtain Party A’s written authorization in advance for such expenses before submission to Party A. 
 
4. Payment Schedule and Terms
Party B will send an itemized invoice to Party A according to the payment schedule:
1. Initial Payment: Twenty percent (20%) of the total contract value (RMB 960,000) shall become due and payable upon execution of this Agreement.
2. Progress Payment (Milestone 1: MVP): Forty percent (40%) of the total contract value (RMB 1,920,000)  shall become due and payable upon delivery and acceptance of the Milestone 1: MVP.
3. Final Payment: The final balance of forty percent (40%) of the total contract value (RMB 1,920,000) shall become due and payable upon delivery and acceptance of the Milestone 2: Full Scope.
Invoices are due and payable within [15] days of receipt. Late payments will accrue interest at a rate of 0.04% per day on the outstanding amount.

5. Indemnification 
Notwithstanding any provision to the contrary in this Contract or anywhere else, neither party shall be liable for any indirect loss suffered by the other party (including, but not limited to, loss of profits, damages arising from inability to use a software or hardware, loss of data, or any third-party claims or demands). The total liability of Supplier under this Contract shall not exceed the service fees received by Supplier under this Contract for the twelve (12) months preceding the date of the dispute, except for intellectual property infringement, fraud, gross negligence, willful misconduct, and personal injury (including death).

5. Term
The term of this SOW shall begin as of the Effective Date of this SOW and shall terminate no later than 30(th) Feb, 2027. unless extended in writing by agreement of both Parties.

Party A Confirmation: ____________________ Date: ____________
Party B Confirmation: ____________________ Date: ____________
