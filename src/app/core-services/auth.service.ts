import { Injectable } from '@angular/core';
import { AngularFirestore, AngularFirestoreCollection } from 'angularfire2/firestore';
import { AngularFireAuth } from 'angularfire2/auth';

import { Observable } from 'rxjs/Observable';
import { Subscription } from 'rxjs/Subscription';
import 'rxjs/add/operator/take';

import { MomentService } from './moment.service';
import { User, Avatar } from '../core-classes/user';

import { environment } from '../../environments/environment';


@Injectable()
export class AuthService {

  currentUser: User = JSON.parse(localStorage.getItem('credentials'));

  uport: any = null;

  usersCollectionRef: AngularFirestoreCollection<any>;

  constructor(private afs: AngularFirestore, private moment: MomentService, private afAuth: AngularFireAuth) {
    this.usersCollectionRef = this.afs.collection<any>('users');
  }

  // TODO: Refactor this into the thing called in auth guard (getCurrentUser)
  getCurrentUser() {
    this.currentUser = JSON.parse(localStorage.getItem('credentials'));
    console.log('getCurrentUser - currentUser', this.currentUser, this.currentUser.address);
    if (this.currentUser && this.currentUser.address) {
      // Firebase: GetUser
      return this.afs.collection<any>('users').doc(this.currentUser.address).valueChanges().take(1);
    }
    return null;
  }

  isAuthenticated() {
    return this.currentUser !== null;
  }

  logout() {
    localStorage.clear();
    this.afAuth.auth.signOut();
    window.location.reload();
  }

  initUport() {
    try {
      this.uport = new (<any>window).uportconnect.Connect('canya.com', {
        clientId: environment.uPort.clientId,
        signer: (<any>window).uportconnect.SimpleSigner(environment.uPort.signer)
      });
    } catch (error) {
      console.error('UserService\t initUport\t error', error);
    }
  }

  // formerly connect
  async uportConnectAsync(type?: string): Promise<any> {
    return new Promise((resolve: any, reject: any) => {
      this.uport.requestCredentials({
        requested: ['avatar', 'name', 'email', 'phone', 'country'],
        notifications: true // We want this if we want to receive credentials
      }).then(async (credentials) => {
        console.log(JSON.stringify(credentials));
        resolve(credentials);
      }, (error) => {
        reject(error);
      });
    });
  }

  // Formerly saveCredentials
  initialiseUser(credentials: User, type?: string): Promise<User> {
    return new Promise(async (resolve: any, reject: any) => {
      try {
        credentials.timestamp = this.moment.get();
        localStorage.setItem('credentials', JSON.stringify(credentials));
        this.saveUserFirebase(credentials);
        resolve(credentials);
      } catch (error) {
        reject(error);
      }
    });
  }

  // formerly saveData
  updateUserProperty(key: string, value: any) {
    const credentials: User = JSON.parse(localStorage.getItem('credentials'));
    if (credentials) {
      credentials[key] = value;
      localStorage.setItem('credentials', JSON.stringify(credentials));
      this.saveUserFirebase(credentials);
    }
  }

  private saveUserFirebase(userModel: User) {
    if (userModel && userModel.address) {
      const ref = userModel.address;
      // Firebase: SaveUser
      this.usersCollectionRef.doc(ref).snapshotChanges().take(1).subscribe((snap: any) => {
        console.log('saveUser - payload', snap.payload.exists);
        return snap.payload.exists ? this.usersCollectionRef.doc(ref).update(Object.assign({}, userModel)) : this.usersCollectionRef.doc(ref).set(Object.assign({}, userModel));
      });
    }
  }
}
