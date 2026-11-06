/**
 * File: transaction.component.ts
 * Description: Componente Angular para gestionar y mostrar transacciones del sistema.
 *              Permite:
 *                - Visualizar transacciones con DynamicTableComponent.
 *                - Aplicar filtros por fecha, categoría, proveedor, cliente, estados, servicios, num de recibo y num de suministro.
 *                - Paginación con Angular Material Paginator.
 *                - Exportación de datos en formatos XLSX o CSV.
 *                - Abrir dialog de cambio estado de transacción.
 *                - Abrir dialog de visualizacion de logs.
 */

import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { PageEvent } from '@angular/material/paginator';
import { MatDialog } from '@angular/material/dialog';
import { FormBuilder, FormGroup } from '@angular/forms';

import { expand, filter, EMPTY, scan, startWith, lastValueFrom, finalize, map, takeUntil } from 'rxjs';
import { forkJoin, Subject } from 'rxjs';

import { environment } from 'src/environments/environment';

import { MytoastrService } from 'src/app/services/mytoastr';
import { MasterService } from 'src/app/services/master.service';
import { PersonService } from 'src/app/services/person.service';
import { DateService } from 'src/app/services/date.service';
import { ServicesService } from 'src/app/services/services.service';
import { TransactionService } from 'src/app/services/transaction.service';
import { SpinnerService } from 'src/app/services/spinner.service';

import { DynamicTableComponent } from 'src/app/components/library/dynamic-table/dynamic-table.component';
import { PaginationUtils } from 'src/app/utilities/pagination-utils';

import { ComponentType } from 'ngx-toastr';
import { DialogTransactionStatusComponent } from 'src/app/dialogs/dialog-transaction-status/dialog-transaction-status.component';
import { DialogTransactionLogsComponent } from 'src/app/dialogs/dialog-transaction-logs/dialog-transaction-logs.component';
import { DialogTransactionReprocessComponent } from 'src/app/dialogs/dialog-transaction-reprocess/dialog-transaction-reprocess.component';
@Component({
  selector: 'app-transaction',
  templateUrl: './transaction.component.html',
  styleUrls: ['./transaction.component.scss']
})
export class TransactionComponent implements OnInit, OnDestroy {

  private readonly destroy$ = new Subject<void>();

  private readonly pagUtils: PaginationUtils;
  public listRecWhitAgents = environment.LIST_CLIENT_WHIT_AGENTS
  public columns: any[] = [
    { name: 'Recaudador', attribute: 'client' },
    { name: 'Distribuidor', attribute: 'dealer' },
    { name: 'Agente', attribute: 'agent' },
    { name: 'Proveedor', attribute: 'provider' },
    { name: 'Servicio', attribute: 'service' },
    { name: 'Negocio', attribute: 'und_serv' },
    { name: 'N° Suministro', attribute: 'supply' },
    { name: 'N° Recibo', attribute: 'concep' },
    { name: 'Titular', attribute: 'bill' },
    { name: 'Monto', attribute: 'amountTransaction' },
    { name: 'ID OP. Multiple', attribute: 'id_operacion_detalle' },
    {
      name: 'Fecha',
      attribute: 'date',
      config: { formatDate: { format: 'dd/MM/yyyy hh:mm:ss a', locale: 'en-US' } }
    },
    { name: 'Cod. Respuesta', attribute: 'reference' },
    { name: 'Est. Conciliacion', attribute: 'statusConc' },
    {
      name: 'Est. Transaccion',
      attribute: 'status',
      config: { renderIcon: true },
    },
    {
      name: 'Accion',
      attribute: '',
      config: {
        type: 'buttonicons',
        restriccPermission: true,
        actions: [
          { bgClass: 'yellow', toolTip: 'Editar', icon: 'edit', value: 'edit', permission: 'transaction-edit' },
          { bgClass: 'gray', toolTip: 'Ver Logs', icon: 'visibility', value: 'view_logs', permission: 'transactions-logs' },
          { bgClass: 'blue', toolTip: 'Reprocesar', icon: 'refresh', value: 'reprocess', permission: 'transactions-reprocess' },
        ],
      },
    },
  ];

  public dataTransaction: any[] = [];

  public pageSize: any = 5;
  public pageKey: any;
  public functionDataCurrent!: ((pageSize: any) => any);
  public formDate!: FormGroup<any>;
  public masterStatus: any;
  public masterStatusConc: any;
  public entityTypes: any[] = [];
  public count: any = -1;
  public page: any = 1;
  public amountTransaction: any = -1;
  public lastPageEvent!: PageEvent;

