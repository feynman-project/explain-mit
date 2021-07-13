<template>
  <div>  
    <VideoConferenceRoom
      :roomID="roomID"
    />

    <!-- For wiping all the blackboards -->
    <v-dialog v-model="isWipeBoardsPopupOpen">
      <v-card>
        <v-card-title>
          Are you sure you want to wipe the pen strokes of every blackboard in this room?
        </v-card-title>
        <v-card-actions>
          <v-spacer/>
          <v-btn @click="isWipeBoardsPopupOpen = false">CANCEL</v-btn>
          <v-btn @click="cloudFunctionsDelete(); isWipeBoardsPopupOpen = false;">
            WIPE ALL STROKES
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- For saving all the whiteboards -->
    <v-dialog v-model="isSaveBoardsPopupOpen">
      <v-card>
        <v-card-title>
          This will save your sequence of blackboard explanations into the library. 
        </v-card-title>
        <v-card-text>
          <v-text-field placeholder="Enter a title for the collection of explanations..." v-model="titleOfExplCollection"/>
        </v-card-text>
      
        <v-card-actions>
          <v-spacer/>
          <v-btn @click="isSaveBoardsPopupOpen = false">CANCEL</v-btn>
          <v-btn @click="cloudFunctionsSave(); isSaveBoardsPopupOpen = false;" color="accent">
            Save
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- For wiping the PDFs -->
    <v-dialog v-model="isClearPDFsPopupOpen">
      <v-card>
        <v-card-title>
          This will remove the PDFs seeded on each blackboard, but will not wipe the pen strokes. 
        </v-card-title>
      
        <v-card-actions>
          <v-spacer/>
          <v-btn @click="isClearPDFsPopupOpen = false">CANCEL</v-btn>
          <v-btn @click="clearAllPDFs(); isClearPDFsPopupOpen = false;" color="accent">
            Wipe all PDFs
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Update status -->
    <v-dialog v-model="isRoomStatusPopupOpen" width="500">
      <v-card>
        <v-card-title>
          HELP / DONE 
        </v-card-title>

        <div style="display: flex; justify-content: center;">
          <v-chip color="blue" class="white--text" @click="newRoomStatus = 'Help!'; updateRoomStatus(); isRoomStatusPopupOpen = false;">Help!</v-chip>
          <v-chip color="blue" class="white--text" @click="newRoomStatus = 'Done.'; updateRoomStatus(); isRoomStatusPopupOpen = false;">Done.</v-chip>
          <v-chip color="blue" class="white--text" @click="newRoomStatus = ''; updateRoomStatus(); isRoomStatusPopupOpen = false;">(reset)</v-chip>
        </div>

        <!-- <v-card-text>
          <v-text-field v-model="newRoomStatus" placeholder="(You can empty the status by entering nothing.)"/>
        </v-card-text> -->
      
        <v-card-actions>
          <v-spacer/>
          <v-btn @click="isRoomStatusPopupOpen = false">CANCEL</v-btn>
          <!-- <v-btn @click="updateRoomStatus(); isRoomStatusPopupOpen = false;" color="accent">
            Update status
          </v-btn> -->
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="isRenameRoomPopupOpen" width="500">
      <v-card>
        <v-card-title>
          Rename
        </v-card-title>

        <v-card-text>
          <v-text-field v-model="newRoomName" placeholder="e.g. Staff room"/>
        </v-card-text>
      
        <v-card-actions>
          <v-spacer/>
          <v-btn @click="isRenameRoomPopupOpen = false">CANCEL</v-btn>
          <v-btn @click="renameRoom(); isRenameRoomPopupOpen = false;" color="black" dark>
            Rename
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- INFINITE TUTORING -->
    <v-dialog v-model="isInviteFriendsPopupOpen" max-width="800">
      <InviteFriends v-if="isInviteFriendsPopupOpen"/>
    </v-dialog> 

    <portal to="table-level-actions">
      <!-- @click.native.stop could enable the use of v-on from here https://github.com/vuetifyjs/vuetify/issues/3333 -->
      <!-- It sadly doesn't work here -->
      <v-menu offset-y bottom>
        <!-- Triple-dots button -->
        <template v-slot:activator="{ on }">
          <BaseButton :on="on" stopPropagation icon="mdi-dots-vertical" color="black" small>
            <v-badge v-if="numOfUnreadMsgsInTable" 
              :value="numOfUnreadMsgsInTable" 
              :content="numOfUnreadMsgsInTable" 
              color="green" 
              top 
              left 
              offset-x="25" 
              offset-y="-25">
            </v-badge>
          </BaseButton>
        </template>
        
        <v-list>
          <v-list-item @click="isInviteFriendsPopupOpen = true">
            <v-icon left color="purple">mdi-account-plus</v-icon> 
            <div style="font-color: purple">Request help</div>
          </v-list-item> 

          <v-divider/>
        
          <v-menu
            v-model="isChatOpen"
            :close-on-content-click="false"
            :close-on-click="false"
            max-height="225" left nudge-top="196" style="max-width: 200px; z-index: 5;"
          >
            <template v-slot:activator="{ on }">
              <v-badge 
                :value="numOfUnreadMsgsInTable"
                :content="numOfUnreadMsgsInTable"
                top right color="green" overlap style="z-index: 1;"
              >
                <v-list-item v-on="on">
                  <v-icon class="mr-2" color="green">mdi-chat</v-icon>
                  Chat
                </v-list-item>
                <!-- <BaseButton :on="on" stopPropagation icon="mdi-chat" color="black" small>
                    
                </BaseButton> -->
              </v-badge>
            </template>

            <v-card max-width="250">
              <v-card-text class="pa-0">
                <ZoomChat v-if="isChatOpen"
                  :messagesDbPath="`classes/${classID}/rooms/${roomID}/messages`"
                  :participantsDbRef="roomParticipantsRef"
                  :notifFieldName="`numOfUnreadMsgsInTable:${roomID}`"
                >
                  <v-btn icon @click="isChatOpen = false" small>
                    <v-icon color="black">mdi-close</v-icon>
                  </v-btn>
                </ZoomChat>   
              </v-card-text>
            </v-card>
          </v-menu>

          <v-list-item @click="isRenameRoomPopupOpen = true">
            <v-icon left color="blue">mdi-pencil</v-icon> Rename
          </v-list-item>

          <v-list-item>
            <!-- <v-chip color="blue" class="white--text" @click="newRoomStatus = 'Requesting help'; updateRoomStatus(); isRoomStatusPopupOpen = false;">Requesting help</v-chip> -->
            <v-chip color="blue" class="white--text" @click="toggleCollabStatus()">Down to collaborate</v-chip>
            <!-- <v-chip color="blue" class="white--text" @click="newRoomStatus = ''; updateRoomStatus(); isRoomStatusPopupOpen = false;">(reset)</v-chip> -->
          </v-list-item>

          <!-- <v-list-item @click="isSaveBoardsPopupOpen = true" :loading="isSavingAllBoards">
            <v-icon left color="cyan">mdi-content-save-all</v-icon> Save sequence of boards
          </v-list-item> -->

          <!-- DELETE OPERATIONS ARE RARE AND REQUIRE TWO-THREE CLICKS -->
          <v-list-item>
            <v-icon left color="red darken-5">mdi-delete</v-icon> 
            Delete
          </v-list-item>

          <!-- <v-list-item @click="isWipeBoardsPopupOpen = true" :loading="isClearingAllBoards">
            <v-icon left color="red darken-5">mdi-delete-alert</v-icon> Wipe all boards in table
          </v-list-item> -->
          
          <!-- <v-list-item @click="isClearPDFsPopupOpen = true" :loading="isClearingAllPDFs">
            <v-icon left color="red darken-5">mdi-file-remove-outline</v-icon> Wipe all backgrounds
          </v-list-item> -->

          <!-- Can't delete the default room -->
          <!-- <v-list-item :disabled="roomID === classID" @click="deleteThisRoom()">
            <v-icon left color="red">mdi-delete</v-icon> Delete this room
          </v-list-item> -->
        </v-list>
      </v-menu>
    </portal>

    <!-- Display Zoom videos -->
    <portal-target name="destination">
    
    </portal-target>

    <portal to="right-side-of-my-participant-name">
      <!-- For switching between different blackboards -->
      <!-- item-color:  -->
      <!-- active-class:  -->
      <!-- hide-details: eliminates unnecessary bottom padding -->
      <div v-if="room" class="d-flex">
        <div v-if="currentBoardID">
          <!-- `click.native.stop` is the workaround for the menu causing the entire page to reload https://github.com/vuetifyjs/vuetify/issues/3333#issuecomment-366832774 -->
          <v-menu @click.prevent.stop fixed offset-y bottom>
            <template v-slot:activator="{ on }">
              <!-- `click.prevent.stop -->
              <v-btn v-on="on" @click.prevent.stop height="30" text tile class="px-0" 
                :style="`text-align: center; padding-top: 0; font-size: 1.1rem; font-weight: 400;`" max-width="180"
              >
                <!-- The board switch button looks like a blackboard itself -->
                <span class="`d-inline-block text-truncate" 
                    :style="
                      `color: ${currentTool.color}; width: 42px; height: 32.5px; display: flex !important; justify-content: center; align-items: center; background-color: rgb(62, 66, 66)`
                ">
                  {{ getBoardNumberFromID(currentBoardID) }}
                </span>
                <v-spacer/>
                <v-icon>mdi-menu-down</v-icon>
              </v-btn>
            </template>

            <v-list style="overflow-y: auto; max-height: 400px" class="py-0">
              <template v-for="(boardID, i) in room.blackboards">
                <Drag :transfer-data="{ draggedFrom: i } " :key="boardID">
                  <Drop @drop="handleDrop({ droppedTo: i }, ...arguments)">
                    <v-list-item 
                      @click="$store.commit('SET_CURRENT_BOARD_ID', boardID)"
                      style="background-color: rgb(62, 66, 66);"
                      class="px-0"
                    >
                      <div :style="`margin: auto; color: ${currentTool.color};`">
                        {{ getBoardNumberFromID(boardID) }}
                      </div>
                    </v-list-item>
                    <v-divider class="white--text"/>
                  </Drop>
                </Drag>
              </template>

              <BaseButton @click="createNewBoard()" icon="mdi-plus" color="white" style="background-color: rgb(62, 66, 66);">
                New board
              </BaseButton>
            </v-list>
          </v-menu>
        </div>
      </div>
    </portal>


    <!-- EDIT TITLE AND DESCRIPTION -->
    <v-dialog :value="isEditPopupOpen" width="600">
      <v-card>
        <v-card-title>Edit explanation</v-card-title>
        <v-card-text>
          <v-text-field v-model="newTitle" placeholder="title"/>

          <ReusableTextEditor 
            v-model="newDescriptionHtml"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer/>
          <v-btn @click="isEditPopupOpen = false">CLOSE</v-btn>
          <v-btn @click="editTitleAndDescription()">SAVE</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <template v-if="blackboardRefs.length !== 0 && room">
      <template v-for="(boardID, i) in room.blackboards">
        <RenderlessFetchBlackboardDoc
          :blackboardRef="blackboardRefs[i]"
          :key="boardID"
          v-slot="{ creator, date, audioDownloadURL, backgroundImageDownloadURL, title, descriptionHtml }"
        >  

          <!-- If blackboard is already saved/recorded -->
          <RenderlessFetchStrokes v-if="date && creator"
            :strokesRef="blackboardRefs[i].collection('strokes')"
            :imageDownloadUrl="backgroundImageDownloadURL"
            v-slot="{ fetchStrokes, strokesArray, imageBlob, isLoading }"
          >
            <div style="position: relative;" v-intersect.once="{
              handler (entries, observer, isIntersecting) {
                if (isIntersecting) {
                  fetchStrokes(); 
                } 
              },
              options: {
                threshold: 0.5
              }
            }"
            > 
              <template>
                <v-card>
                  <v-card-title v-if="title" style="font-size: 1.6rem">
                    {{ title }}
                  </v-card-title>
                  <v-card-text>
                    <div v-if="descriptionHtml" class="mb-5 html-paragraph-styles"
                      v-html="descriptionHtml"
                    />
                    <template v-if="strokesArray.length > 0">
                      <DoodleVideo v-if="audioDownloadURL"
                        :strokesArray="strokesArray"
                        :imageBlob="imageBlob"
                        :audioUrl="audioDownloadURL"
                        :aspectRatio="4/3"
                        style="margin-top: 5px"
                        @edit="showEditPopup(blackboardRefs[i], title, descriptionHtml)"
                        @delete="deleteVideo({ audioDownloadURL, creator, videoRef: blackboardRefs[i] })"
                      />
                      <DoodleAnimation v-else
                        :strokesArray="strokesArray"
                        :backgroundUrl="backgroundImageDownloadURL"
                        :aspectRatio="4/3"
                        style="margin-top: 5px"
                        @edit="showEditPopup(blackboardRefs[i], title, descriptionHtml)"
                        @delete="deleteAnimation({ creator, animationRef: blackboardRefs[i] })"
                      />
                    </template>
                  </v-card-text>
                </v-card>
              </template>
            </div>
          </RenderlessFetchStrokes>

          <RealtimeBlackboard v-else
            :blackboardRef="blackboardRefs[i]" 
            :key="boardID"
            style="margin-top: 5px"
          />
        </RenderlessFetchBlackboardDoc>
      </template>
    </template>
  </div>
