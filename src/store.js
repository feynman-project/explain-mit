import Vue from 'vue';
import Vuex from 'vuex';
import db from '@/database.js';
import { getRandomId } from '@/helpers.js';
import { SUPER_USER_EMAILS, BlackboardTools } from "@/CONSTANTS.js";
import firebase from "firebase/app"; 
import "firebase/auth";
import router from "@/router.js";

Vue.use(Vuex);

async function getDocFromDb (ref) {
  return new Promise(async (resolve, reject) => {
    const doc = await ref.get();
    if (doc.exists) { 
      resolve({ id: doc.id, ...doc.data() });
    } else { 
      reject(); 
    }
  });
}

export default new Vuex.Store({
  state: {
    user: null,
    hasFetchedUserInfo: false,
    isFetchingUser: true,
    mitClass: null,
    explCache: {},

    currentAreaRooms: [],
    blackboardRoom: null,
    
    currentBoardNumber: 1,
    currentBoardID: "",

    // DEPRECTATE
    browserTabID: getRandomId(), 
    session: {
      currentID: getRandomId()
    },

    micStream: null, // workaround for iOS issues
    // video conference related states
    participants: {},

    // TODO: once you debug the mic permissions etc. set it to autojoin
    canHearAudio: false, 

    // consider deprecating `isMicOn`, though it can be modified / renamed to be a variable 
    // that helps persists the user's mic / camera states across different rooms
    isMicOn: false,
    isCameraOn: false,
    isConnectedToAudio: false,
    activeSpeakerDailyID: "",
    roomIDtoParticipants: null,

    CallObject: null, // initialized in App.vue
    connectionStatus: "DISCONNECTED", // DISCONNECTED, CONNECTED, DISCONNECTING, CONNECTING
    firestoreIDToDailyID: {},

    // blackboard related states
    isBoardFullscreen: false,
    currentTool: { 
      type: BlackboardTools.PEN,
      color: "white",
      lineWidth: 2
    },
    onlyAllowApplePencil: true,

    musicAudioElement: null,
    isMusicPlaying: false,

    isViewingLibrary: false,
    currentlySelectedLibraryPostID: "",

    isViewingForum: false, 
    currentlySelectedQuestionID: "EMAIL_SETTINGS" // either EMAIL_SETTINGS, NEW_QUESTION or <question-id> of the form "1xhlqidlfoiq"
  },
  getters: {
    isAdmin: state => {
      return SUPER_USER_EMAILS.includes(state.user.email) || ["staff", "affiliate", "pioneer", "engineer"].includes(state.user.kind); 
    },
    numOfUnreadMsgsInArea: state => {
      return state.user["numOfUnreadMsgsInArea:" + router.currentRoute.params.section_id] || 0;
    },
    numOfUnreadMsgsInTable: state => {
      return state.user["numOfUnreadMsgsInTable:" + router.currentRoute.params.room_id] || 0;
    },
    numOfUnreadGlobalMsgs: state => {
      return state.user["numOfUnreadGlobalMsgs"] || 0;
    }
  },
  mutations: {
    SET_CALL_OBJECT (state, newValue) {
      state.CallObject = newValue
    },  
    SET_MIC_STREAM (state, newValue) {
      state.micStream = newValue
    },  
    SET_CURRENTLY_SELECTED_LIBRARY_POST_ID (state, newValue) {
      state.currentlySelectedLibraryPostID = newValue; 
    },
    SET_CURRENTLY_SELECTED_QUESTION_ID (state, newValue) {
      state.currentlySelectedQuestionID = newValue; 
    },
    SET_CURRENT_AREA_ROOMS (state, newValue) {
      state.currentAreaRooms = newValue; 
    },
    SET_PARTICIPANTS (state, newValue) {
      state.participants = newValue; 
    },
    SET_FIRESTORE_ID_TO_DAILY_ID (state, newValue) {
      state.firestoreIDToDailyID = newValue; 
    },  
    SET_ACTIVE_SPEAKER_DAILY_ID (state, newValue) {
      state.activeSpeakerDailyID = newValue;
      console.log("active ID =", state.activeSpeakerDailyID); 
    },
    // video conference 
    SET_CONNECTION_STATUS (state, newValue) {
      state.connectionStatus = newValue; 
    },
    SET_IS_VIEWING_FORUM (state, newVal) {
      state.isViewingForum = newVal; 
    },
    SET_IS_VIEWING_LIBRARY (state, newVal) {
      state.isViewingLibrary = newVal; 
    },
    SET_MUSIC_AUDIO_ELEMENT (state, newVal) {
      state.musicAudioElement = newVal; 
    },
    SET_IS_MUSIC_PLAYING (state, newVal) {
      state.isMusicPlaying = newVal; 
    },
    // so the user's pen color persists across different boards
    SET_CURRENT_TOOL (state, newVal) {
      Vue.set(state, "currentTool", newVal);
    },
    SET_ONLY_ALLOW_APPLE_PENCIL (state, newVal) {
      state.onlyAllowApplePencil = newVal; 
    },
    SET_DOMINANT_SPEAKER_NAME (state, newVal) {
      state.dominantSpeaker.name = newVal; 
    },
    SET_IS_BOARD_FULLSCREEN (state, newVal) {
      state.isBoardFullscreen = newVal; 
    },
    SET_CAN_HEAR_AUDIO (state, newVal) {
      state.canHearAudio = newVal; 
    },
    SET_IS_MIC_ON (state, newVal) {
      state.isMicOn = newVal; 
    },
    SET_IS_CAMERA_ON (state, newVal) {
      state.isCameraOn = newVal;
    },
    SET_HAS_FETCHED_USER_INFO (state, newVal) {
      state.hasFetchedUserInfo = newVal; 
    },
    SET_USER (state, user) {
      state.user = user;
      state.isFetchingUser = false;
    },
    SET_CLASS (state, mitClass) {
      state.mitClass = mitClass;
    },
    SET_ROOM (state, blackboardRoom) {
      state.blackboardRoom = blackboardRoom; 
    },
    SET_SESSION (state, session) {
      state.session = session;
    },
    SET_ROOM_ID_TO_PARTICIPANTS (state, roomIDtoParticipants) {
      state.roomIDtoParticipants = roomIDtoParticipants;
    },
    /**
     * Saves an explanation to the global cache so it can be accessed and uploaded to Firestore in the app background
     *
     * @param {*} state contains data that is stored globally across the application 
     * @param {*} expl contains optional properties: strokesArray, audio, backgroundImageBlob
     *                 and a nested object `metadata` which contains title, html, duration, creator, mitClass, etc. 
     */
    ADD_EXPL_TO_CACHE (state, expl) {
      state.explCache[expl.ref.id] = expl;
    },
    SET_DOMINANT_SPEAKER_UID (state, dominantSpeakerUID) {
      state.dominantSpeakerUID = dominantSpeakerUID; 
    },
    SET_CURRENT_BOARD_ID (state, currentBoardID) {
      state.currentBoardID = currentBoardID; 
    },
    SET_CURRENT_BOARD_NUMBER (state, currentBoardNumber) {
      state.currentBoardNumber = currentBoardNumber; 
    }
  },
  actions: {
    fetchClass (context, classId) {
      return new Promise(async resolve => {
        const ref = db.collection("classes").doc(classId);
        const classDoc = await getDocFromDb(ref);
        context.commit("SET_CLASS", classDoc);
        // syncMitClassWithDb(ref, context);
        resolve();
      });
    },
    // Fetches the user document, binds it to a variable accessible by all components and listens for any changes
    // TODO: rename to listenToFirestoreUser
    async listenToUserDoc (context, { uid }) {
      return new Promise((resolve, reject) => {
        const mirrorUserRef = db.collection("users").doc(uid);
        mirrorUserRef.onSnapshot(userDoc => {
          if (!userDoc.exists) {
            reject("Error in listenToUserDoc: uid doesn't exist");
            context.commit("SET_USER", null);
            firebase.auth().signOut(); 
          } else {
            context.commit("SET_USER", userDoc.data());
            resolve();
          }
        });
      });
    }
  }
})
