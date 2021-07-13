<template>
  <div>
    <div v-if="editor">
      <button @click="editor.chain().focus().toggleHeading({ level: 2 }).run()" :class="{ 'is-active': editor.isActive('heading', { level: 2 }) }">
        h2
      </button>
    </div>

    <editor-content 
      :editor="editor" 
    />
  </div>
</template>

<script>
import { Editor, EditorContent } from '@tiptap/vue-2'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'

export default {
  components: {
    EditorContent,
  },
  props: {
    value: {
      type: String,
      default: '',
    },
  },
  data() {
    return {
      editor: null,
    }
  },
  watch: {
    value(value) {
      // HTML
      const isSame = this.editor.getHTML() === value
      // JSON
      // const isSame = this.editor.getJSON().toString() === value.toString()
      if (isSame) {
        return
      }
      this.editor.commands.setContent(this.value, false)
    },
  },
  mounted() {
    this.editor = new Editor({
      extensions: [
        StarterKit,
        Placeholder
      ],
      content: this.value,
      onUpdate: () => {
        // HTML
        this.$emit('input', this.editor.getHTML())
        // JSON
        // this.$emit('input', this.editor.getJSON())
      },
    })
  },
  beforeDestroy() {
    this.editor.destroy()
  },
}
</script>

<style lang="scss" scoped>
::v-deep {
  /* Basic editor styles */
  .ProseMirror {
    > * + * {
      margin-top: 0.75em;
    }
  }

/* Basic editor styles */
.ProseMirror {
  > * + * {
    margin-top: 0.75em;
  }
}

// placeholder
.ProseMirror p.is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  float: left;
  color: #ced4da;
  pointer-events: none;
  height: 0;
}
  
  // .content {
  //   padding: 1rem 0 0;
  //   h3 {
  //     margin: 1rem 0 0.5rem;
  //   }
  //   pre {
  //     border-radius: 5px;
  //     color: #333;
  //   }
  //   code {
  //     display: block;
  //     white-space: pre-wrap;
  //     font-size: 0.8rem;
  //     padding: 0.75rem 1rem;
  //     background-color:#e9ecef;
  //     color: #495057;
  //   }
  // }
}
</style>
