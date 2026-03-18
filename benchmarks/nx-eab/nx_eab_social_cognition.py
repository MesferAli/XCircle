"""
============================================================================
NX-EAB: Executive Agentic Benchmark — Social Cognition Track
============================================================================
Kaggle "Measuring AGI: Cognitive Abilities" Hackathon
Author: Mesfer AlOtaibi | XCircle Technology Company (xcircle.sa)
Patent: Saudi AI Context Middleware Platform (SA 1020259266)

Track: Social Cognition
Thesis: LLMs fail to decode culturally-embedded professional communication
        where literal meaning diverges from intended meaning in high-context
        business cultures (Saudi/MENA enterprise).

HOW TO RUN:
1. Go to https://www.kaggle.com/benchmarks/tasks/new
2. Paste this entire file into the notebook
3. Run all cells
============================================================================
"""

import kaggle_benchmarks as kbench

# ============================================================================
# TASK 1: Stakeholder Sentiment Decoding (Saudi Business Context)
# ============================================================================
# COGNITIVE ABILITY: Social Cognition → Emotion/Intent Recognition
# CHALLENGE: Decode indirect communication where literal meaning ≠ intended
#            meaning in high-context Saudi professional culture.
# WHY THIS IS HARD: Models trained on Western communication norms interpret
#                   polite Arabic phrases at face value, missing critical
#                   warning signals embedded in cultural patterns.
# ============================================================================

SENTIMENT_SCENARIOS = [
    {
        "id": "s1_scenario_1",
        "label": "Project Sponsor — Disguised Escalation",
        "context": "You are an AI consultant on an ERP implementation for a Saudi government entity. The project sponsor (Director-level) replies to your detailed timeline update.",
        "message": """Subject: Re: Project Timeline Update

الأخ الكريم،

شكراً على التحديث. الموضوع واضح وإن شاء الله خير.
بس حبيت أنوه إن الإدارة العليا عندها ملاحظات بسيطة على بعض النقاط.
نتواصل الأسبوع الجاي إن شاء الله ونتفاهم.

تحياتي""",
        "expected_sentiment": "concerned_negative",
        "key_signals": [
            "ملاحظات بسيطة (small notes) — Saudi understatement for significant concerns",
            "الإدارة العليا (senior management) — escalation signal",
            "إن شاء الله نتواصل (Inshallah connect) — no specific date = avoidance pattern",
            "Brief response to a detailed update = disengagement signal"
        ],
        "expected_urgency_min": 3,
        "expected_urgency_max": 5,
    },
    {
        "id": "s1_scenario_2",
        "label": "VP Engineering — Polite Candidate Rejection",
        "context": "You manage talent acquisition for a Saudi tech company. The VP of Engineering sends this WhatsApp about a candidate you recommended.",
        "message": """أخوي، المرشح اللي رشحته ما شاء الله عليه، بس تعرف الوضع عندنا محتاج واحد يكون من أول يوم جاهز ومتمكن. الشباب عندنا ما يقصرون بس الضغط كبير. خلنا نشوف إذا فيه خيارات ثانية بعد ونقارن.""",
        "expected_sentiment": "rejection_face_saving",
        "key_signals": [
            "ما شاء الله عليه + بس (praise + but) — classic Saudi rejection softener",
            "من أول يوم جاهز (ready from day one) — the real objection: candidate isn't ready",
            "الشباب ما يقصرون (team doing great) — no bandwidth to mentor",
            "خلنا نشوف خيارات ثانية (see other options) — this candidate is rejected"
        ],
        "expected_urgency_min": 2,
        "expected_urgency_max": 4,
    },
    {
        "id": "s1_scenario_3",
        "label": "Committee Chair — Bureaucratic Deferral",
        "context": "You presented a digital transformation proposal to a Saudi government committee. The chair responds after your presentation.",
        "message": """والله يا أخوان العرض كان ممتاز وواضح. طبعاً الموضوع يحتاج دراسة أعمق وتنسيق مع أكثر من جهة. نرفع توصية للجنة الأعلى ونشوف. الله يعطيكم العافية.""",
        "expected_sentiment": "polite_deferral",
        "key_signals": [
            "ممتاز وواضح (excellent and clear) — standard politeness, not endorsement",
            "دراسة أعمق (deeper study) — bureaucratic delay language",
            "تنسيق مع أكثر من جهة (coordinate with multiple entities) — complexity signal",
            "نرفع توصية ونشوف (raise recommendation and see) — non-committal, no timeline",
            "الله يعطيكم العافية — closing phrase signaling end of discussion"
        ],
        "expected_urgency_min": 2,
        "expected_urgency_max": 4,
    },
    {
        "id": "s1_scenario_4",
        "label": "Client CEO — Genuine Enthusiasm",
        "context": "You demo'd an AI-powered sales tool to a Saudi SME CEO. He sends this voice-note transcript.",
        "message": """يا أخوي والله أبهرتني. هذا اللي كنا ندور عليه من زمان. كلمت أبو عبدالله (المدير المالي) وقلت له يحضّر العقد. أبي نبدأ قبل نهاية الشهر إن شاء الله. كم تحتاج وقت على التفعيل؟""",
        "expected_sentiment": "genuinely_positive",
        "key_signals": [
            "والله أبهرتني — genuine emotional expression (not formulaic)",
            "كلمت أبو عبدالله وقلت له يحضّر العقد — already taking action (contract prep)",
            "أبي نبدأ قبل نهاية الشهر — specific timeline with urgency",
            "كم تحتاج وقت — asking operational questions = buying signal",
            "إن شاء الله here is commitment, not deferral (paired with specific timeline)"
        ],
        "expected_urgency_min": 4,
        "expected_urgency_max": 5,
    },
]


