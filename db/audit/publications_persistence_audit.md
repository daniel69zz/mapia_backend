# MAPIA publications persistence audit

Date: 2026-06-27

## Summary

MAPIA already has a persistent publication model in the `posts` table. The current
feed, map publication markers, profile "Mis publicaciones", comments, reactions,
and profile counters depend on `posts`, so creating a brand-new `publications`
table right now would duplicate the active model.

The main gap found was that the event/report creation flow writes to `reports`,
while the Publicaciones screen and profile posts read from `posts`. The chosen
non-destructive strategy is to keep `reports` for alert/event-specific data and
create a linked `posts` row for authenticated user-created events. This makes the
content visible in the existing persistent feed, profile, and map flows.

## Active tables used by backend

- `users`: authentication identity and roles.
- `profiles`: public user profile, counters, avatar, phone verification.
- `user_settings`: language/radius/notification settings.
- `posts`: main persistent publication table used by feed and map markers.
- `post_media`: images/videos attached to posts.
- `comments`: comments for posts.
- `reactions`: likes for posts.
- `content_reports`: moderation reports against posts.
- `follows`: social follow graph.
- `reports`: citizen reports/events/alerts with location and AI details.
- `report_images`: uploaded images for reports.
- `report_ai_analysis`: raw AI analysis audit data.
- `moderation_logs`: report moderation transition log.
- `languages`: language catalog.
- `report_candidates`: candidate reports generated from AI/news workflow.

## Tables/files that look legacy or potentially unused

- `schema.sql`: older standalone SQL for phone OTP fields; not aligned with the
  current NestJS `profiles` OTP flow. Keep for now, but do not use as canonical
  Supabase schema.
- `src/server.js`: in-memory development server with `users`, `sessions`, and
  `posts` arrays. It is not the NestJS/TypeORM Supabase backend and should not be
  used for production persistence.
- `news-experimental`: RSS proxy for El Deber. It is useful for exploration, but
  it does not persist AI news as publications.

No table or column should be dropped yet. A destructive cleanup should be a
separate migration with backup SQL after confirming production usage.

## Relationships

- `profiles.user_id -> users.id`
- `posts.author_id -> users.id`
- `post_media.post_id -> posts.id`
- `comments.post_id -> posts.id`
- `comments.author_id -> users.id`
- `reactions.post_id -> posts.id`
- `reactions.user_id -> users.id`
- `content_reports.post_id -> posts.id`
- `content_reports.reporter_id -> users.id`
- `follows.follower_id/following_id -> users.id`
- `report_images.report_id -> reports.id`
- `report_ai_analysis.report_id -> reports.id`
- `moderation_logs.report_id -> reports.id`

`reports.user_id` is indexed but currently has no foreign key in
`supabase-schema.sql`. This is intentionally left unchanged in this pass because
older anonymous reports may exist. A future migration can add a nullable FK after
validating data quality.

## Endpoint dependencies

- `POST /posts`, `GET /posts`, `GET /posts/user/:userId`, `GET /posts/:id` use
  `posts`, `profiles`, `post_media`, and `reactions`.
- `GET /map/publications` uses `posts` joined with `profiles`.
- `POST /reports` uses `reports` and `report_images`; after this change, it also
  creates a linked `posts` row for authenticated users.
- `GET /map/alerts` uses `reports` and `report_images`.
- `GET /news/today/map` reads El Deber RSS at request time and does not persist.
- Frontend `NewsPostsPage` expects `/news/generated-posts`, `/news/status`, and
  `/news/refresh`; those routes are not implemented in the NestJS `NewsModule`
  in this snapshot.

## Data required by frontend

- Publicaciones: post id, title, description, type/category, author profile,
  reputation-ish counters, first media URL, location, counts, dates.
- Perfil -> Mis publicaciones: current user's `posts` only, excluding AI news.
- Mapa: lightweight post markers with id, title, category/type, coordinates,
  author name/avatar/reputation.
- Noticias/Explorar: source name, source URL, title, summary, date, optional
  location, and a visible "Generado por IA" badge.

## Chosen strategy

1. Keep `posts` as the active publication table.
2. Keep `reports` as the detailed event/alert table.
3. On authenticated `POST /reports`, create a linked `posts` row with
   `contentType=USER_EVENT` stored in `reports.details`.
4. Copy report images into `post_media` so the feed can show them.
5. Do not create or drop a new `publications` table until the AI news persistence
   workflow is implemented end to end.

## Remaining recommended work

- Implement persistent AI news ingestion from El Deber with duplicate prevention
  by `source_url`. Because `posts.author_id` is currently NOT NULL, AI news needs
  either:
  - a safe schema extension to make author data flexible (`author_type`,
    nullable `author_id`, source columns), or
  - a separate `ai_news_publications` table plus a unified read endpoint.
- Add SQL/migration only after choosing one of those approaches.
- Replace `NewsPostsPage` endpoints or implement `/news/generated-posts`,
  `/news/status`, and `/news/refresh` in NestJS.
- Consider adding a nullable FK from `reports.user_id` to `users.id` after
  checking existing data.