  public filteredDealers: DealersItem[] = [];
  public allDealers: DealersItem[] = [];
  public dealerFilter = '';

  public filteredAgents: AgentsItem[] = [];
  public agentsByDealer: AgentsItem[] = [];
  public allAgents: AgentsItem[] = [];
  public agentFilter = '';

  public filteredServices: ServiceItem[] = [];
  public allServices: ServiceItem[] = [];
  public serviceFilter = '';

  public categoryTypes: any[] = [];
  public listProviders: any[] = [];

  public listServicesSelected: ServiceItem[] = [];
  public listUndServicesElectrocentro: any[] = [];
  public listUndServicesElectrocentro2: any[] = [];

  public selectedCategory: boolean = false;
  public selectedDealer: boolean = false;

  public select_electrocentro: boolean = false;
  public start!: Date;
  public end!: Date;

  @ViewChild(DynamicTableComponent) dynamic!: DynamicTableComponent;

  constructor(
    private readonly spinner: SpinnerService,
    private readonly transactionService: TransactionService,
    private readonly fb: FormBuilder,
    private readonly mytoastr: MytoastrService,
    private readonly masterService: MasterService,
    private readonly personService: PersonService,
    private readonly dateService: DateService,
    private readonly serviceServ: ServicesService,
    public dialog: MatDialog,
  ) {
    this.pagUtils = new PaginationUtils();
  }

