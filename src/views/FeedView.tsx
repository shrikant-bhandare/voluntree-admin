"use client";

import { useState } from "react";
import { Ban, ImageOff, Images, MessageSquareText, Trash2 } from "lucide-react";
import { ApiError } from "../lib/api";
import { useDebounced, useMutation, usePagedList } from "../lib/hooks";
import { useApi } from "../lib/session";
import { useFeedback } from "../lib/feedback";
import { formatDateTime, plural, timeAgo } from "../lib/format";
import { oneLine } from "../utils/eventStatus";
import { API_BASE_URL } from "../config/constants";
import type { CommentRow, PostRow } from "../types/admin";
import { useConsole } from "../components/shell/ConsoleContext";
import { DataTable, type Column } from "../components/ui/DataTable";
import { Button, PageHeader, Panel, SearchInput, Segmented, Toolbar } from "../components/ui/primitives";
import { BannedBadge, PersonLink } from "../components/common/bits";

type Tab = "comments" | "posts";

const errorText = (err: unknown) => (err instanceof ApiError ? err.message : undefined);

/**
 * Upload URLs are re-hosted on the active API (the stored host can be stale,
 * and the CSP only allows images from the API). Anything that is not http(s)
 * is dropped.
 */
function mediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url, API_BASE_URL);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (u.pathname.startsWith("/uploads/")) return `${API_BASE_URL}${u.pathname}${u.search}`;
    return u.toString();
  } catch {
    return null;
  }
}

