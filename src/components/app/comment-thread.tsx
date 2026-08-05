'use client';

import { useRef } from 'react';
import { MessageSquare } from 'lucide-react';

import { addCommentAction } from '@/app/app/actions/actions';
import { Card, CardHeader, Avatar } from '@/components/ui/primitives';
import { SubmitButton } from '@/components/ui/form';
import { relativeTime } from '@/lib/utils';

export interface ThreadComment {
  id: string;
  body: string;
  userName: string;
  userEmail: string;
  createdAt: string;
}

export function CommentThread({
  entityType,
  entityId,
  comments,
  canComment,
}: {
  entityType: 'ACTION' | 'GAP' | 'EVIDENCE' | 'PROJECT_REQUIREMENT';
  entityId: string;
  comments: ThreadComment[];
  canComment: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-ink-400" aria-hidden />
            Comments
          </span>
        }
        description={comments.length === 0 ? 'No comments yet.' : undefined}
      />

      {comments.length > 0 && (
        <ul className="divide-y divide-ink-100">
          {comments.map((comment) => (
            <li key={comment.id} className="flex gap-3 px-5 py-3.5">
              <Avatar name={comment.userName} seed={comment.userEmail} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-[13px] font-semibold text-ink-900">{comment.userName}</span>
                  <span className="text-[11.5px] text-ink-400">{relativeTime(comment.createdAt)}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink-700">{comment.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {canComment && (
        <form
          ref={formRef}
          action={async (formData) => {
            await addCommentAction(formData);
            formRef.current?.reset();
          }}
          className="border-t border-ink-200 p-4"
        >
          <input type="hidden" name="entityType" value={entityType} />
          <input type="hidden" name="entityId" value={entityId} />
          <label htmlFor={`comment-${entityId}`} className="sr-only">
            Add a comment
          </label>
          <textarea
            id={`comment-${entityId}`}
            name="body"
            rows={2}
            required
            className="textarea min-h-[64px]"
            placeholder="Add context, a decision, or what you found…"
          />
          <div className="mt-2 flex justify-end">
            <SubmitButton size="sm" pendingLabel="Posting…">
              Comment
            </SubmitButton>
          </div>
        </form>
      )}
    </Card>
  );
}
