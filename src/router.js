import Vue from "vue";
import Router from "vue-router";

Vue.use(Router);

const router = new Router({
  mode: "history",
  base: process.env.BASE_URL,
  routes: [
    {
      path: "/class/:class_id/section/:section_id/room/:room_id",
      component: () => import(/* webpackChunkName: "class-page-layout" */ "./components/CurrentClass.vue"),
      props: route => {
        return {
          classID: route.params.class_id
        }
      }
    }
  ]
});

export default router;

