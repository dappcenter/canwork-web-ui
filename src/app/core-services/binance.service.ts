import { PaymentSummary } from './../canpay-lib/interfaces'
import { Injectable, EventEmitter } from '@angular/core'
import WalletConnect from './../core-classes/walletConnect'
import { BehaviorSubject } from 'rxjs'
import base64js from 'base64-js'

import BncClient, { crypto } from '@binance-chain/javascript-sdk'
import { environment } from '@env/environment'
import { formatAtomicAsset } from '@util/currency-conversion'
import { AuthService } from '@service/auth.service'
import { UserService } from '@service/user.service'
import { LedgerService } from '@service/ledger.service'
import { BinanceValidator } from '@validator/binance.validator'

export type Connector = WalletConnect
export enum WalletApp {
  WalletConnect, // bep2
  Ledger, // bep2
  Keystore, // bep2
  Mnemonic, // bep2
  MetaMask, // bsc
  WalletConnectBsc // bsc
}

export enum EventType {
  Init = 'Init',
  ConnectRequest = 'ConnectRequest',
  ConnectSuccess = 'ConnectSuccess',
  ConnectFailure = 'ConnectFailure',
  ConnectConfirmationRequired = 'ConnectConfirmationRequired',
  Update = 'Update',
  Disconnect = 'Disconnect',
}

export interface EventDetails {
  connector?: Connector
  address?: string
  keystore?: object
  account?: object
  ledgerApp?: any
  ledgerHdPath?: number[]
  ledgerIndex?: number
}

export interface Event {
  type: EventType
  walletApp?: WalletApp
  details: EventDetails
  forced?: boolean
}

export interface Transaction {
  to: string
  toName?: string
  symbol: string
  iconURL?: string
  amountAsset: number
  memo: string
  callbacks?: TransactionCallbacks
  txInfo?: string
}

export interface TransactionCallbacks {
  beforeTransaction?: () => void
  onSuccess?: () => void
  onFailure?: (reason?: string) => void
}

const ESCROW_ADDRESS = environment.binance.escrowAddress
const CHAIN_ID = environment.binance.chainId
const NETWORK_ID = 714
const DEFAULT_FEE = 37500
const CAN_TOKEN = environment.binance.canToken
const BASE_API_URL = environment.binance.api
const BINANCE_NETWORK = environment.binance.net
const TICKER_API_URL = `${BASE_API_URL}api/v1/ticker/24hr`
const FEE_API_URL = `${BASE_API_URL}api/v1/fees`

@Injectable({
  providedIn: 'root',
})
export class BinanceService {
  connector: Connector | null
  private events: BehaviorSubject<Event | null> = new BehaviorSubject(null)
  events$ = this.events.asObservable()
  transactionsEmitter: EventEmitter<Transaction> = new EventEmitter<
    Transaction
  >()
  client = new BncClient(BASE_API_URL)
  private connectedWalletApp: WalletApp = null
  private connectedWalletDetails: any = null
  private pendingConnectRequest: Event = null
  private sendingFee: number = 0

  constructor(
    private userService: UserService,
    private authService: AuthService,
    private ledgerService: LedgerService
  ) {
    this.client.chooseNetwork(BINANCE_NETWORK)
    this.client.initChain()
    this.subscribeToEvents()
    const connectedWallet = JSON.parse(localStorage.getItem('connectedWallet'))
    if (connectedWallet) {
      if (connectedWallet.walletApp === WalletApp.Keystore) {
        const { keystore, address } = connectedWallet
        this.initKeystore(keystore, address)
      } else if (connectedWallet.walletApp === WalletApp.Ledger) {
        const { ledgerIndex } = connectedWallet
        this.initiateLedgerConnection(ledgerIndex)
      }
    }
  }

  private resetConnector() {
    this.connector = null
  }

