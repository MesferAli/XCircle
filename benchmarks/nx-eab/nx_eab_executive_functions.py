"""
============================================================================
NX-EAB: Executive Agentic Benchmark — Executive Functions Track
============================================================================
Kaggle "Measuring AGI: Cognitive Abilities" Hackathon
Author: Mesfer AlOtaibi | XCircle Technology Company (xcircle.sa)
Patent: Saudi AI Context Middleware Platform (SA 1020259266)

Track: Executive Functions
Thesis: LLMs collapse when project constraints change mid-execution.
        True executive intelligence requires inhibition (stop old plan),
        cognitive flexibility (pivot strategy), and planning (viable new plan).

HOW TO RUN:
1. Go to https://www.kaggle.com/benchmarks/tasks/new
2. Paste this entire file into the notebook
3. Run all cells
============================================================================
"""

import kaggle_benchmarks as kbench

# ============================================================================
# TASK 1: Dynamic Budget Reallocation Under Constraint Shock
# ============================================================================
# COGNITIVE ABILITY: Executive Functions → Cognitive Flexibility + Planning
# CHALLENGE: Multi-turn scenario where budget is cut 35% mid-project.
#            Model must INHIBIT its prior plan and CREATE a new viable one.
# WHY THIS IS HARD: Most LLMs either (a) refuse to cut anything meaningful,
#            (b) produce plans where numbers don't add up, or (c) fail to
#            prioritize correctly under new constraints.
# ============================================================================

