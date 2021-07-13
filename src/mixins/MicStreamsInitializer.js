/** 
  The reason this mixin exists is because iOS Safari invalidates previous mic streams when you call "navigator.getUserMedia"
  so recording a video mutes your audio call. The opposite is also true: `Daily.createCallObject()` will likely invalidate the 
  current recording session.

  The best workaround is to clone independent mic streams and pass them to the recorder and the call object respectively. 
  If we're using the audio recorder, we MUST also pre-clone a stream in case the user joins an audio call afterwards. 
  The logic is as follows: 
    1. Either recording or phone call is triggered. We create two independent copies of the mic stream.
    2. The recorder is correct no matter what, because, each time it starts recording it clones an additional independent copy.
    3. The phone call is correct with exception to, when it terminates, we have to terminate the mic stream.

  The last thing to ensure is, the mic is deactivated when it's not in use so it's not jarring for the user. 
  We do this by destroying the micStream object upon ending a call. 
      CASE 1 (in the middle of recording): the audio recorder has an independent copy, so the mic will be turned off when that independent copy 
      is also deactivated.
      CASE 2 (not in the middle of recording): trivially correct. 

  This is used by `BlackboardAudioRecorder.vue` and `VideoConferenceRoom.vue`

  KNOWN ISSUES: if you hang-up in the middle of a recording you lose your sound
   (though if you hang-up after the recording, then start another one, it's fine. 
        1. I suspect it's the track.stop() messing the ongoing tracks mid-recording
        2. If the recording already finished, a fresh micStream is created because we reset the pointers of micStream and CallObject
    )
**/

export default {
  methods: {
    async $_initializeMicStreams () {
      return new Promise(async resolve => {
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true })
        this.$store.commit('SET_MIC_STREAM', micStream)
        resolve()
      })
    }
  }
}