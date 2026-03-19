/** Supported schema field types */
export type SchemaType = 'string' | 'number' | 'boolean' | 'enum';

/** A single field definition parsed from .env.schema */
export interface SchemaField {
  name: string;
  type: SchemaType;
  required: boolean;
  secret: boolean;
  defaultValue?: string;
  enumValues?: string[];
}

/** Parsed schema: map of variable name to field definition */
export type Schema = Map<string, SchemaField>;

/** Result of validating a single field */
export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

/** Result of a sync comparison between env files */
export interface SyncDiff {
  /** Variable name */
  variable: string;
  /** Which files contain this variable */
  presentIn: string[];
  /** Which files are missing this variable */
  missingFrom: string[];
}

/** A detected secret in a file */
export interface SecretMatch {
  file: string;
  line: number;
  pattern: string;
  match: string;
  /** Redacted version of the match */
  redacted: string;
}

/** Exit codes for CI mode */
export const EXIT_CODES = {
  SUCCESS: 0,
  VALIDATION_ERROR: 1,
  SYNC_DRIFT: 2,
  SECRETS_FOUND: 3,
} as const;
