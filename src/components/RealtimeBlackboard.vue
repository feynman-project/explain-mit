<template>
  <!-- 100vh so the div remains at the same height even if the blackboard is very tall
    meaning the toolbar can succesfully pin to the top
   -->
    <!-- <div style="
      height: 100vh;
      overflow: auto;
    "> -->

    <!-- <div style="overflow-y: auto; overflow-x: none"> -->
  <div v-intersect.once="{ handler: syncBlackboardWithDb, threshold: 0.4 }">
      <div class="overlay-item" v-if="isFetchingStrokes">
        <v-progress-linear indeterminate height="4" color="cyan darken-1"/>
      </div>
    <!-- 
      Unexpected behavior: without the v-container placeholder, when all the strokes appear on all the blackboards,
      there is severe lag. But if the strokes are fetched properly before rendering blackboards, the lag disappears.
     -->
    <!-- <v-container v-if="!hasFetchedBlackboardData" style="height: 100%;">

    </v-container> -->

    <!-- Blackboard -->
    <!-- @update:background-image="image => updateBlackboardBackground(image)" -->
    <!-- QUICKFIX: record-start will change blackboard from infinite to horizontal mode -->
    <!-- @record-end="handleRecordEnd()" -->

    <!-- v-if="hasFetchedBlackboardData" -->
    <Blackboard 
      :backgroundImage="backgroundImage" 
      :strokesArray="strokesArray" @stroke-drawn="stroke => handleNewlyDrawnStroke(stroke)"
      :key="incrementKeyToDestroyComponent"
      @mounted="({ getThumbnailBlob }) => blackboard.getThumbnailBlob = getThumbnailBlob"
      @update:currentTime="currentTime => blackboard.currentTime = currentTime"
      @update:audioBlob="blob => blackboard.audioBlob = blob"
      @record-end="saveVideo()"
    >
      <!-- TODO: don't let user wipe board / set background while recording -->
      <!-- Set Background (overrides the normal behavior) -->
      <template v-slot:set-background-button-slot="{ closeMenu }">
        <v-list-item @click.stop="saveAnimation()">
          <v-icon left color="secondary">mdi-content-save</v-icon>Save
        </v-list-item>
        <!-- <BasePopupButton actionName="Save blackboard" @action-do="uploadExplanation()">
          <template v-slot:activator-button="{ on, openPopup }">
            <v-list-item @click.stop="openPopup(); closeMenu();">
              <v-icon left color="secondary">mdi-content-save</v-icon>Save
            </v-list-item>
          </template>
          
          <template v-slot:message-to-user>
            <v-text-field v-model="explTitle" placeholder="Type the title here..."/>
          </template> 
        </BasePopupButton> -->

        <v-list-item @click="(backgroundImage.blob || backgroundImage.downloadURL) ? resetBackgroundImage() : $refs.fileInput.click()">
          <v-icon left :color="(backgroundImage.blob || backgroundImage.downloadURL) ? 'red' : 'blue'">mdi-image</v-icon>
          {{ (backgroundImage.blob || backgroundImage.downloadURL) ? 'Remove' : 'Background' }} 
          <input 
            @change="e => handleWhatUserUploaded(e)" 
            style="display: none" 
            type="file" 
            ref="fileInput"
          >
        </v-list-item>
      </template>

      <!-- Wipe Board (overrides the normal, offline wiping behavior) -->
      <template v-slot:wipe-board-button-slot="{ closeMenu }">
        <BasePopupButton actionName="Wipe strokes" @action-do="deleteAllStrokesFromDb();">
          <template v-slot:activator-button="{ on, openPopup }">
            <v-list-item @click.stop="openPopup(); closeMenu();">
              <v-icon left color="red">mdi-delete</v-icon> Wipe
            </v-list-item>
          </template>
          <template v-slot:message-to-user>
            Are you sure you want wipe this blackboard's pen strokes?
          </template> 
        </BasePopupButton>
      </template>

      <template v-slot:blackboard-toolbar>
        <slot name="blackboard-toolbar">

        </slot> 

       
      </template> 
    </Blackboard> 
  
    <!-- Popup for saving blackboard -->
    <!-- <v-dialog v-model="dialog" persistent max-width="600">
      <v-card>
        <v-card-title class="headline">Save your recorded explanation?</v-card-title>
        <v-card-text>
          <v-text-field v-model="explTitle" placeholder="(Optional) Enter a title..."/>
        </v-card-text>
        <v-card-actions>
          <v-spacer/>
          <v-btn color="green darken-1" text @click="discardAudio()">
            No, discard it. 
          </v-btn>
          <v-btn color="green darken-1" text @click="saveVideo()">
            Yes, save it in the library.
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog> -->
  </div>
