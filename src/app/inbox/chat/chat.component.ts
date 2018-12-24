import { AfterViewInit, Component, OnDestroy, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Web3LoadingStatus } from '@canyaio/canpay-lib';
import { AngularFirestore, AngularFirestoreCollection } from 'angularfire2/firestore';
import * as findIndex from 'lodash/findIndex';
import * as orderBy from 'lodash/orderBy';
import { Observable, Subscription } from 'rxjs';
import { filter, map, take } from 'rxjs/operators';

import * as moment from 'moment';
import { User } from '../../core-classes/user';
import { AuthService } from '../../core-services/auth.service';
import { Channel, ChatService, Message, MessageType } from '../../core-services/chat.service';
import { CanWorkEthService } from '../../core-services/eth.service';
import { UserService } from '../../core-services/user.service';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.css']
})
export class ChatComponent implements OnInit, AfterViewInit, OnDestroy {

  // User
  currentUser: User;
  fAddress = '';

  // Models
  userModel: User = null;

  channels: Channel[] = [];
  queryChannels: any = [];
  selectedChannel: Channel;

  messages: Message[] = [];
  message = '';

  macros: any = [
    { type: 'MESSAGE', text: 'Hello' },
    { type: 'MESSAGE', text: 'Ok' },
    { type: 'MESSAGE', text: 'Not sure' },
    { type: 'MESSAGE', text: 'Maybe later' },
    { type: 'MESSAGE', text: 'Yes' },
    { type: 'MESSAGE', text: 'No' },
    { type: 'MESSAGE', text: 'Thank you' }
  ];
  modalData: any = { service: '', budget: 0 };

  tabIndex = 0;

  balance = '0';
  web3State: Web3LoadingStatus;
  web3Subscription: Subscription;
  accountSubscription: Subscription;
  channelSubscription: Subscription;
  routeSub: Subscription;
  postForm: FormGroup = null;
  offerForm: FormGroup = null;
  queryAddress = '';
  isSending = false;
  isLoading = true;
  hideBanner = false;
  isOnMobile = false;

  constructor(private router: Router,
    private activatedRoute: ActivatedRoute,
    private formBuilder: FormBuilder,
    private userService: UserService,
    private chatService: ChatService,
    private ethService: CanWorkEthService,
    private authService: AuthService,
    private afs: AngularFirestore) {
    this.postForm = formBuilder.group({
      description: ['', Validators.compose([Validators.required, Validators.maxLength(255)])],
      budget: ['', Validators.compose([Validators.required, Validators.min(10), Validators.maxLength(9999)])]
    });

    this.offerForm = formBuilder.group({
      description: ['', Validators.compose([Validators.required, Validators.maxLength(255)])],
      price: ['', Validators.compose([Validators.required, Validators.min(10), Validators.maxLength(9999)])]
    });

    this.activatedRoute.queryParams.take(1).subscribe((params) => {
      if (params['address']) {
        this.queryAddress = params['address'];
      }
    });
  }

  ngOnInit() {
    const ua = window.navigator.userAgent;
    this.isOnMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS/i.test(ua);
    this.authService.currentUser$.pipe(take(1)).subscribe((user: User) => {
      if (user && user !== this.currentUser) {
        this.currentUser = user;
        this.loadChannels();
      }
    });
  }

  ngAfterViewInit() {
    this.web3Subscription = this.ethService.web3Status$.subscribe((status: Web3LoadingStatus) => {
      this.web3State = status;
      if (status === Web3LoadingStatus.complete) {
        this.accountSubscription = this.ethService.account$.subscribe(async (acc: string) => {
          if (acc !== undefined) {
            this.ethService.getCanYaBalance().then((data: any) => {
              this.balance = data;
            });
          }
        });
      } else if (status === Web3LoadingStatus.noAccountsAvailable) {
        this.ethService.getOwnerAccount();
      } else {
        this.balance = '0';
      }
    });
  }

