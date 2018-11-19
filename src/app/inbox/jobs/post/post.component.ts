import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Http, Response } from '@angular/http';
import { ActivatedRoute, Router } from '@angular/router';
import { EthService } from '@canyaio/canpay-lib';
import { Job, JobDescription, PaymentType, TimeRange, WorkType, JobState } from '@class/job';
import { ActionType, IJobAction } from '@class/job-action';
import { Upload } from '@class/upload';
import { User, UserType } from '@class/user';
import '@extensions/string';
import { AuthService } from '@service/auth.service';
import { JobNotificationService } from '@service/job-notification.service';
import { JobService } from '@service/job.service';
import { PublicJobService } from '@service/public-job.service';
import { UploadCategory, UploadService } from '@service/upload.service';
import { UserService } from '@service/user.service';
import { getUsdToCan } from '@util/currency-conversion';
import { GenerateGuid } from '@util/generate.uid';
import { AngularFireUploadTask } from 'angularfire2/storage';
import * as _ from 'lodash';
import { FilterPipe } from 'ngx-filter-pipe';
import { Subscription } from 'rxjs';
import { take } from 'rxjs/operators';
@Component({
  selector: 'app-post',
  templateUrl: './post.component.html',
  styleUrls: ['./post.component.css']
})
export class PostComponent implements OnInit, OnDestroy {

  postForm: FormGroup = null;
  shareableJobForm: FormGroup = null;
  pageLoaded = false;
  paymentType = PaymentType;
  recipientAddress = '';
  recipient: User = null;
  currentUser: User;
  friendlyUrl = '';
  authSub: Subscription;
  routeSub: Subscription;
  jobSub: Subscription;
  currentDate = '';
  isShareable = false;
  isSending = false;
  sent = false;
  draft = false;
  editing = false;

  jobToEdit: Job;
  jobId: string;

  currentUpload: Upload;
  uploadedFile: Upload;
  maxFileSizeBytes = 50000000; // 50mb
  fileTooBig = false;
  uploadFailed = false;
  deleteFailed = false;

  canToUsd: number;
  providerTypes = [
    {
      name: 'Content Creators',
      img: 'writer.svg',
      id: 'contentCreator'
    },
    {
      name: 'Software Developers',
      img: 'dev.svg',
      id: 'softwareDev'
    },
    {
      name: 'Designers & Creatives',
      img: 'creatives.svg',
      id: 'designer'
    },
    {
      name: 'Financial Experts',
      img: 'finance.svg',
      id: 'finance'
    },
    {
      name: 'Marketing & Seo',
      img: 'marketing.svg',
      id: 'marketing'
    },
    {
      name: 'Virtual Assistants',
      img: 'assistant.svg',
      id: 'virtualAssistant'
    }
  ];

  constructor(private router: Router,
    private activatedRoute: ActivatedRoute,
    private formBuilder: FormBuilder,
    private userService: UserService,
    private authService: AuthService,
    private jobService: JobService,
    private ethService: EthService,
    private publicJobService: PublicJobService,
    private uploadService: UploadService,
    private http: Http) {
    this.postForm = formBuilder.group({
      description: ['', Validators.compose([Validators.required, Validators.maxLength(10000)])],
      title: ['', Validators.compose([Validators.required, Validators.maxLength(64)])],
      initialStage: ['', Validators.compose([Validators.required, Validators.maxLength(3000)])],
      skills: ['', Validators.compose([Validators.required, Validators.minLength(1), Validators.maxLength(100)])],
      attachments: [''],
      workType: ['', Validators.compose([Validators.required])],
      timelineExpectation: ['', Validators.compose([Validators.required])],
      weeklyCommitment: ['', Validators.compose([Validators.required, Validators.min(1), Validators.max(60)])],
      paymentType: ['', Validators.compose([Validators.required])],
      budget: ['', Validators.compose([Validators.required, Validators.min(1), Validators.max(10000000)])],
      terms: [false, Validators.requiredTrue]
    });
    this.shareableJobForm = formBuilder.group({
      description: ['', Validators.compose([Validators.required, Validators.maxLength(10000)])],
      title: ['', Validators.compose([Validators.required, Validators.maxLength(64)])],
      initialStage: ['', Validators.compose([Validators.required, Validators.maxLength(3000)])],
      skills: ['', Validators.compose([Validators.required, Validators.minLength(1), Validators.maxLength(100)])],
      attachments: [''],
      workType: ['', Validators.compose([Validators.required])],
      providerType: ['', Validators.compose([Validators.required])],
      deadline: ['', Validators.compose([Validators.required])],
      timelineExpectation: ['', Validators.compose([Validators.required])],
      paymentType: ['', Validators.compose([Validators.required])],
      visibility: ['', Validators.compose([Validators.required])],
      budget: ['', Validators.compose([Validators.required, Validators.min(1), Validators.max(10000000)])],
      weeklyCommitment: ['', Validators.compose([Validators.required, Validators.min(1), Validators.max(60)])],
      terms: [false, Validators.requiredTrue]
    });
  }

