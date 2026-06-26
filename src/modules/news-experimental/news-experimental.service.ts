import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
import { ExperimentalNewsItem } from './news-experimental.types';

@Injectable()
export class NewsExperimentalService {
  private static readonly sourceName = 'El Deber' as const;
  private static readonly primaryRssUrl = 'https://eldeber.com.bo/rss';
  private static readonly fallbackRssUrl = 'https://eldeber.com.bo/feed';

  private readonly parser = new XMLParser({
    ignoreAttributes: false,
    trimValues: true,
  });

  async getElDeberNews(): Promise<ExperimentalNewsItem[]> {
    let lastError: unknown;

    for (const url of [
      NewsExperimentalService.primaryRssUrl,
      NewsExperimentalService.fallbackRssUrl,
    ]) {
      try {
        const xml = await this.fetchRss(url);
        const items = this.parseRss(xml);
        if (items.length > 0) return items;
      } catch (error) {
        lastError = error;
      }
    }

    throw new ServiceUnavailableException({
      message: 'No se pudo leer el RSS de El Deber.',
      detail: lastError instanceof Error ? lastError.message : String(lastError),
    });
  }

  private async fetchRss(url: string): Promise<string> {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/rss+xml, application/xml, text/xml;q=0.9',
        'User-Agent': 'MAPIA experimental RSS reader',
      },
    });

    if (!response.ok) {
      throw new Error(`El RSS respondio con estado ${response.status}.`);
    }

    return response.text();
  }

  private parseRss(xml: string): ExperimentalNewsItem[] {
    const parsed = this.parser.parse(xml) as {
      rss?: { channel?: { item?: unknown } };
    };

    const rawItems = parsed.rss?.channel?.item;
    const items = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];

    return items
      .map((item) => this.toNewsItem(item))
      .filter((item): item is ExperimentalNewsItem => item !== null);
  }

  private toNewsItem(item: unknown): ExperimentalNewsItem | null {
    if (!this.isRecord(item)) return null;

    const title = this.asText(item.title);
    const url = this.asText(item.link);
    if (!title || !url) return null;

    const publishedAt = this.toIsoDate(this.asText(item.pubDate));
    const description = this.cleanDescription(this.asText(item.description));

    return {
      title,
      source: NewsExperimentalService.sourceName,
      url,
      ...(publishedAt ? { publishedAt } : {}),
      ...(description ? { description } : {}),
    };
  }

  private asText(value: unknown): string | undefined {
    if (typeof value === 'string') return value.trim() || undefined;
    if (typeof value === 'number') return String(value);
    if (this.isRecord(value) && typeof value['#text'] === 'string') {
      return value['#text'].trim() || undefined;
    }
    return undefined;
  }

  private toIsoDate(value: string | undefined): string | undefined {
    if (!value) return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }

  private cleanDescription(value: string | undefined): string | undefined {
    if (!value) return undefined;
    const text = value
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return text || undefined;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }
}