</template>

<script>
/**
 *  TODO: 
 *    - Confirm exit popup so you don't interrupt a long audio recording because of a misclick/mis-swipe
 * 
 * 
 *  CORRECTNESS ARGUMENT
 * 
 * Because RealtimeRoom is rendered by a <router-view :key="$route..."/> component
 * it will be properly destroyed, and so its children components don't require destroy keys.
 * 
 * Note, $this.$route.room_id can be mutate. It gets mutated. 
 * When you write modular code, you win against the most sophisticated and nuanced bugs that exist in the world. 
 * You immediately kill all possibilities of anything. I can never emphasize enough.
 * 
 */


import firebase from "firebase/app";
import "firebase/firestore";
import "firebase/functions";
import DatabaseHelpersMixin from "@/mixins/DatabaseHelpersMixin.js";
import db from "@/database.js";
import BaseButton from "@/components/BaseButton.vue";
import BaseIconButton from "@/components/BaseIconButton.vue";
import { mapState, mapGetters } from "vuex";
import RealtimeBlackboard from "@/components/RealtimeBlackboard.vue";
import { getRandomId } from "@/helpers.js";
import VideoConferenceRoom from "@/components/VideoConferenceRoom.vue";
import ZoomChat from "@/components/ZoomChat.vue";
import InviteFriends from "@/components/InviteFriends.vue"; 
import DoodleAnimation from '@/components/DoodleAnimation.vue'
import DoodleVideo from '@/components/DoodleVideo.vue'
import RenderlessFetchBlackboardDoc from '@/components/RenderlessFetchBlackboardDoc'
import RenderlessFetchStrokes from '@/components/RenderlessFetchStrokes.vue'
import ReusableTextEditor from '@/components/ReusableTextEditor.vue'
import { Drag, Drop } from 'vue-drag-drop'

