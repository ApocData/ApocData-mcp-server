/**
 * 通用 HTTP client，封装 ApocData /open/data/* 调用。
 *
 * - GET only，参数序列化为 query string
 * - 自动透传 X-Tdc-* 元信息头（限流/截断/错误码/缓存）
 * - 超时控制（AbortController）和 5xx 自动重试（指数 backoff）
 * - 错误归一化为 NetworkError，保留 HTTP 状态和原始消息
 */

export interface CallResult {
  /** 响应 JSON body（R<T> 包装：{ code, success, data, msg }） */
  body: unknown;
  /** 经过提取的 X-Tdc-* 元数据，便于 Agent 感知 */
  meta: Record<string, string>;
  status: number;
}

export interface ClientOptions {
  /** 单次请求超时，毫秒，默认 30000 */
  timeoutMs?: number;
  /** 5xx/网络错误最多重试次数（不含首次），默认 2 */
  maxRetries?: number;
  /** 首次重试 backoff 毫秒（之后 2x 递增），默认 500 */
  retryBackoffMs?: number;
}

const META_HEADER_PREFIX = 'x-tdc-';
const CACHE_CONTROL_HEADER = 'cache-control';

export class ApocDataClient {
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly retryBackoffMs: number;

  constructor(
    private readonly baseUrl: string,
    options: ClientOptions = {},
  ) {
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.maxRetries = options.maxRetries ?? 2;
    this.retryBackoffMs = options.retryBackoffMs ?? 500;
  }

  async call(path: string, params: Record<string, unknown>): Promise<CallResult> {
    const url = this.buildUrl(path, params);
    let lastError: unknown = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await this.fetchOnce(url);
        // 5xx 触发重试；4xx 直接返回（业务问题，不该重试）
        if (result.status >= 500 && attempt < this.maxRetries) {
          await this.sleep(this.backoff(attempt));
          continue;
        }
        return result;
      } catch (err) {
        lastError = err;
        // AbortError 或网络错误：重试
        if (attempt < this.maxRetries) {
          await this.sleep(this.backoff(attempt));
          continue;
        }
      }
    }

    // 重试用尽，抛规范化错误
    throw new NetworkError(this.formatError(lastError), lastError);
  }

  private async fetchOnce(url: string): Promise<CallResult> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'GET',
        signal: ctrl.signal,
        headers: {
          'User-Agent': 'apocdata-mcp-server/0.1.0',
          Accept: 'application/json',
        },
      });

      const meta: Record<string, string> = {};
      for (const [key, value] of res.headers) {
        const lower = key.toLowerCase();
        if (lower.startsWith(META_HEADER_PREFIX) || lower === CACHE_CONTROL_HEADER) {
          meta[key] = value;
        }
      }

      const text = await res.text();
      let body: unknown;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = { raw: text };
      }

      return { body, meta, status: res.status };
    } finally {
      clearTimeout(timer);
    }
  }

  private buildUrl(path: string, params: Record<string, unknown>): string {
    const trimmed = path.replace(/^\/+/, '');
    const url = new URL(`${this.baseUrl.replace(/\/+$/, '')}/${trimmed}`);
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null || v === '') continue;
      url.searchParams.append(k, String(v));
    }
    return url.toString();
  }

  private backoff(attempt: number): number {
    // attempt 从 0 开始：500ms, 1000ms, 2000ms ...
    return this.retryBackoffMs * Math.pow(2, attempt);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  private formatError(err: unknown): string {
    if (err instanceof Error) {
      if (err.name === 'AbortError') return `Request timed out after ${this.timeoutMs}ms`;
      return err.message;
    }
    return String(err);
  }
}

export class NetworkError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'NetworkError';
  }
}
