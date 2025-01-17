import { Component, OnDestroy, OnInit } from '@angular/core'
import { FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms'
import { ActivatedRoute, Router } from '@angular/router'
import { BinanceService } from '@service/binance.service'
import { GitService } from '@service/git.service'
import { DecoratedIssue } from '@class/git'
import {
  Job,
  JobDescription,
  PaymentType,
  TimeRange,
  WorkType,
  JobState,
} from '@class/job'
import { ActionType, IJobAction } from '@class/job-action'
import { Upload } from '@class/upload'
import { User, UserType } from '@class/user'
import '@extensions/string'
import { AuthService } from '@service/auth.service'
import { JobService } from '@service/job.service'
import { ToastrService } from 'ngx-toastr'
import { PublicJobService } from '@service/public-job.service'
import { UploadService } from '@service/upload.service'
import { UserService } from '@service/user.service'
import { GenerateGuid } from '@util/generate.uid'
import * as _ from 'lodash'
import { Subscription } from 'rxjs'
import { take } from 'rxjs/operators'


@Component({
  selector: 'app-post',
  templateUrl: './post.component.html',
  styleUrls: ['./post.component.css'],
})
export class PostComponent implements OnInit, OnDestroy {
  postForm: FormGroup = null
  shareableJobForm: FormGroup = null
  pageLoaded = false
  paymentType = PaymentType
  recipientAddress = ''
  recipient: User = null
  currentUser: User
  slug = ''
  authSub: Subscription
  routeSub: Subscription
  jobSub: Subscription
  currentDate = ''
  isShareable = false
  isSending = false
  sent = false
  draft = false
  editing = false
  error = false
  postToProvider = false
  errorGitUrl = ''
  skillTagsList: string[]
  gitUpdatedTags: string[] = []

  jobToEdit: Job
  jobId: string

  currentUpload: Upload
  uploadedFile: Upload
  maxFileSizeBytes = 50000000 // 50mb
  fileTooBig = false
  uploadFailed = false
  deleteFailed = false
    

  // usdToAtomicCan: number // this is not used
  providerTypes = [
    {
      name: 'Content Creators',
      img: 'writer.svg',
      id: 'contentCreator',
    },
    {
      name: 'Software Developers',
      img: 'dev.svg',
      id: 'softwareDev',
    },
    {
      name: 'Designers & Creatives',
      img: 'creatives.svg',
      id: 'designer',
    },
    {
      name: 'Financial Experts',
      img: 'finance.svg',
      id: 'finance',
    },
    {
      name: 'Marketing & Seo',
      img: 'marketing.svg',
      id: 'marketing',
    },
    {
      name: 'Virtual Assistants',
      img: 'assistant.svg',
      id: 'virtualAssistant',
    },
  ]


  
  constructor(
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private formBuilder: FormBuilder,
    private userService: UserService,
    private authService: AuthService,
    private jobService: JobService,
    private gitService: GitService,
    private binanceService: BinanceService,
    private publicJobService: PublicJobService,
    private uploadService: UploadService,
    private toastr: ToastrService,
  ) {
    this.postForm = formBuilder.group({
      url: [
        '',
      ],      
      description: [
        '',
        Validators.compose([Validators.required, Validators.maxLength(10000)]),
      ],
      title: [
        '',
        Validators.compose([Validators.required, Validators.maxLength(64)]),
      ],
      initialStage: [
        '',
        Validators.compose([Validators.required, Validators.maxLength(3000)]),
      ],
      skills: [
        '',
        Validators.compose([
          Validators.required,
          Validators.minLength(1),
          Validators.maxLength(100),
        ]),
      ],
      attachments: [''],
      workType: ['', Validators.compose([Validators.required])],
      timelineExpectation: ['', Validators.compose([Validators.required])],
      weeklyCommitment: [
        ''
      ],
      paymentType: ['Fixed price', Validators.compose([Validators.required])], // Please remove 'Fixed price' once the 'hourly rate' workflow is ready!
      budget: [
        '',
        Validators.compose([
          Validators.required,
          Validators.min(1),
          Validators.max(10000000),
          Validators.pattern('^[0-9]*$'),
        ]),
      ],
      terms: [false, Validators.requiredTrue],
    })
    this.shareableJobForm = formBuilder.group({
      url: [
        '',
      ],
      description: [
        '',
        Validators.compose([Validators.required, Validators.maxLength(10000)]),
      ],
      title: [
        '',
        Validators.compose([Validators.required, Validators.minLength(5), Validators.maxLength(64)]),
      ],
      initialStage: [
        '',
        Validators.compose([
          Validators.required,
          Validators.minLength(1),
          Validators.maxLength(100),
        ]),
      ],
      skills: [
        '',
        Validators.compose([
          Validators.required,
          Validators.minLength(1),
          Validators.maxLength(100),
        ]),
      ],
      attachments: [''],
      workType: ['', Validators.compose([Validators.required])],
      providerType: ['', Validators.compose([Validators.required])],
      deadline: [
        '',
        Validators.compose([
          Validators.required,
          Validators.minLength(1),
          Validators.maxLength(100),
          this.ValidateCurrentDate,
        ]),
      ],
      timelineExpectation: ['', Validators.compose([Validators.required])],
      paymentType: ['Fixed price', Validators.compose([Validators.required])], // Please remove 'Fixed price' once the 'hourly rate' workflow is ready!
      visibility: ['', Validators.compose([Validators.required])],
      budget: [
        '',
        Validators.compose([
          Validators.required,
          Validators.min(1),
          Validators.max(10000000),
          Validators.pattern('^[0-9]*$'),
        ]),
      ],
      weeklyCommitment: [
        ''
      ],
      terms: [false, Validators.requiredTrue],
    })
  }

  async ngOnInit() {
    this.editing =
      this.activatedRoute.snapshot.params['jobId'] &&
      this.activatedRoute.snapshot.params['jobId'] !== ''
    this.authSub = this.authService.currentUser$.subscribe((user: User) => {
      this.currentUser = user
      this.activatedRoute.params.take(1).subscribe(params => {
        if (
          params['address'] &&
          params['address'] !== this.currentUser.address
        ) {
          this.recipientAddress = params['address']
          this.loadUser(this.recipientAddress)
          this.isShareable = false
          this.postToProvider = true
        } else {
          this.isShareable = true
        }
      })
      if (!this.editing) {
        this.jobId = GenerateGuid()
        this.shareableJobForm.controls['initialStage'].patchValue(
          'Ready'
        )
        this.shareableJobForm.controls['workType'].patchValue(
          'One off'
        )
        this.shareableJobForm.controls[
          'timelineExpectation'
        ].patchValue('Up to 1 Year')
        this.postForm.controls['initialStage'].patchValue(
          'Ready'
        )
        this.postForm.controls['workType'].patchValue(
          'One off'
        )
        this.postForm.controls[
          'timelineExpectation'
        ].patchValue('Up to 1 Year')        
        if (!this.postToProvider) this.pageLoaded = true
      } else {
        this.jobId = this.activatedRoute.snapshot.params['jobId']
        this.jobSub = this.publicJobService
          .getPublicJob(this.activatedRoute.snapshot.params['jobId'])
          .subscribe(result => {
            if (result) {
              const canEdit = result.clientId === this.currentUser.address
              if (canEdit) {
                this.jobToEdit = result
                this.shareableJobForm.controls['title'].patchValue(
                  this.jobToEdit.information.title
                )
                this.shareableJobForm.controls['description'].patchValue(
                  this.jobToEdit.information.description
                )
                this.shareableJobForm.controls['initialStage'].patchValue(
                  this.jobToEdit.information.initialStage
                )
                this.shareableJobForm.controls['providerType'].patchValue(
                  this.jobToEdit.information.providerType
                )
                this.shareableJobForm.controls['workType'].patchValue(
                  this.jobToEdit.information.workType
                )
                this.shareableJobForm.controls[
                  'timelineExpectation'
                ].patchValue(this.jobToEdit.information.timelineExpectation)
                this.shareableJobForm.controls['weeklyCommitment'].patchValue(
                  this.jobToEdit.information.weeklyCommitment
                )
                this.shareableJobForm.controls['budget'].patchValue(
                  this.jobToEdit.budget
                )
                this.shareableJobForm.controls['paymentType'].patchValue(
                  this.jobToEdit.paymentType
                )
                this.shareableJobForm.controls['deadline'].patchValue(
                  this.jobToEdit.deadline
                )
                this.shareableJobForm.controls['visibility'].patchValue(
                  this.jobToEdit.visibility
                )

                this.shareableJobForm.controls['skills'].patchValue(
                  this.jobToEdit.information.skills
                )
                if (this.jobToEdit.information.attachments.length > 0) this.uploadedFile = this.jobToEdit.information.attachments[0]
                this.pageLoaded = true

              } else {
                this.router.navigateByUrl('/not-found')
              }
            }
          })
      }
    })
    /*
    // this is not used
    try {
      this.usdToAtomicCan = await this.binanceService.getUsdToAtomicCan()
    } catch (e) {
      this.usdToAtomicCan = null
    }
    */
    this.currentDate = new Date().toISOString().split('T')[0]
    this.notifyAddAddressIfNecessary()
  }

  async notifyAddAddressIfNecessary() {
    const noAddress = await this.authService.isAuthenticatedAndNoAddress()
    const user = await this.authService.getCurrentUser()
    if (noAddress && user.type == 'User') {
      this.toastr.warning('Add Binance Chain Wallet (BEP2) or Metamask (BEP20) to create jobs')
    }
  }
  
  ValidateCurrentDate(control: AbstractControl) {
    if (!control.value.length) return null; // this is validated from Validators.required
    
    let deadline = new Date(control.value);
    let today = new Date();
    today.setHours(0,0,0,0);
    if (deadline < today) return {pastDueDate: true};

    return null;
  }

  detectFiles(event) {
    const file = event.target.files.item(0)
    this.uploadSingle(file)
  }

  async uploadSingle(file: File) {
    this.currentUpload = null
    this.uploadFailed = false
    this.fileTooBig = false
    if (file.size > this.maxFileSizeBytes) {
      this.fileTooBig = true
    } else {
      try {
        this.currentUpload = new Upload(
          this.currentUser.address,
          file.name,
          file.size
        )
        const upload: Upload = await this.uploadService.uploadJobAttachmentToStorage(
          this.jobId,
          this.currentUpload,
          file
        )
        if (upload) {
          this.uploadedFile = upload
        } else {
          this.uploadFailed = true
          this.currentUpload = null
        }
      } catch (e) {
        this.uploadFailed = true
        this.currentUpload = null
      }
    }
  }

  async removeUpload(upload: Upload) {
    this.deleteFailed = false
    const deleted = await this.uploadService.cancelJobAttachmentUpload(
      this.jobId,
      upload
    )
    if (deleted) {
      this.uploadedFile = null
      this.currentUpload = null
    } else {
      this.deleteFailed = true
    }
  }

  ngOnDestroy() {
    if (this.authSub) {
      this.authSub.unsubscribe()
    }
  }

  async loadUser(address: string) {
    this.recipient = await this.userService.getUser(address)
    this.pageLoaded = true
    /**
    this.userService.getUser(address).then((user: User) => {
      this.recipient = user;
    });
     */
  }

  skillTagsLoaded(tagsList: string[]) {
    this.skillTagsList = tagsList
  }

  skillTagsUpdated(value: string) {
    if (!this.isShareable) {
      this.postForm.controls['skills'].setValue(value)
    } else {
      this.shareableJobForm.controls['skills'].setValue(value)
    }
  }
  onBlurMethod(name) {
    this.shareableJobForm.controls[name].markAsDirty();
    this.shareableJobForm.controls[name].updateValueAndValidity();
  }
  onFocusMethod(name) {
    this.shareableJobForm.controls[name].markAsPristine();
  }  
  checkForm() {
    if (!this.isShareable) {
      console.log(this.postForm)
    } else {
      console.log(this.shareableJobForm)
    }
  }
  workTypes(): Array<string> {
    return Object.values(WorkType)
  }

  setWorkType(type: WorkType) {
    if (!this.isShareable) {
      this.postForm.controls.workType.setValue(type)
    } else {
      this.shareableJobForm.controls.workType.setValue(type)
    }
  }

  setProviderType(type: string) {
    this.shareableJobForm.controls.providerType.setValue(type)
  }

  setVisibility(type: string) {
    this.shareableJobForm.controls.visibility.setValue(type)
  }

  timeRanges(): Array<string> {
    return Object.values(TimeRange)
  }

  setTimeRange(range: TimeRange) {
    console.log(range)
    if (this.isShareable) {
      this.shareableJobForm.controls.timelineExpectation.setValue(range)
    } else {
      this.postForm.controls.timelineExpectation.setValue(range)
    }
  }

  paymentTypes(): Array<string> {
    return Object.values(PaymentType)
  }

  setPaymentType(type: PaymentType) {
    if (this.isShareable) {
      this.shareableJobForm.controls.paymentType.setValue(type)
    } else {
      this.postForm.controls.paymentType.setValue(type)
    }
  }

  async submitForm() {
    this.error = false
    this.isSending = true
    let tags: string[]
    if (!this.isShareable) {
      tags =
        this.postForm.value.skills === ''
          ? []
          : this.postForm.value.skills.split(',').map(item => item.trim())
    } else {
      tags =
        this.shareableJobForm.value.skills === ''
          ? []
          : this.shareableJobForm.value.skills
              .split(',')
              .map(item => item.trim())
    }
    if (tags.length > 6) {
      tags = tags.slice(0, 6)
    }

    try {
      if (!this.isShareable) {
        const job = new Job({
          id: this.jobId,
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
            weeklyCommitment: this.postForm.value.weeklyCommitment,
          }),
          paymentType: this.postForm.value.paymentType,
          budget: this.postForm.value.budget,
        })
        const action = new IJobAction(ActionType.createJob, UserType.client)
        action.setPaymentProperties(
          job.budget,
          this.postForm.value.timelineExpectation,
          this.postForm.value.workType,
          this.postForm.value.weeklyCommitment,
          this.postForm.value.paymentType
        )
        this.sent = await this.jobService.handleJobAction(job, action)
        this.isSending = false
        if (this.sent) {
          this.jobService.createJobChat(
            job,
            action,
            this.currentUser,
            this.recipient
          )
        }
      } else {
        console.log('shareable job!')
      }
    } catch (e) {
      this.sent = false
      this.error = true
      this.isSending = false
    }
  }
  
  handleGitError(msg) {
    let formRef = this.shareableJobForm
    if (!this.isShareable) formRef = this.postForm

    this.errorGitUrl = msg
    this.isSending = false
    this.shareableJobForm.controls['url'].enable()
  }
  
  gitApiInvoke(url) {
    let formRef = this.shareableJobForm
    if (!this.isShareable) formRef = this.postForm   
   
    this.errorGitUrl = '';    
    this.isSending = true
    formRef.controls['url'].patchValue(url)
    formRef.controls['url'].disable()
    
    this.gitService
      .getDecoratedIssue(url)
      .take(1)
      .subscribe(async (issue: DecoratedIssue) => {
        if (!!issue.error) return this.handleGitError(issue.error)
        if (!!issue.language) {
          let repoLang = issue.language.toLowerCase()

          let foundTag = ''
          for (let tag of this.skillTagsList) {
            if (tag.toLowerCase() == repoLang) {
              // it's equal, priority, break (i.e. java over javascript as a repoLang)
              foundTag = tag
              break
            }
            // contained into
            if (tag.toLowerCase().indexOf(repoLang) > -1) foundTag = tag
          }
          let updatedTags = []
          if (!!foundTag) updatedTags.push(foundTag)
            else updatedTags.push(issue.language) // add new tag,  not found existing one
          this.gitUpdatedTags = updatedTags
        }
        let description = '';
        description += issue.inputValues.provider +' "'+ issue.inputValues.project + '" issue ' + issue.inputValues.issue + ' : "' + issue.title + '"'
        description += '\n'
        description += '['+url+']'
        description += '\n\n'
        description += issue.description
        
        formRef.controls['title'].patchValue(issue.title.substring(0, 64))
        formRef.controls['description'].patchValue(description)
        if (!!this.isShareable) formRef.controls['providerType'].patchValue('softwareDev')
        if (issue.state.toLowerCase().indexOf('open') == -1) {
          this.errorGitUrl = 'Pay attention, issue is not open';
          formRef.controls['url'].enable()
        }
        this.isSending = false        
        
      },
      error => {
        let errorMsg = 'Network error'
        if (!!error && !!error.error && !!error.error.message) errorMsg = error.error.message
        this.handleGitError(errorMsg)     
      })
   

  }

  onGitPaste(event: ClipboardEvent) {
    let clipboardData = event.clipboardData;
    let pastedText = clipboardData.getData('text');
    this.gitApiInvoke(pastedText);
  }
  
  onBFGit() {
    this.errorGitUrl = '';
  }


  async submitShareableJob(isDraft: boolean) {
    this.isSending = true
    this.error = false

    try {
      let tags: string[]
      tags =
        this.shareableJobForm.value.skills === ''
          ? []
          : this.shareableJobForm.value.skills
              .split(',')
              .map(item => item.trim())
      if (tags.length > 6) {
        tags = tags.slice(0, 6)
      }

      if (this.editing) {
        this.jobId = this.jobToEdit.id
        this.slug = this.jobToEdit.slug
      } else {
        this.slug = await this.publicJobService.generateReadableId(
          this.shareableJobForm.value.title
        )
      }
      const job = new Job({
        id: this.jobId,
        clientId: this.currentUser.address,
        slug: this.slug,
        information: new JobDescription({
          description: this.shareableJobForm.value.description,
          title: this.shareableJobForm.value.title,
          initialStage: this.shareableJobForm.value.initialStage,
          skills: tags,
          attachments: this.uploadedFile ? [this.uploadedFile] : [],
          workType: this.shareableJobForm.value.workType,
          timelineExpectation: this.shareableJobForm.value.timelineExpectation,
          weeklyCommitment: this.shareableJobForm.value.weeklyCommitment,
          providerType: this.shareableJobForm.value.providerType,
        }),
        visibility: this.shareableJobForm.value.visibility,
        paymentType: this.shareableJobForm.value.paymentType,
        budget: this.shareableJobForm.value.budget,
        deadline: this.shareableJobForm.value.deadline,
        draft: isDraft,
      })
      this.draft = isDraft
      const action = new IJobAction(ActionType.createJob, UserType.client)
      action.setPaymentProperties(
        job.budget,
        this.shareableJobForm.value.timelineExpectation,
        this.shareableJobForm.value.workType,
        this.shareableJobForm.value.weeklyCommitment,
        this.shareableJobForm.value.paymentType
      )
      if (!isDraft) {
        job.state = JobState.acceptingOffers
      } else {
        job.state = JobState.draft
      }
      this.sent = await this.publicJobService.handlePublicJob(job, action)
      this.isSending = false
    } catch (e) {
      this.sent = false
      this.isSending = false
      this.error = true
    }
  }

  async updateJob() {
    // uploads the job
  }
}
