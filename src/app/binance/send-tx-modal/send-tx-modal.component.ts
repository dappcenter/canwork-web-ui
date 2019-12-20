import { Component, OnInit, OnDestroy } from '@angular/core'
import { BinanceService, Transaction } from '@service/binance.service'
import { ToastrService } from 'ngx-toastr'
import { formatAtomicCan } from '@util/currency-conversion'

@Component({
  selector: 'send-tx-modal',
  templateUrl: './send-tx-modal.component.html',
})
export class SendTxModalComponent implements OnInit, OnDestroy {
  isConfirming: boolean = false
  private txSubscription?: any = null
  fromAddress?: string = null
  transaction?: Transaction = null
  password?: string = null

  constructor(
    private binanceService: BinanceService,
    private toastr: ToastrService
  ) {}

  ngOnInit() {
    this.txSubscription = this.binanceService.transactionsEmitter.subscribe({
      next: (transaction: Transaction) => {
        this.fromAddress = this.binanceService.getAddress()
        this.transaction = transaction
        ;(window as any).$('#sendTxModal').modal('show')
      },
    })
  }

  ngOnDestroy() {
    if (this.txSubscription) {
      this.txSubscription.unsubscribe()
    }
    this.close()
  }

  formatAmount(amount) {
    return formatAtomicCan(amount)
  }

  splitMemo(memo) {
    if (!memo) {
      return ''
    }
    return memo.replace(/:/g, ':<BREAK>').split('<BREAK>')
  }

  private close() {
    ;(window as any).$('#sendTxModal').modal('hide')
  }

  private wrapBeforeTransaction(beforeTransaction: Function) {
    return function() {
      if (this.binanceService.isLedgerConnected()) {
        this.toastr.info('Please approve on your ledger')
      } else if (this.binanceService.isWalletConnectConnected()) {
        this.toastr.info('Please approve on your WalletConnect')
      }
      if (beforeTransaction) {
        beforeTransaction.apply(this, arguments)
      }
    }
  }

  private wrapOnSuccess(onSuccess: Function) {
    return function() {
      this.toastr.success('Successfully sent the transaction')
      this.close()
      if (onSuccess) {
        onSuccess.apply(this, arguments)
      }
    }
  }

  private wrapOnFailure(onFailure: Function) {
    return function(reason) {
      let errorMessage = 'Transaction failed'
      if (reason) {
        errorMessage += `: ${reason}`
      }
      this.toastr.error(errorMessage)
      this.close()
      if (onFailure) {
        onFailure.apply(this, arguments)
      }
    }
  }

  confirmTransaction() {
    const { to, amountCan, memo, callbacks } = this.transaction
    const { beforeTransaction, onSuccess, onFailure } = callbacks
    const wrappedBeforeTransaction = this.wrapBeforeTransaction(
      beforeTransaction
    ).bind(this)
    const wrappedOnSuccess = this.wrapOnSuccess(onSuccess).bind(this)
    const wrappedOnFailure = this.wrapOnFailure(onFailure).bind(this)
    if (this.binanceService.isLedgerConnected()) {
      this.binanceService.transactViaLedger(
        to,
        amountCan,
        memo,
        wrappedBeforeTransaction,
        wrappedOnSuccess,
        wrappedOnFailure,
      )
    } else if (this.binanceService.isKeystoreConnected()) {
      this.binanceService.transactViaKeystore(
        to,
        amountCan,
        memo,
        this.password,
        wrappedBeforeTransaction,
        wrappedOnSuccess,
        wrappedOnFailure,
      )
    } else if (this.binanceService.isWalletConnectConnected()) {
      this.binanceService.transactViaWalletConnect(
        to,
        amountCan,
        memo,
        wrappedBeforeTransaction,
        wrappedOnSuccess,
        wrappedOnFailure,
      )
    } else {
      console.error('Unsupported wallet type')
      wrappedOnFailure('no supported wallet connected')
    }
  }
}
