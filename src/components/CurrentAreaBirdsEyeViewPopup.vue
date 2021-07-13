<template>
   <!-- `v-if` is not redundant, as it forces the birds-eye view to be refetched --> 
  <v-dialog v-if="value"
    :value="value" 
    @input="(newValue) => $emit('input', newValue)" 
    width="98vw"
    id="birds-eye-view-popup"
  >
    <v-toolbar dark fixed>
      <v-btn icon dark @click="$emit('input', false)">
        <v-icon>mdi-close</v-icon>
      </v-btn>
    </v-toolbar>

    <v-card :key="fractionOfPopupEachBoardTakes"> 
      <v-card-title>
        Bird's-eye View
      </v-card-title>

      <v-card-subtitle>
        There are {{ blackboardIDsWithPeopleOn.length }} active blackboards
      </v-card-subtitle>

      <v-btn @click="fractionOfPopupEachBoardTakes = 25">
        Small 
      </v-btn>
      <v-btn @click="fractionOfPopupEachBoardTakes = 50">
        Large
      </v-btn>
      <!-- <v-btn @click="fractionOfPopupEachBoardTakes = 95">
        Large
      </v-btn> -->

      <!-- Without `position: relative` the interection might not work -->
      <div :style="`height: ${getPopupWidth}; display: flex; justify-content: space-evenly; flex-flow: wrap;`">
        <template v-for="boardID of blackboardIDsWithPeopleOn">
          <RenderlessSyncStrokes
            :strokesRef="getStrokesRefFrom(boardID)"
            v-slot="{ fetchStrokes, strokesArray, isLoading }"
            :key="boardID"
          > 
            <!-- .
              quiet : don't trigger when the directive is binded, only trigger for actual intersecting 
              .once : unbind the directive once it has been triggered 
              `threshold: 0.5` : trigger the event only if >50% of the element is visible
                  
              More info: https://vuetifyjs.com/en/directives/intersect/#intersection-observer 
            -->
            <div style="margin: 2px" v-intersect.once="{
              handler (entries, observer, isIntersecting) {
                if (isIntersecting) {
                  fetchStrokes(); 
                } 
              },
              options: {
                threshold: 0.6 // intersection triggers when 0.5 i.e. 50% of blackboard is in view 
              }
            }"> 
              <h3>{{ getRoomName(boardID) }}</h3>
              <div style="display: flex" class="mb-1">
                <p v-for="participant in boardIdToParticipants[boardID]" :key="participant.id" class="mr-2 mb-0">
                  {{ participant.firstName + " " + participant.lastName }}
                </p>
                <p v-if="strokesArray" class="mb-0">({{ strokesArray.length }} strokes)</p>
              </div>
              <template v-if="!strokesArray">
                <!-- PLACEHOLDER so intersection doesn't autofire for a dimensionless element -->
                <div :style="`
                  position: relative;
                  width: ${getPopupWidth}px; 
                  height: ${getPopupWidth}px; 
                  background-color: rgb(46, 49, 49)
                `
                ">
                  <div class="overlay-item" v-if="isLoading">
                    <v-progress-circular :indeterminate="true" size="50" color="cyan"/>
                  </div>
                </div>
              </template>
              <template v-else>
                <BlackboardCoreDisplay 
                  :strokesArray="strokesArray"
                  :width="getPopupWidth"
                  :height="getPopupWidth"
                />
              </template>

              <div style="margin-right: 30px"></div>
            </div>
          </RenderlessSyncStrokes>
        </template>
      </div>
    </v-card>
  </v-dialog> 
</template>

<script>
import Blackboard from "@/components/Blackboard.vue"; 
import BlackboardCoreDisplay from "@/components/BlackboardCoreDisplay.vue"; 
import db from "@/database.js";
import RenderlessFetchStrokes from "@/components/RenderlessFetchStrokes.vue"; 
import RenderlessSyncStrokes from "@/components/RenderlessSyncStrokes.vue"; 

export default {
  props: {
    value: {
      type: Boolean,
      required: true
    },
    participants: {
      type: Array,
      required: true
    }
  },
  components: {
    Blackboard,
    BlackboardCoreDisplay,
    RenderlessFetchStrokes,
    RenderlessSyncStrokes
  },
  data () {
    return {
      isPopupOpen: false,
      blackboardIDsWithPeopleOn: [],
      boardIdToParticipants: {},
      fractionOfPopupEachBoardTakes: 50
    };
  },
  watch: {
    participants: {
      immediate: true,
      // TODO: debounce so that it doesn't overreact to participants changing colors, for example
      handler () {
        const boardIdToParticipants = {}; 
        // determine which blackboards are active
        const boardIDs = new Set(); 
        for (const p of this.participants) {
          if (p.currentBoardID) { // sometimes, perhaps because on an updated version, the participant doc doesn't have activeBoardID on
            boardIDs.add(p.currentBoardID); 
            if (boardIdToParticipants[p.currentBoardID]) {
              boardIdToParticipants[p.currentBoardID].push(p)
            } else {
              boardIdToParticipants[p.currentBoardID] = [p]; 
            }
          }
        }
        this.blackboardIDsWithPeopleOn = Array.from(boardIDs);
        this.boardIdToParticipants = boardIdToParticipants; 
      }
    }
  },
  computed: {
    currentAreaRooms () { return this.$store.state.currentAreaRooms; },
    sortedRooms () {
      return [
        ...this.currentAreaRooms.filter(room => room.isCommonRoom), 
        ...this.currentAreaRooms.filter(room => ! room.isCommonRoom)
      ];
    },
    getPopupWidth () {
      const separationBetweenBoards = 10; 
      const deltaBetweenPopupAndFullWidth = 50; 
      // for iOS Safari compatibility 
      // see https://stackoverflow.com/questions/58390221/js-safari-on-ios-how-to-get-viewport-scale-property
      // const viewportWidth = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
      return (window.innerWidth * this.fractionOfPopupEachBoardTakes / 100) - separationBetweenBoards - deltaBetweenPopupAndFullWidth; 
    }
  },
  methods: {
    getRoomName (boardID) {
      for (const [i, room] of this.sortedRooms.entries()) {
        if (room.blackboards.includes(boardID)) {
          if (room.name) return room.name; 
          else if (room.isCommonRoom) return "common table"
          else return `table ${i - 1}`; // this index is very annoying and will be wrong and brittle, but quickfix for now before a redesign/rewrite
        }
      }
    },
    getStrokesRefFrom (boardID) {
      return db.collection(`/classes/${this.$route.params.class_id}/blackboards/${boardID}/strokes`);
    }
  }
}
</script>

<style scoped>
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