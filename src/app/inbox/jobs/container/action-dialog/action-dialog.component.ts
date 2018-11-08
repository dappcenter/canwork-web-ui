import { AfterViewInit, Component, ComponentRef, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Http, Response } from '@angular/http';
import { Job, PaymentType } from '@class/job';
import { ActionType, IJobAction } from '@class/job-action';
import { User, UserType } from '@class/user';
import { JobService } from '@service/job.service';
import { UserService } from '@service/user.service';
import { getUsdToCan } from '@util/currency-conversion';
import { DialogComponent, DialogService } from 'ng2-bootstrap-modal';

export class ActionDialogOptions {
  job: Job;
  actionType: ActionType;
  userType: UserType;

  constructor(init?: Partial<ActionDialogOptions>) {
    Object.assign(this, init);
  }
}

@Component({
  selector: 'app-action-dialog',
  templateUrl: './action-dialog.component.html',
  styleUrls: ['./action-dialog.component.css']
})
export class ActionDialogComponent extends DialogComponent<ActionDialogOptions, boolean> implements ActionDialogOptions, OnInit {

  actionType: ActionType;
  userType: UserType;

  job: Job;
  action: IJobAction;

  currentUser: User

  executing = false;

  actionTypes = ActionType;
  paymentTypes = PaymentType;

  canToUsd: number;
  form: FormGroup = null;

  constructor(
    dialogService: DialogService,
    private formBuilder: FormBuilder,
    private jobService: JobService,
    private userService: UserService,
    private http: Http) {
    super(dialogService);
  }

  ngOnInit() {
    this.action = new IJobAction(this.actionType, this.userType)
    switch (this.actionType) {
      case ActionType.counterOffer:
        this.action.paymentType = this.job.paymentType;
        this.form = this.userType === UserType.provider ?
          this.formBuilder.group({
            budget: [this.job.budget, Validators.compose([Validators.required, Validators.min(1), Validators.max(10000000)])],
            terms: [false, Validators.requiredTrue]
          }) :
          this.formBuilder.group({
            budget: [this.job.budget, Validators.compose([Validators.required, Validators.min(1), Validators.max(10000000)])],
          });
        this.setupCanConverter();
        break;
      case ActionType.addMessage:
      case ActionType.dispute:
        this.form = this.formBuilder.group({
          message: ['', Validators.required],
        })
        break;
      case ActionType.review:
        this.form = this.formBuilder.group({
          message: ['', Validators.compose([Validators.min(0), Validators.max(350)])],
          rating: [null, Validators.required],
        })
        break;
      case ActionType.acceptTerms:
        this.form = this.formBuilder.group({
          terms: [false, Validators.requiredTrue]
        })
        break;
      default:
        break;
    }
  }

  async handleAction() {
    this.executing = true;
    try {
      switch (this.actionType) {
        case ActionType.counterOffer:
          this.job.budget = this.form.value.budget
          this.action.setPaymentProperties(this.job.budget, await this.jobService.getJobBudget(this.job))
          break;
        case ActionType.authoriseEscrow:
          this.action.amountCan = this.job.budgetCan
          break;
        case ActionType.review:
          this.action.message = this.form.value.message;
          this.action.isClientSatisfied = this.form.value.rating
          break;
        case ActionType.addMessage:
        case ActionType.dispute:
          this.action.message = this.form.value.message;
          break;
        case ActionType.acceptTerms:
        case ActionType.declineTerms:
        case ActionType.enterEscrow:
        default:
          break;
      }
      const success = await this.jobService.handleJobAction(this.job, this.action);
      if (success) {
        this.result = true;
        this.executing = false;
        this.close();
      } else {
        this.executing = false;
      }
    } catch (e) {
      console.log(e)
      console.log('error');
    }
  }

  get submitDisabled(): boolean {
    if (!this.form) {
      return false;
    }
    return this.form.invalid;
  }

  private async setupCanConverter() {
    const canToUsdResp = await this.http.get('https://api.coinmarketcap.com/v2/ticker/2343/?convert=USD').toPromise();
    if (canToUsdResp.ok) {
      this.canToUsd = JSON.parse(canToUsdResp.text())['data']['quotes']['USD']['price'];
    }
  }

  usdToCan(usd: number) {
    return getUsdToCan(this.canToUsd, usd);
  }
}
