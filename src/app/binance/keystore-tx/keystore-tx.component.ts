import { Component, Input } from '@angular/core'

@Component({
  selector: 'keystore-tx',
  templateUrl: './keystore-tx.component.html'
})
export class KeystoreTxComponent {
  @Input() sendTransaction
  keystorePassword: string = ''

  confirm() {
    this.sendTransaction(this.keystorePassword)
  }
}