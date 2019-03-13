import { AuthService } from '@service/auth.service';
import { Injectable } from '@angular/core';
import { Http, Response, Headers } from '@angular/http';
import { environment } from '@env/environment';

const apiUrl = environment.limepay.uri;

const httpOptions = {
  headers: new Headers({
    'Content-Type': 'application/json'
  })
};


@Injectable({
  providedIn: 'root'
})
export class LimepayService {

  private limepay;

  constructor(
    private http: Http,
    private auth: AuthService
  ) {
    LimePayWeb.connect(environment.limepay.env).then(limepay => {
      this.limepay = limepay;
    }).catch(e => {
      console.log(e);
    });
  }

  get library() {
    return this.limepay;
  }

  async getWallet() {
    try {
      const res = await this.http.get(`${apiUrl}/getWallet`, httpOptions).take(1).toPromise();
      return Promise.resolve(res.json());
    } catch (e) {
      return Promise.reject(e);
    }
  }

  async createWallet(password) {
    try {
      const token = await this.auth.getJwt();
      const options = {
        headers: new Headers({
          'Content-Type': 'application/json',
          'Authorization': 'bearer' + token
        })
      };
      const res = await this.http.post(`${apiUrl}/createWallet`, password, options).take(1).toPromise();
      return Promise.resolve(res.json());
    } catch (e) {
      return Promise.reject(e);
    }
  }

  async getEnterEscrowTransactions(jobId): Promise<any> {
    try {
      const token = await this.auth.getJwt();
      const options = {
        headers: new Headers({
          'Content-Type': 'application/json',
          'Authorization': 'bearer ' + token
        })
      };
      const res = await this.http.get(`${apiUrl}/auth/enter-escrow-tx?jobId=${jobId}`, options).take(1).toPromise();
    } catch (e) {
      return Promise.reject(e);
    }
  }

  async initFiatPayment(jobId, providerEthAddress): Promise<any> {
    try {
      const token = await this.auth.getJwt();
      const options = {
        headers: new Headers({
          'Content-Type': 'application/json',
          'Authorization': 'bearer ' + token
        })
      };
      const res = await this.http.post(`${apiUrl}/auth/fiatpayment`, { jobId , providerEthAddress } , options).take(1).toPromise();
    } catch (e) {
      return Promise.reject(e);
    }
  }

  async createShopper(userId) {
    try {
      const options = {
        headers: new Headers({
          'Content-Type': 'application/json',
        }),
        userId     : userId
      };
      const res = await this.http.post(`${apiUrl}/createShopper`, options).take(1).toPromise();
      console.log(res);
      return Promise.resolve(res.json());
    } catch (e) {
      return Promise.reject(e);
    }
  }

  async isShopper(userId) {
    try {
      const options = {
        headers: new Headers({
          'Content-Type': 'application/json',
        }),
        userId     : userId
      };
      const res = await this.http.post(`${apiUrl}/createShopper`, options).take(1).toPromise();
      console.log(res);
      return Promise.resolve(res.json());
    } catch (e) {
      return Promise.reject(e);
    }
  }
}