  ngOnDestroy() {
    if (this.web3Subscription) { this.web3Subscription.unsubscribe(); }
    if (this.accountSubscription !== undefined) { this.accountSubscription.unsubscribe(); }
    if (this.channelSubscription) { this.channelSubscription.unsubscribe(); }
  }

  loadChannels() {
    try {
      this.channelSubscription = this.afs.collection('chats').doc(this.currentUser.address).collection('channels').valueChanges().subscribe((data: Channel[]) => {


        if (this.queryAddress !== '') {
          const idx = findIndex(data, { 'address': this.queryAddress });
          if (idx !== '-1') {
            this.setSelectedChannel(data[idx]);
          }
        }
        this.channels = data.filter((doc: Channel) => {
          return doc.message || this.selectedChannel === doc;
        }).sort((a, b) => {
          return parseInt(b.timestamp, 10) - parseInt(a.timestamp, 10);
        });
        if (JSON.parse(localStorage.getItem('selectedChannel')) && this.queryAddress === '') {
          this.setSelectedChannel(JSON.parse(localStorage.getItem('selectedChannel')));
        }
        if (!JSON.parse(localStorage.getItem('selectedChannel')) && this.queryAddress === '') {
          this.setSelectedChannel(this.channels[0]);
        }

        this.onSearch('');
        this.loadChats();
        this.loadUser();
      });
    } catch (error) {
      console.error('error loading channels');
    }
  }

  async hideChannel(channel: Channel) {
    localStorage.setItem('selectedChannel', null);
    this.chatService.hideChannel(this.currentUser.address, channel.channel);
    // this.loadChannels();
  }

  setSelectedChannel(channel: any) {
    if (channel) {
      this.selectedChannel = channel;
      this.readIfUnread();
    }
  }

  readIfUnread() {
    if (this.selectedChannel && this.selectedChannel.unreadMessages) {
      this.afs.collection('chats').doc(this.currentUser.address).collection('channels').doc(this.selectedChannel.channel).update({ unreadMessages: false });
      this.afs.doc(`notifications/${this.currentUser.address}`).set({ chat: false });
    }
  }

  loadChats() {
    this.messages = [];
    if (this.selectedChannel) {
      const collection = this.afs.collection('chats').doc(this.currentUser.address).collection('channels')
        .doc(this.selectedChannel.channel)
        .collection('messages', ref => ref.limit(50).orderBy('timestamp', 'desc'))
        .valueChanges().pipe(map((array) => array.reverse()));
      collection.subscribe((data: any) => {
        this.isLoading = false;
        this.messages = data;
        this.scrollToBottom();
      });
    }
  }

  loadUser() {
    if (this.selectedChannel) {
      this.userService.getUser(this.selectedChannel.address).then((user: User) => {
        this.userModel = user;
      });
    }
  }

  scrollToBottom() {
    if ((<any>window).$('#section-messages') && ((<any>window).$('#section-messages-end') && (<any>window).$('#section-messages-end').offset())) {
      (<any>window).$('#section-messages').animate({ scrollTop: 100000 }, 300);
    }
  }

  sendMessage(messageModel: Message) {
    this.chatService.sendMessage(this.currentUser.address, this.userModel.address, messageModel);
    this.message = '';
  }

  onSearch(query: string) {
    if (query !== '') {
      const tmpChannels: any = [];
      this.channels.map((item) => {
        if (JSON.stringify(item).toLowerCase().includes(query.toLowerCase())) {
          tmpChannels.push(item);
        }
      });
      this.queryChannels = tmpChannels;
    } else {
      this.queryChannels = this.channels;
    }
  }

  onKeyUp(event: any) {
    this.onSearch(event);
  }

  onSelect(channelModel: any) {
    this.setSelectedChannel(channelModel);
    localStorage.setItem('selectedChannel', JSON.stringify(this.selectedChannel));
    this.loadChats();
    this.loadUser();
    if (this.isOnMobile) {
      this.toggleMobileDivs();
      console.log('on mobile! hiding the list and showing the chat window...');
    }
  }
  toggleMobileDivsEvent(event: any) {
    this.toggleMobileDivs();
  }
  toggleMobileDivs() {
    document.getElementById('contact-div').classList.toggle('hide');
    document.getElementById('message-div').classList.toggle('hide');
  }

