<template>
  <div>
    <BlackboardAudioRecorder
      @created="({ startRecording, stopRecording }) => bindAudioRecorderMethods(startRecording, stopRecording)"
      @update:audioBlob="blob => $emit('update:audioBlob', blob)"
      @audio-recorded="audioObj => handleNewRecording(audioObj)"
    />

    <BlackboardCoreDrawing
      :strokesArray="strokesArray" @stroke-drawn="stroke => $emit('stroke-drawn', stroke)"
      :backgroundImage="backgroundImage" @update:background-image="image => $emit('update:background-image', image)"
      :currentTime="currentTime"
      :isReadOnly="false"
      @mounted="blackboardMethods => $emit('mounted', blackboardMethods)"
      @update:thumbnailBlob="blob => $emit('update:thumbnailBlob', blob)"
      @board-reset="$emit('board-reset')"
    >
      <template v-slot:canvas-toolbar="{ 
        isFullScreen, 
        handleImageFile,
        resetBoard,
        toggleFullScreen,
        undoPenStroke
      }"
      >
        <!-- TODO: refactor resetBoard() -->
        <BlackboardToolBar
          :isFullScreen="isFullScreen"
          @image-select="imageFile => displayImageFile(imageFile)"
          @toggle-fullScreen="toggleFullScreen()"
        >
          <template v-slot:touch-slot>
            <!-- :messages needs to be populated for the v-slot:message to exist -->
            <v-switch 
              :input-value="! onlyAllowApplePencil"
              @change="$store.commit('SET_ONLY_ALLOW_APPLE_PENCIL', ! onlyAllowApplePencil)"
              color="yellow"
              class="mt-0 ml-2"
              persistent-hint
              inset
              dense
              :messages="['first message', 'second message']"
            >
              <template v-slot:message>
                <div class="font-size: 0.5rem">Touch draw</div>
              </template>
            </v-switch>

            <BaseButton :disabled="! canUndoStroke"
              @click="undoPenStroke(strokesArray[strokesArray.length - 1])" 
              icon="mdi-undo" color="white" small
            >
            </BaseButton>
          </template>
    
          <template v-slot:record-audio-slot>
            <slot name="blackboard-toolbar">

            </slot>
          </template>

          <!-- More actions slot -->
          <template v-slot:more-actions-slot>
            <BaseButton v-if="currentState === RecordState.PRE_RECORD" 
              @click="startRecording()" 
              icon="mdi-record" color="white" small
            >
              Record
            </BaseButton>
            <BaseButton v-else @click="stopRecording()" icon="mdi-stop" color="white" small>
              Finish
            </BaseButton>

            <v-menu v-model="isMenuOpen" bottom nudge-left offset-y>
              <template v-slot:activator="{ on, attrs }">
                <!-- Cannot let user wipe board / reupload background image while recording -->
                <BaseButton v-if="currentState !== RecordState.MID_RECORD" 
                  :on="on" 
                  v-bind="attrs"
                  icon="mdi-dots-vertical" color="white" small
                >
                </BaseButton>
              </template>
              
              <v-list>
                <!-- SET BACKGROUND IMAGE -->
                <slot name="set-background-button-slot" :closeMenu="closeMenu">
                  <v-list-item @click="$refs.fileInput.click()">
                    <input 
                      @change="e => handleImageFile(e)" 
                      style="display: none" 
                      type="file" 
                      ref="fileInput"
                    >
                    <v-icon left>mdi-image</v-icon> Set background
                  </v-list-item>
                </slot>

                <!-- WIPE BOARD BUTTON -->
                <!-- 
                  The slot below allows `RealtimeBlackboard.vue` to override behavior of "Wipe board";
                  Instead of wiping immediately, it wait until Firestore resolves the deletion request
                  before setting `strokesArray = []` to wipe the UI. 
                -->
                <slot name="wipe-board-button-slot" :closeMenu="closeMenu"> 
                  <BasePopupButton actionName="Wipe board" @action-do="resetBoard(); closeMenu()">
                    <template v-slot:activator-button="{ on }">
                      <v-list-item v-on="on">
                        <v-icon left>mdi-delete</v-icon> Wipe board
                      </v-list-item>
                    </template>
                    <template v-slot:message-to-user>
                      Are you sure you want to wipe everything?
                    </template> 
                  </BasePopupButton>
                </slot> 
              </v-list>
            </v-menu>
          </template>
        </BlackboardToolBar>
      </template>
    </BlackboardCoreDrawing>
  </div>