  ngOnInit(): void {
    this.initializeAsync();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private async initializeAsync(): Promise<void> {
    this.initialForm();
    try {
      await this.listData();
      this.functionDataCurrent = this.getDataTransaction.bind(this);
      this.functionDataCurrent(this.pageSize);
    } catch (error) {
      console.error('Error al cargar datos iniciales:', error);
    }
  }

  initialForm(): void {
    this.start = new Date();
    this.start.setHours(0, 0, 0, 0);
    this.end = new Date();
    this.end.setHours(23, 59, 59, 999);

    this.formDate = this.fb.group({
      dateStart: [this.start],
      dateEnd: [this.end],
      entity: [''],
      provider: [''],
      category: [''],
      idService: [''],
      statusConc: [''],
      numDoc: [''],
      supply: [''],
      status: [''],
      idAgent: [''],
      idDealer: [''],
      id_operacion_detalle: [''],
      und_service: [''],
    });
  }

  clickButton({ value, element }: { value: string; element: any }): void {
    switch (value) {
      case 'edit': this.openDialog(element, DialogTransactionStatusComponent, '600px'); break;
      case 'view_logs': this.openDialog(element, DialogTransactionLogsComponent, '800px'); break;
      case 'reprocess': this.openDialog(element, DialogTransactionReprocessComponent, '800px'); break;
    }
  }

  selectDealer({ value }: { value: any }) {
    this.selectedDealer = !!value
    if (value) {
      this.agentsByDealer = this.allAgents.filter(agent => agent.dealer_id == value)
      this.filteredAgents = this.agentsByDealer
    }
  }

  onServicesChange(event: any): void {
    const selectedIds: string[] = event.value;
    const idsCategoriaActual = new Set(this.allServices.map(s => s.id));
    const selectedObjects = this.allServices.filter(s => selectedIds.includes(s.id)).map(({ id, name }) => ({ id, name }));
    const filteredPrev = this.listServicesSelected.filter(item => !idsCategoriaActual.has(item.id));
    this.listServicesSelected = [...filteredPrev, ...selectedObjects].filter((item, index, self) => index === self.findIndex(t => t.id === item.id));

    this.formDate.get('idService')?.setValue(this.listServicesSelected.map(s => s.id));

    const undServiceControl = this.formDate.get('und_service')!;
    console.log('listServicesSelected',this.listServicesSelected)
    const isElectrocentro = this.listServicesSelected.some(s => (s.id === 'SAC0000011' || s.name === 'ENOSA'));//ENOSA: SAC0002388(DESA) SAC0000156(PROD)
    if (isElectrocentro) { //AQUI HABILITAR SI ES ELECTROCENTRO O ENOSA
      this.select_electrocentro = true;
    } else {
      this.select_electrocentro = false;
      undServiceControl.reset();
    }

    //AQUI FILTRAR SOLO LA UNIDAD QUE LE CORRESPONDA SEGUN EL SERVICIO SELECCIONADO
    const isEnosaSelected = this.listServicesSelected.some(
      service => service.name === 'ENOSA'
    );

    const isElectrocentroSelected = this.listServicesSelected.some(
      service => service.name === 'ELECTROCENTRO'
    );

    if (isEnosaSelected && isElectrocentroSelected) {
      // Ambos servicios seleccionados: mostrar todos
      this.listUndServicesElectrocentro2 = this.listUndServicesElectrocentro;

    } else if (isEnosaSelected) {
      // Solo ENOSA
      this.listUndServicesElectrocentro2 = this.listUndServicesElectrocentro.filter(
        item => item.service === 'ENOSA'
      );

    } else if (isElectrocentroSelected) {
      // Solo ELECTROCENTRO
      this.listUndServicesElectrocentro2 = this.listUndServicesElectrocentro.filter(
        item => item.service !== 'ENOSA'
      );
    }

  }

  async cargarServicios(): Promise<void> {
    try {
      this.spinner.spinnerOnOff();
      const allServices = await lastValueFrom(
        this.loadAllServices().pipe(
          filter((items: any) => items.length > 0),
          finalize(() => this.spinner.spinnerOnOff()),
        )
      );
      this.allServices = allServices;
      this.filteredServices = allServices;
      this.serviceFilter = '';
      this.filterServices();
    } catch (error) {
      console.error('❌ Error al cargar servicios:', error);
      this.filteredServices = [];
      this.mytoastr.showError('', 'No tiene Servicios');
    }
  }

  async selectCategory(): Promise<void> {
    // reset SIEMPRE
    this.listServicesSelected = [];
    this.formDate.get('idService')?.setValue([]);
    this.formDate.get('und_service')?.reset();
    this.select_electrocentro = false;

    if (!this.category) {
      this.selectedCategory = false;
      this.filteredServices = [];
      return;
    }

    this.selectedCategory = true;
    await this.cargarServicios();
  }
  getDataTransaction(pageSize?: any): void {
    this.spinner.spinnerOnOff();
    this.resetUser(this.getDataTransaction);

    const filters = this.buildTransactionFilters();

    this.transactionService.getTransaction(filters, pageSize, this.page, this.count, this.amountTransaction)
      .pipe(takeUntil(this.destroy$))   // ── OPTIMIZACIÓN 1: evita callbacks tras destruir el componente
      .subscribe({
        next: (value: any) => {
          if (value.error === 'Unauthorized: Invalid or expired token.') this.mytoastr.showWarning('Vuelve a iniciar Sesion', '');

          if (value.statusCode === 201 || value.data.type === 'ERROR') {
            this.amountTransaction = 0;
            if (value.statusCode === 201) this.mytoastr.showWarning(value.data.messages || 'No se encontraron transacciones', '');
            if (value.data.type === 'ERROR') this.mytoastr.showError('Ha ocurrido un error ', '');
            return;
          }

          const updatedItems = value.data.Items.map((item: any) => this.enrichTransactionItem(item));
          this.dataTransaction = [...this.dataTransaction, ...updatedItems];
          this.pageKey = value.data.hasMore;
          if (value.data.count != 0) this.count = value.data.count;
          if (value.data.totalAmount != 0) this.amountTransaction = Number.parseFloat(value.data.totalAmount).toFixed(2);
        },
        error: () => this.spinner.spinnerOnOff(),
        complete: () => this.spinner.spinnerOnOff(),
      });

    this.functionDataCurrent = this.getDataTransaction;
  }

  private enrichTransactionItem(item: any): any {
    const undServi = this.listUndServicesElectrocentro2?.find((und: any) => String(und.id) === String(item.und_serv));
    const person = this.entityTypes.find((p: any) => p.servicePerson.idPerson === item.client);
    const provider = this.listProviders.find((p: any) => p.servicePerson.idPerson === item.provider);
    const agent = this.allAgents.find((p: AgentsItem) => p.retailer_id == item.id_retailer);
    const dealer = this.allDealers.find((p: DealersItem) => p.dealerId == agent?.dealer_id);
    return {
      ...item,
      und_serv: undServi ? undServi.name : item.und_serv,
      client: person ? person.servicePerson.nameAlias : item.client,
      provider: provider ? provider.servicePerson.nameAlias : item.provider,
      dealer: dealer ? dealer.nComercial : "-",
      agent: agent ? agent.retailer_businessName : item.id_retailer,
    };
  }

  private buildTransactionFilters(): Record<string, any> {
    return this.removeUndefined({
      idclient: this.entity || undefined,
      idprovider: this.provider || undefined,
      status: this.status || undefined,
      dateStart: this.dateService.formatStartDate(this.dateStart).replace(/\//g, '') || undefined,
      dateEnd: this.dateService.formatEndDate(this.dateEnd).replace(/\//g, '') || undefined,
      idundServ: this.id_und_service || undefined,
      statusConc: this.statusConc || undefined,
      numDoc: this.numDoc || undefined,
      dealer: this.dealer || undefined,
      agent: this.agent || undefined,
      id_operacion_detalle: this.id_operacion_detalle || undefined,
      supply: this.supply || undefined,
      ...(this.listServicesSelected.length > 0 && { idService: this.listServicesSelected.map(s => s.id) }),
    });
  }

  private removeUndefined(obj: Record<string, any>): Record<string, any> { return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)); }

  resetUser(current: any): void { this.pagUtils.resetIfChanged(current, this.functionDataCurrent, this.clearData.bind(this)); }

  clearData(): void {
    this.pageKey = undefined;
    this.dataTransaction = [];
    this.count = -1;
    this.page = 1;
    this.amountTransaction = -1;
    this.allServices = [];
  }

  clearFilter(): void {
    this.serviceFilter = '';
    this.filteredServices = [];
    this.selectedCategory = false;
    this.selectedDealer = false;
    this.select_electrocentro = false
    this.listServicesSelected = [];
  }

  reload(): void {
    this.clearData();
    this.dynamic.clearSelection();
    this.functionDataCurrent(this.pageSize);
  }

  clearSelectionOnly(): void {
    this.dataTransaction = [];
  }

  onPageChange(event: PageEvent): void {
    this.lastPageEvent = event;
    this.pageSize = this.pagUtils.updatePageSize(event.pageSize, this.pageSize);
    this.page++;
    this.pagUtils.onPageChange(event, this.pageSize, this.functionDataCurrent.bind(this), this.pageKey);
  }

  openDialog(data: any, dialog: ComponentType<unknown>, width: string): void {
    const dialogRef = this.dialog.open(dialog, {
      width,
      data: {
        concep: data.concep,
        reference: data.reference,
        supply: data.supply,
        amount: data.amountTransaction,
        statusTrans: data.status,
        pk: data.id_transaction,
        sk: data.sk,
        masterStatus: this.masterStatus,
        masterStatusCons: this.masterStatusConc,
      },
    });
    dialogRef.afterClosed().pipe(takeUntil(this.destroy$)).subscribe(result => { if (result === true) this.reload(); });
  }

  private isEmptyForm(): boolean {
    const fields = ['dateStart', 'dateEnd', 'status', 'numDoc', 'supply', 'idService', 'entity', 'provider', 'statusConc', 'id_operacion_detalle', 'idDealer'];
    return fields.every(field => !this.formDate.get(field)?.value);
  }

  search(): void {
    if (this.isEmptyForm()) { this.mytoastr.showWarning('Seleccione un filtro', ''); return; }
    this.clearData();
    this.getDataTransaction(this.pageSize);
  }

  async listData(): Promise<void> {
    this.spinner.spinnerOnOff();
    try {
      const [
        masterStatus,
        provAndEntity,
        category,
        masterStatusCons,
        acashData
        //{ data: { dealers: { data: dealers }, agents: { data: agents } } }
      ] = await lastValueFrom(
        forkJoin([
          this.masterService.getItemsMasterTable('16'),
          this.personService.getPersonsPandR(),
          this.masterService.getItemsMasterTable('14'),
          this.masterService.getItemsMasterTable('17'),
          this.personService.getDataAcash()
        ])
      );

      this.listProviders = provAndEntity.data.providerTransform;
      this.entityTypes = provAndEntity.data.recaudadorTransform;

      const dluz = this.listProviders.find((p: any) => p.servicePerson.idPerson === `${environment.ID_PERSON_DLUZ}`);
      if (dluz && dluz.servicePerson.und_serv !== 'N/A'){
        try { 
          this.listUndServicesElectrocentro = JSON.parse(dluz.servicePerson.und_serv.replace(/\\/g, '')); 
        } catch { 
          this.listUndServicesElectrocentro = []; 
        }
      } else{
        this.listUndServicesElectrocentro = [];
      }
      this.listUndServicesElectrocentro2 = this.listUndServicesElectrocentro;
      console.log('this.listUndServicesElectrocentro',this.listUndServicesElectrocentro )

      try {

        this.filteredDealers = acashData.data.dealers.data;
        this.allDealers = acashData.data.dealers.data;

        this.allAgents = acashData.data.agents.data;
      } catch (error) {
        console.error('Error al cargar dealers y agents:', error);
      }

      this.masterStatusConc = masterStatusCons.sort((a: any, b: any) => a.master_order - b.master_order);
      this.masterStatus = masterStatus.sort((a: any, b: any) => a.master_order - b.master_order);
      this.categoryTypes = category;

    } catch (error) {
      console.error('Error loading master table data:', error);
      throw error;
    } finally { this.spinner.spinnerOnOff(); }
  }

  loadAllServices() {
    return this.serviceServ.getServicesPageKey(this.category, 'HABILITADO').pipe(
      expand(response => response?.data?.nextPageKey ? this.serviceServ.getServicesPageKey(this.category, 'HABILITADO', response.data.nextPageKey) : EMPTY),
      map(response => response?.data?.Items ?? []),
      scan((acc, items) => acc.concat(items), []),
      startWith([]),
    );
  }

  clearSearch(): void {

    this.formDate.patchValue({
      dateEnd: this.end,
      dateStart: this.start,
      status: '',
      category: '',
      entity: '',
      provider: '',
      idService: '',
      statusConc: '',
      id_operacion_detalle: '',
      numDoc: '',
      supply: '',
      idDealer: '',
      idAgent: '',
      und_service: '',
    });
    this.clearData();
    this.clearFilter();
    this.getDataTransaction(this.pageSize);
  }

  filterServices(): void {
    const value = this.serviceFilter?.toLowerCase() ?? '';
    this.filteredServices = this.allServices.filter(s => s.name.toLowerCase().includes(value));
  }

  filterDealers(): void {
    const value = this.dealerFilter?.toLowerCase() ?? '';
    this.filteredDealers = this.allDealers.filter(d => d.nComercial.toLowerCase().includes(value));
  }

  filterAgents(): void {
    const value = this.agentFilter?.toLowerCase() ?? '';
    this.filteredAgents = this.agentsByDealer.filter(d => d.retailer_businessName.toLowerCase().includes(value));
  }

  exportDataViaAPI(fileType: 'xlsx' | 'csv'): void {
    this.spinner.spinnerOnOff();

    const exportFilters = this.removeUndefined({
      dateStart: this.dateStart ? `${this.dateService.formatTrayDate(this.dateStart).replace(/\//g, '-')} 00:00:00` : undefined,
      dateEnd: this.dateEnd ? `${this.dateService.formatTrayDate(this.dateEnd).replace(/\//g, '-')} 23:59:59` : undefined,
      status: this.status || undefined,
      statusConc: this.statusConc !== '-' ? this.statusConc : undefined,
      idprovider: this.provider || undefined,
      id_operacion_detalle: this.id_operacion_detalle || undefined,
      idclient: this.entity || undefined,
      dealer: this.dealer || undefined,
      agent: this.agent || undefined,
      concept: this.numDoc || undefined,
      supply: this.supply || undefined,
      ...(this.listServicesSelected.length > 0 && { idService: this.listServicesSelected.map(s => s.id) }),
    });

    const token = localStorage.getItem('fcmToken') ?? '';
    this.transactionService.exportTransactions(fileType, exportFilters, 'tr', token)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.spinner.spinnerOnOff();
          if (response.statusCode === 200) this.mytoastr.showWarningTime('', 'Procesando Archivo...', 1000);
          else this.mytoastr.showError('', 'Error al enviar la solicitud');
        },
        error: (error) => {
          this.spinner.spinnerOnOff();
          console.error('Error durante la exportación:', error);
          this.mytoastr.showError('Error durante la exportación', '');
        },
      });
  }

  get id_operacion_detalle(): any { return this.formDate?.get('id_operacion_detalle')?.value; }
  get dealer(): any { return this.formDate?.get('idDealer')?.value; }
  get agent(): any { return this.formDate?.get('idAgent')?.value; }
  get dateStart(): any { return this.formDate?.get('dateStart')?.value; }
  get dateEnd(): any { return this.formDate?.get('dateEnd')?.value; }
  get numDoc(): any { return this.formDate?.get('numDoc')?.value; }
  get supply(): any { return this.formDate?.get('supply')?.value; }
  get id_und_service(): any { return this.formDate?.get('und_service')?.value; }
  get status(): any { return this.formDate?.get('status')?.value; }
  get entity(): any { return this.formDate?.get('entity')?.value; }
  get provider(): any { return this.formDate?.get('provider')?.value; }
  get idService(): any[] { return this.listServicesSelected; }
  get category(): any { return this.formDate?.get('category')?.value; }
  get statusConc(): any { return this.formDate?.get('statusConc')?.value; }
  get servicesNames(): string { return this.listServicesSelected.map(s => s.name).join(', '); }

  showAlarmSelectCategory(): void { if (!this.category) this.mytoastr.showError('Selecciona una Categoria Primero', ''); }
}

interface ServiceItem {
  id: string;
  name: string;
}

interface DealersItem {
  dealerId: string;
  nComercial: string;
}

interface AgentsItem {
  dealer_id: string;
  retailer_id: string;
  retailer_businessName: string;
}