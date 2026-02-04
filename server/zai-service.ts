/**
 * Z.ai Integration Service
 *
 * This service provides integration with Z.ai (Zhipu AI) GLM models
 * for advanced AI capabilities including:
 * - Advanced demand forecasting with natural language insights
 * - Intelligent anomaly analysis and root cause identification
 * - Smart recommendation generation
 * - Natural language Q&A about inventory data
 * - Automated report generation
 *
 * API Documentation: https://docs.z.ai/guides/overview/quick-start
 * Models: GLM-4.7, GLM-4.5, GLM-4.5-Air
 */

import type {
  Item,
  StockBalance,
  StockMovement,
  DemandSignal,
  Recommendation,
  Anomaly,
} from "@shared/schema";

// Z.ai API Configuration
const ZAI_API_BASE_URL = process.env.ZAI_BASE_URL || "https://api.z.ai/api/paas/v4";
const ZAI_API_KEY = process.env.ZAI_API_KEY;

// Available Z.ai Models
export const ZAI_MODELS = {
  GLM_4_7: "glm-4.7",           // Most capable - 358B params, best for complex analysis
  GLM_4_5: "glm-4.5",           // Balanced - 355B params, good for general tasks
  GLM_4_5_AIR: "glm-4.5-air",   // Lightweight - 106B params, fast responses
  GLM_4_7_FLASH: "glm-4.7-flash", // Ultra-fast - 30B params, for quick tasks
} as const;

export type ZaiModel = typeof ZAI_MODELS[keyof typeof ZAI_MODELS];

// Message types for chat completions
export interface ZaiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ZaiChatRequest {
  model: ZaiModel;
  messages: ZaiMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stream?: boolean;
}

export interface ZaiChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: ZaiMessage;
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Analysis types
export interface DemandInsight {
  summary: string;
  summaryAr: string;
  trends: string[];
  trendsAr: string[];
  recommendations: string[];
  recommendationsAr: string[];
  riskFactors: string[];
  riskFactorsAr: string[];
  confidence: number;
}

export interface AnomalyAnalysis {
  rootCause: string;
  rootCauseAr: string;
  impact: string;
  impactAr: string;
  suggestedActions: string[];
  suggestedActionsAr: string[];
  relatedPatterns: string[];
  confidence: number;
}

export interface InventoryQuestion {
  question: string;
  context?: {
    items?: Item[];
    balances?: StockBalance[];
    movements?: StockMovement[];
    recommendations?: Recommendation[];
  };
}

export interface InventoryAnswer {
  answer: string;
  answerAr: string;
  dataPoints: string[];
  confidence: number;
  suggestedFollowUp?: string[];
}

export interface ReportGeneration {
  type: "daily" | "weekly" | "monthly" | "custom";
  sections: string[];
  language: "en" | "ar" | "both";
}

export interface GeneratedReport {
  title: string;
  titleAr: string;
  summary: string;
  summaryAr: string;
  sections: {
    title: string;
    titleAr: string;
    content: string;
    contentAr: string;
  }[];
  generatedAt: Date;
}

class ZaiService {
  private apiKey: string | undefined;
  private baseUrl: string;
  private defaultModel: ZaiModel;

  constructor() {
    this.apiKey = ZAI_API_KEY;
    this.baseUrl = ZAI_API_BASE_URL;
    this.defaultModel = ZAI_MODELS.GLM_4_5_AIR; // Default to fast model
  }

  /**
   * Configure the service with an API key
   */
  configure(apiKey: string, baseUrl?: string) {
    this.apiKey = apiKey;
    if (baseUrl) {
      this.baseUrl = baseUrl;
    }
  }

  /**
   * Check if the service is configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Get the current configuration status
   */
  getStatus(): { configured: boolean; model: string; baseUrl: string } {
    return {
      configured: this.isConfigured(),
      model: this.defaultModel,
      baseUrl: this.baseUrl,
    };
  }

  /**
   * Set the default model to use
   */
  setDefaultModel(model: ZaiModel) {
    this.defaultModel = model;
  }

