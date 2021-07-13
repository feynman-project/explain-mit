<template>
  <!-- This 100vh is key, it means all the subsequent <div> will maintain its size regardless of how big the blackboard is (it'll just allow for 
    horizontal and vertical scrolling), which is what we want -->
  <div style="height: 100%">
    <MyParticipantDocUpdater
      :classID="classID"
      :roomID="tableID"
    />

    <!-- Elevation ranges from 0 to 24 -->
    <!-- width 240; anything below, if the scrollbar appears (for laptops), then the right margin gets squished and invaded -->
    <!-- Sets the designated mobile breakpoint for the component. This will apply alternate styles for mobile devices such as the temporary prop, or activate the bottom prop when the breakpoint value is met. Setting the value to 0 will disable this functionality. -->
    <!-- Height: 100% is a workaround for Vuetify's bug with iOS Safari page hiding interactions -->
    <v-navigation-drawer v-model="isShowingDrawer" 
      app 
      style="height: 100%"
      class="elevation-24" 
      width="270" 
      disable-resize-watcher
      mobile-breakpoint="0"
      touchless 
    >      
      <v-sheet class="px-1 py-0 mb-3" elevation="8">    
        <div style="display: flex; align-items: center;">
          <v-badge 
            :value="numOfUnreadGlobalMsgs"
            :content="numOfUnreadGlobalMsgs"
            top left color="secondary" overlap style="z-index: 1;"
            offset-x="18"
            offset-y="25"
          >
            <v-list-item two-line class="px-0">
              <v-list-item-avatar @click="redirectToGithub()"
                class="mr-0" style="cursor: pointer; margin-left: 2px; margin-bottom: 18px;" tile width="62" height="56"
              >
                <img src="/logo.png">
              </v-list-item-avatar>

              <v-list-item-content class="py-0">
                <v-list-item-title class="mb-0">
                  <CurrentClassDropdown>
                    <template v-slot:add-join-leave-class>
                      <v-list-item @click="isAddClassPopupOpen = !isAddClassPopupOpen">
                        <v-icon left class="mr-2">mdi-plus</v-icon> Add/join class
                      </v-list-item>
                    </template>
                  </CurrentClassDropdown>
                </v-list-item-title>

                <v-list-item-subtitle>
                  <CurrentAreaDropdown 
                    :areaID="areaID"
                    style="margin-top: 6px;"
                  />  
                </v-list-item-subtitle>
              </v-list-item-content>
              
              <portal-target name="current-open-space-actions">

              </portal-target>
            </v-list-item>
          </v-badge>

          <!-- Have the app overview, updates, news, as well as the chats -->
          <v-dialog v-model="isAppPopupOpen" width="90vw" style="height: 90vh" persistent>
            <v-card style="height: 80vh">     
              <v-card-text>
              </v-card-text>

              <v-card-actions>
                <v-spacer/>
                <v-btn v-if="user.enrolledClasses.length >= 2" large @click="leaveClass()">
                  LEAVE CLASS
                </v-btn>
                <v-btn large @click="$_signOut()" class="mx-5 grey darken-1 white--text">
                  <v-icon class="mr-2">mdi-logout</v-icon>
                  SIGN OUT
                </v-btn>       
              </v-card-actions>
            </v-card>
          </v-dialog>

          <CurrentClassNewPopup 
            :isAddClassPopupOpen="isAddClassPopupOpen"
            @input="(newVal) => isAddClassPopupOpen = newVal"
          />
        </div>
      </v-sheet>
      <!-- 
          For CurrentAreaDropdown, because we no longer use a bandwidth-consuming listener to the roomTypes, 
          it's okay to fetch 10 documents everytime someone switches a section. 
          It'd also help if someone ELSE created or deleted roomTypes, and we would receive the update.
       -->
      <CurrentArea
        :sectionID="areaID"
        :key="areaID"
      /> 
    </v-navigation-drawer>

    <v-main>
      <CurrentRoom 
        :roomID="tableID" 
        :key="tableID"
      />
    </v-main>
  </div>
</template>

<script>
import firebase from "firebase/app";
import "firebase/firestore";
import "firebase/storage";
import { mapState, mapGetters } from "vuex";

import db from "@/database.js";
import DatabaseHelpersMixin from "@/mixins/DatabaseHelpersMixin.js";

import MyParticipantDocUpdater from "@/components/MyParticipantDocUpdater.vue"; 
import BasePopupButton from "@/components/BasePopupButton.vue";
import CurrentClassDropdown from "@/components/CurrentClassDropdown.vue";
import CurrentClassNewPopup from "@/components/CurrentClassNewPopup.vue";

import CurrentAreaDropdown from "@/components/CurrentAreaDropdown.vue"; 
import BaseButton from "@/components/BaseButton.vue";
import CurrentArea from "@/components/CurrentArea.vue"; 
import CurrentRoom from "@/components/CurrentRoom.vue";
import AuthHelpers from "@/mixins/AuthHelpers.js";