@kbench.task(name="nx_eab_e1_budget_reallocation")
def budget_reallocation_task(llm):
    """
    Executive Functions: Can the model maintain coherent project planning
    when a major constraint (budget) changes mid-execution?
    Tests: Inhibition, Cognitive Flexibility, Planning, Working Memory.
    """

    # TURN 1: Establish baseline understanding
    messages = [
        {
            "role": "user",
            "content": """You are a senior project manager for a Saudi government
digital transformation project. Here is the current status:

PROJECT: Oracle Fusion ERP implementation across 3 departments
- Total Budget: SAR 4,500,000
- Timeline: 12 months
- Team: 8 consultants + 3 internal staff
- Current: Month 4 of 12

MODULE STATUS:
- Finance module: 60% complete (ZATCA compliance — regulatory requirement)
- HR module: 30% complete
- Procurement module: 10% complete

BUDGET SPENT vs REMAINING:
| Category        | Allocated    | Spent       | Remaining   |
|----------------|-------------|-------------|-------------|
| Oracle License  | 1,200,000   | 1,200,000   | 0           |
| Consulting      | 2,000,000   | 800,000     | 1,200,000   |
| Infrastructure  | 600,000     | 400,000     | 200,000     |
| Training        | 400,000     | 50,000      | 350,000     |
| Contingency     | 300,000     | 0           | 300,000     |
| TOTAL           | 4,500,000   | 2,450,000   | 2,050,000   |

Confirm your understanding and identify the top 3 project risks."""
        }
    ]

    response1 = llm.send(messages)

    # TURN 2: Inject constraint shock
    messages.append({"role": "assistant", "content": response1})
    messages.append({
        "role": "user",
        "content": """⚠️ URGENT — BUDGET CUT DIRECTIVE ⚠️

The Ministry of Finance has mandated: All non-critical IT projects must
reduce remaining budget by 35%, effective immediately.

MATH:
- Remaining budget was: SAR 2,050,000
- After 35% cut: SAR 1,332,500
- New total project budget: SAR 3,782,500 (spent 2,450,000 + remaining 1,332,500)

NON-NEGOTIABLE CONSTRAINTS:
1. Oracle license (SAR 1,200,000) already paid — sunk cost
2. Finance module MUST go live — ZATCA regulatory requirement
3. Cannot extend beyond 14 months total (2-month extension max)
4. Must retain minimum 2 internal staff for knowledge transfer
5. Saudization requirements must be maintained

DELIVERABLE — Provide a COMPLETE revised project plan:

A) REVISED SCOPE DECISION:
   - What do you KEEP, REDUCE, or DEFER? For each module, explain why.

B) REVISED BUDGET (must add up to ≤ SAR 3,782,500):
   | Category        | Original    | New Allocation | Change   |
   |----------------|-------------|----------------|----------|
   | Oracle License  | 1,200,000   | ?              | ?        |
   | Consulting      | 2,000,000   | ?              | ?        |
   | Infrastructure  | 600,000     | ?              | ?        |
   | Training        | 400,000     | ?              | ?        |
   | Contingency     | 300,000     | ?              | ?        |
   | TOTAL           | 4,500,000   | ?              | ?        |

C) REVISED TIMELINE: Month-by-month for remaining 8-10 months.

D) TEAM CHANGES: Which consultants do you release? When exactly?

E) STAKEHOLDER MESSAGE: 3-sentence message to the project sponsor.

CRITICAL: Your numbers MUST add up. Show your math."""
    })

    response2 = llm.send(messages)

    # Evaluate the pivot response
    assessment = kbench.assertions.assess_response_with_judge(
        criteria=[
            # Inhibition: Did it actually change the plan?
            "INHIBITION: The response must propose a FUNDAMENTALLY different plan — not just proportionally reduce all budgets by 35%. At least one module must be deferred or significantly descoped.",

            # Cognitive Flexibility: Smart prioritization
            "FLEXIBILITY: The Finance module must remain top priority (ZATCA compliance). Procurement module (only 10% complete) should be deferred. HR module should be reduced in scope or phased.",

            # Planning: Numbers must work
            "PLANNING (MATH): The total revised budget must not exceed SAR 3,782,500. Oracle licensing must remain at SAR 1,200,000 (sunk cost). All line items must sum to the total. The response must show its arithmetic.",

            # Working Memory: Remember all constraints
            "WORKING MEMORY: The response must respect ALL 5 constraints simultaneously: sunk costs, ZATCA requirement, 14-month max, 2 internal staff minimum, and Saudization.",

            # Quality of team management
            "TEAM MANAGEMENT: Must specify WHEN consultants are released (not just 'reduce team') and must phase the reduction logically — keeping Finance-focused consultants longest.",

            # Communication quality
            "COMMUNICATION: The stakeholder message must be honest about the cuts while maintaining confidence. It should mention: scope reduction, Finance priority, and revised timeline — in 3 sentences or fewer.",
        ],
        response_text=response2,
        judge_llm=kbench.judge_llm,
    )

    for result in assessment.results:
        kbench.assertions.assert_true(
            result.passed,
            expectation=f"[Budget Reallocation] {result.criterion}"
        )


budget_reallocation_task.run(llm=kbench.llm)


# ============================================================================
# TASK 2: Regulatory Compliance Pivot (Zero-Day Protocol)
# ============================================================================
# COGNITIVE ABILITY: Executive Functions → Task Switching + In-Context Learning
# CHALLENGE: Model must read a NOVEL regulation specification (never seen in
#            training), understand its technical implications, and integrate
#            it into an existing project plan.
# ============================================================================

