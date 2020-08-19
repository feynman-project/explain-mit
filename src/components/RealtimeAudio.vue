<template>
	<div v-if="hasJoinedMedia">
		<portal to="video-chat" :disabled="!portalToLiveBoard">
			<v-container class="video-display" >
				<div class="screen-share-container" id="screen-share">

				</div>
				<Carousel
					:paginationEnabled="false"
					:navigationEnabled="true"
					:perPageCustom="[[0, 1], [600, 2], [850, 3], [1100, 4], [1350, 5]]"
					class="video-row"
				>
					<Slide class="video-col">
						<div :class="isMinimizedView ? 'mini-view-container' : 'video-container-wrapper'">
							<div v-show="!isMinimizedView" id="local-media" class="video-container"/>
							<div class="display-bar">
								<div class="name-container">
									{{user.firstName + " " + user.lastName}}
								</div>
								<div class="local-buttons-container">
									<v-btn @click="toggleMic()" x-small><v-icon small>{{isMicOn ? 'mdi-microphone': 'mdi-microphone-off'}}</v-icon></v-btn>
									<v-btn @click="toggleCamera()" x-small ><v-icon small>{{isCameraOn ? 'mdi-video': 'mdi-video-off'}}</v-icon></v-btn>
								</div>
							</div>
						</div>
					</Slide>
					<Slide v-for="participant in roomParticipants.filter(p => (p.sessionID !== sessionID) && p.hasJoinedMedia)" 
						:key="participant.sessionID" 
						class="video-col"
					>
						<div :class="isMinimizedView ? 'mini-view-container' : 'video-container-wrapper'" >
							<div  v-show=" !isMinimizedView && participant.isCameraOn" :id="`remote-media-${participant.sessionID}`"  class="video-container"/>
							<v-icon v-show=" !isMinimizedView && !participant.isCameraOn" color="white" x-large style="width: 100%; height: 100%">mdi-video-off</v-icon>
							<div class="display-bar">
								<div class="name-container">
									{{ participant.firstName + " " + participant.lastName }}
								</div>
								<v-icon class="participant-mic">
									{{ participant.isMicOn ? 'mdi-microphone': 'mdi-microphone-off' }}
								</v-icon> 
							</div>
						</div>
					</Slide>
				</Carousel>
			</v-container>
		</portal>
		<MediaErrorPopup
			:popupOpen="permissionsPopupOpen"
			@exit="permissionsPopupOpen = false"
		/>
	</div>
</template> 

<script>
import firebase from "firebase/app";
import db from "@/database.js";
import DatabaseHelpersMixin from "@/mixins/DatabaseHelpersMixin.js";
import MediaErrorPopup from "@/components/MediaErrorPopup.vue";
import Twilio, { connect, createLocalTracks, createLocalVideoTrack, LocalVideoTrack } from 'twilio-video';
import { twilioCreds } from "@/twiliocreds.js";
import { mapState } from "vuex";
import { Carousel, Slide } from 'vue-carousel';

