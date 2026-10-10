export class PageResult<T> {
  pageNumber: number;
  pageSize: number;
  totalNumberOfPages: number;
  totalNumberOfRecords: number;
  results: T[];
  nextPageUrl?: string | null;
  previousPageUrl?: string | null;

  constructor(data: {
    pageNumber: number;
    pageSize: number;
    totalNumberOfPages: number;
    totalNumberOfRecords: number;
    results: T[];
    nextPageUrl?: string | null;
    previousPageUrl?: string | null;
  }) {
    this.pageNumber = data.pageNumber;
    this.pageSize = data.pageSize;
    this.totalNumberOfPages = data.totalNumberOfPages;
    this.totalNumberOfRecords = data.totalNumberOfRecords;
    this.results = data.results;
    this.nextPageUrl = data.nextPageUrl ?? null;
    this.previousPageUrl = data.previousPageUrl ?? null;
  }

  toJSON() {
    return {
      pageNumber: this.pageNumber,
      pageSize: this.pageSize,
      totalNumberOfPages: this.totalNumberOfPages,
      totalNumberOfRecords: this.totalNumberOfRecords,
      results: this.results,
      ...(this.nextPageUrl ? { nextPageUrl: this.nextPageUrl } : {}),
      ...(this.previousPageUrl ? { previousPageUrl: this.previousPageUrl } : {}),
    };
  }
}
