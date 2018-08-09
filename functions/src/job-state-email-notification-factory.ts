import { ActionType } from './job-action-type';
import { UserType } from './user-type';

const sgMail = require('@sendgrid/mail');
const replyTo = 'noreply@canya.com';
/*
 * Interfaces
 */
interface EmailMessage {
  to: string;
  subject: string;
  title: string;
  bodyHtml: string;
}

interface IJobStateEmailNotification {
  interpolateTemplates(db: FirebaseFirestore.Firestore, jobId: string, userType?: UserType): void;
  deliver(sendgridApiKey: string, returnUri: string): void;
}

/*
 * Abstract (Parent/Base Class)
 */
abstract class AEmailNotification implements IJobStateEmailNotification {
  db: FirebaseFirestore.Firestore
  initiatedByUid: string;
  jobId: string;
  jobData: any;
  clientData: any;
  providerData: any;
  emailMessages: EmailMessage[];

  constructor() {
    this.emailMessages = new Array();
  }

  // Parent method for building 'EmailMessage' objects.
  // Each factory calls this with super.interpolateTemplates(db, jobId);
  // And then does it's own work to interpolate the html template
  public interpolateTemplates(db: FirebaseFirestore.Firestore, jobId: string, userType?: UserType): Promise<void> {
    this.db = db;
    console.log('AEmailNotification.interpolateTemplates()');
    return this.populateDataObjects(jobId);
  }

  // Send the built 'EmailMessage' via sendgrid
  public deliver(sendgridApiKey: string, returnUri: string): void {
    sgMail.setApiKey(sendgridApiKey);
    sgMail.setSubstitutionWrappers('{{', '}}');

    this.emailMessages.forEach(emailMessage => {
      console.log('+ sending message to', emailMessage.to);
      sgMail.send({
        to: emailMessage.to,
        from: replyTo,
        subject: emailMessage.subject,
        html: emailMessage.bodyHtml,
        substitutions: {
          title: emailMessage.title,
          returnLinkText: 'View Job Details Here',
          returnLinkUrl: `${returnUri}/inbox/job/${this.jobData.id}`,
        },
        templateId: '4fc71b33-e493-4e60-bf5f-d94721419db5'
      }, (error, result) => {
        if (error) {
          console.error('! error sending message:', error.response.body)
        }
      });
    });
  }

  // Get a user by ID
  private async getUserObjects(userId: string): Promise<any> {
    console.log('AEmailNotification.getUserObjects() userId:', userId);
    try {
      const user = await this.db.collection('users').doc(userId).get();
      console.log('+ user data retrieved for:', user.data().email);
      return user.data();
    } catch (error) {
      console.error(`! unable to retrieve user data using ID: ${userId}`, error);
      throw new Error(error);
    }
  }

  // Locate the job document in the collection, and populate the this.jobData object member
  private async populateDataObjects(jobId: string) {
    console.log('AEmailNotification.populateJobData()');
    // Get the job object from the 'jobs' collection
    try {
      const data = await this.db.collection('jobs').doc(jobId).get();
      this.jobData = data.data();
      console.log('+ job data populated:', this.jobData);
    } catch (error) {
      console.error(`! unable to retrieve job data using ID: ${jobId}`, error);
      throw new Error(error);
    }
    if (!this.jobData) {
      const error = `no job data could be found using ID: ${jobId}`;
      console.warn(error);
    }
    console.log('+ retrieved job data:', this.jobData);

    // Populate the required user objects for client & provider:
    this.clientData = await this.getUserObjects(this.jobData.clientId);
    this.providerData = await this.getUserObjects(this.jobData.providerId);
  }

  getRecipient(userType: UserType) {
    return userType === UserType.client ? this.providerData : this.clientData;
  }

  getSender(userType: UserType) {
    return userType === UserType.client ? this.clientData : this.providerData;
  }
}

/*
 * Implementations
 */

// Send notification to the client that a new job has been requested
class ClientJobRequestNotification extends AEmailNotification {
  constructor() {
    super();
  }

  async interpolateTemplates(db: FirebaseFirestore.Firestore, jobId: string): Promise<void> {
    console.log('ClientJobRequestNotification.interpolateTemplates()');
    try {
      await super.interpolateTemplates(db, jobId);
    } catch (error) {
      console.error(error);
    }
    const title = `You have a work request from ${this.clientData.name}`
    this.emailMessages.push({
      to: this.providerData.email,
      subject: title,
      title: title,
      bodyHtml: `
      Dear ${this.providerData.name},<br>
      ${this.clientData.name} has requested a job: "${this.jobData.information.description}". Please login to CanWork to review this job.`
    });
    console.log('+ dump emailMessages:', this.emailMessages);
  }
}

class CancelJobNotification extends AEmailNotification {
  constructor() {
    super();
  }

  async interpolateTemplates(db: FirebaseFirestore.Firestore, jobId: string, userType: UserType): Promise<void> {
    console.log('CancelJobNotification.interpolateTemplates()');
    try {
      await super.interpolateTemplates(db, jobId);
    } catch (error) {
      console.error(error);
    }

    const recipient = this.getRecipient(userType);
    const sender = this.getSender(userType);
    const title = `${sender.name} has cancelled the job`;

    this.emailMessages.push({
      to: recipient.email,
      subject: title,
      title: title,
      bodyHtml: `
      Dear ${recipient.name},<br>
      ${sender.name} has cancelled a job: "${this.jobData.information.description}".`
    });
    console.log('+ dump emailMessages:', this.emailMessages);
  }
}

// Send notification to client that the requested job has been accepted by the provider
class ClientJobRequestAcceptedNotification extends AEmailNotification {
  constructor() {
    super();
  }