</template>

<script>
/** 
 * An enhanced blackboard that supports audio recording.
    - Saving: The user can save the state of the blackboard as a replayable animation. 
    - Recording: By pressing "record", the user can record a voiced video explanation. 

 * Maintains the invariant that the UI <canvas/> displays exactly the strokes from `strokesArray`. 
 * Manages its own state i.e. currentTime, strokesArray, audioBlob and imageBlob.
*/
import BlackboardToolBar from "@/components/BlackboardToolBar.vue";
import BlackboardCoreDrawing from "@/components/BlackboardCoreDrawing.vue";
import BlackboardAudioRecorder from "@/components/BlackboardAudioRecorder.vue";
import BaseButton from "@/components/BaseButton.vue";
import BasePopupButton from "@/components/BasePopupButton.vue";
import { RecordState, MASSIVE_MODE_DIMENSIONS } from "@/CONSTANTS.js";
import { mapState, mapGetters } from "vuex";

export default {
  props: {
    // width and height are optional props
    strokesArray: {
      type: Array,
      required: true
    },
    backgroundImage: {
      type: Object
    }
  },
  components: { 
    BlackboardToolBar,
    BlackboardAudioRecorder, 
    BlackboardCoreDrawing,
    BaseButton,
    BasePopupButton
  },
  data () {
    return {
      audioRecorder: {
        startRecording: null,
        stopRecording: null
      },
      timer: null,
      currentTime: 0,
      currentState: RecordState.PRE_RECORD,
      RecordState,
      isMenuOpen: false // TODO: this is a temporary fix so that including a BasePopupButton within a v-menu works and doesn't disappear because v-menu disappears
    };
  },
  computed: {
    ...mapState([
      "user",
      "onlyAllowApplePencil"
    ]),
    ...mapGetters([
      "isAdmin"
    ]),
    sessionID () { return this.$store.state.session.currentID; },
    isRecording () { return this.currentState === RecordState.MID_RECORD; },
    canUndoStroke () {
      const n = this.strokesArray.length; 
      if (n === 0) return false; 
      const lastStroke = this.strokesArray[n-1]; 
      if (lastStroke.isErasing || lastStroke.sessionID !== this.sessionID) {
        return false;
      }
      return true; 
    }
  },
  watch: {
    currentTime () {
      this.$emit("update:currentTime", this.currentTime);
    }
  },
  methods: {
    closeMenu () {
      this.isMenuOpen = false; 
    },
    bindAudioRecorderMethods (startRecording, stopRecording) {
      this.audioRecorder.startRecording = startRecording;
      this.audioRecorder.stopRecording = stopRecording;
    },
    async startRecording () {
      this.audioRecorder.startRecording();
      this.currentTime = 0;
      const ONE_HUNDRED_MILLISECONDS = 100; 
      this.timer = setInterval(
        () => this.currentTime += 0.1, 
        ONE_HUNDRED_MILLISECONDS
      );   
      this.currentState = RecordState.MID_RECORD;
      this.$emit("record-start"); // inform the parent to disable the "submit post" button
    },
    async stopRecording () {
      clearInterval(this.timer); 
      await this.audioRecorder.stopRecording(); 
      this.currentState = RecordState.POST_RECORD; 
      this.$emit("record-end"); 
    }
  }
};
</script>