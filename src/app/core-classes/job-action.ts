import { PaymentType, TimeRange, WorkType } from '@class/job'
import { UserType } from '@class/user'

export class IJobAction {
  type: ActionType
  executedBy: UserType
  timestamp: number
  private: boolean
  emailSent: boolean

  message: string

  rating: number

  amountUsd: number
  workType: WorkType
  timelineExpectation: TimeRange
  weeklyCommitment: number
  paymentType: PaymentType

  constructor(type: ActionType, executedBy: UserType, message = '') {
    this.type = type
    this.executedBy = executedBy
    this.message = message
    this.timestamp = Date.now()
    switch (this.type) {
      case ActionType.review:
      case ActionType.enterEscrow:
        this.private = true
        break
      default:
        this.private = false
        break
    }
  }

  init(init: Partial<IJobAction>) {
    Object.assign(this, init)
    return this
  }

  setPaymentProperties(
    usdVal: number,
    timelineExpectation?: TimeRange,
    workType?: WorkType,
    weeklyCommitment?: number,
    paymentType?: PaymentType
  ) {
    this.amountUsd = usdVal
    this.timelineExpectation = timelineExpectation
    this.workType = workType
    this.weeklyCommitment = weeklyCommitment
    this.paymentType = paymentType
  }

  get paymentTypeString(): string {
    return this.paymentType && this.paymentType === PaymentType.hourly
      ? '/hr'
      : '/total'
  }

  get dialogMessage(): string {
    switch (this.type) {
      case ActionType.cancelJob:
        return 'Are you sure you wish to cancel this job?'
      case ActionType.declineTerms:
        return (
          'Once you decline these terms, the job will be cancelled and no further action can be performed on it.' +
          ' Are you sure you wish to decline the terms?'
        )
      case ActionType.counterOffer:
        return (
          'If you wish to make a counter offer, enter the amount you propose for the job \n USD' +
          this.paymentTypeString
        )
      case ActionType.acceptTerms:
        return 'Are you sure?'
      case ActionType.enterEscrow:
        return 'You are about to pay the agreed amount of tokens to the escrow. Are you sure?'
      case ActionType.addMessage:
        return 'Add a note to this job.'
      case ActionType.finishedJob:
        return "Are you sure you've finished your job?"
      case ActionType.acceptFinish:
        return 'Are you sure you want to finish this job?'
      case ActionType.dispute:
        return 'Please contact support@canya.com for dispute resolution.'
      case ActionType.cancelJobEarly:
        return 'You are going to cancel this job. This cannot be undone. Are you sure?'
      case ActionType.review:
        return 'Leave a review!'
      default:
        return 'Are you sure?'
    }
  }

  getMessage(executor?: string): string {
    switch (this.type) {
      case ActionType.createJob:
        if (this.weeklyCommitment > 1) {
          var hoursplural = 'hours'
        } else {
          var hoursplural = 'hour'
        }
        return `Job created by ${executor}.<br>
            Proposed ${
              this.amountUsd
                ? `budget of $${this.amountUsd}${this.paymentTypeString} USD`
                : ''
            }
            for ${this.weeklyCommitment} ${hoursplural} per week
            over a period of ${this.timelineExpectation.toLowerCase()}`
      case ActionType.counterOffer:
        return `${executor} proposed a counter offer.<br>
          Proposed budget at $${this.amountUsd}${this.paymentTypeString}) USD`
      case ActionType.acceptTerms:
        return `${executor} accepted the terms of this job.`
      case ActionType.declineTerms:
        return `${executor} declined the terms of this job.`
      case ActionType.addMessage:
        return `${executor} left a message:<br>
              <em>${this.message}</em>`
      case ActionType.declineTerms:
        return `${executor} cancelled this job.`
      case ActionType.cancelJobEarly:
        return `${executor} cancelled the job early.`
      case ActionType.enterEscrow:
        return `${executor} sent tokens to CanWork escrow.<br>
              When the job is succesfully delivered, ${executor} will release the funds to the Provider.`
      default:
        return `Job action: ${this.type}, by ${executor}`
    }
  }
}

export enum ActionType {
  createJob = 'Create job',
  cancelJob = 'Cancel job',
  declineTerms = 'Decline terms',
  counterOffer = 'Counter offer',
  acceptTerms = 'Accept terms',
  enterEscrow = 'Pay Escrow',
  enterEscrowBsc = 'Pay Bsc Escrow',
  addMessage = 'Add Note',
  finishedJob = 'Mark as complete',
  acceptFinish = 'Complete job',
  dispute = 'Raise dispute',
  review = 'Leave a review',
  bid = 'Place Bid',
  declineBid = 'Decline Bid',
  invite = 'Invite to job',
  cancelJobEarly = 'Cancel Job Early',
  releaseEscrow = 'Release escrow',
  refundEscrow = 'Refund escrow',
  valueEscrow = 'Confirmed value',
}
