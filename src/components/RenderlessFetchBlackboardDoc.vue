<script>
import DatabaseHelpersMixin from "@/mixins/DatabaseHelpersMixin.js";

export default {
  props: {
    blackboardRef: Object,
  },
  mixins: [
    DatabaseHelpersMixin
  ],
  data () {
    return {
      isLoading: false,
      backgroundImageDownloadURL: '',
      creator: '',
      date: '',
      audioDownloadURL: '',
      title: '',
      descriptionHtml: '',
      unsubFunc: null
    };
  },
  created () {
    this.isLoading = true
    this.unsubFunc = this.blackboardRef.onSnapshot(doc => {
      // doc.id, doc.ref.path, doc.data()
      const d = doc.data()
      this.creator = d.creator
      this.date = d.date 
      this.backgroundImageDownloadURL = d.backgroundImageDownloadURL
      this.audioDownloadURL = d.audioDownloadURL
      this.title = d.title
      this.descriptionHtml = d.descriptionHtml
      this.isLoading = false
    })
  },
  destroyed () {
    this.unsubFunc()
  },
  render () {
    return this.$scopedSlots.default({
      backgroundImageDownloadURL: this.backgroundImageDownloadURL,
      creator: this.creator,
      date: this.date,
      audioDownloadURL: this.audioDownloadURL,
      title: this.title,
      descriptionHtml: this.descriptionHtml,
      isLoading: this.isLoading,
    });
  }
}
</script>

