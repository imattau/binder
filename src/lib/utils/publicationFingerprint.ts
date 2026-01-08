import type { LocalBook, LocalChapterDraft } from '$lib/domain/types';
import { hashString } from './hash';

export async function chapterFingerprint(chapter: LocalChapterDraft, renderedContent: string): Promise<string> {
  const payload = JSON.stringify({
    id: chapter.id,
    d: chapter.d,
    title: chapter.title,
    status: chapter.status,
    content: renderedContent,
    updatedAt: chapter.updatedAt
  });
  return hashString(payload);
}

export async function bookFingerprint(book: LocalBook): Promise<string> {
  const payload = JSON.stringify({
    title: book.title,
    summary: book.summary ?? '',
    cover: book.cover ?? '',
    chapterOrder: book.chapterOrder,
    topics: book.topics ?? [],
    coAuthors: book.coAuthors ?? [],
    updatedAt: book.updatedAt
  });
  return hashString(payload);
}
