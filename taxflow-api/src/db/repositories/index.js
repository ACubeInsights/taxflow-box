import { UserRepository } from './UserRepository.js';
import { SessionRepository } from './SessionRepository.js';
import { ResetTokenRepository } from './ResetTokenRepository.js';
import { ClientRepository } from './ClientRepository.js';
import { ProjectRepository } from './ProjectRepository.js';
import { DocumentRequestRepository } from './DocumentRequestRepository.js';
import { CommentRepository } from './CommentRepository.js';
import { NotificationRepository } from './NotificationRepository.js';
import { ActivityLogRepository } from './ActivityLogRepository.js';
import { WebhookKeyRepository } from './WebhookKeyRepository.js';
import { ApprovalUndoRepository } from './ApprovalUndoRepository.js';
import { ClientVaultRepository } from './ClientVaultRepository.js';
import { InviteRepository } from './InviteRepository.js';
import { PermissionRepository } from './PermissionRepository.js';

import authService from '../../services/authService.js';
import projectService from '../../services/projectService.js';
import commentService from '../../services/commentService.js';
import inAppNotificationStore from '../../services/inAppNotificationStore.js';
import webhookService from '../../services/webhookService.js';
import statusTransitionService from '../../services/statusTransitionService.js';
import portalService from '../../services/portalService.js';
import inviteService from '../../services/inviteService.js';
import signupService from '../../services/signupService.js';
import permissionService from '../../services/permissionService.js';

let repos = null;

/**
 * Creates all 12 repository instances and returns them as a named object.
 * @param {import('knex').Knex} db - Knex instance
 * @returns {object} Named repository instances
 */
export function initRepositories(db) {
  repos = {
    userRepo: new UserRepository(db),
    sessionRepo: new SessionRepository(db),
    resetTokenRepo: new ResetTokenRepository(db),
    clientRepo: new ClientRepository(db),
    projectRepo: new ProjectRepository(db),
    docRequestRepo: new DocumentRequestRepository(db),
    commentRepo: new CommentRepository(db),
    notificationRepo: new NotificationRepository(db),
    activityRepo: new ActivityLogRepository(db),
    webhookKeyRepo: new WebhookKeyRepository(db),
    approvalUndoRepo: new ApprovalUndoRepository(db),
    clientVaultRepo: new ClientVaultRepository(db),
    inviteRepo: new InviteRepository(db),
    permissionRepo: new PermissionRepository(db),
  };
  return repos;
}

/**
 * Wires repositories into existing service singletons.
 * @param {object} repos - Named repository instances from initRepositories()
 */
export function injectRepositories(repos) {
  authService.setRepositories({
    userRepo: repos.userRepo,
    sessionRepo: repos.sessionRepo,
    resetTokenRepo: repos.resetTokenRepo,
    clientVaultRepo: repos.clientVaultRepo,
    clientRepo: repos.clientRepo,
  });

  projectService.setRepositories({
    clientRepo: repos.clientRepo,
    projectRepo: repos.projectRepo,
    docRequestRepo: repos.docRequestRepo,
    activityRepo: repos.activityRepo,
  });

  commentService.setRepositories({ commentRepo: repos.commentRepo });

  if (inAppNotificationStore.setRepositories) {
    inAppNotificationStore.setRepositories({ notificationRepo: repos.notificationRepo });
  }

  if (webhookService.setRepositories) {
    webhookService.setRepositories({ webhookKeyRepo: repos.webhookKeyRepo });
  }

  if (statusTransitionService.setRepositories) {
    statusTransitionService.setRepositories({ approvalUndoRepo: repos.approvalUndoRepo });
  }

  if (portalService.setRepositories) {
    portalService.setRepositories({
      docRepo: repos.docRequestRepo,
      clientRepo: repos.clientRepo,
      projectRepo: repos.projectRepo,
    });
  }

  inviteService.setRepositories({ inviteRepo: repos.inviteRepo });
  signupService.setRepositories({ inviteRepo: repos.inviteRepo });

  permissionService.setRepositories({ permissionRepo: repos.permissionRepo });

  if (inviteService.setRepositories) {
    inviteService.setRepositories({ inviteRepo: repos.inviteRepo });
  }
}

/**
 * Returns the initialized repositories object.
 * Throws if called before initRepositories().
 * @returns {object} Named repository instances
 */
export function getRepositories() {
  if (!repos) throw new Error('Repositories not initialized. Call initRepositories(db) first.');
  return repos;
}