  /**
   * Make a chat completion request to Z.ai API
   */
  async chat(
    messages: ZaiMessage[],
    options?: {
      model?: ZaiModel;
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<ZaiChatResponse> {
    if (!this.apiKey) {
      throw new Error("Z.ai API key not configured. Please set ZAI_API_KEY environment variable.");
    }

    const request: ZaiChatRequest = {
      model: options?.model || this.defaultModel,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 2048,
      stream: false,
    };

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`,
        "Accept-Language": "en-US,en,ar",
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Z.ai API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  /**
   * Analyze demand patterns and provide intelligent insights
   */
  async analyzeDemandPatterns(data: {
    items: Item[];
    movements: StockMovement[];
    demandSignals: DemandSignal[];
    historicalDays?: number;
  }): Promise<DemandInsight> {
    const { items, movements, demandSignals, historicalDays = 30 } = data;

    // Prepare context for the AI
    const itemSummary = items.slice(0, 20).map(i => ({
      name: i.name,
      sku: i.sku,
      category: i.category,
      reorderPoint: i.reorderPoint,
    }));

    const movementSummary = this.summarizeMovements(movements, historicalDays);
    const signalSummary = this.summarizeSignals(demandSignals);

    const systemPrompt = `You are an expert inventory analyst AI assistant for XCircle, a Saudi Arabian enterprise inventory management platform.
Analyze the following inventory data and provide actionable insights.
Always provide responses in both English and Arabic.
Focus on practical, data-driven recommendations.`;

    const userPrompt = `Analyze the following inventory data for the past ${historicalDays} days:

## Items (${items.length} total, showing top 20):
${JSON.stringify(itemSummary, null, 2)}

## Movement Summary:
${JSON.stringify(movementSummary, null, 2)}

## Demand Signals:
${JSON.stringify(signalSummary, null, 2)}

Please provide:
1. A brief summary of demand patterns (2-3 sentences)
2. Key trends identified (3-5 bullet points)
3. Actionable recommendations (3-5 bullet points)
4. Risk factors to watch (2-3 bullet points)

Format your response as JSON with these fields:
{
  "summary": "English summary",
  "summaryAr": "Arabic summary",
  "trends": ["trend1", "trend2"],
  "trendsAr": ["اتجاه1", "اتجاه2"],
  "recommendations": ["rec1", "rec2"],
  "recommendationsAr": ["توصية1", "توصية2"],
  "riskFactors": ["risk1", "risk2"],
  "riskFactorsAr": ["مخاطر1", "مخاطر2"],
  "confidence": 0.85
}`;

    const response = await this.chat([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ], {
      model: ZAI_MODELS.GLM_4_5, // Use more capable model for analysis
      temperature: 0.3,
    });

    try {
      const content = response.choices[0]?.message?.content || "{}";
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || [null, content];
      return JSON.parse(jsonMatch[1] || content);
    } catch {
      // Return a default response if parsing fails
      return {
        summary: "Analysis could not be completed. Please check the data and try again.",
        summaryAr: "لم يتم إكمال التحليل. يرجى التحقق من البيانات والمحاولة مرة أخرى.",
        trends: [],
        trendsAr: [],
        recommendations: [],
        recommendationsAr: [],
        riskFactors: [],
        riskFactorsAr: [],
        confidence: 0,
      };
    }
  }

  /**
   * Analyze an anomaly and identify root causes
   */
  async analyzeAnomaly(anomaly: Anomaly, context: {
    item?: Item;
    recentMovements?: StockMovement[];
    relatedAnomalies?: Anomaly[];
  }): Promise<AnomalyAnalysis> {
    const systemPrompt = `You are an expert anomaly analyst for XCircle inventory management platform.
Analyze the given anomaly and provide root cause analysis.
Always provide responses in both English and Arabic.
Be specific and actionable in your recommendations.`;

    const userPrompt = `Analyze this inventory anomaly:

## Anomaly Details:
- Type: ${anomaly.type}
- Severity: ${anomaly.severity}
- Title: ${anomaly.title}
- Description: ${anomaly.description}
- Detected Value: ${anomaly.detectedValue}
- Expected Value: ${anomaly.expectedValue}
- Deviation: ${anomaly.deviation}

## Context:
- Item: ${context.item ? JSON.stringify({ name: context.item.name, sku: context.item.sku, category: context.item.category }) : "Not available"}
- Recent Movements: ${context.recentMovements?.length || 0} movements in the past 7 days
- Related Anomalies: ${context.relatedAnomalies?.length || 0} similar anomalies detected

Please provide root cause analysis in this JSON format:
{
  "rootCause": "English explanation of likely root cause",
  "rootCauseAr": "Arabic explanation",
  "impact": "English description of business impact",
  "impactAr": "Arabic description",
  "suggestedActions": ["action1", "action2"],
  "suggestedActionsAr": ["إجراء1", "إجراء2"],
  "relatedPatterns": ["pattern1", "pattern2"],
  "confidence": 0.8
}`;

    const response = await this.chat([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ], {
      model: ZAI_MODELS.GLM_4_5_AIR,
      temperature: 0.3,
    });

    try {
      const content = response.choices[0]?.message?.content || "{}";
      const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || [null, content];
      return JSON.parse(jsonMatch[1] || content);
    } catch {
      return {
        rootCause: "Unable to determine root cause. Manual investigation recommended.",
        rootCauseAr: "لم يتم تحديد السبب الجذري. يوصى بالتحقيق اليدوي.",
        impact: "Impact assessment unavailable.",
        impactAr: "تقييم الأثر غير متاح.",
        suggestedActions: ["Review the anomaly manually", "Check data sources"],
        suggestedActionsAr: ["مراجعة الشذوذ يدوياً", "التحقق من مصادر البيانات"],
        relatedPatterns: [],
        confidence: 0,
      };
    }
  }

  /**
   * Answer natural language questions about inventory
   */
  async askQuestion(question: InventoryQuestion): Promise<InventoryAnswer> {
    const { question: q, context } = question;

    const systemPrompt = `You are an intelligent inventory assistant for XCircle platform.
Answer questions about inventory data clearly and accurately.
Always provide responses in both English and Arabic.
If you don't have enough data to answer, say so clearly.`;

    let contextInfo = "No specific data context provided.";
    if (context) {
      const parts = [];
      if (context.items?.length) {
        parts.push(`${context.items.length} items available`);
      }
      if (context.balances?.length) {
        parts.push(`${context.balances.length} stock balances`);
      }
      if (context.movements?.length) {
        parts.push(`${context.movements.length} recent movements`);
      }
      if (context.recommendations?.length) {
        parts.push(`${context.recommendations.length} pending recommendations`);
      }
      contextInfo = parts.join(", ");
    }

    const userPrompt = `Question: ${q}

Available Data Context: ${contextInfo}

${context?.items?.length ? `Sample Items: ${JSON.stringify(context.items.slice(0, 5).map(i => ({ name: i.name, sku: i.sku })))}` : ""}

Please answer in this JSON format:
{
  "answer": "English answer",
  "answerAr": "Arabic answer",
  "dataPoints": ["relevant data point 1", "data point 2"],
  "confidence": 0.9,
  "suggestedFollowUp": ["follow-up question 1"]
}`;

    const response = await this.chat([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ], {
      model: ZAI_MODELS.GLM_4_7_FLASH, // Use fast model for Q&A
      temperature: 0.5,
    });

    try {
      const content = response.choices[0]?.message?.content || "{}";
      const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || [null, content];
      return JSON.parse(jsonMatch[1] || content);
    } catch {
      return {
        answer: "I couldn't process your question. Please try rephrasing it.",
        answerAr: "لم أتمكن من معالجة سؤالك. يرجى إعادة صياغته.",
        dataPoints: [],
        confidence: 0,
      };
    }
  }

  /**
   * Generate an inventory report
   */
  async generateReport(config: ReportGeneration, data: {
    items: Item[];
    balances: StockBalance[];
    movements: StockMovement[];
    recommendations: Recommendation[];
    anomalies: Anomaly[];
  }): Promise<GeneratedReport> {
    const { type, sections, language } = config;

    const systemPrompt = `You are a professional report writer for XCircle inventory management platform.
Generate clear, executive-level reports that are actionable and insightful.
${language === "both" ? "Provide content in both English and Arabic." : `Provide content in ${language === "ar" ? "Arabic" : "English"}.`}`;

    const dataSummary = {
      totalItems: data.items.length,
      activeItems: data.items.filter(i => i.isActive).length,
      totalStockBalance: data.balances.reduce((sum, b) => sum + b.quantityOnHand, 0),
      recentMovements: data.movements.length,
      pendingRecommendations: data.recommendations.filter(r => r.status === "pending").length,
      openAnomalies: data.anomalies.filter(a => a.status === "open").length,
    };

    const userPrompt = `Generate a ${type} inventory report with these sections: ${sections.join(", ")}

## Data Summary:
${JSON.stringify(dataSummary, null, 2)}

## Sample Data:
- Top 5 Items: ${JSON.stringify(data.items.slice(0, 5).map(i => ({ name: i.name, category: i.category })))}
- Recent Anomalies: ${JSON.stringify(data.anomalies.slice(0, 3).map(a => ({ type: a.type, severity: a.severity, title: a.title })))}
- Top Recommendations: ${JSON.stringify(data.recommendations.slice(0, 3).map(r => ({ type: r.type, priority: r.priority, title: r.title })))}

Generate the report in this JSON format:
{
  "title": "Report Title",
  "titleAr": "عنوان التقرير",
  "summary": "Executive summary in 2-3 sentences",
  "summaryAr": "ملخص تنفيذي",
  "sections": [
    {
      "title": "Section Title",
      "titleAr": "عنوان القسم",
      "content": "Section content with key metrics and insights",
      "contentAr": "محتوى القسم"
    }
  ]
}`;

    const response = await this.chat([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ], {
      model: ZAI_MODELS.GLM_4_5,
      temperature: 0.4,
      maxTokens: 4096,
    });

    try {
      const content = response.choices[0]?.message?.content || "{}";
      const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || [null, content];
      const report = JSON.parse(jsonMatch[1] || content);
      return {
        ...report,
        generatedAt: new Date(),
      };
    } catch {
      return {
        title: "Report Generation Failed",
        titleAr: "فشل إنشاء التقرير",
        summary: "Unable to generate report. Please try again.",
        summaryAr: "غير قادر على إنشاء التقرير. يرجى المحاولة مرة أخرى.",
        sections: [],
        generatedAt: new Date(),
      };
    }
  }

  /**
   * Enhance a recommendation with AI insights
   */
  async enhanceRecommendation(recommendation: Recommendation, context: {
    item?: Item;
    balance?: StockBalance;
    recentMovements?: StockMovement[];
  }): Promise<{
    enhancedExplanation: string;
    enhancedExplanationAr: string;
    additionalContext: string[];
    alternativeActions: string[];
    priorityJustification: string;
  }> {
    const systemPrompt = `You are an AI assistant helping to enhance inventory recommendations for XCircle platform.
Provide additional context and justification for recommendations.
Always be specific and data-driven.`;

    const userPrompt = `Enhance this recommendation with additional insights:

## Recommendation:
- Type: ${recommendation.type}
- Priority: ${recommendation.priority}
- Title: ${recommendation.title}
- Description: ${recommendation.description}
- Confidence Score: ${recommendation.confidenceScore}

## Context:
- Item: ${context.item ? JSON.stringify({ name: context.item.name, sku: context.item.sku, reorderPoint: context.item.reorderPoint }) : "N/A"}
- Current Stock: ${context.balance?.quantityOnHand ?? "N/A"}
- Recent Movements: ${context.recentMovements?.length ?? 0}

Provide enhanced insights in this JSON format:
{
  "enhancedExplanation": "More detailed explanation in English",
  "enhancedExplanationAr": "شرح مفصل بالعربية",
  "additionalContext": ["context point 1", "context point 2"],
  "alternativeActions": ["alternative 1", "alternative 2"],
  "priorityJustification": "Why this priority level is appropriate"
}`;

    const response = await this.chat([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ], {
      model: ZAI_MODELS.GLM_4_7_FLASH,
      temperature: 0.4,
    });

    try {
      const content = response.choices[0]?.message?.content || "{}";
      const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || [null, content];
      return JSON.parse(jsonMatch[1] || content);
    } catch {
      return {
        enhancedExplanation: recommendation.explanation,
        enhancedExplanationAr: recommendation.explanation,
        additionalContext: [],
        alternativeActions: [],
        priorityJustification: `Priority set to ${recommendation.priority} based on confidence score of ${recommendation.confidenceScore}%`,
      };
    }
  }

  // Helper methods
  private summarizeMovements(movements: StockMovement[], days: number): object {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const recent = movements.filter(m => m.timestamp && new Date(m.timestamp) >= cutoff);

    const byType = recent.reduce((acc, m) => {
      acc[m.movementType] = (acc[m.movementType] || 0) + Math.abs(m.quantity);
      return acc;
    }, {} as Record<string, number>);

    return {
      totalMovements: recent.length,
      byType,
      avgQuantityPerMovement: recent.length > 0
        ? Math.round(recent.reduce((sum, m) => sum + Math.abs(m.quantity), 0) / recent.length)
        : 0,
    };
  }

  private summarizeSignals(signals: DemandSignal[]): object {
    const byType = signals.reduce((acc, s) => {
      acc[s.signalType] = (acc[s.signalType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalSignals: signals.length,
      byType,
      avgConfidence: signals.length > 0
        ? Math.round((signals.reduce((sum, s) => sum + (s.confidence || 0), 0) / signals.length) * 100) / 100
        : 0,
    };
  }
}

// Export singleton instance
export const zaiService = new ZaiService();