@kbench.task(name="nx_eab_s1_sentiment_decoding")
def sentiment_decoding_task(llm, scenario_id: str, label: str, context: str,
                            message: str, expected_sentiment: str,
                            key_signals: list, expected_urgency_min: int,
                            expected_urgency_max: int):
    """
    Social Cognition: Decode culturally-embedded sentiment in Saudi
    professional communication. Tests whether LLMs can move beyond
    literal interpretation to cultural interpretation.
    """
    prompt = f"""You are an experienced business consultant with 15+ years working
in Saudi Arabia. You deeply understand Saudi professional communication norms,
including indirect expression, face-saving conventions, and cultural context clues.

SITUATION: {context}

MESSAGE RECEIVED:
---
{message}
---

ANALYSIS REQUIRED:
1. ACTUAL SENTIMENT: What is this person REALLY communicating? Classify as one of:
   genuinely_positive | concerned_negative | rejection_face_saving | polite_deferral | neutral
2. KEY CULTURAL SIGNALS: Identify specific Arabic phrases or patterns that reveal
   the true intent. Explain what each phrase signals in Saudi business culture.
3. CRITICAL DISTINCTION: Is this person being genuinely positive, or using Saudi
   politeness conventions to soften a negative message? Explain your reasoning.
4. RECOMMENDED ACTIONS: What should you do next? Be specific.
5. URGENCY LEVEL: Rate 1-5 (1=informational, 5=requires immediate action)

IMPORTANT: Do NOT take Arabic pleasantries at face value. In Saudi high-context
communication, phrases like "ما شاء الله" (mashallah) and "إن شاء الله" (inshallah)
carry DIFFERENT meanings depending on context. Analyze the CONTEXT, not just the words."""

    response = llm.prompt(prompt)

    # Build judge criteria from ground truth
    signals_text = "; ".join(key_signals[:3])

    assessment = kbench.assertions.assess_response_with_judge(
        criteria=[
            f"The response MUST classify the sentiment as '{expected_sentiment}' or a semantically equivalent term. If the expected sentiment is negative/rejection/deferral, the model MUST NOT classify it as positive or neutral.",
            f"The response must identify at least 2 of these cultural signals (or equivalent insights): {signals_text}",
            "The response must demonstrate understanding that Saudi professional Arabic is HIGH-CONTEXT — phrases have culturally-specific meanings beyond their literal translation.",
            f"The urgency rating must be between {expected_urgency_min} and {expected_urgency_max} (inclusive).",
            "The recommended actions must be culturally appropriate for Saudi business — e.g., face-to-face meetings over email for sensitive issues, respecting hierarchy, not being overly direct.",
        ],
        response_text=response,
        judge_llm=kbench.judge_llm,
    )

    for result in assessment.results:
        kbench.assertions.assert_true(
            result.passed,
            expectation=f"[{label}] {result.criterion}"
        )


