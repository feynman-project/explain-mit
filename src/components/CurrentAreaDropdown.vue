<template>
  <div style="display: flex; align-items: center;" class="px-0 mt-0">
    <v-menu max-height="500" offset-y bottom>
      <template v-slot:activator="{ on }">
        <v-btn v-on="on" text tile class="pa-1" max-width="160" max-height="28">
                                                                                 <!-- somehow this `max-width` property below is the one that actually does something -->
          <span v-if="roomTypes.length > 0" class="caption font-weight-normal d-inline-block text-truncate grey--text text--darken-2" style="font-size: 1rem !important; max-width: 130px;">
            <!-- looks inelegant, but saves A LOT of time and focus from breakages from backwards incompatibility  -->
            <template v-if="currentRoomTypeDoc">{{ currentRoomTypeDoc.name }}</template>
            <template v-else>Error area...</template>
          </span>
          <v-spacer/>
          <v-icon>mdi-menu-down</v-icon>
        </v-btn>
      </template>

      <v-list nav class="pa-0">
        <template v-for="roomType in sortedRoomTypes">
          <!-- accent-text counterintuitively gives the orange shading and NOT the orange text-->
          <!-- :inactive prop is necessary because otherwise, the user can click it to go into a void (without being in a room) -->
          <!-- id is used for scrollToView() -->
          <v-list-item v-if="roomType.id !== sectionID"
            :key="roomType.id"
            :to="(`/class/${classID}/section/${roomType.id}/room/${roomType.id}`)"
            active-class="accent--text"
            class="px-0" 
            :inactive="sectionID === roomType.id"
            :id="`${ sectionID === roomType.id ? 'space-title' : '' }`"
            dense
            style="height: 20px;"
          >
            <!--  color: ${ sectionID === roomType.id ? '#ff5b24' : '#424242' };  -->
            <v-list-item-content class="py-0">
              <div style="display: flex; align-items: center;">
                <div class="ml-3">
                  <div
                    :style="`
                      font-size: 0.95rem; 
                      font-weight: 500; 
                      color: '#424242'; 
                      opacity: ${roomType.id === sectionID ? '100%' : '60%' };
                      text-transform: uppercase;
                  `">
                    {{ roomType.name }}
                  </div>
                </div>

                <v-spacer/>
              </div>
            </v-list-item-content>
          </v-list-item>
        </template>
        
        <BasePopupButton v-if="sortedRoomTypes.length !== 0"
          actionName="Create a new area"
          :inputFields="['name']" 
          @action-do="({ name }) => createNewRoomType(name)"
        >
          <template v-slot:activator-button="{ on }">
            <v-list-item v-on="on" style="font-weight: 500; opacity: 50%; font-size: 0.95rem;">
              <v-icon class="ml-1 mr-2 black--text">mdi-plus</v-icon>
              <div style="color: '#424242'">NEW AREA</div>
            </v-list-item>
          </template> 
        </BasePopupButton>
      </v-list>
    </v-menu>
  </div>
</template>

<script>
import db from "@/database.js"; 
import { getRandomId } from "@/helpers.js"; 
import DatabaseHelpersMixin from "@/mixins/DatabaseHelpersMixin.js";
import BaseButton from "@/components/BaseButton.vue";
import BasePopupButton from "@/components/BasePopupButton.vue"; 
import { mapState } from "vuex";

export default {
  name: "AllAreas",
  props: {
    areaID: {
      type: String,
      required: true
    }
  },
  mixins: [
    DatabaseHelpersMixin
  ],
  components: {
    BaseButton,
    BasePopupButton
  },
  data () {
    return {
      roomTypes: [],
      isChatOpen: false
    };
  },
  computed: {
    ...mapState([ 
      "user",
      "mitClass"
    ]),
    classID () { return this.$route.params.class_id; },
    sectionID () { return this.$route.params.section_id; },
    classDocRef () { return db.doc(`classes/${this.classID}`); },
    sortedRoomTypes () {
      return [
        ...this.roomTypes.filter(roomType => roomType.id === this.$route.params.class_id),
        ...this.roomTypes.filter(roomType => roomType.id !== this.$route.params.class_id)
      ];
    },
    currentRoomTypeDoc () {
      return this.roomTypes.filter(roomType => roomType.id === this.sectionID)[0];
    }
  },
  async created () {
    // fetch once for light bandwidth usage
    this.roomTypes = await this.$_getCollection(this.classDocRef.collection("roomTypes"));
  },
  methods: {
     /**
     * Create a new roomType, and initialize it with a common room, which is initialized with a blackboard
     */
    async createNewRoomType (name, id = getRandomId()) {
      if (!name) {
        this.$root.$emit("show-snackbar", "Don't forget to name this area"); 
        return;
      }
      const { class_id } = this.$route.params; 
      const ref = db.doc(`classes/${class_id}`);
      await Promise.all([
        ref.collection("roomTypes").doc(id).set({ id, name }),
        ref.collection("rooms").doc(id).set({
          isCommonRoom: true,
          roomTypeID: id,
          blackboards: [id]
        }),
        ref.collection("blackboards").doc(id).set({})
      ]);
      this.$root.$emit("show-snackbar", "Successfully created new open space.")
      this.$router.push(`/class/${class_id}/section/${id}/room/${id}`);
    }
  }
}
</script>