export default {
  name: "ClassPageLayout",
  props: {
    classID: {
      type: String,
      required: true
    },
    areaID: {
      type: String,
      required: true
    },
    tableID: {
      type: String,
      required: true
    }
  },
  mixins: [
    DatabaseHelpersMixin,
    AuthHelpers
  ],
  components: {
    BaseButton,
    BasePopupButton,
    CurrentClassDropdown,
    CurrentClassNewPopup,
    CurrentAreaDropdown,
    MyParticipantDocUpdater,
    CurrentArea,
    CurrentRoom
  },
  data: () => ({
    firebaseRef: null,
    classParticipantsRef: null,
    isShowingDrawer: true,
    isAddClassPopupOpen: false,
    isClassActionsMenuOpen: false,
    unsubscribeClassDocListener: null,
    tab: 0, // 0, 1, 2
    isViewingMessenger: false
  }),
  computed: {
    ...mapState([
      "user",
      "mitClass",
      "isBoardFullscreen",
      "isViewingLibrary",
      "isViewingForum"
    ]),
    ...mapGetters([
      "numOfUnreadGlobalMsgs"
    ]),
    currentClass () {
      for (const mitClass of this.user.enrolledClasses) {
        if (mitClass.id === this.classID) {
          return mitClass; 
        }
      }
    },
    isAppPopupOpen: {
      get () {
        return false; 
        return (this.isViewingForum || this.isViewingLibrary || this.isViewingMessenger); 
      },
      set (newBoolean) {
        if (newBoolean) this.isViewingMessenger = true; 
        else {
          this.isViewingMessenger = false; 
          this.$store.commit("SET_IS_VIEWING_FORUM", false); 
          this.$store.commit("SET_IS_VIEWING_LIBRARY", false); 
        } 
      }
    }
  },
  // TODO: refactor this quickfix
  watch: {
    isBoardFullscreen (newVal) {
      if (newVal) this.isShowingDrawer = false; 
      else this.isShowingDrawer = true; 
    },
    // REFACTOR THIS
    // setting isViewingForum to true will display the AppOverViewPopup because it's computed property relies on it, 
    // and the right tab will be selected because the tab is set here. Not a great solution, but <v-tabs> is really hard to get to work
    isViewingForum: {
      immediate: true,
      handler () {
        if (this.isViewingForum) this.tab = 1; 
      }
    },
    isViewingLibrary: {
      immediate: true, 
      handler () {
        if (this.isViewingLibrary) this.tab = 2; 
      }
    }
  },
  created () {
    this.unsubscribeClassDocListener = db.doc(`classes/${this.classID}`).onSnapshot(classDocSnapshot => {
      this.$store.commit("SET_CLASS", { id: classDocSnapshot.id, ...classDocSnapshot.data() });
    });

    // good place to ensure backwards compatibility for new features
    const { user } = this; 

    // note the email does not exist for an anonymous user
    if (user.email) {
      db.doc(`users/${user.uid}`).update({
        mostRecentClassID: this.classID,
        penColors: user.penColors ? user.penColors : ["#B8F2F9", "#F69637", "#A9F8BD", "#6EE2EA"],
        emailOnNewQuestion: user.emailOnNewQuestion ? user.emailOnNewQuestion : [],
        emailOnNewReply: user.emailOnNewReply ? user.emailOnNewReply : []
      });
    }
  },
  destroyed () {
    this.unsubscribeClassDocListener(); 
  },
  methods: {
    redirectToGithub () {
      window.open('https://github.com/project-feynman/explain-mit','_blank')
    },
    async leaveClass () {
      const { user } = this; 
      let classToRemove = null; 
      for (const enrolledClass of user.enrolledClasses) {
        if (enrolledClass.id === this.$route.params.class_id) {
          classToRemove = enrolledClass;
          break; 
        }
      }

      // bad quickfix code to find a different classID to become the default redirected class
      let newDefaultRedirectedClass = null; 
      for (const enrolledClass of user.enrolledClasses) {
        if (enrolledClass.id !== classToRemove.id) {
          newDefaultRedirectedClass = enrolledClass; 
          break; 
        }
      }

      const { id } = newDefaultRedirectedClass; 
      this.$router.push(`/class/${id}/section/${id}/room/${id}`);

      await db.collection("users").doc(user.uid).update({
        enrolledClasses: firebase.firestore.FieldValue.arrayRemove(classToRemove),
        mostRecentClassID: newDefaultRedirectedClass.id,
        emailOnNewQuestion: firebase.firestore.FieldValue.arrayRemove(classToRemove.id),
        emailOnNewReply: firebase.firestore.FieldValue.arrayRemove(classToRemove.id)
      });
    }
  }
}
</script>