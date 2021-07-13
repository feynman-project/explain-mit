<template>
  <div></div>
</template>

<script>
import AudioRecorder from "audio-recorder-polyfill";

// import mpegEncoder from "audio-recorder-polyfill/mpeg-encoder";
// AudioRecorder.encoder = mpegEncoder;
// AudioRecorder.prototype.mimeType = "audio/mpeg"; // mpeg is equivalent to mp3
window.MediaRecorder = AudioRecorder;
import { mapState} from 'vuex'
import MicStreamsInitializer from '@/mixins/MicStreamsInitializer.js'

export default {
  mixins: [
    MicStreamsInitializer
  ],
  data () {
    return {
      recorder: null,
    }; 
  },
  computed: {
    ...mapState([
      'micStream',
      'CallObject'
    ])
  },
  created () {
    this.$emit("created", { 
      startRecording: this.startRecording,
      stopRecording: this.stopRecording
    }); 
  },
  methods: {
    startRecording () {
      return new Promise(async resolve => {
        if (!this.micStream) {
          await this.$_initializeMicStreams()
        }
        // the same stream cannot used for video call, different recording sessions, etc. without
        // unpredictable issues on Safari iOS
        const micStreamCopy = this.micStream.clone()
        this.recorder = new MediaRecorder(micStreamCopy); 
        this.recorder.start();
        this.$emit("start-recording");
        resolve();
      });
    },
    stopRecording () {
      return new Promise((resolve, reject) => {
        this.recorder.addEventListener("dataavailable", e => {
          this.$emit("update:audioBlob", e.data); 
          resolve(); 
        });
        this.recorder.stop();
        for (const track of this.recorder.stream.getTracks()) {
          track.stop();
        }
      });
    }
  }
}
</script>