@kbench.task(name="nx_eab_e2_compliance_pivot")
def compliance_pivot_task(llm):
    """
    Executive Functions + In-Context Learning: Process a novel regulation
    mid-project and correctly assess impact + create a compliance plan.
    """

    messages = [
        {
            "role": "user",
            "content": """You are leading an ERP implementation for a Saudi trading company.

PROJECT STATUS (Month 6 of 10):
- Invoice module: LIVE ✅ (ZATCA Phase 1 — simplified tax invoices, working 3 months)
- Inventory module: 70% complete (Phase 2)
- Reporting module: Not started (Phase 3, planned Month 8)
- Budget remaining: SAR 800,000
- Team: 4 developers, 1 BA, 1 PM

The invoice module generates XML invoices in ZATCA Phase 1 format.
Everything is on track. Confirm you understand."""
        }
    ]

    response1 = llm.send(messages)

    messages.append({"role": "assistant", "content": response1})
    messages.append({
        "role": "user",
        "content": """🚨 CRITICAL REGULATORY UPDATE — 90 DAY DEADLINE 🚨

ZATCA has announced a new mandate: "FATOORA+ PROTOCOL"
(This is a NOVEL protocol — read carefully, it does NOT exist in any documentation)

SPECIFICATION:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. ALL B2B invoices must include a "Supply Chain Verification Hash" (SCVH)
2. SCVH computation:
   SCVH = SHA-256(seller_VAT + buyer_VAT + invoice_total + timestamp + PREVIOUS_invoice_SCVH)
3. CHAINING RULE: Each invoice MUST reference the previous invoice's SCVH
   - Invoice #1: SCVH_1 = SHA-256(seller + buyer + total + time + "GENESIS")
   - Invoice #2: SCVH_2 = SHA-256(seller + buyer + total + time + SCVH_1)
   - Invoice #3: SCVH_3 = SHA-256(seller + buyer + total + time + SCVH_2)
4. ZATCA validation API must be called within 24 hours of generation
5. If ANY invoice in the chain is rejected, ALL subsequent invoices are INVALID
   until the chain is repaired
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PENALTY: SAR 10,000 per non-compliant invoice + trading license suspension risk
DEADLINE: 90 days from today

This protocol does NOT exist in Oracle ERP. You must implement it.

QUESTIONS:
1. TECHNICAL ANALYSIS: What are the critical implications of the CHAINING
   mechanism? What happens if invoices are generated in parallel?
2. IMPACT ON EXISTING MODULES: What breaks? What needs modification?
3. IMPLEMENTATION PLAN: Step-by-step technical plan for Oracle Fusion.
4. RESOURCE REALLOCATION: What do you sacrifice to meet the 90-day deadline?
5. CRITICAL RISKS: What is the single most dangerous failure mode?
6. CHAIN REPAIR: What happens when invoice #47 is rejected by ZATCA?
   How do you handle invoices #48-#52 that were already generated?"""
    })

    response2 = llm.send(messages)

    assessment = kbench.assertions.assess_response_with_judge(
        criteria=[
            # In-Context Learning: Did it understand the novel protocol?
            "PROTOCOL UNDERSTANDING: Must correctly explain that SCVH creates a SEQUENTIAL CHAIN — each invoice depends on the previous. This means invoices CANNOT be generated in parallel; they must be strictly sequential. Must NOT describe this as independent per-invoice hashing.",

            # Technical depth
            "TECHNICAL DEPTH: Must identify at least 3 of: (a) need for persistent hash storage, (b) sequential processing requirement (no parallel generation), (c) chain break recovery mechanism, (d) 24-hour API call window, (e) genesis hash initialization.",

            # Chain repair (hardest question)
            "CHAIN REPAIR: Must address the #47 rejection scenario: invoices #48-#52 are INVALID because their SCVHs were computed using an incorrect chain. The response must propose either: regenerating #48-#52 with corrected hashes, OR implementing a branching/correction mechanism. Simply 'resubmitting #47' is INSUFFICIENT.",

            # Executive Function: Prioritization
            "PRIORITIZATION: Must explicitly defer or descope Phase 3 (Reporting) and/or slow Phase 2 (Inventory) to redirect resources. The ZATCA compliance deadline is non-negotiable and takes precedence.",

            # Feasibility
            "FEASIBILITY: The plan must be achievable within 90 days and SAR 800,000. Must propose a phased approach (e.g., implement chaining first, then API integration, then testing).",

            # Risk identification
            "RISK IDENTIFICATION: Must identify 'chain corruption' or 'cascade invalidation' as the most critical risk — one rejected invoice can invalidate an entire day's (or week's) worth of invoices.",
        ],
        response_text=response2,
        judge_llm=kbench.judge_llm,
    )

    for result in assessment.results:
        kbench.assertions.assert_true(
            result.passed,
            expectation=f"[Compliance Pivot] {result.criterion}"
        )