export default {
	props: {
		roomId: String,
		classId: String,
		isSharingScreen: Boolean,
		hasJoinedMedia: Boolean,
		roomParticipants: Array,
		portalToLiveBoard: Boolean,
		isMinimizedView: Boolean
	},
	components :{
		MediaErrorPopup,
		Carousel,
		Slide
	},
	data () {
		return {
			loading: false,
			activeRoom: null,
			token: null,
			isCameraOn: false,
			isMicOn: false,
			snapshotListeners: [],
			roomParticipantsRef: null,
			permissionsPopupOpen: false
		}
	},
	computed: {
	...mapState([
			"user",
			"session"
		]),
		sessionID () {
			return this.session.currentID;
		},
		roomParticipantRef () {
			return db.doc(`classes/${this.classId}/participants/${this.sessionID}`);
		}
	},
	watch: {
		hasJoinedMedia () {
			this.updateMediaStatus();
			if (this.hasJoinedMedia) { 
				this.enterAudioChat();
			} else {
				this.leaveRoomIfJoined();
			}
		},
		isMicOn: {
			// immediate: true,
			handler () {
				this.updateMediaStatus();
			}
		},
		isCameraOn: {
			// immediate: true,
			handler () {
				this.updateMediaStatus();
			}
		},
		isSharingScreen () {
			this.updateMediaStatus();
			if (this.activeRoom){
				if (this.isSharingScreen) {
					this.startScreenShare();
				} else {
					this.stopScreenShare();
				}
			}
		},
		portalToLiveBoard () {
			if (this.activeRoom) {
				this.attachTracks(this.getTracks(this.activeRoom.localParticipant), this.sessionID);
				this.activeRoom.participants.forEach((participant) => {
					this.attachTracks(this.getTracks(participant), participant.identity);
				});
			}
		}
	},
	created () {
		this.token = this.getAccessToken();
	},
	beforeDestroy () {
		this.$emit('left-room');
		this.leaveRoomIfJoined();
	},
	methods: {
		toggleMic () {
			if (!this.isMicOn){
				if (this.activeRoom === null) {
					this.enterAudioChat();
				} else {
					this.enableTrack("audio");
				}
			}
			else {
				if (this.activeRoom) {
					this.disableTrack("audio");
				}
			}
		},
		toggleCamera () {
			if (!this.isCameraOn){
				if (this.activeRoom===null) {
					this.enterAudioChat();
				} else {
					this.enableTrack("video");
				}
			}
			else {
				if (this.activeRoom){
					this.disableTrack("video");
				}
			}
		},
		async updateMediaStatus () {
			const doc = await this.roomParticipantRef.get();
			if (doc.exists) { //this is just to prevent errors
				this.roomParticipantRef.update({
					isMicOn: this.isMicOn,
					isCameraOn: this.isCameraOn,
					isSharingScreen: this.isSharingScreen,
					hasJoinedMedia: this.hasJoinedMedia
				});
			}
		},
		getAccessToken () {
			const AccessToken = require('twilio').jwt.AccessToken;
			const VideoGrant = AccessToken.VideoGrant;
			const accessToken = new AccessToken(
				twilioCreds.ACCOUNT_SID,
				twilioCreds.API_KEY_SID,
				twilioCreds.API_KEY_SECRET
			);
			accessToken.identity = this.sessionID;
			const grant = new VideoGrant();
			grant.room = this.roomId;
			accessToken.addGrant(grant);
			const jwt = accessToken.toJwt();
			return jwt;
		},
		async startScreenShare () {
			if (this.participantSharingScreen()){
				this.$root.$emit("show-snackbar", "It looks like someone else is already screen-sharing, try again once they are done.");
				this.$emit('screen-share-failed');
				return;
			}
			navigator.mediaDevices.getDisplayMedia().then(stream => {
				const screenTrack = new LocalVideoTrack(stream.getTracks()[0], {name: `screen-share-${this.sessionID}`});
				this.activeRoom.localParticipant.publishTrack(screenTrack);
				screenTrack.on('stopped', track => {
					this.stopScreenShare();
				});
			}).catch(error => {
				console.log('ERROR getting screen', error)
				this.$emit('screen-share-stopped');
			});
		},
		stopScreenShare () {
			this.getTracks(this.activeRoom.localParticipant).forEach(track => {
				if (track.name.includes('screen-share')) {
					this.activeRoom.localParticipant.unpublishTrack(track);
					track.stop();
					this.$emit('screen-share-stopped');
				}
			});
		},
		participantSharingScreen () {
			const filtered = this.roomParticipants.filter(p => p.isSharingScreen && p.sessionID !== this.sessionID);
			return filtered.length > 0 ? filtered[0] : false;
		},
		// Trigger log events 
		attachTrack(track, container, isLocal, init) {
			if (!container) {
				console.log("This track will not be connected", track)
				throw new Error("container was not found when trying to attach track")
			}
			const trackParticipantId = isLocal ? this.sessionID : track.name.includes('screen-share') ? track.name.substring(13) : container.id.substring(13);
			const dbParticipant = this.roomParticipants.find(p => p.sessionID === trackParticipantId)
			if (dbParticipant) {
				console.log(`attaching ${dbParticipant.firstName}'s ${track.kind} track to: ${container.id}; sessionID=`, trackParticipantId)
			}
			else {
				console.log(`attaching unknown's ${track.kind} track to: ${container.id}; sessionID=`)
			}
			this.detachTrack(track) //remove any duplicate tracks
			if (track.kind === "video") {
				if (track.isStarted) {
					scaleAndAttachVideo(track, container);
				}
				if (init){ //this is to prevent too many event listeners from being added
					track.on('started', (videoTrack) => { 
						scaleAndAttachVideo(track, container);
					});
				}

				function scaleAndAttachVideo (videoTrack, container) {
					var videoTag = videoTrack.attach();
					const videoHeight = videoTrack.dimensions.height;
					const videoWidth = videoTrack.dimensions.width;
					const aspectRatio = videoWidth/videoHeight;
					if (track.name.includes('screen-share')){
						videoTag.setAttribute('style', "width: 480px;")
						videoTag.setAttribute("controls", true);
					} else {
						videoTag.setAttribute(
							'style', 
							`${aspectRatio < (16/9) ? 'height' : 'width'}: 100%; transform: ${isLocal ? 'scale(-1, 1)': ''}`
						);
					}
					container.appendChild(videoTag);
				}
	
			}
			else { // this is an audio track
				if (track.isStarted) {
					container.appendChild(track.attach());
				}
				if (init){ //this is to prevent too many event listeners from being added
					track.on('started', (videoTrack) => { 
						container.appendChild(track.attach());
					});
				}
			}
		},
		attachTracks(tracks, identity, init=false) {
			const isLocal = (identity === this.sessionID);
			tracks.forEach(async track => {
				const containerName = track.name.includes('screen-share') ? 'screen-share' : (isLocal ? 'local-media' : `remote-media-${identity}`);
				if (!isLocal || containerName !== 'screen-share' ) {
					const container = await this.getMediaContainer(containerName);
					this.attachTrack(track, container, isLocal, init);
				}
			});
		},
		detachTrack(track) {
			track.detach().forEach((element) => {
				element.remove();
			});
		},
		async trackPublished(publication, participantId) {
			if (publication.isSubscribed) {
				const containerName = publication.trackName.includes('screen-share') ? 'screen-share' : `remote-media-${participantId}`;
				const container = await this.getMediaContainer(containerName);
				this.attachTrack(publication.track, container, false, true);
			}
			publication.on('subscribed', async track => {
				const containerName = track.name.includes('screen-share') ? 'screen-share' : `remote-media-${participantId}`;
				const container = await this.getMediaContainer(containerName);
				this.attachTrack(track, container, false, true);
			});
			publication.on('unsubscribed', this.detachTrack);
		},
		trackUnpublished (publication) {
			console.log(publication.kind + ' track was unpublished.');
		},
		participantConnected (participant) {
			participant.tracks.forEach(publication => {
				this.trackPublished(publication, participant.identity);
			});
			participant.on('trackPublished', publication => {
				this.trackPublished(publication, participant.identity);
			});
			participant.on('trackUnpublished', this.trackUnpublished);
		},
		detachParticipantTracks(participant) {
			const tracks = this.getTracks(participant);
			tracks.forEach(this.detachTrack);
		},
		disableTrack (type) {
			this.getTracks(this.activeRoom.localParticipant).forEach(track => {
				if (track.kind === type) {
					track.disable();
					if (type === 'video') { //TODO: fix this with screen share if needed
						this.isCameraOn = false;
					} else {
						this.isMicOn = false;
					}
				}
			});
		},
		enableTrack (type) {
			this.getTracks(this.activeRoom.localParticipant).forEach((track) => {
				if (track.kind === type) {
					track.enable();
					if (type === 'video'){
						this.isCameraOn = true;
					} else {
						this.isMicOn = true;
					}
				}
			});
		},
		getTracks (participant) {
			return Array.from(participant.tracks.values())
				.filter(publication => publication.track)
				.map(publication =>  publication.track);
		},
		leaveRoomIfJoined() {
			if (this.activeRoom) {
				this.isCameraOn = false;
				this.isMicOn = false;
				this.activeRoom.disconnect();
			}
		},
		async enterAudioChat() {
			this.loading = true;
			const connectOptions = {
				name: this.roomId,
				audio: true,
				video: true
			};
			this.leaveRoomIfJoined();
			// remove any remote track when joining a new room
			try {
				const room = await Twilio.connect(this.token, connectOptions);
				this.onTwilioConnect(room);
				this.$emit('media-connected');
				this.loading = false;
			} catch {
				console.log("Twilio Error", error);
			  this.permissionsPopupOpen = true;
			}
		},
		onTwilioConnect(room) {
			console.log('Successfully joined a Room: '+ room);
			// set active toom
			
			this.activeRoom = room;
			
			// TODO: use ref instead of ID
			//       nextTick
			const previewContainer = document.getElementById('local-media');
			this.attachTracks(this.getTracks(room.localParticipant), this.sessionID, true);
			this.isMicOn = true;
			this.isCameraOn = true;

			room.participants.forEach(participant => {
				const dbParticipant = this.roomParticipants.find(p => p.sessionID === participant.identity)
				if (dbParticipant) { //is this participant in the DB?
					this.participantConnected(participant);
					console.log("Already in Room: '" + dbParticipant.firstName+ ", "+ dbParticipant.sessionID + "'");
				}
			});
			room.on('participantConnected', participant => {
				const dbParticipant = this.roomParticipants.find(p => p.sessionID === participant.identity)
				if (dbParticipant){ //is this participant in the DB?
					this.participantConnected(participant);
					console.log("Joining Room: '" + dbParticipant.firstName+ ", "+ dbParticipant.sessionID + "'");
				}
			});
			room.on('participantDisconnected', participant => {
				console.log("RemoteParticipant '" + participant.identity + "' left the room");
				this.detachParticipantTracks(participant);
			});
			room.on('disconnected', () => {
				console.log('You Left the rooom');
				this.isMicOn = false;
				this.isCameraOn = false;
				this.$emit('left-room')
				this.detachParticipantTracks(room.localParticipant);
				room.participants.forEach(this.detachParticipantTracks);
				this.activeRoom = null;
			});
		},
		async getMediaContainer(containerId){
			let count = 0;
			while (count < 5) {
				await this.$nextTick();
				const container = document.getElementById(containerId);
				if (container) {
					return container;
				}
				count++;
			}
			return null;
		}
	}
}
</script>

