import { Injectable, Module } from "@nestjs/common";

export interface ArticleRecord { id: string; code: string; name: string }

/**
 * Core's public service API: plain providers, no resolvers. Other modules import this Nest module
 * and call it in process for queries and commands. They never read core's tables.
 */
@Injectable()
export class ArticleService {
  readonly rows: ArticleRecord[] = [
    { id: "a1", code: "TT-100", name: "Table top" },
    { id: "a2", code: "LG-200", name: "Leg" },
  ];
  async byIds(ids: readonly string[]): Promise<(ArticleRecord | null)[]> {
    return ids.map((id) => this.rows.find((r) => r.id === id) ?? null);
  }
  async exists(id: string): Promise<boolean> {
    return this.rows.some((r) => r.id === id);
  }
}

@Module({ providers: [ArticleService], exports: [ArticleService] })
export class CoreApiModule {}
