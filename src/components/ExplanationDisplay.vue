<template>
  <v-card v-if="expl">
    <v-container fluid>
      <!-- Text -->
      <template v-if="!isEditing"> 
        <h2 v-if="expl.title">{{ expl.title }}</h2>
        <TextEditor :injectedHtml="expl.html" :editable="false" ref="TextEditor"/>
        <!-- <p v-html="expl.html" class="expl"></p> -->
      </template>
      <template v-else>
        <TextEditor :injectedHtml="expl.html" :editable="true" ref="TextEditor"/>
        <v-btn @click="updateExplanation()" color="secondary">
          SAVE EDIT
        </v-btn>
</template>
      
      <!-- Doodle Video -->
      <RenderlessFetchStrokes v-if="expl.thumbnail"
        :strokesRef="strokesRef"
        :imageDownloadUrl="expl.imageUrl"
        v-slot="{ fetchStrokes, strokesArray, imageBlob, isLoading }"
      >
        <div style="position: relative;"> 
          <!-- Thumbnail preview -->
          <template v-if="strokesArray.length === 0 || isLoading">
            <v-img :src="expl.thumbnail" :aspect-ratio="16/9" data-qa="expl-thumbnail"/>
            <div v-if="expl.hasStrokes" @click="handlePlayClick(fetchStrokes)" class="overlay-item" data-qa="play-btn">
              <v-progress-circular v-if="isLoading" :indeterminate="true" size="50" color="orange"/>
              <v-btn v-else large dark>
                <v-icon>mdi-play</v-icon>
              </v-btn>
            </div>
          </template>
          <!-- Loaded video -->
          <DoodleVideo v-else-if="expl.audioUrl"
            :strokesArray="strokesArray"
            :imageBlob="imageBlob" 
            :audioUrl="expl.audioUrl" 
            ref="Doodle"
          />
          <DoodleAnimation v-else
            :strokesArray="strokesArray"
            :backgroundUrl="expl.imageUrl"
            ref="Doodle"
          />
      </div>
      </RenderlessFetchStrokes>

      <!-- Delete popup TODO: refactor -->
      <v-dialog v-model="popup" max-width="600px">
        <v-card>
          <v-card-title>Are you sure you want to delete?</v-card-title>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn text color="secondary" @click="popup = false">CANCEL</v-btn>
            <v-btn text color="secondary" @click="deleteExplanation()" data-qa="confirm-delete">DELETE</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <!-- Dropdown menu for editing and deleting -->
      <v-row v-if="user" justify="center">
        <v-layout align-center>
          <p v-if="hasDate" class="pt-3 pl-3 body-2 font-weight-light">
            By {{ expl.creator.firstName }}, {{ displayDate(expl.date) }}
          </p>      
          <p v-if="expl.thumbnail" class="pt-3 pl-2 body-2 font-weight-light">
            (video views: {{ expl.views ? expl.views : 0 }}) 
          </p> 
          <v-spacer></v-spacer>
          <template v-if="expl.creator.uid === user.uid">
            <!-- <BaseButton @click="" -->
            <BaseButton @click="startEditing()" icon="mdi-pencil">Edit Text</BaseButton>
            <BaseButton @click="popup = true" icon="mdi-delete" data-qa="delete-post-btn">Delete</BaseButton>
          </template>
          <BaseButton @click="upvoteExpl()" :disabled="expl.creator.uid === user.uid">
            Thanks! ({{ expl.upvotersIds ? expl.upvotersIds.length : 0 }})
          </BaseButton>
        </v-layout>
      </v-row>
    </v-container>
  </v-card>
</template>

<script>
import TextEditor from "@/components/TextEditor.vue";
import DoodleVideo from "@/components/DoodleVideo.vue";
import DoodleAnimation from "@/components/DoodleAnimation.vue";
import RenderlessFetchStrokes from "@/components/RenderlessFetchStrokes";
import BaseButton from "@/components/BaseButton.vue"
import db from "@/database.js";
import { displayDate } from "@/helpers.js";
import firebase from "firebase/app";
import "firebase/firestore";