<style scoped>
.screen-share-container{
	/* height: 300px; */
}
.video-display{
	bottom: 0%;
	opacity: 1;
	z-index: 1000;
	padding: 0;
	margin: 0;
}
.video-row{
	padding: 0;
	margin: auto;
	margin-left: 35px;
	max-width: 1224px;
	left: 0%;
}
.video-chat-container .video-row{
	background: rgba(255,255,255,0.5);
	box-shadow: 0 0 10px;
	border-radius: 10px;
	padding: 2px;
	margin: auto;
}
@media (max-width: 600px) {
	.video-row {
		max-width: 248px;
	}
}
@media (max-width: 850px) and (min-width: 601px) {
	.video-row {
		max-width: 492px;
	}
}
@media (max-width: 1100px) and (min-width: 851px) {
	.video-row {
		max-width: 736px;
	}
}
@media (max-width: 1350px) and (min-width: 1101px) {
	.video-row {
		max-width: 980px;
	}
}

.video-col{
	padding: 2px;
}
.video-chat-container .video-col{
	margin: auto;
}

.video-container-wrapper{
	height: 135px;
	width: 240px;
	position: relative;
	border-style: solid;
	border-color: var(--v-accent-base);
	background-color: #333;
	border-radius: 10px;
}
.video-container-wrapper .video-container{
	bottom: 0; 
	position: absolute; 
	width:100%;
	height: 100%;
	display: flex;
	justify-content: center;
	align-items: center;
}
.video-container-wrapper .display-bar{
	position: absolute;
	bottom: 0px;
	left: 0px;
	height: 20%;
	width: 100%;
}
.video-chat-container  .VueCarousel-navigation-button {
	color: rgba(255,255,255,0.7) !important;
}
.video-chat-container  .VueCarousel-navigation-button {
	color: white !important;
	text-shadow: 0 0 10px;
}
.display-bar .name-container{
	background-color: rgb(31, 31, 31);
	color: white; 
	position:absolute; 
	bottom: 0px; 
	font-size: 12px;
	text-align: center;
	padding-left: 5px;
	padding-right: 5px;
	left: 0px;
	border-bottom-left-radius: 6px;
}
.display-bar .local-buttons-container{
	position: absolute;
	right: 0px;
}
.display-bar .participant-mic{
	position: absolute;
	right: 0px;
	color: white; 
	bottom: 0px;
}
.mini-view-container{
	height: 30px;
	width: 240px;
	position: relative;
	border-style: solid;
	border-color: var(--v-accent-base);
	background-color:black;
	border-radius: 10px;
}
</style>