  async interpolateTemplates(db: FirebaseFirestore.Firestore, jobId: string): Promise<void> {
    console.log('ClientJobRequestAcceptedNotification.interpolateTemplates()');
    try {
      await super.interpolateTemplates(db, jobId);
    } catch (error) {
      console.error(error);
    }

    const title = `Your work request to ${this.clientData.name} has been accepted`
    this.emailMessages.push({
      to: this.clientData.email,
      subject: title,
      title: title,
      bodyHtml: `
      Dear ${this.clientData.name},<br>
      ${this.providerData.name} has accepted your job request: "${this.jobData.information.description}". A payment into the escrow is now required to proceed.<br><br>
      Please login to CANWork to review this job.`
    });
    console.log('+ dump emailMessages:', this.emailMessages);
  }
}

// Send notification to client that the requested job has been declined
class ClientJobRequestDeclinedNotification extends AEmailNotification {
  constructor() {
    super();
  }

  async interpolateTemplates(db: FirebaseFirestore.Firestore, jobId: string): Promise<void> {
    console.log('ClientJobRequestDeclinedNotification.interpolateTemplates()');
    try {
      await super.interpolateTemplates(db, jobId);
    } catch (error) {
      console.error(error);
    }

    const title = `Your work request to ${this.providerData.name} has been declined`
    this.emailMessages.push({
      to: this.clientData.email,
      subject: title,
      title: title,
      bodyHtml: `
      Dear ${this.clientData.name},<br>
      ${this.providerData.name} has declined your job request: "${this.jobData.information.description}". Please login to CANWork to review this job.`
    });
    console.log('+ dump emailMessages:', this.emailMessages);
  }
}

// Send notification to provider that the requested job has a counter offer
class ClientJobRequestCounterOfferNotification extends AEmailNotification {
  constructor() {
    super();
  }

  async interpolateTemplates(db: FirebaseFirestore.Firestore, jobId: string): Promise<void> {
    console.log('ClientJobRequestCounterOfferNotification.interpolateTemplates()');
    try {
      await super.interpolateTemplates(db, jobId);
    } catch (error) {
      console.error(error);
    }

    // Loop over job actions, find last matching current action type 'Counter offer'
    // If executedBy provider... send email to client
    // Else exectuedBy client, send email to provider

    const title = `Your work request to ${this.clientData.name} has a counter offer`
    this.emailMessages.push({
      to: this.providerData.email,
      subject: title,
      title: title,
      bodyHtml: `
      Dear ${this.providerData.name},<br>
      ${this.clientData.name} has made a counter offer to your job request: "${this.jobData.information.description}". Please login to CANWork to review this job.`
    });
    console.log('+ dump emailMessages:', this.emailMessages);
  }
}

// Send notification to client that their funds have been deposited into escrow
class ClientJobRequestEscrowedFundsNotification extends AEmailNotification {
  constructor() {
    super();
  }

  async interpolateTemplates(db: FirebaseFirestore.Firestore, jobId: string): Promise<void> {
    console.log('ClientJobRequestEscrowedFundsNotification.interpolateTemplates()');
    try {
      await super.interpolateTemplates(db, jobId);
    } catch (error) {
      console.error(error);
    }

    const tx = this.jobData.paymentLog[this.jobData.paymetLog.length - 1].txId;
    const etherscanUri = `https://etherscan.io/tx/${tx}`;

    const title = `Your escrow deposit was successful`
    this.emailMessages.push({
      to: this.providerData.email,
      subject: title,
      title: title,
      bodyHtml: `
      Dear ${this.clientData.name},<br>
      Your escrow funds have been deposited at <a href='${etherscanUri}'>${tx}</a>.`
    });
    console.log('+ dump emailMessages:', this.emailMessages);
  }
}

// Send notification to the provider that they may commence the job
class ClientJobRequestCommenceNotification extends AEmailNotification {
  constructor() {
    super();
  }

  async interpolateTemplates(db: FirebaseFirestore.Firestore, jobId: string): Promise<void> {
    console.log('ClientJobRequestCommenceNotification.interpolateTemplates()');
    try {
      await super.interpolateTemplates(db, jobId);
    } catch (error) {
      console.error(error);
    }

    const tx = this.jobData.paymentLog[this.jobData.paymetLog.length - 1].txId;
    const etherscanUri = `https://etherscan.io/tx/${tx}`;

    const title = `Your escrow deposit was successful`
    this.emailMessages.push({
      to: this.providerData.email,
      subject: title,
      title: title,
      bodyHtml: `
      Dear ${this.providerData.name},<br>
      ${this.clientData.name} has made a payment into escrow for the job request: "${this.jobData.information.description}".
      The transaction of this deposit has the transaction ID: <a href='${etherscanUri}'>${tx}</a>.`
    });
    console.log('+ dump emailMessages:', this.emailMessages);
  }
}

export function notificationEmail(action: string) {
  console.log('+ build factory object for action:', action)

  const actions = {}

  actions[ActionType.createJob] = ClientJobRequestNotification
  actions[ActionType.cancelJob] = CancelJobNotification
  actions[ActionType.acceptTerms] = ClientJobRequestAcceptedNotification
  actions[ActionType.declineTerms] = ClientJobRequestDeclinedNotification
  actions[ActionType.counterOffer] = ClientJobRequestCounterOfferNotification
  actions[ActionType.authoriseEscrow] = ClientJobRequestEscrowedFundsNotification
  actions[ActionType.createJob] = ClientJobRequestCommenceNotification

  const jobAction = actions[action]

  if (!jobAction) {
    console.log(`! unknown action type: ${action}`)
    return undefined
  }

  return new jobAction()
}
