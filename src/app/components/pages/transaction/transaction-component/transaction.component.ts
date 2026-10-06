import { TransactionService } from '../../../../services/transaction.service';
import { Component, OnInit, ViewChild } from '@angular/core';
import { DynamicTableComponent } from '../../../library/dynamic-table/dynamic-table.component';
import { PaginationUtils } from 'src/app/utilities/pagination-utils';
import { PageEvent } from '@angular/material/paginator';
import { SpinnerService } from 'src/app/services/spinner.service';
import { DialogTransactionStatusComponent } from 'src/app/dialogs/dialog-transaction-status/dialog-transaction-status.component';
import { MatDialog } from '@angular/material/dialog';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MytoastrService } from 'src/app/services/mytoastr';
import { forkJoin } from 'rxjs/internal/observable/forkJoin';
import { MasterService } from 'src/app/services/master.service';
import { PersonService } from 'src/app/services/person.service';
import { DateService } from 'src/app/services/date.service';
import { ServicesService } from 'src/app/services/services.service';

@Component({
  selector: 'app-transaction',
  templateUrl: './transaction.component.html',
  styleUrls: ['./transaction.component.scss']
})
export class TransactionComponent implements OnInit {

  private readonly pagUtils: PaginationUtils | undefined;

  public columns: any[] = [
    { 'name': 'Recaudador', 'attribute': 'client' },
    { 'name': 'Proveedor', 'attribute': 'provider' },
    { 'name': 'Servicio', 'attribute': 'serviceName' },
    { 'name': 'Suministro', 'attribute': 'supply' },
    { 'name': 'N°. Recibo', 'attribute': 'concep' },
    { 'name': 'Titular', 'attribute': 'bill' },
    { 'name': 'Monto', 'attribute': 'amountTransaction' },
    // { 'name': 'Moneda', 'attribute': 'currency'},
    {
      'name': 'Fecha', 'attribute': 'date', 'config': {
        'formatDate': { format: 'dd/MM/yyyy hh:mm:ss a', locale: 'en-US' },
      }
    },
    { 'name': 'Cod. Respuesta', 'attribute': 'reference' },
    //{ 'name': 'Estado', 'attribute': 'status', 'config': { 'styleClass': true }},
    {
      'name': 'Est. Transaccion',
      'attribute': 'status',
      'config': { 'renderIcon': true, 'icon': 'iconStatus', 'coloricon': 'colorStatus' }
    },
    {
      'name': 'Accion',
      'attribute': '',
      'config': {
        'type': 'buttonicons',
        restriccPermission: true,
        'actions': [
          {
            bgClass: 'yellow',
            toolTip: 'Editar',
            icon: 'edit',
            value: 'edit',
            permission: 'transaction-edit'
          },
        ]
      }
    },
  ];
  public dataTransaction: any[] = [];

  public pageSize: any = 5;
  public pageKey: any;
  public disabledEditOption: any
  public functionDataCurrent!: ((pageSize: any) => any);
  public formOperation!: FormGroup<any>;
  public formDate!: FormGroup<any>;
  public transaction: any;
  public respSearch: any;
  public masterStatus: any;
  public entityTypes: any[] = [];
  public count: any = -1;
  public page: any = 1;
  public amountTransaction: any = -1;
  public listProviders: any[] = [];
  public services: any;
  public masterStatusCons: any;
  @ViewChild(DynamicTableComponent) dynamic!: DynamicTableComponent;
  public start!: Date;
  public end!: Date;

  constructor(
    private readonly spinner: SpinnerService,
    private readonly transactionService: TransactionService,
    private readonly fb: FormBuilder,
    private readonly mytoastr: MytoastrService,
    private readonly masterService: MasterService,
    private readonly personService: PersonService,
    private readonly dateService: DateService,
    private readonly serviceServ: ServicesService,
    public dialog: MatDialog,) {
    this.pagUtils = new PaginationUtils();
  }

  ngOnInit(): void {
    this.initializeAsync();
  }

  private async initializeAsync(): Promise<void> {
    this.initialForm();
    try {
      await this.listData(); // Espera a que listData termine
      this.functionDataCurrent = this.getDataTransaction.bind(this);
      this.functionDataCurrent(this.pageSize); // Ahora sí puedes llamar esto después
    } catch (error) {
      console.error("Error al cargar datos iniciales:", error);
    }
  }

