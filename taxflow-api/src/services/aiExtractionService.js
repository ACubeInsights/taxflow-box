/**
 * AIExtractionService — Box AI structured extraction and document validation.
 *
 * - extractStructuredData: POST /ai/extract_structured with taxflow_document template
 * - validateDocument: POST /ai/ask with completeness prompt
 * - ensureAIAgent: POST /ai/agents if not found, configure with tax document prompt
 *
 * Requirements: 32.1, 32.2, 32.3, 32.4, 32.5, 33.1, 33.2, 33.3, 33.4, 34.1, 34.2, 34.3, 34.4
 */

import boxService from './boxService.js';
import { config } from '../config.js';
import { TAXFLOW_DOCUMENT_TEMPLATE } from './metadataTemplateDefinition.js';

const METADATA_SCOPE = 'enterprise';
const METADATA_TEMPLATE = 'taxflow_document';
const AI_AGENT_NAME = 'TaxFlow Document Analyzer';

const TAX_DOCUMENT_SYSTEM_PROMPT =
  'You are a tax document analysis agent for TaxFlow Pro. ' +
  'Analyze US tax documents including W-2, 1099, 1040, K-1, and related forms. ' +
  'Extract relevant financial data fields such as document_type, financial_year, ' +
  'taxpayer information, income amounts, and withholding details. ' +
  'Flag any missing or suspicious values.';

class AIExtractionService {
  constructor() {
    /** @type {string|null} Cached AI agent ID */
    this._agentId = null;
  }

  /**
   * Runs Box AI structured extraction against the taxflow_document template.
   * Maps extracted fields to metadata and flags low-confidence fields. (Reqs 32.1-32.5)
   *
   * @param {string} fileId - Box file ID
   * @returns {Promise<{ fileId: string, extractedFields: Record<string, string>, confidenceScores: Record<string, number>, lowConfidenceFields: string[], flaggedForManualReview: boolean }>}
   */
  async extractStructuredData(fileId) {
    const client = boxService.getBoxClient();
    const confidenceThreshold = config.aiConfidenceThreshold || 0.6;

    // Build extraction schema from template fields (Req 32.1)
    const extractionFields = TAXFLOW_DOCUMENT_TEMPLATE.fields
      .filter((f) => ['document_type', 'financial_year'].includes(f.key))
      .map((f) => ({
        key: f.key,
        displayName: f.displayName,
        type: f.type,
        description: `Extract the ${f.displayName} from the document`,
      }));

    let aiResponse;
    try {
      aiResponse = await client.ai.createAiExtractStructured({
        items: [{ type: 'file', id: fileId }],
        metadata_template: {
          template_key: TAXFLOW_DOCUMENT_TEMPLATE.templateKey,
          scope: TAXFLOW_DOCUMENT_TEMPLATE.scope,
        },
        fields: extractionFields,
      });
    } catch (err) {
      console.error(`AI extraction failed for file ${fileId}:`, err.message);
      // Flag for manual review on failure (Req 32.5)
      await this._flagForManualReview(client, fileId);
      return {
        fileId,
        extractedFields: {},
        confidenceScores: {},
        lowConfidenceFields: [],
        flaggedForManualReview: true,
      };
    }

    // Map extracted fields (Req 32.2)
    const extractedFields = {};
    const confidenceScores = {};
    const lowConfidenceFields = [];

    const entries = aiResponse?.entries || aiResponse || {};
    for (const [key, value] of Object.entries(entries)) {
      if (typeof value === 'object' && value !== null && 'value' in value) {
        extractedFields[key] = String(value.value);
        const confidence = value.confidence || 0;
        confidenceScores[key] = confidence;
        if (confidence < confidenceThreshold) {
          lowConfidenceFields.push(key);
        }
      } else if (typeof value === 'string' || typeof value === 'number') {
        extractedFields[key] = String(value);
        confidenceScores[key] = 1.0; // No confidence info — assume high
      }
    }

    const flaggedForManualReview = lowConfidenceFields.length > 0;

    // Update file metadata with extracted values (Req 32.3)
    try {
      const patchOps = Object.entries(extractedFields)
        .filter(([key]) => TAXFLOW_DOCUMENT_TEMPLATE.fields.some((f) => f.key === key))
        .map(([key, value]) => ({ op: 'replace', path: `/${key}`, value }));

      // Flag low-confidence by setting priority to "high" (Req 32.5)
      if (flaggedForManualReview) {
        patchOps.push({ op: 'replace', path: '/priority', value: 'high' });
      }

      if (patchOps.length > 0) {
        await client.fileMetadata.updateFileMetadataById(
          fileId,
          METADATA_SCOPE,
          METADATA_TEMPLATE,
          patchOps
        );
      }
    } catch (err) {
      console.error(`Metadata update with AI results failed for file ${fileId}:`, err.message);
    }

    return {
      fileId,
      extractedFields,
      confidenceScores,
      lowConfidenceFields,
      flaggedForManualReview,
    };
  }