export default {
  props: {
    roomID: {
      type: String,
      required: true
    },
    isCommonRoom: {
      type: Boolean,
      default () {
        return false;
      }
    }
  },
  components: {
    RealtimeBlackboard,
    BaseButton,
    BaseIconButton,
    VideoConferenceRoom,
    ZoomChat,
    InviteFriends,
    DoodleAnimation,
    DoodleVideo,
    Drag,
    Drop,
    RenderlessFetchBlackboardDoc,
    RenderlessFetchStrokes,
    ReusableTextEditor
  },
  mixins: [
    DatabaseHelpersMixin
  ],
  data () {
    return {
      room: null,
      blackboardRefs: [],
      snapshotListeners: [],
      roomRef: null,
      incrementToDestroyComponent: -100000,
      isMenuOpen: false,
      isSavingAllBoards: false,
      isClearingAllBoards: false,
      isClearingAllPDFs: false,
      isWipeBoardsPopupOpen: false,
      isSaveBoardsPopupOpen: false,
      isClearPDFsPopupOpen: false,
      isRoomStatusPopupOpen: false,
      isRenameRoomPopupOpen: false,
      isInviteFriendsPopupOpen: false,

      titleOfExplCollection: "",
      newRoomStatus: "",
      newRoomName: "",

      isChatOpen: false,

      isEditPopupOpen: false,
      refOfExplEdited: null,
      newTitle: '',
      newDescriptionHtml: '',
    }
  },
  computed: {
    ...mapState([
      "user",
      "mitClass",
      "session",
      'micStream',
      "isBoardFullscreen",
      "currentTool",
      "currentBoardID",
      "currentBoardNumber"
    ]),
    ...mapGetters([
      "numOfUnreadMsgsInTable"
    ]),
    classID () { return this.$route.params.class_id; },
    roomParticipantsRef () {
      const { classID, roomID } = this; 
      return db.collection(`classes/${classID}/participants`).where("currentRoom", "==", roomID); 
    }
  },
  // database => state 
  watch: {
    // boardNumber is just useful for UI, so the boardID => boardNumber sufficies, and there is no need yet for boardNumber => boardID
    currentBoardID (newVal) {
      // updates `currentBoardNumber`, assumes `this.room.blackboards` is hydrated
      // correct because `activeBoardID` can only be changed via user interaction, `this.room.blackboards` is defined
      this.$store.commit(
        "SET_CURRENT_BOARD_NUMBER", 
        this.getBoardNumberFromID(newVal)
      );
    },
    room: {
      handler (newVal, oldVal) {
        this.$store.commit("SET_ROOM", this.room);
        if (newVal.blackboards) {
          const newBlackboardRefs = []; 
          for (const blackboard of newVal.blackboards) {
            newBlackboardRefs.push(
              db.doc(`classes/${this.classID}/blackboards/${blackboard}`)
            );
          }
          this.blackboardRefs = newBlackboardRefs; 
        }
      }
    }
  },
  async created () {
    this.roomRef = db.doc(`classes/${this.classID}/rooms/${this.roomID}`);
    this.$_listenToDoc(this.roomRef, this, "room").then(unsubFunc => {
      this.$store.commit("SET_CURRENT_BOARD_ID", this.room.blackboards[0]); // TODO: perhaps this is a special case that can be "naturally handled" by the general case
      this.snapshotListeners.push(unsubFunc);
    });
  },
  destroyed () {
    for (const detachListener of this.snapshotListeners) {
      detachListener();
    }
  },
  methods: { 
    async handleDrop ({ droppedTo }, { draggedFrom }) {
      const i = draggedFrom
      const j = droppedTo
      const blackboardsCopy = [...this.room.blackboards]
      const draggedBoardID = blackboardsCopy[i]

      // remove 
      const removeOneElement = 1
      blackboardsCopy.splice(i, removeOneElement)

      // insert
      const removeNoElement = 0
      blackboardsCopy.splice(j, removeNoElement, draggedBoardID)  
        
      // make an update operation
      await this.roomRef.update({
        blackboards: blackboardsCopy
      })
      this.$root.$emit('show-snackbar', 'Rearranged order.')
    },
    toggleCollabStatus () {
      if (this.room.status === 'Down to collaborate') {
        this.newRoomStatus = ''
      } else {
        this.newRoomStatus = 'Down to collaborate'
      }
      this.updateRoomStatus()
      this.isRoomStatusPopupOpen = false 
    },
    showEditPopup (refOfExplEdited, title, descriptionHtml) {
      this.refOfExplEdited = refOfExplEdited
      this.isEditPopupOpen = true
      // pre-populate the values
      if (title) this.newTitle = title
      if (descriptionHtml) this.newDescriptionHtml = descriptionHtml
    },
    async editTitleAndDescription () {
      await this.refOfExplEdited.update({
        title: this.newTitle,
        descriptionHtml: this.newDescriptionHtml
      })
      this.newTitle = ''
      this.newDescriptionHtml = ''
      this.refOfExplEdited = null
      this.isEditPopupOpen = false
    },
    // incrementNumOfViewsOnExpl () {
    //   const ref = db.doc(`${this.expl.ref}`);
    //   ref.update({
    //     views: firebase.firestore.FieldValue.increment(1)
    //   });
    // },
    // TODO: 
    //   - be able to delete blackboards
    //   - delete the blackboard doc itself 
    //   - delete its subcollections with Cloud Functions
    // the reference to the blackboard is deleted from the parent: try to extract the id and do an array remove operation
    async deleteAnimation ({ creator, animationRef }) {
      if (creator.email && creator.email !== this.user.email) {
        alert('You need to be the creator to unsave this animation')
        return
      }
      await animationRef.update({ 
        creator: firebase.firestore.FieldValue.delete(),
        date: firebase.firestore.FieldValue.delete()
      })
      this.$root.$emit('show-snackbar', 'Reverted animation to blackboard')
    },
    /**
     * Resets it into a blackboard (no need to delete the strokes)
     *   - note: this operation can't be atomic because db.batch() only works for Firestore and not for Storage
     */
    async deleteVideo ({ videoRef, creator, audioDownloadURL }) {
      // check permissions for delete 
      if (creator.email && creator.email !== this.user.email) {
        alert('Not allowed to delete video')
        return
      }
      const storage = firebase.storage()
      const audioRef = storage.refFromURL(audioDownloadURL);  
      audioRef.delete().then(async () => {
      console.log('successfully deleted the audio')
        // File deleted successfully
        await videoRef.update({ 
          audioDownloadURL: '',
          creator: firebase.firestore.FieldValue.delete(),
          date: firebase.firestore.FieldValue.delete()
        })
        console.log('removed reference to audioURL and deleted creator and date fields')
        this.$root.$emit('show-snackbar', 'Reverted video to blackboard')
      }).catch((error) => {
        // Uh-oh, an error occurred!
      });
    },
    async deleteThisRoom () {
      // warning: the strokes will remain, but find a fix later as Feynman is way more likely to die from other things
      const batch = db.batch();
      console.log("roomRef =", this.roomRef); 
      batch.delete(this.roomRef); 
      for (const boardID of this.room.blackboards) {
        console.log("boardID =", boardID); 
        batch.delete(
          db.doc(`classes/${this.classID}/blackboards/${boardID}`)
        );
      }
      console.log("batch is committing =", batch); 
      await batch.commit(); 
      this.$root.$emit("show-snackbar", "Room was deleted.")
    },
    async createNewBoard () {
      const roomRef = db.doc(`classes/${this.classID}/rooms/${this.roomID}`);
      const blackboardsRef = db.collection(`classes/${this.classID}/blackboards`);
      const newID = getRandomId();  
      // TODO: use batch operation
      await Promise.all([
        blackboardsRef.doc(newID).set({
          roomType: '',
        }),
        roomRef.update({
          blackboards: firebase.firestore.FieldValue.arrayUnion(newID)
        })
      ]);  
      this.$store.commit("SET_CURRENT_BOARD_ID", newID); 
    },
    getBoardNumberFromID (id) {
      for (const [i, boardID] of this.room.blackboards.entries()) {
        if (boardID === id) {
          return i + 1; 
        }
      }
    },
    renameRoom () {
      db.doc(`classes/${this.classID}/rooms/${this.roomID}`).update({ 
        name: this.newRoomName
      });
      this.newRoomName = ""; 
    },
    updateRoomStatus () {
      db.doc(`classes/${this.classID}/rooms/${this.roomID}`).update({ 
        status: this.newRoomStatus
      });
      this.newRoomStatus = ""; 
    },
    async clearAllPDFs () {
      this.isClearingAllPDFs = true;
      const promises = []; 
      for (const boardID of this.room.blackboards) {
        const boardRef = db.doc(`/classes/${this.classID}/blackboards/${boardID}`);
        promises.push(
          boardRef.update({ backgroundImageDownloadURL: "" })
        );
      }
      await Promise.all(promises); 
      this.isClearingAllPDFs = false;
      this.$root.$emit("show-snackbar", "Succesfully cleared all PDF problems in this room");
    },
    async cloudFunctionsDelete () {
      function deleteAtPath(path) {
        return new Promise((resolve, reject) => {
          var deleteFn = firebase.functions().httpsCallable('recursiveDelete');
          deleteFn({ path: path })
            .then(function(result) {
              console.log('Delete success: ' + JSON.stringify(result));
              resolve(); 
            })
            .catch(function(err) {
              console.log('Delete failed, see console,');
              console.warn(err);
              reject(); 
            });
        });
      }

      const promises = []; 
      // now try just deleting each of the blackboards in the common room
      this.$root.$emit("show-snackbar", "Wiping the boards (this might take a while)...");
      this.isClearingAllBoards = true; 
      for (const boardID of this.room.blackboards) {
        promises.push(
          deleteAtPath(`/classes/${this.$route.params.class_id}/blackboards/${boardID}/strokes`)
        );
      }
      await Promise.all(promises); 
      this.isClearingAllBoards = false; 
      this.$root.$emit("show-snackbar", "Succesfullly wiped the boards.");
    },
    async cloudFunctionsSave () {
      const titleOfExplCollection = this.titleOfExplCollection;
      function saveBoardAsExpl({ boardDbPath, explDbPath, mitClass, user, title }) {
        return new Promise(async (resolve, reject) => {
          const saveFn = firebase.functions().httpsCallable("saveExpl"); 
          try {
            const result = await saveFn({ 
              title,
              boardDbPath,
              explDbPath, 
              mitClass,
              user
            });
            console.log("Finished the upload operation, result =", result);
            resolve(); 
          } 
          catch (error) {
            console.log("Cloud Functions failed, error =", error); 
          }
        });
      }

      this.isSavingAllBoards = true; 
      // constants that'll be re-used in the for loop below
      const mitClass = {
        id: this.mitClass.id,
        name: this.mitClass.name,
        maxOrder: this.mitClass.maxOrder
      };
      const user = {
        uid: this.user.uid,
        firstName: this.user.firstName,
        lastName: this.user.lastName,
        email: this.user.email
      }; 
      
      const newPostID = getRandomId(); 
      const { class_id } = this.$route.params; 
      const newPostDbPath = `classes/${class_id}/posts/${newPostID}`;
      const newPostTitle = titleOfExplCollection ? titleOfExplCollection : `Lecture Recording (${new Date().toLocaleTimeString()})`; 

      try {
        const promises = []; 
        // save first board as a post, save the rest as replies to the first board (to conform to the legacy API of visual Piazza)
        for (const [i, boardID] of this.room.blackboards.entries()) {
          promises.push(
            saveBoardAsExpl({
              boardDbPath: `classes/${class_id}/blackboards/${boardID}`,
              title: i === 0 ? newPostTitle : "",
              explDbPath: i === 0 ? newPostDbPath : `${newPostDbPath}/replies/${getRandomId()}`,
              mitClass,
              user
            })
          );
        }
        await Promise.all(promises);
      } catch (error) {
        this.$root.$emit("show-snackbar", "Saving failed, error =", error);
      } finally {
        this.isSavingAllBoards = false; 
      }
    }
  }
};
</script>

<style scoped>
/* .html-paragraph-styles >>> h2 {
  font-size: 2rem
} */

.html-paragraph-styles >>> p {
  font-size: 1.1rem
}

.overlay-item {
  position: absolute; 
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  align-items: center;
}
</style>
