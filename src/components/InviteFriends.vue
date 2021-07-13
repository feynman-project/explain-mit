<template>
  <v-card>
    <MapleMusicPlayer 
      :incrementToToggleMusic="incrementToToggleMusic"
      @music-fetched="incrementToToggleMusic += 1"
    />  

    <v-card-title>
      Invite to this room
    </v-card-title>

    <v-card-text>      
      <v-form>
        <v-container>
          <v-row align="center">
            <v-col cols="12" md="4">
              <v-text-field v-model="newUserEmail" 
                :rules="emailRules" 
                label="To" 
                required  
                placeholder="newfriend@gmail.com"
                hide-details
              />
            </v-col>

            <v-col v-for="email in user.emailsOfFriends" :key="email" cols="6" md="4">
              <v-chip @click="toggleIncludeExclude(email)"
                :input-value="emailsOfInvitees.includes(email)"
                active-class="cyan white--text"
              >
                {{ email }}
              </v-chip>
            </v-col>

            <v-col cols="6" md="2">
              <v-chip @click="willEmailClassmates = !willEmailClassmates"
                :input-value="willEmailClassmates"
                active-class="cyan white--text"
              >
                Classmates
              </v-chip>
            </v-col>

            <v-col cols="6" md="2">
              <v-chip @click="willEmailInstructors = !willEmailInstructors"
                :input-value="willEmailInstructors"
                active-class="cyan white--text"
              >
                Instructors
              </v-chip>
            </v-col>
          </v-row>

          <v-textarea v-model="emailMessage"
            label="Message"
            class="mt-4"
          />
          <v-spacer/>
          <v-btn @click="sendAllNecessaryEmails(newUserEmail)"
            class="purple" dark block
          >
            <v-icon class="mr-2">mdi-send</v-icon>Send invite
          </v-btn>
        </v-container>
      </v-form>
      <br>

      <v-dialog persistent v-model="isHelpRequestPopupOpen">
        <v-card>
          Request for help

          <v-select
            :items="['5', '10', '30']"
            filled
            label="Expected duration you'll need"
            @change="newDuration => helpDuration = newDuration"
          ></v-select>

          <v-select
            :items="['pset', 'concept review', 'others']"
            filled
            label="Topic"
            @change="newTopic => helpTopic = newTopic "
          >
          </v-select>

          <v-card-actions>
            <v-spacer/> 
            <v-btn @click="isHelpRequestPopupOpen = false">CANCEL</v-btn>
            <v-btn @click="requestForHelp(helper); isHelpRequestPopupOpen = false">Request help</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </v-card-text>
  </v-card>
</template>

<script>
import DatabaseHelpersMixin from "@/mixins/DatabaseHelpersMixin.js"; 
import MapleMusicPlayer from "@/components/MapleMusicPlayer.vue"; 
import db from "@/database.js";
import { mapState } from "vuex"; 
import firebase from "firebase/app"; 
import "firebase/firestore"; 
import "firebase/functions";

export default {
  mixins: [
    DatabaseHelpersMixin
  ],
  components: {
    MapleMusicPlayer
  },
  data () {
    return {
      willEmailInstructors: false,
      willEmailClassmates: false,
      emailsOfInvitees: [],
      emailMessage: `Despite X and trying Y, I still don't understand Z, so I'm requesting help. I'll be in the room writing up my question for the next few minutes, but you can come in anytime to answer. Thanks in any case : )`,
      newUserEmail: '',
      emailRules: [
        v => !!v || 'E-mail is required',
        v => /.+@.+\..+/.test(v) || 'E-mail must be valid',
      ],
      allHelpers: [], // AF(null) and AF([]) can't be differentiated, but I don't care about this right now,
      tutor: {},
      helpDuration: "",
      helpTopic: "",
      isHelpRequestPopupOpen: false,
      incrementToToggleMusic: 0
    }; 
  },
  computed: {
    ...mapState([
      "mitClass",
      "user"
    ]),
    isUserATutor () {
      if (!this.user.notifyOnTutorRequest) return false; 
      else return this.user.notifyOnTutorRequest.includes(this.mitClass.id);
    }
  },
  created () {
    // convert to a forum question if nobody replies, or ask someone else? 
    this.$_bindVarToDB({
      varName: "allHelpers",
      dbRef: db.collection("users").where("notifyOnTutorRequest", "array-contains", this.mitClass.id), // determine how the data structure will look soon
      component: this 
    });
  },
  methods: {
    sendAllNecessaryEmails (newUserEmail) {
      if (newUserEmail) {
        this.emailsOfInvitees.push(newUserEmail)
        this.addFriend(newUserEmail)
        this.newUserEmail = ''
      }
      for (const email of this.emailsOfInvitees) {
        this.sendEmailInvite({ email })
      }
    }, 
    toggleIncludeExclude (email) {
      if (this.emailsOfInvitees.includes(email)) {
        this.emailsOfInvitees = this.emailsOfInvitees.filter(e => e !== email)
      } else {
        this.emailsOfInvitees.push(email)
      }
    },
    toggleNotifyOnTutorRequest (newBoolean) {
      const userRef = db.collection("users").doc(this.user.uid); 
      if (newBoolean === true) {
        userRef.update({
          notifyOnTutorRequest: firebase.firestore.FieldValue.arrayUnion(this.mitClass.id)
        });
      } else {
        userRef.update({
          notifyOnTutorRequest: firebase.firestore.FieldValue.arrayRemove(this.mitClass.id)
        });
      }
    },
    addFriend (newEmail) {
      db.doc(`users/${this.user.uid}`).update({
        emailsOfFriends: firebase.firestore.FieldValue.arrayUnion(newEmail)
      })
    },
    sendEmailInvite (invitee) {
      const sendEmailToPerson = firebase.functions().httpsCallable("sendEmailToPerson");
      const { class_id, section_id, room_id } = this.$route.params;
      sendEmailToPerson({ 
        emailOfPerson: invitee.email, 
        title: `[Explain] ${this.mitClass.name} Help Request`, 
        contentHTML: `
          <p>${this.user.firstName + ' ' + this.user.lastName } requested help:
          <p>"${this.emailMessage}"</p>
          <p><a href="https://explain.mit.edu/class/${class_id}/section/${section_id}/room/${room_id}">Click here to join</a>.</p>
          <p>Tip: to get real-time notifications on your iPad, press on "From: eltonlin@mit.edu" near the top, then press "Add to VIP"</p>
        `,
      });
      this.$root.$emit('show-snackbar', 'Sent email invite!')
    },
    requestForHelp () {
      const sendEmailToPerson = firebase.functions().httpsCallable("sendEmailToPerson");
      const { class_id, section_id, room_id } = this.$route.params;
      sendEmailToPerson({ 
        emailOfPerson: this.tutor.email, 
        title: `[explain.mit.edu] Help Request for ${this.mitClass.name}`, 
        contentHTML: `
          <p>Hello ${this.tutor.firstName} - ${this.user.firstName} requested for your help in ${this.mitClass.name} related to ${this.helpTopic}. He/she expects it to take around ${this.helpDuration} minutes. If you're free, you can join their workspace <a href="https://explain.mit.edu/class/${class_id}/section/${section_id}/room/${room_id}">here</a>.
          <p>If you're busy, no need to do anything.</p>
          <p>To get push notifications on your iPad and iPhone, press on "eltonlin@mit.edu", then press "Add to VIP". Meanwhile I'm working on a way for Explain to just send push notiications without any emails.</p>
        `,
      });
    } 
  }
};
</script>