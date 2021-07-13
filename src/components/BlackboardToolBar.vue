<template>
  <!-- The absolute positioning will look for the nearest POSITIONED parent i.e. position attribute is NOT static -->
  <!-- bottom: auto; left: auto; -->
  <!-- Note: the fixed/absolute props is a quick-fix -->
  <!-- z-index: 100 is a quickfix -->
  <!-- :fixed="true" used to handle the iOS issue when the safari page hides the top part of Safari -->
  <v-app-bar 
    absolute
    elevation="5" 
    :height="toolbarHeight" 
    color="grey darken-2" 
    style="right: 0; top: 0; bottom: auto; left: auto; z-index: 100" 
    rounded
  >
    <!-- v-row enables you to ignore the padding of <v-app-bar> -->
    <v-row align="center">
      <slot name="touch-slot">

      </slot>

      <v-col class="py-0 px-0" cols="auto">
        <BaseButton :filled="isNormalEraser && currentTool.lineWidth === 40" 
          @click="selectNormalEraser({ eraserLineWidth: 40 })" 
          icon="mdi-eraser-variant" hasLargeIcon small color="white"
        />
        <BaseButton v-if="$vuetify.breakpoint.mdAndUp"
          :filled="isNormalEraser && currentTool.lineWidth === 5"
          @click="selectNormalEraser({ eraserLineWidth: 5 })" 
          icon="mdi-eraser-variant" small color="white"
        />
      </v-col>

      <v-col class="py-0 px-0" cols="auto">
        <PenSwatch 	
          :colors="penColors" 	
          :isPenActive="isPen"	
        />
      </v-col>

      <slot name="more-actions-slot">

      </slot>

      <!-- TODO: rename the slot to fullscreen slot-->
      <slot name="record-audio-slot">

      </slot>
    </v-row>
  </v-app-bar>
</template>

<script>
import "vue-swatches/dist/vue-swatches.min.css";
import Swatches from "vue-swatches";
import { BlackboardTools, toolbarHeight, ERASER_STROKE_WIDTH } from "@/CONSTANTS.js";
import BasePopupButton from "@/components/BasePopupButton.vue";
import BaseButton from "@/components/BaseButton.vue";
import PenSwatch from "@/components/BlackboardToolBarPenSwatch.vue";
import { mapState } from "vuex"; 

export default {
  props: {
    isFullScreen: Boolean
  },
  components: { 
    Swatches, 
    BasePopupButton,
    BaseButton,
    PenSwatch
  },
  data () {
    return {
      BlackboardTools,
      toolbarHeight,
      colorPaletteExpanded: false,
      lastEraserNormal: true
    }
  },
  computed: {
    ...mapState([
      "isBoardFullscreen",
      "user",
      "currentTool"
    ]),
    penColors () { return this.user.penColors; },
    isNormalEraser () { return this.currentTool.type === BlackboardTools.NORMAL_ERASER; },
    isPen () { return this.currentTool.type === BlackboardTools.PEN; }
  },
  mounted () {
    window.addEventListener("click", e => this.palleteClose(e), false);
    window.addEventListener("touchstart", e => this.palleteClose(e));
  },
  destroyed () {
    window.removeEventListener("click", e => this.palleteClose(e));
    window.removeEventListener("touchstart", e => this.palleteClose(e));
  },
  methods: {
    selectNormalEraser ({ eraserLineWidth }) {
      this.lastEraserNormal = true;
      this.colorPaletteExpanded = false;
      // local state has to update instantly
      this.$store.commit("SET_CURRENT_TOOL", { 
        type: BlackboardTools.NORMAL_ERASER,
        color: "",
        lineWidth: eraserLineWidth
      }); 
    },
    palleteClick () {
      if (!this.isPen) this.colorPaletteExpanded = false; 
      else this.colorPaletteExpanded = !this.colorPaletteExpanded;
    },
    palleteClose (e) {
      const pallete = document.getElementById("swatches-wrapper");
      if (pallete && !pallete.contains(e.target)) {
        this.colorPaletteExpanded = false;
      }
    },
    fullScreen () {
      this.$emit('toggle-fullScreen');
    },
    // TODO: open a popup, THEN allow the copy and pasting of images
    initCopyAndPasteImage () {
      //  document.onpaste = async (event) => {
      //   const items = (event.clipboardData || event.originalEvent.clipboardData).items; // use event.originalEvent.clipboard for newer chrome versions
      //   // Find pasted image among pasted items
      //   let blob = null;
      //   for (let i = 0; i < items.length; i++) {
      //     if (items[i].type.indexOf("image") === 0) {
      //       blob = items[i].getAsFile();
      //     }
      //   }
      //   // Load image if there is a pasted image
      //   if (blob === null) { return; }
      //   this.imageBlob = blob;
      //   if (!this.isRealtime) {
      //     const imageUrl = URL.createObjectURL(this.imageBlob);
      //     this.displayImageAsBackground(imageUrl);
      //   } else {
      //     const imageUrl = await this.$_saveToStorage(`images/${this.blackboardId}`, blob);
      //     this.blackboardRef.update({ imageUrl });
      //     this.imageUrl = imageUrl; // store locally
      //   }     
      // }
    }
  }
};
</script>

<style>
@media (min-width: 600px) and (max-width: 670px),
  (min-width: 1264px) and (max-width: 1300px) {
  .blackboard-toolbar {
    zoom: 0.95;
  }
}
@media (max-width: 350px), (min-width: 960px) and (max-width: 1050px) {
  .blackboard-toolbar {
    zoom: 0.9;
  }
}
#swatches-wrapper {
  position: relative;
}
#swatches-wrapper .vue-swatches {
  border: 1px solid #f03c02;
  border-radius: 0 10px 10px 0;
}
#swatches-wrapper button {
  border-radius: 9px 0 0 9px;
  border: 1px solid #f03c02 !important;
}
#swatches-wrapper button .v-icon.down {
  display: none;
}
#swatches-wrapper.dropdown button {
  border-radius: 10px;
  left: 0;
  padding: 0 8px;
}
#swatches-wrapper.dropdown button .v-icon {
  display: block;
}
#swatches-wrapper.dropdown .vue-swatches {
  display: none;
}
#swatches-wrapper.dropdown.active > * {
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.25);
}
#swatches-wrapper.dropdown.active button {
  border-radius: 10px 10px 0 0;
}
#swatches-wrapper.dropdown.active .vue-swatches {
  display: block;
  position: absolute;
  top: 38px;
  left: 0;
  background: white;
  border-radius: 0 10px 10px 10px;
}
button {
  min-width: 36px !important;
}
.board-action-btn {
  margin: 0 5px;
}
.board-action-btn .v-icon {
  margin: 0 -6px;
}
.v-icon {
  font-size: 20px;
}

/* TODO: CSS leak */
.super-small-text p {
  font-size: 0.6em;
  margin-bottom: 0;
}
</style>