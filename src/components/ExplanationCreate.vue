<template>
  <v-card data-qa="create-expl">
    <v-container fluid>
      <!-- Title -->
      <v-col cols="12" md="6" class="pa-0">
        <v-text-field v-if="explType === 'post'" 
          placeholder="Title"
          v-model="postTitle"
          color="accent"
          hide-details
          class="mb-5"
          data-qa="title-field"
          id="title"
        />
      </v-col>

      <!-- Text Editor -->
      <TextEditor @update:html="html => this.html = html" :editable="true" :key="changeKeyToForceReset + 1"/>
      <p class="red--text">{{ messageToUser }}</p>
      
      <div v-if="user" class="d-flex align-center">
        <v-row align="center" justify="space-between">
          <v-col cols="auto">
            <v-switch v-model="isAnonymous" label="Toggle Anonymous" color="accent"/>
            <v-select v-if="explType === 'post'" :items="tagSelect" v-model="folder" dense outlined label="Add to Folder" color="accent"></v-select>
          </v-col>

          <v-col cols="auto">
            <v-btn v-if="!isUploadingPost"
              @click="uploadExplanation()" 
              :loading="isButtonDisabled" 
              :disabled="isButtonDisabled"
              color="accent" 
              class="ma-0 white--text" 
              data-qa="submit-post-btn"
            >
              SUBMIT {{ isAnonymous ? "anonymously" : `as ${user.firstName}` }}
              <v-icon class="pl-2">mdi-send</v-icon>
              <template v-slot:loader>
                <span v-if="isRecordingVideo">Recording...</span> 
                <span v-else-if="isUploadingPost">Uploading...</span>
              </template>
            </v-btn>
          </v-col>
        </v-row>
      </div>

      <!-- Upload Progress Bar -->
      <v-progress-linear
        :value="uploadProgress"
        :active="isUploadingPost"
        height="30"
        color="green"
        class="white--text text-small"
      >
        Uploading...
      </v-progress-linear>

      <!-- Blackboard (use `v-show` to preserve the data even when Blackboard is hidden) -->
      <Blackboard v-show="!isPreviewing"
        :key="changeKeyToForceReset"
        :isRealtime="false"
        :strokesArray="strokesArray" @stroke-drawn="stroke => strokesArray.push(stroke)"
        :backgroundImage="blackboard.backgroundImage" @update:background-image="newImage => blackboard.backgroundImage = newImage"
        @board-reset="strokesArray = []"
        @mounted="blackboardMethods => bindBlackboardMethods(blackboardMethods)"
        @update:audioBlob="audioBlob => blackboard.audioBlob = audioBlob"
        @update:currentTime="currentTime => blackboard.currentTime = currentTime"
        @record-start="isRecordingVideo = true"
        @record-end="showPreview()"
      />

      <!-- Preview the video after recording -->
      <template v-if="isPreviewing">
        <BasePopupButton v-if="!isUploadingPost"
          actionName="Retry recording" 
          @action-do="clearPreviewAndResetBlackboard()"
        >
          <template v-slot:activator-button="{ on }">
            <v-btn v-on="on" block>Retry recording</v-btn>
          </template>
          <template v-slot:message-to-user>
            If you're not happy with your current video,
            you can make another one.
          </template>
        </BasePopupButton>

        <DoodleVideo
          :strokesArray="previewVideo.strokesArray"
          :audioUrl="convertToURL(previewVideo.audioBlob)"
          :imageBlob="previewVideo.imageBlob"
        />
      </template>
    </v-container>
  </v-card>
</template>

<script>
import DatabaseHelpersMixin from "@/mixins/DatabaseHelpersMixin.js";
import ExplUploadHelpers from "@/mixins/ExplUploadHelpers.js";
import Blackboard from "@/components/Blackboard.vue";
import DoodleVideo from "@/components/DoodleVideo.vue";
import TextEditor from "@/components/TextEditor.vue";
import BasePopupButton from "@/components/BasePopupButton.vue";
import BaseButton from "@/components/BaseButton.vue";
import firebase from "firebase/app";
import "firebase/firestore";
import db from "@/database.js";
import { RecordState } from "@/CONSTANTS.js";
import { getRandomId } from "@/helpers.js";
import { mapState } from "vuex";