  private subscribeToEvents() {
    this.events$.subscribe(async event => {
      if (!event) {
        return
      }
      const { type, walletApp, details, forced } = event
      if (type === EventType.ConnectRequest && walletApp !== undefined) {
        // attemp to save wallet address to DB
        const { address } = details
        const user = await this.authService.getCurrentUser()
        if (user && user.bnbAddress !== address) {
          const validator = new BinanceValidator(this, this.userService)
          // already has a different address
          if (user.bnbAddress && !forced) {
            this.pendingConnectRequest = event
            this.events.next({
              type: EventType.ConnectConfirmationRequired,
              walletApp,
              details,
            })
            return
          }
          // address already used by another user
          if (await validator.isUniqueAddress(address, user)) {
            this.userService.updateUserProperty(user, 'bnbAddress', address)
          } else {
            this.events.next({
              type: EventType.ConnectFailure,
              walletApp,
              details,
            })
            return
          }
        }
        this.events.next({
          type: EventType.ConnectSuccess,
          walletApp,
          details,
        })
      } else if (type === EventType.ConnectSuccess) {
        this.connectedWalletApp = walletApp
        this.connectedWalletDetails = details
        if (
          walletApp === WalletApp.Keystore ||
          walletApp === WalletApp.Ledger
        ) {
          let connectedWallet: Object = {
            walletApp,
            address: details.address,
          }
          if (walletApp === WalletApp.Keystore) {
            connectedWallet = {
              ...connectedWallet,
              keystore: details.keystore,
            }
          } else if (walletApp === WalletApp.Ledger) {
            connectedWallet = {
              ...connectedWallet,
              ledgerIndex: details.ledgerIndex,
            }
          }
          localStorage.setItem(
            'connectedWallet',
            JSON.stringify(connectedWallet)
          )
        }
      } else if (
        type === EventType.Disconnect ||
        type === EventType.ConnectFailure
      ) {
        this.connectedWalletApp = null
        this.connectedWalletDetails = null
        localStorage.removeItem('connectedWallet')
      }
    })
  }

  getAddress(): string {
    if (!this.connectedWalletDetails) {
      return null
    }
    return this.connectedWalletDetails.address
  }

  confirmConnection() {
    this.events.next({
      ...this.pendingConnectRequest,
      forced: true,
    })
  }

  async connect(app: WalletApp): Promise<Connector> {
    switch (app) {
      case WalletApp.WalletConnect:
        this.connector = await this.initWalletConnect()
        break
    }

    return this.connector
  }

  private async initWalletConnect(): Promise<WalletConnect> {
    // Create a walletConnector
    const connector = new WalletConnect({
      bridge: 'wss://wallet-bridge.binance.org', // Required
    })

    this.events.next({
      type: EventType.Init,
      details: { connector },
    })

    connector.on('connect', async error => {
      if (error) {
        this.events.error(error)
        return
      }

      const account = await this.getAccountWalletConnect()
      const { address } = account
      this.events.next({
        type: EventType.ConnectRequest,
        walletApp: WalletApp.WalletConnect,
        details: { connector, account, address },
      })
    })

    connector.on('session_update', async error => {
      if (error) {
        this.events.error(error)
        return
      }

      const account = await this.getAccountWalletConnect()
      const { address } = account
      this.events.next({
        type: EventType.Update,
        details: { connector, account, address },
      })
    })

    connector.on('disconnect', error => {
      if (error) {
        this.events.error(error)
        return
      }

      this.events.next({
        type: EventType.Disconnect,
        details: { connector },
      })
      this.resetConnector()
      console.log('Disconnect event')
    })
    return connector
  }

  async disconnect() {
    const connector = this.connector
    if (connector instanceof WalletConnect) {
      if (connector.connected) {
        await connector.killSession()
      }
    } else {
      this.events.next({
        type: EventType.Disconnect,
        details: {
          connector: null,
        },
      })
    }
    this.resetConnector()
    console.log('Disconnect')
  }

  async getAccountWalletConnect() {
    const connector = this.connector
    if (connector instanceof WalletConnect) {
      const wcAccounts = await connector.getAccounts()
      const wcAccount = wcAccounts.find(
        account => account.network == NETWORK_ID
      )
      const response = await this.client.getAccount(wcAccount.address)
      if (response.status === 200) {
        return response.result
      }
    }
    return null
  }

  checkAddress(address: string): boolean {
    return this.client.checkAddress(address, environment.binance.prefix)
  }

  initKeystore(keystore: object, address: string) {
    this.events.next({
      type: EventType.ConnectRequest,
      walletApp: WalletApp.Keystore,
      details: {
        connector: null,
        keystore,
        address,
      },
    })
  }