  async ngOnInit() {
<<<<<<< HEAD
<<<<<<< HEAD
    console.log(this.activatedRoute.snapshot.params['jobId']);
    this.editing = this.activatedRoute.snapshot.params['jobId'] && this.activatedRoute.snapshot.params['jobId'] !== '';
    console.log(this.editing);
    if (!this.editing) {
      this.jobId = GenerateGuid();
    } else {
      console.log(this.jobToEdit);
      this.jobId = this.activatedRoute.snapshot.params['jobId'];
      this.jobSub = this.publicJobService.getPublicJob(this.activatedRoute.snapshot.params['jobId']).subscribe((result) => {
        if (result) {
          this.jobToEdit = result;
          this.shareableJobForm.controls['title'].patchValue(this.jobToEdit.information.title);
          this.shareableJobForm.controls['description'].patchValue(this.jobToEdit.information.description);
          this.shareableJobForm.controls['initialStage'].patchValue(this.jobToEdit.information.initialStage);
          this.shareableJobForm.controls['providerType'].patchValue(this.jobToEdit.information.providerType);
          this.shareableJobForm.controls['workType'].patchValue(this.jobToEdit.information.workType);
          this.shareableJobForm.controls['timelineExpectation'].patchValue(this.jobToEdit.information.timelineExpectation);
          this.shareableJobForm.controls['weeklyCommitment'].patchValue(this.jobToEdit.information.weeklyCommitment);
          this.shareableJobForm.controls['budget'].patchValue(this.jobToEdit.budget);
          this.shareableJobForm.controls['paymentType'].patchValue(this.jobToEdit.paymentType);
          this.shareableJobForm.controls['deadline'].patchValue(this.jobToEdit.deadline);
          this.shareableJobForm.controls['visibility'].patchValue(this.jobToEdit.visibility);
          this.shareableJobForm.controls['skills'].patchValue(this.jobToEdit.information.skills);
        }
      });
    }
=======
    this.publicJobService.generateReadableId('Testing 251 Creaton Job');
=======
>>>>>>> add bid and bid checker function works
    this.jobId = GenerateGuid();
>>>>>>> created the basic friendly-url generator and route
    this.authSub = this.authService.currentUser$.subscribe((user: User) => {
      this.currentUser = user;
      this.activatedRoute.params.take(1).subscribe((params) => {
        console.log(params);
        if (params['address'] && params['address'] !== this.currentUser.address) {
          this.recipientAddress = params['address'];
          this.loadUser(this.recipientAddress);
          this.isShareable = false;
        } else {
          this.pageLoaded = true;
          this.isShareable = true;
        }
      });
    });
    const canToUsdResp = await this.http.get('https://api.coinmarketcap.com/v2/ticker/2343/?convert=USD').toPromise();
    if (canToUsdResp.ok) {
      this.canToUsd = JSON.parse(canToUsdResp.text())['data']['quotes']['USD']['price'];
    }
    this.currentDate = new Date().toISOString().split('T')[0];
  }

  usdToCan(usd: number) {
    return getUsdToCan(this.canToUsd, usd);
  }


  detectFiles(event) {
    const file = event.target.files.item(0);
    this.uploadSingle(file);
  }

