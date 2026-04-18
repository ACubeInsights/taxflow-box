import { clients, projects, documents, activities, employeeClients } from '../../fixtures/seedData.js';

/**
 * Seed demo data migration.
 *
 * Inserts the demo dataset from seedData.js into the database when the
 * clients table is empty. Skips seeding if any client records already exist.
 *
 * Requirements: 15.1, 15.2, 15.3
 *
 * @param {import('knex').Knex} knex
 */
export async function up(knex) {
  // Check if the database already has client records
  const count = await knex('clients').count('id as cnt').first();
  if (count.cnt > 0) {
    return; // Skip seeding — data already exists
  }

  // --- Users (employees) ---
  await knex('users').insert([
    {
      id: 'employee-1',
      box_user_id: 'box-user-employee-1',
      email: 'alex.johnson@taxflowpro.com',
      name: 'Alex Johnson',
      role: 'employee',
      password_hash: '$2b$10$dummyhashforemployee1seeddata000000000000000000000',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'employee-2',
      box_user_id: 'box-user-employee-2',
      email: 'maria.garcia@taxflowpro.com',
      name: 'Maria Garcia',
      role: 'employee',
      password_hash: '$2b$10$dummyhashforemployee2seeddata000000000000000000000',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ]);

  // --- Clients ---
  // The seed data uses the same email for all clients. The DB has a unique
  // constraint on email, so we make each one unique by prefixing with the
  // client ID when duplicates would occur.
  const seenEmails = new Set();
  await knex('clients').insert(
    clients.map((c) => {
      let email = c.email;
      if (seenEmails.has(email)) {
        email = `${c.id}-${email}`;
      }
      seenEmails.add(c.email);
      return {
        id: c.id,
        name: c.name,
        email,
        entity_type: c.entityType,
        engagement_status: c.engagementStatus,
        box_folder_id: c.boxFolderId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    })
  );

  // --- Projects ---
  await knex('projects').insert(
    projects.map((p) => ({
      id: p.id,
      client_id: p.clientId,
      name: p.name,
      description: p.description,
      status: p.status,
      created_at: p.createdAt,
      updated_at: p.createdAt,
    }))
  );

  // --- Document Requests ---
  await knex('document_requests').insert(
    documents.map((d) => ({
      id: d.id,
      project_id: d.projectId,
      client_id: d.clientId,
      name: d.name,
      description: d.description,
      document_type: d.documentType,
      due_date: d.dueDate,
      priority: d.priority,
      status: d.status,
      revision_comments: d.revisionComments,
      uploaded_file_name: d.uploadedFileName,
      box_file_id: d.fileId,
      version: d.version,
      is_draft: d.isDraft,
      created_by: d.createdBy,
      created_at: d.createdAt,
      updated_at: d.updatedAt,
    }))
  );

  // --- Activities ---
  await knex('activity_log').insert(
    activities.map((a) => ({
      id: a.id,
      type: a.type,
      actor_id: a.actorId,
      actor_name: a.actorName,
      document_id: a.documentId,
      document_name: a.documentName,
      client_id: a.clientId,
      client_name: a.clientName,
      description: a.description,
      timestamp: a.timestamp,
    }))
  );

  // --- Employee-Client Assignments ---
  const ecRows = [];
  for (const [employeeId, clientIds] of Object.entries(employeeClients)) {
    for (const clientId of clientIds) {
      ecRows.push({
        id: `ec-${employeeId}-${clientId}`,
        employee_id: employeeId,
        client_id: clientId,
        assigned_at: new Date().toISOString(),
      });
    }
  }
  await knex('employee_clients').insert(ecRows);
}

/**
 * Remove seeded demo data in reverse FK order.
 *
 * @param {import('knex').Knex} knex
 */
export async function down(knex) {
  // Delete in reverse order to respect foreign key constraints
  await knex('employee_clients')
    .whereIn('employee_id', ['employee-1', 'employee-2'])
    .del();

  await knex('activity_log')
    .whereIn('id', ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'a9', 'a10', 'a11'])
    .del();

  await knex('document_requests')
    .whereIn('id', [
      'd1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8', 'd9', 'd10',
      'd11', 'd12', 'd13', 'd14', 'd15', 'd16', 'd17', 'd18', 'd19', 'd20',
    ])
    .del();

  await knex('projects')
    .whereIn('id', ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'])
    .del();

  await knex('clients')
    .whereIn('id', ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7'])
    .del();

  await knex('users')
    .whereIn('id', ['employee-1', 'employee-2'])
    .del();
}
