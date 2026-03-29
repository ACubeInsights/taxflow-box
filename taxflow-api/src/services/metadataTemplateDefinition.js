/**
 * Metadata Template Definition — Shared constants for the taxflow_document template.
 *
 * Defines the enterprise metadata template with all 10 fields and provides
 * a sync function to create or verify the template on Box.
 *
 * Requirements: 10.1, 10.2, 10.3, 10.4
 */

/**
 * The taxflow_document metadata template definition.
 * Scope: enterprise, templateKey: taxflow_document
 */
export const TAXFLOW_DOCUMENT_TEMPLATE = {
  scope: 'enterprise',
  displayName: 'TaxFlow Document',
  templateKey: 'taxflow_document',
  fields: [
    { type: 'string', key: 'client_id', displayName: 'Client ID' },
    { type: 'string', key: 'engagement_id', displayName: 'Engagement ID' },
    { type: 'string', key: 'request_id', displayName: 'Request ID' },
    { type: 'string', key: 'document_type', displayName: 'Document Type' },
    { type: 'string', key: 'financial_year', displayName: 'Financial Year' },
    {
      type: 'enum',
      key: 'status',
      displayName: 'Status',
      options: [
        { key: 'pending_upload' },
        { key: 'uploaded' },
        { key: 'under_review' },
        { key: 'approved' },
        { key: 'revision_requested' },
        { key: 'waived' },
        { key: 'signed' },
      ],
    },
    { type: 'string', key: 'reviewer', displayName: 'Reviewer' },
    { type: 'string', key: 'review_comments', displayName: 'Review Comments' },
    { type: 'date', key: 'reviewed_at', displayName: 'Reviewed At' },
    {
      type: 'enum',
      key: 'priority',
      displayName: 'Priority',
      options: [
        { key: 'low' },
        { key: 'normal' },
        { key: 'high' },
        { key: 'urgent' },
      ],
    },
  ],
};

/** Required field keys for validation */
export const REQUIRED_FIELD_KEYS = TAXFLOW_DOCUMENT_TEMPLATE.fields.map((f) => f.key);

/** Queryable fields (indexed for metadata queries) — Req 10.3 */
export const QUERYABLE_FIELDS = ['client_id', 'engagement_id', 'status'];

/**
 * Creates or verifies the taxflow_document metadata template on Box.
 * Handles 409 if template already exists and logs field discrepancies. (Req 10.4)
 *
 * @param {object} client - Box SDK client instance
 * @returns {Promise<{ templateKey: string, created: boolean }>}
 */
export async function syncTaxflowDocumentTemplate(client) {
  try {
    await client.metadataTemplates.createMetadataTemplate({
      scope: TAXFLOW_DOCUMENT_TEMPLATE.scope,
      displayName: TAXFLOW_DOCUMENT_TEMPLATE.displayName,
      templateKey: TAXFLOW_DOCUMENT_TEMPLATE.templateKey,
      fields: TAXFLOW_DOCUMENT_TEMPLATE.fields,
    });

    console.log('Created taxflow_document metadata template');
    return { templateKey: TAXFLOW_DOCUMENT_TEMPLATE.templateKey, created: true };
  } catch (error) {
    // Handle 409 — template already exists (Req 10.4)
    if (error.statusCode === 409 || error.status === 409) {
      console.log('taxflow_document metadata template already exists, verifying fields...');

      try {
        const existing = await client.metadataTemplates.getMetadataTemplate(
          TAXFLOW_DOCUMENT_TEMPLATE.scope,
          TAXFLOW_DOCUMENT_TEMPLATE.templateKey
        );

        const existingKeys = (existing.fields || []).map((f) => f.key);
        const missingKeys = REQUIRED_FIELD_KEYS.filter((k) => !existingKeys.includes(k));

        if (missingKeys.length > 0) {
          console.warn(
            `taxflow_document template missing fields: ${missingKeys.join(', ')}`
          );
        } else {
          console.log('taxflow_document template verified — all fields present');
        }
      } catch (verifyErr) {
        console.error('Failed to verify existing template:', verifyErr.message);
      }

      return { templateKey: TAXFLOW_DOCUMENT_TEMPLATE.templateKey, created: false };
    }

    throw error;
  }
}
