<template>
  <v-app>    
    <CurrentClass v-if="user && classID && areaID && tableID"
      :classID="classID"
      :areaID="areaID"
      :tableID="tableID"
      :key="'force-rerender-if-class-id-changes' + classID"
    /> 

    <v-snackbar v-model="snackbar" timeout="2500">
      {{ snackbarMessage }}
      <template v-slot:action>
        <v-btn @click="snackbar = false" text>CLOSE</v-btn>
      </template>
    </v-snackbar>

    <!-- <template v-if="user">
      <v-snackbar v-if="user.email" v-model="musicSnackbar" timeout="5000">
        Play music from Maplestory?
        <v-btn @click="playBackgroundMusic(); musicSnackbar = false;" text color="cyan">YES </v-btn>
        <v-btn @click="musicSnackbar = false;" text>NO</v-btn>
      </v-snackbar>
    </template> -->
  </v-app>
</template>

<script>
import firebase from "firebase/app"; 
import "firebase/storage"; 
import "firebase/auth"; 
import { getRandomId } from "@/helpers.js"; 
import _ from "lodash"; 
import CurrentClass from "@/components/CurrentClass.vue"; 
import AuthHelpers from "@/mixins/AuthHelpers.js"; 
import { mapState } from "vuex"; 

// TODO:
//   - Fix ghosts: let source of truth for video conference from Daily (CURRENTLY WORKING ON THIS)
//   - Introduce the personal library

export default {
  mixins: [
    AuthHelpers
  ],
  components: {
    AuthHelpers,
    CurrentClass
  },
  data: () => ({
    snackbar: false,
    snackbarMessage: "",

    musicSnackbar: true,
    musicAudioElement: null
  }),
  computed: {
    ...mapState([
      'user'
    ]),
    sessionID () { return this.$store.state.session.currentID },
    classID () { return this.$route.params.class_id; },
    areaID () { return this.$route.params.section_id; },
    tableID () {return this.$route.params.room_id; }
  },
  async created () {
    // SNACKBAR LISTENER
    this.$root.$on("show-snackbar", (message) => {
      this.snackbar = true;
      this.snackbarMessage = message;
    });
    /** 
      * USER AUTHENTICATION
      * 
      * Only use `onAuthStateChanged` for getting the INITIAL authentication state of the user, so that
      * it's unnecessary to deal with edge cases related to intermediate states.
      * 
      * Don't use it as callbacks because of concurrency issues between onAuthStateChanged() versus versus the callbacks of `signInWithPopup` firing 
      * in different sequences according to slow internet. Even if it fires in the same sequence, there are too many dependent operations 
      * that zigzag between the two such as creating a mirror document. 
      * 
      * That's why we remove the listener once it has done its job. 
      * 
      * `user === null` unhelpfully can both mean the user is not logged in or hasn't been initialized
    **/
    this.unsubscribeAuthListener = firebase.auth().onAuthStateChanged(async (user) => {
      // console.log("authStateChanged, user =", user); 
      if (!user) {
        await firebase.auth().signInAnonymously(); 
        this.initializeTutorialDemo();
        // console.log("user is not logged in", this.unsubscribeAuthListener);
        this.unsubscribeAuthListener(); 
      }
      
      else if (user.isAnonymous) {
        this.initializeTutorialDemo(); 
        // console.log("user is anonymous =");
        this.unsubscribeAuthListener(); 
      } 

      else if (user && !user.isAnonymous) {
        await this.$store.dispatch("listenToUserDoc", { uid: user.uid });
        this.$store.commit("SET_HAS_FETCHED_USER_INFO", true); 
        // redirect to most recent class
        const { class_id, section_id, room_id, question_id } = this.$route.params; 
        // check if the user should be redirected to the visual forum via <RedirectToForumQuestion/>
        if (question_id) {
          const { classID } = this; 
          this.$router.push(`/class/${classID}/section/${classID}/room/${classID}`); 
          this.$store.commit("SET_IS_VIEWING_FORUM", true);
          this.$store.commit("SET_CURRENTLY_SELECTED_QUESTION_ID", question_id);
        }
        else if (!(class_id && section_id && room_id)) {
          const { mostRecentClassID } = this.$store.state.user; 
          this.$router.replace(`/class/${mostRecentClassID}/section/${mostRecentClassID}/room/${mostRecentClassID}`);
        }

        // console.log("user is signed in, will unsubscribe");
        this.unsubscribeAuthListener(); 
      }

      else {
        // intermediate state, don't unsubscribeAuthListener() yet 
      }
    });
  },
  methods: {
    initializeTutorialDemo () {
      const exampleClassID = "lvzQqyZIV1wjwYnRV9hn";
      const exampleClass = {
        id: exampleClassID,
        name: "0.000", 
        description: "For new users to explore"
      };

      this.$store.commit("SET_USER", {
        uid: getRandomId(),
        firstName: "Beaver",
        lastName: `${Math.floor(Math.random() * 90 + 10)}`, // e.g. Beaver 27,
        email: "", // empty string to distinguish it from signed in accounts
        enrolledClasses: [exampleClass],
        emailOnNewQuestion: [],
        emailOnNewReply: [],
        penColors: ["#B8F2F9", "#F69637", "#A9F8BD", "#6EE2EA"]
      });

      this.$store.commit("SET_IS_VIEWING_LIBRARY", true);
      const tutorialPostID = "SX3chANZirfspySFxAqD"; // "nG8VBZg4QanbSkKjPuCX"; // "aJWnGgnWMWjRGQzNSq3n"
      this.$store.commit("SET_CURRENTLY_SELECTED_LIBRARY_POST_ID", tutorialPostID);

      // redirect to 0.000
      const { class_id, section_id, room_id } = this.$route.params; 
      if (!(class_id && section_id && room_id)) {
        this.$router.replace(`/class/${exampleClassID}/section/${exampleClassID}/room/${exampleClassID}`);
      }
    },
    playBackgroundMusic () {
      this.$store.state.musicAudioElement.play(); 
      this.$store.commit("SET_IS_MUSIC_PLAYING", true);
    }
  }
}
</script>

