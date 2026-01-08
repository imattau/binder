import type { SchemaInfo } from '$lib/services/schemaService';
import { schemaService } from '$lib/services/schemaService';
import { getCached, onCacheUpdate, setCached } from '$lib/services/cacheService';

const SCHEMA_CACHE_KEY = 'schema-info';
const SCHEMA_TTL = 5 * 60 * 1000;
const SCHEMA_CHECK_INTERVAL = 60 * 1000;

type SchemaListener = (schema: SchemaInfo) => void;
type AnnotationListener = (counts: Record<string, number>) => void;

const schemaListeners = new Set<SchemaListener>();
const annotationListeners = new Set<AnnotationListener>();
let initialized = false;

function emitSchemaUpdate(schema: SchemaInfo) {
  for (const listener of schemaListeners) {
    listener(schema);
  }
}

function emitAnnotationUpdate(counts: Record<string, number>) {
  for (const listener of annotationListeners) {
    listener(counts);
  }
}

function refreshSchema() {
  const schema = schemaService.getCurrentSchema();
  const cached = getCached<SchemaInfo>(SCHEMA_CACHE_KEY, 0);
  if (!cached || cached.hash !== schema.hash) {
    setCached(SCHEMA_CACHE_KEY, schema, SCHEMA_TTL);
    emitSchemaUpdate(schema);
  }
}

export const metadataRefreshService = {
  init() {
    if (initialized) return;
    initialized = true;
    if (typeof window !== 'undefined') {
      refreshSchema();
      setInterval(refreshSchema, SCHEMA_CHECK_INTERVAL);
    }
    onCacheUpdate(SCHEMA_CACHE_KEY, (value) => {
      if (isSchema(value)) {
        emitSchemaUpdate(value);
      }
    });
  },
  onSchemaUpdate(listener: SchemaListener) {
    schemaListeners.add(listener);
    return () => schemaListeners.delete(listener);
  },
  onAnnotationUpdate(listener: AnnotationListener) {
    annotationListeners.add(listener);
    return () => annotationListeners.delete(listener);
  },
  notifyAnnotationUpdate(counts: Record<string, number>) {
    emitAnnotationUpdate(counts);
  },
  getCachedSchema(): SchemaInfo | null {
    return getCached<SchemaInfo>(SCHEMA_CACHE_KEY, 0);
  }
};

function isSchema(value: unknown): value is SchemaInfo {
  return (
    typeof value === 'object' &&
    value !== null &&
    'version' in value &&
    'hash' in value &&
    'reference' in value &&
    'url' in value
  );
}