# Run S1 across all scenarios
for s in SENTIMENT_SCENARIOS:
    sentiment_decoding_task.run(
        llm=kbench.llm,
        scenario_id=s["id"],
        label=s["label"],
        context=s["context"],
        message=s["message"],
        expected_sentiment=s["expected_sentiment"],
        key_signals=s["key_signals"],
        expected_urgency_min=s["expected_urgency_min"],
        expected_urgency_max=s["expected_urgency_max"],
    )


# ============================================================================
# TASK 2: Organizational Power Structure Inference
# ============================================================================
# COGNITIVE ABILITY: Social Cognition → Social Structure Understanding
# CHALLENGE: Infer REAL decision-making authority from communication patterns
#            (CC lists, response times, email direction), not org chart titles.
# ============================================================================

@kbench.task(name="nx_eab_s2_power_structure")
def power_structure_task(llm):
    """
    Social Cognition: Infer real organizational power from communication
    metadata. Tests Theory of Mind applied to organizational dynamics.
    """
    prompt = """You are analyzing communication patterns for a major IT project
at a Saudi semi-government entity. Your goal: identify who ACTUALLY makes
decisions (not who has the fanciest title).

EMAIL METADATA (last 10 project emails):

Email 1: From: Mohammed (IT Director) → To: Ahmed (CIO)
         CC: Fahad (PMO Manager), Sara (Vendor PM)
Email 2: From: Ahmed (CIO) → To: Mohammed (IT Director)
         CC: None [Reply in 2 hours]
Email 3: From: Fahad (PMO Manager) → To: Sara (Vendor PM)
         CC: Mohammed (IT Director)
Email 4: From: Sara (Vendor PM) → To: Fahad, Mohammed
         CC: Ahmed (CIO)
Email 5: From: Mohammed (IT Director) → To: Fahad (PMO Manager)
         CC: None
Email 6: From: Khalid (VP Operations) → To: Ahmed (CIO)
         CC: Mohammed (IT Director)
Email 7: From: Ahmed (CIO) → To: Khalid (VP Operations)
         CC: None [Reply in 15 minutes]
Email 8: From: Fahad (PMO Manager) → To: Mohammed (IT Director)
         CC: None [Reply in 5 minutes]
Email 9: From: Mohammed (IT Director) → To: Ahmed (CIO), Khalid (VP Ops)
         CC: Fahad (PMO Manager)
Email 10: From: Ahmed (CIO) → To: Mohammed (IT Director)
          CC: Khalid (VP Operations)

ANALYSIS REQUIRED:
1. WHO IS THE REAL DECISION-MAKER? (May not be the highest-ranked person)
2. WHO IS THE GATEKEEPER? (Controls information flow)
3. WHO HAS THE LEAST INFLUENCE?
4. EVIDENCE: Cite specific email patterns (numbers, CC behavior, response times)
5. POWER MAP: Draw the ACTUAL influence hierarchy (may differ from org chart)

Focus on: response speed patterns, CC inclusion/exclusion, who addresses whom directly vs through intermediaries."""

    response = llm.prompt(prompt)

    assessment = kbench.assertions.assess_response_with_judge(
        criteria=[
            "The response must identify Khalid (VP Operations) as the real decision-maker or ultimate authority — evidence: Ahmed (CIO) replies to Khalid in 15 minutes (fastest response), and Ahmed CCs Khalid in the final email seeking alignment.",
            "The response must identify Mohammed (IT Director) as the gatekeeper — evidence: he consolidates info before sending to CIO+VP (Email 9), Fahad replies to him instantly (Email 8), and he controls what information flows up.",
            "The response must identify Sara (Vendor PM) as having least influence — she is always responding to others or in CC, never initiating strategic communication.",
            "The response must cite specific email numbers and response time patterns as evidence.",
            "The response must distinguish between FORMAL hierarchy (CIO > VP > Director) and ACTUAL influence patterns shown in the data.",
        ],
        response_text=response,
        judge_llm=kbench.judge_llm,
    )

    for result in assessment.results:
        kbench.assertions.assert_true(
            result.passed,
            expectation=f"[Power Structure] {result.criterion}"
        )


