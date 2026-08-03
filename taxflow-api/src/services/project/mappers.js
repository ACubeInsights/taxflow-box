/**
 * Pure DB row → app-level shape mapping helpers for the Project domain.
 * Extracted from ProjectService with no logic changes.
 */

/** Maps a DB client row to the app-level client shape */
export function mapClientFromDb(c, activeProjects = 0, pendingActions = 0) {
  return {
    id: c.id,
    name: c.name,
    email: c.email,
    entityType: c.entity_type,
    engagementStatus: c.engagement_status,
    activeProjects,
    pendingActions,
    boxFolderId: c.box_folder_id,
    boxUserId: c.box_user_id,
    externalId: c.external_id,
  };
}

/** Maps a DB project row to the app-level project shape */
export function mapProjectFromDb(p) {
  return {
    id: p.id,
    clientId: p.client_id,
    name: p.name,
    description: p.description,
    status: p.status,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}

/** Maps a DB document row to the app-level document shape */
export function mapDocFromDb(d) {
  return {
    id: d.id,
    name: d.name,
    description: d.description,
    dueDate: d.due_date,
    priority: d.priority,
    status: d.status,
    revisionComments: d.revision_comments,
    uploadedFileName: d.uploaded_file_name,
    fileId: d.box_file_id,
    clientId: d.client_id,
    projectId: d.project_id,
    documentType: d.document_type,
    version: d.version,
    isDraft: d.is_draft,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
    createdBy: d.created_by,
  };
}

/** Maps a DB activity row to the app-level activity shape */
export function mapActivityFromDb(a) {
  return {
    id: a.id,
    type: a.type,
    actorId: a.actor_id,
    actorName: a.actor_name,
    documentId: a.document_id,
    documentName: a.document_name,
    clientId: a.client_id,
    clientName: a.client_name,
    description: a.description,
    timestamp: a.timestamp,
  };
}

/** Filters a document array by one or more statuses */
export function filterByStatus(docs, status) {
  if (!status) return docs;
  const statuses = Array.isArray(status) ? status : [status];
  return docs.filter((d) => statuses.includes(d.status));
}
