<template>
  <div style="display: flex; align-items: center;">
    <template v-for="(color, i) of ['#FDFEFE', ...user.penColors]">
      <BaseButton v-if="!((i > 2) && $vuetify.breakpoint.smAndDown)"
        @click="changePenColor(color, i-1)" 
        :filled="currentTool.color === color && currentTool.type === 'PEN'" 
        color="white" small 
        :key="i"
      >
        <svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px"
          width="16px" height="35px" viewBox="0 0 100 230" style="enable-background:new 0 0 100 230;" xml:space="preserve">
          <g>
            <path d="M0,0v72.377c0,1.588,0.234,3.169,0.698,4.706l45.416,150.032C46.633,228.828,48.212,230,50,230s3.367-1.172,3.886-2.883
              L99.31,77.079c0.457-1.525,0.69-3.108,0.69-4.702V0.002"/>
            <polygon :style="'fill:'+color+';'" points="50,211.978 38.879,175.24 61.122,175.24 	"/>
            <path style="fill:#424242;" d="M63.581,167.118H36.42L8.765,75.761l10.924-9.63l12.5,11.015c1.54,1.353,3.835,1.35,5.375-0.002
              l12.468-11.007l12.464,11.005c1.54,1.357,3.839,1.357,5.377,0l12.465-11.005l10.9,9.623L63.581,167.118z"/>
            <path :style="'fill:'+color+';'" d="M91.878,0v65.486l-8.852-7.813c-1.539-1.353-3.838-1.354-5.377,0.002L65.185,68.679L52.72,57.674
              c-1.539-1.356-3.838-1.354-5.377-0.002L34.871,68.683L22.375,57.67c-0.769-0.676-1.725-1.013-2.685-1.013
              c-0.959,0-1.919,0.339-2.685,1.013L8.121,65.5L8.098,0.024L91.878,0z"/>
          </g>
        </svg>  
      </BaseButton>
    </template>
  </div>
</template>


<script>
import BaseButton from "@/components/BaseButton.vue";
import db from "@/database.js"; 
import { mapState } from "vuex"; 

export default {
  props: {
    isPenActive: Boolean,
    colors: {
      type: Array,
      required: true
    }
  },
  components: { 
    BaseButton,
  },
  computed: {
    ...mapState([
      "user",
      "currentTool"
    ]),
  },
  methods: {
    getRandomColor () {
      // randomize the hue i.e. the color
      // 100% saturation i.e. maximize on its vividness and purity
      // 60% lightness / mix with white (otherwise it becomes too faded)
      // 1 alpha
      return "hsla(" + ~~(360 * Math.random()) + "," +
                    "100%,"+
                    "60%,1)"; // hue, saturation (how vivid), lightness (how much black / white mix ), alpha
      // let letters = "0123456789ABCDEF";
      // let color = "#";
      // for (let i = 0; i < 6; i++) {
      //   color += letters[Math.floor(Math.random() * 16)];
      // }
      // return color;
    },
    changePenColor (color, i) {
      if (this.currentTool.color === "white" || color !== this.currentTool.color) {
        this.$store.commit("SET_CURRENT_TOOL", {
          type: "PEN",
          color,
          lineWidth: 2
        });
      } 
      // generate random color
      else {
        const penColorsCopy = [...this.user.penColors];
        penColorsCopy[i] = this.getRandomColor();
        db.collection("users").doc(this.user.uid).update({
          penColors: penColorsCopy
        });
        this.$store.commit("SET_CURRENT_TOOL", {
          type: "PEN",
          color: penColorsCopy[i],
          lineWidth: 2
        })
      }
    }
  }
}
</script>
<style scoped>
svg {
  max-height: 30px;
}
.selected-color svg {
  max-height: 40px;
}

.dot {
  height: 20px;
  width: 20px;
  border-radius: 80%;
  display: block;
  /* display: inline-block; */
}
</style>