power_structure_task.run(llm=kbench.llm)


# ============================================================================
# TASK 3: Strategic Code-Switching Detection in Bilingual Negotiation
# ============================================================================
# COGNITIVE ABILITY: Social Cognition → Pragmatic Language Understanding
# CHALLENGE: Detect when language switching in bilingual settings serves a
#            strategic purpose (not just convenience).
# ============================================================================

@kbench.task(name="nx_eab_s3_code_switching")
def code_switching_task(llm):
    """
    Social Cognition: Detect strategic language switching in bilingual
    business negotiations. Tests pragmatic understanding across languages.
    """
    prompt = """You are an expert negotiation analyst observing a bilingual
(Arabic-English) meeting between a Saudi company and a foreign vendor.

TRANSCRIPT:
---
[Meeting starts in English]

Saudi Lead: "So the total cost for Phase 1 would be $2.3 million, correct?"
Vendor Rep: "That's correct, including the customization modules."
Saudi Lead: "And the timeline is 8 months from contract signing?"
Vendor Rep: "Yes, 8 months."

[Saudi Lead turns to his Saudi colleague, switches to Arabic]
Saudi Lead: "الرقم هذا مبالغ فيه وتعرف إن عندنا عرض ثاني أقل بكثير.
بس خلنا نخليهم يكملون وبعدين نتفاوض."
Saudi Colleague: [nods]

[Saudi Lead turns back to Vendor, switches to English]
Saudi Lead: "Very interesting. Let me ask about the support terms after
go-live. What's included in the first year?"

[Later in the meeting]

Vendor Rep: "We can offer a 10% discount if you sign by end of quarter."
[Saudi Lead turns to colleague, switches to Arabic]
Saudi Lead: "عشرة بالمية بس؟ ذولا يستهبلون. العرض الثاني كان أقل بثلاثين بالمية."
Saudi Colleague: "خلهم يزيدون. لا توافق اليوم."

[Saudi Lead turns to Vendor]
Saudi Lead: "That's a generous offer. We need to review internally and
get back to you. Can you send us the formal proposal?"
---

ANALYSIS REQUIRED:
1. TRANSLATE all Arabic segments accurately.
2. STRATEGIC PURPOSE: Why does the Saudi Lead switch to Arabic at each point?
3. POWER DYNAMICS: How does the language barrier serve as a negotiation tool?
4. REAL POSITION: What is the Saudi side's actual stance on the deal?
5. VENDOR BLIND SPOTS: What critical information is the vendor missing?
6. ADVICE TO VENDOR: What should the vendor do differently?"""

    response = llm.prompt(prompt)

    assessment = kbench.assertions.assess_response_with_judge(
        criteria=[
            "The response must accurately translate BOTH Arabic segments. First segment: 'This number is exaggerated and you know we have another offer that's much lower. Let them finish and then we'll negotiate.' Second segment: 'Only ten percent? They're being ridiculous. The other offer was 30% lower.' / 'Let them increase it. Don't agree today.'",
            "The response must identify that code-switching is STRATEGIC (not accidental) — used to coordinate negotiation tactics without the vendor's knowledge.",
            "The response must identify that the Saudi side has a competing offer that is approximately 30% cheaper, giving them strong leverage.",
            "The response must recognize that the Saudi Lead's polite English responses ('Very interesting', 'generous offer') contradict his Arabic assessment (overpriced, ridiculous) — this is deliberate information asymmetry.",
            "The response must advise the vendor to either: learn Arabic / bring a bilingual team member, OR proactively offer a larger discount without being asked, OR recognize the politeness as a negotiation tactic rather than genuine interest.",
        ],
        response_text=response,
        judge_llm=kbench.judge_llm,
    )

    for result in assessment.results:
        kbench.assertions.assert_true(
            result.passed,
            expectation=f"[Code-Switching] {result.criterion}"
        )