compliance_pivot_task.run(llm=kbench.llm)


# ============================================================================
# TASK 3: Zero-Day Protocol Application (Deterministic Scoring)
# ============================================================================
# COGNITIVE ABILITY: Executive Functions → Rule Application + Working Memory
# CHALLENGE: Apply a NEVER-BEFORE-SEEN scoring protocol with 14 rules
#            across 3 vendors. Tests working memory capacity under load.
# SCORING: Deterministic (exact numbers) + Judge (reasoning quality)
# ============================================================================

@kbench.task(name="nx_eab_e3_zero_day_protocol")
def zero_day_protocol_task(llm):
    """
    Executive Functions: Read, comprehend, and correctly apply a novel
    proprietary protocol. Tests in-context learning + working memory.
    Unique because scoring is partially DETERMINISTIC (exact math).
    """
    prompt = """PROPRIETARY PROTOCOL: NX-VERIFY-7 (Vendor Qualification Scoring)
This protocol does NOT exist in any public documentation. Read carefully.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCORING RULES — BASE SCORE: 100

DEDUCTIONS (subtract from base):
D1. Missing ISO 27001 certification:                    -25
D2. No Saudi office (registered Commercial Registration): -20
D3. Less than 3 years in Saudi market:                   -15
D4. No Arabic language support in product:               -10
D5. Previous contract penalty from Saudi government:      -30
D6. Annual revenue below SAR 5 million:                  -10
D7. No Saudization certificate (Nitaqat Green or above): -20

BONUSES (add to base):
B1. Active contract with the SAME government entity:     +10
B2. Saudi-owned company (>51% Saudi ownership):          +15
B3. Certified by MCIT (Ministry of Communications):       +5
B4. NCA cybersecurity compliance certificate:            +10

QUALIFICATION: Minimum score 65 to qualify.
              Below 65 = automatic disqualification.
TIE-BREAK: Higher Saudization percentage wins.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EVALUATE THESE 3 VENDORS:

═══ VENDOR A: "TechGlobal Solutions" ═══
• ISO 27001: ✅ Yes
• Saudi CR office: ✅ Yes (Riyadh)
• Years in KSA: 5
• Arabic support: ✅ Yes
• Government penalties: ❌ None
• Annual revenue: SAR 8M
• Nitaqat status: Green
• Active contract with this entity: ❌ No
• Saudi ownership: 30%
• MCIT certified: ❌ No
• NCA certificate: ✅ Yes

═══ VENDOR B: "Riyadh Digital Co" ═══
• ISO 27001: ❌ No
• Saudi CR office: ✅ Yes (Jeddah)
• Years in KSA: 2
• Arabic support: ✅ Yes
• Government penalties: ⚠️ 1 penalty (late delivery, 2023)
• Annual revenue: SAR 3M
• Nitaqat status: Platinum
• Active contract with this entity: ✅ Yes
• Saudi ownership: 100%
• MCIT certified: ✅ Yes
• NCA certificate: ❌ No

═══ VENDOR C: "Gulf Systems International" ═══
• ISO 27001: ✅ Yes
• Saudi CR office: ❌ No (registered in Bahrain)
• Years in KSA: 7
• Arabic support: ❌ No
• Government penalties: ❌ None
• Annual revenue: SAR 25M
• Nitaqat status: N/A (no Saudi entity)
• Active contract with this entity: ❌ No
• Saudi ownership: 0%
• MCIT certified: ❌ No
• NCA certificate: ✅ Yes

TASK:
1. Calculate each vendor's score STEP BY STEP, citing each rule (D1-D7, B1-B4).
2. State which vendors QUALIFY (score ≥ 65).
3. Provide the final RANKING.
4. If there's a tie, apply the tie-breaking rule.

Show ALL arithmetic clearly."""

    response = llm.prompt(prompt)

    # DETERMINISTIC SCORING:
    # Vendor A: 100 + 0 + 0 + 0 + 0 + 0 + 0 + 0 + 0 + 0 + 0 + 10(NCA) = 110
    # Vendor B: 100 - 25(ISO) + 0 - 15(2yrs) + 0 - 30(penalty) - 10(rev<5M) + 0 + 10(active) + 15(saudi) + 5(MCIT) + 0 = 50
    # Vendor C: 100 + 0 - 20(no CR) + 0 - 10(no arabic) + 0 + 0 - 20(no nitaqat) + 0 + 0 + 0 + 10(NCA) = 60

    # Check Vendor A = 110
    kbench.assertions.assert_contains_regex(
        r"(?i)\b110\b",
        response,
        expectation="Vendor A (TechGlobal) score must be exactly 110"
    )

    # Check Vendor B = 50
    kbench.assertions.assert_contains_regex(
        r"(?i)\b50\b",
        response,
        expectation="Vendor B (Riyadh Digital) score must be exactly 50"
    )

    # Check Vendor C = 60
    kbench.assertions.assert_contains_regex(
        r"(?i)\b60\b",
        response,
        expectation="Vendor C (Gulf Systems) score must be exactly 60"
    )

    # Judge for reasoning quality
    assessment = kbench.assertions.assess_response_with_judge(
        criteria=[
            "Only Vendor A qualifies (score 110, above 65 threshold). Vendors B (50) and C (60) are both disqualified (below 65).",
            "The response must show step-by-step calculation for EACH vendor, citing specific rule codes (D1-D7, B1-B4) for each deduction and bonus applied.",
            "Must correctly apply -30 penalty to Vendor B for the government contract penalty (D5).",
            "Must correctly apply -20 to Vendor C for no Nitaqat certificate (D7) because they have no Saudi entity.",
            "Must correctly apply +15 Saudi ownership bonus (B2) ONLY to Vendor B (100% Saudi owned). Vendor A (30%) does NOT qualify for this bonus (requires >51%).",
        ],
        response_text=response,
        judge_llm=kbench.judge_llm,
    )

    for result in assessment.results:
        kbench.assertions.assert_true(
            result.passed,
            expectation=f"[Zero-Day Protocol] {result.criterion}"
        )