export default function FeedView() {
  const api = useApi();
  const { toast, confirm } = useFeedback();
  const { refreshStats, openEvent } = useConsole();
  const [tab, setTab] = useState<Tab>("comments");
  const [search, setSearch] = useState("");
  const q = useDebounced(search.trim(), 300);
  const [run, busy] = useMutation();

  const comments = usePagedList<CommentRow>(tab === "comments" ? "/admin/comments" : null, { q: q || undefined });
  const posts = usePagedList<PostRow>(tab === "posts" ? "/admin/posts" : null, { q: q || undefined });

  const driveLink = (id: string, title: string) => (
    <button
      type="button"
      onClick={e => {
        e.stopPropagation();
        openEvent(id);
      }}
      className="rounded-sm text-left text-forest underline decoration-forest/30 underline-offset-[3px] hover:decoration-forest"
    >
      {title}
    </button>
  );

  /* -------------------------------------------------------------- Actions */

  const removeComment = async (c: CommentRow) => {
    const r = await confirm({
      title: "Remove this comment?",
      tone: "danger",
      confirmLabel: "Remove comment",
      body: (
        <>
          <blockquote className="rounded-md bg-sunken px-3 py-2 text-ink">{oneLine(c.content, 200)}</blockquote>
          <p>
            By {c.user.fullName} on a photo post from {c.post.event.title}. Removing it is permanent: it cannot be
            restored. The removal and the comment text are recorded in the audit log.
          </p>
        </>
      ),
    });
    if (!r.confirmed) return;
    await run(`comment:${c.id}`, async () => {
      try {
        await api(`/posts/comments/${c.id}`, { method: "DELETE" });
        comments.removeItem(c.id);
        toast({ title: "Comment removed", description: `By ${c.user.fullName}` });
      } catch (err) {
        toast({ tone: "error", title: "Could not remove the comment", description: errorText(err) });
      }
    });
  };

  const suspendAuthor = async (c: CommentRow) => {
    const author = c.user;
    const r = await confirm({
      title: `Suspend ${oneLine(author.fullName, 60)}?`,
      tone: "danger",
      confirmLabel: "Suspend account",
      body: (
        <>
          <p>
            {author.fullName} ({author.email}) loses access to Voluntree straight away and cannot use the app until an
            administrator lifts the suspension from their profile.
          </p>
          <p>Suspending does not remove their comments. Remove any abusive ones separately.</p>
        </>
      ),
      note: {
        label: "Reason for suspending",
        placeholder: "e.g. Abusive comments on several drive posts",
        minLength: 5,
        hint: "Recorded in the audit log.",
      },
    });
    if (!r.confirmed) return;
    await run(`ban:${author.id}`, async () => {
      try {
        await api(`/auth/users/${author.id}/ban`, { method: "PATCH", body: { isBanned: true, reason: r.note } });
        for (const row of comments.items) {
          if (row.user.id === author.id) comments.updateItem(row.id, { user: { ...row.user, isBanned: true } });
        }
        refreshStats();
        toast({ title: "Account suspended", description: author.fullName });
      } catch (err) {
        toast({ tone: "error", title: "Could not suspend the account", description: errorText(err) });
      }
    });
  };

  const removePost = async (p: PostRow) => {
    const { likes, comments: commentCount } = p._count;
    const r = await confirm({
      title: "Remove this photo post?",
      tone: "danger",
      confirmLabel: "Remove post",
      body: (
        <>
          <p>
            Posted by {p.organizer.fullName} on {p.event.title}
            {p.caption ? `: “${oneLine(p.caption, 120)}”` : "."}
          </p>
          <p>
            Removing it also deletes its {plural(commentCount, "comment")} and {plural(likes, "like")}. This is permanent
            and is recorded in the audit log.
          </p>
        </>
      ),
    });
    if (!r.confirmed) return;
    await run(`post:${p.id}`, async () => {
      try {
        await api(`/posts/${p.id}`, { method: "DELETE" });
        posts.removeItem(p.id);
        toast({ title: "Photo post removed", description: p.event.title });
      } catch (err) {
        toast({ tone: "error", title: "Could not remove the post", description: errorText(err) });
      }
    });
  };

  /* -------------------------------------------------------------- Columns */

  const posted = (iso: string) => (
    <time dateTime={iso} title={formatDateTime(iso)} className="whitespace-nowrap text-meta text-ink-2">
      {timeAgo(iso)}
    </time>
  );

  const commentColumns: Column<CommentRow>[] = [
    {
      key: "comment",
      header: "Comment",
      primary: true,
      cell: c => <p className="max-w-md whitespace-pre-wrap break-words text-row text-ink">{c.content}</p>,
    },
    {
      key: "author",
      header: "Author",
      cell: c => (
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <PersonLink id={c.user.id} name={c.user.fullName} />
          {c.user.isBanned ? <BannedBadge /> : null}
        </span>
      ),
    },
    {
      key: "on",
      header: "On",
      className: "hidden xl:table-cell",
      cell: c => (
        <span className="block min-w-0">
          {driveLink(c.post.event.id, c.post.event.title)}
          <span className="block max-w-[16rem] truncate text-meta text-ink-3">
            {c.post.caption ? `Photo post: ${oneLine(c.post.caption, 60)}` : "Photo post"}
          </span>
        </span>
      ),
    },
    { key: "when", header: "Posted", cell: c => posted(c.createdAt) },
  ];

  const postColumns: Column<PostRow>[] = [
    {
      key: "post",
      header: "Photo post",
      primary: true,
      cell: p => (
        <div className="flex min-w-0 items-start gap-3">
          <Thumb
            src={mediaUrl(p.imageUrl)}
            alt={p.caption ? `Photo: ${oneLine(p.caption, 80)}` : `Photo from ${p.event.title}`}
          />
          <p
            className={
              p.caption
                ? "line-clamp-3 max-w-md whitespace-pre-wrap break-words text-row text-ink"
                : "text-row text-ink-3"
            }
          >
            {p.caption || "No caption"}
          </p>
        </div>
      ),
    },
    { key: "drive", header: "Drive", cell: p => driveLink(p.event.id, p.event.title) },
    {
      key: "organizer",
      header: "Organizer",
      className: "hidden lg:table-cell",
      cell: p => <PersonLink id={p.organizer.id} name={p.organizer.fullName} />,
    },
    {
      key: "engagement",
      header: "Engagement",
      className: "hidden xl:table-cell",
      cell: p => (
        <span className="whitespace-nowrap text-meta text-ink-2">
          {plural(p._count.likes, "like")} · {plural(p._count.comments, "comment")}
        </span>
      ),
    },
    { key: "when", header: "Posted", cell: p => posted(p.createdAt) },
  ];

  const searching = q.length > 0;

  return (
    <>
      <PageHeader
        title="Feed moderation"
        description="Comments and photo posts on drive feeds, newest first. Abuse is most likely in comments, so start there."
      />

      <Toolbar>
        <Segmented<Tab>
          label="Feed content"
          value={tab}
          onChange={setTab}
          options={[
            { value: "comments", label: "Comments" },
            { value: "posts", label: "Photo posts" },
          ]}
        />
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={tab === "comments" ? "Search comment text or author" : "Search caption, drive or organizer"}
        />
      </Toolbar>

      <Panel bodyClassName="p-0">
        {tab === "comments" ? (
          <DataTable
            caption="Feed comments"
            columns={commentColumns}
            rows={comments.items}
            rowKey={c => c.id}
            state={comments.state}
            error={comments.error}
            onRetry={comments.reload}
            hasMore={comments.hasMore}
            loadingMore={comments.loadingMore}
            onLoadMore={comments.loadMore}
            empty={{
              icon: MessageSquareText,
              title: searching ? `No comments match “${q}”` : "No comments yet",
              body: searching
                ? "Search looks at the comment text and the author's name."
                : "Comments people leave on drive photo posts show up here.",
            }}
            actions={c => (
              <>
                <Button
                  size="sm"
                  variant="danger-quiet"
                  icon={Trash2}
                  loading={busy === `comment:${c.id}`}
                  onClick={() => removeComment(c)}
                  aria-label={`Remove comment by ${c.user.fullName}`}
                >
                  Remove
                </Button>
                {!c.user.isBanned ? (
                  <Button
                    size="sm"
                    icon={Ban}
                    loading={busy === `ban:${c.user.id}`}
                    onClick={() => suspendAuthor(c)}
                    aria-label={`Suspend ${c.user.fullName}`}
                  >
                    Suspend author
                  </Button>
                ) : null}
              </>
            )}
          />
        ) : (
          <DataTable
            caption="Feed photo posts"
            columns={postColumns}
            rows={posts.items}
            rowKey={p => p.id}
            state={posts.state}
            error={posts.error}
            onRetry={posts.reload}
            hasMore={posts.hasMore}
            loadingMore={posts.loadingMore}
            onLoadMore={posts.loadMore}
            empty={{
              icon: Images,
              title: searching ? `No photo posts match “${q}”` : "No photo posts yet",
              body: searching
                ? "Search looks at the caption, the drive title and the organizer's name."
                : "Organizers' photos from their drives show up here.",
            }}
            actions={p => (
              <Button
                size="sm"
                variant="danger-quiet"
                icon={Trash2}
                loading={busy === `post:${p.id}`}
                onClick={() => removePost(p)}
                aria-label={`Remove photo post from ${p.event.title}`}
              >
                Remove post
              </Button>
            )}
          />
        )}
      </Panel>
    </>
  );
}

/** Post thumbnail that opens the full photo; falls back when the file is missing. */
function Thumb({ src, alt }: { src: string | null; alt: string }) {
  const [broken, setBroken] = useState(false);
  const box = "size-16 shrink-0 rounded-md bg-sunken ring-1 ring-line-soft";
  if (!src || broken) {
    return (
      <span role="img" aria-label={`Image unavailable. ${alt}`} className={`${box} inline-flex items-center justify-center text-ink-3`}>
        <ImageOff aria-hidden className="size-5" />
      </span>
    );
  }
  return (
    <a
      href={src}
      target="_blank"
      rel="noreferrer noopener"
      onClick={e => e.stopPropagation()}
      className="shrink-0 rounded-md"
      title="Open the full photo in a new tab"
    >
      {/* Plain <img>: uploads live on the API host, outside next/image's config. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} loading="lazy" onError={() => setBroken(true)} className={`${box} block object-cover`} />
    </a>
  );
}