</template>

<script>
/**
 * A real-time blackboard, which is <Blackboard/> hooked up to Firestore.
 * 
 * Proof of database <=> blackboard: 
 * 
 * database => blackboard: 
 *     Whenever a new stroke is added to the database, the database listener will trigger and update 
 *     strokesArray, which propagates to the Blackboard component
 * 
 * blackboard => database: 
 *     Whenever the user draw a new stroke, it will be pushed to `strokesArray` and uploaded to Firestore. 
 *     When the upload finishes, other people will detect the new stroke and update accordingly. 
 *     (Note the user will ignore the new stroke, since he/she drew the stroke in the first place.)
 */
import Blackboard from "@/components/Blackboard.vue"; 
import BaseButton from "@/components/BaseButton.vue"; 
import BasePopupButton from "@/components/BasePopupButton.vue";
import ExplUploadHelpers from "@/mixins/ExplUploadHelpers.js";
import DatabaseHelpersMixin from "@/mixins/DatabaseHelpersMixin.js";
import firebase from "firebase/app"; 
import db from "@/database.js"; 
import { mapState } from "vuex"; 
import { getRandomId } from "@/helpers.js";
import { MASSIVE_MODE_DIMENSIONS } from "@/CONSTANTS.js";
import pdfjs from 'pdfjs-dist'