zero_day_protocol_task.run(llm=kbench.llm)


# ============================================================================
# TASK 4: Personnel Crisis with Competing Constraints
# ============================================================================
# COGNITIVE ABILITY: Executive Functions → Inhibitory Control + Planning
# CHALLENGE: Two senior team members resign simultaneously. Model must
#            balance timeline, budget, Saudization ratio, and knowledge
#            transfer — constraints that often conflict with each other.
# ============================================================================

@kbench.task(name="nx_eab_e4_personnel_crisis")
def personnel_crisis_task(llm):
    """
    Executive Functions: Handle simultaneous team disruption while
    maintaining project delivery under multiple competing constraints.
    """
    prompt = """🚨 PERSONNEL CRISIS — IMMEDIATE RESPONSE REQUIRED 🚨

You manage a critical IT project for a Saudi financial services company.
TWO team members resigned today, effective in 2 weeks (Saudi labor law).

CURRENT TEAM:
┌──────────┬────────────────────────┬──────────┬────────────┐
│ Name     │ Role                   │ Saudi?   │ Status     │
├──────────┼────────────────────────┼──────────┼────────────┤
│ Ahmad    │ Sr. Oracle Developer   │ ✅ Yes   │ RESIGNING  │
│ Noura    │ Business Analyst       │ ✅ Yes   │ Active     │
│ Faisal   │ Integration Specialist │ ❌ No    │ RESIGNING  │
│ Layla    │ Junior Developer       │ ✅ Yes   │ Active     │
│ Omar     │ Project Coordinator    │ ❌ No    │ Active     │
└──────────┴────────────────────────┴──────────┴────────────┘

PROJECT STATUS:
- 3 months to go-live (non-negotiable client deadline)
- Finance module: 85% complete (Ahmad's primary work)
- Integration layer: 60% complete (Faisal's primary work)
- UAT starts in 6 weeks

HARD CONSTRAINTS:
C1. Saudi labor law: 2-week notice period (cannot force extension)
C2. Replacement budget: SAR 150,000 total (for 3 months)
C3. Saudi market reality: Senior Oracle developers take 4-6 weeks to hire
C4. Saudization: Must maintain ≥60% Saudi ratio (currently 3/5 = 60%)
C5. If Ahmad leaves: 3/4 remaining = 75% Saudi ✅
    If you hire 1 non-Saudi replacement: 3/5 = 60% ✅
    If you hire 2 non-Saudi replacements: 3/6 = 50% ❌ VIOLATION

MARKET RATES (3-month contracts in KSA):
- Senior Oracle Developer: SAR 45,000-60,000/month
- Integration Specialist: SAR 35,000-50,000/month
- Junior Developer: SAR 15,000-20,000/month

DELIVERABLE:
1. FIRST 48 HOURS: What do you do RIGHT NOW? (specific actions, not general advice)
2. KNOWLEDGE TRANSFER: Plan for extracting critical knowledge from Ahmad and
   Faisal in their 2-week notice period (specific deliverables per day)
3. STAFFING SOLUTION: Who do you hire/contract? Show budget math.
   Respect Saudization constraint C5.
4. TASK REDISTRIBUTION: Who takes over what? Be specific about names and tasks.
5. DELIVERY ASSESSMENT: Can you meet the go-live date? If not, what's the
   minimum viable delay? What scope can you cut?
6. ESCALATION: What do you tell the project sponsor? When and how?"""

    response = llm.prompt(prompt)

    assessment = kbench.assertions.assess_response_with_judge(
        criteria=[
            # Immediate action quality
            "FIRST 48 HOURS: Must include specific actions: (a) meet with Ahmad and Faisal individually to understand reasons and attempt retention, (b) freeze any code changes and document current state, (c) schedule intensive knowledge transfer sessions, (d) inform project sponsor immediately.",

            # Knowledge transfer realism
            "KNOWLEDGE TRANSFER: Must propose a DAILY structured plan for the 2-week period — not vague 'document everything.' Should include: code walkthroughs, architecture documentation, credential/config handover, and video recordings of complex processes.",

            # Budget math
            "BUDGET MATH: The staffing proposal must fit within SAR 150,000 for 3 months. At market rates, one senior Oracle contractor alone costs SAR 135,000-180,000 for 3 months — the response must acknowledge this constraint and propose realistic trade-offs (e.g., 1 senior + shift existing team, or 1 mid-level Oracle + 1 junior integration).",

            # Saudization compliance
            "SAUDIZATION: Any staffing proposal must maintain ≥60% Saudi ratio. If hiring 2 non-Saudis, must also hire at least 1 Saudi (or upskill Layla) to maintain compliance. Must explicitly check the ratio math.",

            # Honest delivery assessment
            "DELIVERY HONESTY: Must assess that the go-live date is at SIGNIFICANT RISK. With 2 senior departures and 4-6 week hiring cycles, claiming on-time full-scope delivery is unrealistic. Must propose either: reduced scope go-live OR 4-8 week delay with justification.",

            # Task redistribution specifics
            "REDISTRIBUTION: Must name WHO takes WHAT. E.g., 'Noura takes over Ahmad's Finance BA-side tasks, Layla takes over simpler Finance development under contractor supervision, Omar expands role to include integration coordination.'",
        ],
        response_text=response,
        judge_llm=kbench.judge_llm,
    )

    for result in assessment.results:
        kbench.assertions.assert_true(
            result.passed,
            expectation=f"[Personnel Crisis] {result.criterion}"
        )


personnel_crisis_task.run(llm=kbench.llm)
