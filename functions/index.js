const admin = require('firebase-admin')
const functions = require('firebase-functions');
const firebase_tools = require('firebase-tools')
const webpush = require('web-push')
const nodemailer = require('nodemailer')
const config = require('./config')
const adminCredentials = require('./feynman-mvp-firebase-adminsdk-3zyg9-421740ce6a.json')

admin.initializeApp({
	credential: admin.credential.cert(adminCredentials),
	databaseUrl: "https://feynman-mvp.firebaseio.com"
})

const vapidKeys = config.vapidKeys
webpush.setVapidDetails(
	'mailto:hubewasi@gmail.com',
	vapidKeys.publicKey,
	vapidKeys.privateKey
)

const gmailPass = config.gmailPass
const oauth = config.oauth
const transporter = nodemailer.createTransport({
	host: 'smtp.gmail.com',
	port: 465,
	secure: true,
	service: 'Gmail',
	auth: oauth
})
const firestore = admin.firestore()
firestore.settings({timestampsInSnapshots: true})

exports.notificationOnNewMessage = functions.firestore.document('/workspaces/{wid}/messages/{mid}').onCreate((doc, context) => {
	_updateParticipants()
	
	const params = context.params;
	const workspaceDocSnap = doc
	const workspaceDocData = workspaceDocumentSnap.data()

	const messageId = params.mid;
	const chatroomId = params.wid;

	const author = workspaceDocData.author;
	const authorName = author.name;
	const authorUid = author.uid
	const messageContent = workspaceDocData.content
	const messageTimestamp = workspaceDocData.timestamp

	participantsDoc = firestore.doc('/workspaces/' + chatroomId + '/participants/')

	participantsDoc.get().then(participantsDocSnap => {
		const participantsDocData = participantsDocSnap.data()
		const participantsUids = participantsDocData.participants

		participantsUids.forEach(participantUid => {
			if(participantUid !== authorUid) {
				_sendNotificationByUid(participantUid, authorName + " sent a message...", messageContent)	
			}
		})
	})

	return null;
})

exports.emailOnStudentHelp = functions.firestore.document('/workspaces/{wid}').onUpdate((change, context) => {
	const workspaceDocDataBefore = change.before.data()
	const workspaceDocDataAfter = change.after.data()
	const params = context.params

	const askingBefore = workspaceDocDataBefore.isAskingQuestion
	const askingAfter = workspaceDocDataAfter.isAskingQuestion
	// if before they werent asking and after they are, then it's the change i'm interested in
	// otherwise end the execution
	if(!(workspaceDocDataAfter.isAskingQuestion === true && workspaceDocDataBefore.isAskingQuestion === false)) {
		return
	}

	const askerUid = workspaceDocDataBefore.ownerUid
	const askerName = workspaceDocDataBefore.ownerName
	const askerFirstName = askerName.split(' ')[0]
    
	const workspaceOwnerUid = workspaceDocDataBefore.teacherUid
	const workspaceId = params.wid

	const workspaceUrl = "https://feynman.online/" + workspaceOwnerUid + "/workspace/" + workspaceId


	firestore.collection('/workspaces/').where('teacherUid', '==', workspaceOwnerUid).where('isOffice', '==', true).get().then(assistantsQuerySnap => {
		const assistantsQueryDocsSnaps = assistantsQuerySnap.docs
		assistantsQueryDocsSnaps.forEach(assitantQueryDocSnap => {
			const assistantQueryDocData = assitantQueryDocSnap.data()
			_sendEmailByUid(
				assistantQueryDocData.ownerUid,
				askerFirstName + " asked a question on Feynman.",
				askerName + " asked a question in a workspace you're a TA in. Here's the link to the workspace: " + workspaceUrl,
				"<p>" + askerName + " asked a question in a workspace you're a TA in. Click <a href=\"" + workspaceUrl + "\">here</a> to go there. "
			)
		})
	})
	
	// SUBJECT: "{first NAME} asked a question
	// BODY: "{NAME} asked a question in a workspace you're a TA in. Here's the link to the workspace: {LINK}"
	// HTML: same but LINK is an href
})


exports.updateParticipants = functions.https.onCall((data, context) => {
	_updateParticipants(data.workspaceid)
})

function _updateParticipants(workspaceId) {
	//WIP
	const participantsDoc = firestore.doc('/workspaces/' + workspaceId + '/participants/')

	participantsDoc.get().then(participantsDocSnap => {
		const participantsDocData = participantsDocSnap.data()
		participantsDocData.participants.forEach(participant => {
		})
	})
}

