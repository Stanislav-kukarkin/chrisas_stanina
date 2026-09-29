import {
  ProductionCalendarApiError,
  type ProductionCalendarApi,
  type ProductionCalendarApiResponse,
} from './production-calendar.api';

export interface HttpProductionCalendarApiOptions {
  baseUrl?: string;
  token: string;
  fetchFn?: typeof fetch;
}

export class HttpProductionCalendarApi implements ProductionCalendarApi {
  private baseUrl: string;
  private token: string;
  private fetchFn: typeof fetch;

  constructor(options: HttpProductionCalendarApiOptions) {
    this.baseUrl = options.baseUrl ?? 'https://production-calendar.ru/v2';
    this.token = options.token;
    this.fetchFn = options.fetchFn ?? fetch;
  }

  async fetchCalendar(year: number, country = 'ru'): Promise<ProductionCalendarApiResponse> {
    const url = `${this.baseUrl}/${country}/${year}/days?week_type=5`;
    const response = await this.fetchFn(url, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new ProductionCalendarApiError(response.status);
    }

    return (await response.json()) as ProductionCalendarApiResponse;
  }
}
