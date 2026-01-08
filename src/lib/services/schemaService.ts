const SCHEMA_VERSION = '1.0';
const SCHEMA_HASH = '4139e76fddaa7ddb5c441c2a96d486f595592530b72a26cc873952b52c97d851';
const SCHEMA_REFERENCE = 'docs/binder-schema.md';
const SCHEMA_URL = 'https://github.com/mattthomson/binder/blob/master/docs/binder-schema.md';

export type SchemaInfo = {
  version: string;
  hash: string;
  reference: string;
  url: string;
};

export type SchemaAnnouncement = {
  kind: 30019;
  created_at: number;
  tags: string[][];
  content: string;
};

export const schemaService = {
  getCurrentSchema() {
    return {
      version: SCHEMA_VERSION,
      hash: SCHEMA_HASH,
      reference: SCHEMA_REFERENCE,
      url: SCHEMA_URL
    };
  },
  buildAnnouncement(): SchemaAnnouncement {
    const content = `Binder schema v${SCHEMA_VERSION}\nReference: ${SCHEMA_REFERENCE}\nHash: ${SCHEMA_HASH}`;
    return {
      kind: 30019,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['type', 'schema'],
        ['version', SCHEMA_VERSION],
        ['hash', SCHEMA_HASH]
      ],
      content
    };
  }
};