  initiateLedgerConnection(ledgerIndex = 0) {
    this.events.next({
      type: EventType.Init,
      details: { ledgerIndex },
    })
  }

  async connectLedger(
    ledgerIndex: number,
    beforeAttempting?: () => void,
    onSuccess?: () => void,
    onFailure?: () => void
  ) {
    const successCallback = (
      address: string,
      ledgerApp: any,
      ledgerHdPath: number[],
      ledgerIndex: number
    ) => {
      this.initLedger(address, ledgerApp, ledgerHdPath, ledgerIndex)
      if (onSuccess) {
        onSuccess()
      }
    }
    return this.ledgerService.connectLedger(
      ledgerIndex,
      beforeAttempting,
      successCallback,
      onFailure
    )
  }

  private initLedger(
    address: string,
    ledgerApp: any,
    ledgerHdPath: number[],
    ledgerIndex: number
  ) {
    this.events.next({
      type: EventType.ConnectRequest,
      walletApp: WalletApp.Ledger,
      details: {
        connector: null,
        address,
        ledgerApp,
        ledgerHdPath,
        ledgerIndex,
      },
    })
  }

  isLedgerConnected(): boolean {
    return this.connectedWalletApp === WalletApp.Ledger
  }

  isKeystoreConnected(): boolean {
    return this.connectedWalletApp === WalletApp.Keystore
  }

  isWalletConnectConnected(): boolean {
    return this.connectedWalletApp === WalletApp.WalletConnect
  }

  private async initFeeIfNecessary() {
    console.log('init Fee')
    if (this.sendingFee === 0) {
      try {
        const response = await (await fetch(FEE_API_URL)).json()
        const feeParams = response
          .map(item => item.fixed_fee_params)
          .filter(params => params !== undefined)
          .find(params => params.msg_type === 'send')
        this.sendingFee = feeParams.fee
      } catch (e) {
        console.warn('Unable to get fee, using default')
        this.sendingFee = DEFAULT_FEE
      }
    }
  }

  // It returns result in atomic CAN units i.e. 1e-8
  async getUsdToAtomicCan(amountOfUsd: number = 1): Promise<number> {
    try {
      const canBnbUrl = `${TICKER_API_URL}?symbol=${CAN_TOKEN}_BNB`
      const canResponse = await (await fetch(canBnbUrl)).json()
      const lastCanToBnbPrice = canResponse[0].weightedAvgPrice
      const bnbUsdPair =
        CAN_TOKEN.indexOf('TCAN') >= 0 ? 'BNB_BUSD-BAF' : 'BNB_BUSD-BD1'
      const bnbUsdUrl = `${TICKER_API_URL}?symbol=${bnbUsdPair}`
      const bnbResponse = await (await fetch(bnbUsdUrl)).json()
      const lastBnbToUsdPrice = bnbResponse[0].weightedAvgPrice
      const usdToCanPrice = 1 / (lastCanToBnbPrice * lastBnbToUsdPrice)
      const resultPrice = Math.ceil(usdToCanPrice * amountOfUsd * 1e8)
      return Promise.resolve(resultPrice)
    } catch (error) {
      console.error(error)
      return Promise.reject(null)
    }
  }

  // It returns result in atomic units i.e. 1e-8
  // TODO:  Combine/Refactor with getUsdtoAtomicCan
  async getAssetToUsd(assetSymbol: string): Promise<number> {
    try {
      let lastAssetToBnbPrice = 1 //1 for BNB
      // Get's the last weighted average price for the given asset_BNB pair
      if (assetSymbol != 'BNB') {
        const assetUrl = `${TICKER_API_URL}?symbol=${assetSymbol}_BNB`
        const assetResponse = await (await fetch(assetUrl)).json()
        lastAssetToBnbPrice = assetResponse[0].weightedAvgPrice
      }
      // Get's the last weighted average price for the BNB_BUSD pair
      const bnbUsdPair =
        CAN_TOKEN.indexOf('TCAN') >= 0 ? 'BNB_BUSD-BAF' : 'BNB_BUSD-BD1' //selects correct BUSD pair for testnet or mainnet
      const bnbUsdUrl = `${TICKER_API_URL}?symbol=${bnbUsdPair}`
      const bnbResponse = await (await fetch(bnbUsdUrl)).json()
      const lastBnbToUsdPrice = bnbResponse[0].weightedAvgPrice

      // Calculates & returns the asset to USD price
      const assetToUsd = lastAssetToBnbPrice * lastBnbToUsdPrice
      console.log(assetToUsd)

      return Promise.resolve(assetToUsd)
    } catch (error) {
      console.error(error)
      return Promise.reject(null)
    }
  }

