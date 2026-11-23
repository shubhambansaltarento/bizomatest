import type { DiscoveryConfig } from '../config/discoveryConfig';

export type LogLevel = 'info' | 'warn' | 'error';
export type LogSink = (level: LogLevel, line: string) => void;

export interface Logger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  /** Replaces every credential value in a text with "***". Use before writing anything to disk. */
  redact(text: string): string;
}

const consoleSink: LogSink = (level, line) => {
  (level === 'error' ? console.error : level === 'warn' ? console.warn : console.log)(line);
};

/**
 * Logger for the discovery framework. Every line passes through redact(), so a credential that ends
 * up in a message by accident (an error text, a URL) is printed as "***".
 */
export function createLogger(config: DiscoveryConfig, sink: LogSink = consoleSink): Logger {
  // Longest first, so a password containing the username is replaced whole.
  const secrets = config.credentials.secrets().sort((a, b) => b.length - a.length);
  const redact = (text: string) => secrets.reduce((t, s) => t.split(s).join('***'), text);
  const log = (level: LogLevel) => (message: string) =>
    sink(level, redact(`[discovery] ${level === 'info' ? '' : `${level.toUpperCase()} `}${message}`));
  return { info: log('info'), warn: log('warn'), error: log('error'), redact };
}
