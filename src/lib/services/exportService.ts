import { contentCacheService } from './contentCacheService';
import { markdownService } from './markdownService';
import { ok, fail, type Result } from '$lib/domain/result';
import JSZip from 'jszip'; // For EPUB structure later, or zipping assets if needed
import { saveAs } from 'file-saver';

export const exportService = {
    async exportBookAsHtml(pubkey: string, bookD: string): Promise<Result<void>> {
        // 1. Fetch Book
        const bookRes = await contentCacheService.getBook(pubkey, bookD, 'prefer-offline');
        if (!bookRes.ok) return fail(bookRes.error);
        const book = bookRes.value;
        const title = book.tags.find(t => t[0] === 'title')?.[1] || 'Untitled';
        
        // 2. Fetch Chapters
        const chapterRefs = book.tags
            .filter(t => t[0] === 'a')
            .map(t => t[1].split(':')[2]);

        let htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>${title}</title>
                <style>
                    body { font-family: serif; max-width: 800px; margin: 0 auto; padding: 2rem; line-height: 1.6; }
                    h1, h2, h3 { font-family: sans-serif; }
                    .chapter { page-break-before: always; margin-top: 4rem; }
                    .toc { margin-bottom: 4rem; }
                </style>
            </head>
            <body>
                <h1>${title}</h1>
                <div class="toc">
                    <h2>Table of Contents</h2>
                    <ul>
        `;

        const chaptersHtml: string[] = [];

        for (const chapterD of chapterRefs) {
            const chRes = await contentCacheService.getChapter(pubkey, chapterD, 'prefer-offline');
            if (chRes.ok) {
                const ch = chRes.value;
                const chTitle = ch.tags.find(t => t[0] === 'title')?.[1] || 'Untitled Chapter';
                const body = markdownService.render(ch.content);
                
                htmlContent += `<li><a href="#${chapterD}">${chTitle}</a></li>`;
                chaptersHtml.push(`
                    <div class="chapter" id="${chapterD}">
                        <h2>${chTitle}</h2>
                        ${body}
                    </div>
                `);
            }
        }

        htmlContent += `
                    </ul>
                </div>
                ${chaptersHtml.join('')}
            </body>
            </html>
        `;

        const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
        saveAs(blob, `${title}.html`);
        
        return ok(undefined);
    }
};