  async hasEnoughBalance(amountAsset: number, symbol: string) {
    try {
      const { address } = this.connectedWalletDetails
      const balance = await this.client.getBalance(address)
      const availableBnb = Number.parseFloat(
        balance.find(coin => coin.symbol === 'BNB').free
      )
      const availableAsset = Number.parseFloat(
        balance.find(coin => coin.symbol === symbol).free
      )
      return (
        availableAsset * 1e8 >= amountAsset &&
        availableBnb * 1e8 >= this.sendingFee
      )
    } catch (e) {
      // user doesn't have any CAN or BNB at all
      return false
    }
  }

  emitTransaction(transaction: Transaction) {
    console.log('emit tx')
    this.transactionsEmitter.emit(transaction)
  }

  private async preconditions(
    amountAsset: number,
    symbol: string,
    onFailure?: (reason?: string) => void
  ): Promise<boolean> {
    console.log('preconditions')
    await this.initFeeIfNecessary()
    const hasBalance = await this.hasEnoughBalance(amountAsset, symbol)
    console.log('has enough: ' + hasBalance)
    if (!hasBalance) {
      onFailure("your wallet doesn't have enough " + symbol + ' or BNB')
      return false
    }
    return true
  }

  async escrowFunds(
    paymentSummary: PaymentSummary,
    beforeTransaction?: () => void,
    onSuccess?: () => void,
    onFailure?: (reason?: string) => void
  ) {
    console.log('EscrowFunds')

    //checks if enough BNB for fee and enough assest in wallet to cover job
    const preconditionsOk = await this.preconditions(
      paymentSummary.jobBudgetAtomic,
      paymentSummary.asset.symbol,
      onFailure
    )
    console.log('preconditions OK: ' + preconditionsOk)
    if (!preconditionsOk) {
      return
    }

    // sets up escrow Tx
    const memo = `ESCROW:${paymentSummary.job.jobId}:${paymentSummary.job.providerAddress}`
    const to = ESCROW_ADDRESS
    const toName = 'CanWork Escrow'
    const iconURL = paymentSummary.asset.iconURL
    const symbol = paymentSummary.asset.symbol
    const amountAsset = paymentSummary.jobBudgetAtomic
    const txInfo = 'Payment to CanWork Escrow'
    const callbacks: TransactionCallbacks = {
      beforeTransaction,
      onSuccess,
      onFailure,
    }
    const transaction: Transaction = {
      to,
      toName,
      symbol,
      iconURL,
      amountAsset,
      memo,
      callbacks,
      txInfo,
    }

    this.emitTransaction(transaction)
  }

  async releaseFunds(
    jobId: string,
    beforeTransaction?: () => void,
    onSuccess?: () => void,
    onFailure?: (reason?: string) => void
  ) {
    console.log('Release funds')
    const amountAsset = 1 // This is negligible 1e-8 (0.00000001), used as tx amount for RELEASE command to escrow
    const symbol = 'BNB' // Release command tx amount (1e-8) is made in BNB
    const preconditionsOk = await this.preconditions(
      amountAsset,
      symbol,
      onFailure
    )
    if (!preconditionsOk) {
      return
    }
    const memo = `RELEASE:${jobId}`
    const to = ESCROW_ADDRESS
    const toName = 'CanWork Escrow'
    const txInfo = 'Release funds from escrow'

    const callbacks: TransactionCallbacks = {
      beforeTransaction,
      onSuccess,
      onFailure,
    }
    const transaction: Transaction = {
      to,
      toName,
      symbol,
      amountAsset,
      memo,
      callbacks,
      txInfo,
    }
    this.emitTransaction(transaction)
  }