  /**
   * Validates document completeness via Box AI ask endpoint. (Reqs 33.1-33.4)
   *
   * @param {string} fileId - Box file ID
   * @param {string} documentType - Expected document type (e.g., "W-2", "1099")
   * @returns {Promise<{ fileId: string, isComplete: boolean, missingFields: string[], warnings: string[], confidenceScore: number }>}
   */
  async validateDocument(fileId, documentType) {
    const client = boxService.getBoxClient();

    const prompt =
      `Is this ${documentType} form complete? Are all required fields filled? ` +
      `List any missing or suspicious values. ` +
      `Respond with: is_complete (true/false), missing_fields (array), warnings (array), confidence_score (0-1).`;

    let aiResponse;
    try {
      aiResponse = await client.ai.createAiAsk({
        mode: 'single_item_qa',
        prompt,
        items: [{ type: 'file', id: fileId }],
      });
    } catch (err) {
      console.error(`AI validation failed for file ${fileId}:`, err.message);
      return {
        fileId,
        isComplete: false,
        missingFields: [],
        warnings: ['AI validation unavailable'],
        confidenceScore: 0,
      };
    }

    // Parse AI response (Req 33.2)
    const result = this._parseValidationResponse(aiResponse);

    // Set priority to "high" if incomplete (Req 33.4)
    if (!result.isComplete) {
      try {
        await client.fileMetadata.updateFileMetadataById(
          fileId,
          METADATA_SCOPE,
          METADATA_TEMPLATE,
          [{ op: 'replace', path: '/priority', value: 'high' }]
        );
      } catch (err) {
        console.error(`Priority update failed for file ${fileId}:`, err.message);
      }
    }

    return { fileId, ...result };
  }

  /**
   * Ensures custom TaxFlow AI agent exists. Creates if missing.
   * Falls back to default extraction on failure. (Reqs 34.1-34.4)
   *
   * @returns {Promise<{ agentId: string }|null>}
   */
  async ensureAIAgent() {
    if (this._agentId) {
      return { agentId: this._agentId };
    }

    const client = boxService.getBoxClient();

    try {
      const agent = await client.ai.createAiAgent({
        name: AI_AGENT_NAME,
        type: 'ai_agent',
        configuration: {
          system_message: TAX_DOCUMENT_SYSTEM_PROMPT,
          metadata_template: {
            template_key: TAXFLOW_DOCUMENT_TEMPLATE.templateKey,
            scope: TAXFLOW_DOCUMENT_TEMPLATE.scope,
          },
        },
      });

      this._agentId = agent.id;
      console.log(`Created AI agent: ${agent.id}`);
      return { agentId: agent.id };
    } catch (err) {
      // Fall back on failure (Req 34.4)
      console.warn(`AI agent creation failed, falling back to default extraction: ${err.message}`);
      return null;
    }
  }

  /**
   * Flags a file for manual review by setting priority to "high".
   * @param {object} client
   * @param {string} fileId
   */
  async _flagForManualReview(client, fileId) {
    try {
      await client.fileMetadata.updateFileMetadataById(
        fileId,
        METADATA_SCOPE,
        METADATA_TEMPLATE,
        [{ op: 'replace', path: '/priority', value: 'high' }]
      );
    } catch (err) {
      console.error(`Failed to flag file ${fileId} for manual review:`, err.message);
    }
  }

  /**
   * Parses AI validation response into structured result.
   * @param {object} response
   * @returns {{ isComplete: boolean, missingFields: string[], warnings: string[], confidenceScore: number }}
   */
  _parseValidationResponse(response) {
    const answer = response?.answer || response?.completion || '';

    // Try to parse as JSON first
    try {
      const jsonMatch = answer.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          isComplete: !!parsed.is_complete,
          missingFields: Array.isArray(parsed.missing_fields) ? parsed.missing_fields : [],
          warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
          confidenceScore: typeof parsed.confidence_score === 'number' ? parsed.confidence_score : 0.5,
        };
      }
    } catch {
      // Fall through to text parsing
    }

    // Fallback: text-based parsing
    const isComplete = /complete|all.*filled|no.*missing/i.test(answer) &&
      !/incomplete|not.*complete|missing/i.test(answer);

    return {
      isComplete,
      missingFields: [],
      warnings: answer ? [answer] : [],
      confidenceScore: 0.5,
    };
  }
}

// Singleton instance
const aiExtractionService = new AIExtractionService();
export { AIExtractionService };
export default aiExtractionService;
