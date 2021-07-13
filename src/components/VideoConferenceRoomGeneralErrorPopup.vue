<template>
  <div class="text-center">
    <v-dialog :value="value" @input="newValue => $emit('input', newValue)" width="500">
      <v-card>
        <v-card-title class="headline">
          An unusual error occured
        </v-card-title>
        <v-card-text>
          <p>{{ feedbackForUser }}<p>

          <p class="mb-0">Try quick-fixes:</p>
          <ol>
            <li>Reload the page</li> 
            <li>Close the page entirely, then open a new one</li> 
            <li>Ensure you use iPad Safari or desktop Chrome</li>
          </ol>

          <br>

          <p class="mb-0">If problems remain, try the general fixes</p> 
          <ol>
            <li>For iPads,
              <a href="https://osxdaily.com/2017/09/28/how-force-quit-apps-ipad-ios-11/" target="_blank">
                force quit Safari
              </a>
            </li>
            <li>
              For computers,
              <a href="https://support.google.com/accounts/answer/32050?co=GENIE.Platform%3DDesktop&hl=en" target="_blank">
                clear cookies and cache on Chrome
              </a>
              and read 
              <a href="https://help.daily.co/en/articles/2303117-top-troubleshooting-tips" target="_blank">
                5 tips that solve 99% of issues
              </a>
            </li>
            <li>Restart your computer / iPad</li>
            <li>Email <a href="mailto: eltonlin@mit.edu">eltonlin@mit.edu</a></li>
          </ol>
        </v-card-text>
        <v-card-actions>
          <v-spacer/>
          <v-btn text @click="$emit('input', false)">
            OK
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script>
// enable v-model
export default {
  props: {
    value: {
      type: Boolean,
      required: true
    },
    feedbackForUser: {
      type: String,
      required: true
    }
  }
}
</script>