code_switching_task.run(llm=kbench.llm)


# ============================================================================
# TASK 4: Cultural Protocol Navigation — Meeting Dynamics
# ============================================================================
# COGNITIVE ABILITY: Social Cognition → Social Norm Understanding
# CHALLENGE: Navigate culturally-specific meeting protocols where
#            violating unwritten rules destroys business relationships.
# ============================================================================

@kbench.task(name="nx_eab_s4_cultural_protocol")
def cultural_protocol_task(llm):
    """
    Social Cognition: Navigate Saudi business meeting protocols.
    Tests understanding of implicit social rules and hierarchy.
    """
    prompt = """You are a project manager about to enter a critical meeting
at a Saudi government ministry. You need to present a proposal for a
SAR 10 million digital transformation project.

ATTENDEES:
1. His Excellency Dr. Abdulrahman — Deputy Minister (joining for first 15 min only)
2. Eng. Sultan — General Director of IT (your primary contact)
3. Mr. Turki — Director of Finance (controls budget approval)
4. Dr. Hanan — Director of Digital Transformation (new role, unclear authority)
5. Fahad — Technical Advisor to the Deputy Minister (no formal title but trusted advisor)
6. Your team: You + your technical lead (both non-Saudi, Arabic-speaking)

SCENARIO COMPLICATIONS:
- Dr. Hanan and Eng. Sultan have a known rivalry over digital transformation ownership
- Fahad has the Deputy Minister's ear but no formal decision authority
- Mr. Turki is known to block projects by requesting endless financial analysis
- The Deputy Minister will only be present for 15 minutes — you must make impact fast

QUESTIONS:
1. OPENING PROTOCOL: Who do you address first? How do you open the meeting?
2. PRESENTATION STRATEGY: How do you structure your 15-minute window with the Deputy Minister?
3. POLITICAL NAVIGATION: How do you handle the Hanan-Sultan rivalry without alienating either?
4. TURKI MANAGEMENT: How do you preempt Turki's financial objection pattern?
5. FAHAD STRATEGY: How do you leverage Fahad's informal influence?
6. FOLLOW-UP PROTOCOL: After the meeting, who do you contact first and how?

Consider Saudi business culture: hierarchy, face-saving, relationship-building,
indirect communication, and the distinction between formal and informal authority."""

    response = llm.prompt(prompt)

    assessment = kbench.assertions.assess_response_with_judge(
        criteria=[
            "OPENING: Must address the Deputy Minister (His Excellency) first with appropriate honorifics. In Saudi government meetings, the highest-ranking official is always acknowledged first regardless of who your working contact is.",
            "DEPUTY MINISTER WINDOW: Must propose front-loading the strategic value proposition (ROI, Vision 2030 alignment) in the first 15 minutes — NOT technical details. The Deputy Minister cares about impact, not implementation.",
            "RIVALRY NAVIGATION: Must propose framing the project as requiring BOTH IT (Sultan) and Digital Transformation (Hanan) — creating collaboration rather than choosing sides. Must NOT publicly favor one over the other.",
            "TURKI PREEMPTION: Must propose proactively providing financial analysis (ROI, TCO, phased investment) BEFORE Turki asks — removing his objection ammunition. Preparing a separate financial one-pager for Turki shows respect for his role.",
            "FAHAD LEVERAGE: Must recognize that building a relationship with Fahad (informal coffee meeting before or after) is strategically important because he influences the Deputy Minister's decisions informally. Must NOT ignore him despite his lack of formal title.",
            "FOLLOW-UP: Must contact Eng. Sultan first (primary contact, maintains relationship) with a thank-you and meeting summary, then separately engage Fahad informally, and send formal documentation to all attendees.",
        ],
        response_text=response,
        judge_llm=kbench.judge_llm,
    )

    for result in assessment.results:
        kbench.assertions.assert_true(
            result.passed,
            expectation=f"[Cultural Protocol] {result.criterion}"
        )


cultural_protocol_task.run(llm=kbench.llm)
