<template>
  <v-dialog :value="isDeletePopupOpen" width="500px">
    <v-card>
      <v-card-title>
        Delete current area
      </v-card-title>    

      <template v-if="areaDoc">
        <v-card-text>
          Are you sure you want to delete this area and all its tables?
          <v-text-field v-model="whatUserTyped" :label="`Carefully type '${areaDoc.name}' to confirm deletion.`"/>
        </v-card-text>

        <v-card-actions>
          <v-spacer/>
          <v-btn @click="$emit('change', false)">CANCEL</v-btn>
          <v-btn :disabled="!(whatUserTyped === areaDoc.name)" @click="deleteRoomType(); $emit('change', false);" color="accent">
            Delete 
          </v-btn>
        </v-card-actions>
      </template>
    </v-card>
  </v-dialog>
</template>

<script>
import db from "@/database.js"
import firebase from 'firebase/app'
import 'firebase/functions'
import 'firebase/storage'
import DatabaseHelpersMixin from '@/mixins/DatabaseHelpersMixin.js'
import { mapState } from 'vuex'

export default {
  props: {
    isDeletePopupOpen: {
      type: Boolean,
      required: true
    }
  },
  mixins: [
    DatabaseHelpersMixin
  ],
  data () {
    return {
      areaDoc: null,
      whatUserTyped: ""
    };
  },
  computed: {
    ...mapState([
      'mitClass'
    ])
  },
  async created () {
    const { class_id, section_id } = this.$route.params
    const areaRef = db.doc(`classes/${class_id}/roomTypes/${section_id}`)
    this.areaDoc = await this.$_getDoc(areaRef)
  },
  methods: {
    // TODO: use db.batch() to make it atomic
    /*
      Delete each room's blackboards
         - for each blackboard, delete 1) the strokes 2) audio file 3) background file
    */
    async deleteRoomType () {
      this.$root.$emit('show-snackbar', 'Deleting area...')

      const { class_id, section_id } = this.$route.params; 
      const deleteRecursively = firebase.functions().httpsCallable('recursiveDelete')
      const roomTypeRef = db.doc(`classes/${class_id}/roomTypes/${section_id}`);
      const roomsRef = db.collection(`classes/${class_id}/rooms`).where("roomTypeID", "==", section_id);
      const roomsDocs = await this.$_getCollection(roomsRef)
      const p = []

      for (const roomDoc of roomsDocs) {
        // delete audio, if it exists
        console.log('room doc =', roomDoc) 
        // each room contains pointers to multiple blackboards currently
        for (const blackboardID of roomDoc.blackboards) {
          const blackboardDoc = await this.$_getDoc(db.doc(`classes/${class_id}/blackboards/${blackboardID}`))
          console.log('blackboardDoc =', blackboardDoc)
          const { audioDownloadURL, backgroundImageDownloadURL } = blackboardDoc
          console.log('audio, background =', audioDownloadURL, backgroundImageDownloadURL)
          if (audioDownloadURL) {
            const audioRef = firebase.storage().refFromURL(audioDownloadURL);  
            p.push(
              audioRef.delete().then(console.log('Deleted audio.'))
            )
          }
          if (backgroundImageDownloadURL) {
            const imageRef = firebase.storage().refFromURL(backgroundImageDownloadURL)
            p.push(
              imageRef.delete().then(console.log('Deleted background.'))
            )
          }
          // then delete the blackboard doc itself and strokes
          p.push(
            deleteRecursively({ path: `blackboards/${blackboardID}` }).then(console.log('Recursively deleted blackboard'))
          )
        }
        p.push(
          roomTypeRef.collection('rooms').doc(roomDoc.id).delete().then(console.log('Shallowly deleted room doc'))
        );
      }
      await Promise.all(p)
      console.log('Deleted all rooms recursively.')
    
      // now safely delete the room type
      // navigate away first to prevent an empty doc listener error
      this.$router.push(`/class/${class_id}/section/${class_id}/room/${class_id}`);
      await roomTypeRef.delete()
      document.location.reload()
      this.$root.$emit('show-snackbar', 'Deleted the area.')
    }
  }
};
</script>