  initialForm() {
    this.formOperation = this.fb.group({
      numOperation: ['', Validators.required],
    });
    this.start = new Date();
    this.start.setHours(0, 0, 0, 0);
    this.end = new Date();
    this.end.setHours(23, 59, 59, 999);
    this.formDate = this.fb.group({
      dateStart: [this.start],
      dateEnd: [this.end],
      entity: [''],
      idService: [''],
      supply: [''],
      numDoc: [''],
      status: [''],
      provider: [''],
    });
  }

  getDataTransaction(pageSize?: any) {
    this.spinner.spinnerOnOff();
    this.resetUser(this.getDataTransaction)
    let entity = this.entity || undefined;
    let status = this.status || undefined;
    let idServ = this.idService || undefined;
    let supply = this.supply || undefined;
    let numDoc = this.numDoc || undefined;
    let dateStart = this.dateService.formatStartDate(this.dateStart).replace(/\//g, '') || undefined;
    let dateEnd = this.dateService.formatEndDate(this.dateEnd).replace(/\//g, '') || undefined
    let provider = this.provider || undefined;
    // return
    this.transactionService.getTransaction(entity, provider, status, dateStart, dateEnd, idServ?.toString(), pageSize, this.page, numDoc, this.count, 
     this.amountTransaction, supply).subscribe({
      next: (value: any) => {
        if (value.statusCode === 201) {
          this.amountTransaction = 0;
          this.mytoastr.showWarning(value.data.messages || 'No se encontraron transacciones', '');
          return
        }
        // Actualizar client con nameAlias
        const updatedItems = value.data.Items.map((item: any) => {
          const person = this.entityTypes.find((p: any) => p.servicePerson.idPerson === item.client);
          const provider = this.listProviders.find((p: any) => p.servicePerson.idPerson === item.provider);
          return {
            ...item,
            client: person ? person.servicePerson.nameAlias : item.client, // Asignar el nombre
            provider: provider ? provider.servicePerson.nameAlias : item.provider, // Asignar el nombre
          };
        });

        this.dataTransaction = [...this.dataTransaction, ...updatedItems];
        this.pageKey = value.data.hasMore;
        if (value.data.count != 0) this.count = value.data.count;
        if (value.data.totalAmount != 0) this.amountTransaction = Number.parseFloat(value.data.totalAmount).toFixed(2);
        console.log("DATA DE TRANSACTION: ", value.data)
      },
      error: (error: any) => {
        console.error('ERROR', error);
        this.spinner.spinnerOnOff();
      },
      complete: () => {
        this.spinner.spinnerOnOff();
      }
    })
    this.functionDataCurrent = this.getDataTransaction
  }

  resetUser(current: any) {
    this.pagUtils?.resetIfChanged(
      current,
      this.functionDataCurrent,
      this.clearData.bind(this)
    )
  }

  clearData() {
    this.pageKey = undefined;
    this.dataTransaction = [];
    this.count = -1;
    this.page = 1;
    this.amountTransaction = -1;
  }

  reload() {
    this.clearData();
    this.dynamic.clearSelection();
    this.functionDataCurrent(this.pageSize);
  }

  onPageChange(event: PageEvent) {
    console.log("keyyyyyy", this.pageKey)
    this.pageSize = this.pagUtils?.updatePageSize(event.pageSize, this.pageSize);
    this.page++;
    this.pagUtils?.onPageChange(event, this.pageSize, this.functionDataCurrent.bind(this), this.pageKey);
    console.log('Página cambiada', event);
  }

  clickButton(event: any) {
    console.log("event", event)
    const { value, element } = event
    if (value == "edit") {
      this.openDialog(element)
    }
  }

  openDialog(data: any): void {
    const dialogRef = this.dialog.open(DialogTransactionStatusComponent, {
      width: '600px',
      data: {
        concep: data.concep,
        statusTrans: data.status,
        id: data.id_transaction,
        sk: data.sk,
        masterStatus: this.masterStatus,
        masterStatusCons: this.masterStatusCons
      }
    });
    dialogRef.afterClosed().subscribe((result: any) => {
      console.log('The dialog was closed', result);
      if (result === true) {
        this.reload();
      }

    });
  }

  search() {
    console.log("formulario busqueda: ", this.formDate)
    if (this.formDate.get('dateEnd')?.value == '' &&
      this.formDate.get('status')?.value == '' &&
      this.formDate.get('supply')?.value == '' &&
      this.formDate.get('numDoc')?.value == '' &&
      this.formDate.get('idService')?.value == '' &&
      this.formDate.get('entity')?.value == '' &&
      this.formDate.get('provider')?.value == '') {
      this.mytoastr.showWarning("Seleccione un filtro", "")
      return
    }

    this.clearData();
    this.getDataTransaction(this.pageSize)
    // console.log("fecha buscar",this.formDate.get('date')?.value)
  }

  async listData(): Promise<void> {
    this.spinner.spinnerOnOff();
    return new Promise((resolve, reject) => {
      forkJoin([
        this.masterService.getItemsMasterTable('16'),
        this.personService.getPersonsPandR(),
        this.serviceServ.getServices(),
        this.masterService.getItemsMasterTable('17')
      ]).subscribe({
        next: (response) => {
          const [masterStatus, persons, service, masterStatusCons] = response;
          this.masterStatus = masterStatus.sort((a: any, b: any) => a.master_order - b.master_order);
          this.listProviders = persons?.data?.providerTransform;
          this.entityTypes = persons?.data?.recaudadorTransform;
          this.services = service.data.Items;
          this.masterStatusCons = masterStatusCons.sort((a: any, b: any) => a.master_order - b.master_order);
          this.spinner.spinnerOnOff();
          resolve(); //  Indica que terminó exitosamente
        },
        error: (error) => {
          this.spinner.spinnerOnOff();
          console.error("Error loading master table data:", error);
          reject(error); // Indica que falló
        }
      });
    });
  }

  clearSearch() {
    this.formDate.get('dateEnd')?.setValue(this.end)
    this.formDate.get('dateStart')?.setValue(this.start)
    this.formDate.get('status')?.setValue('')
    this.formDate.get('entity')?.setValue('')
    this.formDate.get('idService')?.setValue('')
    this.formDate.get('supply')?.setValue('')
    this.formDate.get('numDoc')?.setValue('')
    this.formDate.get('provider')?.setValue('')
    //limpiar tabla de transacciones
    this.clearData();
    this.getDataTransaction(this.pageSize)
  }

  get dateStart() {
    return this.formDate?.get('dateStart')?.value;
  }

  get numDoc() {
    return this.formDate?.get('numDoc')?.value;
  }

  get dateEnd() {
    return this.formDate?.get('dateEnd')?.value;
  }

  get status() {
    return this.formDate?.get('status')?.value;
  }

  get entity() {
    return this.formDate?.get('entity')?.value;
  }
  get supply() {
    return this.formDate?.get('supply')?.value;
  }
  get idService() {
    return this.formDate?.get('idService')?.value;
  }

  get category() {
    return this.formDate?.get('category')?.value;
  }

  get provider() {
    return this.formDate?.get('provider')?.value;
  }

  exportDataViaAPI(fileType: 'xlsx' | 'csv'): void {
    console.log('exportDataViaAPI called with', fileType);
    this.spinner.spinnerOnOff();

    // Preparar los filtros para la exportación
    const exportFilters: Record<string, any> = {
      dateStart: this.dateStart
        ? `${this.dateService.formatTrayDate(this.dateStart).replace(/\//g, '-')} 00:00:00`
        : undefined,
      dateEnd: this.dateEnd
        ? `${this.dateService.formatTrayDate(this.dateEnd).replace(/\//g, '-')} 23:59:59`
        : undefined,
      status: this.status || undefined,
      idprovider: this.provider || undefined,
      idclient: this.entity || undefined,
      concept: this.numDoc || undefined,
      idService: this.idService || undefined
    };
    // Eliminar propiedades undefined
    Object.keys(exportFilters).forEach(key => {
      if (exportFilters[key] === undefined) {
        delete exportFilters[key];
      }
    });
    const inbx = 'tr';
    const token = localStorage.getItem('fcmToken') ?? "";
    this.transactionService.exportTransactions(fileType, exportFilters, inbx, token).subscribe({
      next: (response) => {
        this.spinner.spinnerOnOff();
        if (response.statusCode === 200) {
          this.mytoastr.showWarningTime('', 'Procesando Archivo...', 1000);
        } else {
          this.mytoastr.showError('', 'Error al enviar la solicitud')
        }
      },
      error: (error) => {
        this.spinner.spinnerOnOff();
        console.error('Error durante la exportación:', error);
        this.mytoastr.showError('Error durante la exportación', '');
      }
    });
  }

}
