
import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class TransactionService {

  private url = `${environment.URL_API_GATEWAY}`;
  //private url = `${environment.URL_API_LOCAL}`;

  constructor(
    private httpClient: HttpClient,
  ) { }

  getTransaction(idclient?: string, idprovider?: string, status?: string, dateStart?: any, dateEnd?: any, idService?: string, limit?: any, page?: any, numDoc?: string, count?: any,  totalAmount?: any, supply?: any): Observable<any> {
    let params = new HttpParams();

    console.log("idservicio: ", idService)

    if (numDoc !== undefined) {
      params = params.set('concept', numDoc);
    }

    if (idclient !== undefined) {
      params = params.set('idclient', idclient);
    }

    if (supply !== undefined) {
      params = params.set('supply', supply);
    }
    if (idprovider !== undefined) {
      params = params.set('idprovider', idprovider);
    }

    if (status !== undefined) {
      params = params.set('status', status);
    }

    if (dateStart !== undefined && dateStart !== null) {
      params = params.set('dateStart', dateStart);
    }
    if (dateEnd !== undefined && dateEnd !== null) {
      params = params.set('dateEnd', dateEnd);
    }

    if (idService !== undefined) {
      params = params.set('idService', idService);
    }

    if (limit !== undefined) {
      params = params.set('limit', limit);
    }

    if (page !== undefined) {
      params = params.set('page', page);
    }
    if (Number(count) >= 0) {
      params = params.set('count', Number(count));
    }
    if (Number(totalAmount) >= 0) {
      params = params.set('totalAmount', Number(totalAmount));
    }
    return this.httpClient.get(`${this.url}/transactions`, { params });
  }

  getBalance(limit?: any, page?: any, typeEntity?: any, entity?: any, typeAssign?: any, dateStart?: any, dateEnd?: any, count?: any): Observable<any> {
    let params = new HttpParams();
    if (typeEntity !== undefined) {
      params = params.set('typeEntity', typeEntity);
    }
    if (entity !== undefined) {
      params = params.set('entity', entity);
    }
    if (typeAssign !== undefined) {
      params = params.set('typeAssign', typeAssign);
    }
    if (dateStart !== undefined && dateStart !== null) {
      params = params.set('dateStart', dateStart);
    }
    if (dateEnd !== undefined && dateEnd !== null) {
      params = params.set('dateEnd', dateEnd);
    }
    if (limit !== undefined) {
      params = params.set('limit', limit);
    }
    if (page !== undefined) {
      params = params.set('page', page);
    }
    if (count >= 0) {
      params = params.set('count', Number(count));
    }
    return this.httpClient.get(`${this.url}/transactions/balances`, { params });
  }

  getCurrentBalances(filters: any, limit?: any, page?: any, count?: any): Observable<any> {
    const extraParams = {
      limit,
      page,
      count: count !== undefined ? Number(count) : undefined,
    }
    const params = this.buildTransactionParams(filters, extraParams);
    return this.httpClient.get(`${this.url}/transactions/current-balances`, { params });
  }

  getIdTransaction(id: string, limit?: any, pageKey?: any[]): Observable<any> {
    let params = new HttpParams();
    if (limit !== undefined) {
      params = params.set('limit', limit);
    }

    if (pageKey !== undefined) {
      params = params.set('pageKey', JSON.stringify(pageKey));
    }
    return this.httpClient.get(`${this.url}/transactions/${id}`, { params });
  }

  balanceVoucher(numberOperation: string) {
    let params = new HttpParams();
    params = params.set('numberOperation', numberOperation);
    return this.httpClient.get(`${this.url}/transactions/voucher`, { params });
  }
  
  /*
  //-----Exportar de archivos
  exportTransactions(
    format: 'xlsx' | 'csv',
    filters: any
  ): Observable<HttpResponse<string>> {
    const params = new HttpParams({
      fromObject: {
        ...filters,
        format: format
      }
    });
    return this.httpClient.get(`${this.url}/transactions/export`, {
      params,
      observe: 'response',
      responseType: 'text' // para manejar base64
    });
  }
 
exportTransactions(
  format: 'xlsx' | 'csv',
  filters: any
): Observable<HttpResponse<string | Blob>> {
  const params = new HttpParams({ fromObject: { ...filters, format } });
  const isLocal = this.url.includes('localhost');

  if (isLocal) {
    // ✅ En local: serverless transforma el base64 a blob directamente
    return this.httpClient.get(`${this.url}/transactions/export`, {
      params,
      observe: 'response',
      responseType: 'blob', // <--- tipo fijo
    }) as Observable<HttpResponse<Blob>>;
  } else {
    // ✅ En remoto: el backend devuelve base64 (string)
    return this.httpClient.get(`${this.url}/transactions/export`, {
      params,
      observe: 'response',
      responseType: 'text', // <--- tipo fijo
    }) as Observable<HttpResponse<string>>;
  }
}
 */
  exportTransactions(
    format: 'xlsx' | 'csv',
    filters: TransactionFilters,
    bandeja: string,
    token: string
  ): Observable<ExportResponse> {

    const extraParams: ExtraParams = {
      format,
      token,
      inbx: bandeja
    };

    const params = this.buildTransactionParams(filters, extraParams);
    return this.httpClient.get<ExportResponse>(`${this.url}/export`, { params });
  }

  private buildTransactionParams(
    filters: TransactionFilters,
    extraParams?: ExtraParams
  ): HttpParams {
    const baseEntries = Object.entries({
      concept: filters.numDoc ?? filters.concept,
      supply: filters.supply,
      idclient: filters.idclient,
      idprovider: filters.idprovider,
      status: filters.status,
      dateStart: filters.dateStart,
      dateEnd: filters.dateEnd,
      idService: filters.idService,
      typeEntity: filters.typeEntity,
      entity: filters.entity,
      typeAssign: filters.typeAssign,
      idundServ: filters.idundServ,
    });

    const combined = [
      ...baseEntries,
      ...(extraParams ? Object.entries(extraParams) : []),
    ].filter(([, value]) => value !== undefined && value !== null && value !== '' && value !== -1);

    return combined.reduce((p, [k, v]) => {
      if (v !== undefined && v !== null) {
        return p.set(k, String(v));
      }
      return p;
    }, new HttpParams());

  }

  updateTransactionStatus(data: any): Observable<any> {
    return this.httpClient.post<any>(`${this.url}/transactions/status`, data);
  }
}

interface TransactionFilters {
  concept?: string;
  numDoc?: string;
  supply?: string;
  idclient?: string;
  idprovider?: string;
  status?: string;
  dateStart?: string;
  dateEnd?: string;
  idService?: string[];
  idundServ?: string;
  typeEntity?: string;
  entity?: string;
  typeAssign?: string;
}

interface ExtraParams {
  [key: string]: string | number | undefined;
}

interface ExportResponse {
  statusCode: number;
  message?: string;
}

