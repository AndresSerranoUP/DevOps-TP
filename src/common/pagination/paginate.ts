import { PageQueryDto } from './page-query.dto';
import { PageResult } from './page-result';
import { UrlBuilder } from './url-builder';

export async function paginate<T>(
  countFn: () => Promise<number>,
  itemsFn: (offset: number, limit: number) => Promise<T[]>,
  query: Partial<PageQueryDto>,
  baseUrl?: string,
): Promise<PageResult<T>> {
  const page = Math.max(1, query.page || 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize || 12));
  const offset = (page - 1) * pageSize;

  const [total, items] = await Promise.all([
    countFn(),
    itemsFn(offset, pageSize),
  ]);

  const totalPages = Math.ceil(total / pageSize);
  const nextPageUrl = baseUrl && page < totalPages ? UrlBuilder.buildPageUrl(baseUrl, page + 1, pageSize) : null;
  const previousPageUrl = baseUrl && page > 1 ? UrlBuilder.buildPageUrl(baseUrl, page - 1, pageSize) : null;

  return new PageResult<T>({
    pageNumber: page,
    pageSize: items.length,
    totalNumberOfPages: totalPages,
    totalNumberOfRecords: total,
    results: items,
    nextPageUrl,
    previousPageUrl,
  });
}