exports.sendEmailByUid = functions.https.onCall((data, context) => {
	_sendEmailByUid(data.uid, data.subject, data.body, data.html)
})

function _sendEmailByUid(uid, subject, body, html) {
	admin.auth().getUser(uid).then(user => {
		const userEmail = user.email
		_sendEmail(userEmail, subject, body, html)
	})
}

function _sendEmail(email, subject, text, html) {

	const message = {
		from: '"Feynman Notifications" feynmannotif@gmail.com',
		to: email,
		subject,
		text,
		html
	}

	transporter.sendMail(message, (error, response) => {
		console.log(error)
		console.log(response)
	})
}
exports.sendNotificationByUid = functions.https.onCall((data, context) => {
	_sendNotificationByUid(data.uid, data.title, data.body)
})

function _sendNotificationByUid(uid, title, body) {
	const userDocRef = firestore.doc('/users/' + uid)
	userDocRef.get().then(userDocSnap => {
		if(userDocSnap.exists) {
			firestore.collection('/users/' + uid + '/subscriptions/').get().then(subscriptionDocs => {
				if(subscriptionDocs.docs == 0) {
					return;
				}
				subscriptionDocs.forEach(function(subscriptionDoc) {
					const subscriptionDocData = subscriptionDoc.data()
					console.log(subscriptionDocData)
					const subscription = subscriptionDocData.subscription
					const JSONsubscription = JSON.parse(subscription)
					const payload = {
						title,
						body,
						type: "notification"
					}
					webpush.sendNotification(JSONsubscription, JSON.stringify(payload))
					.catch((err) => {
						console.log("error while sending notification to uid: " + uid + " subscription: " + subscription + "\n" + err)
					})
				})
			})
		}
		else {
			console.log("Uid not linked to any user or undefined\nUID: " + uid)
			return null
		}
	})
}

exports.updateParticipantsForUserChatroom = functions.firestore.document('/users/{uid}/messages/{mid}').onCreate((doc, context) => {
	const params = context.params;
	const author = params.author;
	const authorUid = author.uid;
	const authorName = author.name

	const colref = firebase.colection("/users/" + context.params.uid + "/participants");

	colref.where("uid", "==", authorUid).then(querySnap => {
		if(querySnap.empty) {
			colref.add({
				authorUid,
				authorName
			})
		}
	})
})
/* AUTO-CREATED FUNCTIONS */
/**
 * Callable function that creates a custom auth token with the
 * custom attribute "admin" set to true.
 * 
 * See https://firebase.google.com/docs/auth/admin/create-custom-tokens
 * for more information on creating custom tokens.
 * 
 * @param {string} data.uid the user UID to set on the token.
 */
exports.mintAdminToken = functions.https.onCall((data, context) => {
  const uid = data.uid;

  return admin
    .auth()
    .createCustomToken(uid, { admin: true })
    .then(function(token) {
      return { token: token };
    });
});

// [START recursive_delete_function]
/**
 * Initiate a recursive delete of documents at a given path.
 * 
 * The calling user must be authenticated and have the custom "admin" attribute
 * set to true on the auth token.
 * 
 * This delete is NOT an atomic operation and it's possible
 * that it may fail after only deleting some documents.
 * 
 * @param {string} data.path the document or collection path to delete.
 */
exports.recursiveDelete = functions
  .runWith({
    timeoutSeconds: 540,
    memory: '2GB'
  })
  .https.onCall((data, context) => {
    // // Only allow admin users to execute this function.
    // if (!(context.auth && context.auth.token && context.auth.token.admin)) {
    //   throw new functions.https.HttpsError(
    //     'permission-denied',
    //     'Must be an administrative user to initiate delete.'
    //   );
    // }

    const path = data.path;
    console.log(
      `User ${context.auth.uid} has requested to delete path ${path}`
    );

    // Run a recursive delete on the given document or collection path.
    // The 'token' must be set in the functions config, and can be generated
    // at the command line by running 'firebase login:ci'.
    return firebase_tools.firestore
      .delete(path, {
        project: process.env.GCLOUD_PROJECT,
        recursive: true,
        yes: true,
        token: functions.config().fb.token
      })
      .then(() => {
        return {
          path: path 
        };
      });
  });

