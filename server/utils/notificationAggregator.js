/**
 * Notification aggregation helpers.
 *
 * Collapses repeated same-target events (likes, comments, tags) into a single
 * notification row so a user with many followers doesn't see one notification
 * per like/comment.
 *
 * Aggregation rules:
 *  - Merge into an existing row when (type, recipient, relatedMedia) match,
 *    the row is unread, and its `lastActorAt` is within MERGE_WINDOW_MS.
 *  - Each actor is deduplicated; re-acting (e.g. like → unlike → like) does
 *    not inflate counts.
 *  - The newest actor is kept at the front of `actors`, capped at ACTOR_CAP.
 *  - `actorCount` reflects the true distinct actor count even after capping.
 */

import Notification from '../models/Notification.js';

export const MERGE_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
export const ACTOR_CAP = 10;

const TEMPLATES = {
  like: {
    title: 'New like',
    verb: 'liked your photo',
  },
  comment: {
    title: 'New comment',
    verb: 'commented on your photo',
  },
  tag: {
    title: 'You were tagged',
    verb: 'tagged you in a photo',
  },
};

/**
 * Build the human-readable message for an aggregated notification.
 *
 * 1 actor:    "Alice liked your photo"
 * 2 actors:   "Alice and Bob liked your photo"
 * 3+ actors:  "Alice and 2 others liked your photo"
 */
export function buildAggregatedMessage(type, actors, totalCount) {
  const tpl = TEMPLATES[type];
  if (!tpl) return '';

  const names = actors.map((a) => a.name || 'Someone');
  const verb = tpl.verb;

  if (totalCount <= 1 || names.length === 1) {
    return `${names[0] || 'Someone'} ${verb}`;
  }
  if (totalCount === 2) {
    return `${names[0]} and ${names[1] || 'someone else'} ${verb}`;
  }
  // 3+
  const others = totalCount - 1;
  return `${names[0]} and ${others} others ${verb}`;
}

/**
 * Upsert an aggregated notification for like / comment / tag.
 *
 * @param {Object} params
 * @param {'like'|'comment'|'tag'} params.type
 * @param {string|import('mongoose').Types.ObjectId} params.recipient
 * @param {{_id: any, name: string}} params.actor       The user performing the action.
 * @param {string|import('mongoose').Types.ObjectId} [params.relatedMedia]
 * @param {string|import('mongoose').Types.ObjectId} [params.relatedEvent]
 * @returns {Promise<import('mongoose').Document>}      The resulting (created or merged) notification.
 */
export async function upsertAggregatedNotification({
  type,
  recipient,
  actor,
  relatedMedia = null,
  relatedEvent = null,
}) {
  const tpl = TEMPLATES[type];
  if (!tpl) {
    throw new Error(`upsertAggregatedNotification: unsupported type "${type}"`);
  }
  if (!recipient || !actor || !actor._id) {
    throw new Error('upsertAggregatedNotification: recipient and actor are required');
  }

  const now = new Date();
  const cutoff = new Date(now.getTime() - MERGE_WINDOW_MS);
  const actorIdStr = String(actor._id);
  const actorName = actor.name || 'Someone';

  // Try to find an existing unread, recent row to merge into. We use the
  // compound index (recipient, type, relatedMedia, isRead, lastActorAt).
  const query = {
    type,
    recipient,
    isRead: false,
    lastActorAt: { $gte: cutoff },
  };
  if (relatedMedia) query.relatedMedia = relatedMedia;
  else query.relatedMedia = { $exists: false };

  const existing = await Notification.findOne(query).sort({ lastActorAt: -1 });

  if (existing) {
    // Backfill legacy rows that pre-date the aggregation fields.
    if (!Array.isArray(existing.actors) || existing.actors.length === 0) {
      const seedActor = existing.relatedUser
        ? { user: existing.relatedUser, name: actorName, at: existing.createdAt || now }
        : null;
      existing.actors = seedActor ? [seedActor] : [];
      existing.actorCount = existing.actors.length || 1;
    }

    const alreadyPresent = existing.actors.some((a) => String(a.user) === actorIdStr);

    if (!alreadyPresent) {
      // Prepend the new actor and cap the array.
      existing.actors = [
        { user: actor._id, name: actorName, at: now },
        ...existing.actors,
      ].slice(0, ACTOR_CAP);
      existing.actorCount = (existing.actorCount || 0) + 1;
    } else {
      // Move this actor to the front and refresh their timestamp so the
      // ordering reflects "most recent activity".
      existing.actors = [
        { user: actor._id, name: actorName, at: now },
        ...existing.actors.filter((a) => String(a.user) !== actorIdStr),
      ].slice(0, ACTOR_CAP);
    }

    existing.relatedUser = actor._id;
    existing.lastActorAt = now;
    existing.title = tpl.title;
    existing.message = buildAggregatedMessage(type, existing.actors, existing.actorCount);
    // Backfill relatedEvent for older rows that pre-date deep-linking.
    if (relatedEvent && !existing.relatedEvent) {
      existing.relatedEvent = relatedEvent;
    }

    await existing.save();
    return existing;
  }

  // No mergeable row — create a fresh one.
  const doc = await Notification.create({
    type,
    recipient,
    relatedUser: actor._id,
    relatedMedia: relatedMedia || undefined,
    relatedEvent: relatedEvent || undefined,
    title: tpl.title,
    message: buildAggregatedMessage(type, [{ name: actorName }], 1),
    actors: [{ user: actor._id, name: actorName, at: now }],
    actorCount: 1,
    lastActorAt: now,
  });

  return doc;
}
