export class UrlBuilder {
  static buildPageUrl(baseUrl: string, page: number, pageSize: number, extraParams?: Record<string, unknown>): string {
    const isAbsolute = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(baseUrl);
    const url = new URL(baseUrl, 'http://localhost');
    url.searchParams.set('page', String(page));
    url.searchParams.set('pageSize', String(pageSize));
    if (extraParams) {
      for (const [k, v] of Object.entries(extraParams)) {
        if (v !== undefined && v !== null) {
          url.searchParams.set(k, String(v));
        }
      }
    }
    return isAbsolute ? url.toString() : url.pathname + url.search;
  }
}