<style>
#app {
  -webkit-touch-callout: none;  /* iOS hold to press features e.g. mini-preview, prevent callout to copy image, etc when tap to hold */
}

/* Fixes snackbar not visible on iOS Safari, see https://github.com/vuetifyjs/vuetify/issues/11781#issuecomment-655689025 */
div.v-snack:not(.v-snack--absolute) {
  height: 100%;
}

/* .v-input__prepend-outer {
  margin-right: 1px !important;
} */

/* Override v-switch CSS to make them more compact */
.v-application--is-ltr .v-input__prepend-outer {
  margin-right: 1px !important;
}

.v-application--is-ltr .v-input--selection-controls__input {
  margin-right: 0px !important;
}

.v-input__append-outer .v-icon, .v-input__prepend-outer .v-icon {
  font-size: 18px !important;
}

/* For the hint text under touch draw */
.v-input__control .v-messages {
  font-size: 8px !important; 
  color: white !important;
}

.mirror-flip
{
  transform: rotateY(180deg);
  -webkit-transform:rotateY(180deg); /* Safari and Chrome */
  -moz-transform:rotateY(180deg); /* Firefox */
}

/* Global styles */
/* What does this do? */
a {
  text-decoration: none;
}
/*
::-webkit-scrollbar {
    width: 12px;
}
::-webkit-scrollbar-track {
    -webkit-box-shadow: inset 0 0 6px rgba(0,0,0,0.3); 
    border-radius: 10px;
    background-color: rgba(0,0,0,0.15);
}
 
::-webkit-scrollbar-thumb {
    border-radius: 10px;
    -webkit-box-shadow: inset 0 0 6px rgba(0,0,0,0.5); 
    background-color: orange;
}*/
</style>