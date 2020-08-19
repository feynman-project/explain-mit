<template>
  <!-- Commented out z-index so dropdown menus will show, but now tabs are submerged-->
  <v-container>
    <v-autocomplete
      v-model="selectedItem"
      :search-input.sync="search"
      @keydown="throttledSearch()"
      :items="searchResults"
      label="Search existing posts..."
      flat
      filled
      dense
      outlined
      rounded
      color="accent lighten-2"
      :item-text="text"
      :loading="loading"
      no-data-text="No Posts Match your Search"
      return-object
      class="post-search"
    >
      <template v-slot:item="{ parent, item }">
        <v-list-item :to="`/class/${item.mitClass.id}/${item.postType}/${item.objectID}`" two-line style="border-bottom: 1px solid #eee; max-width: 350px;">
          <v-list-item-content>
            <v-list-item-title v-html="parent.genFilteredText(item.title)" style="font-size:1em; padding-bottom: 5px;"/>
            <v-list-item-subtitle >
                <div class="search-result-html" v-html="parent.genFilteredText(item.html)" style="padding-bottom: 3px;"/>
                <div class="search-result-metadata">
                  <span v-text="item.creator.firstName +' '+ item.creator.lastName"/>
                  <span>|</span>
                  <span v-text="getFolderOrDate(item)"/>
                </div>
            </v-list-item-subtitle>
          </v-list-item-content>
        </v-list-item>
      </template>

      <template v-slot:selection="{ item }">
        <div v-text="item.title">
        </div>
      </template>
    </v-autocomplete>
  </v-container>
</template>

<script>
import { mapState } from "vuex";
import algoliasearch from "algoliasearch";
import { algoliaCreds } from "@/algoliaCreds.js";
import { displayDate } from "@/helpers.js";
import _ from "lodash";

export default {
  props: {
    postType: String
  },
  data () {
    return {
      algoliaClient: algoliasearch(algoliaCreds.APP_SID, algoliaCreds.ADMIN_API_KEY),
      searchInput: "",
      search: null,
      searchResults: [],
      selectedItem: { creator: {}},
      displayDate: displayDate,
      loading: false
    };
  },
  computed: { 
    ...mapState([
      "user",
      "mitClass"
    ]),
    searchIndex () {
      return this.algoliaClient.initIndex(this.mitClass.id)
    },
    postTypeTrans () {
      return this.postType === 'question' ? 'questions' : 'posts' 
    }
  },
  methods: {
    throttledSearch: _.debounce(function () { // without function () {}, `this.searchDatabase()` will be undefined
      this.searchDatabase();
    }, 1000),
    searchDatabase () {
      const val = this.search; // TODO: rename variable
      if (val && val.length > 2) {
        this.loading = true;
        this.searchIndex.search(val).then(({ hits }) => {
          let filteredHits = hits.filter(post => post.postType === this.postTypeTrans)
          if (filteredHits.length !== this.searchResults.length) { // only update when the search result changes. idk if this is necessary but it should be more efficient
            this.searchResults = filteredHits.map(post => { 
              // for display purposes
              post.date = displayDate(post.date);
              post.html = this.stripHtml(post.html);
              return post
            });
          }
          this.loading = false;
        });
      }
    },
    stripHtml (html) {
      var tmp = document.createElement("DIV");
      tmp.innerHTML = html;
      return tmp.textContent || tmp.innerText || "";
    },
    // janky filter type thing so autocomplete displays all results from algolia
    text (item) {
      return item.title +" "+ item.html +" "+ item.creator.firstName +" "+ item.creator.lastName +" "+ item.creator.email;
    },
    getFolderOrDate (item) {
      // So I am trying to get the folder of the post, and in case it doesn't have folder, return only the date (not time)
      // Not sure how to get the folder here
      return item.date;
    }
  }
};
</script>

<style>
.post-search .v-text-field__details {
  display: none;
}
.search-result-metadata span {
  padding: 0 4px;
}
</style>
