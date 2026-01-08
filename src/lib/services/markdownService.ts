import MarkdownIt from 'markdown-it';
import sanitizeHtml from 'sanitize-html';

const md = new MarkdownIt({
    html: true, // We allow HTML in parser, but sanitize it after
    linkify: true,
    typographer: true
});

export const markdownService = {
    render: (content: string): string => {
        const rawHtml = md.render(content || '');
        return sanitizeHtml(rawHtml, {
            allowedTags: [
                'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'p', 'a', 'ul', 'ol',
                'nl', 'li', 'b', 'i', 'strong', 'em', 'strike', 'code', 'hr', 'br', 'div',
                'table', 'thead', 'caption', 'tbody', 'tr', 'th', 'td', 'pre', 'img'
            ],
            allowedAttributes: {
                'a': [ 'href', 'name', 'target' ],
                'img': [ 'src', 'alt', 'title' ]
            },
            allowedSchemes: [ 'http', 'https', 'mailto' ],
            transformTags: {
                'a': sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer' })
            }
        });
    }
};