/**
 * Box collaboration field helpers — Gen SDK uses camelCase; raw JSON uses snake_case.
 */

export function getCollaborationUserId(collab) {
  return collab?.accessibleBy?.id ?? collab?.accessible_by?.id ?? null;
}

export function findCollaborationForUser(collabs, boxUserId) {
  const want = String(boxUserId);
  return (collabs || []).find((c) => String(getCollaborationUserId(c) ?? '') === want) || null;
}

export function isBoxNotFoundError(err) {
  const status = err?.statusCode ?? err?.status ?? err?.responseInfo?.statusCode;
  if (status === 404) return true;
  const message = String(err?.message || '');
  return message.includes('404') && (
    message.includes('not_found') || message.includes('instance_not_found')
  );
}

export function isAlreadyCollaboratorError(err) {
  const status = err?.statusCode ?? err?.status;
  const message = String(err?.message || '');
  if (status === 409) return true;
  return status === 400 && (
    message.includes('user_already_collaborator') ||
    message.includes('already a collaborator')
  );
}
