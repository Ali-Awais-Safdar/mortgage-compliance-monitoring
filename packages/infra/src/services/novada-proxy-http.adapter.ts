import type { ApiRequestDTO } from "@poc/core";
import { FetchHttpAdapter } from "./fetch-http.adapter";

export interface NovadaProxyConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  country?: string;
  state?: string;
  city?: string;
  asn?: string;
}

const DEFAULT_PROXIED_HOSTS = ["airbnb.com"];

// Bun-specific Novada HTTP adapter that uses Bun's `proxy` option on fetch
export class NovadaProxyHttpAdapter extends FetchHttpAdapter {
  private readonly proxyUrl: string;

  constructor(
    config: NovadaProxyConfig,
    private readonly proxiedHosts: string[] = DEFAULT_PROXIED_HOSTS
  ) {
    super();
    this.proxyUrl = NovadaProxyHttpAdapter.buildProxyUrl(config);
  }

  private static buildProxyUrl(config: NovadaProxyConfig): string {
    const host = config.host.replace(/^https?:\/\//, "").trim();
    if (!host) {
      throw new Error("Novada proxy host cannot be empty");
    }
    const username = NovadaProxyHttpAdapter.buildUsername(config);
    const encodedUsername = encodeURIComponent(username);
    const encodedPassword = encodeURIComponent(config.password);
    return `http://${encodedUsername}:${encodedPassword}@${host}:${config.port}`;
  }

  private static buildUsername(config: NovadaProxyConfig): string {
    const parts: string[] = [config.username.trim()];
    if (config.country) parts.push(`region-${config.country}`);
    if (config.state) parts.push(`st-${config.state}`);
    if (config.city) parts.push(`city-${config.city}`);
    if (config.asn) parts.push(`asn-${config.asn}`);
    return parts.filter(Boolean).join("-");
  }

  protected shouldUseProxyFor(url: URL, _input?: ApiRequestDTO): boolean {
    const hostname = url.hostname.toLowerCase();
    return this.proxiedHosts.some((hostPattern) => {
      const normalized = hostPattern.toLowerCase();
      return hostname === normalized || hostname.endsWith(`.${normalized}`);
    });
  }

  protected override async doFetch(url: URL, init: RequestInit): Promise<Response> {
    if (!this.shouldUseProxyFor(url)) {
      return super.doFetch(url, init);
    }

    // Bun's fetch supports a `proxy` option on RequestInit; use the prebuilt proxy URL
    const proxiedInit = {
      ...init,
      proxy: this.proxyUrl,
    } as RequestInit & { proxy?: string };

    return super.doFetch(url, proxiedInit as RequestInit);
  }
}