  async uploadSingle(file: File) {
    this.currentUpload = null;
    this.uploadFailed = false;
    this.fileTooBig = false;
    if (file.size > this.maxFileSizeBytes) {
      this.fileTooBig = true;
    } else {
      try {
        this.currentUpload = new Upload(this.currentUser.address, file.name, file.size);
        const upload: Upload = await this.uploadService.uploadJobAttachmentToStorage(this.jobId, this.currentUpload, file);
        if (upload) {
          this.uploadedFile = upload;
        } else {
          this.uploadFailed = true;
          this.currentUpload = null;
        }
      } catch (e) {
        this.uploadFailed = true;
        this.currentUpload = null;
      }
    }
  }

  async removeUpload(upload: Upload) {
    this.deleteFailed = false;
    const deleted = await this.uploadService.cancelJobAttachmentUpload(this.jobId, upload);
    if (deleted) {
      this.uploadedFile = null;
      this.currentUpload = null;
    } else {
      this.deleteFailed = true;
    }
  }


  ngOnDestroy() {
    if (this.authSub) { this.authSub.unsubscribe(); }
  }

  loadUser(address: string) {
    this.userService.getUser(address).then((user: User) => {
      this.recipient = user;
      this.pageLoaded = true;
    });
  }

  skillTagsUpdated(value: string) {
    if (!this.isShareable) {
      this.postForm.controls['skills'].setValue(value);
    } else {
      this.shareableJobForm.controls['skills'].setValue(value);
    }
  }
  checkForm() {
    if (!this.isShareable) {
      console.log(this.postForm);
    } else {
      console.log(this.shareableJobForm);
    }
  }
  workTypes(): Array<string> {
    return Object.values(WorkType);
  }

  setWorkType(type: WorkType) {
    if (!this.isShareable) {
      this.postForm.controls.workType.setValue(type);
    } else {
      this.shareableJobForm.controls.workType.setValue(type);
    }
  }

  setProviderType(type: string) {
    this.shareableJobForm.controls.providerType.setValue(type);
  }

  setVisibility(type: string) {
    this.shareableJobForm.controls.visibility.setValue(type);
  }

  timeRanges(): Array<string> {
    return Object.values(TimeRange);
  }

  setTimeRange(range: TimeRange) {
    console.log(range);
    if (this.isShareable) {
      this.shareableJobForm.controls.timelineExpectation.setValue(range);
    } else {
      this.postForm.controls.timelineExpectation.setValue(range);
    }
  }

  paymentTypes(): Array<string> {
    return Object.values(PaymentType);
  }

  setPaymentType(type: PaymentType) {
    if (this.isShareable) {
      this.shareableJobForm.controls.paymentType.setValue(type);
    } else {
      this.postForm.controls.paymentType.setValue(type);
    }
  }

  async submitForm() {
    this.isSending = true;
    let tags: string[];
    if (!this.isShareable) {
      tags = this.postForm.value.skills === '' ? [] : this.postForm.value.skills.split(',').map(item => item.trim());
    } else {
      tags = this.shareableJobForm.value.skills === '' ? [] : this.shareableJobForm.value.skills.split(',').map(item => item.trim());
    }
    if (tags.length > 6) {
      tags = tags.slice(0, 6);
    }

    try {
      if (!this.isShareable) {
        const job = new Job({
          id: this.jobId,
          hexId: this.ethService.web3js.utils.toHex(this.jobId.hashCode()),
          clientId: this.currentUser.address,
          providerId: this.recipientAddress,
          information: new JobDescription({
            description: this.postForm.value.description,
            title: this.postForm.value.title,
            initialStage: this.postForm.value.initialStage,
            skills: tags,
            attachments: this.uploadedFile ? [this.uploadedFile] : [],
            workType: this.postForm.value.workType,
            timelineExpectation: this.postForm.value.timelineExpectation,
            weeklyCommitment: this.postForm.value.weeklyCommitment
          }),
          paymentType: this.postForm.value.paymentType,
          budget: this.postForm.value.budget
        });
        const action = new IJobAction(ActionType.createJob, UserType.client);
        action.setPaymentProperties(job.budget, await this.jobService.getJobBudget(job), this.postForm.value.timelineExpectation,
          this.postForm.value.workType, this.postForm.value.weeklyCommitment, this.postForm.value.paymentType);
        this.sent = await this.jobService.handleJobAction(job, action);
        this.isSending = false;
        if (this.sent) {
          this.jobService.createJobChat(job, action, this.currentUser, this.recipient);
        }
      } else {
        console.log('shareable job!');
      }
    } catch (e) {
      this.sent = false;
      this.isSending = false;
    }
  }

