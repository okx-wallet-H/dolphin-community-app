declare module '@vercel/node' {
  import type { IncomingMessage, ServerResponse } from 'http';

  export interface VercelRequest extends IncomingMessage {
    body?: unknown;
    query: Record<string, string | string[] | undefined>;
    cookies?: Record<string, string>;
    method?: string;
    headers: IncomingMessage['headers'];
    url?: string;
  }

  export interface VercelResponse extends ServerResponse {
    status(code: number): this;
    json(body: unknown): this;
    send(body: unknown): this;
    setHeader(name: string, value: number | string | readonly string[]): this;
    end(cb?: () => void): this;
    end(chunk: unknown, cb?: () => void): this;
    end(chunk: unknown, encoding: BufferEncoding, cb?: () => void): this;
  }
}
