import { EndpointError } from 'sdk';
import { clearUserData, deleteUser, clearUserPosts, getUserById, getUserByTelegramId } from '../lib/database.js';

const OWNER_CHAT_ID = 685669468;

export default async function (input, ctx) {
  console.log('manageUser endpoint called, input:', input);

  // Check if caller is owner
  const callerId = ctx.initData?.user?.id;
  if (!callerId || callerId !== OWNER_CHAT_ID) {
    throw new EndpointError('Unauthorized: Only the owner can manage user data', { code: 'UNAUTHORIZED' });
  }

  const { action, userId } = input || {};

  if (!userId) {
    throw new EndpointError('Missing userId parameter', { code: 'BAD_REQUEST' });
  }

  // Support either database id or telegram_id
  let targetUser = await getUserById(userId);
  if (!targetUser) {
    targetUser = await getUserByTelegramId(userId);
  }

  if (!targetUser) {
    throw new EndpointError(`User not found for identifier: ${userId}`, { code: 'NOT_FOUND' });
  }

  try {
    switch (action) {
      case 'clear_data': {
        const resetUser = await clearUserData(targetUser.id);
        return {
          success: true,
          action: 'clear_data',
          message: `Cleared all channel settings, structures, schedules, and custom sources for ${targetUser.username ? '@' + targetUser.username : 'User #' + targetUser.id}. Reset to fresh onboarding.`,
          user: resetUser
        };
      }

      case 'delete_user': {
        const result = await deleteUser(targetUser.id);
        return {
          success: true,
          action: 'delete_user',
          message: `Permanently deleted user ${targetUser.username ? '@' + targetUser.username : 'User #' + targetUser.id} and all related database records.`,
          result
        };
      }

      case 'clear_posts': {
        const result = await clearUserPosts(targetUser.id);
        return {
          success: true,
          action: 'clear_posts',
          message: `Cleared post history and reset post count for ${targetUser.username ? '@' + targetUser.username : 'User #' + targetUser.id}.`,
          result
        };
      }

      default:
        throw new EndpointError(`Unknown action: ${action}. Supported actions: clear_data, delete_user, clear_posts`, { code: 'INVALID_ACTION' });
    }
  } catch (error) {
    if (error instanceof EndpointError) throw error;
    console.error('Error executing manageUser action:', error);
    throw new EndpointError(error.message || 'Failed to manage user data', { code: 'INTERNAL_ERROR' });
  }
}