  async submitShareableJob(isDraft: boolean) {
<<<<<<< HEAD
    this.isSending = true;
=======
>>>>>>> basic job getter and checker works
    let tags: string[];
    tags = this.shareableJobForm.value.skills === '' ? [] : this.shareableJobForm.value.skills.split(',').map(item => item.trim());
    if (tags.length > 6) {
      tags = tags.slice(0, 6);
    }
<<<<<<< HEAD
    const friendly = await this.publicJobService.generateReadableId(this.shareableJobForm.value.title);
    this.friendlyUrl = friendly;
    console.log('Friendly URL : ' + this.friendlyUrl);
    if (this.editing) {
      this.jobId = this.jobToEdit.id;
    }
=======
>>>>>>> basic job getter and checker works
    const job = new Job({
      id: this.jobId,
      hexId: this.ethService.web3js.utils.toHex(this.jobId.hashCode()),
      clientId: this.currentUser.address,
<<<<<<< HEAD
<<<<<<< HEAD
      friendlyUrl: this.friendlyUrl,
=======
>>>>>>> basic job getter and checker works
=======
      friendlyUrl: this.publicJobService.generateReadableId(this.shareableJobForm.value.title),
>>>>>>> created the basic friendly-url generator and route
      information: new JobDescription({
        description: this.shareableJobForm.value.description,
        title: this.shareableJobForm.value.title,
        initialStage: this.shareableJobForm.value.initialStage,
        skills: tags,
        attachments: this.uploadedFile ? [this.uploadedFile] : [],
        workType: this.shareableJobForm.value.workType,
        timelineExpectation: this.shareableJobForm.value.timelineExpectation,
<<<<<<< HEAD
        weeklyCommitment: this.shareableJobForm.value.weeklyCommitment,
        providerType: this.shareableJobForm.value.providerType
=======
        weeklyCommitment: this.shareableJobForm.value.weeklyCommitment
>>>>>>> basic job getter and checker works
      }),
      paymentType: this.shareableJobForm.value.paymentType,
      budget: this.shareableJobForm.value.budget,
      deadline: this.shareableJobForm.value.deadline,
      draft: isDraft
    });
<<<<<<< HEAD
<<<<<<< HEAD
    this.draft = isDraft;
    const action = new IJobAction(ActionType.createJob, UserType.client);
    action.setPaymentProperties(job.budget, await this.jobService.getJobBudget(job), this.postForm.value.timelineExpectation,
      this.postForm.value.workType, this.postForm.value.weeklyCommitment, this.postForm.value.paymentType);
    console.log('Shareable job submitted...');
    console.log('job created');
    job.state = JobState.acceptingOffers;
    this.sent = await this.publicJobService.handlepublicJob(job, action);
    this.isSending = false;
  }

  async updateJob() {
    // uploads the job
  }
=======
=======
    const action = new IJobAction(ActionType.createJob, UserType.client);
    action.setPaymentProperties(job.budget, await this.jobService.getJobBudget(job), this.postForm.value.timelineExpectation,
      this.postForm.value.workType, this.postForm.value.weeklyCommitment, this.postForm.value.paymentType);
<<<<<<< HEAD
>>>>>>> created the basic friendly-url generator and route
    console.log(this.shareableJobForm);
=======
>>>>>>> add bid and bid checker function works
    console.log('Shareable job submitted...');
    console.log('job created');
    const exists = await this.publicJobService.jobUrlExists(job.friendlyUrl);
    if (exists.length < 1) {
      console.log('just upload it');
    } else {
      console.log('wait might want to change the url mate');
      job.friendlyUrl = job.friendlyUrl + '-' + exists.length;
      console.log('new url : ' + job.friendlyUrl);
    }
    this.sent = await this.publicJobService.handlepublicJob(job, action);
    this.isSending = false;
  }

>>>>>>> basic job getter and checker works
}
