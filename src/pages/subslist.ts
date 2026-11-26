import { Translations } from '../languages/types';
import { ru } from '../languages/ru';
import { User, FollowerUser } from '../types';
import { followListPage } from './sublist';

export function subslistPage(
  targetUser: User,
  followers: FollowerUser[],
  followingUsers: FollowerUser[],
  currentUser: User | null,
  t: Translations = ru,
  theme?: string
): string {
  return followListPage(targetUser, followers, followingUsers, currentUser, 'following', t, theme);
}
