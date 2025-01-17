import { CommonModule } from '@angular/common'
import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'

import { ChatComponent } from './chat/chat.component'
import { CancelJobComponent } from './jobs/container/cancel-job/cancel-job.component'
import { EnterEscrowComponent } from './jobs/container/enter-escrow/enter-escrow.component'
import { EnterEscrowBscComponent } from './jobs/container/enter-escrow-bsc/enter-escrow-bsc.component'
import { JobContainerComponent } from './jobs/container/job-container.component'
import { JobDetailsComponent } from './jobs/container/job-details/job-details.component'
import { JobDashboardComponent } from './jobs/dashboard/job-dashboard.component'
import { PostComponent } from './jobs/post/post.component'

const routes: Routes = [
  {
    path: '',
    redirectTo: '/chat',
    pathMatch: 'full',
  },
  {
    path: 'chat',
    component: ChatComponent,
  },
  {
    path: 'chat/:address',
    component: ChatComponent,
  },
  {
    path: 'post/:address',
    component: PostComponent,
  },
  {
    path: 'post',
    component: PostComponent,
  },
  {
    path: 'post/:id',
    component: PostComponent,
  },
  {
    path: 'job/edit/:jobId',
    component: PostComponent,
  },
  {
    path: 'jobs',
    component: JobDashboardComponent,
  },
  {
    path: 'job/:id',
    component: JobContainerComponent,
    children: [
      {
        path: '',
        component: JobDetailsComponent,
      },
      {
        path: 'enter-escrow',
        component: EnterEscrowComponent,
      },
      {
        path: 'enter-bsc-escrow',
        component: EnterEscrowBscComponent,
      },
      {
        path: 'cancel',
        component: CancelJobComponent,
      },
    ],
  },
]

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class InboxRoutingModule {}