  async transactViaLedger(
    to: string,
    symbol: string,
    amountAsset: number,
    memo: string,
    beforeTransaction?: () => void,
    onSuccess?: () => void,
    onFailure?: (reason?: string) => void
  ) {
    try {
      this.client.useLedgerSigningDelegate(
        this.connectedWalletDetails.ledgerApp,
        null,
        null,
        null,
        this.connectedWalletDetails.ledgerHdPath
      )

      const { address } = this.connectedWalletDetails
      if (beforeTransaction) {
        beforeTransaction()
      }

      const adjustedAmount = formatAtomicAsset(amountAsset)
      const results = await this.client.transfer(
        address,
        to,
        adjustedAmount,
        symbol,
        memo
      )

      if (results.result[0].ok) {
        if (onSuccess) {
          onSuccess()
        }
      }
    } catch (err) {
      console.error(err)
      if (onFailure) {
        onFailure(err.message)
      }
    }
  }

  async transactViaKeystore(
    to: string,
    symbol: string,
    amountAsset: number,
    memo: string,
    password: string,
    beforeTransaction?: () => void,
    onSuccess?: () => void,
    onFailure?: (reason?: string) => void
  ) {
    console.log('transact via KeyStore')
    try {
      const privateKey = crypto.getPrivateKeyFromKeyStore(
        this.connectedWalletDetails.keystore,
        password
      )
      this.client.setPrivateKey(privateKey)
      const { address } = this.connectedWalletDetails
      if (beforeTransaction) {
        beforeTransaction()
      }

      console.log('amountAsset: ' + amountAsset)
      const adjustedAmount = formatAtomicAsset(amountAsset)
      console.log('adjustedAmount: ' + amountAsset)

      const results = await this.client.transfer(
        address,
        to,
        adjustedAmount,
        symbol,
        memo
      )

      if (results.result[0].ok) {
        if (onSuccess) {
          onSuccess()
        }
      }
    } catch (err) {
      console.error(err)
      if (onFailure) {
        onFailure(err.message)
      }
    }
  }

  async transactViaWalletConnect(
    to: string,
    symbol: string,
    amountAsset: number,
    memo: string,
    beforeTransaction?: () => void,
    onSuccess?: () => void,
    onFailure?: (reason?: string) => void
  ) {
    console.log('transact via WalletConnect')
    const { account } = this.connectedWalletDetails
    const { address } = account
    const sequence = await this.getSequence(address)
    const tx = {
      accountNumber: account.account_number.toString(),
      chainId: CHAIN_ID,
      sequence: sequence,
      memo,
      send_order: {},
    }

    const amountStr = amountAsset.toString()
    tx.send_order = {
      inputs: [
        {
          address: base64js.fromByteArray(crypto.decodeAddress(address)),
          coins: {
            denom: symbol,
            amount: amountStr,
          },
        },
      ],
      outputs: [
        {
          address: base64js.fromByteArray(crypto.decodeAddress(to)),
          coins: {
            denom: symbol,
            amount: amountStr,
          },
        },
      ],
    }

    if (beforeTransaction) {
      beforeTransaction()
    }

    try {
      const result = await this.connectedWalletDetails.connector.trustSignTransaction(
        NETWORK_ID,
        tx
      )
      // Returns transaction signed in json or encoded format
      const response = await this.client.sendRawTransaction(result, true)
      if (onSuccess) {
        onSuccess()
      }
    } catch (err) {
      // Error returned when rejected
      console.error(err)
      if (onFailure) {
        onFailure(err.message)
      }
    }
  }

  /* Get sequence of account */
  async getSequence(address) {
    const SEQUENCE_API_URL = `${BASE_API_URL}api/v1/account/${address}/sequence`
    try {
      const response = await (await fetch(SEQUENCE_API_URL)).json()
      const sequence = response.sequence
      console.log('sequence: ' + sequence)
      return sequence
    } catch (err) {
      return err
    }
  }

  async getAssetIconUrl(symbol) {
    let iconUrl: string
    if (symbol === 'BNB') {
      iconUrl =
        'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/binance/info//logo.png'
    } else {
      iconUrl =
        'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/binance/assets/' +
        symbol +
        '/logo.png'
    }
    return iconUrl
  }
}