  onBuy() {
    this.router.navigate(['/exchange']);
  }

  onMacro(message: string) {
    this.message = message;
    this.onSend();
  }

  onSend() {
    const msg = this.chatService.createMessageObject(this.selectedChannel.channel, this.currentUser, this.message);
    this.sendMessage(msg);
  }

  postRequest(userId: string) {
    this.router.navigate(['/inbox/post', userId]);
  }

  onMakeAnOffer() {
    const msg = this.chatService.createMessageObject(this.selectedChannel.channel, this.currentUser, 'I\'ve just sent you an offer, please respond by accepting or presenting a counter offer. Thanks 👌');
    this.sendMessage(msg);
    const request = this.chatService.createMessageObject(this.selectedChannel.channel, this.currentUser, MessageType.offer, this.offerForm.value.description, this.offerForm.value.price);
    this.sendMessage(request);
    (<any>window).$('#makeAnOffer').modal('hide');
  }

  onAccept(checkoutModel: any, type: MessageType) {
    const msg = this.chatService.createMessageObject(this.selectedChannel.channel, this.currentUser, type === MessageType.request ? 'I accept your request. Let\'s do it! 👍🏻' : 'I accept your offer. Thanks! 👍🏻');
    this.sendMessage(msg);

    const tmpRequest = new Message({
      channel: this.selectedChannel.channel,
      address: type === 'REQUEST' ? this.currentUser.address : this.selectedChannel.address,
      avatar: type === 'REQUEST' ? this.currentUser.avatar : this.selectedChannel.avatar,
      name: type === 'REQUEST' ? this.currentUser.name : this.selectedChannel.name,
      title: type === 'REQUEST' ? this.currentUser.title : this.selectedChannel.title,
      message: checkoutModel.message,
      budget: type === 'REQUEST' ? checkoutModel.budget : checkoutModel.price,
      type: MessageType.checkout,
      timestamp: moment().format('x')
    });
    this.sendMessage(tmpRequest);
  }

  onPayLater(checkoutModel: any) {
    const msg = this.chatService.createMessageObject(this.selectedChannel.channel, this.currentUser, 'I\'ll pay later. Thanks.');
    this.sendMessage(msg);
  }

  onPayNow(checkoutModel: any) {
    this.modalData.service = checkoutModel.message;
    this.modalData.budget = checkoutModel.budget;

    if (this.web3State === Web3LoadingStatus.wrongNetwork) {
      (<any>window).$('#switchToMainNetModal').modal();
    } else if (this.web3State === Web3LoadingStatus.noAccountsAvailable) {
      (<any>window).$('#walletLocked').modal();
    } else if (this.web3State === Web3LoadingStatus.complete) {
      (<any>window).$('#confirmTransaction').modal();
    } else {
      (<any>window).$('#web3NotAvailable').modal();
    }
  }

  onConfirmTransaction() {
    // this.ethService.payCan('', this.modalData.budget).subscribe((receipt) => {
    //   this.postTransaction(null, receipt);
    // });
  }

  postTransaction(checkoutModel: any, receipt: any) {
    const msg = this.chatService.createMessageObject(this.selectedChannel.channel, this.currentUser, 'You\'ve received a payment. Please, check your MetaMask Wallet.');
    this.sendMessage(msg);
  }

  linkify(text, userMessage) {
    const urlRegex = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
    if (userMessage === false) {
      text = text.replace(urlRegex,
        '<a target="_blank" href="$1">$1</a>'
      );
    } else {
      text = text.replace(urlRegex,
        '<a class="text-white" target="_blank" href="$1">$1</a>'
      );
    }
    return text;
  }

  getTxLink(txHash: string) {
    return `http://${environment.contracts.useTestNet ? 'ropsten.' : ''}etherscan.io/tx/${txHash}`;
  }

}
