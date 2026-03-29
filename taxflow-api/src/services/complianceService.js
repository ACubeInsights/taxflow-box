/**
 * ComplianceService — Retention policies, legal holds, and security classifications.
 *
 * - ensureRetentionPolicy: 7-year (2555 days) finite retention with permanent delete
 * - assignRetentionPolicy: Assign retention policy to approved files
 * - createLegalHold: Create legal hold policy + assignment
 * - releaseLegalHold: Delete legal hold assignment
 * - applyClassification: POST for new, PATCH for existing; Public/Internal/Confidential
 *
 * Requirements: 29.1, 29.2, 29.3, 29.4, 29.5, 30.1, 30.2, 30.3, 30.4, 31.1, 31.2, 31.3, 31.4
 */

import boxService from './boxService.js';

const RETENTION_POLICY_NAME = 'TaxFlow 7-Year Retention';
const RETENTION_DAYS = 2555; // 7 years
const CLASSIFICATION_TEMPLATE = 'securityClassification-6VMVochwUWo';
const CLASSIFICATION_KEY = 'Box__Security__Classification__Key';

class ComplianceService {
  constructor() {
    /** @type {string|null} Cached retention policy ID */
    this._retentionPolicyId = null;
  }

  /**
   * Ensures 7-year retention policy exists. Creates if missing, retrieves if 409. (Reqs 29.1, 29.2, 29.4)
   *
   * @returns {Promise<{ policyId: string, policyName: string, retentionLength: number }>}
   */
  async ensureRetentionPolicy() {
    if (this._retentionPolicyId) {
      return {
        policyId: this._retentionPolicyId,
        policyName: RETENTION_POLICY_NAME,
        retentionLength: RETENTION_DAYS,
      };
    }

    const client = boxService.getBoxClient();

    try {
      const policy = await client.retentionPolicies.createRetentionPolicy({
        policyName: RETENTION_POLICY_NAME,
        policyType: 'finite',
        retentionLength: String(RETENTION_DAYS),
        dispositionAction: 'permanently_delete',
        areOwnersNotified: true,
        canOwnerExtendRetention: false,
      });

      this._retentionPolicyId = policy.id;
      console.log(`Created retention policy: ${policy.id}`);

      return {
        policyId: policy.id,
        policyName: RETENTION_POLICY_NAME,
        retentionLength: RETENTION_DAYS,
      };
    } catch (error) {
      // Handle 409 — policy already exists (Req 29.4)
      if (error.statusCode === 409 || error.status === 409) {
        return this._findExistingRetentionPolicy(client);
      }
      throw error;
    }
  }

  /**
   * Finds existing retention policy by name.
   * @param {object} client
   * @returns {Promise<{ policyId: string, policyName: string, retentionLength: number }>}
   */
  async _findExistingRetentionPolicy(client) {
    try {
      const policies = await client.retentionPolicies.getRetentionPolicies({
        policyName: RETENTION_POLICY_NAME,
      });

      const match = (policies.entries || []).find(
        (p) => p.policyName === RETENTION_POLICY_NAME || p.policy_name === RETENTION_POLICY_NAME
      );

      if (match) {
        this._retentionPolicyId = match.id;
        console.log(`Found existing retention policy: ${match.id}`);
        return {
          policyId: match.id,
          policyName: RETENTION_POLICY_NAME,
          retentionLength: RETENTION_DAYS,
        };
      }
    } catch (err) {
      console.error('Failed to retrieve existing retention policy:', err.message);
    }

    throw new Error('Retention policy conflict but could not retrieve existing policy');
  }

  /**
   * Assigns retention policy to a file. (Reqs 29.3, 29.5)
   *
   * @param {string} fileId - Box file ID
   * @returns {Promise<{ assignmentId: string }>}
   */
  async assignRetentionPolicy(fileId) {
    const { policyId } = await this.ensureRetentionPolicy();
    const client = boxService.getBoxClient();

    const assignment = await client.retentionPolicyAssignments.createRetentionPolicyAssignment({
      policyId: policyId,
      assignTo: { type: 'file', id: fileId },
    });

    console.log(`Retention policy assigned to file ${fileId}: assignment ${assignment.id}`);
    return { assignmentId: assignment.id };
  }

  /**
   * Creates a legal hold policy and assigns it to a target. (Reqs 30.1, 30.2)
   *
   * @param {string} policyName - Legal hold policy name
   * @param {string} description - Policy description
   * @param {string} targetId - File or folder ID
   * @param {'file'|'folder'} targetType - Target type
   * @returns {Promise<{ policyId: string, assignmentId: string, targetId: string, targetType: string }>}
   */
  async createLegalHold(policyName, description, targetId, targetType) {
    const client = boxService.getBoxClient();

    // Create legal hold policy (Req 30.1)
    const policy = await client.legalHoldPolicies.createLegalHoldPolicy({
      policyName: policyName,
      description: description || '',
    });

    // Assign to target (Req 30.2)
    const assignment = await client.legalHoldPolicyAssignments.createLegalHoldPolicyAssignment({
      policyId: policy.id,
      assignTo: { type: targetType, id: targetId },
    });

    console.log(`Legal hold "${policyName}" assigned to ${targetType} ${targetId}`);

    return {
      policyId: policy.id,
      assignmentId: assignment.id,
      targetId,
      targetType,
    };
  }

  /**
   * Releases a legal hold by deleting the assignment. (Req 30.4)
   *
   * @param {string} assignmentId - Legal hold policy assignment ID
   */
  async releaseLegalHold(assignmentId) {
    const client = boxService.getBoxClient();

    await client.legalHoldPolicyAssignments.deleteLegalHoldPolicyAssignmentById(assignmentId);
    console.log(`Legal hold assignment ${assignmentId} released at ${new Date().toISOString()}`);
  }

  /**
   * Applies security classification to a file.
   * Uses POST for new, PATCH for existing. Supports Public, Internal, Confidential. (Reqs 31.1-31.4)
   *
   * @param {string} fileId - Box file ID
   * @param {'Public'|'Internal'|'Confidential'} level - Classification level
   */
  async applyClassification(fileId, level) {
    const validLevels = ['Public', 'Internal', 'Confidential'];
    if (!validLevels.includes(level)) {
      throw new Error(`Invalid classification level: ${level}. Must be one of: ${validLevels.join(', ')}`);
    }

    const client = boxService.getBoxClient();

    try {
      // Try POST for new classification (Req 31.1)
      await client.fileMetadata.createFileMetadataById(
        fileId,
        'enterprise',
        CLASSIFICATION_TEMPLATE,
        { [CLASSIFICATION_KEY]: level }
      );
    } catch (error) {
      // If already exists, use PATCH to update (Req 31.4)
      if (error.statusCode === 409 || error.status === 409) {
        await client.fileMetadata.updateFileMetadataById(
          fileId,
          'enterprise',
          CLASSIFICATION_TEMPLATE,
          [{ op: 'replace', path: `/${CLASSIFICATION_KEY}`, value: level }]
        );
      } else {
        throw error;
      }
    }

    console.log(`Classification "${level}" applied to file ${fileId}`);
  }
}

// Singleton instance
const complianceService = new ComplianceService();
export { ComplianceService };
export default complianceService;