export default {
  props: {
    explType: {
      typ: String,
      required: true
    }
  },
  mixins: [
    DatabaseHelpersMixin,
    ExplUploadHelpers
  ],
  components: { 
    Blackboard, 
    DoodleVideo,
    TextEditor,
    BasePopupButton,
    BaseButton
  },
  data: () => ({
    postTitle: "",
    html: "", // from the text editor
    blackboard: {
      getThumbnailBlob: null,
      audioBlob: null,
      backgroundImage: null,
      currentTime: 0
    },
    strokesArray: [],
    uploadProgress: 0,
    isRecordingVideo: false,
    isPreviewing: false,
    previewVideo: {
      strokesArray: [],
      audioBlob: null,
      imageBlob: ""
    },
    isAnonymous: false,
    isUploadingPost: false,
    messageToUser: "",
    changeKeyToForceReset: 0,
    folder: '',
    newReplyRef: null
  }),
  computed: {
    ...mapState([
      "user",
      "mitClass"
    ]),
    simplifiedUser () {
      return {
        uid: this.user.uid,
        email: this.user.email,
        firstName: this.user.firstName,
        lastName: this.user.lastName,
      };
    },
    anonymousUser () {
      return {
        uid: this.user.uid,
        email: "anonymous@mit.edu",
        firstName: "anonymous",
        lastName: "anonymous"
      };
    },
    isButtonDisabled () {
      return this.isUploadingPost || this.isRecordingVideo;
    },
    tagSelect () {
      if (!this.mitClass) return [];
      let tags = []
      for (let tag of this.mitClass.tags) {
        tags.push({ text: tag.name, value: tag.id })
      }
      return tags;
    }
  },
  watch: {
    mitClass: {
      immediate: true,
      handler () {
        this.decideWhereExplsAreSaved()
      }
    }
  },
  methods: {
    /**
     * TODO: refactor (the if statements and the implicit settings are code smells)
     */
    decideWhereExplsAreSaved () {
      if (!this.mitClass) return; 
      const classRef = db.doc(`classes/${this.mitClass.id}`);
      const classPath = `classes/${this.mitClass.id}`;
      if (this.explType === "post") {
        this.newPostRef = db.doc(
          `${classPath}/${this.$route.query.type === "post" ? "posts" : "questions"}/${getRandomId()}`
        );
      } else if (this.explType === "reply") {
        const { question_id, post_id } = this.$route.params;
        if (question_id) {
          this.newPostRef = db.doc(`${classPath}/questions/${question_id}`);
        } else if (post_id) {
          this.newPostRef = db.doc(`${classPath}/posts/${post_id}`);
        } else {
          throw new Error("The reply is not to a question nor a post.")
        }
        this.newReplyRef = this.newPostRef.collection("explanations").doc(getRandomId());
      }
    },
    /**
     *  Show a confirmation popup if the user exits the current URL (to prevent accidental loss of work)
     *  `beforeRouteUpdate` is called when the route change but this `ClassPageSeePost` is still used
     *  @see https://router.vuejs.org/guide/advanced/navigation-guards.html#global-before-guards
     */
    beforeRouteUpdate (to, from, next) {
      this.confirmExit(next);
    },
    beforeRouteLeave (to, from, next) {
      this.confirmExit(next);
    },
    confirmExit (next) {
      if (this.strokesArray.length > 0 || this.html.length > 0) {
        const wantToLeave = window.confirm("Do you really want to leave? You might have unsaved changes.");
        if (!wantToLeave) next(false);
        else next();
      } 
      else next(); 
    },
    bindBlackboardMethods ({ getThumbnailBlob }) {
      this.blackboard.getThumbnailBlob = getThumbnailBlob; 
    },
    convertToURL (blob) {
      return URL.createObjectURL(blob);
    },
    clearPreviewAndResetBlackboard () {
      this.isPreviewing = false;
      // reset the blackboard component 
      this.strokesArray.length = 0; // must not use `strokesArray = []`
      this.changeKeyToForceReset += 1; // must be called after strokesArray is reset otherwise the blackboard will be rerendered with the previous strokes
    },
    async showPreview () {      
      this.previewVideo = {
        strokesArray: this.strokesArray,
        audioBlob: this.blackboard.audioBlob,
      };
      const { backgroundImage } = this.blackboard;
      if (backgroundImage) {
        this.previewVideo.imageBlob = backgroundImage.blob;
      }
      this.isRecordingVideo = false;
      this.isPreviewing = true;
    },
    async uploadExplanation () {
      if (this.postTitle === "" && this.explType === "post") {
        this.postTitle = `Untitled (${new Date().toLocaleTimeString()})`;
      }
      const thumbnailBlob = this.previewVideo.thumbnailBlob ? 
        this.previewVideo.thumbnailBlob : await this.blackboard.getThumbnailBlob();

      // REACTIVITY CAVEAT
      // To avoid confusion, this.blackboard could have `null` to be backgroundImage
      // but if you directly access this.blackboard.backgroundImage, it's actually defined. 
      // That's only because Vue hasn't updated yet (object reactivity caveat)
      // console.log("backgroundImage =", this.blackboard.backgroundImage)
      // console.log("this.blackboard =", this.blackboard);

      const { backgroundImage } = this.blackboard; 
      this.$_saveExplToCacheThenUpload({
        thumbnailBlob,
        backgroundImageBlob: backgroundImage ? backgroundImage.blob : null,
        audioBlob: this.blackboard.audioBlob,
        html: this.html,
        title: this.postTitle,
        tags: this.folder === "" ? [] : [this.folder],
        explRef: this.explType === "post" ? this.newPostRef : this.newReplyRef
      });
  
      this.hardResetChildrenComponents(); 
    },
    /**
     * Note, always properly reset the states i.e. variables/model 
     * before re-rendering the UI (incrementing changeKeyToForceReset)
     */
    hardResetChildrenComponents () {
      this.postTitle = ""; 
      this.html = "";

      // NOTE: do not reset `getThumbnailBlob`
      this.blackboard.audioBlob = null;
      this.blackboard.backgroundImage = null;
      this.blackboard.currentTime = 0; 

      this.strokesArray = [];

      // preview-related variables (to be refactored and eliminated in the future)
      this.previewVideo = {
        strokesArray: [],
        audioBlob: null,
        imageBlob: ""
      };
      this.isPreviewing = false; 
      this.newReplyRef = null;

      // always reset state before re-rendering 
      this.changeKeyToForceReset += 1; 
      this.decideWhereExplsAreSaved();
    }
  }
};
</script>

<style>
.v-text-field #title {
  font-size: 1.6em;
}
</style>