/**
 * Pure in-memory-fallback helpers for the Project domain.
 * Operate on the Maps owned by ProjectService's in-memory store.
 * Extracted from ProjectService with no logic changes.
 */

export function countActiveProjects(projects, clientId) {
  let count = 0;
  for (const p of projects.values()) {
    if (p.clientId === clientId && p.status === 'Active') count++;
  }
  return count;
}

export function countPendingActions(documents, clientId) {
  let count = 0;
  for (const d of documents.values()) {
    if (d.clientId === clientId && (d.status === 'Uploaded' || d.status === 'Under_Review')) {
      count++;
    }
  }
  return count;
}

export function computeProjectStats(documents, projectId) {
  let total = 0;
  let completed = 0;
  for (const d of documents.values()) {
    if (d.projectId === projectId) {
      total++;
      if (d.status === 'Approved' || d.status === 'Waived') {
        completed++;
      }
    }
  }
  return {
    documentCount: total,
    progressPercentage: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}