export default {
  props: { 
    expl: Object, 
    hasDate: {
      type: Boolean, 
      default: () => true
    }
  },
  components: { 
    DoodleAnimation,
    DoodleVideo,
    TextEditor,
    RenderlessFetchStrokes,
    BaseButton
  },
  computed: {
    strokesRef () {
      return db.collection(`${this.expl.ref}/strokes`);
    },
    user () { 
      return this.$store.state.user; 
    }
  },
  data: () => ({ 
    isEditing: false,
    popup: false
  }),
  methods: {
    upvoteExpl () {
      const ref = db.doc(`${this.expl.ref}`);
      if (!this.userHasUpvoted()) {
        ref.update({
          upvotersIds: firebase.firestore.FieldValue.arrayUnion(this.user.uid)
        });
      } else {
        ref.update({
          upvotersIds: firebase.firestore.FieldValue.arrayRemove(this.user.uid)
        });
      }
    },
    userHasUpvoted () {
      if (!this.expl.upvotersIds) return false;
      return this.expl.upvotersIds.includes(this.user.uid);
    },
    handlePlayClick (fetchStrokes) {
      if (this.isLoading) return;
      fetchStrokes();
      // update view count 
      const ref = db.doc(`${this.expl.ref}`);
      ref.update({
        views: firebase.firestore.FieldValue.increment(1)
      });
    },
    displayDate (dateString) { 
      return displayDate(dateString);
    },
    startEditing () {
      this.isEditing = true;
    },
    updateExplanation () {
      const { TextEditor } = this.$refs;
      db.doc(this.expl.ref).update({
        html: TextEditor.html
      });
      this.isEditing = false;
    },
    // TODO: should be a recursive deletion
    async deleteExplanation () {
      this.popup = false;
      await db.doc(this.expl.ref).delete();
      // this.$router.push(`/class/${this.$route.params.class_id}`);
      this.$root.$emit("show-snackbar", "Successfully deleted post, you might have to leave the page though");
    },
  },
}
</script>

<style lang="scss" scoped>
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

@import "@/assets/scss/variables.scss";
ul[data-type="todo_list"] {
  padding-left: 0;
}
li[data-type="todo_item"] {
  display: flex;
  flex-direction: row;
}
.todo-checkbox {
  border: 2px solid black;
  height: 0.9em;
  width: 0.9em;
  box-sizing: border-box;
  margin-right: 10px;
  margin-top: 0.3rem;
  user-select: none;
  -webkit-user-select: none;
  cursor: pointer;
  border-radius: 0.2em;
  background-color: transparent;
  transition: 0.4s background;
}
.todo-content {
  flex: 1;
  > p:last-of-type {
    margin-bottom: 0;
  }
  > ul[data-type="todo_list"] {
    margin: .5rem 0;
  }
}
li[data-done="true"] {
  > .todo-content {
    > p {
      text-decoration: line-through;
    }
  }
  > .todo-checkbox {
    background-color: $color-black;
  }
}
li[data-done="false"] {
  text-decoration: none;
}

.expl pre {
  &::before {
    content: attr(data-language);
    text-transform: uppercase;
    display: block;
    text-align: right;
    font-weight: bold;
    font-size: 0.6rem;
  }
  code {
    .hljs-comment,
    .hljs-quote {
      color: #999999;
    }
    .hljs-variable,
    .hljs-template-variable,
    .hljs-attribute,
    .hljs-tag,
    .hljs-name,
    .hljs-regexp,
    .hljs-link,
    .hljs-name,
    .hljs-selector-id,
    .hljs-selector-class {
      color: #f2777a;
    }
    .hljs-number,
    .hljs-meta,
    .hljs-built_in,
    .hljs-builtin-name,
    .hljs-literal,
    .hljs-type,
    .hljs-params {
      color: #f99157;
    }
    .hljs-string,
    .hljs-symbol,
    .hljs-bullet {
      color: #99cc99;
    }
    .hljs-title,
    .hljs-section {
      color: #ffcc66;
    }
    .hljs-keyword,
    .hljs-selector-tag {
      color: #6699cc;
    }
    .hljs-emphasis {
      font-style: italic;
    }
    .hljs-strong {
      font-weight: 700;
    }
  }
}
</style>
