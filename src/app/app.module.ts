import { NgtUniversalModule } from '@ng-toolkit/universal';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { CanpayModule } from '@canyaio/canpay-lib';
import { AngularFireModule } from 'angularfire2';
import { AngularFireAuthModule } from 'angularfire2/auth';
import { AngularFirestoreModule } from 'angularfire2/firestore';
import { AngularFireStorageModule } from 'angularfire2/storage';
import { FirebaseUIModule } from 'firebaseui-angular';
import { environment } from '../environments/environment';
import { AppComponent } from './app.component';
import { AppRoutingModule } from './app.routing.module';
import { CoreComponentsModule } from './core-components/core-components.module';
import { firebaseUiAuthConfig } from './core-config/app-auth-config';
import { AuthService } from './core-services/auth.service';
import { MobileService } from './core-services/mobile.service';
import { CoreServicesModule } from './core-services/core-services.module';
import { CanWorkEthService } from './core-services/eth.service';
import { JobNotificationService } from './core-services/job-notification.service';
import { CertificationsService } from './core-services/certifications.service';
import { NavService } from './core-services/nav.service';
import { CoreUtilsModule } from './core-utils/core-utils.module';
import { FilterPipeModule } from 'ngx-filter-pipe';
import { Ng5SliderModule } from 'ng5-slider';
import { DockIoService } from './core-services/dock-io.service';

@NgModule({
  declarations: [
    AppComponent
  ],
  imports:[
 CommonModule,
NgtUniversalModule,
 
    AppRoutingModule,
    AngularFireAuthModule,
    AngularFireModule.initializeApp(environment.firebase),
    AngularFirestoreModule,
    AngularFireStorageModule,
    FirebaseUIModule.forRoot(firebaseUiAuthConfig),
    
    BrowserAnimationsModule,
    CanpayModule.forRoot({
      useTestNet: environment.contracts.useTestNet,
      contracts: {
        canyaCoinAddress: environment.contracts.canYaCoin
      }
    }),
    CoreComponentsModule,
    CoreServicesModule,
    CoreUtilsModule,
    HttpClientModule,
    FilterPipeModule,
    Ng5SliderModule
  ],
  exports: [
    FilterPipeModule
  ],
  providers: [
    AuthService,
    MobileService,
    CanWorkEthService,
    NavService,
    JobNotificationService,
    CertificationsService,
    DockIoService,
  ],
})
export class AppModule { }
