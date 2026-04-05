/**
 * @module types
 * Shared JSDoc type definitions for the TaxFlow API backend.
 * These typedefs define the canonical data shapes used across services.
 *
 * Related requirements: 9.1
 */

/**
 * @typedef {Object} ClientSummary
 * @property {string} id
 * @property {string} name
 * @property {string} email
 * @property {string} entityType
 * @property {string} engagementStatus
 * @property {number} activeProjects
 * @property {number} pendingActions
 * @property {string} boxFolderId
 * @property {string} [boxUserId]
 * @property {string} [externalId]
 */

/**
 * @typedef {Object} Project
 * @property {string} id
 * @property {string} clientId
 * @property {string} name
 * @property {string} description
 * @property {string} status
 * @property {number} documentCount
 * @property {number} progressPercentage
 * @property {string} createdAt
 */

/**
 * @typedef {Object} DocumentRequest
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {string} dueDate
 * @property {string} priority
 * @property {string} status
 * @property {string|null} revisionComments
 * @property {string|null} uploadedFileName
 * @property {string|null} fileId
 * @property {string} clientId
 * @property {string} projectId
 * @property {string} documentType
 * @property {number} version
 * @property {boolean} isDraft
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {string} createdBy
 */


/**
 * @typedef {Object} ActivityEntry
 * @property {string} id
 * @property {string} type
 * @property {string} actorId
 * @property {string} actorName
 * @property {string|null} documentId
 * @property {string|null} documentName
 * @property {string} clientId
 * @property {string} clientName
 * @property {string} description
 * @property {string} timestamp
 */

/**
 * @typedef {Object} Comment
 * @property {string} id
 * @property {string} documentId
 * @property {'review'|'internal'|'system'} type
 * @property {string} authorId
 * @property {string} authorName
 * @property {string} text
 * @property {string[]} mentions
 * @property {string} createdAt
 * @property {string|null} editedAt
 * @property {boolean} [isEditable]
 */

/**
 * @typedef {Object} Notification
 * @property {string} id
 * @property {string} recipientId
 * @property {string} eventType
 * @property {string} message
 * @property {boolean} read
 * @property {string} createdAt
 * @property {Object} [documentReference]
 * @property {string} [deepLinkUrl]
 */

/**
 * @typedef {Object} HttpErrorResponse
 * @property {string} error
 * @property {string} code
 * @property {number} statusCode
 * @property {Object} [details]
 */