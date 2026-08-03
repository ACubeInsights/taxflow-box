import { UserRepository } from './UserRepository.js';
import { SessionRepository } from './SessionRepository.js';
import { ResetTokenRepository } from './ResetTokenRepository.js';
import { InviteRepository } from './InviteRepository.js';
import { ClientRepository } from './ClientRepository.js';
import { ProjectRepository } from './ProjectRepository.js';
import { DocumentRequestRepository } from './DocumentRequestRepository.js';
import { CommentRepository } from './CommentRepository.js';
import { NotificationRepository } from './NotificationRepository.js';
import { ActivityLogRepository } from './ActivityLogRepository.js';
import { WebhookKeyRepository } from './WebhookKeyRepository.js';
import { ApprovalUndoRepository } from './ApprovalUndoRepository.js';
import { ClientVaultRepository } from './ClientVaultRepository.js';
import { PermissionRepository } from './PermissionRepository.js';
import {
  isBoxFirstSchema,
  isFullSchema,
  isProductionSchema,
} from '../schemaMode.js';

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
import vaultDiscoveryService from '../../services/vaultDiscoveryService.js';
import boxEntityService from '../../services/boxEntityService.js';
import boxDocumentRequestService from '../../services/boxDocumentRequestService.js';
import boxCollaborationAccessService from '../../services/boxCollaborationAccessService.js';
import employeeService from '../../services/employeeService.js';

let repos = null;

/**
 * Creates repository instances based on DB_SCHEMA mode.
 * @param {import('knex').Knex} db
 * @returns {object}
 */
export function initRepositories(db) {
  repos = {
    userRepo: new UserRepository(db),
    sessionRepo: new SessionRepository(db),
    resetTokenRepo: new ResetTokenRepository(db),
    inviteRepo: new InviteRepository(db),
  };

  if (isProductionSchema() || isFullSchema()) {
    Object.assign(repos, {
      commentRepo: new CommentRepository(db),
      notificationRepo: new NotificationRepository(db),
      activityRepo: new ActivityLogRepository(db),
      webhookKeyRepo: new WebhookKeyRepository(db),
      approvalUndoRepo: new ApprovalUndoRepository(db),
    });
  }

  if (isFullSchema()) {
    Object.assign(repos, {
      clientRepo: new ClientRepository(db),
      projectRepo: new ProjectRepository(db),
      docRequestRepo: new DocumentRequestRepository(db),
      clientVaultRepo: new ClientVaultRepository(db),
      permissionRepo: new PermissionRepository(db),
    });
  }

  return repos;
}

/**
 * Wires repositories into service singletons.
 * @param {object} repos
 */
export function injectRepositories(repos) {
  const boxFirst = isBoxFirstSchema();
  const hasOperational = isProductionSchema() || isFullSchema();

  authService.setRepositories({
    userRepo: repos.userRepo,
    sessionRepo: repos.sessionRepo,
    resetTokenRepo: repos.resetTokenRepo,
    clientVaultRepo: boxFirst ? null : repos.clientVaultRepo,
    clientRepo: boxFirst ? null : repos.clientRepo,
  });

  boxEntityService.setRepositories({ userRepo: repos.userRepo });
  boxDocumentRequestService.setRepositories({ userRepo: repos.userRepo });

  projectService.setRepositories({
    userRepo: repos.userRepo,
    minimalMode: boxFirst,
    ...(boxFirst
      ? { activityRepo: hasOperational ? repos.activityRepo : null }
      : {
          clientRepo: repos.clientRepo,
          projectRepo: repos.projectRepo,
          docRequestRepo: repos.docRequestRepo,
          activityRepo: repos.activityRepo,
        }),
  });

  vaultDiscoveryService.setRepositories({
    userRepo: repos.userRepo,
    clientRepo: boxFirst ? null : repos.clientRepo,
    clientVaultRepo: boxFirst ? null : repos.clientVaultRepo,
  });

  boxCollaborationAccessService.setRepositories({
    userRepo: repos.userRepo,
    clientRepo: boxFirst ? null : repos.clientRepo,
    clientVaultRepo: boxFirst ? null : repos.clientVaultRepo,
  });

  permissionService.setRepositories({
    permissionRepo: boxFirst ? null : repos.permissionRepo,
    clientRepo: boxFirst ? null : repos.clientRepo,
    clientVaultRepo: boxFirst ? null : repos.clientVaultRepo,
    userRepo: repos.userRepo,
  });

  inviteService.setRepositories({ inviteRepo: repos.inviteRepo });
  signupService.setRepositories({ inviteRepo: repos.inviteRepo });

  if (employeeService.setRepositories) {
    employeeService.setRepositories({ userRepo: repos.userRepo });
  }

  if (hasOperational) {
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
  }

  if (isFullSchema()) {
    portalService.setRepositories({
      docRepo: repos.docRequestRepo,
      clientRepo: repos.clientRepo,
      projectRepo: repos.projectRepo,
    });
  } else if (isProductionSchema()) {
    portalService.setRepositories({ userRepo: repos.userRepo });
  }
}

export function getRepositories() {
  if (!repos) throw new Error('Repositories not initialized. Call initRepositories(db) first.');
  return repos;
}
