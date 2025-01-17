import { Component, OnInit } from '@angular/core'
import { JobState } from '@class/job'
import { User } from '@class/user'
import { ActivatedRoute, Router } from '@angular/router'
import { AuthService } from '@service/auth.service'
import { PublicJobService } from '@service/public-job.service'
import { UserService } from '@service/user.service'
import { ToastrService } from 'ngx-toastr'
import { Subscription } from 'rxjs'
import { take } from 'rxjs/operators'

@Component({
  selector: 'app-job-bids',
  templateUrl: './job-bids.component.html',
  styleUrls: ['./job-bids.component.css'],
})
export class JobBidsComponent implements OnInit {
  authSub: Subscription
  bidsSub: Subscription
  currentUser: User
  bids: any
  jobId: any
  job: any
  isOpen: boolean
  jobSub: Subscription
  canSee = false

  constructor(
    private activatedRoute: ActivatedRoute,
    private authService: AuthService,
    private userService: UserService,
    private publicJobsService: PublicJobService,
    private router: Router,
    private toastr: ToastrService
  ) {}

  async ngOnInit() {
    this.authSub = this.authService.currentUser$.subscribe((user: User) => {
      this.currentUser = user
    })
    this.activatedRoute.params.pipe(take(1)).subscribe(params => {
      if (params['jobId']) {
        this.jobSub = this.publicJobsService
          .getPublicJob(params['jobId'])
          .subscribe(publicJob => {
            if (this.currentUser.address === publicJob.clientId) {
              this.job = publicJob
              this.isOpen = this.job.state === JobState.acceptingOffers
              this.jobId = params['jobId']
              this.canSee = true
              this.bidsSub = this.publicJobsService
                .getPublicJobBids(publicJob.id)
                .subscribe(result => {
                  this.bids = result
                })
            } else {
              this.canSee = false
            }
          })
      } else if (params['slug']) {
        this.jobSub = this.publicJobsService
          .getPublicJobBySlug(params['slug'])
          .subscribe(publicJob => {
            console.log(publicJob === null)
            if (publicJob === null) {
              this.canSee = false
            } else {
              if (this.currentUser.address === publicJob.clientId) {
                this.job = publicJob
                this.isOpen = this.job.state === JobState.acceptingOffers
                this.jobId = params['jobId']
                this.canSee = true
                this.bidsSub = this.publicJobsService
                  .getPublicJobBids(publicJob.id)
                  .subscribe(result => {
                    this.bids = result
                  })
              } else {
                this.canSee = false
              }
            }
          })
      }
    })
  }

  async getProviderData(id) {
    const provider = await this.userService.getUser(id)
    return provider
  }

  async chooseProvider(bidIndex) {
    const noAddress = await this.authService.isAuthenticatedAndNoAddress()
    if (noAddress) {
      this.toastr.error('Add Binance Chain Wallet (BEP2) or Metamask (BEP20) to Accept Offer')
      return
    }
    
    const bid = this.bids[bidIndex]
    const confirmed = confirm('Are you sure you want to choose this provider?')
    if (confirmed) {
      const chosen = await this.publicJobsService.closePublicJob(this.job, bid)
      if (chosen) {
        alert('Provider chosen!')
        const losingBids = this.bids.splice(0, bidIndex)
        const client = await this.userService.getUser(this.job.clientId)
        this.publicJobsService.notifyLosers(this.job, client, losingBids)
        this.router.navigate(['/inbox/job', this.job.id])
      } else {
        alert('Something went wrong. please try again later')
      }
    }
  }

  async declineProvider(bidIndex) {
    const bid = this.bids[bidIndex]
    const confirmed = confirm(
      "Are you sure you want to decline this provider's offer?"
    )
    if (confirmed) {
      const chosen = await this.publicJobsService.declineBid(this.job, bid)
      if (chosen) {
        const client = await this.userService.getUser(this.job.clientId)
        this.publicJobsService.notifyLosers(this.job, client, [bid])
      } else {
        alert('Something went wrong. please try again later')
      }
    }
  }
}