export default {
  props: {
    blackboardRef: {
      type: null,
      required: true
    }
  },
  mixins: [
    ExplUploadHelpers,
    DatabaseHelpersMixin
  ],
  components: {
    Blackboard,
    BaseButton,
    BasePopupButton,
  },
  data () {
    return {
      isFetchingStrokes: false,
      hasFetchedStrokesFromDb: false,
      hasFetchedBackgroundImage: false,
      strokesArray: [],
      backgroundImage: {
        downloadURL: null,
        blob: null
      },
      blackboard: {
        audioBlob: null,
        getThumbnailBlob: null,
        currentTime: 0
      },
      removeBackgroundImageListener: null,
      removeBlackboardStrokesListener: null,
      dialog: false,
      explTitle: "",
      classId: this.$route.params.class_id,
      roomId: this.$route.params.room_id,
      messagesOpen: false,
      // new code
      incrementKeyToDestroyComponent: 0,
      isMenuOpen: false
    };
  },
  computed: {
    ...mapState([
      "user",
      "mitClass"
    ]),
    hasFetchedBlackboardData () {
      return this.hasFetchedStrokesFromDb && this.hasFetchedBackgroundImage; 
    },
    strokesRef () {
      return this.blackboardRef.collection("strokes");
    }
  },
  destroyed () {
    if (this.removeBlackboardStrokesListener) this.removeBlackboardStrokesListener();
    if (this.removeBackgroundImageListener) this.removeBackgroundImageListener(); 
  },
  methods: {
    syncBlackboardWithDb (entries, observer, isIntersecting) {
      if (isIntersecting) {
        this.keepSyncingStrokesWithDb()
        this.keepSyncingBackgroundWithDb()
        this.isFetchingStrokes = true
      } 
    },
    async saveVideo () {
      this.$root.$emit('show-snackbar', "Uploading the audio file...")
      const basicUserInfo = {
        email: this.user.email,
        uid: this.user.uid,
        firstName: this.user.firstName,
        lastName: this.user.lastName
      }

      const audioDownloadURL = await this.$_saveToStorage(getRandomId(), this.blackboard.audioBlob)
      console.log('audioDownloadURL =', audioDownloadURL)

      await this.blackboardRef.update({
        creator: basicUserInfo,
        date: new Date().toISOString(),
        views: 0,
        audioDownloadURL
      })      
      this.$root.$emit('show-snackbar', 'Successfully uploaded.')
    },
    async saveAnimation () {
      const basicUserInfo = {
        email: this.user.email,
        uid: this.user.uid,
        firstName: this.user.firstName,
        lastName: this.user.lastName
      }
      
      await this.blackboardRef.update({
        creator: basicUserInfo,
        date: new Date().toISOString(),
        views: 0
      })      
      this.$root.$emit('show-snackbar', 'Converted to animation.')
    },
    keepSyncingBackgroundWithDb () {
      this.removeBackgroundImageListener = this.blackboardRef.onSnapshot(blackboardDoc => {
      // update `backgroundImage` prop so BlackboardCoreDrawing updates     
      this.backgroundImage = {
        downloadURL: blackboardDoc.data().backgroundImageDownloadURL,
        blob: null
      };
        if (!this.hasFetchedBackgroundImage) {
          this.hasFetchedBackgroundImage = true; 
        }
      });
    },
    resetBackgroundImage () {
      this.blackboardRef.update({
        backgroundImageDownloadURL: ""
      });
    },
    /** 
    Known issues:
      1. [CRUCIAL] Investigate why each new stroke triggers 2-3 snapshot callbacks 
      2. If the board is wiped while someone else is drawing, it results in diverging states

      Overview of correctness argument: 
        - If database has fewer strokes than the client, it must mean the board was wiped
        - However, during the wiping process, other people could still be drawing 
        - Therefore, the correct response is to first wipe the board, then render drawings
          that other people made during the process (if any). 
      @see explain.mit.edu/class/mDbUrvjy4pe8Q5s5wyoD/posts/k8TLymX9Say5EUoCdxEp
    */
    keepSyncingStrokesWithDb () {
      this.removeBlackboardStrokesListener = this.strokesRef.orderBy("timestamp").onSnapshot(async snapshot => {
        // CASE 1: wipe board operation
        const removedDocs = snapshot.docChanges().filter(change => change.type === "removed"); 
        if (removedDocs.length > 0) {
          this.$root.$emit("show-snackbar", "Someone wiped a blackboard.");
          // trigger <Blackboard/> to wipe the canvas UI via resetting `strokesArray` 
          this.strokesArray = []; 

          /* Wait 1 tick, otherwise <Blackboard/> can't react to `this.strokesArray = []`,
             because of Vue's reactivity caveat: "If the same watcher is triggered multiple times, it will be pushed into the queue only once."
             More info here: https://vuejs.org/v2/guide/reactivity.html */
          await this.$nextTick();

        /* If people added strokes while Firestore was still deleting documents,
           then the blackboard should NOT end up being empty. */
         if (snapshot.docs.length > 0) {
          snapshot.docs.forEach(doc => {
            this.strokesArray.push(
              this.convertDocToStroke(doc)
            );
          });
         }
        } 

        // CASE 2: add stroke operation
        else {
          // CASE 2a: stroke added by the user himself/herself
          if (snapshot.docs.length === this.strokesArray.length) {
            // do nothing
          } 

          // CASE 2b: stroke added by someone else 
          else {
            snapshot.docChanges().filter(change => change.type === "added").forEach(change => {
              this.strokesArray.push(
                this.convertDocToStroke(change.doc)
              );
            });
          }
        }
        if (!this.hasFetchedStrokesFromDb) { 
          this.hasFetchedStrokesFromDb = true
          this.isFetchingStrokes = false
          this.$root.$emit("show-snackbar", `Fetched ${this.strokesArray.length} strokes.`)
        }
      });
    },
    /**
     * Artifically smooths out new strokes that were created by other people 
     * with a period of 1 second. 
     * 
     * Crucially, each strokesArray's timestamps are subjective i.e. based off of the user's currentTime,
     * unlike Firestore which keeps track of objective time. This is so that whoever records a video, the order of strokes will be the same as
     * what that user observed originally. 
    */ 
    convertDocToStroke (doc) {
      const strokeObject = {
        id: doc.id,
        ...doc.data(),
      };
      // make the timestamp subjective
      strokeObject.startTime = this.blackboard.currentTime; 
      strokeObject.endTime = this.blackboard.currentTime; 

      if (!doc.data().isErasing) {
        // artifically add a 0.5 second period to the stroke
        strokeObject.endTime += 0.5;
      } 
      return strokeObject;
    },
    /**
     * Helps maintain the invariant that UI => RealtimeBlackboard's strokesArray,
     * and uploads the new stroke to Firestore.
     */
    handleNewlyDrawnStroke (stroke) {
      this.strokesArray.push(stroke); 
      this.uploadToDb(stroke);
    },
    async uploadToDb (stroke) {
      try {
        this.strokesRef.doc(stroke.id).set({
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
          ...stroke
        });
      } catch (error) {
        this.$root.$emit("show-snackbar", "Failed to upload stroke to database.");
      }
    },
    // Background images
    async handleWhatUserUploaded (e) {
      const imageFile = e.target.files[0]; 
      if (!imageFile) return; 
      if (imageFile.type.split("/")[0] === "image") {
        this.$root.$emit("show-snackbar", "Uploading image as background...");
        const backgroundImageDownloadURL = await this.$_saveToStorage(
          this.blackboardRef.path,
          imageFile
        );
        this.blackboardRef.update({ backgroundImageDownloadURL });
      } else if (imageFile.type.split("/")[1] === "pdf") {
        this.$root.$emit("show-snackbar", "Uploading the PDF as background...");
        this.pdfToImage(imageFile);
      } else {
        this.$root.$emit("show-snackbar", "Error: only image files are supported for now.");
      }
    },
    async pdfToImage (src) {
      // prevent issue: htts://stackoverflow.com/a/63406257/7812829
      pdfjs.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.3.200/pdf.worker.min.js";

      pdfjs.getDocument(URL.createObjectURL(src)).promise.then(doc=> {
        doc.getPage(1).then((page) => {
          // Render the page on a Node canvas with 100% scale.
          var viewport = page.getViewport({ scale: 1.0 });
          // console.log('the viewport', viewport);
          const dummyCanvas = document.createElement("canvas");
          dummyCanvas.width = viewport.width;
          dummyCanvas.height = viewport.height;
          const ctx = dummyCanvas.getContext("2d");
          var renderContext = {
            canvasContext: ctx,
            viewport: viewport
          };

          // now, tap into the returned promise from render:
          return page.render(renderContext).promise.then(async () => {
            const dataURL = dummyCanvas.toDataURL("image/png");

            const current_date = new Date();
            const file = this.dataURLtoFile(dataURL, current_date.getTime()+'.png');
            
            const backgroundImageDownloadURL = await this.$_saveToStorage(
              this.blackboardRef.path,
              file
            );
            this.blackboardRef.update({ backgroundImageDownloadURL });
          });
        });
      }).catch(error => {
        this.$root.$emit("show-snackbar", "Error: while trying to load pdf.");
      });
    },
    // https://stackoverflow.com/questions/16968945/convert-base64-png-data-to-javascript-file-objects/16972036
    // function to convert dataURL from canvas to file object
    dataURLtoFile (dataurl, filename) {
      var arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
        bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
      while(n--){
        u8arr[n] = bstr.charCodeAt(n);
      }
      return new File([u8arr], filename, {type:mime});
    },
    async uploadExplanation () {
      // TODO: refactor backgroundImage so the blob is fetched once (otherwise display background will 
      // make many calls to the internet during resizing which is highly inefficient). We can then
      // just directly upload it instead of making another fetch from storage. 
      const promises = [];
      let thumbnailBlob;
      let backgroundImageBlob;
      
      promises.push(
        this.blackboard.getThumbnailBlob().then(blob => thumbnailBlob = blob)
      );
  
      // need to upload an independent copy of the background image
      // as the current blackboard's background image can be wiped and changed at any time on Firebase storage
      const { downloadURL } = this.backgroundImage; 
      if (downloadURL) {
        promises.push(
          this.$_getBlobFromStorage(downloadURL).then(blob => backgroundImageBlob = blob)
        );
      }

      await Promise.all(promises);

      this.$_saveExplToCacheThenUpload({
        aspectRatio: MASSIVE_MODE_DIMENSIONS.HEIGHT / MASSIVE_MODE_DIMENSIONS.WIDTH,
        thumbnailBlob,
        audioBlob: this.blackboard.audioBlob,
        backgroundImageBlob,
        html: "",
        title: this.explTitle ? this.explTitle : `Untitled (${new Date().toLocaleDateString()})`, 
        tags: [this.$route.params.class_id], // i.e. save it to the default folder of the class library
        explRef: db.doc(`classes/${this.mitClass.id}/posts/${getRandomId()}`)
      });
      
      // reset variables
      this.explTitle = ""; 
    },
    /**
     * NOTE: the rep invariant of Blackboard is that strokesArray only has one stroke added at a time
     * And that if it's removed, it's reset. 
     */
    async deleteAllStrokesFromDb () {
      const batchDeleteRequests = [];
      let currentBatch = db.batch();
      let currentBatchSize = 0;
      for (const stroke of this.strokesArray) {
        if (currentBatchSize >= 500) {
          batchDeleteRequests.push(currentBatch.commit());
          currentBatch = db.batch(); 
          currentBatchSize = 0; 
        } 
        currentBatch.delete(this.strokesRef.doc(stroke.id));
        currentBatchSize += 1;
      }
      batchDeleteRequests.push(currentBatch.commit()); 
      console.log("number of strokes =", this.strokesArray.length);
      console.log("number of batches to be deleted =", currentBatchSize); 
      
      await Promise.all(batchDeleteRequests);
    },
    handleRecordEnd () {
      // ask if the user wants to save/discard the recorded explanation 
      this.dialog = true; 
    },
    // saveVideo () {
    //   this.dialog = false; 
    //   this.uploadExplanation(); 
    //   this.incrementKeyToDestroyComponent += 1; 
    // },
    discardAudio () {
      this.dialog = false; 
      this.incrementKeyToDestroyComponent += 1; 
    },
    toggleChat () {
      this.messagesOpen = !this.messagesOpen;
    }
  }
}
</script>

